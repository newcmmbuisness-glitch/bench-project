// netlify/functions/get_all_users.js
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const users = await sql`
      SELECT id, email, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(users),
    };
  } catch (err) {
    console.error('get_all_users error', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }), // Fehlertext direkt zurückgeben
    };
  }
};
