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

// Frontend intégré
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../public', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 VAD Application lancée sur http://0.0.0.0:${PORT}`);
});
