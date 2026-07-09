const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// Crédite le compte AIP du parrain (taux% de la cotisation du filleul)
async function processAip(prisma, contribution, member, contributionType) {
  if (!member.sponsoredBy) return null;
  if (!contributionType.aipRate || contributionType.aipRate <= 0) return null;
  const aipAmount = Math.round(contribution.amount * (contributionType.aipRate / 100));
  let sponsorAccount = await prisma.aipAccount.findUnique({ where: { memberId: member.sponsoredBy } });
  if (!sponsorAccount) sponsorAccount = await prisma.aipAccount.create({ data: { memberId: member.sponsoredBy } });
  await prisma.$transaction([
    prisma.aipAccount.update({
      where: { id: sponsorAccount.id },
      data: { balance: { increment: aipAmount }, totalCredited: { increment: aipAmount }, lastUpdated: new Date() },
    }),
    prisma.aipTransaction.create({
      data: {
        aipAccountId: sponsorAccount.id,
        sourceMemberId: member.id,
        contributionId: contribution.id,
        type: 'credit',
        amount: aipAmount,
        description: `AIP ${contributionType.aipRate}% — ${contributionType.name} de ${member.firstName} ${member.lastName}`,
      },
    }),
    prisma.contribution.update({ where: { id: contribution.id }, data: { aipGenerated: true } }),
  ]);
  return aipAmount;
}

async function nextReceiptNumber(prisma) {
  const year = new Date().getFullYear();
  const count = await prisma.contribution.count();
  return `RECU-${year}-${String(count + 1).padStart(6, '0')}`;
}

