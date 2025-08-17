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
      await sql`
        DELETE FROM bench_likes 
        WHERE bench_id = ${benchId} AND user_email = ${userEmail}
      `;
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

    // Update is_popular status basierend auf like count
    await sql`
      UPDATE benches 
      SET is_popular = ${currentLikeCount >= 10}
      WHERE id = ${benchId}
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        likeCount: currentLikeCount,
        action: action,
        isPopular: currentLikeCount >= 10
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
