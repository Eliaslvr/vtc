# 📋 Guide de Configuration - VTC Hamdi

Ce guide vous explique comment configurer votre environnement pour faire fonctionner l'application.

## 📁 Où placer le fichier .env

Le fichier `.env` doit être placé dans le dossier `service/` à la racine du projet.

```
vtc_hamdi/
├── service/
│   ├── .env          ← ICI (créer ce fichier)
│   ├── server.js
│   ├── package.json
│   └── ...
└── web-client/
    └── ...
```

## 🚀 Étapes de configuration

### 1. Créer le fichier .env

**Option A - Depuis le terminal :**
```bash
cd service
cp .env.example .env
```

**Option B - Manuellement :**
1. Allez dans le dossier `service/`
2. Créez un nouveau fichier nommé `.env` (avec le point au début)
3. Copiez le contenu de `.env.example` dans ce fichier

### 2. Configurer SendGrid (pour les emails)

#### Obtenir votre clé API SendGrid :

1. **Créer un compte SendGrid**
   - Allez sur https://sendgrid.com
   - Créez un compte gratuit (100 emails/jour)

2. **Créer une clé API**
   - Connectez-vous à votre compte
   - Allez dans **Settings** → **API Keys**
   - Cliquez sur **Create API Key**
   - Donnez un nom (ex: "VTC Hamdi")
   - Choisissez **Full Access** ou **Restricted Access** avec permission "Mail Send"
   - Copiez la clé (elle ne sera affichée qu'une seule fois !)

3. **Vérifier votre email d'expéditeur**
   - Allez dans **Settings** → **Sender Authentication**
   - Vérifiez un email (celui qui enverra les emails)
   - Ou créez un "Single Sender Verification"

4. **Mettre à jour le .env**
   ```env
   SENDGRID_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   EMAIL_USER=votre_email_verifie@example.com
   VTC_EMAIL=email_ou_recevoir_les_reservations@example.com
   ```

### 3. Configurer Mapbox (pour les cartes)

#### Obtenir votre token Mapbox :

1. **Créer un compte Mapbox**
   - Allez sur https://www.mapbox.com
   - Créez un compte gratuit (50 000 requêtes/mois)

2. **Récupérer votre token**
   - Connectez-vous à votre compte
   - Allez dans **Account** → **Access tokens**
   - Copiez votre **Default public token** (commence par `pk.eyJ1...`)

3. **Mettre à jour le .env**
   ```env
   MAPBOX_TOKEN=pk.eyJ1IjoiZWxpYXM1OSIsImEiOiJjbWhleG15MjkwM3p2Mm5xdjRhZGM2M2lxIn0.wggxrYwafkNLgF13EGaqSA
   ```

### 4. Configurer le port (optionnel)

Par défaut, le serveur écoute sur le port 3000. Pour changer :

```env
PORT=3000
```

### 5. Configuration finale

Votre fichier `.env` devrait ressembler à ceci :

```env
PORT=3000
SENDGRID_PASS=SG.votre_vraie_cle_api_sendgrid
EMAIL_USER=contact@vtcpremium.fr
VTC_EMAIL=reservations@vtcpremium.fr
MAPBOX_TOKEN=pk.eyJ1Ijoi...
TEST_EMAIL_ON_STARTUP=false
```

## ✅ Vérifier la configuration

### 1. Installer les dépendances

```bash
cd service
npm install
```

### 2. Tester le serveur

```bash
npm start
# ou pour le développement avec rechargement automatique :
npm run dev
```

Vous devriez voir :
```
🚀 Serveur démarré sur le port 3000
📧 Configuration SendGrid chargée (test désactivé)
```

### 3. Tester la connexion (optionnel)

Si vous voulez tester l'envoi d'email au démarrage, modifiez dans `.env` :
```env
TEST_EMAIL_ON_STARTUP=true
```

Puis redémarrez le serveur. Vous devriez recevoir un email de test.

## 🔒 Sécurité

⚠️ **IMPORTANT :**
- **NE JAMAIS** commiter le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore` (il ne sera pas envoyé sur GitHub)
- Ne partagez **JAMAIS** vos clés API avec qui que ce soit
- Si vous exposez une clé par erreur, régénérez-la immédiatement

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3000 n'est pas déjà utilisé
- Vérifiez que toutes les dépendances sont installées (`npm install`)

### Les emails ne sont pas envoyés
- Vérifiez que `SENDGRID_PASS` est correct
- Vérifiez que `EMAIL_USER` est un email vérifié dans SendGrid
- Vérifiez les logs du serveur pour les erreurs

### La carte ne s'affiche pas
- Vérifiez que `MAPBOX_TOKEN` est correct
- Vérifiez la console du navigateur pour les erreurs
- Assurez-vous que le serveur backend est accessible

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs du serveur
2. Vérifiez la console du navigateur (F12)
3. Vérifiez que toutes les variables d'environnement sont correctement définies

