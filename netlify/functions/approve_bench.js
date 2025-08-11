const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const { id } = JSON.parse(event.body);

    if (!id) {
      return { statusCode: 400, body: 'ID fehlt' };
    }

    // Bank aus pending_benches abrufen
    const bench = await sql`
      SELECT * FROM pending_benches WHERE id = ${id}
    `;

    if (bench.length === 0) {
      return { statusCode: 404, body: 'Bank nicht gefunden' };
    }

    const b = bench[0];

    // Insert in benches
    await sql`
      INSERT INTO benches (name, description, latitude, longitude, bench_image, view_image, user_email, created_at)
      VALUES (${b.name}, ${b.description}, ${b.latitude}, ${b.longitude}, ${b.bench_image}, ${b.view_image}, ${b.user
