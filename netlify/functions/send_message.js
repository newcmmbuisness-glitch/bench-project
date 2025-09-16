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
        const { match_id, sender_id, message_text, is_ai } = JSON.parse(event.body);

        // ⚡ Prüfung auf null oder undefined (0 ist jetzt erlaubt)
        if (match_id === undefined || match_id === null || sender_id === undefined || sender_id === null || !message_text) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Fehlende Felder' })
            };
        }

        await sql`
            INSERT INTO chat_messages (match_id, sender_id, message_text, is_ai)
            VALUES (${match_id}, ${sender_id}, ${message_text}, ${is_ai || false});
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        console.error('❌ send_message error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
