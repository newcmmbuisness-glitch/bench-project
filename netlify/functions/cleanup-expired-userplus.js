// netlify/functions/cleanup-expired-userplus.js
// Diese Funktion sollte täglich laufen (z.B. über Netlify Scheduled Functions)

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    try {
        const now = new Date().toISOString();

        // Finde alle User mit abgelaufenem UserPlus
        const expiredUsers = await sql`
            SELECT id, user_plus_expires_at 
            FROM users 
            WHERE is_user_plus = TRUE 
            AND user_plus_expires_at <= ${now}
        `;

        console.log(`Gefunden: ${expiredUsers.length} abgelaufene UserPlus-Abos`);

        if (expiredUsers.length > 0) {
            // Deaktiviere abgelaufene UserPlus-Abos
            const result = await sql`
                UPDATE users 
                SET is_user_plus = FALSE,
                    user_plus_expires_at = NULL
                WHERE is_user_plus = TRUE 
                AND user_plus_expires_at <= ${now}
            `;

            console.log(`${result.length} UserPlus-Abos deaktiviert`);

            // Optional: Log für Statistiken
            for (const user of expiredUsers) {
                await sql`
                    INSERT INTO userplus_expirations (user_id, expired_at, created_at)
                    VALUES (${user.id}, ${user.user_plus_expires_at}, NOW())
                `;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                message: `${expiredUsers.length} abgelaufene UserPlus-Abos bereinigt`,
                expiredUsers: expiredUsers.length
            })
        };

    } catch (error) {
        console.error('Fehler beim UserPlus Cleanup:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                error: 'Cleanup fehlgeschlagen',
                details: error.message 
            }) 
        };
    }
};
