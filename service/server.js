// server.js
// Installation: npm install express @sendgrid/mail cors body-parser dotenv

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration SendGrid
sgMail.setApiKey(process.env.SENDGRID_PASS);

// Vérification de la configuration
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

// Route pour recevoir les réservations
app.post('/api/reservations', async (req, res) => {
  try {
    const reservation = req.body;

    if (!reservation.name || !reservation.phone || !reservation.pickup || !reservation.destination) {
      return res.status(400).json({ success: false, message: 'Données manquantes' });
    }

    // Envoi de l'email au VTC
    await envoyerNotificationVTC(reservation);

    // Envoi de l'email de confirmation au client si email fourni
    if (reservation.email) {
      await envoyerConfirmationClient(reservation);
    }

    res.json({ success: true, message: 'Réservation enregistrée avec succès', reservationId: Date.now() });
  } catch (error) {
    console.error('❌ Erreur lors de la réservation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur. Veuillez réessayer.' });
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

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Serveur opérationnel' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📧 Emails envoyés via: ${process.env.EMAIL_USER}`);
});
