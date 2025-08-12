// netlify/functions/auth.js
const { neon } = require('@neondatabase/serverless');
const { encrypt } = require('./crypto_utils');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
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

    // Verbindung zur Neon-Datenbank
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'E-Mail und Passwort sind erforderlich!' }),
      };
    }

    if (action === 'register') {
      // Prüfen ob User bereits existiert
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

      // Passwort verschlüsseln mit AES
      const encryptedPassword = encrypt(password, process.env.AES_SECRET_KEY);

      // Neuen User erstellen
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
      // Passwort verschlüsseln, um Vergleich zu ermöglichen
      const encryptedPassword = encrypt(password, process.env.AES_SECRET_KEY);

      const user = await sql`
        SELECT id, email, is_admin 
        FROM users 
        WHERE email = ${email} AND password_hex = ${encryptedPassword}
      `;

      if (user.length === 0) {
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
          email: user[0].email,
          isAdmin: user[0].is_admin,
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
