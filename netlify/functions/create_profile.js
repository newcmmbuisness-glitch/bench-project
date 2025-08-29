// netlify/functions/create_profile.js
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
        // ⬇️ Jetzt auch Alter + Koordinaten entgegennehmen
        const { userId, name, age, description, interests, profileImage, postalCode, latitude, longitude, prompt1, answer1, prompt2, answer2 } = JSON.parse(event.body);

        if (!userId || !name || !profileImage || !age) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: 'Fehlende Felder!' })
            };
        }

        const userExists = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (userExists.length === 0) {
            return { 
                statusCode: 404, 
                headers,
                body: JSON.stringify({ error: 'Benutzer nicht gefunden!' })
            };
        }

        const result = await sql`
            INSERT INTO meet_profiles (user_id, profile_name, age, description, interests, profile_image, postal_code, latitude, longitude, prompt_1, answer_1, prompt_2, answer_2)
            VALUES (${userId}, ${name}, ${age}, ${description}, ${interests}, ${profileImage}, ${postalCode}, ${latitude}, ${longitude}, ${prompt1}, ${answer1}, ${prompt2}, ${answer2})
            ON CONFLICT (user_id) DO UPDATE SET
                profile_name = EXCLUDED.profile_name,
                age = EXCLUDED.age,
                description = EXCLUDED.description,
                interests = EXCLUDED.interests,
                profile_image = EXCLUDED.profile_image,
                postal_code = EXCLUDED.postal_code,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                prompt_1 = EXCLUDED.prompt_1,
                answer_1 = EXCLUDED.answer_1,
                prompt_2 = EXCLUDED.prompt_2,
                answer_2 = EXCLUDED.answer_2
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
