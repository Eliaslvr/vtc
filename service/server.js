// server.js
// Installation: npm install express @sendgrid/mail cors dotenv

const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration SendGrid
if (!process.env.SENDGRID_PASS) {
  console.warn('⚠️ SENDGRID_PASS non configuré. Les emails ne pourront pas être envoyés.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_PASS);
}

// Vérification de la configuration (optionnel, contrôlé par variable d'environnement)
if (process.env.TEST_EMAIL_ON_STARTUP === 'true') {
  (async () => {
    try {
      await sgMail.send({
        to: process.env.VTC_EMAIL,
        from: process.env.EMAIL_USER,
        subject: "🔧 Test configuration SendGrid",
        text: "Test de configuration du serveur email SendGrid."
      });
      console.log('✅ Serveur email prêt via SendGrid');
    } catch (err) {
      console.error('❌ Erreur de configuration email:', err.message || err);
    }
  })();
} else {
  console.log('📧 Configuration SendGrid chargée (test désactivé)');
}

// Fonction de validation des données
function validateReservation(data) {
  const errors = [];

  // Validation du nom
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }

  // Validation du téléphone (format français)
  const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
  if (!data.phone || !phoneRegex.test(data.phone.replace(/\s/g, ''))) {
    errors.push('Le numéro de téléphone doit être au format français valide');
  }

  // Validation des adresses
  if (!data.pickup || typeof data.pickup !== 'string' || data.pickup.trim().length < 5) {
    errors.push('L\'adresse de départ est requise et doit contenir au moins 5 caractères');
  }

  if (!data.destination || typeof data.destination !== 'string' || data.destination.trim().length < 5) {
    errors.push('L\'adresse de destination est requise et doit contenir au moins 5 caractères');
  }

  // Validation de la date
  if (!data.date) {
    errors.push('La date est requise');
  } else {
    const reservationDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reservationDate < today) {
      errors.push('La date de réservation ne peut pas être dans le passé');
    }
  }

  // Validation de l'heure
  if (!data.time) {
    errors.push('L\'heure est requise');
  }

  // Validation de l'email si fourni
  if (data.email && data.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('L\'adresse email n\'est pas valide');
    }
  }

  // Validation du type de service
  const validServiceTypes = ['standard', 'premium', 'business'];
  if (!data.serviceType || !validServiceTypes.includes(data.serviceType)) {
    errors.push('Le type de service doit être standard, premium ou business');
  }

  // Validation du nombre de passagers
  const passengers = parseInt(data.passengers);
  if (!data.passengers || isNaN(passengers) || passengers < 1 || passengers > 8) {
    errors.push('Le nombre de passagers doit être entre 1 et 8');
  }

  // Sanitization basique (protection XSS)
  const sanitize = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: sanitize(data.name),
      phone: sanitize(data.phone),
      email: data.email ? sanitize(data.email) : '',
      pickup: sanitize(data.pickup),
      destination: sanitize(data.destination),
      date: data.date,
      time: data.time,
      serviceType: data.serviceType,
      passengers: passengers.toString(),
      notes: data.notes ? sanitize(data.notes) : '',
      distance: data.distance || '',
      duration: data.duration || '',
      price: data.price || ''
    }
  };
}

// Route pour recevoir les réservations
app.post('/api/reservations', async (req, res) => {
  try {
    const validation = validateReservation(req.body);

    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Données invalides',
        errors: validation.errors
      });
    }

    const reservation = validation.sanitized;

    // Envoi de l'email au VTC
    try {
      await envoyerNotificationVTC(reservation);
    } catch (emailError) {
      console.error('❌ Erreur lors de l\'envoi de l\'email au VTC:', emailError);
      // On continue même si l'email échoue
    }

    // Envoi de l'email de confirmation au client si email fourni
    if (reservation.email) {
      try {
        await envoyerConfirmationClient(reservation);
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email au client:', emailError);
        // On continue même si l'email échoue
      }
    }

    res.json({ 
      success: true, 
      message: 'Réservation enregistrée avec succès', 
      reservationId: Date.now() 
    });
  } catch (error) {
    console.error('❌ Erreur lors de la réservation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur. Veuillez réessayer.' 
    });
  }
});

