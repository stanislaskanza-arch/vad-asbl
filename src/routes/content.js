const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

// GET /all — toutes les surcharges de contenu (images + textes) — public pour le rendu
router.get('/all', async (req, res) => {
  try {
    const rows = await req.prisma.setting.findMany({ where: { OR: [{ key: { startsWith: 'img.' } }, { key: { startsWith: 'txt.' } }] } });
    const data = {};
    rows.forEach(r => { data[r.key] = r.value; });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /images — liste des images gérables (avec infos) — admin
router.get('/images', authenticate, async (req, res) => {
  try {
    const defs = [
      { key: 'img.hero-solidarite', file: 'hero-solidarite.jpg', label: 'Image d\'accueil (hero)', section: 'Page d\'accueil' },
      { key: 'img.section-developpement', file: 'section-developpement.jpg', label: 'Section développement', section: 'Page d\'accueil' },
      { key: 'img.cta-espoir', file: 'cta-espoir.jpg', label: 'Section appel à l\'action', section: 'Page d\'accueil' },
      { key: 'img.cotiser-paiement', file: 'cotiser-paiement.jpg', label: 'Image page Cotiser', section: 'Page Cotiser' },
      { key: 'img.comment-ca-marche', file: 'comment-ca-marche.jpg', label: 'Image Comment ça marche', section: 'Mission VAD' },
      { key: 'img.rejoindre', file: 'rejoindre.jpg', label: 'Image Rejoindre', section: 'Mission VAD' },
      { key: 'img.contact', file: 'contact.jpg', label: 'Image Contact', section: 'Page Contact' },
      { key: 'img.president', file: 'president.jpg', label: 'Photo du Président', section: 'Mission VAD' },
      { key: 'img.logo-vad', file: 'logo-vad.png', label: 'Logo de la VAD', section: 'Identité' },
    ];
    const rows = await req.prisma.setting.findMany({ where: { key: { startsWith: 'img.' } } });
    const overrides = {};
    rows.forEach(r => { overrides[r.key] = r.value; });
    res.json({ items: defs.map(d => ({ ...d, overridden: !!overrides[d.key] })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /image — mettre à jour une image (base64) — admin
router.post('/image', authenticate, async (req, res) => {
  try {
    const { key, base64 } = req.body;
    if (!key || !base64) return res.status(400).json({ error: 'Clé et image requises' });
    if (!key.startsWith('img.')) return res.status(400).json({ error: 'Clé invalide' });
    // Limite ~2 Mo
    if (base64.length > 3000000) return res.status(400).json({ error: 'Image trop volumineuse (max 2 Mo). Réduisez sa taille.' });
    const existing = await req.prisma.setting.findUnique({ where: { key } });
    if (existing) {
      await req.prisma.setting.update({ where: { key }, data: { value: base64 } });
    } else {
      await req.prisma.setting.create({ data: { key, value: base64, description: 'Image surchargee par admin' } });
    }
    res.json({ ok: true, message: 'Image mise à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /image/reset — remettre l'image par défaut — admin
router.post('/image/reset', authenticate, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key || !key.startsWith('img.')) return res.status(400).json({ error: 'Clé invalide' });
    await req.prisma.setting.deleteMany({ where: { key } });
    res.json({ ok: true, message: 'Image réinitialisée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /texts — liste des textes éditables — admin
router.get('/texts', authenticate, async (req, res) => {
  try {
    const defs = [
      { key: 'txt.president.message', label: 'Mot du Président National', section: 'Président', type: 'textarea', default: '' },
      { key: 'txt.mission.intro', label: 'Énoncé de mission', section: 'Notre Mission', type: 'textarea', default: '' },
      { key: 'txt.genes', label: 'Texte de la Genèse', section: 'Genèse', type: 'textarea', default: '' },
    ];
    // Activités
    const acts = [
      ['vulgarisation', 'Vulgarisation'], ['recrutement', 'Recrutement'], ['formation', 'Formation'],
      ['assistance', 'Assistance'], ['jeunes', 'Jeunes'], ['projets', 'Projets'],
    ];
    acts.forEach(([k, name]) => {
      defs.push({ key: 'txt.activity.' + k + '.intro', label: name + ' — Introduction', section: 'Activités', type: 'textarea', default: '' });
      defs.push({ key: 'txt.activity.' + k + '.s1', label: name + ' — Section 1', section: 'Activités', type: 'textarea', default: '' });
      defs.push({ key: 'txt.activity.' + k + '.s2', label: name + ' — Section 2', section: 'Activités', type: 'textarea', default: '' });
      defs.push({ key: 'txt.activity.' + k + '.s3', label: name + ' — Section 3', section: 'Activités', type: 'textarea', default: '' });
    });
    const rows = await req.prisma.setting.findMany({ where: { key: { startsWith: 'txt.' } } });
    const values = {};
    rows.forEach(r => { values[r.key] = r.value; });
    res.json({ items: defs.map(d => ({ ...d, value: values[d.key] || d.default })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /text — mettre à jour un texte — admin
router.post('/text', authenticate, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !key.startsWith('txt.')) return res.status(400).json({ error: 'Clé invalide' });
    const existing = await req.prisma.setting.findUnique({ where: { key } });
    if (existing) {
      await req.prisma.setting.update({ where: { key }, data: { value: value || '' } });
    } else {
      await req.prisma.setting.create({ data: { key, value: value || '', description: 'Texte surcharge par admin' } });
    }
    res.json({ ok: true, message: 'Texte mis à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
