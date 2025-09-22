// AI Training Function - Analysiert Chat-Verläufe und verbessert AI-Antworten
// Ersetzt train_bot.py durch JavaScript-basiertes Training

const { Pool } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Datenbank-Verbindung
    const pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    console.log('Starte AI-Training...');

    // 1. Chat-Daten analysieren
    const chatAnalysis = await analyzeChatData(pool);
    
    // 2. Erfolgreiche Gesprächsverläufe identifizieren
    const successfulPatterns = await identifySuccessfulPatterns(pool);
    
    // 3. AI-Profile aktualisieren
    const updatedProfiles = await updateAIProfiles(pool, successfulPatterns);
    
    // 4. Training-Statistiken erstellen
    const trainingStats = {
      analyzedMessages: chatAnalysis.totalMessages,
      successfulConversations: successfulPatterns.length,
      updatedProfiles: updatedProfiles.length,
      trainingDate: new Date().toISOString(),
      improvements: chatAnalysis.improvements
    };

    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'AI-Training erfolgreich abgeschlossen!',
        stats: trainingStats
      })
    };

  } catch (error) {
    console.error('Fehler beim AI-Training:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Training fehlgeschlagen'
      })
    };
  }
};

// Chat-Daten analysieren
async function analyzeChatData(pool) {
  try {
    // Gesamtstatistiken
    const totalMessagesQuery = await pool.query('SELECT COUNT(*) as count FROM chat_messages');
    const totalMessages = parseInt(totalMessagesQuery.rows[0].count);

    // Nachrichten nach AI-Profilen gruppieren
    const aiMessagesQuery = await pool.query(`
      SELECT 
        sender_id,
        COUNT(*) as message_count,
        AVG(LENGTH(message_text)) as avg_length,
        MIN(sent_at) as first_message,
        MAX(sent_at) as last_message
      FROM chat_messages 
      WHERE sender_id > 1000 
      GROUP BY sender_id
      ORDER BY message_count DESC
    `);

    const aiStats = aiMessagesQuery.rows;

    // Häufige Wörter und Phrases analysieren
    const frequentPhrases = await analyzeFrequentPhrases(pool);

    // Response-Zeiten analysieren (wenn verfügbar)
    const responsePatterns = await analyzeResponsePatternsFromDB(pool);


    return {
      totalMessages,
      aiStats,
      frequentPhrases,
      responsePatterns,
      improvements: generateImprovementSuggestions(aiStats, frequentPhrases)
    };

  } catch (error) {
    console.error('Fehler bei Chat-Analyse:', error);
    throw error;
  }
}
// ===================
// Generiert AI-Antwort basierend auf gelernten Trainingsdaten
// ===================
async function generateAIResponse(pool, aiId, userMessage) {
  // Profil inkl. Trainingsdaten laden
  const profileQuery = await pool.query('SELECT * FROM ai_profiles WHERE id = $1', [aiId]);
  if (profileQuery.rows.length === 0) return "Hmm, ich weiß gerade nicht, was ich sagen soll.";

  const profile = profileQuery.rows[0];
  const trainingData = profile.training_data || [];

  if (!trainingData.length) {
    // Fallback auf vordefinierte Prompts/Antworten
    return profile.answer_1 || "Hallo! Wie geht's dir?";
  }

  // Ähnlichste Trainings-Eingabe finden
  let bestMatch = null;
  let highestScore = 0;

  for (const item of trainingData) {
    const score = similarity(userMessage, item.input); // einfache Ähnlichkeitsberechnung
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  // Wenn guter Treffer, gib die trainierte Antwort
  if (bestMatch && highestScore > 0.3) {
    return bestMatch.output;
  }

  // Sonst Fallback auf Profil-Prompts
  if (userMessage.length < 20) return profile.answer_2 || "Erzähl mal mehr!";
  return profile.answer_1 || "Interessant, erzähl mir mehr!";
}
// ===================
// Sehr einfache Text-Ähnlichkeit (Overlap von Wörtern)
// ===================
function similarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const common = words1.filter(w => words2.includes(w));
  return common.length / Math.max(words1.length, words2.length);
}

