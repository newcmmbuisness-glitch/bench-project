const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { userId, clickedSuggestion } = JSON.parse(event.body);

        if (!userId || !clickedSuggestion) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Fehlende Felder' })
            };
        }

        // Korrigierte SQL-Anweisung
        await sql`
            INSERT INTO suggestion_clicks (user_id, clicked_suggestion)
            VALUES (${userId}, ${clickedSuggestion});
        `;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        console.error('Database insertion error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
