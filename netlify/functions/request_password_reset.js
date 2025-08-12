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
      // Sicherheitsmaßnahme: nicht verraten, ob User existiert
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

    // Outlook SMTP Setup
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    const resetUrl = `https://deine-domain.com/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Dein App Name" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'Passwort zurücksetzen',
      text: `Hallo,\n\nBitte klicke auf den Link, um dein Passwort zurückzusetzen:\n${resetUrl}\n\nDer Link ist 1 Stunde gültig.\n\nFalls du kein Passwort zurücksetzen wolltest, ignoriere diese Nachricht.`,
      html: `<p>Hallo,</p><p>Bitte klicke <a href="${resetUrl}">hier</a>, um dein Passwort zurückzusetzen.</p><p>Der Link ist 1 Stunde gültig.</p><p>Falls du kein Passwort zurücksetzen wolltest, ignoriere diese Nachricht.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('request_password_reset error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfehler' }) };
  }
};
