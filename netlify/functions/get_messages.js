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
        const { match_id } = JSON.parse(event.body);
        if (!matchId) {
            return { statusCode: 400, headers, body: 'Fehlende Match-ID' };
        }

        const messages = await sql`
            SELECT * FROM chat_messages
            WHERE match_id = ${matchId}
            ORDER BY sent_at ASC;
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, messages }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
