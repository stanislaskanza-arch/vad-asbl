# 🚀 Guide de déploiement de l'application VAD

> **Objectif** : mettre l'application VAD en ligne avec une adresse permanente
> (ex : `https://vad-asbl.onrender.com`), accessible depuis n'importe quel
> téléphone ou ordinateur, partout dans le monde.
>
> **Coût** : **0 € (gratuit)**
> **Durée** : environ **20–30 minutes**
> **Niveau** : débutant — chaque étape est détaillée. Suivez lentement. 🐢

---

## 📋 Ce dont vous avez besoin

- Un ordinateur ou un téléphone avec un navigateur (Chrome, Safari, Firefox…)
- Une adresse e-mail (pour créer les comptes)
- **C'est tout !** Aucune compétence technique requise.

---

## ÉTAPE 1 — Créer un compte GitHub (5 min) 🐙

GitHub est le « coffre-fort » où le code de votre application sera stocké.

1. Allez sur 👉 **https://github.com/signup**
2. Remplissez : nom d'utilisateur, e-mail, mot de passe.
   - *Conseil* : notez bien votre **nom d'utilisateur** et **mot de passe**.
3. Cliquez sur **« Create account »**.
4. GitHub vous envoie un code par e-mail — entrez-le pour valider.
5. ✅ Votre compte GitHub est prêt.

---

## ÉTAPE 2 — Créer un nouveau dépôt (répertoire) sur GitHub (3 min) 📁

1. Sur GitHub, cliquez en haut à droite sur le **« + »** → **« New repository »**.
2. **Repository name** : tapez `vad-asbl`
3. **Description** : `Application VAD — Vision d'Assistance et de Développement`
4. Choisissez **« Public »** (ou « Private » si vous préférez).
5. ⚠️ **Ne cochez PAS** « Add a README file ».
6. Cliquez sur le bouton vert **« Create repository »**.

✅ GitHub affiche une page avec des instructions. **Laissez-la ouverte.**

---

## ÉTAPE 3 — Téléverser (uploader) les fichiers du projet (10 min) ⬆️

> Le code est dans le dossier **`vad-app/backend/`**.
> Vous allez mettre **tous ces fichiers** sur GitHub.

### Méthode simple (sans installer de logiciel) :

1. Sur la page de votre dépôt GitHub, cliquez sur
   **« uploading an existing file »** (lien en pointillé).
2. Vous devez téléverser **un par un** (ou par glisser-déposer) tous les
   fichiers et dossiers suivants du dossier `vad-app/backend/` :

```
📁 prisma/
   ├── schema.prisma
   └── seed.js
📁 src/
   ├── index.js
   ├── middleware/auth.js
   └── routes/  (tous les fichiers : auth, dashboard, finances,
                forecasts, members, misc, referrals, sponsors, stats)
📁 public/
   └── index.html
📄 package.json
📄 render.yaml
📄 deploy-setup.js
📄 Procfile
📄 .gitignore
```

3. **Astuce** : GitHub vous permet de créer des dossiers en tapant
   `prisma/schema.prisma` dans le champ « nom du fichier » — le `/`
   crée automatiquement le dossier.
4. Une fois tous les fichiers téléversés, cliquez sur le bouton vert
   **« Commit changes »** en bas.

✅ Votre code est maintenant sur GitHub !

---

## ÉTAPE 4 — Créer un compte Render (3 min) 🟣

Render est le service qui va **faire tourner votre application en continu**
et lui donner une adresse internet.

1. Allez sur 👉 **https://render.com** puis cliquez sur **« Sign Up »**.
2. Cliquez sur **« GitHub »** (pour vous connecter avec votre compte GitHub).
3. Autorisez Render à accéder à votre compte GitHub.
4. ✅ Votre compte Render est prêt.

---

## ÉTAPE 5 — Déployer l'application (5 min) 🚀

> C'est ici que la magie opère ! Le fichier `render.yaml` configure tout
> automatiquement.

### 5.1 — Créer le « Blueprint »

1. Dans Render, allez sur 👉 **https://dashboard.render.com/blueprints**
2. Cliquez sur **« New Blueprint Instance »**.
3. Sélectionnez votre dépôt **`vad-asbl`**.
4. Donnez un nom de groupe (ex : `vad-asbl`).
5. Render lit automatiquement le fichier `render.yaml` et détecte qu'il doit
   créer :
   - une **base de données PostgreSQL** (où les données sont stockées)
   - une **application web** (le serveur)
