const { neon } = require('@neondatabase/serverless');
const { encrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return { statusCode: 400, body: "Email oder Passwort fehlt" };
    }

    // Passwort verschlüsseln
    const encryptedPassword = encrypt(password, process.env.ADMIN_AES_KEY);

    await sql`
      INSERT INTO users (email, password)
      VALUES (${email}, ${encryptedPassword})
    `;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Fehler bei Registrierung" };
  }
};
