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

        // 1. Das eigene Profil laden um Gender zu ermitteln
        const userProfile = await sql`
            SELECT gender FROM meet_profiles WHERE user_id = ${userId}
        `;
        
        if (userProfile.length === 0) {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Benutzerprofil nicht gefunden' }) 
            };
        }

        const userGender = userProfile[0]?.gender;
        if (!userGender) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'Gender nicht im Profil gesetzt' }) 
            };
        }

        // 2. Bestimme das Ziel-Gender (Männer sehen nur Frauen und umgekehrt)
        const targetGender = userGender === 'male' ? 'female' : 'male';
        
        // 3. Alle Profile abfragen, die der Nutzer bereits geswipt hat
        const swipedUsers = await sql`
            SELECT swiped_user_id FROM swipe_history WHERE user_id = ${userId}
        `;
        const swipedUserIds = swipedUsers.map(s => s.swiped_user_id);
        
        // 4. Den Nutzer selbst und alle geswipten Profile von der Abfrage ausschließen
        const excludedUserIds = [userId, ...swipedUserIds];
        
        // 5. Profile mit Gender-Filter laden
        let profiles;
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
            mp.gender,
            u.email
          FROM meet_profiles mp
          JOIN users u ON mp.user_id = u.id
          WHERE mp.user_id != ALL(${excludedUserIds})
          AND mp.gender = ${targetGender}
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
          gender: profile.gender,
          email: profile.email
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                profiles: formattedProfiles,
                totalFound: formattedProfiles.length,
                userGender: userGender,
                targetGender: targetGender
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
