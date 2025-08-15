// netlify/functions/get-pending-images.js
// Diese Funktion holt alle Bilder, die auf Genehmigung warten.
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async () => {
    try {
        const images = await sql`
            SELECT
                i.id,
                i.bench_id,
                i.image_url AS imageUrl,
                i.description,
                i.created_at AS createdAt,
                b.name AS benchName,
                b.bench_image AS benchImage,
                b.view_image AS viewImage
            FROM additional_images i
            JOIN benches b ON i.bench_id = b.id
            WHERE i.status = 'pending'
            ORDER BY i.created_at DESC;
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
            body: 'Fehler beim Laden der wartenden Bilder.',
        };
    }
};
