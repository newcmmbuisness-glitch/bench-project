// netlify/functions/get_my_profile.js
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
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

        const profile = await sql`
            SELECT 
                user_id, 
                profile_name, 
                profile_image, 
                description, 
                interests
            FROM meet_profiles
            WHERE user_id = ${userId}
        `;

        if (profile.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Profil nicht gefunden!' }) 
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                profile: profile[0]
            }),
        };

    } catch (error) {
        console.error('Get my profile error:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: 'Server-Fehler: ' + error.message }) 
        };
    }
};
