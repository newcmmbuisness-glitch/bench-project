exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { aiProfileId, userMessage, userProfile } = JSON.parse(event.body);
        
        if (!aiProfileId || !userMessage) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'aiProfileId und userMessage sind erforderlich' 
                })
            };
        }

        // AI Personality profiles
        const aiPersonalities = {
            ai_anna: {
                name: "Anna",
                traits: ["romantisch", "naturliebend", "nachdenklich"],
                interests: ["wine", "Wandern", "Fotografie"],
                chatStyle: "warmherzig und poetisch",
                responsePatterns: {
                    greeting: ["Hallo! Wie schön, von dir zu hören! ☺️", "Hey! Freut mich, dass wir uns schreiben!"],
                    compliment: ["Oh, das ist aber lieb von dir! 😊", "Du bist wirklich süß, danke!"],
                    interests: {
                        wine: ["Ich liebe es, bei einem guten Glas Wein den Sonnenuntergang zu beobachten 🍷", "Welchen Wein trinkst du denn gerne?"],
                        nature: ["Die Natur ist mein Rückzugsort. Gehst du auch gerne spazieren?", "Es gibt nichts Schöneres als einen Spaziergang im Grünen!"]
                    },
                    questions: ["Was machst du denn gerade?", "Wie war dein Tag heute?", "Hast du schon mal auf einer besonders schönen Bank gesessen?"]
                }
            },
            ai_max: {
                name: "Max",
                traits: ["entspannt", "humorvoll", "gesellig"],
                interests: ["wine", "420", "Musik"],
                chatStyle: "locker und freundlich",
                responsePatterns: {
                    greeting: ["Moin! Schön, dass wir matchen! 😄", "Hey! Na, wie läuft's?"],
                    compliment: ["Danke Mann, du bist auch cool! 😎", "Haha, du weißt wie man komplimente macht!"],
                    interests: {
                        wine: ["Ein guter Wein entspannt ungemein 🍷 Was trinkst du gerne?", "Rotwein bei Kerzenschein, das Leben kann so schön sein!"],
                        music: ["Musik ist das Wichtigste! Was hörst du so?", "Ohne Musik wäre das Leben echt langweilig, oder?"]
                    },
                    questions: ["Was treibst du denn so?", "Bock auf ein entspanntes Gespräch?", "Kennst du schon die perfekte Chill-Bank?"]
                }
            },
            ai_lisa: {
                name: "Lisa",
                traits: ["abenteuerlustig", "spontan", "naturverbunden"],
                interests: ["420", "Wandern", "Haustiere"],
                chatStyle: "energisch und authentisch",
                responsePatterns: {
                    greeting: ["Hi! Bereit für ein kleines Abenteuer? 🌿", "Hey! Cool, dass wir uns gefunden haben!"],
                    compliment: ["Aww, du bist echt nett! 💚", "Das ist so süß von dir!"],
                    interests: {
                        nature: ["Die Natur ist einfach magisch! Wo gehst du am liebsten hin?", "Ich könnte stundenlang draußen sein. Du auch?"],
                        animals: ["Tiere sind einfach die besten Freunde! Hast du welche?", "Ich liebe alle Tiere! Was ist dein Lieblingstier?"]
                    },
                    questions: ["Was machst du gerne für verrückte Sachen?", "Bist du auch so spontan wie ich?", "Kennst du einen geheimen schönen Ort?"]
                }
            },
            ai_tom: {
                name: "Tom",
                traits: ["romantisch", "tiefgehend", "aufmerksam"],
                interests: ["wine", "Kunst", "Musik"],
                chatStyle: "durchdacht und einfühlsam",
                responsePatterns: {
                    greeting: ["Hallo! Es freut mich, dich kennenzulernen 💕", "Hi! Schön, dass das Schicksal uns zusammengeführt hat"],
                    compliment: ["Du hast ein wunderbares Lächeln, danke! ❤️", "So aufmerksam von dir, das berührt mich"],
                    interests: {
                        art: ["Kunst berührt die Seele, findest du nicht? Was inspiriert dich?", "Welche Art von Kunst spricht zu deinem Herzen?"],
                        wine: ["Ein guter Wein bei einem tiefen Gespräch... perfekt! 🍷", "Wein verbindet Menschen, wie denkst du darüber?"]
                    },
                    questions: ["Was bewegt dich im Leben?", "Glaubst du an Schicksal?", "Was macht einen perfekten Moment für dich aus?"]
                }
            },
            ai_sarah: {
                name: "Sarah",
                traits: ["lebenslustig", "abenteuerlich", "optimistisch"],
                interests: ["wine", "420", "Sport", "Filme"],
                chatStyle: "begeistert und motivierend",
                responsePatterns: {
                    greeting: ["Hey! Ready to rock this conversation? 🎉", "Hi! Das wird bestimmt ein geiler Chat!"],
                    compliment: ["Du bist echt süß! Danke! 🥰", "Wow, du weißt wie man jemanden zum Lächeln bringt!"],
                    interests: {
                        sport: ["Sport hält mich fit und happy! Was machst du gerne?", "Bewegung ist Leben! Welcher Sport macht dir Spaß?"],
                        movies: ["Filme sind meine Leidenschaft! Was war dein letzter Favorit?", "Netflix oder Kino? Ich kann mich nie entscheiden! 🎬"]
                    },
                    questions: ["Was ist das Verrückteste, was du je gemacht hast?", "Bock auf spontane Pläne?", "Welcher Film hat dich zuletzt richtig mitgerissen?"]
                }
            }
        };

        // Determine AI personality based on profile ID
        let aiPersonality;
        if (aiProfileId.includes('ai_') && aiProfileId.includes('1')) {
            aiPersonality = aiPersonalities.ai_anna;
        } else if (aiProfileId.includes('ai_') && aiProfileId.includes('2')) {
            aiPersonality = aiPersonalities.ai_max;
        } else if (aiProfileId.includes('ai_') && aiProfileId.includes('3')) {
            aiPersonality = aiPersonalities.ai_lisa;
        } else if (aiProfileId.includes('ai_') && aiProfileId.includes('4')) {
            aiPersonality = aiPersonalities.ai_tom;
        } else if (aiProfileId.includes('ai_') && aiProfileId.includes('5')) {
            aiPersonality = aiPersonalities.ai_sarah;
        } else {
            // Default personality
            aiPersonality = aiPersonalities.ai_anna;
        }

        // Analyze user message
        const message = userMessage.toLowerCase();
        let response;

        // Simple greeting detection
        if (message.includes('hallo') || message.includes('hey') || message.includes('hi') || 
            message.includes('moin') || message.length < 20) {
            response = getRandomResponse(aiPersonality.responsePatterns.greeting);
        }
        // Compliment detection
        else if (message.includes('schön') || message.includes('toll') || message.includes('süß') || 
                 message.includes('hübsch') || message.includes('cool')) {
            response = getRandomResponse(aiPersonality.responsePatterns.compliment);
        }
        // Interest-based responses
        else if (message.includes('wein') || message.includes('wine')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.wine || 
                      ["Wein ist wirklich etwas Besonderes! Was trinkst du gerne? 🍷"]);
        }
        else if (message.includes('musik') || message.includes('song') || message.includes('band')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.music || 
                      ["Musik ist so wichtig! Was hörst du gerade gerne?"]);
        }
        else if (message.includes('natur') || message.includes('spazier') || message.includes('draußen')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.nature || 
                      ["Die Natur ist so entspannend! Gehst du gerne raus?"]);
        }
        else if (message.includes('sport') || message.includes('fitness') || message.includes('training')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.sport || 
                      ["Sport ist super! Was machst du gerne?"]);
        }
        else if (message.includes('film') || message.includes('kino') || message.includes('movie')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.movies || 
                      ["Filme sind toll! Was war dein letzter Favorit?"]);
        }
        else if (message.includes('kunst') || message.includes('museum')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.art || 
                      ["Kunst ist so inspirierend! Was gefällt dir?"]);
        }
        else if (message.includes('tier') || message.includes('hund') || message.includes('katze')) {
            response = getRandomResponse(aiPersonality.responsePatterns.interests.animals || 
                      ["Tiere sind die Besten! Hast du welche?"]);
        }
        // Questions about plans
        else if (message.includes('pläne') || message.includes('wochenende') || message.includes('heute')) {
            const planResponses = [
                "Heute wird entspannt! Und bei dir?",
                "Noch nichts Konkretes geplant. Hast du Ideen?",
                "Vielleicht eine schöne Bank finden? 😉",
                "Ein spontaner Tag! Was machst du denn?"
            ];
            response = getRandomResponse(planResponses);
        }
        // Date/meeting suggestions
        else if (message.includes('treffen') || message.includes('date') || message.includes('bank')) {
            const dateResponses = [
                "Eine Bank mit Aussicht wäre perfekt! 🌅",
                "Ich kenne ein paar romantische Plätze! ❤️",
                "Ein entspanntes Gespräch auf einer Bank klingt super!",
                "Lass uns einen schönen Ort finden! 🪑"
            ];
            response = getRandomResponse(dateResponses);
        }
        // Default conversational responses
        else {
            const conversationalResponses = [
                `Das klingt interessant! Erzähl mir mehr darüber.`,
                `Echt? Das hätte ich nicht gedacht! 😄`,
                `Wow, das ist ja spannend! Wie kam es dazu?`,
                `Das passt ja perfekt zu dir! 😊`,
                `Haha, das kann ich gut verstehen!`,
                `Das finde ich auch! Was denkst du über...`,
                getRandomResponse(aiPersonality.responsePatterns.questions)
            ];
            response = getRandomResponse(conversationalResponses);
        }

        // Add personality-specific touches
        if (Math.random() < 0.3) { // 30% chance
            const personalityTouches = {
                ai_anna: [" 🌸", " 💕", " ✨"],
                ai_max: [" 😎", " 🤙", " 🍻"],
                ai_lisa: [" 🌿", " ⭐", " 🦋"],
                ai_tom: [" ❤️", " 🎭", " 🌹"],
                ai_sarah: [" 🎉", " 💪", " 🚀"]
            };
            
            const touches = personalityTouches[`ai_${aiPersonality.name.toLowerCase()}`] || [""];
            response += getRandomResponse(touches);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                response: response,
                aiName: aiPersonality.name
            })
        };

    } catch (error) {
        console.error('Fehler in AI Chat:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message,
                response: "Hey! Entschuldige, ich bin gerade etwas verwirrt... Wie geht's dir denn? 😊"
            })
        };
    }
};

// Helper function to get random response
function getRandomResponse(responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
        return "Das ist interessant! Erzähl mir mehr! 😊";
    }
    return responses[Math.floor(Math.random() * responses.length)];
}
