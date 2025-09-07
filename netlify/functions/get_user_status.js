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

        const userStatus = await sql`
            SELECT is_user_plus, is_admin 
            FROM users 
            WHERE id = ${userId}
        `;
        
        if (userStatus.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Benutzer nicht gefunden' }) 
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                isUserPlus: userStatus[0].is_user_plus || false,
                isAdmin: userStatus[0].is_admin || false
            })
        };
        
    } catch (error) {
        console.error('Fehler beim Abrufen des Benutzerstatus:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