// GET /contributions
router.get('/contributions', async (req, res) => {
  try {
    const { page = 1, limit = 30, memberId } = req.query;
    const where = memberId ? { memberId } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      req.prisma.contribution.findMany({
        where,
        include: {
          member: { select: { id: true, firstName: true, lastName: true, membershipNumber: true } },
          contributionType: true,
        },
        orderBy: { paymentDate: 'desc' }, skip, take: Number(limit),
      }),
      req.prisma.contribution.count({ where }),
    ]);
    res.json({
      items: items.map(c => ({ ...c, memberName: `${c.member.firstName} ${c.member.lastName}` })),
      total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /contributions — enregistrer une cotisation FLCP + crédit AIP auto au parrain
router.post('/contributions', async (req, res) => {
  try {
    const { memberId, contributionTypeId, amount, currency, paymentDate, paymentMethodId, reference, notes, periodStart, periodEnd } = req.body;
    if (!memberId || !contributionTypeId || !amount) return res.status(400).json({ error: 'Champs requis manquants' });
    const [member, contributionType] = await Promise.all([
      req.prisma.member.findUnique({ where: { id: memberId } }),
      req.prisma.contributionType.findUnique({ where: { id: contributionTypeId } }),
    ]);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    if (!contributionType) return res.status(404).json({ error: 'Type de cotisation introuvable' });
    const receiptNumber = await nextReceiptNumber(req.prisma);
    const contribution = await req.prisma.contribution.create({
      data: {
        memberId, contributionTypeId,
        amount: Number(amount),
        currency: currency || contributionType.currency || 'CDF',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        paymentMethodId: paymentMethodId || null,
        reference, notes,
        recordedBy: req.user?.username || null,
        receiptNumber,
      },
      include: { contributionType: true, member: { select: { firstName: true, lastName: true, membershipNumber: true } } },
    });
    const aipAmount = await processAip(req.prisma, contribution, member, contributionType);
    res.status(201).json({
      contribution,
      aipCredited: aipAmount,
      message: aipAmount
        ? `Cotisation enregistrée. AIP de ${aipAmount.toLocaleString('fr-FR')} ${contribution.currency} crédité au parrain.`
        : 'Cotisation enregistrée (aucun parrain, pas d\'AIP).',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /third-party — subventions / dons / legs
router.get('/third-party', async (req, res) => {
  try {
    const items = await req.prisma.thirdPartyContribution.findMany({ orderBy: { contributionDate: 'desc' } });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /third-party
router.post('/third-party', async (req, res) => {
  try {
    const { type, donorName, donorContact, amount, currency, contributionDate, description, projectName, contractReference, isRecurring, notes } = req.body;
    if (!type || !donorName || !amount) return res.status(400).json({ error: 'Champs requis manquants' });
    const validTypes = ['SUBVENTION', 'DON', 'LEG'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Type invalide (SUBVENTION, DON ou LEG)' });
    const prefix = type === 'SUBVENTION' ? 'SUB' : type === 'DON' ? 'DON' : 'LEG';
    const year = new Date().getFullYear();
    const count = await req.prisma.thirdPartyContribution.count();
    const receiptNumber = `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
    const item = await req.prisma.thirdPartyContribution.create({
      data: {
        type, donorName, donorContact, amount: Number(amount),
        currency: currency || 'CDF',
        contributionDate: contributionDate ? new Date(contributionDate) : new Date(),
        description, projectName, contractReference,
        isRecurring: !!isRecurring, notes,
        recordedBy: req.user?.username || null,
        receiptNumber,
      },
    });
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /report?period=monthly|quarterly|annual&year=&month=&quarter=  (RF-VAD)
router.get('/report', async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear(), month, quarter } = req.query;
    const y = Number(year);
    let start, end;
    if (period === 'annual') {
      start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1);
    } else if (period === 'quarterly') {
      const q = Number(quarter) || 1;
      const qStart = (q - 1) * 3;
      start = new Date(y, qStart, 1); end = new Date(y, qStart + 3, 1);
    } else {
      const m = month ? Number(month) - 1 : new Date().getMonth();
      start = new Date(y, m, 1); end = new Date(y, m + 1, 1);
    }
    const flcpType = await req.prisma.contributionType.findUnique({ where: { code: 'FLCP-MENSUEL' } });
    const flcpWhere = { contributionTypeId: flcpType?.id, paymentDate: { gte: start, lt: end }, status: 'confirmed' };
    const [flcpAgg, tpcAgg, allAgg] = await Promise.all([
      req.prisma.contribution.aggregate({ _sum: { amount: true }, _count: true, where: flcpWhere }),
      req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, _count: true, where: { contributionDate: { gte: start, lt: end } } }),
      req.prisma.contribution.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: start, lt: end } } }),
    ]);
    const totalFlcp = flcpAgg._sum.amount || 0;
    const totalAip = totalFlcp * 0.3;
    const treasuryFlcp = totalFlcp * 0.7;
    const totalTpc = tpcAgg._sum.amount || 0;
    const totalTreasury = treasuryFlcp + totalTpc;
    // Série mensuelle de l'année
    const monthly = [];
    for (let m = 0; m < 12; m++) {
      const ms = new Date(y, m, 1), me = new Date(y, m + 1, 1);
      const [f, t] = await Promise.all([
        req.prisma.contribution.aggregate({ _sum: { amount: true }, where: { contributionTypeId: flcpType?.id, paymentDate: { gte: ms, lt: me } } }),
        req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, where: { contributionDate: { gte: ms, lt: me } } }),
      ]);
      const fv = f._sum.amount || 0;
      monthly.push({
        month: m + 1, label: `${String(m + 1).padStart(2, '0')}/${y}`,
        flcp: fv, aip: fv * 0.3, treasuryFlcp: fv * 0.7,
        thirdParty: t._sum.amount || 0,
        totalTreasury: fv * 0.7 + (t._sum.amount || 0),
      });
    }
    res.json({
      period, year: y,
      range: { start: start.toISOString(), end: end.toISOString() },
      totalFlcp, totalAip, treasuryFlcp, totalThirdParty: totalTpc, totalTreasury,
      totalContributions: allAgg._sum.amount || 0,
      flcpCount: flcpAgg._count, tpcCount: tpcAgg._count,
      monthly,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /aip/summary — soldes AIP
router.get('/aip/summary', async (req, res) => {
  try {
    const accounts = await req.prisma.aipAccount.findMany({
      include: { member: { select: { id: true, firstName: true, lastName: true, membershipNumber: true, city: true } } },
      orderBy: { balance: 'desc' },
    });
    const totals = await req.prisma.aipAccount.aggregate({ _sum: { balance: true, totalCredited: true, totalDebited: true } });
    res.json({
      accounts: accounts.map(a => ({ ...a, name: `${a.member.firstName} ${a.member.lastName}` })),
      totalBalance: totals._sum.balance || 0,
      totalCredited: totals._sum.totalCredited || 0,
      totalDebited: totals._sum.totalDebited || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
