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
        if (!match_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Fehlende Match-ID' })
            };
        }
        
        // Abfrage der Chat-Nachrichten
        const messages = await sql`
            SELECT * FROM chat_messages
            WHERE match_id = ${match_id}
            ORDER BY sent_at ASC;
        `;
        
        // Abfrage der Benutzer-IDs für dieses Match
        const matchInfo = await sql`
            SELECT user_id_1, user_id_2 FROM matches WHERE id = ${match_id};
        `;
        
        const reporterId = matchInfo.length > 0 ? matchInfo[0].user_id_1 : null;
        const reportedId = matchInfo.length > 0 ? matchInfo[0].user_id_2 : null;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, messages, reporterId, reportedId }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
