const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// GET /stats — tableau de bord global
router.get('/stats', async (req, res) => {
  try {
    const flcpType = await req.prisma.contributionType.findUnique({ where: { code: 'FLCP-MENSUEL' } });
    const [totalMembers, activeMembers, sponsoredCount, flcpAgg, tpcAgg, aipAgg, recentMembers] = await Promise.all([
      req.prisma.member.count(),
      req.prisma.member.count({ where: { status: 'active' } }),
      req.prisma.member.count({ where: { NOT: { sponsoredBy: null } } }),
      req.prisma.contribution.aggregate({ _sum: { amount: true }, _count: true, where: { contributionTypeId: flcpType?.id } }),
      req.prisma.thirdPartyContribution.aggregate({ _sum: { amount: true }, _count: true }),
      req.prisma.aipAccount.aggregate({ _sum: { balance: true, totalCredited: true } }),
      req.prisma.member.findMany({ orderBy: { registrationDate: 'desc' }, take: 6 }),
    ]);
    const totalFlcp = flcpAgg._sum.amount || 0;
    const totalTpc = tpcAgg._sum.amount || 0;
    const treasury = totalFlcp * 0.7 + totalTpc;
    res.json({
      totalMembers,
      activeMembers,
      sponsoredCount,
      flcpCount: flcpAgg._count,
      totalFlcp,
      aipGenerated: totalFlcp * 0.3,
      treasury,
      totalTreasury: treasury,
      totalThirdParty: totalTpc,
      aipBalance: aipAgg._sum.balance || 0,
      aipTotalCredited: aipAgg._sum.totalCredited || 0,
      recentMembers: recentMembers.map(m => ({
        id: m.id, membershipNumber: m.membershipNumber,
        firstName: m.firstName, lastName: m.lastName,
        registrationDate: m.registrationDate, city: m.city,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /top-sponsors — meilleurs parrains
router.get('/top-sponsors', async (req, res) => {
  try {
    const sponsors = await req.prisma.member.findMany({
      where: { sponsored: { some: {} } },
      include: { aipAccount: true, _count: { select: { sponsored: true } } },
    });
    const ranked = sponsors.map(s => ({
      id: s.id, membershipNumber: s.membershipNumber,
      firstName: s.firstName, lastName: s.lastName, city: s.city,
      directReferrals: s._count.sponsored,
      aipBalance: s.aipAccount?.balance || 0,
      aipTotalCredited: s.aipAccount?.totalCredited || 0,
    })).sort((a, b) => b.directReferrals - a.directReferrals || b.aipTotalCredited - a.aipTotalCredited).slice(0, 10);
    res.json({ items: ranked });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
