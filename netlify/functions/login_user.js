const { neon } = require('@neondatabase/serverless');
const { decrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return { statusCode: 400, body: "Email oder Passwort fehlt" };
    }

    const result = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (result.length === 0) {
      return { statusCode: 401, body: "Ungültige Login-Daten" };
    }

    const decryptedPassword = decrypt(result[0].password, process.env.ADMIN_AES_KEY);
    if (decryptedPassword !== password) {
      return { statusCode: 401, body: "Ungültige Login-Daten" };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Fehler beim Login" };
  }
};
