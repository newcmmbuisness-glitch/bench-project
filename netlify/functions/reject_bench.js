const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
  try {
    const { id } = JSON.parse(event.body);

    if (!id) {
      return { statusCode: 400, body: 'ID fehlt' };
    }

    await sql`
      DELETE FROM pending_benches WHERE id = ${id}
    `;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Fehler beim Ablehnen der Bank' };
  }
};
