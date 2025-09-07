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
        const { userId, swipedUserId, direction } = JSON.parse(event.body);
        
        if (!userId || !swipedUserId || !direction) {
            return { statusCode: 400, headers, body: 'Fehlende Parameter' };
        }

        if (!['left', 'right'].includes(direction)) {
            return { statusCode: 400, headers, body: 'Ungültige Swipe-Richtung' };
        }

        // Record the swipe in swipe_history
        await sql`
            INSERT INTO swipe_history (user_id, swiped_user_id, swipe_direction)
            VALUES (${userId}, ${swipedUserId}, ${direction})
            ON CONFLICT (user_id, swiped_user_id) 
            DO UPDATE SET swipe_direction = ${direction}, created_at = NOW()
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
        console.error('Fehler beim Aufzeichnen des Swipes:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
