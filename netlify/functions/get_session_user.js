const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        // Annahme: Ihre Anmeldungs-Funktion setzt einen Header 'X-User-Email'.
        // Falls Ihre Methode anders ist (z.B. über ein Cookie), passen Sie dies bitte an.
        const userEmail = event.headers['x-user-email'];

        if (!userEmail) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Nicht authentifiziert' }),
            };
        }

        const result = await sql`
            SELECT id FROM users WHERE email = ${userEmail};
        `;

        if (result.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Benutzer nicht gefunden' }),
            };
        }

        const userId = result[0].id;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, userId }),
        };
    } catch (error) {
        console.error('Fehler beim Abrufen des Benutzers:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server-Fehler' }),
        };
    }
};
