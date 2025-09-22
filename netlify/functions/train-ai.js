// AI Training Function - VERBESSERT für echtes Lernen
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
    const pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    console.log('🚀 Starte ECHTES AI-Training aus User-Chats...');

    // 1. Echte User-zu-User Konversationspaare aus deiner DB extrahieren
    const userChatPairs = await extractUserChatPairs(pool);
    console.log(`📚 ${userChatPairs.length} User-Chat-Paare gefunden`);

    // 2. Alle AI-Profile mit diesen echten Daten trainieren  
    const trainedProfiles = await fillAITrainingData(pool, userChatPairs);
    console.log(`🎯 ${trainedProfiles.length} AI-Profile trainiert`);

    // 3. Training-Statistiken
    const trainingStats = {
      analyzedMessages: userChatPairs.length,
      trainedProfiles: trainedProfiles.length,
      trainingDate: new Date().toISOString(),
      success: true
    };

    // Stats speichern
    await pool.query(
      `INSERT INTO training_stats 
         (ai_profile_id, training_date, messages_analyzed, patterns_learned, improvements) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        null,
        trainingStats.trainingDate,
        trainingStats.analyzedMessages,
        JSON.stringify({ trainedProfiles: trainingStats.trainedProfiles }),
        JSON.stringify(userChatPairs.slice(0, 10))
      ]
    );

    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `🎉 Training abgeschlossen! ${trainedProfiles.length} AIs haben aus ${userChatPairs.length} User-Gesprächen gelernt.`,
        stats: trainingStats,
        examples: userChatPairs.slice(0, 5).map(p => `"${p.input}" → "${p.output}"`),
        trainedProfiles: trainedProfiles
      })
    };

  } catch (error) {
    console.error('❌ Training-Fehler:', error);
    
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

// ============================================================================
// ECHTE User-zu-User Chat-Paare aus deiner DB extrahieren
// ============================================================================
async function extractUserChatPairs(pool) {
  try {
    console.log('📖 Extrahiere User-zu-User Konversationspaare...');

    // Deine echten User-Gespräche aus der DB holen
    const userChatQuery = await pool.query(`
      SELECT 
        cm1.message_text as input,
        cm2.message_text as output,
        cm1.match_id,
        cm1.sent_at
      FROM chat_messages cm1
      JOIN chat_messages cm2 ON cm1.match_id = cm2.match_id
      JOIN matches m ON cm1.match_id = m.id
      WHERE cm2.sent_at > cm1.sent_at
        AND cm2.sent_at - cm1.sent_at < INTERVAL '2 hours'
        AND cm1.sender_id != cm2.sender_id
        AND cm1.sender_id > 0 AND cm2.sender_id > 0    -- Nur echte User, keine AI
        AND cm1.is_ai = false AND cm2.is_ai = false
        AND LENGTH(cm1.message_text) > 0
        AND LENGTH(cm2.message_text) > 0
        AND LENGTH(cm1.message_text) < 200
        AND LENGTH(cm2.message_text) < 200
      ORDER BY cm1.sent_at DESC
      LIMIT 500
    `);

    const chatPairs = userChatQuery.rows.map(row => ({
      input: row.input.trim(),
      output: row.output.trim(),
      matchId: row.match_id,
      quality: 'user_to_user'
    }));

    console.log(`✅ ${chatPairs.length} User-Chat-Paare extrahiert`);
    
    // Debug: Zeige ein paar Beispiele
    chatPairs.slice(0, 3).forEach(pair => {
      console.log(`📝 "${pair.input}" → "${pair.output}"`);
    });

    return chatPairs;

  } catch (error) {
    console.error('❌ Fehler beim Extrahieren der User-Chat-Paare:', error);
    return [];
  }
}

// ============================================================================
// AI-Profile mit echten Trainingsdaten füllen (DAS FEHLT!)
// ============================================================================
async function fillAITrainingData(pool, userChatPairs) {
  try {
    console.log('🤖 Fülle AI-Profile mit Trainingsdaten...');

    // Alle AI-Profile laden
    const profilesQuery = await pool.query('SELECT id, profile_name FROM ai_profiles ORDER BY id');
    const profiles = profilesQuery.rows;
    
    const trainedProfiles = [];

    for (const profile of profiles) {
      console.log(`🎯 Trainiere AI: ${profile.profile_name}`);

      // Trainingsdaten für diese AI vorbereiten
      const aiTrainingData = prepareTrainingForAI(userChatPairs, profile);

      if (aiTrainingData.length > 0) {
        // ⭐ WICHTIG: training_data Spalte mit JSON befüllen
        await pool.query(
          `UPDATE ai_profiles 
           SET training_data = $1::jsonb,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify(aiTrainingData),
            profile.id
          ]
        );

        trainedProfiles.push({
          profileId: profile.id,
          profileName: profile.profile_name,
          trainingCount: aiTrainingData.length
        });

        console.log(`✅ ${profile.profile_name}: ${aiTrainingData.length} Trainingsdaten hinzugefügt`);
      }
    }

    return trainedProfiles;

  } catch (error) {
    console.error('❌ Fehler beim Füllen der AI-Trainingsdaten:', error);
    return [];
  }
}