// Häufige Phrases analysieren
async function analyzeFrequentPhrases(pool) {
  try {
    const messagesQuery = await pool.query(`
      SELECT message_text 
      FROM chat_messages 
      WHERE LENGTH(message_text) > 10 AND LENGTH(message_text) < 200
      ORDER BY sent_at DESC 
      LIMIT 1000
    `);

    const messages = messagesQuery.rows;
    const phraseCount = {};

    // Einfache Phrase-Extraktion
    messages.forEach(msg => {
      const text = msg.message_text.toLowerCase();
      const words = text.split(/\s+/);
      
      // 2-3 Wort Kombinationen extrahieren
      for (let i = 0; i < words.length - 1; i++) {
        const phrase2 = `${words[i]} ${words[i + 1]}`;
        phraseCount[phrase2] = (phraseCount[phrase2] || 0) + 1;
        
        if (i < words.length - 2) {
          const phrase3 = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
          phraseCount[phrase3] = (phraseCount[phrase3] || 0) + 1;
        }
      }
    });

    // Top Phrases sortieren
    const sortedPhrases = Object.entries(phraseCount)
      .filter(([phrase, count]) => count > 3 && phrase.length > 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    return sortedPhrases;

  } catch (error) {
    console.error('Fehler bei Phrase-Analyse:', error);
    return [];
  }
}

// Response-Muster analysieren
async function analyzeResponsePatternsFromDB(pool) {
  try {
    // Aufeinanderfolgende Nachrichten analysieren
    const conversationQuery = await pool.query(`
      SELECT 
        cm1.message_text as user_message,
        cm2.message_text as ai_response,
        cm1.match_id,
        cm2.sender_id as ai_id
      FROM chat_messages cm1
      JOIN chat_messages cm2 ON cm1.match_id = cm2.match_id
      WHERE cm2.sent_at > cm1.sent_at
        AND cm2.sent_at - cm1.sent_at < INTERVAL '1 hour'
      ORDER BY cm1.sent_at DESC
      LIMIT 500
    `);

    const pairs = conversationQuery.rows;
    const patterns = {};

    pairs.forEach(pair => {
      const userIntent = classifyUserIntent(pair.user_message);
      const aiResponse = pair.ai_response;
      
      if (!patterns[userIntent]) {
        patterns[userIntent] = [];
      }
      
      patterns[userIntent].push({
        userMsg: pair.user_message,
        aiResponse: aiResponse,
        aiId: pair.ai_id
      });
    });

    return patterns;

  } catch (error) {
    console.error('Fehler bei Response-Pattern-Analyse:', error);
    return {};
  }
}

// User-Intent klassifizieren (vereinfacht)
function classifyUserIntent(message) {
  const lowerMsg = message.toLowerCase();
  
  if (/^(hi|hey|hallo)/.test(lowerMsg)) return 'greeting';
  if (/(schön|süß|nett|toll)/.test(lowerMsg)) return 'compliment';
  if (/(treffen|date|kaffee)/.test(lowerMsg)) return 'meetup_request';
  if (/\?/.test(message)) return 'question';
  if (lowerMsg.length < 20) return 'short_response';
  
  return 'general';
}

// Erfolgreiche Gesprächsmuster identifizieren
async function identifySuccessfulPatterns(pool) {
  try {
    // Gespräche mit vielen Nachrichten = erfolgreich
    const successfulChatsQuery = await pool.query(`
      SELECT 
        match_id,
        COUNT(*) as message_count,
        COUNT(DISTINCT sender_id) as participant_count,
        MAX(sent_at) - MIN(sent_at) as duration,
        ARRAY_AGG(message_text ORDER BY sent_at) as messages
      FROM chat_messages
      GROUP BY match_id
      HAVING COUNT(*) > 5 AND COUNT(DISTINCT sender_id) > 1
      ORDER BY message_count DESC
      LIMIT 20
    `);

    const successfulChats = successfulChatsQuery.rows;
    const patterns = [];

    successfulChats.forEach(chat => {
      const pattern = analyzeSuccessfulChat(chat);
      if (pattern) {
        patterns.push(pattern);
      }
    });

    return patterns;

  } catch (error) {
    console.error('Fehler bei Erfolgs-Pattern-Analyse:', error);
    return [];
  }
}

// Erfolgreichen Chat analysieren
function analyzeSuccessfulChat(chat) {
  try {
    const messages = chat.messages;
    const pattern = {
      matchId: chat.match_id,
      messageCount: chat.message_count,
      duration: chat.duration,
      keyPhrases: [],
      responseStyles: [],
      engagement: 'high'
    };

    // Key Phrases extrahieren
    const allText = messages.join(' ').toLowerCase();
    const commonSuccessWords = [
      'lachen', 'lustig', 'interessant', 'cool', 'toll', 'schön',
      'treffen', 'date', 'whatsapp', 'nummer', 'gerne', 'ja'
    ];

    commonSuccessWords.forEach(word => {
      if (allText.includes(word)) {
        pattern.keyPhrases.push(word);
      }
    });

    return pattern;

  } catch (error) {
    console.error('Fehler bei Chat-Pattern-Analyse:', error);
    return null;
  }
}

// AI-Profile basierend auf Lerndaten aktualisieren
async function updateAIProfiles(pool, successfulPatterns) {
  try {
    const profilesQuery = await pool.query('SELECT * FROM ai_profiles');
    const profiles = profilesQuery.rows;
    const updatedProfiles = [];

    for (const profile of profiles) {
      const updates = {};
      let hasUpdates = false;

      // Erfolgreiche Phrases für dieses Profil sammeln
      const profilePatterns = successfulPatterns.filter(p => 
        p.keyPhrases && p.keyPhrases.length > 0
      );

      if (profilePatterns.length > 0) {
        // Sammle erfolgreiche Key Phrases
        const successfulPhrases = profilePatterns
          .flatMap(p => p.keyPhrases)
          .reduce((acc, phrase) => {
            acc[phrase] = (acc[phrase] || 0) + 1;
            return acc;
          }, {});

        // Top 5 erfolgreiche Phrases
        const topPhrases = Object.entries(successfulPhrases)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([phrase]) => phrase);

        // Interests aktualisieren wenn neue erfolgreiche Themen gefunden
        const currentInterests = profile.interests || [];
        const newInterests = [...new Set([...currentInterests, ...topPhrases])];
        
        if (newInterests.length !== currentInterests.length) {
          updates.interests = newInterests;
          hasUpdates = true;
        }
      }

      // Prompt/Answer Paare basierend auf erfolgreichen Mustern generieren
      if (profilePatterns.length > 0) {
        const bestPattern = profilePatterns[0]; // Bestes Pattern nehmen
        
        if (bestPattern.keyPhrases.includes('treffen') || bestPattern.keyPhrases.includes('date')) {
          updates.prompt_1 = 'Hast du Lust auf ein Date?';
          updates.answer_1 = 'Ja gerne! Ich würde mich freuen dich kennenzulernen 😊';
          hasUpdates = true;
        }
        
        if (bestPattern.keyPhrases.includes('lustig') || bestPattern.keyPhrases.includes('lachen')) {
          updates.prompt_2 = 'Erzählst du mir einen Witz?';
          updates.answer_2 = 'Klar! Was macht ein Keks unter einem Baum? Krümel! 😄';
          hasUpdates = true;
        }
      }

      // Updates in Datenbank schreiben
      if (hasUpdates) {
        const updateFields = Object.keys(updates);
        const updateValues = Object.values(updates);
        const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

        await pool.query(
          `UPDATE ai_profiles SET ${setClause} WHERE id = $${updateFields.length + 1}`,
          [...updateValues, profile.id]
        );

        updatedProfiles.push({
          profileId: profile.id,
          profileName: profile.profile_name,
          updates: updates
        });
      }
    }

    return updatedProfiles;

  } catch (error) {
    console.error('Fehler beim Aktualisieren der AI-Profile:', error);
    return [];
  }
}

