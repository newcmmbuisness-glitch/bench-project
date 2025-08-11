const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async () => {
  try {
    const benches = await sql`
      SELECT id, name, description, latitude AS lat, longitude AS lng, bench_image AS benchImage, view_image AS viewImage, user_email AS user, created_at AS created
      FROM benches
      ORDER BY created_at DESC;
    `;
    return {
      statusCode: 200,
      body: JSON.stringify(benches),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Fehler beim Laden der genehmigten Bänke' };
  }
};
