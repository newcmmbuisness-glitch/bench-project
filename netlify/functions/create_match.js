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

    if (!likerId || likedId === undefined || likedId === null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Fehlende IDs' }),
      };
    }

    // Prüfen ob likedId ein AI-Profil ist
    const aiCheck = await sql`SELECT id FROM ai_profiles WHERE id = ${likedId}`;
    const isAIMatch = aiCheck.length > 0;

    // InstaMatch nur wenn UserPlus oder Admin (nicht für AI nötig)
    if (isInstaMatch && !isAIMatch) {
      const userCheck = await sql`
        SELECT is_user_plus, is_admin FROM users WHERE id = ${likerId}
      `;
      if (
        userCheck.length === 0 ||
        (!userCheck[0].is_user_plus && !userCheck[0].is_admin)
      ) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'InstaMatch nur für UserPlus verfügbar' }),
        };
      }
    }

    // Prüfen ob Match bereits existiert
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
          matchId: existingMatch[0].id,
        }),
      };
    }

    // Swipes & Likes nur bei echten Usern speichern
    if (!isAIMatch) {
      await sql`
        INSERT INTO swipe_history (user_id, swiped_user_id, swipe_direction)
        VALUES (${likerId}, ${likedId}, 'right')
        ON CONFLICT (user_id, swiped_user_id) DO NOTHING
      `;

      await sql`
        INSERT INTO likes (liker_id, liked_id)
        VALUES (${likerId}, ${likedId})
        ON CONFLICT (liker_id, liked_id) DO NOTHING
      `;
    }

    // Match erstellen
    const result = await sql`
      INSERT INTO matches (user_id_1, user_id_2)
      VALUES (${likerId}, ${likedId})
      RETURNING id
    `;
    const matchId = result[0].id;
    let newMatch = true;

    // Bei InstaMatch mit echten Usern den Rück-Like setzen
    if (isInstaMatch && !isAIMatch) {
      await sql`
        INSERT INTO likes (liker_id, liked_id)
        VALUES (${likedId}, ${likerId})
        ON CONFLICT (liker_id, liked_id) DO NOTHING
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        newMatch,
        matchId,
        isInstaMatch,
        isAIMatch,
      }),
    };
  } catch (error) {
    console.error('Fehler in create_match:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
