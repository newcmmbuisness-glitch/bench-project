const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    // Fügen Sie hier Ihre CORS-Header hinzu

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { userId } = JSON.parse(event.body);

        if (!userId) {
            return { statusCode: 400, body: 'Fehlende user ID' };
        }

        const profile = await sql`
            SELECT * FROM meet_profiles WHERE user_id = ${userId};
        `;

        if (profile.length === 0) {
            return { statusCode: 404, body: 'Profil nicht gefunden' };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, profile: profile[0] }),
        };
    } catch (error) {
        return { statusCode: 500, body: 'Server-Fehler' };
    }
};
