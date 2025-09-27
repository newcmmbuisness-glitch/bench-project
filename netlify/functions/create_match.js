const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { likerId, likedId, aiProfileId } = JSON.parse(event.body);

        if (!likerId || likedId === undefined || likedId === null) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fehlende IDs' }) };
        }

        const isAIMatch = likedId === 0;

        if (isAIMatch && !aiProfileId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'AI Profile ID erforderlich' }) };
        }

        let matchId;

        // --- Prüfen, ob Match bereits existiert ---
        if (isAIMatch) {
            const existing = await sql`
                SELECT id FROM matches
                WHERE ((user_id_1 = ${likerId} AND user_id_2 = ${likedId})
                    OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId}))
                  AND ai_profile_id = ${aiProfileId}
            `;
            if (existing.length > 0) {
                matchId = existing[0].id;
            } else {
                const result = await sql`
                    INSERT INTO matches (user_id_1, user_id_2, ai_profile_id)
                    VALUES (${likerId}, ${likedId}, ${aiProfileId})
                    RETURNING id
                `;
                matchId = result[0].id;
            }
         } else { // ECHTE PROFILE (likedId ist eine echte Benutzer-ID)
            
            // --- 1. AUF EXISTIERENDES MATCH PRÜFEN (vom jetzigen Code beibehalten) ---
            const existingMatch = await sql`
                SELECT id FROM matches
                WHERE (user_id_1 = ${likerId} AND user_id_2 = ${likedId})
                    OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId})
            `;
        
            if (existingMatch.length > 0) {
                // Match existiert bereits, einfach zurückgeben
                return {
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        success: true, 
                        newMatch: false, 
                        matchId: existingMatch[0].id,
                        isAIMatch: false 
                    })
                };
            }
            
            // --- 2. LIKE IN HISTORY UND LIKES SPEICHERN (aus dem alten Code übernommen) ---
            
            // Speichere den Swipe in swipe_history (falls noch nicht vorhanden)
            await sql`
                INSERT INTO swipe_history (user_id, swiped_user_id, swipe_direction)
                VALUES (${likerId}, ${likedId}, 'right')
                ON CONFLICT (user_id, swiped_user_id) DO NOTHING
            `;
        
            // Speichere den Like in der likes Tabelle (wird für die Match-Prüfung benötigt)
            await sql`
                INSERT INTO likes (liker_id, liked_id)
                VALUES (${likerId}, ${likedId})
                ON CONFLICT (liker_id, liked_id) DO NOTHING
            `;
        
            let newMatch = false;
            let matchId = null;
            
            // --- 3. GEGENSEITIGEN LIKE PRÜFEN (aus dem alten Code übernommen) ---
            const mutualLike = await sql`
                SELECT id FROM likes 
                WHERE liker_id = ${likedId} AND liked_id = ${likerId}
            `;
        
            if (mutualLike.length > 0) {
                // Beide Benutzer haben sich geliked - Match erstellen
                const result = await sql`
                    INSERT INTO matches (user_id_1, user_id_2)
                    VALUES (${likerId}, ${likedId})
                    RETURNING id
                `;
                
                matchId = result[0].id;
                newMatch = true;
            }
        
            // --- 4. ERGEBNIS ZURÜCKGEBEN ---
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    newMatch, // TRUE nur bei gegenseitigem Like
                    matchId,
                    isAIMatch: false,
                    aiProfileId: null
                })
            };
        } 

    } catch (error) {
        console.error('Fehler in create_match:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
