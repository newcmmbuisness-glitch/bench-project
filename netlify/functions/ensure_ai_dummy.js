const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    // Nur den AI-User (ID = 0) erstellen - KEINE Dummy-Matches mehr!
    await sql`
      INSERT INTO users (id, email, created_at) 
      VALUES (0, 'ai@example.com', now()) 
      ON CONFLICT (id) DO NOTHING
    `;

    return {
      statusCode: 200,
      body: 'AI user setup complete'
    };
  } catch (err) {
    console.error('❌ ensure_ai_dummy error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
