const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const reports = await sql`
            SELECT 
                m.id AS match_id,
                p1.profile_name AS reporter_name,
                p2.profile_name AS reported_name
            FROM matches m
            JOIN meet_profiles p1 ON m.user_id_1 = p1.user_id
            JOIN meet_profiles p2 ON m.user_id_2 = p2.user_id
            WHERE m.is_reported = TRUE;
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reports }),
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
