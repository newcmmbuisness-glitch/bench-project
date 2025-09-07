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
        const { likerId, likedId, isInstaMatch = false } = JSON.parse(event.body);
        
        if (!likerId || !likedId) {
            return { statusCode: 400, headers, body: 'Fehlende IDs' };
        }

        // Check if liker is UserPlus for InstaMatch
        if (isInstaMatch) {
            const userCheck = await sql`
                SELECT is_user_plus, is_admin FROM users WHERE id = ${likerId}
            `;
            
            if (userCheck.length === 0 || (!userCheck[0].is_user_plus && !userCheck[0].is_admin)) {
                return { 
                    statusCode: 403, 
                    headers, 
                    body: JSON.stringify({ error: 'InstaMatch nur für UserPlus verfügbar' }) 
                };
            }
        }

        // Check if match already exists
        const existingMatch = await sql`
            SELECT id FROM matches 
            WHERE (user_id_1 = ${likerId} AND user_id_2 = ${likedId}) 
               OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId})
        `;

        if (existingMatch.length > 0) {
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ 
                    success: true, 
                    newMatch: false, 
                    matchId: existingMatch[0].id 
                }) 
            };
        }

        // Record the swipe in swipe_history
        await sql`
            INSERT INTO swipe_history (user_id, swiped_user_id, swipe_direction)
            VALUES (${likerId}, ${likedId}, 'right')
            ON CONFLICT (user_id, swiped_user_id) DO NOTHING
        `;

        // Record the like
        await sql`
            INSERT INTO likes (liker_id, liked_id)
            VALUES (${likerId}, ${likedId})
            ON CONFLICT (liker_id, liked_id) DO NOTHING
        `;

        let newMatch = false;
        let matchId = null;

        if (isInstaMatch) {
            // InstaMatch: Create match immediately
            const result = await sql`
                INSERT INTO matches (user_id_1, user_id_2)
                VALUES (${likerId}, ${likedId})
                RETURNING id
            `;
            
            matchId = result[0].id;
            newMatch = true;
            
            // Also record the reverse like to maintain consistency
            await sql`
                INSERT INTO likes (liker_id, liked_id)
                VALUES (${likedId}, ${likerId})
                ON CONFLICT (liker_id, liked_id) DO NOTHING
            `;
            
        } else {
            // Regular like: Check if other user also liked
            const mutualLike = await sql`
                SELECT id FROM likes 
                WHERE liker_id = ${likedId} AND liked_id = ${likerId}
            `;

            if (mutualLike.length > 0) {
                // Both users liked each other - create match
                const result = await sql`
                    INSERT INTO matches (user_id_1, user_id_2)
                    VALUES (${likerId}, ${likedId})
                    RETURNING id
                `;
                
                matchId = result[0].id;
                newMatch = true;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                newMatch, 
                matchId,
                isInstaMatch 
            }),
        };
        
    } catch (error) {
        console.error('Fehler in create_match:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
