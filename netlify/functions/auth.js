// netlify/functions/auth.js
const { neon } = require('@neondatabase/serverless');
const { encrypt, decrypt } = require('./crypto_utils');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { action, email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'E-Mail und Passwort sind erforderlich!' }),
      };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    if (action === 'register') {
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'E-Mail bereits registriert!' }),
        };
      }

      const encryptedPassword = encrypt(password, process.env.AES_SECRET_KEY);

      await sql`
        INSERT INTO users (email, password_hex, is_admin, created_at)
        VALUES (${email}, ${encryptedPassword}, false, NOW())
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Registrierung erfolgreich!' }),
      };

    } else if (action === 'login') {
      const users = await sql`
        SELECT id, email, is_admin, password_hex FROM users WHERE email = ${email}
      `;

      if (users.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Ungültige Anmeldedaten!' }),
        };
      }

      const user = users[0];
      const decryptedPassword = decrypt(user.password_hex, process.env.AES_SECRET_KEY);

      if (decryptedPassword !== password) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Ungültige Anmeldedaten!' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          email: user.email,
          isAdmin: user.is_admin,
          userId: user.id  
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Unbekannte Aktion!' }),
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server-Fehler: ' + error.message }),
    };
  }
};
