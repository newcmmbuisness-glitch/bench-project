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
        const { match_id, sender_id, message_text } = JSON.parse(event.body);
        if (!match_id || !sender_id || !message_text) { // ✔️ Korrigiert zu match_id, sender_id, message_text
            return { statusCode: 400, headers, body: 'Fehlende Felder' };
        }
    
        await sql`
            INSERT INTO chat_messages (match_id, sender_id, message_text)
            VALUES (${match_id}, ${sender_id}, ${message_text}); // ✔️ Korrigiert zu match_id, sender_id, message_text
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
