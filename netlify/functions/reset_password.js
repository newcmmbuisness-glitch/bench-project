const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { token, newPassword } = JSON.parse(event.body);
    if (!token || !newPassword) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Token und neues Passwort erforderlich' }) };
    }

    // Token und Gültigkeit prüfen
    const resets = await sql`
      SELECT user_id, expires_at FROM password_resets WHERE token = ${token}
    `;
    if (resets.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Ungültiger Token' }) };
    }

    const reset = resets[0];
    if (new Date(reset.expires_at) < new Date()) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Token abgelaufen' }) };
    }

    // Passwort hashen
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Passwort aktualisieren
    await sql`
      UPDATE users SET password_hex = ${hashedPassword} WHERE id = ${reset.user_id}
    `;

    // Token löschen
    await sql`DELETE FROM password_resets WHERE token = ${token}`;

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Passwort wurde zurückgesetzt' }) };
  } catch (error) {
    console.error('reset_password error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfehler' }) };
  }
};
