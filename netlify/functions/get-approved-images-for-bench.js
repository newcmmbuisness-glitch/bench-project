// netlify/functions/get-approved-images-for-bench.js
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  try {
    const { bench_id } = event.queryStringParameters;

    if (!bench_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Fehlender bench_id Query-Parameter.' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    
    // Debug: Erst alle Spalten abfragen um zu sehen was da ist
    console.log('Querying additional images for bench_id:', bench_id);
    
    const images = await sql`
      SELECT id, image_url, description, status, created_at
      FROM additional_images
      WHERE bench_id = ${bench_id} AND status = 'approved'
      ORDER BY created_at DESC;
    `;

    console.log('Raw database results:', JSON.stringify(images, null, 2));

    // Daten für Frontend aufbereiten
    const formattedImages = images.map(img => ({
      id: img.id,
      imageUrl: img.image_url, // Explizit zuweisen statt SQL-Alias
      description: img.description || '',
      createdAt: img.created_at
    }));

    console.log('Formatted results:', JSON.stringify(formattedImages, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(formattedImages),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error in get-approved-images-for-bench:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Fehler beim Laden der genehmigten Bilder.', details: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