// Verbesserungsvorschläge generieren
function generateImprovementSuggestions(aiStats, frequentPhrases) {
  const suggestions = [];

  // AI mit wenig Nachrichten
  aiStats.forEach(stat => {
    if (stat.message_count < 50) {
      suggestions.push({
        type: 'low_activity',
        aiId: stat.sender_id,
        suggestion: 'Mehr Engagement-Training erforderlich',
        priority: 'medium'
      });
    }

    if (stat.avg_length < 20) {
      suggestions.push({
        type: 'short_responses',
        aiId: stat.sender_id,
        suggestion: 'Längere, detailliertere Antworten trainieren',
        priority: 'high'
      });
    }
  });

  // Häufige Phrases nutzen
  if (frequentPhrases.length > 0) {
    suggestions.push({
      type: 'phrase_integration',
      suggestion: `Top Phrases integrieren: ${frequentPhrases.slice(0, 3).map(p => p[0]).join(', ')}`,
      priority: 'low'
    });
  }

  return suggestions;
}

// Training-Daten aus vorhandenen Chats extrahieren
async function extractTrainingData(pool) {
  try {
    // Erfolgreiche Konversationspaare extrahieren
    const trainingPairsQuery = await pool.query(`
      WITH conversation_pairs AS (
        SELECT 
          cm1.message_text as input_message,
          cm2.message_text as response_message,
          cm1.match_id,
          cm2.sender_id as ai_id,
          cm1.sent_at,
          ROW_NUMBER() OVER (PARTITION BY cm1.match_id ORDER BY cm1.sent_at) as msg_order
        FROM chat_messages cm1
        JOIN chat_messages cm2 ON cm1.match_id = cm2.match_id
        WHERE cm2.sent_at > cm1.sent_at
          AND cm2.sent_at - cm1.sent_at < INTERVAL '10 minutes'
      ),
      conversation_stats AS (
        SELECT 
          match_id,
          COUNT(*) as total_messages,
          MAX(sent_at) - MIN(sent_at) as conversation_duration
        FROM chat_messages
        GROUP BY match_id
      )
      SELECT 
        cp.input_message,
        cp.response_message,
        cp.ai_id,
        cs.total_messages,
        cs.conversation_duration
      FROM conversation_pairs cp
      JOIN conversation_stats cs ON cp.match_id = cs.match_id
      WHERE cs.total_messages > 2  -- Nur aus längeren Gesprächen lernen
        AND LENGTH(cp.input_message) > 1
        AND LENGTH(cp.response_message) > 1
      ORDER BY cs.total_messages DESC, cp.sent_at DESC
      LIMIT 500
    `);

    const trainingPairs = trainingPairsQuery.rows;

    // Training-Daten strukturieren
    const structuredData = trainingPairs.map(pair => ({
      input: pair.input_message.trim(),
      output: pair.response_message.trim(),
      aiId: pair.ai_id,
      quality: pair.total_messages > 10 ? 'high' : 'medium',
      context: {
        conversationLength: pair.total_messages,
        duration: pair.conversation_duration
      }
    }));

    return structuredData;

  } catch (error) {
    console.error('Fehler beim Extrahieren der Training-Daten:', error);
    return [];
  }
}

