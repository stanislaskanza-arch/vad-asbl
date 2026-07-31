const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { req.prisma = prisma; next(); });

// Santé du service
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'VAD API', time: new Date().toISOString() }));

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/members', require('./routes/members'));
app.use('/api/finances', require('./routes/finances'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/sponsors', require('./routes/sponsors'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/forecasts', require('./routes/forecasts'));
app.use('/api/misc', require('./routes/misc'));
app.use('/api/content', require('./routes/content'));

// Frontend intégré — anti-cache pour index.html (toujours la dernière version)
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d' }));
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VAD Application lancée sur http://0.0.0.0:${PORT}`);
});
