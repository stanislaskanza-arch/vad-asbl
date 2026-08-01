const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

// POST /subscribe — abonnement public à la newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { name, email, phone, channel } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'E-mail ou téléphone requis' });
    // Vérifier doublon
    if (email) {
      const existing = await req.prisma.subscriber.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Vous êtes déjà abonné(e) !' });
    }
    const sub = await req.prisma.subscriber.create({
      data: { name: name || null, email: email || null, phone: phone || null, channel: channel || 'email' },
    });
    res.status(201).json({ ok: true, message: 'Merci ! Votre abonnement à la newsletter VAD a bien été enregistré.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /subscribers — liste des abonnés (admin)
router.get('/subscribers', authenticate, async (req, res) => {
  try {
    const items = await req.prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' } });
    const total = await req.prisma.subscriber.count();
    res.json({ items, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /subscribers/:id — supprimer un abonné (admin)
router.delete('/subscribers/:id', authenticate, async (req, res) => {
  try {
    await req.prisma.subscriber.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