// Vollautomatisches Batch-Training für alle AI-Profile
// Vollautomatisches Batch-Training für alle AI-Profile (parallel)
async function batchTrainAllProfiles(pool) {
  try {
    console.log('Starte automatisches Batch-Training für alle AI-Profile...');

    // 1. Training-Daten aus den Chats extrahieren
    const trainingData = await extractTrainingData(pool);
    console.log(`${trainingData.length} Training-Paare extrahiert`);

    if (!trainingData.length) {
      console.log('Keine Trainingsdaten gefunden, Abbruch.');
      return [];
    }

    // 2. Training-Daten nach AI-ID gruppieren
    const groupedData = trainingData.reduce((acc, item) => {
      if (!acc[item.aiId]) acc[item.aiId] = [];
      acc[item.aiId].push(item);
      return acc;
    }, {});

    // 3. Alle AIs parallel trainieren
    const trainingPromises = Object.entries(groupedData).map(async ([aiId, data]) => {
      try {
        const result = await trainSpecificAI(pool, parseInt(aiId), data);
        console.log(`✅ AI ${aiId} trainiert: ${data.length} Beispiele`);
        return result;
      } catch (error) {
        console.error(`❌ Fehler beim Training von AI ${aiId}:`, error);
        return {
          aiId: parseInt(aiId),
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(trainingPromises);

    console.log('Automatisches Batch-Training abgeschlossen.');
    return results;

  } catch (error) {
    console.error('Fehler beim automatischen Batch-Training:', error);
    throw error;
  }
}

// Spezifische AI trainieren (DB-Updates)
async function trainSpecificAI(pool, aiId, trainingData) {
  try {
    // AI-Profil laden
    const profileQuery = await pool.query('SELECT * FROM ai_profiles WHERE id = $1', [aiId]);
    if (profileQuery.rows.length === 0) {
      throw new Error(`AI-Profil ${aiId} nicht gefunden`);
    }
    const profile = profileQuery.rows[0];

    // Training-Statistiken
    const stats = {
      totalExamples: trainingData.length,
      highQualityExamples: trainingData.filter(d => d.quality === 'high').length,
      avgInputLength: trainingData.reduce((sum, d) => sum + d.input.length, 0) / trainingData.length,
      avgOutputLength: trainingData.reduce((sum, d) => sum + d.output.length, 0) / trainingData.length
    };

    // Muster analysieren
    const inputPatterns = analyzeInputPatterns(trainingData.map(d => d.input));
    const responsePatterns = analyzeResponsePatterns(trainingData.map(d => d.output));

    // DB-Updates vorbereiten
    const updates = generateProfileUpdates(profile, inputPatterns, responsePatterns, stats);

    if (Object.keys(updates).length > 0) {
      const updateFields = Object.keys(updates);
      const updateValues = Object.values(updates);
      const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

      await pool.query(
        `UPDATE ai_profiles SET ${setClause} WHERE id = $${updateFields.length + 1}`,
        [...updateValues, aiId]
      );

      console.log(`Profil ${profile.profile_name} erfolgreich aktualisiert:`, updates);
    }

    return {
      aiId,
      profileName: profile.profile_name,
      success: true,
      stats,
      updates,
      patternsLearned: {
        inputPatterns: inputPatterns.slice(0, 5),
        responsePatterns: responsePatterns.slice(0, 5)
      }
    };

  } catch (error) {
    console.error(`Fehler beim Training von AI ${aiId}:`, error);
    throw error;
  }
}

// Input-Patterns analysieren
function analyzeInputPatterns(inputs) {
  const patterns = {};
  
  inputs.forEach(input => {
    const lowerInput = input.toLowerCase();
    
    // Greetings
    if (/^(hi|hey|hallo|moin)/.test(lowerInput)) {
      patterns['greeting'] = (patterns['greeting'] || 0) + 1;
    }
    // Questions
    else if (/\?$/.test(input) || /^(wie|was|wo|wann|warum)/.test(lowerInput)) {
      patterns['question'] = (patterns['question'] || 0) + 1;
    }
    // Compliments
    else if (/(schön|süß|nett|toll|cool)/.test(lowerInput)) {
      patterns['compliment'] = (patterns['compliment'] || 0) + 1;
    }
    // Date requests
    else if (/(treffen|date|kaffee|zeit|lust)/.test(lowerInput)) {
      patterns['date_request'] = (patterns['date_request'] || 0) + 1;
    }
    // Short responses
    else if (input.length < 15) {
      patterns['short'] = (patterns['short'] || 0) + 1;
    }
    // General
    else {
      patterns['general'] = (patterns['general'] || 0) + 1;
    }
  });

  // Als sortierte Liste zurückgeben
  return Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern, count, frequency: count / inputs.length }));
}

// Response-Patterns analysieren  
function analyzeResponsePatterns(outputs) {
  const patterns = {};
  
  outputs.forEach(output => {
    const lowerOutput = output.toLowerCase();
    
    // Enthusiastic (with emojis)
    if (/[😊😄😉😍🥰]/.test(output)) {
      patterns['enthusiastic'] = (patterns['enthusiastic'] || 0) + 1;
    }
    // Question back
    if (/\?$/.test(output)) {
      patterns['counter_question'] = (patterns['counter_question'] || 0) + 1;
    }
    // Agreement
    if (/^(ja|genau|stimmt|klar|gerne)/.test(lowerOutput)) {
      patterns['agreement'] = (patterns['agreement'] || 0) + 1;
    }
    // Playful
    if (/(haha|hihi|lol|witzig)/.test(lowerOutput)) {
      patterns['playful'] = (patterns['playful'] || 0) + 1;
    }
    // Long responses
    if (output.length > 50) {
      patterns['detailed'] = (patterns['detailed'] || 0) + 1;
    }
    // Short responses
    else if (output.length < 20) {
      patterns['concise'] = (patterns['concise'] || 0) + 1;
    }
  });

  return Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern, count, frequency: count / outputs.length }));
}