// ============================================================================
// Trainingsdaten für spezifische AI aufbereiten
// ============================================================================
function prepareTrainingForAI(userChatPairs, profile) {
  console.log(`📋 Bereite Trainingsdaten für ${profile.profile_name} auf...`);

  // Alle User-Paare als Basis
  let trainingData = userChatPairs.map(pair => ({
    input: pair.input,
    output: pair.output
  }));

  // Spezielle Verbesserungen für häufige Muster
  const improvedData = [];

  // Hey-Pattern verstärken (dein Problem!)
  const heyInputs = trainingData.filter(d => 
    /^(hey|hi|hallo)$/i.test(d.input.trim())
  );
  
  if (heyInputs.length > 0) {
    // Die besten "Hey"-Antworten mehrfach hinzufügen
    heyInputs.forEach(hey => {
      improvedData.push(hey);
      // Variationen hinzufügen
      if (hey.output.length > 5) {
        improvedData.push({
          input: "hey",
          output: hey.output
        });
        improvedData.push({
          input: "Hi", 
          output: hey.output
        });
      }
    });
  }

  // Fallback für "Hey" wenn keine User-Daten vorhanden
  if (heyInputs.length === 0) {
    improvedData.push(
      { input: "hey", output: "Hey! Wie geht's dir? Was machst du so?" },
      { input: "Hey", output: "Hallo! Schön von dir zu hören! Erzähl mal!" },
      { input: "hi", output: "Hi! Freut mich dich kennenzulernen!" }
    );
  }

  // Kombiniere originale + verbesserte Daten
  const finalData = [...trainingData, ...improvedData];

  // Maximal 150 Trainingsdaten pro AI (Performance)
  return finalData.slice(0, 150);
}

// ============================================================================
// Spezifisches Training für "Hey" Pattern
// ============================================================================
async function learnHeyPatterns(pool) {
  try {
    console.log('👋 Lerne "Hey"-Antwortmuster...');

    // Alle "Hey" Nachrichten und deren Antworten finden
    const heyPatternsQuery = await pool.query(`
      SELECT 
        cm1.message_text as hey_input,
        cm2.message_text as response,
        cm1.match_id,
        cm2.sender_id
      FROM chat_messages cm1
      JOIN chat_messages cm2 ON cm1.match_id = cm2.match_id
      JOIN matches m ON cm1.match_id = m.id
      WHERE LOWER(cm1.message_text) SIMILAR TO '%(hey|hi|hallo)%'
        AND cm2.sent_at > cm1.sent_at
        AND cm2.sent_at - cm1.sent_at < INTERVAL '1 hour'
        AND cm1.sender_id != cm2.sender_id
        AND cm1.is_ai = false AND cm2.is_ai = false  -- Nur echte User-Antworten
        AND LENGTH(cm2.message_text) > 2
      ORDER BY cm1.sent_at DESC
      LIMIT 100
    `);

    const heyPatterns = heyPatternsQuery.rows.map(row => ({
      input: row.hey_input.trim(),
      output: row.response.trim(),
      pattern_type: 'greeting_response'
    }));

    // Die besten "Hey"-Antworten identifizieren
    const goodHeyResponses = heyPatterns
      .filter(p => 
        p.output.length > 5 && 
        p.output.length < 100 &&
        !p.output.toLowerCase().includes('fallback')
      )
      .slice(0, 20);

    console.log(`✅ ${goodHeyResponses.length} gute "Hey"-Antworten gefunden`);
    return goodHeyResponses;

  } catch (error) {
    console.error('❌ Fehler beim Lernen der Hey-Pattern:', error);
    return [];
  }
}

