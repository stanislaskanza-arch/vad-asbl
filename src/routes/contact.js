const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

// POST /message — un visiteur envoie un message (public)
router.post('/message', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Nom, e-mail et message sont requis' });
    const msg = await req.prisma.contactMessage.create({
      data: { name, email, subject: subject || null, message },
    });
    res.status(201).json({ ok: true, message: 'Merci ! Votre message a bien été envoyé. Nous vous répondrons dans les meilleurs délais.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /messages — liste des messages (admin)
router.get('/messages', authenticate, async (req, res) => {
  try {
    const items = await req.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    const unread = await req.prisma.contactMessage.count({ where: { isRead: false } });
    res.json({ items, total: items.length, unread });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /messages/:id/read — marquer comme lu (admin)
router.post('/messages/:id/read', authenticate, async (req, res) => {
  try {
    await req.prisma.contactMessage.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /messages/:id — supprimer (admin)
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    await req.prisma.contactMessage.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
