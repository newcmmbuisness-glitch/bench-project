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

        // Verifiziere dass der Benutzer existiert
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

        // Holen Sie die IDs der Benutzer, die der aktuelle Benutzer bereits gelikt hat
        // (Annahme: matches Tabelle existiert mit user_id_1, user_id_2 Spalten)
        let likedUsers;
        try {
            likedUsers = await sql`
                SELECT user_id_2 FROM matches WHERE user_id_1 = ${userId}
            `;
        } catch (matchesError) {
            // Falls matches Tabelle noch nicht existiert, setze leeres Array
            console.log('Matches table not found, using empty array');
            likedUsers = [];
        }
        
        const likedUserIds = likedUsers.map(u => u.user_id_2);
        
        // Fügen Sie die eigene ID hinzu, um zu vermeiden, dass der Benutzer sein eigenes Profil sieht
        likedUserIds.push(parseInt(userId));

        // Holen Sie Profile, die der Benutzer noch nicht gesehen hat und die nicht seine eigenen sind
        let profiles;
        
        if (likedUserIds.length === 1) {
            // Nur die eigene ID ist in der Liste
            profiles = await sql`
                SELECT 
                    mp.user_id, 
                    mp.profile_name, 
                    mp.profile_image, 
                    mp.description, 
                    mp.interests,
                    u.email
                FROM meet_profiles mp
                JOIN users u ON mp.user_id = u.id
                WHERE mp.user_id != ${userId}
                ORDER BY RANDOM()
                LIMIT 10
            `;
        } else {
            // Es gibt bereits gelikte Benutzer
            profiles = await sql`
                SELECT 
                    mp.user_id, 
                    mp.profile_name, 
                    mp.profile_image, 
                    mp.description, 
                    mp.interests,
                    u.email
                FROM meet_profiles mp
                JOIN users u ON mp.user_id = u.id
                WHERE mp.user_id != ALL(${likedUserIds})
                ORDER BY RANDOM()
                LIMIT 10
            `;
        }

        // Formatiere die Profile für die Antwort
        const formattedProfiles = profiles.map(profile => ({
            user_id: profile.user_id,
            profile_name: profile.profile_name,
            profile_image: profile.profile_image,
            description: profile.description,
            interests: profile.interests || [], // Falls interests null ist
            email: profile.email // Optional: für Debug-Zwecke
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
