const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const sql = neon(process.env.NETLIFY_DATABASE_URL);
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Email erforderlich' }) };
    }

    // User finden
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      // Nicht verraten, ob User existiert (Sicherheit)
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const userId = users[0].id;

    // Token generieren
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 Stunde gültig

    // Token speichern
    await sql`
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (${userId}, ${token}, ${expiresAt})
    `;

    // Mailer Setup (Beispiel Gmail, bitte deine SMTP-Daten einsetzen)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `https://deine-domain.com/reset-password?token=${token}`;

    const mailOptions = {
      from: '"Dein App Name" <no-reply@deinedomain.com>',
      to: email,
      subject: 'Passwort zurücksetzen',
      text: `Hallo,\n\nBitte klicke auf den Link, um dein Passwort zurückzusetzen:\n${resetUrl}\n\nDer Link ist 1 Stunde gültig.\n\nFalls du kein Passwort zurücksetzen wolltest, ignoriere diese Nachricht.`,
    };

    await transporter.sendMail(mailOptions);

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('request_password_reset error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfehler' }) };
  }
};
