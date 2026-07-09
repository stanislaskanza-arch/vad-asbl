const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://vad-asbl.org';

function newCode() {
  const hex = '0123456789ABCDEF';
  let c = '';
  for (let i = 0; i < 6; i++) c += hex[Math.floor(Math.random() * 16)];
  return 'VAD-' + c;
}

// GET /:memberId/link — lien de parrainage + partage réseaux (public)
router.get('/:memberId/link', async (req, res) => {
  try {
    let link = await req.prisma.referralLink.findFirst({ where: { memberId: req.params.memberId } });
    if (!link) {
      const member = await req.prisma.member.findUnique({ where: { id: req.params.memberId } });
      if (!member) return res.status(404).json({ error: 'Membre introuvable' });
      link = await req.prisma.referralLink.create({ data: { memberId: member.id, code: newCode() } });
    }
    const fullUrl = `${BASE_URL}/join/${link.code}`;
    const msg = `Rejoignez l'ASBL VAD — Vision d'Assistance et de Développement. Ensemble, luttons contre la pauvreté ! ${fullUrl}`;
    res.json({
      code: link.code,
      fullUrl,
      totalClicks: link.totalClicks,
      totalRegistrations: link.totalRegistrations,
      shareLinks: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(msg)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent("Rejoignez VAD pour lutter contre la pauvreté !")}&url=${encodeURIComponent(fullUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`,
        email: `mailto:?subject=${encodeURIComponent("Invitation à rejoindre VAD")}&body=${encodeURIComponent(msg)}`,
        copy: fullUrl,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /track — suivre un clic / visite (public)
router.post('/track', async (req, res) => {
  try {
    const { code, eventType = 'click', referrerUrl, landingPage } = req.body;
    const link = await req.prisma.referralLink.findUnique({ where: { code } });
    if (!link) return res.status(404).json({ error: 'Code de parrainage invalide' });
    await req.prisma.$transaction([
      req.prisma.referralLink.update({
        where: { id: link.id },
        data: { totalClicks: { increment: 1 }, lastClickedAt: new Date() },
      }),
      req.prisma.referralEvent.create({
        data: {
          referralLinkId: link.id, eventType,
          referrerUrl, landingPage,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
        },
      }),
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:memberId/stats — statistiques du lien (admin)
router.get('/:memberId/stats', authenticate, async (req, res) => {
  try {
    const link = await req.prisma.referralLink.findFirst({
      where: { memberId: req.params.memberId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!link) return res.status(404).json({ error: 'Aucun lien de parrainage pour ce membre' });
    res.json(link);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
