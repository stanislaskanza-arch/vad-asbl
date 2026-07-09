const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

function generateReferralCode() {
  const hex = '0123456789ABCDEF';
  let c = '';
  for (let i = 0; i < 6; i++) c += hex[Math.floor(Math.random() * 16)];
  return 'VAD-' + c;
}

async function nextMembershipNumber(prisma) {
  const year = new Date().getFullYear();
  const count = await prisma.member.count();
  return `VAD-${year}-${String(count + 1).padStart(6, '0')}`;
}

// GET / — liste + recherche + pagination
router.get('/', async (req, res) => {
  try {
    const { q, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { membershipNumber: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { city: { contains: q } },
      ];
    }
    if (status) where.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      req.prisma.member.findMany({
        where,
        include: {
          sponsor: { select: { id: true, firstName: true, lastName: true, membershipNumber: true } },
          aipAccount: { select: { balance: true } },
          _count: { select: { sponsored: true, contributions: true } },
        },
        orderBy: { registrationDate: 'desc' },
        skip, take: Number(limit),
      }),
      req.prisma.member.count({ where }),
    ]);
    res.json({
      items: items.map(m => ({ ...m, name: `${m.firstName} ${m.lastName}` })),
      total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /tree/all — arbre de parrainage
router.get('/tree/all', async (req, res) => {
  try {
    const members = await req.prisma.member.findMany({
      select: {
        id: true, membershipNumber: true, firstName: true, lastName: true,
        city: true, sponsoredBy: true, registrationDate: true, membershipType: true,
        aipAccount: { select: { balance: true } },
        _count: { select: { sponsored: true } },
      },
      orderBy: { registrationDate: 'asc' },
    });
    const map = {};
    members.forEach(m => { map[m.id] = { ...m, name: `${m.firstName} ${m.lastName}`, children: [] }; });
    const roots = [];
    members.forEach(m => {
      if (m.sponsoredBy && map[m.sponsoredBy]) map[m.sponsoredBy].children.push(map[m.id]);
      else roots.push(map[m.id]);
    });
    res.json({
      roots,
      flat: members.map(m => ({ ...m, name: `${m.firstName} ${m.lastName}` })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id — fiche détaillée
router.get('/:id', async (req, res) => {
  try {
    const member = await req.prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        sponsor: { select: { id: true, firstName: true, lastName: true, membershipNumber: true } },
        sponsored: { select: { id: true, firstName: true, lastName: true, membershipNumber: true, registrationDate: true } },
        aipAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 25 } } },
        contributions: { include: { contributionType: true }, orderBy: { paymentDate: 'desc' }, take: 40 },
        referralLinks: true,
        _count: { select: { sponsored: true, contributions: true } },
      },
    });
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    res.json({ ...member, name: `${member.firstName} ${member.lastName}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / — créer un membre (auto N° adhérent, compte AIP, lien parrainage)
router.post('/', async (req, res) => {
  try {
    const {
      firstName, lastName, gender, email, phone, address, city, province, country,
      profession, idCardNumber, dateOfBirth, membershipType, sponsoredBy, notes,
    } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'Prénom et nom sont requis' });
    const membershipNumber = await nextMembershipNumber(req.prisma);
    const member = await req.prisma.member.create({
      data: {
        membershipNumber,
        firstName, lastName, gender, email, phone, address, city, province,
        country: country || 'RDC', profession, idCardNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        membershipType: membershipType || 'regular',
        sponsoredBy: sponsoredBy || null,
        notes,
        aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
        referralLinks: { create: { code: generateReferralCode() } },
      },
      include: { aipAccount: true, referralLinks: true, sponsor: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json({ ...member, name: `${member.firstName} ${member.lastName}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
