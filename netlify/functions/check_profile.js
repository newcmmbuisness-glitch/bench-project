// netlify/functions/check_profile.js
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { userId } = JSON.parse(event.body);
        console.log('Empfangene Benutzer-ID:', userId);

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Fehlende Benutzer-ID' })
            };
        }

        const profile = await sql`
            SELECT user_id FROM meet_profiles WHERE user_id = ${userId}
        `;

        console.log('Abfrageergebnis:', profile);

        const hasProfile = profile.length > 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ hasProfile: hasProfile }),
        };

    } catch (error) {
        console.error('Check profile error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server-Fehler: ' + error.message })
        };
    }
};
