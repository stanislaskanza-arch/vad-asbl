#!/bin/bash
# ============================================================
#  VAD — Script de démarrage complet (serveur + tunnel public)
#  Usage : bash /home/user/vad-app/backend/start.sh
# ============================================================
cd "$(dirname "$0")"

echo "📦 Vérification des dépendances..."
if [ ! -d node_modules ]; then
  echo "   node_modules absent → réinstallation..."
  npm install --silent 2>&1 | tail -1
fi
if [ ! -f node_modules/.prisma/client/index.js ]; then
  echo "   génération client Prisma..."
  ./node_modules/.bin/prisma generate --skip-generate 2>/dev/null || ./node_modules/.bin/prisma generate 2>&1 | tail -1
fi

echo "🛑 Arrêt des anciens processus..."
for PID in $(ss -ltnp 2>/dev/null | grep ':4000' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill "$PID" 2>/dev/null
done
sleep 2

echo "🚀 Démarrage du serveur VAD (port 4000)..."
nohup node src/index.js > /home/user/vad-app/server.log 2>&1 &
sleep 4
if curl -s http://localhost:4000/api/health >/dev/null 2>&1; then
  echo "   ✅ Serveur OK"
else
  echo "   ❌ Serveur KO — voir server.log"
  exit 1
fi

echo "🌐 Création du tunnel public (localhost.run)..."
setsid ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=60 -R 80:localhost:4000 nokey@localhost.run \
  > /home/user/vad-app/lhr.log 2>&1 < /dev/null &
sleep 16

URL=$(grep -oP 'https://[a-z0-9-]+\.lhr\.life' /home/user/vad-app/lhr.log | head -1)
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ APPLICATION VAD EN LIGNE !"
echo ""
echo "  🌐 URL publique : ${URL:-https://<voir lhr.log>}"
echo "  🔑 Connexion   : superadmin / admin123"
echo "                  rf-vad    / admin123"
echo "═══════════════════════════════════════════════════════"
