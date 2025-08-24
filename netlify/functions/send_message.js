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
        const { matchId, senderId, messageText } = JSON.parse(event.body);
        if (!matchId || !senderId || !messageText) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Fehlende Felder' }) 
            };
        }
        
        await sql`
            INSERT INTO chat_messages (match_id, sender_id, message_text)
            VALUES (${matchId}, ${senderId}, ${messageText});
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
