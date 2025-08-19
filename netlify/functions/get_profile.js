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
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fehlende Benutzer-ID' }) };
        }

        // Holen Sie die IDs der Benutzer, die der aktuelle Benutzer bereits gelikt hat
        const likedUsers = await sql`
            SELECT user_id_2 FROM matches WHERE user_id_1 = ${userId};
        `;
        const likedUserIds = likedUsers.map(u => u.user_id_2);
        
        // Fügen Sie die eigene ID hinzu, um zu vermeiden, dass der Benutzer sein eigenes Profil sieht
        likedUserIds.push(userId);

        // Holen Sie Profile, die der Benutzer noch nicht gesehen hat und die nicht seine eigenen sind
        const profiles = await sql`
            SELECT user_id, profile_name, profile_image, description FROM meet_profiles
            WHERE user_id NOT IN (${likedUserIds.join(',')})
            ORDER BY RANDOM()
            LIMIT 10;
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, profiles }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
