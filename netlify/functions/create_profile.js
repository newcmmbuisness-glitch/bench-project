const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    // ... CORS-Header wie in add_bench.js
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { userId, name, description, interests, profileImage } = JSON.parse(event.body);

        if (!userId || !name || !profileImage) {
            return { statusCode: 400, body: 'Fehlende Felder!' };
        }

        const result = await sql`
            INSERT INTO meet_profiles (user_id, profile_name, description, interests, profile_image)
            VALUES (${userId}, ${name}, ${description}, ${interests}, ${profileImage})
            ON CONFLICT (user_id) DO UPDATE SET
                profile_name = EXCLUDED.profile_name,
                description = EXCLUDED.description,
                interests = EXCLUDED.interests,
                profile_image = EXCLUDED.profile_image
            RETURNING id;
        `;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, profileId: result[0].id }),
        };
    } catch (error) {
        return { statusCode: 500, body: 'Server-Fehler' };
    }
};