// ============================================================================
// Alle AI-Profile mit echten Trainingsdaten trainieren
// ============================================================================
async function trainAllAIProfiles(pool, trainingData) {
  try {
    console.log('🎯 Trainiere alle AI-Profile...');

    // Alle AI-Profile laden
    const profilesQuery = await pool.query('SELECT * FROM ai_profiles ORDER BY id');
    const profiles = profilesQuery.rows;
    
    const trainedProfiles = [];

    for (const profile of profiles) {
      console.log(`🤖 Trainiere Profil: ${profile.profile_name}`);

      // Training-Daten für dieses Profil aufbereiten
      const profileTrainingData = prepareTrainingDataForProfile(profile, trainingData);

      if (profileTrainingData.length > 0) {
        // ⭐ WICHTIG: training_data Spalte richtig füllen!
        await pool.query(
          `UPDATE ai_profiles 
           SET training_data = $1::jsonb,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify(profileTrainingData),
            profile.id
          ]
        );

        // Zusätzliche Verbesserungen am Profil
        const improvements = generateProfileImprovements(profile, profileTrainingData);
        
        if (Object.keys(improvements).length > 0) {
          const updateFields = Object.keys(improvements);
          const updateValues = Object.values(improvements);
          const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

          await pool.query(
            `UPDATE ai_profiles SET ${setClause} WHERE id = $${updateFields.length + 1}`,
            [...updateValues, profile.id]
          );
        }

        trainedProfiles.push({
          profileId: profile.id,
          profileName: profile.profile_name,
          trainingDataCount: profileTrainingData.length,
          improvements: improvements
        });

        console.log(`✅ ${profile.profile_name}: ${profileTrainingData.length} Trainingsdaten hinzugefügt`);
      }
    }

    return trainedProfiles;

  } catch (error) {
    console.error('❌ Fehler beim Training der Profile:', error);
    return [];
  }
}

// ============================================================================
// Trainingsdaten für spezifisches Profil aufbereiten
// ============================================================================
function prepareTrainingDataForProfile(profile, globalTrainingData) {
  console.log(`📋 Bereite Trainingsdaten für ${profile.profile_name} auf...`);

  // Basis-Trainingsdaten (alle guten Gespräche)
  let profileData = globalTrainingData.filter(data => 
    data.quality === 'real_user' && 
    data.input.length > 2 && 
    data.output.length > 2
  );

  // Spezielle "Hey"-Antworten hinzufügen
  const heyResponses = [
    { input: "hey", output: "Hey! Wie geht's dir denn? 😊" },
    { input: "Hey", output: "Hallo! Schön von dir zu hören! Was machst du so?" },
    { input: "hi", output: "Hi! Freut mich dich kennenzulernen! Erzähl mal von dir 😄" },
    { input: "hallo", output: "Hallo! Wie ist dein Tag bisher gelaufen?" },
    { input: "Hey was geht?", output: "Hey! Bei mir läuft's gut! Und bei dir? Was treibst du so?" }
  ];

  profileData = [...profileData, ...heyResponses];

  // Profil-spezifische Anpassungen basierend auf Interessen
  if (profile.interests) {
    const interests = Array.isArray(profile.interests) ? profile.interests : [];
    
    // Interessens-basierte Antworten hinzufügen
    if (interests.includes('Sport')) {
      profileData.push(
        { input: "Was machst du gerne?", output: "Ich liebe Sport! Gehst du auch gerne ins Fitnessstudio?" },
        { input: "hey", output: "Hey Sportsfreund! 💪 Warst du heute schon aktiv?" }
      );
    }
    
    if (interests.includes('Reisen')) {
      profileData.push(
        { input: "Was machst du so?", output: "Ich liebe es zu reisen! Warst du schon mal im Ausland?" },
        { input: "hey", output: "Hey! Ich träume gerade vom nächsten Urlaub ✈️ Du auch?" }
      );
    }
  }

  // Maximal 200 Trainingsdaten pro Profil (Performance)
  return profileData.slice(0, 200);
}

// ============================================================================
// Profil-Verbesserungen basierend auf Trainingsdaten generieren
// ============================================================================
function generateProfileImprovements(profile, trainingData) {
  const improvements = {};

  // Häufige Input-Pattern analysieren
  const inputPatterns = analyzeInputPatterns(trainingData.map(d => d.input));
  const outputPatterns = analyzeOutputPatterns(trainingData.map(d => d.output));

  // Greetings verbessern
  const greetingData = trainingData.filter(d => 
    /^(hey|hi|hallo)/i.test(d.input)
  );

  if (greetingData.length > 0 && (!profile.prompt_1 || profile.prompt_1.includes('fallback'))) {
    const bestGreeting = greetingData.find(d => 
      d.output.length > 10 && d.output.length < 80
    );
    
    if (bestGreeting) {
      improvements.prompt_1 = bestGreeting.input;
      improvements.answer_1 = bestGreeting.output;
    }
  }

  // Fragen verbessern
  const questionData = trainingData.filter(d => d.input.includes('?'));
  if (questionData.length > 0 && (!profile.prompt_2 || profile.prompt_2.includes('fallback'))) {
    const bestQuestion = questionData.find(d => 
      d.output.length > 15 && !d.output.toLowerCase().includes('weiß nicht')
    );
    
    if (bestQuestion) {
      improvements.prompt_2 = bestQuestion.input;
      improvements.answer_2 = bestQuestion.output;
    }
  }

  // Beschreibung erweitern wenn zu kurz
  if (!profile.description || profile.description.length < 50) {
    const communicationStyle = outputPatterns.enthusiastic > 0.3 ? 'sehr gesprächig und positiv' : 'freundlich und aufmerksam';
    improvements.description = `Ich bin eine ${communicationStyle}e Person, die gerne neue Leute kennenlernt und interessante Gespräche führt! 😊`;
  }

  return improvements;
}

// Input-Pattern-Analyse (vereinfacht)
function analyzeInputPatterns(inputs) {
  const patterns = {
    greetings: inputs.filter(i => /^(hey|hi|hallo)/i.test(i)).length,
    questions: inputs.filter(i => i.includes('?')).length,
    short: inputs.filter(i => i.length < 15).length,
    long: inputs.filter(i => i.length > 50).length
  };

  const total = inputs.length || 1;
  return {
    greetings: patterns.greetings / total,
    questions: patterns.questions / total,
    short: patterns.short / total,
    long: patterns.long / total
  };
}

// Output-Pattern-Analyse
function analyzeOutputPatterns(outputs) {
  const patterns = {
    enthusiastic: outputs.filter(o => /[😊😄😉😍🥰💪✈️]/.test(o)).length,
    questions: outputs.filter(o => o.includes('?')).length,
    long: outputs.filter(o => o.length > 50).length
  };

  const total = outputs.length || 1;
  return {
    enthusiastic: patterns.enthusiastic / total,
    questions: patterns.questions / total,
    long: patterns.long / total
  };
}

// ============================================================================
// Verbesserte AI-Response-Generierung (für deine Chat-Function)
// ============================================================================
async function generateImprovedAIResponse(pool, aiId, userMessage) {
  try {
    console.log(`🤖 Generiere Antwort für AI ${aiId} auf: "${userMessage}"`);

    // AI-Profil und Trainingsdaten laden
    const profileQuery = await pool.query(
      'SELECT * FROM ai_profiles WHERE id = $1', 
      [aiId]
    );

    if (profileQuery.rows.length === 0) {
      return "Hey! Ich bin noch am Lernen... Erzähl mir mehr! 😊";
    }

    const profile = profileQuery.rows[0];
    const trainingData = profile.training_data || [];

    console.log(`📚 ${trainingData.length} Trainingsdaten für AI ${profile.profile_name} geladen`);

    // Spezielle "Hey" Behandlung
    if (/^(hey|hi|hallo)$/i.test(userMessage.trim())) {
      const heyResponses = trainingData.filter(d => 
        /^(hey|hi|hallo)/i.test(d.input)
      );
      
      if (heyResponses.length > 0) {
        const randomResponse = heyResponses[Math.floor(Math.random() * heyResponses.length)];
        console.log(`👋 Hey-Response gefunden: ${randomResponse.output}`);
        return randomResponse.output;
      }
    }

    // Beste Übereinstimmung in Trainingsdaten finden
    if (trainingData.length > 0) {
      let bestMatch = null;
      let highestScore = 0;

      for (const trainItem of trainingData) {
        const score = calculateSimilarity(userMessage.toLowerCase(), trainItem.input.toLowerCase());
        if (score > highestScore) {
          highestScore = score;
          bestMatch = trainItem;
        }
      }

      if (bestMatch && highestScore > 0.4) {
        console.log(`🎯 Beste Übereinstimmung (${Math.round(highestScore * 100)}%): ${bestMatch.output}`);
        return bestMatch.output;
      }
    }

    // Fallback zu Profil-spezifischen Antworten
    if (profile.prompt_1 && /^(hey|hi|hallo)/i.test(userMessage)) {
      return profile.answer_1 || "Hey! Wie geht's dir? 😊";
    }

    // Letzte Fallback-Option
    const fallbackResponses = [
      "Das klingt interessant! Erzähl mir mehr davon! 😊",
      "Cool! Wie ist das denn so für dich?",
      "Wow, das hätte ich nicht erwartet! Was denkst du darüber?",
      "Das ist ja spannend! Magst du mir mehr dazu erzählen?",
      "Interessant! Wie bist du denn dazu gekommen?"
    ];

    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

  } catch (error) {
    console.error('❌ Fehler bei AI-Response-Generierung:', error);
    return "Hey! Entschuldige, ich bin gerade etwas durcheinander. Wie geht's dir denn? 😊";
  }
}

// Export der verbesserten generateAIResponse für Chat-Handler
module.exports = {
  handler: exports.handler,
  // Diese Funktion solltest du in deinem Chat-Handler verwenden
  generateAIResponse: async function(pool, aiId, userMessage) {
    try {
      console.log(`🤖 AI ${aiId} antwortet auf: "${userMessage}"`);

      // AI-Profil und Trainingsdaten laden
      const profileQuery = await pool.query('SELECT * FROM ai_profiles WHERE id = $1', [aiId]);
      if (profileQuery.rows.length === 0) {
        return "Hey! Ich bin noch am Lernen... Erzähl mir mehr!";
      }

      const profile = profileQuery.rows[0];
      const trainingData = profile.training_data || [];

      console.log(`📚 ${trainingData.length} Trainingsdaten verfügbar`);

      if (trainingData.length === 0) {
        return "Hmm, ich weiß gerade nicht, was ich sagen soll. Aber erzähl gerne mehr!";
      }

      // Beste Übereinstimmung finden
      let bestMatch = null;
      let highestScore = 0;

      for (const trainItem of trainingData) {
        const score = similarity(userMessage.toLowerCase(), trainItem.input.toLowerCase());
        if (score > highestScore) {
          highestScore = score;
          bestMatch = trainItem;
        }
      }

      console.log(`🎯 Beste Übereinstimmung: ${highestScore} für "${bestMatch?.input}"`);

      if (bestMatch && highestScore > 0.3) {
        return bestMatch.output;
      }

      // Fallback
      return "Das ist interessant! Erzähl mir mehr davon!";

    } catch (error) {
      console.error(`❌ Fehler bei AI ${aiId}:`, error);
      return "Hey! Entschuldige, ich bin gerade etwas durcheinander. Wie geht's dir?";
    }
  }
};