// Profile-Updates basierend auf gelernten Patterns generieren
function generateProfileUpdates(profile, inputPatterns, responsePatterns, stats) {
  const updates = {};

  // Description erweitern basierend auf Response-Patterns
  if (responsePatterns.find(p => p.pattern === 'enthusiastic' && p.frequency > 0.3)) {
    const currentDesc = profile.description || '';
    if (!currentDesc.includes('begeistert') && !currentDesc.includes('enthusiastisch')) {
      updates.description = currentDesc + (currentDesc ? ' ' : '') + 'Ich bin eine sehr begeisterte und positive Person!';
    }
  }

  // Interests basierend auf erfolgreichen Patterns
  const currentInterests = profile.interests || [];
  const newInterests = [...currentInterests];

  if (inputPatterns.find(p => p.pattern === 'date_request' && p.frequency > 0.2)) {
    if (!newInterests.includes('Dating')) {
      newInterests.push('Dating');
    }
  }

  if (responsePatterns.find(p => p.pattern === 'playful' && p.frequency > 0.25)) {
    if (!newInterests.includes('Humor')) {
      newInterests.push('Humor');
    }
  }

  if (newInterests.length !== currentInterests.length) {
    updates.interests = newInterests;
  }

  // Prompt/Answer Updates basierend auf häufigsten Patterns
  const topInputPattern = inputPatterns[0];
  const topResponsePattern = responsePatterns[0];

  if (topInputPattern && topResponsePattern) {
    // Beispiel-Prompt/Answer generieren
    const prompts = generateExamplePrompts(topInputPattern.pattern, topResponsePattern.pattern);
    
    if (prompts.prompt1) {
      updates.prompt_1 = prompts.prompt1;
      updates.answer_1 = prompts.answer1;
    }
    
    if (prompts.prompt2) {
      updates.prompt_2 = prompts.prompt2;
      updates.answer_2 = prompts.answer2;
    }
  }

  return updates;
}

