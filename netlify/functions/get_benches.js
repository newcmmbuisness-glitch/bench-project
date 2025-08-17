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
    // Get approved benches with like counts
	const benches = await sql`
	  SELECT 
		ab.id,
		ab.name,
		ab.description,
		ab.latitude,
		ab.longitude,
		ab.bench_image,
		ab.view_image,
		ab.user_email,
		ab.created_at,
		ab.is_popular,
		COALESCE(like_counts.like_count, 0) as like_count
	  FROM benches ab
	  LEFT JOIN (
		SELECT bench_id, COUNT(*) as like_count
		FROM bench_likes
		GROUP BY bench_id
	  ) like_counts ON ab.id = like_counts.bench_id
	  ORDER BY ab.created_at DESC
	`;

    // Get user's likes if email provided in query
    const { userEmail } = event.queryStringParameters || {};
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
        benches: benches,
        userLikes: userLikes
      }),
    };

  } catch (error) {
    console.error('Error in get_benches:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Fehler beim Laden der Bänke' }),
    };
  }
};
