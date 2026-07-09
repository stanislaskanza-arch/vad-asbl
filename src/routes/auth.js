const router = require('express').Router();
const { login, authenticate } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

module.exports = router;
