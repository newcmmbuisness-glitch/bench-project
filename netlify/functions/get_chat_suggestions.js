const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Hilfsfunktion zur Generierung der Vorschläge
const generateSuggestions = (lastMessage, myUserId, myInterests, matchInterests, topSuggestions) => {
    const suggestions = new Set(topSuggestions); // Startet mit den Top-Vorschlägen

    const lastMessageText = lastMessage ? lastMessage.message_text.toLowerCase() : '';

    // Regel 1: Reaktion auf Komplimente
    const complimentKeywords = ['schön', 'toll', 'mag', 'gefällt', 'süß', 'gut', 'cool'];
    if (lastMessage && lastMessage.sender_id !== myUserId && complimentKeywords.some(keyword => lastMessageText.includes(keyword))) {
        suggestions.add('Danke! Dein Profil gefällt mir auch.');
        suggestions.add('Das ist nett, danke!');
        suggestions.add('Danke, du hast auch ein tolles Profilbild.');
    }

    // Regel 2: Vorschläge basierend auf gemeinsamen Interessen
    if (myInterests && matchInterests) {
        const commonInterests = myInterests.filter(i => matchInterests.includes(i));
        if (commonInterests.length > 0) {
            suggestions.add(`Wir haben beide Interesse an ${commonInterests[0]}. Was machst du am liebsten in dem Bereich?`);
        }
    }
    
    // Regel 3: Reaktion auf spezifische Fragen
    if (lastMessageText.includes('hobbies') || lastMessageText.includes('interessen')) {
        suggestions.add('Ich mag ' + myInterests[0] + ' sehr gerne. Was machst du in deiner Freizeit?');
    }
    
    // Regel 4: Standard-Vorschläge, wenn nichts Spezifisches zutrifft
    while (suggestions.size < 3) {
        if (!suggestions.has('Wie geht\'s dir heute?')) {
            suggestions.add('Wie geht\'s dir heute?');
        }
        if (!suggestions.has('Was sind deine Pläne für das Wochenende?')) {
            suggestions.add('Was sind deine Pläne für das Wochenende?');
        }
        if (!suggestions.has('Was hat dich auf mein Profil gebracht?')) {
            suggestions.add('Was hat dich auf mein Profil gebracht?');
        }
        break;
    }

    return Array.from(suggestions).slice(0, 3);
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { matchId, currentUserId } = JSON.parse(event.body);
        
        // NEU: Top 3 populärste Vorschläge der letzten 30 Tage abrufen
        const topSuggestionsResult = await sql`
            SELECT clicked_suggestion
            FROM suggestion_clicks
            WHERE clicked_at > NOW() - INTERVAL '30 days'
            GROUP BY clicked_suggestion
            ORDER BY COUNT(*) DESC
            LIMIT 3;
        `;
        const topSuggestions = topSuggestionsResult.map(row => row.clicked_suggestion);

        // Letzte Nachricht aus der Datenbank abrufen
        const [lastMessageResult] = await sql`
            SELECT message_text, sender_id FROM chat_messages
            WHERE match_id = ${matchId}
            ORDER BY sent_at DESC
            LIMIT 1;
        `;
        const lastMessage = lastMessageResult || null;

        // Profile beider Nutzer abrufen
        const profiles = await sql`
            SELECT profile_name, interests, user_id FROM meet_profiles
            WHERE user_id IN (
                SELECT user_id_1 FROM matches WHERE id = ${matchId}
                UNION
                SELECT user_id_2 FROM matches WHERE id = ${matchId}
            );
        `;
        
        const myProfile = profiles.find(p => p.user_id === currentUserId);
        const matchProfile = profiles.find(p => p.user_id !== currentUserId);

        const myInterests = myProfile ? myProfile.interests : [];
        const matchInterests = matchProfile ? matchProfile.interests : [];
        
        const suggestions = generateSuggestions(lastMessage, currentUserId, myInterests, matchInterests, topSuggestions);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, suggestions }),
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
