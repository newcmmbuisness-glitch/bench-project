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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { benchId, userEmail, action } = JSON.parse(event.body);

    if (!benchId || !userEmail || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Alle Felder sind erforderlich!' }),
      };
    }

    // Prüfen ob die Bank in der richtigen Tabelle existiert
    const benchExists = await sql`
      SELECT id FROM benches WHERE id = ${benchId}
    `;

    if (benchExists.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Bank nicht gefunden!' }),
      };
    }

    if (action === 'like') {
      // Check if user already liked this bench
      const existingLike = await sql`
        SELECT id FROM bench_likes 
        WHERE bench_id = ${benchId} AND user_email = ${userEmail}
      `;

      if (existingLike.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Bank bereits geliked!' }),
        };
      }

      // Add like
      await sql`
        INSERT INTO bench_likes (bench_id, user_email, created_at)
        VALUES (${benchId}, ${userEmail}, NOW())
      `;

    } else if (action === 'unlike') {
      // Remove like
      const deleteResult = await sql`
        DELETE FROM bench_likes 
        WHERE bench_id = ${benchId} AND user_email = ${userEmail}
      `;
      
      if (deleteResult.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Like nicht gefunden!' }),
        };
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Ungültige Aktion!' }),
      };
    }

    // Get updated like count
    const likeCount = await sql`
      SELECT COUNT(*) as count FROM bench_likes WHERE bench_id = ${benchId}
    `;

    const currentLikeCount = parseInt(likeCount[0].count);
    const isPopular = currentLikeCount >= 10;

    // Update is_popular status in benches table
    const updateResult = await sql`
      UPDATE benches 
      SET is_popular = ${isPopular}
      WHERE id = ${benchId}
      RETURNING id, is_popular
    `;

    console.log(`Updated bench ${benchId}: likes=${currentLikeCount}, is_popular=${isPopular}`);

    if (updateResult.length === 0) {
      console.error(`Failed to update bench ${benchId} - bench not found in benches table`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Bank konnte nicht aktualisiert werden!' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        likeCount: currentLikeCount,
        action: action,
        isPopular: isPopular,
        benchId: benchId
      }),
    };

  } catch (error) {
    console.error('Error in like_bench:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Interner Serverfehler' }),
    };
  }
};
