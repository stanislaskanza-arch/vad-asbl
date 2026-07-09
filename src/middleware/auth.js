const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'vad-secret-2026';
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
    const user = await req.prisma.adminUser.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Identifiants invalides' });
    if (!user.isActive) return res.status(403).json({ error: 'Compte désactivé' });
    await req.prisma.adminUser.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, role: user.role, email: user.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
  try { req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET); next(); } catch (e) { res.status(401).json({ error: 'Token invalide' }); }
}
module.exports = { login, authenticate };
