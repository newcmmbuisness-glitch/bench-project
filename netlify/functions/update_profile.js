// netlify/functions/update_profile.js
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'PUT') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { userId, description, interests, postalCode, latitude, longitude, prompt1, answer1, prompt2, answer2 } = JSON.parse(event.body);

        if (!userId) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: 'User ID fehlt!' })
            };
        }

        // Nur editierbare Felder updaten (Name, Alter, Geschlecht, Bild bleiben unverändert)
        const result = await sql`
            UPDATE meet_profiles SET
                description = ${description},
                interests = ${interests},
                postal_code = ${postalCode},
                latitude = ${latitude},
                longitude = ${longitude},
                prompt_1 = ${prompt1},
                answer_1 = ${answer1},
                prompt_2 = ${prompt2},
                answer_2 = ${answer2}
            WHERE user_id = ${userId}
            RETURNING id;
        `;

        if (result.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Profil nicht gefunden!' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Profil erfolgreich aktualisiert!' }),
        };

    } catch (error) {
        console.error('Update profile error:', error);
        return { 
            statusCode: 500, 
            headers,
            body: JSON.stringify({ error: 'Server-Fehler: ' + error.message })
        };
    }
};
