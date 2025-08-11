const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const { id } = JSON.parse(event.body);

    if (!id) {
      return { statusCode: 400, body: 'ID fehlt' };
    }

    // Insert aus pending_benches in benches kopieren
    await sql.begin(async (tx) => {
      const bench = await tx`
        SELECT * FROM pending_benches WHERE id = ${id}
      `;

      if (bench.length === 0) {
        throw new Error('Bank nicht gefunden');
      }

      const b = bench[0];

      await tx`
        INSERT INTO benches (name, description, latitude, longitude, bench_image, view_image, user_email, created_at)
        VALUES (${b.name}, ${b.description}, ${b.latitude}, ${b.longitude}, ${b.bench_image}, ${b.view_image}, ${b.user_email}, ${b.created_at})
      `;

      await tx`
        DELETE FROM pending_benches WHERE id = ${id}
      `;
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Fehler beim Genehmigen der Bank' };
  }
};
