const router = require('express').Router();

const PAYMENT_METHODS = [
  { id: 'cash', code: 'CASH', name: 'Espèces', icon: '💵' },
  { id: 'bank_transfer', code: 'BANK', name: 'Virement bancaire', icon: '🏦' },
  { id: 'mobile_money', code: 'MOMO', name: 'Mobile Money', icon: '📱' },
  { id: 'check', code: 'CHECK', name: 'Chèque', icon: '🧾' },
  { id: 'other', code: 'OTHER', name: 'Autre', icon: '➖' },
];

router.get('/contribution-types', async (req, res) => {
  try {
    const items = await req.prisma.contributionType.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/payment-methods', (req, res) => res.json({ items: PAYMENT_METHODS }));

router.get('/loan-products', async (req, res) => {
  try {
    const items = await req.prisma.loanProduct.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/assistance-types', async (req, res) => {
  try {
    const items = await req.prisma.assistanceType.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/settings', async (req, res) => {
  try {
    const rows = await req.prisma.setting.findMany();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /public-stats — statistiques publiques (page d'accueil)
router.get('/public-stats', async (req, res) => {
  try {
    const flcpType = await req.prisma.contributionType.findUnique({ where: { code: 'FLCP-MENSUEL' } });
    const [totalMembers, activeMembers, flcpAgg, tpcAgg, aipAgg, flcpCount] = await Promise.all([
      req.prisma.member.count(),
      req.prisma.member.count({ where: { status: 'active' } }),
      req.prisma.contribution.aggregate({ _sum: { amount: true }, where: { contributionTypeId: flcpType?.id } }),
      req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, _count: true }),
      req.prisma.aipAccount.aggregate({ _sum: { totalCredited: true } }),
      req.prisma.contribution.count({ where: { contributionTypeId: flcpType?.id } }),
    ]);
    const totalFlcp = flcpAgg._sum.amount || 0;
    const totalTpc = tpcAgg._sum.amount || 0;
    const sponsors = await req.prisma.member.findMany({
      where: { sponsored: { some: {} } },
      include: { _count: { select: { sponsored: true } } },
    });
    const topSponsors = sponsors.map(s => ({ firstName: s.firstName, lastName: s.lastName, city: s.city, directReferrals: s._count.sponsored })).sort((a, b) => b.directReferrals - a.directReferrals).slice(0, 5);
    const provinces = await req.prisma.member.groupBy({ by: ['province'], _count: true, orderBy: { _count: { province: 'desc' } } });
    res.json({
      totalMembers, activeMembers, flcpCount,
      totalFlcp, totalThirdParty: totalTpc,
      treasury: totalFlcp * 0.7 + totalTpc,
      aipCredited: aipAgg._sum.totalCredited || 0,
      provinces,
      topSponsors,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /payment-info — coordonnées de paiement + texte de motivation (page publique "Cotiser")
router.get('/payment-info', async (req, res) => {
  try {
    const rows = await req.prisma.setting.findMany({ where: { OR: [{ key: { startsWith: 'payment.' } }, { key: 'flcp.monthly_amount' }] } });
    const info = {};
    rows.forEach(r => { info[r.key] = r.value; });
    const defaults = {
      'payment.bank_name': 'RAWBANK',
      'payment.bank_account_name': 'ASBL VAD — Vision d\'Assistance et de Développement',
      'payment.bank_account_number': '00000 00000 0000000000000',
      'payment.bank_swift': 'RAWSRDCD',
      'payment.mpesa_number': '+243 000 000 000',
      'payment.mpesa_merchant': 'VAD000',
      'payment.orange_number': '+243 000 000 000',
      'payment.orange_merchant': 'VAD',
      'payment.airtel_number': '+243 000 000 000',
      'payment.airtel_merchant': 'VAD',
    };
    Object.keys(defaults).forEach(k => { if (!info[k]) info[k] = defaults[k]; });
    info['flcp.monthly_amount'] = info['flcp.monthly_amount'] || '5000';
    res.json(info);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /declare-payment — un membre déclare son paiement en ligne (cotisation en attente)
router.post('/declare-payment', async (req, res) => {
  try {
    const { membershipNumber, contributionTypeCode = 'FLCP-MENSUEL', amount, paymentMethod, transactionRef, period, notes } = req.body;
    if (!membershipNumber || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'Numéro de membre, montant et moyen de paiement sont requis' });
    }
    const member = await req.prisma.member.findUnique({ where: { membershipNumber } });
    if (!member) return res.status(404).json({ error: 'Numéro de membre introuvable. Vérifiez votre numéro (ex: VAD-2026-000001).' });
    const contributionType = await req.prisma.contributionType.findUnique({ where: { code: contributionTypeCode } });
    if (!contributionType) return res.status(404).json({ error: 'Type de cotisation inconnu' });
    const year = new Date().getFullYear();
    const count = await req.prisma.contribution.count();
    const receiptNumber = `RECU-${year}-${String(count + 1).padStart(6, '0')}`;
    const contribution = await req.prisma.contribution.create({
      data: {
        memberId: member.id,
        contributionTypeId: contributionType.id,
        amount: Number(amount),
        currency: contributionType.currency || 'CDF',
        paymentDate: new Date(),
        periodStart: period ? new Date(period + '-01') : null,
        paymentMethodId: paymentMethod,
        status: 'pending', // en attente de validation par l'administrateur
        aipGenerated: false,
        receiptNumber,
        reference: transactionRef ? `Déclaration en ligne — réf: ${transactionRef}` : 'Déclaration en ligne',
        notes: notes || `Paiement déclaré par le membre en ligne (${paymentMethod})`,
        recordedBy: member.membershipNumber,
      },
      include: { contributionType: true },
    });
    res.status(201).json({
      receiptNumber: contribution.receiptNumber,
      status: 'pending',
      amount: contribution.amount,
      message: `Votre paiement de ${Number(amount).toLocaleString('fr-FR')} ${contribution.currency} a bien été déclaré. ` +
        `Reçu ${receiptNumber}. Il sera validé par le Responsable des Finances sous 24-48h. L'AIP de votre parrain sera crédité après validation.`,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
