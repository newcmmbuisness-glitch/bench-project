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

        // Verbesserte Validierung
        if (!userId || !clickedSuggestion) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Fehlende Felder: userId und clickedSuggestion sind erforderlich' 
                })
            };
        }

        // Zusätzliche Validierung für userId (muss Nummer sein)
        const userIdInt = parseInt(userId);
        if (isNaN(userIdInt)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'userId muss eine gültige Zahl sein' 
                })
            };
        }

        // Validierung für clickedSuggestion (nicht zu lang)
        if (clickedSuggestion.length > 500) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Vorschlag ist zu lang (max. 500 Zeichen)' 
                })
            };
        }

        // Prüfen ob der User existiert (optional, für bessere Datenintegrität)
        const userExists = await sql`
            SELECT id FROM meet_profiles WHERE user_id = ${userIdInt} LIMIT 1;
        `;

        if (userExists.length === 0) {
            console.warn(`Warnung: User ${userIdInt} nicht in meet_profiles gefunden, logge trotzdem den Klick`);
        }

        // SQL-Anweisung mit korrekter Parameterbehandlung
        await sql`
            INSERT INTO suggestion_clicks (user_id, clicked_suggestion)
            VALUES (${userIdInt}, ${clickedSuggestion});
        `;

        // Erfolgsmeldung mit zusätzlichen Informationen für Debugging
        console.log(`✅ Suggestion click logged: User ${userIdInt} clicked "${clickedSuggestion.substring(0, 50)}..."`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                message: 'Klick erfolgreich protokolliert',
                timestamp: new Date().toISOString()
            }),
        };

    } catch (error) {
        console.error('Database insertion error:', error);
        
        // Detailliertere Fehlermeldung basierend auf dem Fehlertyp
        let errorMessage = 'Unbekannter Datenbankfehler';
        
        if (error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
            errorMessage = 'Dieser Klick wurde bereits protokolliert';
        } else if (error.message.includes('foreign key constraint')) {
            errorMessage = 'Ungültige Benutzer-ID';
        } else if (error.message.includes('not null constraint')) {
            errorMessage = 'Erforderliche Felder fehlen';
        } else {
            errorMessage = error.message;
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};
