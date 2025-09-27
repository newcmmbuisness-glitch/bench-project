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
        // Hole isInstaMatch aus dem Body und setze es standardmäßig auf false
        const { likerId, likedId, aiProfileId, isInstaMatch = false } = JSON.parse(event.body);
    
        if (!likerId || likedId === undefined || likedId === null) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fehlende IDs' }) };
        }
    
        const isAIMatch = likedId === 0;
    
        if (isAIMatch && !aiProfileId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'AI Profile ID erforderlich' }) };
        }
        
        let matchId = null;
        let newMatch = false;
    
        // --- 0. InstaMatch: UserPlus Berechtigungsprüfung (aus altem Code) ---
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
    
        // --- 1. AUF EXISTIERENDES MATCH PRÜFEN (für alle Profile) ---
        // AI-Profile werden durch die Kombination aus user_id_1/2 UND ai_profile_id erkannt.
        const existingMatch = await sql`
            SELECT id FROM matches
            WHERE ((user_id_1 = ${likerId} AND user_id_2 = ${likedId})
                OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId}))
            ${isAIMatch && aiProfileId ? sql` AND ai_profile_id = ${aiProfileId}` : sql``}
        `;
    
        if (existingMatch.length > 0) {
            matchId = existingMatch[0].id;
            newMatch = false;
        } else {
    
            // --- 2. MATCH ERSTELLEN / LIKE SPEICHERN ---
    
            if (isAIMatch) {
                // AI Match: Sofort erstellen
                const result = await sql`
                    INSERT INTO matches (user_id_1, user_id_2, ai_profile_id)
                    VALUES (${likerId}, ${likedId}, ${aiProfileId})
                    RETURNING id
                `;
                matchId = result[0].id;
                newMatch = true;
    
            } else if (isInstaMatch) {
                // InstaMatch: Sofort erstellen + Reverse Like
                const result = await sql`
                    INSERT INTO matches (user_id_1, user_id_2)
                    VALUES (${likerId}, ${likedId})
                    RETURNING id
                `;
                matchId = result[0].id;
                newMatch = true;
    
                // Reverse Like für Konsistenz (Wichtig für Matches)
                await sql`
                    INSERT INTO likes (liker_id, liked_id)
                    VALUES (${likedId}, ${likerId})
                    ON CONFLICT (liker_id, liked_id) DO NOTHING
                `;
    
            } else {
                // Regulärer Like: Speichern und auf Gegenseitigkeit prüfen
                
                // Speichere den Like
                await sql`
                    INSERT INTO likes (liker_id, liked_id)
                    VALUES (${likerId}, ${likedId})
                    ON CONFLICT (liker_id, liked_id) DO NOTHING
                `;
                
                // Gegenseitigen Like prüfen
                const mutualLike = await sql`
                    SELECT id FROM likes 
                    WHERE liker_id = ${likedId} AND liked_id = ${likerId}
                `;
            
                if (mutualLike.length > 0) {
                    // Match erstellen
                    const result = await sql`
                        INSERT INTO matches (user_id_1, user_id_2)
                        VALUES (${likerId}, ${likedId})
                        RETURNING id
                    `;
                    matchId = result[0].id;
                    newMatch = true;
                }
            }
        }
    
        // --- 3. FINALES RETURN (WICHTIG: außerhalb aller if/else Blöcke) ---
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newMatch, 
                matchId,
                isAIMatch,
                isInstaMatch, // Rückgabe für den Client
                aiProfileId: isAIMatch ? aiProfileId : null
            })
        };
    
    } catch (error) {
        console.error('Fehler in create_match:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message || 'Interner Serverfehler' }) 
        };
    }
