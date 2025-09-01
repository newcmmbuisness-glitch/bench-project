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

        // Erweiterte Query mit letzter Nachricht pro Match
        const matches = await sql`
            WITH last_messages AS (
                SELECT DISTINCT ON (match_id) 
                    match_id,
                    sender_id,
                    message_text,
                    sent_at
                FROM chat_messages
                ORDER BY match_id, sent_at DESC
            )
            SELECT 
                m.id AS match_id,
                p.*,
                CASE WHEN m.user_id_1 = ${userId} THEN m.user_id_2 ELSE m.user_id_1 END AS matched_user_id,
                lm.sender_id AS last_message_sender_id,
                lm.message_text AS last_message_text,
                lm.sent_at AS last_message_sent_at
            FROM matches m
            JOIN meet_profiles p ON (p.user_id = m.user_id_1 OR p.user_id = m.user_id_2)
            LEFT JOIN last_messages lm ON lm.match_id = m.id
            WHERE (m.user_id_1 = ${userId} OR m.user_id_2 = ${userId}) 
                AND p.user_id != ${userId}
            ORDER BY COALESCE(lm.sent_at, m.created_at) DESC;
        `;

        // Strukturiere die Daten für das Frontend
        const structuredMatches = matches.map(match => ({
            ...match,
            last_message: match.last_message_text ? {
                sender_id: match.last_message_sender_id,
                text: match.last_message_text,
                sent_at: match.last_message_sent_at
            } : null
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, matches: structuredMatches }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
