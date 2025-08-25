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
                u1.name AS reporter_name,
                u2.name AS reported_name
            FROM matches m
            JOIN users u1 ON m.user_id_1 = u1.id
            JOIN users u2 ON m.user_id_2 = u2.id
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
