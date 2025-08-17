const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { benchId, userEmail } = event.queryStringParameters || {};

    if (benchId && userEmail) {
      // Get specific bench like info for user
      const userLike = await sql`
        SELECT id FROM bench_likes 
        WHERE bench_id = ${benchId} AND user_email = ${userEmail}
      `;

      const likeCount = await sql`
        SELECT COUNT(*) as count FROM bench_likes WHERE bench_id = ${benchId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          isLiked: userLike.length > 0,
          likeCount: parseInt(likeCount[0].count)
        }),
      };
    } else {
      // Get all bench likes summary
      const allLikes = await sql`
        SELECT bench_id, COUNT(*) as like_count
        FROM bench_likes
        GROUP BY bench_id
      `;

      const likesData = {};
      allLikes.forEach(row => {
        likesData[row.bench_id] = parseInt(row.like_count);
      });

      // If userEmail provided, get user's liked benches
      let userLikes = [];
      if (userEmail) {
        const userLikeData = await sql`
          SELECT bench_id FROM bench_likes WHERE user_email = ${userEmail}
        `;
        userLikes = userLikeData.map(row => row.bench_id);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          benchLikes: likesData,
          userLikes: userLikes
        }),
      };
    }

  } catch (error) {
    console.error('Error in get_bench_likes:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Interner Serverfehler' }),
    };
  }
};
