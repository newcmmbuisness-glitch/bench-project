// netlify/functions/add-additional-image.js
// Diese Funktion fügt ein neues Bild zu einer bestimmten Bank hinzu.
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
    try {
        const { bench_id, image_url, description } = JSON.parse(event.body);

        if (!bench_id || !image_url) {
            return {
                statusCode: 400,
                body: 'Fehlende bench_id oder image_url im Request-Body.',
            };
        }

        const result = await sql`
            INSERT INTO additional_images (bench_id, image_url, description, status)
            VALUES (${bench_id}, ${image_url}, ${description}, 'pending')
            RETURNING *;
        `;

        return {
            statusCode: 200,
            body: JSON.stringify(result[0]),
            headers: { 'Content-Type': 'application/json' },
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: 'Fehler beim Hinzufügen des zusätzlichen Bildes.',
        };
    }
};
