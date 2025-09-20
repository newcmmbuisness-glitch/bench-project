exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { likerId, likedId, aiProfileId, isInstaMatch = false } = JSON.parse(event.body);

        if (!likerId || likedId === undefined || likedId === null) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fehlende IDs' }) };
        }

        const isAIMatch = likedId === 0;
        if (isAIMatch && !aiProfileId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'AI Profile ID erforderlich' }) };
        }

        // --- Überprüfen, ob Match schon existiert ---
        let existingMatch;
        if (isAIMatch) {
            existingMatch = await sql`
                SELECT id FROM matches
                WHERE ((user_id_1 = ${likerId} AND user_id_2 = ${likedId}) 
                       OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId}))
                  AND ai_profile_id = ${aiProfileId}
            `;
        } else {
            existingMatch = await sql`
                SELECT id FROM matches
                WHERE (user_id_1 = ${likerId} AND user_id_2 = ${likedId}) 
                   OR (user_id_1 = ${likedId} AND user_id_2 = ${likerId})
            `;
        }

        if (existingMatch.length > 0) {
            return { statusCode: 200, headers, body: JSON.stringify({
                success: true,
                newMatch: false,
                matchId: existingMatch[0].id
            }) };
        }

        // --- Match erstellen ---
        let result;
        if (isAIMatch) {
            result = await sql`
                INSERT INTO matches (user_id_1, user_id_2, ai_profile_id)
                VALUES (${likerId}, ${likedId}, ${aiProfileId})
                RETURNING id
            `;
        } else {
            result = await sql`
                INSERT INTO matches (user_id_1, user_id_2)
                VALUES (${likerId}, ${likedId})
                RETURNING id
            `;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                newMatch: true,
                matchId: result[0].id,
                isAIMatch,
                aiProfileId: isAIMatch ? aiProfileId : null
            })
        };

    } catch (error) {
        console.error('Fehler in create_match:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