6. Cliquez sur **« Apply »**.

### 5.2 — Patienter pendant le premier déploiement

- Render télécharge, configure et démarre l'application.
- ⏳ La **première fois**, cela prend **5 à 10 minutes**.
- Vous verrez les **logs** (journaux) défiler : c'est normal.
- Quand vous voyez 🟢 **« Live »** → **c'est en ligne !**

---

## ÉTAPE 6 — Récupérer votre adresse permanente 🌐

1. Dans Render, cliquez sur votre service **`vad-asbl`** (Web Service).
2. En haut, vous voyez une adresse du type :
   **`https://vad-asbl-xxxx.onrender.com`**
3. 🎉 **C'est votre adresse permanente !** Notez-la précieusement.

---

## ✅ Tester l'application

Ouvrez votre adresse dans un navigateur :

| Élément | Valeur |
|---------|--------|
| 🌐 **Site public** | `https://vad-asbl-xxxx.onrender.com` |
| 🔑 **Espace admin** → identifiant | `superadmin` |
| 🔑 **Mot de passe** | `admin123` |
| 💼 **Responsable Finances** | `rf-vad` / `admin123` |

> ⚠️ **Sécurité** : dès que l'application est en production,
> **changez les mots de passe** (voir section suivante).

---

## 🔐 Sécurité — Changer les mots de passe (IMPORTANT)

Les mots de passe `admin123` sont pour les tests. En production :

1. Connectez-vous avec `superadmin / admin123`.
2. *(fonctionnalité à venir)* Pour l'instant, changez le mot de passe via
   la base de données ou en me demandant de générer un nouveau hash.
3. Pensez aussi à définir un vrai **JWT_SECRET** dans Render
   (Environment → ajouter une variable d'environnement `JWT_SECRET`
   avec une longue chaîne aléatoire).

---

## ❓ En cas de problème (dépannage)

### Le déploiement échoue dans les logs
- Vérifiez que **tous les fichiers** ont bien été téléversés sur GitHub
  (surtout `package.json`, `deploy-setup.js`, et tout le dossier `src/`).
- Vérifiez qu'il n'y a pas eu d'erreur de nom de fichier.

### L'application affiche une erreur 500
- Dans Render, ouvrez les **logs** du Web Service.
- Cherchez le message d'erreur.

### La page charge lentement la première fois
- Le plan gratuit de Render « s'endort » après 15 min d'inactivité.
- La première visite après une pause prend ~30 secondes (réveil).
- C'est normal. Soyez patient.

### Je n'y arrive vraiment pas
- **Écrivez-moi** avec le message d'erreur exact. Je vous aide. 🤝

---

## 📂 Récapitulatif des fichiers du projet

```
vad-app/backend/
├── package.json          → dépendances + scripts
├── render.yaml           → config Render (déploiement auto)
├── deploy-setup.js       → prépare la base PostgreSQL au déploiement
├── Procfile              → commande de démarrage (alternative)
├── .gitignore            → fichiers à ignorer (node_modules, .env…)
├── .env.example          → modèle des variables d'environnement
├── prisma/
│   ├── schema.prisma     → structure de la base de données
│   └── seed.js           → données de démonstration
├── src/
│   ├── index.js          → serveur principal
│   ├── middleware/auth.js→ sécurité (JWT)
│   └── routes/           → API (membres, finances, parrainage…)
└── public/
    └── index.html        → le site web complet
```

---

## 🎯 Félicitations !

Si vous arrivez ici, **votre association VAD dispose d'une vraie application
web en ligne**, accessible mondialement, avec :

- ✅ Gestion des membres et du parrainage
- ✅ Cotisations FLCP + calcul automatique de l'AIP (30% au parrain)
- ✅ Rapports financiers RF-VAD (mensuel / trimestriel / annuel)
- ✅ Subventions, dons et legs
- ✅ Projections de croissance
- ✅ Liens de parrainage partageables (WhatsApp, Facebook, X, LinkedIn)

**Bravo, Monsieur Stanislas ! La lutte contre la pauvreté a désormais un outil
numérique.** 🇨🇩💪
