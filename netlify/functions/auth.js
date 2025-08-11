// netlify/functions/auth.js
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, email, password } = JSON.parse(event.body);
    
    // Verbindung zur Neon-Datenbank
    const sql = neon(process.env.DATABASE_URL);

    if (action === 'register') {
      // Prüfen ob User bereits existiert
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'E-Mail bereits registriert!' 
          })
        };
      }

      // Einfaches Password Hashing (in Produktion sollte bcrypt verwendet werden)
      const hashedPassword = Buffer.from(password).toString('base64');

      // Neuen User erstellen
      await sql`
        INSERT INTO users (email, password, is_admin, created_at) 
        VALUES (${email}, ${hashedPassword}, false, NOW())
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Registrierung erfolgreich!' 
        })
      };

    } else if (action === 'login') {
      // User suchen
      const hashedPassword = Buffer.from(password).toString('base64');
      
      const user = await sql`
        SELECT id, email, is_admin 
        FROM users 
        WHERE email = ${email} AND password = ${hashedPassword}
      `;

      if (user.length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Ungültige Anmeldedaten!' 
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          email: user[0].email,
          isAdmin: user[0].is_admin 
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Unbekannte Aktion!' 
      })
    };

  } catch (error) {
    console.error('Auth error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Server-Fehler: ' + error.message 
      })
    };
  }
};