// Beispiel-Prompts generieren
function generateExamplePrompts(inputPattern, responsePattern) {
  const prompts = {};

  const promptTemplates = {
    greeting: {
      enthusiastic: {
        prompt1: "Hey, wie geht's dir?",
        answer1: "Hey! Mir geht's super, danke! 😊 Wie ist dein Tag?"
      },
      counter_question: {
        prompt1: "Hallo!",
        answer1: "Hallo! Schön dich kennenzulernen! Was machst du denn so?"
      }
    },
    compliment: {
      agreement: {
        prompt1: "Du siehst echt nett aus!",
        answer1: "Aww, das ist lieb von dir! Danke! 😊"
      },
      playful: {
        prompt1: "Du bist hübsch!",
        answer1: "Hihi, du Schmeichler! Du weißt wie man einer Frau schmeichelt 😉"
      }
    },
    date_request: {
      enthusiastic: {
        prompt1: "Hast du Lust auf einen Kaffee?",
        answer1: "Ja gerne! Das würde mich sehr freuen! ☕😊"
      },
      counter_question: {
        prompt1: "Wollen wir uns mal treffen?",
        answer1: "Das klingt schön! Wann hättest du denn Zeit?"
      }
    }
  };

  const template = promptTemplates[inputPattern]?.[responsePattern];
  if (template) {
    return template;
  }

  // Fallback-Prompts
  return {
    prompt1: "Wie war dein Tag?",
    answer1: "Ganz gut, danke! Erzähl du mal von dir!",
    prompt2: "Was machst du gerne?",
    answer2: "Ich mag es neue Leute kennenzulernen und interessante Gespräche zu führen!"
  };
}
