// netlify/functions/reject-image.js
// Diese Funktion ändert den Status eines Bildes auf 'rejected'.
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
      SET status = 'rejected'
      WHERE id = ${id};
    `;

    return {
      statusCode: 200,
      body: 'Bild erfolgreich abgelehnt.',
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: 'Fehler beim Ablehnen des Bildes.',
    };
  }
};
