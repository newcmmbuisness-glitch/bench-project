// netlify/functions/get_profile.js
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

        const userExists = await sql`
            SELECT id FROM users WHERE id = ${userId}
        `;

        if (userExists.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Benutzer nicht gefunden' }) 
            };
        }

        let profiles;
        const likedMatches = await sql`
            SELECT user_id_2 FROM matches WHERE user_id_1 = ${userId}
        `;
        const likedUserIds = [userId, ...likedMatches.map(m => m.user_id_2)];

        // ✅ KORREKTUR: Verwenden Sie hier die richtigen Spaltennamen mit Unterstrich
        profiles = await sql`
          SELECT 
            mp.user_id, 
            mp.profile_name, 
            mp.age,
            mp.profile_image, 
            mp.description, 
            mp.interests,
            mp.postal_code,
            mp.latitude,
            mp.longitude,
            mp.prompt_1,
            mp.answer_1,
            mp.prompt_2,
            mp.answer_2,
            u.email
          FROM meet_profiles mp
          JOIN users u ON mp.user_id = u.id
          WHERE mp.user_id != ALL(${likedUserIds})
          ORDER BY RANDOM()
          LIMIT 10
        `;
        
        const formattedProfiles = profiles.map(profile => ({
          user_id: profile.user_id,
          profile_name: profile.profile_name,
          age: profile.age,
          profile_image: profile.profile_image,
          description: profile.description,
          interests: profile.interests || [],
          postal_code: profile.postal_code,
          latitude: profile.latitude,
          longitude: profile.longitude,
          prompt1: profile.prompt_1,
          answer1: profile.answer_1,
          prompt2: profile.prompt_2,
          answer2: profile.answer_2,
          email: profile.email
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                profiles: formattedProfiles,
                totalFound: formattedProfiles.length
            }),
        };

    } catch (error) {
        console.error('Get profiles error:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                error: 'Server-Fehler: ' + error.message,
                success: false
            }) 
        };
    }
};
