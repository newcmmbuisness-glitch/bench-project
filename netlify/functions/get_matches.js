const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { userId } = JSON.parse(event.body);
        if (!userId) {
            return { statusCode: 400, headers, body: 'Fehlende Benutzer-ID' };
        }

        const matches = await sql`
            SELECT 
                m.id AS match_id,
                p.*,
                CASE WHEN m.user_id_1 = ${userId} THEN m.user_id_2 ELSE m.user_id_1 END AS matched_user_id
            FROM matches m
            JOIN meet_profiles p ON (p.user_id = m.user_id_1 OR p.user_id = m.user_id_2)
            WHERE (m.user_id_1 = ${userId} OR m.user_id_2 = ${userId}) AND p.user_id != ${userId};
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, matches }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
