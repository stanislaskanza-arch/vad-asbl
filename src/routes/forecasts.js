const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// GET /members — projection des membres (3 scénarios)
router.get('/members', async (req, res) => {
  try {
    const total = await req.prisma.member.count();
    const months = Number(req.query.months) || 12;
    const proj = await req.prisma.growthProjection.findFirst();
    const baseRate = (proj?.baseGrowthRate || 5) / 100;
    const optRate = (proj?.optimisticRate || 10) / 100;
    const pessRate = (proj?.pessimisticRate || 2) / 100;
    const series = [];
    let pb = total, pm = total, po = total;
    for (let i = 1; i <= months; i++) {
      pb = Math.round(pb * (1 + baseRate));
      pm = Math.round(pm * (1 + pessRate));
      po = Math.round(po * (1 + optRate));
      series.push({ month: i, pessimistic: pm, base: pb, optimistic: po });
    }
    res.json({
      current: total,
      monthlyGrowthRate: { pessimistic: pessRate, base: baseRate, optimistic: optRate },
      series,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /revenue — projection des revenus (3 scénarios)
router.get('/revenue', async (req, res) => {
  try {
    const flcpType = await req.prisma.contributionType.findUnique({ where: { code: 'FLCP-MENSUEL' } });
    const avgFlcp = flcpType?.defaultAmount || 5000;
    const total = await req.prisma.member.count();
    const months = Number(req.query.months) || 12;
    const proj = await req.prisma.growthProjection.findFirst();
    const baseRate = (proj?.baseGrowthRate || 5) / 100;
    const optRate = (proj?.optimisticRate || 10) / 100;
    const pessRate = (proj?.pessimisticRate || 2) / 100;
    const series = [];
    let pb = total, pm = total, po = total;
    for (let i = 1; i <= months; i++) {
      pb = Math.round(pb * (1 + baseRate));
      pm = Math.round(pm * (1 + pessRate));
      po = Math.round(po * (1 + optRate));
      series.push({
        month: i,
        pessimistic: { members: pm, revenue: pm * avgFlcp, treasury: Math.round(pm * avgFlcp * 0.7) },
        base: { members: pb, revenue: pb * avgFlcp, treasury: Math.round(pb * avgFlcp * 0.7) },
        optimistic: { members: po, revenue: po * avgFlcp, treasury: Math.round(po * avgFlcp * 0.7) },
      });
    }
    res.json({ currentMembers: total, avgFlcp, series });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
