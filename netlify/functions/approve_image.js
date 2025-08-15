// netlify/functions/approve-image.js
// Diese Funktion ändert den Status eines Bildes auf 'approved'.
const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  try {
    const { id } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        body: 'Fehlende id im Request-Body.',
      };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    await sql`
      UPDATE additional_images
      SET status = 'approved'
      WHERE id = ${id};
    `;

    return {
      statusCode: 200,
      body: 'Bild erfolgreich genehmigt.',
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: 'Fehler beim Genehmigen des Bildes.',
    };
  }
};