// Fonction pour envoyer la notification au VTC
async function envoyerNotificationVTC(reservation) {
  const emailVTC = process.env.VTC_EMAIL;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px 20px; border-radius: 0 0 10px 10px; }
        .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .info-row { margin: 15px 0; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .label { font-weight: bold; color: #667eea; display: inline-block; min-width: 150px; }
        .value { color: #333; }
        .price-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
        .price-box .amount { font-size: 36px; font-weight: bold; margin: 10px 0; }
        .footer { margin-top: 30px; padding: 20px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 NOUVELLE RÉSERVATION VTC</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Réservation reçue le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <div class="content">
          <div class="alert-box">
            <strong>⚠️ Action requise :</strong> Confirmer cette réservation auprès du client
          </div>

          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📋 Informations Client</h2>
          
          <div class="info-row">
            <span class="label">👤 Nom :</span>
            <span class="value">${reservation.name}</span>
          </div>
          
          <div class="info-row">
            <span class="label">📞 Téléphone :</span>
            <span class="value"><strong>${reservation.phone}</strong></span>
          </div>
          
          ${reservation.email ? `<div class="info-row"><span class="label">✉️ Email :</span><span class="value">${reservation.email}</span></div>` : ''}

          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 30px;">🗓️ Détails de la Course</h2>
          <div class="info-row"><span class="label">📅 Date :</span><span class="value"><strong>${reservation.date}</strong></span></div>
          <div class="info-row"><span class="label">🕐 Heure :</span><span class="value"><strong>${reservation.time}</strong></span></div>
          <div class="info-row"><span class="label">📍 Départ :</span><span class="value">${reservation.pickup}</span></div>
          <div class="info-row"><span class="label">🎯 Destination :</span><span class="value">${reservation.destination}</span></div>
          <div class="info-row"><span class="label">📏 Distance :</span><span class="value">${reservation.distance}</span></div>
          <div class="info-row"><span class="label">⏱️ Durée estimée :</span><span class="value">${reservation.duration}</span></div>
          <div class="info-row"><span class="label">🚗 Type de service :</span><span class="value">${getServiceName(reservation.serviceType)}</span></div>
          <div class="info-row"><span class="label">👥 Passagers :</span><span class="value">${reservation.passengers}</span></div>
          ${reservation.notes ? `<div class="info-row"><span class="label">📝 Notes :</span><span class="value">${reservation.notes}</span></div>` : ''}

          <div class="price-box">
            <div>Prix estimé de la course</div>
            <div class="amount">${reservation.price}</div>
          </div>

          <div class="alert-box" style="background-color: #d1ecf1; border-left-color: #0c5460;">
            <strong>📞 Action à effectuer :</strong><br>
            Contactez le client au <strong>${reservation.phone}</strong> pour confirmer la réservation
          </div>
        </div>
        
        <div class="footer">
          <p>Ce mail a été envoyé automatiquement par votre système de réservation VTC Premium</p>
          <p>Ne pas répondre à cet email</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: emailVTC,
    from: process.env.EMAIL_USER,
    subject: `🚗 NOUVELLE RÉSERVATION - ${reservation.name} - ${reservation.date} ${reservation.time}`,
    html: htmlContent,
  };

  await sgMail.send(msg);
  console.log('✅ Email envoyé au VTC');
}

// Fonction pour envoyer la confirmation au client
async function envoyerConfirmationClient(reservation) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px 20px; }
        .info-box { background-color: white; padding: 20px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .success-box { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Réservation confirmée</h1>
        </div>
        <div class="content">
          <div class="success-box">
            <strong>Merci ${reservation.name} !</strong><br>
            Votre réservation a bien été enregistrée.
          </div>
          <div class="info-box">
            <h3>Récapitulatif de votre course</h3>
            <p><strong>📅 Date :</strong> ${reservation.date}</p>
            <p><strong>🕐 Heure :</strong> ${reservation.time}</p>
            <p><strong>📍 Départ :</strong> ${reservation.pickup}</p>
            <p><strong>🎯 Destination :</strong> ${reservation.destination}</p>
            <p><strong>💰 Prix estimé :</strong> ${reservation.price}</p>
          </div>
          <p>Notre chauffeur vous contactera prochainement pour confirmer votre réservation.</p>
          <p>En cas de question, contactez-nous au <strong>06 12 34 56 78</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: reservation.email,
    from: process.env.EMAIL_USER,
    subject: `✅ Confirmation de votre réservation VTC - ${reservation.date}`,
    html: htmlContent,
  };

  await sgMail.send(msg);
  console.log('✅ Email de confirmation envoyé au client');
}

// Fonction utilitaire pour obtenir le nom du service
function getServiceName(serviceType) {
  const services = {
    standard: 'Standard (1.50€/km)',
    premium: 'Premium (2.00€/km)',
    business: 'Business (2.50€/km)',
  };
  return services[serviceType] || serviceType;
}

// ========================================
// PROXY MAPBOX (Sécurisation du token)
// ========================================

// Endpoint pour le géocodage
app.get('/api/mapbox/geocode', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "query" requis' });
    }

    if (!process.env.MAPBOX_TOKEN) {
      return res.status(500).json({ error: 'Token Mapbox non configuré' });
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.MAPBOX_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erreur géocodage:', error);
    res.status(500).json({ error: 'Erreur lors du géocodage' });
  }
});

// Endpoint pour le géocodage inverse
app.get('/api/mapbox/reverse-geocode', async (req, res) => {
  try {
    const { lon, lat } = req.query;
    
    if (!lon || !lat) {
      return res.status(400).json({ error: 'Paramètres "lon" et "lat" requis' });
    }

    if (!process.env.MAPBOX_TOKEN) {
      return res.status(500).json({ error: 'Token Mapbox non configuré' });
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${process.env.MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erreur géocodage inverse:', error);
    res.status(500).json({ error: 'Erreur lors du géocodage inverse' });
  }
});

// Endpoint pour les directions
app.get('/api/mapbox/directions', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Paramètres "start" et "end" requis (format: lon,lat)' });
    }

    if (!process.env.MAPBOX_TOKEN) {
      return res.status(500).json({ error: 'Token Mapbox non configuré' });
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?geometries=geojson&access_token=${process.env.MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Erreur directions:', error);
    res.status(500).json({ error: 'Erreur lors du calcul de l\'itinéraire' });
  }
});

// Endpoint pour récupérer le token Mapbox (public, limité à la visualisation)
app.get('/api/mapbox/token', (req, res) => {
  if (!process.env.MAPBOX_TOKEN) {
    return res.status(500).json({ error: 'Token Mapbox non configuré' });
  }
  // Retourner le token pour l'initialisation de la carte côté client
  // Note: Ce token devrait être un token public limité (scoped) en production
  res.json({ token: process.env.MAPBOX_TOKEN });
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Serveur opérationnel' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📧 Emails envoyés via: ${process.env.EMAIL_USER}`);
});
