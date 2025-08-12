// netlify/functions/login_user.js
const { neon } = require('@neondatabase/serverless');
const { decrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };

    const rows = await sql`SELECT id, name, email, password_hex FROM users WHERE email = ${email}`;
    if (!rows || rows.length === 0) return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Invalid credentials' }) };

    const user = rows[0];
    const plain = decrypt(user.password_hex, process.env.AES_SECRET_KEY);
    if (plain !== password) return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Invalid credentials' }) };

    return { statusCode: 200, body: JSON.stringify({ success: true, id: user.id, email: user.email, name: user.name }) };
  } catch (err) {
    console.error('login_user error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};

