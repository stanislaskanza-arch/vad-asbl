const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// GET /leaderboard — classement des parrains
router.get('/leaderboard', async (req, res) => {
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
    })).sort((a, b) => b.directReferrals - a.directReferrals || b.aipTotalCredited - a.aipTotalCredited);
    res.json({ items: ranked });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
