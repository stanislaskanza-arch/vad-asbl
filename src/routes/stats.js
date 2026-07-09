const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// GET /members — statistiques des membres
router.get('/members', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const [total, active, inactive, newThisMonth, newThisYear, withSponsor, withoutSponsor, male, female, aipAgg] = await Promise.all([
      req.prisma.member.count(),
      req.prisma.member.count({ where: { status: 'active' } }),
      req.prisma.member.count({ where: { status: { not: 'active' } } }),
      req.prisma.member.count({ where: { registrationDate: { gte: startOfMonth } } }),
      req.prisma.member.count({ where: { registrationDate: { gte: startOfYear } } }),
      req.prisma.member.count({ where: { NOT: { sponsoredBy: null } } }),
      req.prisma.member.count({ where: { sponsoredBy: null } }),
      req.prisma.member.count({ where: { gender: 'M' } }),
      req.prisma.member.count({ where: { gender: 'F' } }),
      req.prisma.aipAccount.aggregate({ _sum: { balance: true } }),
    ]);
    const monthly = [];
    for (let m = 0; m < 12; m++) {
      const c = await req.prisma.member.count({
        where: { registrationDate: { gte: new Date(now.getFullYear(), m, 1), lt: new Date(now.getFullYear(), m + 1, 1) } },
      });
      monthly.push({ month: m + 1, count: c });
    }
    res.json({
      total, active, inactive, newThisMonth, newThisYear, withSponsor, withoutSponsor,
      gender: { male, female, other: Math.max(0, total - male - female) },
      aipBalance: aipAgg._sum.balance || 0,
      monthly,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /finances — statistiques financières
router.get('/finances', async (req, res) => {
  try {
    const flcpType = await req.prisma.contributionType.findUnique({ where: { code: 'FLCP-MENSUEL' } });
    const now = new Date();
    const allTimeFlcp = await req.prisma.contribution.aggregate({ _sum: { amount: true }, _count: true, where: { contributionTypeId: flcpType?.id } });
    const allTimeTpc = await req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, _count: true });
    const monthly = [];
    for (let m = 0; m < 12; m++) {
      const ms = new Date(now.getFullYear(), m, 1), me = new Date(now.getFullYear(), m + 1, 1);
      const [f, t] = await Promise.all([
        req.prisma.contribution.aggregate({ _sum: { amount: true }, where: { contributionTypeId: flcpType?.id, paymentDate: { gte: ms, lt: me } } }),
        req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, where: { contributionDate: { gte: ms, lt: me } } }),
      ]);
      const fv = f._sum.amount || 0;
      monthly.push({
        month: m + 1,
        flcp: fv, aip: fv * 0.3, treasury: fv * 0.7 + (t._sum.amount || 0), thirdParty: t._sum.amount || 0,
      });
    }
    const totalFlcp = allTimeFlcp._sum.amount || 0;
    res.json({
      allTime: {
        flcp: totalFlcp, aip: totalFlcp * 0.3,
        treasury: totalFlcp * 0.7 + (allTimeTpc._sum.amount || 0),
        thirdParty: allTimeTpc._sum.amount || 0,
        flcpCount: allTimeFlcp._count, tpcCount: allTimeTpc._count,
      },
      monthly,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /projections
router.get('/projections', async (req, res) => {
  try {
    const items = await req.prisma.growthProjection.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
