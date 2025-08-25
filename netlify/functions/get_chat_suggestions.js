const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Hilfsfunktion zur Generierung der Vorschläge
const generateSuggestions = (lastMessage, myUserId, myInterests, matchInterests, topSuggestions) => {
    console.log('--- DEBUG: Neue Version 1.1 wird ausgeführt ---'); 
    const relevantTopSuggestions = topSuggestions.filter(suggestion => {
        // Überprüft, ob der Top-Vorschlag eine spezifische Interessen-Frage ist
        const interestRegex = /Interesse an ([^.]+)/;
        const match = suggestion.match(interestRegex);
        if (match) {
            const interest = match[1].trim();
            // Gibt den Vorschlag nur zurück, wenn das Interesse in einem der Profile ist
            return myInterests.includes(interest) && matchInterests.includes(interest);
        }
        // Lässt alle anderen Top-Vorschläge (z. B. Standardfragen) durch
        return true;
    });

    const suggestions = new Set(relevantTopSuggestions);

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

        console.log('Meine Interessen:', myInterests);
        console.log('Interessen des Matches:', matchInterests);
        console.log('Gemeinsame Interessen (vom Code gefunden):', commonInterests);
                
        if (commonInterests.length > 0) {
            const interest = commonInterests[0];
            
            // Spezifische Vorschläge basierend auf der Art des Interesses
            switch(interest) {
                case 'Kochen':
                    suggestions.add('Ich sehe, du kochst auch gerne! Was ist dein Lieblingsgericht?');
                    suggestions.add('Kochen wir beide gerne - hast du schon mal ein neues Rezept ausprobiert?');
                    break;
                case 'Gaming':
                    suggestions.add('Gaming-Fan hier auch! Welches Spiel zockst du gerade?');
                    suggestions.add('Cool, ein Gamer! PC oder Konsole?');
                    break;
                case 'Wandern':
                    suggestions.add('Wandern ist großartig! Welcher war dein schönster Wanderweg?');
                    suggestions.add('Ich liebe es auch zu wandern. Gehst du lieber in die Berge oder durch Wälder?');
                    break;
                case 'Fotografie':
                    suggestions.add('Fotografierst du auch? Was ist dein Lieblings-Motiv?');
                    suggestions.add('Cool, Fotografie! Digital oder analog?');
                    break;
                case 'Musik':
                    suggestions.add('Musik verbindet! Welches Genre hörst du am liebsten?');
                    suggestions.add('Spielst du auch ein Instrument oder hörst du nur gerne Musik?');
                    break;
                case 'Filme':
                    suggestions.add('Ein Filmfan! Was war der letzte gute Film, den du gesehen hast?');
                    suggestions.add('Kino oder Netflix? Was ist dein Lieblings-Genre?');
                    break;
                case 'Sport':
                    suggestions.add('Sport ist super! Welche Sportart machst du am liebsten?');
                    suggestions.add('Aktiv zu bleiben ist wichtig. Trainierst du im Gym oder draußen?');
                    break;
                case 'Kunst':
                    suggestions.add('Kunst ist faszinierend! Malst du selbst oder besuchst du gerne Ausstellungen?');
                    suggestions.add('Welche Art von Kunst spricht dich am meisten an?');
                    break;
                case 'Haustiere':
                    suggestions.add('Ich sehe, du magst Tiere! Hast du selbst welche?');
                    suggestions.add('Haustiere sind die Besten! Hund oder Katze?');
                    break;
                case 'wine':
                    suggestions.add('Ein Weinliebhaber! Was ist dein Lieblingswein?');
                    suggestions.add('Rot- oder Weißwein? Oder vielleicht Rosé?');
                    break;
                case 'coffee':
                    suggestions.add('Kaffee-Fan! Espresso oder Filterkaffee?');
                    suggestions.add('Ohne Kaffee geht nichts! Welche Röstung magst du am liebsten?');
                    break;
                case 'book':
                    suggestions.add('Liest du auch gerne? Was ist dein aktuelles Buch?');
                    suggestions.add('Bücher sind großartig! Fiction oder Non-Fiction?');
                    break;
                case 'bike':
                    suggestions.add('Fahrrad fahren ist toll! Mountainbike oder Rennrad?');
                    suggestions.add('Wo fährst du am liebsten Rad?');
                    break;
                case '420':
                    suggestions.add('Entspannung ist wichtig. Was machst du gerne zum Chillen?');
                    break;
                default:
                    suggestions.add(`Wir haben beide Interesse an ${interest}. Was machst du am liebsten in dem Bereich?`);
            }
        }
    }
    
    // Regel 3: Reaktion auf spezifische Fragen über Hobbies
    if (lastMessageText.includes('hobbies') || lastMessageText.includes('interessen') || lastMessageText.includes('freizeit')) {
        if (myInterests && myInterests.length > 0) {
            const randomInterest = myInterests[Math.floor(Math.random() * myInterests.length)];
            suggestions.add(`Ich mag ${randomInterest} sehr gerne. Was machst du in deiner Freizeit?`);
        }
    }
    
    // Regel 4: Reaktion auf Fragen nach Plänen
    if (lastMessageText.includes('pläne') || lastMessageText.includes('wochenende') || lastMessageText.includes('heute')) {
        suggestions.add('Heute wird ein entspannter Tag. Und bei dir?');
        suggestions.add('Noch nichts Konkretes geplant. Hast du Ideen?');
        suggestions.add('Vielleicht eine schöne Bank zum Spazieren finden 😉');
    }
    
    // Regel 5: Reaktion auf Treffen-bezogene Nachrichten
    if (lastMessageText.includes('treffen') || lastMessageText.includes('date') || lastMessageText.includes('bank')) {
        suggestions.add('Eine Bank mit schöner Aussicht wäre perfekt!');
        suggestions.add('Ich kenne ein paar schöne Orte. Wo würdest du dich gerne treffen?');
        suggestions.add('Ein entspanntes Gespräch auf einer Bank klingt super!');

        if (myInterests.includes('Wein') && matchInterests.includes('Wein')) {
            suggestions.add('Perfekt, ich bringe den Wein mit!');
        }
        if (myInterests.includes('420') && matchInterests.includes('420')) {
            suggestions.add('Cool! Ich bringe 🍃 mit.');
        }
                
    }
    
    // Regel 6: Standard-Vorschläge, wenn nichts Spezifisches zutrifft
    const standardSuggestions = [
        'Wie geht\'s dir heute?',
        'Was sind deine Pläne für das Wochenende?',
        'Was hat dich auf mein Profil gebracht?',
        'Erzähl mir etwas über dich!',
        'Wie war dein Tag?',
        'Auf was für Musik stehst du?',
        'Warst du schon mal auf einer richtig romantischen Bank?'
    ];
    
    while (suggestions.size < 3) {
        const randomSuggestion = standardSuggestions[Math.floor(Math.random() * standardSuggestions.length)];
        if (!suggestions.has(randomSuggestion)) {
            suggestions.add(randomSuggestion);
        }
        
        // Verhindere Endlosschleife
        if (suggestions.size >= standardSuggestions.length) break;
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
        
        if (!matchId || !currentUserId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'matchId und currentUserId sind erforderlich' })
            };
        }
        
        // Top 3 populärste Vorschläge der letzten 30 Tage abrufen
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
        const lastMessageResult = await sql`
            SELECT message_text, sender_id FROM chat_messages
            WHERE match_id = ${matchId}
            ORDER BY sent_at DESC
            LIMIT 1;
        `;
        const lastMessage = lastMessageResult[0] || null;

        // Profile beider Nutzer abrufen (aktualisierte Abfrage für neue DB-Struktur)
        const profiles = await sql`
            SELECT profile_name, interests, user_id FROM meet_profiles
            WHERE user_id IN (
                SELECT user_id_1 FROM matches WHERE id = ${matchId}
                UNION
                SELECT user_id_2 FROM matches WHERE id = ${matchId}
            );
        `;
        
        const myProfile = profiles.find(p => p.user_id === parseInt(currentUserId));
        const matchProfile = profiles.find(p => p.user_id !== parseInt(currentUserId));

        // Interests sind jetzt als Array gespeichert, nicht mehr als String
        const myInterests = myProfile ? myProfile.interests || [] : [];
        const matchInterests = matchProfile ? matchProfile.interests || [] : [];
        
        const suggestions = generateSuggestions(lastMessage, parseInt(currentUserId), myInterests, matchInterests, topSuggestions);

        console.log('Final Suggestions:', suggestions);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, suggestions }),
        };

    } catch (error) {
        console.error('Fehler in get_chat_suggestions:', error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                success: false, 
                error: error.message,
                // Fallback-Vorschläge bei Fehler
                suggestions: [
                    'Wie geht\'s dir heute?',
                    'Was machst du gerne in deiner Freizeit?',
                    'Erzähl mir etwas über dich!'
                ]
            }) 
        };
    }
};
