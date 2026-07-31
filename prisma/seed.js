const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function newCode() {
  const hex = '0123456789ABCDEF';
  let c = '';
  for (let i = 0; i < 6; i++) c += hex[Math.floor(Math.random() * 16)];
  return 'VAD-' + c;
}

function monthBack(i, from = new Date()) {
  const total = from.getMonth() - i;
  const y = from.getFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return new Date(y, m, 5, 10, 0, 0);
}

async function main() {
  console.log('🌱 Initialisation des données VAD...\n');

  // ── Protection des données existantes ──────────────────────
  // En production, on NE réinitialise JAMAIS la base si elle contient déjà
  // des données (sinon on effacerait les vraies données à chaque déploiement).
  // Pour forcer la réinitialisation, définir RESET_SEED=true.
  const existing = await prisma.adminUser.count();
  if (existing > 0 && process.env.RESET_SEED !== 'true') {
    console.log('ℹ️  La base contient déjà des données (' + existing + ' administrateur(s)).');
    console.log('    ✅ Initialisation ignorée — les données existantes sont conservées.');
    console.log('    (Pour forcer la réinitialisation, définir RESET_SEED=true)');
    return;
  }

  // ── Nettoyage ──────────────────────────────────────────────
  console.log('🧹 Nettoyage de la base...');
  await prisma.$transaction([
    prisma.referralEvent.deleteMany(),
    prisma.referralLink.deleteMany(),
    prisma.aipTransaction.deleteMany(),
    prisma.aipAccount.deleteMany(),
    prisma.contribution.deleteMany(),
    prisma.loanRepayment.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.assistanceRequest.deleteMany(),
    prisma.thirdPartyContribution.deleteMany(),
    prisma.fundAllocation.deleteMany(),
    prisma.contributionType.deleteMany(),
    prisma.loanProduct.deleteMany(),
    prisma.assistanceType.deleteMany(),
    prisma.member.deleteMany(),
    prisma.adminUser.deleteMany(),
    prisma.growthProjection.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  // ── Administrateurs ────────────────────────────────────────
  console.log('👥 Création des administrateurs...');
  const pwHash = await bcrypt.hash('admin123', 12);
  await prisma.adminUser.createMany({
    data: [
      { username: 'superadmin', email: 'superadmin@vad-asbl.org', passwordHash: pwHash, firstName: 'Super', lastName: 'Administrateur', role: 'super_admin' },
      { username: 'rf-vad', email: 'rf@vad-asbl.org', passwordHash: pwHash, firstName: 'Responsable', lastName: 'des Finances', role: 'admin' },
    ],
  });

  // ── Types de cotisation ────────────────────────────────────
  console.log('💰 Création des types de cotisation...');
  const flcpType = await prisma.contributionType.create({
    data: { code: 'FLCP-MENSUEL', name: 'Fonds pour la Lutte Contre la Pauvreté', description: 'Cotisation mensuelle obligatoire de lutte contre la pauvreté', defaultAmount: 5000, currency: 'CDF', frequency: 'mensuel', aipRate: 30, isRequired: true },
  });
  await prisma.contributionType.createMany({
    data: [
      { code: 'DON-VOLONTAIRE', name: 'Don Volontaire', description: 'Contribution volontaire supplémentaire', defaultAmount: 0, currency: 'CDF', frequency: 'ponctuel', aipRate: 0, isRequired: false },
      { code: 'COTIS-ANNUELLE', name: 'Cotisation Annuelle d\'Adhésion', description: 'Frais annuels d\'adhésion', defaultAmount: 12000, currency: 'CDF', frequency: 'annuel', aipRate: 0, isRequired: true },
    ],
  });

  // ── Produits de micro-crédit ───────────────────────────────
  console.log('🏦 Création des produits de micro-crédit...');
  await prisma.loanProduct.createMany({
    data: [
      { code: 'MICRO-PETIT', name: 'Micro-Crédit Petit', description: 'Petit crédit de démarrage', minAmount: 50000, maxAmount: 200000, interestRate: 12, minDurationMonths: 3, maxDurationMonths: 12, requiresGuarantor: false },
      { code: 'MICRO-MOYEN', name: 'Micro-Crédit Moyen', description: 'Crédit pour activité commerciale', minAmount: 200000, maxAmount: 1000000, interestRate: 14, minDurationMonths: 6, maxDurationMonths: 24, requiresGuarantor: true },
      { code: 'MICRO-GRAND', name: 'Micro-Crédit Grand', description: 'Crédit pour projet structurant', minAmount: 1000000, maxAmount: 5000000, interestRate: 15, minDurationMonths: 12, maxDurationMonths: 36, requiresGuarantor: true },
      { code: 'MICRO-AGRICOLE', name: 'Micro-Crédit Agricole', description: 'Crédit pour activités agricoles', minAmount: 100000, maxAmount: 2000000, interestRate: 9, minDurationMonths: 6, maxDurationMonths: 24, requiresGuarantor: false },
      { code: 'MICRO-URGENCE', name: 'Micro-Crédit d\'Urgence', description: 'Crédit rapide pour besoins urgents', minAmount: 25000, maxAmount: 150000, interestRate: 18, minDurationMonths: 1, maxDurationMonths: 6, requiresGuarantor: false },
    ],
  });

  // ── Types d'assistance ─────────────────────────────────────
  console.log('🤝 Création des types d\'assistance...');
  await prisma.assistanceType.createMany({
    data: [
      { code: 'AIDE-FUNERAILLE', name: 'Aide Funéraire', description: 'Assistance en cas de décès', maxAmount: 300000 },
      { code: 'AIDE-SANTE', name: 'Aide Santé', description: 'Assistance médicale', maxAmount: 500000 },
      { code: 'AIDE-SCOLARITE', name: 'Aide Scolarité', description: 'Frais de scolarité', maxAmount: 200000 },
      { code: 'AIDE-ALIMENTAIRE', name: 'Aide Alimentaire', description: 'Assistance alimentaire', maxAmount: 100000 },
    ],
  });

  // ── Membres + parrainage ───────────────────────────────────
  console.log('🧑‍🤝‍🧑 Création des membres...');
  const memberData = [
    { num: 'VAD-2026-000001', firstName: 'Stanislas', lastName: 'KANZA NZINU', gender: 'M', phone: '+243810000001', city: 'Kinshasa', province: 'Kinshasa', profession: 'Coordinateur', email: 'stanislas.kanza@vad-asbl.org', sponsoredBy: null, membershipType: 'founding' },
    { num: 'VAD-2026-000002', firstName: 'Jean', lastName: 'MUKENDI', gender: 'M', phone: '+243810000002', city: 'Lubumbashi', province: 'Haut-Katanga', profession: 'Commerçant', email: 'jean.mukendi@example.com', membershipType: 'regular' },
    { num: 'VAD-2026-000003', firstName: 'Marie', lastName: 'KABUYA', gender: 'F', phone: '+243810000003', city: 'Goma', province: 'Nord-Kivu', profession: 'Infirmière', email: 'marie.kabuya@example.com', membershipType: 'regular' },
    { num: 'VAD-2026-000004', firstName: 'Esther', lastName: 'KASONGO', gender: 'F', phone: '+243810000004', city: 'Mbuji-Mayi', province: 'Kasaï-Oriental', profession: 'Enseignante', email: 'esther.kasongo@example.com', membershipType: 'regular' },
    { num: 'VAD-2026-000005', firstName: 'Paul', lastName: 'NGOY', gender: 'M', phone: '+243810000005', city: 'Kananga', province: 'Kasaï-Central', profession: 'Agriculteur', email: 'paul.ngoy@example.com', membershipType: 'regular' },
  ];
  // Premier membre (racine, sans parrain)
  const m1 = await prisma.member.create({
    data: {
      membershipNumber: memberData[0].num, firstName: memberData[0].firstName, lastName: memberData[0].lastName,
      gender: memberData[0].gender, phone: memberData[0].phone, city: memberData[0].city, province: memberData[0].province,
      country: 'RDC', profession: memberData[0].profession, email: memberData[0].email, membershipType: memberData[0].membershipType,
      registrationDate: monthBack(17), status: 'active',
      aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
      referralLinks: { create: { code: newCode() } },
    },
  });
  // Membre 2 parrainé par m1
  const m2 = await prisma.member.create({
    data: {
      membershipNumber: memberData[1].num, firstName: memberData[1].firstName, lastName: memberData[1].lastName,
      gender: memberData[1].gender, phone: memberData[1].phone, city: memberData[1].city, province: memberData[1].province,
      country: 'RDC', profession: memberData[1].profession, email: memberData[1].email, membershipType: memberData[1].membershipType,
      registrationDate: monthBack(16), status: 'active', sponsoredBy: m1.id,
      aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
      referralLinks: { create: { code: newCode() } },
    },
  });
  // Membres 3 et 4 parrainés par m1
  const m3 = await prisma.member.create({
    data: {
      membershipNumber: memberData[2].num, firstName: memberData[2].firstName, lastName: memberData[2].lastName,
      gender: memberData[2].gender, phone: memberData[2].phone, city: memberData[2].city, province: memberData[2].province,
      country: 'RDC', profession: memberData[2].profession, email: memberData[2].email, membershipType: memberData[2].membershipType,
      registrationDate: monthBack(15), status: 'active', sponsoredBy: m1.id,
      aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
      referralLinks: { create: { code: newCode() } },
    },
  });
  const m4 = await prisma.member.create({
    data: {
      membershipNumber: memberData[3].num, firstName: memberData[3].firstName, lastName: memberData[3].lastName,
      gender: memberData[3].gender, phone: memberData[3].phone, city: memberData[3].city, province: memberData[3].province,
      country: 'RDC', profession: memberData[3].profession, email: memberData[3].email, membershipType: memberData[3].membershipType,
      registrationDate: monthBack(14), status: 'active', sponsoredBy: m1.id,
      aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
      referralLinks: { create: { code: newCode() } },
    },
  });
  // Membre 5 parrainé par m2
  const m5 = await prisma.member.create({
    data: {
      membershipNumber: memberData[4].num, firstName: memberData[4].firstName, lastName: memberData[4].lastName,
      gender: memberData[4].gender, phone: memberData[4].phone, city: memberData[4].city, province: memberData[4].province,
      country: 'RDC', profession: memberData[4].profession, email: memberData[4].email, membershipType: memberData[4].membershipType,
      registrationDate: monthBack(12), status: 'active', sponsoredBy: m2.id,
      aipAccount: { create: { balance: 0, totalCredited: 0, totalDebited: 0 } },
      referralLinks: { create: { code: newCode() } },
    },
  });
  const members = [m1, m2, m3, m4, m5];

  // ── Cotisations FLCP (18 mois) + crédit AIP au parrain ─────
  console.log('💵 Génération de 18 mois de cotisations FLCP + AIP...');
  let receiptSeq = 1;
  const year = new Date().getFullYear();
  for (const m of members) {
    // combien de mois ce membre a cotisé (depuis son inscription)
    for (let i = 0; i < 18; i++) {
      const d = monthBack(i);
      if (d < m.registrationDate) continue; // pas encore inscrit
      const amount = 5000;
      const receiptNumber = `RECU-${year}-${String(receiptSeq++).padStart(6, '0')}`;
      const contrib = await prisma.contribution.create({
        data: {
          memberId: m.id, contributionTypeId: flcpType.id, amount, currency: 'CDF',
          paymentDate: d, periodStart: new Date(d.getFullYear(), d.getMonth(), 1),
          periodEnd: new Date(d.getFullYear(), d.getMonth() + 1, 1),
          paymentMethodId: i % 3 === 0 ? 'mobile_money' : 'cash',
          status: 'confirmed', aipGenerated: !!m.sponsoredBy,
          receiptNumber, recordedBy: 'seed', reference: `FLCP ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        },
      });
      // AIP : 30% crédité au parrain
      if (m.sponsoredBy) {
        const aip = Math.round(amount * 0.3); // 1500
        const sponsorAccount = await prisma.aipAccount.findUnique({ where: { memberId: m.sponsoredBy } });
        await prisma.$transaction([
          prisma.aipAccount.update({
            where: { id: sponsorAccount.id },
            data: { balance: { increment: aip }, totalCredited: { increment: aip }, lastUpdated: new Date() },
          }),
          prisma.aipTransaction.create({
            data: {
              aipAccountId: sponsorAccount.id, sourceMemberId: m.id, contributionId: contrib.id,
              type: 'credit', amount: aip,
              description: `AIP 30% — FLCP de ${m.firstName} ${m.lastName}`,
            },
          }),
        ]);
      }
    }
  }

  // ── Contributions de tiers (subventions / dons / legs) ─────
  console.log('🎁 Ajout de contributions de tiers...');
  await prisma.thirdPartyContribution.createMany({
    data: [
      { type: 'SUBVENTION', donorName: 'Coopération Française', donorContact: 'dcf@exemple.org', amount: 5000000, currency: 'CDF', contributionDate: monthBack(6), description: 'Subvention programme de formation', projectName: 'Formation professionnelle', contractReference: 'CTR-2026-001', receiptNumber: `SUB-${year}-000001` },
      { type: 'DON', donorName: 'Fondation Espoir', donorContact: 'contact@espoir.org', amount: 1500000, currency: 'CDF', contributionDate: monthBack(3), description: 'Don pour aide alimentaire', receiptNumber: `DON-${year}-000001` },
      { type: 'LEG', donorName: 'Mme Kabila (succession)', amount: 3000000, currency: 'CDF', contributionDate: monthBack(1), description: 'Leg testamentaire', receiptNumber: `LEG-${year}-000001` },
      { type: 'DON', donorName: 'Diaspora VAD-Canada', donorContact: 'diaspora@vad.ca', amount: 800000, currency: 'CDF', contributionDate: monthBack(2), description: 'Collecte diaspora', receiptNumber: `DON-${year}-000002` },
    ],
  });

  // ── Projections de croissance ──────────────────────────────
  console.log('📈 Création des projections de croissance...');
  await prisma.growthProjection.createMany({
    data: [
      { name: 'Projection standard VAD', description: 'Scénario réaliste basé sur le parrainage', projectionType: 'members_revenue', baseGrowthRate: 6, optimisticRate: 12, pessimisticRate: 3, referralConversionRate: 18, averageFlcpAmount: 5000, projectionMonths: 12 },
      { name: 'Projection campagne nationale', description: 'Lancement d\'une campagne de recrutement nationale', projectionType: 'members_revenue', baseGrowthRate: 10, optimisticRate: 20, pessimisticRate: 5, referralConversionRate: 25, averageFlcpAmount: 5000, projectionMonths: 12 },
    ],
  });

  // ── Paramètres ─────────────────────────────────────────────
  console.log('⚙️ Enregistrement des paramètres...');
  await prisma.setting.createMany({
    data: [
      { key: 'association.name', value: 'Vision d\'Assistance et de Développement', description: 'Nom complet de l\'ASBL' },
      { key: 'association.short_name', value: 'VAD', description: 'Sigle' },
      { key: 'association.slogan', value: 'Ensemble, luttons contre la pauvreté', description: 'Slogan' },
      { key: 'association.legal_form', value: 'ASBL', description: 'Forme juridique' },
      { key: 'association.country', value: 'République Démocratique du Congo', description: 'Pays' },
      { key: 'association.default_currency', value: 'CDF', description: 'Devise par défaut' },
      { key: 'flcp.aip_rate', value: '30', description: 'Taux AIP (%) crédité au parrain' },
      { key: 'flcp.monthly_amount', value: '5000', description: 'Montant mensuel FLCP en CDF' },
      { key: 'payment.bank_name', value: 'RAWBANK', description: 'Nom de la banque de l\'ASBL' },
      { key: 'payment.bank_account_name', value: 'ASBL VAD — Vision d\'Assistance et de Développement', description: 'Titulaire du compte bancaire' },
      { key: 'payment.bank_account_number', value: '00000-00000-0000000000000', description: 'Numéro de compte bancaire (RIB)' },
      { key: 'payment.bank_swift', value: 'RAWSRDCD', description: 'Code SWIFT/BIC de la banque' },
      { key: 'payment.mpesa_number', value: '+243 000 000 000', description: 'Numéro M-Pesa (Vodacom) de l\'ASBL' },
      { key: 'payment.mpesa_merchant', value: 'VAD000', description: 'Code marchand M-Pesa' },
      { key: 'payment.orange_number', value: '+243 000 000 000', description: 'Numéro Orange Money de l\'ASBL' },
      { key: 'payment.orange_merchant', value: 'VAD', description: 'Code marchand Orange Money' },
      { key: 'payment.airtel_number', value: '+243 000 000 000', description: 'Numéro Airtel Money de l\'ASBL' },
      { key: 'payment.airtel_merchant', value: 'VAD', description: 'Code marchand Airtel Money' },
    ],
  });

  // ── Récapitulatif ──────────────────────────────────────────
  const memberCount = await prisma.member.count();
  const contribCount = await prisma.contribution.count();
  const aipTotal = await prisma.aipAccount.aggregate({ _sum: { balance: true, totalCredited: true } });
  console.log('\n✅ Initialisation terminée !');
  console.log(`   • ${memberCount} membres`);
  console.log(`   • ${contribCount} cotisations FLCP`);
  console.log(`   • Solde AIP total : ${(aipTotal._sum.balance || 0).toLocaleString('fr-FR')} CDF`);
  console.log(`   • AIP cumulé crédité : ${(aipTotal._sum.totalCredited || 0).toLocaleString('fr-FR')} CDF`);
  console.log('\n🔐 Connexions :');
  console.log('   superadmin / admin123  (super_admin)');
  console.log('   rf-vad    / admin123  (finances)');
}

main()
  .catch((e) => { console.error('❌ Erreur seed :', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
