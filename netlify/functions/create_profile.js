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
        const { userId, name, description, interests, profileImage } = JSON.parse(event.body);
        console.log('Empfangene userId:', userId);

        if (!userId || !name || !profileImage) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: 'Fehlende Felder!' })
            };
        }

        // Verify that the user exists in your users table
        const userExists = await sql`
            SELECT id FROM users WHERE id = ${userId}
        `;

        if (userExists.length === 0) {
            return { 
                statusCode: 404, 
                headers,
                body: JSON.stringify({ error: 'Benutzer nicht gefunden!' })
            };
        }

        const result = await sql`
            INSERT INTO meet_profiles (user_id, profile_name, description, interests, profile_image)
            VALUES (${userId}, ${name}, ${description}, ${JSON.stringify(interests)}, ${profileImage})
            ON CONFLICT (user_id) DO UPDATE SET
                profile_name = EXCLUDED.profile_name,
                description = EXCLUDED.description,
                interests = EXCLUDED.interests,
                profile_image = EXCLUDED.profile_image
            RETURNING id;
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, profileId: result[0].id }),
        };
    } catch (error) {
        console.error('Create profile error:', error);
        return { 
            statusCode: 500, 
            headers,
            body: JSON.stringify({ error: 'Server-Fehler: ' + error.message })
        };
    }
};
