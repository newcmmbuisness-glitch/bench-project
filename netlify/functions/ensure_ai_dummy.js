const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
    try {
        // Dummy-User (ID = 0)
        await sql`
            INSERT INTO users (id, email, created_at)
            VALUES (0, 'ai@example.com', now())
            ON CONFLICT (id) DO NOTHING;
        `;

        // Dummy-Match (ID = 999999)
        await sql`
            INSERT INTO matches (id, user_id_1, user_id_2, status, created_at)
            VALUES (999999, 0, 0, 'matched', now())
            ON CONFLICT (id) DO NOTHING;
        `;

        return { statusCode: 200, body: 'Dummy AI setup complete' };
    } catch (err) {
        console.error('❌ ensure_ai_dummy error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
