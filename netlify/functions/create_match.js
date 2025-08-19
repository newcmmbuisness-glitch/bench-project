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
        const { likerId, likedId } = JSON.parse(event.body);
        if (!likerId || !likedId) {
            return { statusCode: 400, headers, body: 'Fehlende IDs' };
        }
        
        // Match-Versuch in beide Richtungen prüfen
        const existingMatch = await sql`
            SELECT * FROM matches 
            WHERE (user_id_1 = ${likerId} AND user_id_2 = ${likedId}) OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId})
        `;

        if (existingMatch.length > 0) {
            // Match existiert bereits (entweder neu oder umgekehrt)
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, newMatch: false }) };
        }

        await sql`
            INSERT INTO matches (user_id_1, user_id_2)
            VALUES (${likerId}, ${likedId});
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, newMatch: true }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
