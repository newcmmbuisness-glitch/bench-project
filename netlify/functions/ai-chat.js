// AI Chat Handler mit NLP-Features und PostgreSQL Integration
// Ersetzt ChatterBot durch JavaScript-basierte NLP-Lösung

const { Pool } = require('pg');

// Einfache NLP-Utilities
class SimpleNLP {
  static tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\säöüß]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  static similarity(text1, text2) {
    const tokens1 = new Set(this.tokenize(text1));
    const tokens2 = new Set(this.tokenize(text2));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  static extractKeywords(text) {
    const stopWords = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'der', 'die', 'das', 'und', 'oder', 'aber', 'ist', 'sind', 'war', 'waren', 'bin', 'bist', 'hat', 'haben', 'wird', 'werden', 'von', 'zu', 'mit', 'auf', 'für', 'über', 'unter', 'vor', 'nach', 'bei', 'um', 'an', 'aus', 'ein', 'eine', 'einen', 'einer', 'eines', 'dem', 'den', 'des']);
    
    return this.tokenize(text)
      .filter(token => !stopWords.has(token) && token.length > 2)
      .slice(0, 5); // Top 5 keywords
  }
}

// AI Chat Handler
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
    const body = JSON.parse(event.body || '{}');
    const { aiProfileId, userMessage, userProfile, conversationId } = body;

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

    // Datenbank-Verbindung
    const pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // AI-Profil laden
    const aiProfileQuery = await pool.query(
      'SELECT * FROM ai_profiles WHERE id = $1',
      [aiProfileId]
    );

    if (aiProfileQuery.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'AI-Profil nicht gefunden' 
        })
      };
    }

    const aiProfile = aiProfileQuery.rows[0];

    // Chat-Verlauf laden (letzte 10 Nachrichten für Kontext)
    const chatHistoryQuery = await pool.query(`
      SELECT sender_id, message_text, sent_at
      FROM chat_messages 
      WHERE match_id = $1 
      ORDER BY sent_at DESC 
      LIMIT 10
    `, [conversationId || 0]);

    const chatHistory = chatHistoryQuery.rows.reverse();

    // Vollautomatisch basierend auf Training-Daten
    const response = await generateAIResponse(pool, aiProfileId, userMessage);


    // Nachricht in Datenbank speichern
    if (conversationId) {
      // User-Nachricht speichern
      await pool.query(`
        INSERT INTO chat_messages (match_id, sender_id, message_text)
        VALUES ($1, $2, $3)
      `, [conversationId, userProfile?.id || 0, userMessage]);

      // AI-Antwort speichern
      await pool.query(`
        INSERT INTO chat_messages (match_id, sender_id, message_text)
        VALUES ($1, $2, $3)
      `, [conversationId, 0, response]);
    }

    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: response,
        aiName: aiProfile.profile_name,
        meta: {
          aiAge: aiProfile.age,
          aiGender: aiProfile.gender,
          confidence: 0.85
        }
      })
    };

  } catch (error) {
    console.error('Fehler in AI Chat:', error);
    
    // Fallback auf regel-basierte Antwort
    const fallbackResponse = generateFallbackResponse();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: fallbackResponse,
        aiName: 'Assistant',
        meta: {
          fallback: true,
          error: error.message
        }
      })
    };
  }
};
async function generateAIResponse(pool, aiId, userMessage) {
  const trimmedMsg = userMessage.trim().toLowerCase().replace(/[!?.]/g, '');

  // Trainingsdaten korrekt laden
  let trainingData = [];
  
  if (aiId > 0) {
    // AI-spezifische Trainingsdaten
    const profileQuery = await pool.query(
      'SELECT training_data FROM ai_profiles WHERE id = $1',
      [aiId]
    );
    if (profileQuery.rows.length > 0) {
      try {
        trainingData = trainingData = profileQuery.rows[0].training_data || [];

      } catch (e) {
        console.error("❌ Training-Data JSON fehlerhaft:", e);
        trainingData = [];
      }
    }
  } else {
    // KORRIGIERT: User-zu-User Paare richtig extrahieren
    const userPairsQuery = await pool.query(`
      SELECT 
        cm1.message_text AS input, 
        cm2.message_text AS output,
        cm1.sender_id AS sender1,
        cm2.sender_id AS sender2
      FROM chat_messages cm1
      JOIN chat_messages cm2 ON cm1.match_id = cm2.match_id
      WHERE cm2.sent_at > cm1.sent_at
        AND cm2.sent_at - cm1.sent_at < INTERVAL '30 minutes'
        AND LENGTH(cm1.message_text) > 1
        AND LENGTH(cm2.message_text) > 1
        AND cm1.sender_id != cm2.sender_id  -- WICHTIG: Verschiedene Sender
        AND cm1.sender_id != 0              -- User 1 ist kein AI
        AND cm2.sender_id != 0              -- User 2 ist kein AI (oder = 0 für AI)
      ORDER BY cm1.sent_at DESC
      LIMIT 500
    `);
    
    trainingData = userPairsQuery.rows.map(row => ({
      input: row.input,
      output: row.output
    }));
  }

  // Filtere ungültige Paare heraus (identische oder zu ähnliche)
  trainingData = trainingData.filter(item => {
    if (!item.input || !item.output) return false;
    
    const inputClean = item.input.toLowerCase().trim();
    const outputClean = item.output.toLowerCase().trim();
    
    // Verhindere identische Paare
    if (inputClean === outputClean) return false;
    
    // Verhindere zu ähnliche Paare (Echo)
    const sim = similarity(inputClean, outputClean);
    if (inputClean.length > 3 && sim > 0.95) return false;
    
    // Verhindere zu kurze Antworten
    if (item.output.length < 2) return false;
    
    return true;
  });

  console.info("👉 Gültige Trainingsdaten nach Filterung:", trainingData.length);
  console.info("👉 Beispiele:", trainingData.slice(0, 3));
  console.info("👉 Suche nach:", trimmedMsg);

  // Exact Match
  for (const item of trainingData) {
    const dbInput = item.input.toLowerCase().trim().replace(/[!?.]/g, '');
    if (dbInput === trimmedMsg) {
      console.info("✅ Direktes Match gefunden:", item);
      return addVariation(item.output);
    }
  }

  // Fuzzy Match
  let bestMatch = null;
  let highestScore = 0;
  for (const item of trainingData) {
    const score = similarity(userMessage, item.input);

    // Dynamische Schwelle: kurze Texte = niedrigere Grenze
    const minScore = userMessage.length <= 3 ? 0.1 : 0.3;

    if (score > highestScore && score > minScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore > 0.2) {
    console.info("✅ Unscharfes Match gefunden:", bestMatch, "Score:", highestScore);
    return addVariation(bestMatch.output);
  }


  console.info("⚠️ Kein Match → Fallback");
  return generateFallbackResponse();
}
// ===================
// Variation einbauen
// ===================
function addVariation(text) {
  let newText = text;

  // zufällige Emoji-Ergänzung
  const emojis = ['😊','😄','😉','🙂','😎'];
  if (Math.random() < 0.3) newText += ` ${emojis[Math.floor(Math.random()*emojis.length)]}`;

  // kleine Synonym-Ersetzungen (optional erweitern)
  newText = newText.replace(/\b(hallo|hi|hey)\b/gi, 'Hey');

  // Kürze lange Sätze leicht ab oder baue Frage ein
  if (newText.length > 80 && Math.random() < 0.5) {
    newText = newText.split(/[,.]/)[0] + '?';
  }

  return newText;
}

const { distance: levenshtein } = require("fastest-levenshtein");
const natural = require("natural");

function similarity(text1, text2) {
  const a = text1.toLowerCase().trim();
  const b = text2.toLowerCase().trim();

  if (!a || !b) return 0;
  if (a === b) return 1;

  // Levenshtein-Ähnlichkeit
  const levDist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const levScore = 1 - levDist / maxLen; // 1 = identisch, 0 = komplett verschieden

  // Jaro-Winkler für kurze Wörter ("hi", "hey", "hallo")
  const jwScore = natural.JaroWinklerDistance(a, b);

  // Cosine Similarity (Bag of Words)
  const tokenizer = new natural.WordTokenizer();
  const tokensA = tokenizer.tokenize(a);
  const tokensB = tokenizer.tokenize(b);

  const tfidf = new natural.TfIdf();
  tfidf.addDocument(tokensA.join(" "));
  tfidf.addDocument(tokensB.join(" "));

  let cosineScore = 0;
  try {
    cosineScore = natural.CosineSimilarity(tokensA, tokensB) || 0;
  } catch {
    cosineScore = 0;
  }

  // Finale Ähnlichkeit = Max aus allen drei
  return Math.max(levScore, jwScore, cosineScore);
}



// Intelligente Response-Generierung
async function generateIntelligentResponse(userMessage, aiProfile, chatHistory, pool) {
  try {
    // 1. Ähnliche Nachrichten aus der Datenbank finden
    const similarMessages = await findSimilarMessages(userMessage, pool);
    
    // 2. Intent-Erkennung
    const intent = detectIntent(userMessage);
    
    // 3. Kontext aus Chat-Historie analysieren
    const context = analyzeContext(chatHistory);
    
    // 4. Personalisierte Antwort basierend auf AI-Profil
    const personalizedResponse = await generatePersonalizedResponse(
      userMessage,
      aiProfile,
      intent,
      context,
      similarMessages
    );

    return personalizedResponse;

  } catch (error) {
    console.error('Fehler bei intelligenter Response-Generierung:', error);
    return generateContextualFallback(userMessage, aiProfile);
  }
}

// Ähnliche Nachrichten in DB finden
async function findSimilarMessages(userMessage, pool) {
  try {
    // Alle bisherigen Nachrichten laden
    const allMessagesQuery = await pool.query(`
      SELECT message_text, sender_id 
      FROM chat_messages 
      WHERE LENGTH(message_text) > 10 
      ORDER BY sent_at DESC 
      LIMIT 200
    `);

    const messages = allMessagesQuery.rows;
    const similarities = messages.map(msg => ({
      text: msg.message_text,
      similarity: SimpleNLP.similarity(userMessage, msg.message_text),
      isAI: msg.sender_id > 1000 // AI-Profile haben höhere IDs
    }))
    .filter(item => item.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

    return similarities;
  } catch (error) {
    console.error('Fehler beim Finden ähnlicher Nachrichten:', error);
    return [];
  }
}

// Intent-Erkennung erweitert
function detectIntent(message) {
  const lowerMsg = message.toLowerCase();
  
  const intents = {
    greeting: /^(hi|hey|hallo|moin|servus|guten|tach)\b/,
    compliment: /(schön|süß|hübsch|nett|toll|cool|sympathisch|attraktiv)/,
    date_request: /(treffen|date|kaffee|spazieren|whatsapp|nummer|telefon)/,
    personal_question: /\b(wie|was|warum|wieso|erzähl|magst|liebst|machst)\b.*\?/,
    flirting: /(flirt|süß|sexy|heiß|scharf|verführ)/,
    interests: /(hobby|interesse|musik|sport|film|buch|reisen)/,
    goodbye: /\b(tschüss|bye|ciao|bis|mach's gut)\b/,
    agreement: /\b(ja|genau|stimmt|richtig|okay|klar)\b/,
    disagreement: /\b(nein|ne|nö|nicht|falsch)\b/,
    humor: /(haha|lol|witzig|lustig|lach|😂|😄|😊)/
  };

  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(lowerMsg)) {
      return intent;
    }
  }

  // Fallback basierend auf Satzzeichen und Länge
  if (lowerMsg.includes('?')) return 'question';
  if (lowerMsg.length < 10) return 'short_message';
  
  return 'general';
}

// Kontext aus Chat-Historie analysieren
function analyzeContext(chatHistory) {
  const context = {
    messageCount: chatHistory.length,
    recentTopics: [],
    conversationMood: 'neutral',
    userEngagement: 'medium'
  };

  if (chatHistory.length === 0) {
    context.conversationMood = 'fresh';
    return context;
  }

  // Letzte Nachrichten analysieren
  const recentMessages = chatHistory.slice(-5);
  const allText = recentMessages.map(msg => msg.message_text).join(' ');
  
  // Topics extrahieren
  context.recentTopics = SimpleNLP.extractKeywords(allText);
  
  // Mood bestimmen
  if (/\b(toll|super|schön|cool|nice|gut)\b/i.test(allText)) {
    context.conversationMood = 'positive';
  } else if (/\b(schlecht|blöd|nervig|langweilig)\b/i.test(allText)) {
    context.conversationMood = 'negative';
  }

  // Engagement Level
  const avgLength = recentMessages.reduce((sum, msg) => sum + msg.message_text.length, 0) / recentMessages.length;
  context.userEngagement = avgLength > 30 ? 'high' : avgLength > 10 ? 'medium' : 'low';

  return context;
}

// Personalisierte Antwort generieren
async function generatePersonalizedResponse(userMessage, aiProfile, intent, context, similarMessages) {
  const personality = createPersonalityFromProfile(aiProfile);
  
  // Response-Template basierend auf Intent
  let responseTemplate = getResponseTemplate(intent, personality, context);
  
  // Mit ähnlichen Nachrichten anreichern
  if (similarMessages.length > 0) {
    const bestMatch = similarMessages[0];
    if (bestMatch.similarity > 0.7 && bestMatch.isAI) {
      // Ähnliche AI-Antwort als Basis verwenden, aber variieren
      responseTemplate = varyResponse(bestMatch.text, personality);
    }
  }

  // Personalisierung einbauen
  responseTemplate = personalizeResponse(responseTemplate, aiProfile, context);
  
  return responseTemplate;
}

// Persönlichkeit aus AI-Profil erstellen
function createPersonalityFromProfile(aiProfile) {
  const personality = {
    age: aiProfile.age,
    gender: aiProfile.gender,
    interests: aiProfile.interests || [],
    style: 'friendly'
  };

  // Stil basierend auf Alter
  if (aiProfile.age < 25) {
    personality.style = 'casual';
    personality.emojis = true;
  } else if (aiProfile.age > 35) {
    personality.style = 'mature';
    personality.emojis = false;
  }

  // Stil basierend auf Description
  const desc = (aiProfile.description || '').toLowerCase();
  if (desc.includes('sportlich') || desc.includes('aktiv')) {
    personality.traits = [...(personality.traits || []), 'active'];
  }
  if (desc.includes('romantisch') || desc.includes('liebe')) {
    personality.traits = [...(personality.traits || []), 'romantic'];
  }

  return personality;
}

// Response-Template basierend auf Intent
function getResponseTemplate(intent, personality, context) {
  const templates = {
    greeting: [
      "Hey! Wie geht's dir denn?",
      "Hi! Schön von dir zu hören!",
      "Hallo! Was machst du gerade?",
      "Hey du! Wie war dein Tag?"
    ],
    compliment: [
      "Aww, danke! Du bist auch sehr nett 😊",
      "Das ist lieb von dir! Danke!",
      "Hihi, du Charmeur! Danke dir ☺️",
      "Oh wow, danke! Du machst mich verlegen"
    ],
    date_request: [
      "Das klingt schön! Wann hättest du denn Zeit?",
      "Gerne! Wo könnten wir uns treffen?",
      "Das wäre toll! Hast du schon eine Idee?",
      "Ja, warum nicht! Was stellst du dir vor?"
    ],
    personal_question: [
      "Das ist eine interessante Frage! ",
      "Gute Frage! ",
      "Hmm, lass mich überlegen... ",
      "Das fragst du mich öfter 😊 "
    ],
    flirting: [
      "Du weißt, wie man eine Frau zum Lächeln bringt 😉",
      "Oho, jemand ist heute charmant!",
      "Du bist schon ein Schmeichler, oder? 😏",
      "Hihi, du bist schon frech!"
    ]
  };

  const options = templates[intent] || [
    "Das ist interessant! Erzähl mir mehr davon.",
    "Ach so! Wie siehst du das denn?",
    "Verstehe! Was denkst du darüber?",
    "Interessant! Und was ist deine Meinung dazu?"
  ];

  return options[Math.floor(Math.random() * options.length)];
}

// Response personalisieren
function personalizeResponse(response, aiProfile, context) {
  // Alter-spezifische Anpassungen
  if (aiProfile.age < 25) {
    response = addYouthfulElements(response);
  }
  
  // Mood-basierte Anpassungen
  if (context.conversationMood === 'positive') {
    response = addPositiveElements(response);
  }

  // Interesse-basierte Ergänzungen
  if (aiProfile.interests && aiProfile.interests.length > 0) {
    response = maybeAddInterestReference(response, aiProfile.interests);
  }

  return response;
}

// Hilfsfunktionen für Personalisierung
function addYouthfulElements(response) {
  const youthfulWords = ['echt', 'total', 'mega', 'voll'];
  const randomWord = youthfulWords[Math.floor(Math.random() * youthfulWords.length)];
  
  if (Math.random() < 0.3) {
    response = response.replace(/sehr/, randomWord);
  }
  
  return response;
}

function addPositiveElements(response) {
  const positiveEmojis = ['😊', '😄', '🙂', '😉'];
  if (Math.random() < 0.4 && !response.includes('😊')) {
    const emoji = positiveEmojis[Math.floor(Math.random() * positiveEmojis.length)];
    response += ` ${emoji}`;
  }
  return response;
}

function maybeAddInterestReference(response, interests) {
  if (Math.random() < 0.2) {
    const interest = interests[Math.floor(Math.random() * interests.length)];
    response += ` Ich mag übrigens ${interest}!`;
  }
  return response;
}

// Response variieren um Wiederholungen zu vermeiden
function varyResponse(originalResponse, personality) {
  const variations = [
    (text) => text.replace(/!/g, '.'),
    (text) => text.replace(/\?/g, '?'),
    (text) => text.replace(/^(Ja|Nein)/, (match) => 
      match === 'Ja' ? 'Genau' : 'Nö'
    ),
    (text) => personality.style === 'casual' ? 
      text.replace(/Das ist/, 'Das ist echt') : text
  ];

  const variation = variations[Math.floor(Math.random() * variations.length)];
  return variation(originalResponse);
}

// Kontextueller Fallback
function generateContextualFallback(userMessage, aiProfile) {
  const fallbacks = [
    `Entschuldige, ${aiProfile.profile_name} ist gerade etwas durcheinander 😅 Kannst du das nochmal anders formulieren?`,
    "Hmm, das verstehe ich nicht ganz. Magst du mir das anders erklären?",
    "Sorry, ich bin gerade etwas verwirrt. Worum geht es genau?",
    "Ups, da bin ich nicht ganz mitgekommen. Kannst du das präzisieren?"
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// Einfacher Regel-basierter Fallback
function generateFallbackResponse() {
  const fallbacks = [
    "Hey! Entschuldige, ich bin gerade etwas durcheinander. Erzähl mir nochmal, worum es geht? 😊",
    "Hi! Sorry, ich hab nicht ganz verstanden. Kannst du das anders formulieren?",
    "Hallo! Entschuldige die Verwirrung. Was wolltest du mir sagen?",
    "Hey du! Ich bin gerade etwas verwirrt. Hilfst du mir auf die Sprünge? 😅"
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
