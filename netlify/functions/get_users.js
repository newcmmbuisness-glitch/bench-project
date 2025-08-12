const { neon } = require('@neondatabase/serverless');
const { decrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const authKey = event.queryStringParameters.key;
    if (authKey !== process.env.ADMIN_SECRET) {
      return { statusCode: 403, body: "Nicht autorisiert" };
    }

    const rows = await sql`SELECT id, email, password FROM users`;

    const decryptedUsers = rows.map(user => ({
      id: user.id,
      email: user.email,
      password: decrypt(user.password, process.env.ADMIN_AES_KEY)
    }));

    return { statusCode: 200, body: JSON.stringify({ success: true, users: decryptedUsers }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Fehler beim Abrufen der Nutzer" };
  }
};
