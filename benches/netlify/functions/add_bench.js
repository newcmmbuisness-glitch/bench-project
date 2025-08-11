const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { name, description, lat, lng, benchImage, viewImage, userEmail } = JSON.parse(event.body);

    // Validierung
    if (!name || !description || !lat || !lng || !benchImage || !viewImage || !userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Alle Felder sind erforderlich!' })
      };
    }

    // Verbindung zur Neon-Datenbank
    const sql = neon(process.env.DATABASE_URL);

    // Datensatz einfügen
    const result = await sql`
      INSERT INTO pending_benches (
        name, description, lat, lng,
        bench_image, view_image, user_email,
        approved, created_at
      )
      VALUES (
        ${name}, ${description}, ${lat}, ${lng},
        ${benchImage}, ${viewImage}, ${userEmail},
        false, NOW()
      )
      RETURNING id;
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result[0].id })
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Interner Serverfehler' })
    };
  }
};

