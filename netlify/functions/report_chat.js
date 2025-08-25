const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { match_id, reporter_id } = JSON.parse(event.body);
        if (!match_id || !reporter_id) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Fehlende Match- oder Reporter-ID' }) 
            };
        }

        // Führt die Meldung in der Datenbank aus
        const result = await sql`
            UPDATE matches
            SET is_reported = TRUE
            WHERE id = ${match_id}
            RETURNING id;
        `;
        
        if (result.length > 0) {
             return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Chat erfolgreich gemeldet.' }),
            };
        } else {
             return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ success: false, error: 'Match nicht gefunden.' }),
            };
        }

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
