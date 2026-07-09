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

module.exports = router;
