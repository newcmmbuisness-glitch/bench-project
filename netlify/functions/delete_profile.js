// netlify/functions/delete_profile.js
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'DELETE') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { userId } = JSON.parse(event.body);

        if (!userId) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Fehlende Benutzer-ID' }) 
            };
        }

        const result = await sql`
            DELETE FROM meet_profiles
            WHERE user_id = ${userId}
            RETURNING user_id;
        `;

        if (result.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Profil nicht gefunden oder bereits gelöscht!' }) 
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Profil erfolgreich gelöscht.' }),
        };

    } catch (error) {
        console.error('Delete profile error:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: 'Server-Fehler: ' + error.message }) 
        };
    }
};
