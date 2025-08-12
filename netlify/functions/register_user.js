// netlify/functions/register_user.js
const { neon } = require('@neondatabase/serverless');
const { encrypt } = require('./crypto_utils');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { name, email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };

    const encryptedPw = encrypt(password, process.env.AES_SECRET_KEY);
    await sql`
      INSERT INTO users (name, email, password_hex, created_at)
      VALUES (${name || null}, ${email}, ${encryptedPw}, NOW())
    `;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('register_user error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};

