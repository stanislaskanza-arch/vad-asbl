/**
 * deploy-setup.js
 * ────────────────────────────────────────────────────────────
 * Prépare la base de données au déploiement.
 * - Convertit le schéma Prisma de SQLite → PostgreSQL (si nécessaire)
 * - Applique le schéma à la base (db push)
 * - Initialise les données de démonstration (seulement si la base est vide)
 *
 * Lancé automatiquement par Render pendant le build.
 * ──────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');

function ensurePostgresSchema() {
  let schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  if (/provider\s*=\s*"sqlite"/.test(schema)) {
    console.log('🔄 Conversion SQLite → PostgreSQL...');
    schema = schema
      .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
      .replace(/url\s*=\s*"file:\/[^"]*"/, 'url = env("DATABASE_URL")');
    fs.writeFileSync(SCHEMA_PATH, schema);
    console.log('   ✅ Schéma PostgreSQL prêt');
  } else {
    console.log('   ✓ Schéma déjà en PostgreSQL');
  }
}

function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Configuration du déploiement VAD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non défini. Impossible de continuer.');
    process.exit(1);
  }
  console.log('✓ DATABASE_URL présent');

  ensurePostgresSchema();

  console.log('\n📦 Génération du client Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: __dirname });

  console.log('\n🗄️ Application du schéma à la base de données...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: __dirname });

  console.log('\n🌱 Initialisation des données...');
  execSync('node prisma/seed.js', { stdio: 'inherit', cwd: __dirname });

  console.log('\n✅ Configuration terminée !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
