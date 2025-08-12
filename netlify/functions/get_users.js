// netlify/functions/get_users.js
const { neon } = require('@neondatabase/serverless');
const { decrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const key = event.queryStringParameters && event.queryStringParameters.key;
    if (!key || key !== process.env.ADMIN_SECRET) return { statusCode: 403, body: 'Forbidden' };

    const rows = await sql`SELECT id, name, email, password_hex, created_at FROM users ORDER BY created_at DESC`;
    const users = rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: decrypt(u.password_hex, process.env.AES_SECRET_KEY),
      created_at: u.created_at
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, users })
    };
  } catch (err) {
    console.error('get_users error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
