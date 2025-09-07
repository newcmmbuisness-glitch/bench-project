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
            return { statusCode: 400, headers, body: 'Fehlende Benutzer-ID' };
        }

        // Check if user is UserPlus or Admin
        const userCheck = await sql`
            SELECT is_user_plus, is_admin FROM users WHERE id = ${userId}
        `;
        
        if (userCheck.length === 0 || (!userCheck[0].is_user_plus && !userCheck[0].is_admin)) {
            return { 
                statusCode: 403, 
                headers, 
                body: JSON.stringify({ error: 'Swipe Back nur für UserPlus verfügbar' }) 
            };
        }

        // Get the last swipe (most recent)
        const lastSwipe = await sql`
            SELECT sh.swiped_user_id, mp.profile_name, mp.profile_image, mp.description, 
                   mp.interests, mp.age, sh.swipe_direction
            FROM swipe_history sh
            JOIN meet_profiles mp ON sh.swiped_user_id = mp.user_id
            WHERE sh.user_id = ${userId}
            ORDER BY sh.created_at DESC
            LIMIT 1
        `;

        if (lastSwipe.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Keine vorherigen Swipes gefunden' 
                })
            };
        }

        const profile = lastSwipe[0];

        // Remove the last swipe from history
        await sql`
            DELETE FROM swipe_history 
            WHERE user_id = ${userId} 
              AND swiped_user_id = ${profile.swiped_user_id}
        `;

        // If it was a right swipe, also remove the like
        if (profile.swipe_direction === 'right') {
            await sql`
                DELETE FROM likes 
                WHERE liker_id = ${userId} 
                  AND liked_id = ${profile.swiped_user_id}
            `;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                profile: {
                    user_id: profile.swiped_user_id,
                    profile_name: profile.profile_name,
                    profile_image: profile.profile_image,
                    description: profile.description,
                    interests: profile.interests,
                    age: profile.age
                }
            })
        };
        
    } catch (error) {
        console.error('Fehler in swipe_back:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
