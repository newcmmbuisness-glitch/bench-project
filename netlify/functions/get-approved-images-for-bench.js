// netlify/functions/get-approved-images-for-bench.js
// Diese Funktion holt alle genehmigten Bilder für eine bestimmte Bank.
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  try {
    const { bench_id } = event.queryStringParameters;

    if (!bench_id) {
      return {
        statusCode: 400,
        body: 'Fehlender bench_id Query-Parameter.',
      };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const images = await sql`
      SELECT id, image_url AS imageUrl, description
      FROM additional_images
      WHERE bench_id = ${bench_id} AND status = 'approved'
      ORDER BY created_at DESC;
    `;

    return {
      statusCode: 200,
      body: JSON.stringify(images),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: 'Fehler beim Laden der genehmigten Bilder.',
    };
  }
};
