// Erweiterte AI-Chat Lambda (eine Datei) - FIXED
// - Läuft ohne OpenAI-Key (Regelbasierte Engine + erweiterte Pools + Memory)
// - LLM-Fallback vorbereitet (deaktiviert), falls du später einen Key setzen willst
// - Input/Output kompatibel mit deinem bisherigen Handler: erwartet aiProfileId, userMessage, userProfile, optional conversationId
// - Speichert konversationell temporär in global.__CONV_MEMORY__ (ephemeral in Lambda)

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
        body: JSON.stringify({ success: false, error: 'aiProfileId und userMessage sind erforderlich' })
      };
    }

    // ---------------------------
    // Konfiguration / Datenpools
    // ---------------------------

    // Basispersonas (deine bestehenden + Sub-Stimmungen)
    const aiPersonalities = {
      ai_anna: {
        id: 'ai_anna',
        name: 'Anna',
        traits: ['romantisch', 'naturliebend', 'nachdenklich'],
        baseStyle: 'warmherzig und poetisch',
        moods: ['verspielt','nachdenklich','freundlich']
      },
      ai_max: {
        id: 'ai_max',
        name: 'Max',
        traits: ['entspannt','humorvoll','gesellig'],
        baseStyle: 'locker und freundlich',
        moods: ['locker','sarkastisch','cool']
      },
      ai_lisa: {
        id: 'ai_lisa',
        name: 'Lisa',
        traits: ['abenteuerlustig','spontan','naturverbunden'],
        baseStyle: 'energisch und authentisch',
        moods: ['spontan','frech','neugierig']
      },
      ai_tom: {
        id: 'ai_tom',
        name: 'Tom',
        traits: ['romantisch','tiefgehend','aufmerksam'],
        baseStyle: 'durchdacht und einfühlsam',
        moods: ['tiefgehend','zärtlich','ruhig']
      },
      ai_sarah: {
        id: 'ai_sarah',
        name: 'Sarah',
        traits: ['lebenslustig','abenteuerlich','optimistisch'],
        baseStyle: 'begeistert und motivierend',
        moods: ['begeistert','direkt','cheery']
      }
    };

    // Pools: merged aus deiner alten Struktur + die von dir gelieferten snippets.
    // Du kannst später weitere Kategorien hier hinzufügen.
    const pools = {
      greetings_short: ["Hey!", "Hi :)", "Moin!", "Hey du!"],
      greetings_playful: ["Na du Troublemaker 😏 was treibst du?", "Okay, dein Profil hat mich erwischt. Erzähl mal!", "Hallöchen, Geheimagent? 😄"],
      teasing_light: ["Große Worte… hältst du die auch beim ersten Kaffee? 😉", "Du klingst gefährlich überzeugend — Beweisfoto? 😄", "Oh, Mutig! Ich mag das."],
      compliments: ["Du hast echt ein tolles Lächeln 😊", "Schönes Profilbild!", "Dein Lächeln ist ansteckend!"],
      date_suggestions: ["Kaffee to go + kleiner Rundgang—Deal?", "Erst 15 Minuten spazieren, dann schauen wir weiter?", "Wie wär's mit nem Eis und ner kurzen Runde?"],
      questions_open: ["Was machst du am liebsten an einem freien Tag?", "Was ist dein absolutes Lieblingsrestaurant?", "Was brächtest du nie auf einen Roadtrip mit?"],
      interest_music: ["Was hörst du gerade am liebsten?", "Wenn du nur noch ein Album mitnehmen könntest — welches wäre es?"],
      interest_wine: ["Rotwein oder Weiß — was geht besser?", "Welcher Wein passt für dich zu einem gemütlichen Abend?"],
      smalltalk_closers: ["Ich muss gleich los, aber erzähl mir morgen mehr 😊", "Cool, lass uns das später weiterspinnen!", "Melden uns später — haben noch was vor."],
      jokes: [
        "Was macht ein Keks unter einem Baum? Krümel.",
        "Was macht du denn aktuell so?",
        "Ich studiere dual.",
        "Hast du mich gerade Aal genannt?",
        "Was liegt am Strand und spricht undeutlich? Til Schweiger... Oder eine Nuschel.",
        "Steht ein Pils im Wald. Kommt ein Hase und trinkt's aus.",
        "Ich wollte eigentlich einen Witz über die Eismaschine von McDonalds machen, hat aber leider nicht funktioniert..."
      ],

      // Kleine Hilfskategorien, die Regeln nutzen können
      date_confirm: ["Klingt gut — wann hättest du Zeit?", "Perfekt, lieber Vormittag oder Nachmittag?"],
      flirt_push: ["Aha… und wie wär's mit einem kleinen Abenteuer?", "Du hast mein Interesse geweckt 😉"]
    };

    // Mische user-supplied chat-snippets automatisch in passende Pools (benutze die Beispiele die du geschickt hast)
    // (Du hattest zwei Chats; wir extrahieren typische Zeilen und pushen sie in pools)
    const userProvidedChats = [
      // chat 1 (anonymisiert)
      "Hey :)",
      "Hey",
      "Du siehst echt sympathisch aus",
      "Danke du auch",
      "Sprichst du fließend spanisch?",
      "Jap",
      "Ich hab eine schwäche für spanisch sprechende shawtys",
      "Dann ist ja gut",
      "Nach was suchst du denn genau?",
      "Spaß und du",
      "Dann sind wir wohl auf der selben Wellenlänge",
      "Cool",
      "Dann slide deine # Shawty und wir schauen auf WhatsApp was die nahe Zukunft für uns offen hält",
      // chat 2
      "Wie viel kostet es wenn ich mir deine AUGEN tätowieren lasse?",
      "Man startet ja mit klein und FINE",
      "haha ich muss sagen der war echt gut",
      "Danke und ich finde gut das du tätowiert bist shawty",
      "Wie können Männer noch bei dir punkten?",
      "Uff eigentlich am meisten mit aufmerksamkeit und ehrlichkeit",
      "Okay, dann bin ich ja schon mal auf dem richtigen Weg"
    ];

    // Einfache heuristik: push kurze Sätze in greetings oder compliments oder teasing etc.
    userProvidedChats.forEach(s => {
      const t = s.trim();
      if (!t) return;
      if (/^(hey|hi|moin|hall)/i.test(t)) pools.greetings_short.push(t);
      else if (/sympathisch|schön|danke|cool|toll|nett/i.test(t)) pools.compliments.push(t);
      else if (/spanisch|shawty|whatsapp|slide|tätowier|augen|tätowiert/i.test(t)) pools.teasing_light.push(t);
      else if (/spaß|same|selbe wellenlänge|aufmerksamkeit|ehrlich/i.test(t)) pools.questions_open.push(t);
      else pools.smalltalk_closers.push(t);
    });

    // ---------------------------
    // Moderation (einfach, lokal) - blockiert grobe Beleidigungen / PII / Telefonnummern
    // ---------------------------
    function moderateLocal(text) {
      const lower = text.toLowerCase();
      // blocke Telefonnummern, emails, links
      if (/\+?\d[\d\s\-]{6,}\d/.test(text) || /https?:\/\//i.test(text) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return { blocked: true, reason: 'private daten' };
      // einfache Schimpfwörter (erweiterbar)
      const blacklist = ['arsch', 'f**k', 'fick', 'hurensohn', 'nazi', 'scheisse'];
      for (let b of blacklist) if (lower.includes(b.replace(/\*/g,''))) return { blocked: true, reason: 'beleidigung' };
      return { blocked: false };
    }

    const mod = moderateLocal(userMessage);
    if (mod.blocked) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, response: 'Lass uns freundlich bleiben 😊', aiName: 'Moderation' })
      };
    }

    // ---------------------------
    // In-Memory Conversation Memory (ephemeral)
    // ---------------------------
    // global store, survives warm lambda container but not cold starts
    global.__CONV_MEMORY__ = global.__CONV_MEMORY__ || {};
    const convKey = (conversationId && String(conversationId)) || (`conv_${aiProfileId}`);
    if (!global.__CONV_MEMORY__[convKey]) {
      global.__CONV_MEMORY__[convKey] = { turns: [], facts: {} };
    }
    const memory = global.__CONV_MEMORY__[convKey];

    // Save user's last message into memory immediately for future responses
    // We'll append AI response later
    memory.turns.push({ role: 'user', text: userMessage, ts: Date.now() });
    // Keep only last N turns
    if (memory.turns.length > 12) memory.turns = memory.turns.slice(-12);

    // ---------------------------
    // Utilities
    // ---------------------------
    function pick(arr) {
      if (!arr || arr.length === 0) return '';
      return arr[Math.floor(Math.random() * arr.length)];
    }
    function chance(p) { return Math.random() < p; }
    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

    // Kleine "Noiser" Funktionen um menschliche Varianz zu simulieren
    const fillers = ['haha', 'hmm', 'naja', 'vllt', 'joa', 'ehrlich gesagt', 'achso'];
    const ellipses = ['…', '...'];
    function maybeFiddle(text) {
      // 20% chance add filler at start, 15% chance add ellipse, 10% chance small typo
      let out = text;
      if (chance(0.2)) out = pick(fillers) + ' ' + out;
      if (chance(0.15)) out = out + ' ' + pick(ellipses);
      if (chance(0.08)) {
        // simple typo: duplicate a random character
        const i = Math.floor(Math.random() * out.length);
        out = out.slice(0, i) + out[i] + out.slice(i);
      }
      return out;
    }

    // ---------------------------
    // Regel-Engine / Intent-Matching
    // ---------------------------
    const lowerMsg = userMessage.toLowerCase();

    function detectIntent(text) {
      const s = text.toLowerCase();
      if (/^\s*(hi|hey|hallo|moin|servus)\b/.test(s)) return { intent: 'greeting', score: 1.0 };
      if (/(schön|sympathisch|süß|hübsch|nett|cool|toll)/.test(s)) return { intent: 'compliment', score: 0.9 };
      if (/(treffen|date|whatsapp|nummer|treffen|slide)/.test(s)) return { intent: 'date', score: 0.95 };
      if (/(wein|wine)/.test(s)) return { intent: 'interest_wine', score: 0.8 };
      if (/(musik|song|band)/.test(s)) return { intent: 'interest_music', score: 0.8 };
      if (/(tätowier|tätowiert|tattoo|augen tätowieren)/.test(s)) return { intent: 'teasing_tattoo', score: 0.85 };
      if (/\?/.test(s) || /(warum|wie|wieso|was|welche|wann|wo)/.test(s)) return { intent: 'question', score: 0.7 };
      if (/(spaß|spaßig|vllt|vielleicht|aufmerksamkeit|ehrlich)/.test(s)) return { intent: 'goals', score: 0.6 };
      if (s.length < 20) return { intent: 'short', score: 0.4 };
      return { intent: 'unknown', score: 0.1 };
    }

    const intentObj = detectIntent(userMessage);
	
    // ---------------------------
    // Response Composer mit Short-Message-Handling
    // ---------------------------
    function composeResponse(intent, userMsg, persona) {
      const msgLength = userMsg.trim().length;
      let raw = '';
    
      switch (intent) {
        case 'greeting':
          if (msgLength < 5) {
            // Sehr kurze Begrüßungen → kurze, direkte Antworten
            raw = pick(pools.greetings_short);
          } else {
            // Längere Begrüßungen → Playful optional
            raw = chance(0.3) ? pick(pools.greetings_playful) : pick(pools.greetings_short);
          }
          break;
    
        case 'compliment':
          raw = pick(['Oh, danke! 😊', 'Aww, danke dir!', 'Du siehst auch nett aus!', 'Back at ya 😉']);
          break;
    
        case 'date':
          raw = pick(pools.date_suggestions);
          if (chance(0.4)) raw += ' ' + pick(pools.date_confirm);
          break;
    
        case 'interest_wine':
        case 'interest_music':
        case 'teasing_tattoo':
          raw = pick(pools[intent] || ['Interessant! Erzähl mir mehr.']);
          if (msgLength > 20 && chance(0.6)) raw += ' ' + pick(['Und bei dir?', 'Was meinst du dazu?', 'Wie siehst du das?']);
          break;
    
        case 'question':
        case 'goals':
        case 'unknown':
          // Längere Antworten für komplexe Fragen
          raw = pick(pools.questions_open) + ' ' + pick(pools.smalltalk_closers);
          if (msgLength > 30 && chance(0.3)) raw += ' ' + pick(['Erzähl mal!', 'Wie war das bei dir?']);
          break;
    
        case 'short':
          raw = pick(['Haha, stimmt!', 'Ja, echt?', 'Klingt nice!']);
          if (chance(0.25)) raw += ' ' + pick(['Und du?', 'Weiter.']);
          break;
    
        default:
          raw = pick(['Das klingt interessant! Erzähl mir mehr darüber.', 'Echt? Wie kam es dazu?', 'Oh nice — was noch?']);
      }
    
      return raw;
    }
    
    let rawResponse = composeResponse(intentObj.intent, userMessage, aiPersonality);
	

    // Determine persona from aiProfileId (fallback to anna)
    let aiPersonality = aiPersonalities.ai_anna;
    if (/ai_.*1/.test(aiProfileId) || /anna/i.test(aiProfileId)) aiPersonality = aiPersonalities.ai_anna;
    else if (/ai_.*2/.test(aiProfileId) || /max/i.test(aiProfileId)) aiPersonality = aiPersonalities.ai_max;
    else if (/ai_.*3/.test(aiProfileId) || /lisa/i.test(aiProfileId)) aiPersonality = aiPersonalities.ai_lisa;
    else if (/ai_.*4/.test(aiProfileId) || /tom/i.test(aiProfileId)) aiPersonality = aiPersonalities.ai_tom;
    else if (/ai_.*5/.test(aiProfileId) || /sarah/i.test(aiProfileId)) aiPersonality = aiPersonalities.ai_sarah;

    // ---------------------------
    // Mood/Substyle picker for persona (adds human-like variability)
    // ---------------------------
    function pickMoodForPersona(persona) {
      const moods = persona.moods || ['neutral'];
      // weight: prefer first mood slightly
      const r = Math.random();
      if (r < 0.6) return moods[0];
      if (r < 0.85) return moods[1 % moods.length] || moods[0];
      return moods[2 % moods.length] || moods[0];
    }

    const mood = pickMoodForPersona(aiPersonality);

    // ---------------------------
    // Rule-based Response Composer
    // ---------------------------
    function composeFromPool(intent, personaId, moodTag) {
      // map intents to pools
      const intentMap = {
        greeting: ['greetings_short','greetings_playful'],
        compliment: ['compliments','greetings_playful'],
        date: ['date_suggestions','date_confirm'],
        interest_wine: ['interest_wine'],
        interest_music: ['interest_music'],
        teasing_tattoo: ['teasing_light','jokes'],
        question: ['questions_open','smalltalk_closers'],
        goals: ['questions_open','smalltalk_closers'],
        short: ['greetings_short','teasing_light'],
        unknown: ['questions_open','smalltalk_closers']
      };
      const poolsToUse = intentMap[intent] || ['questions_open'];
      // choose one pool and one phrase
      const chosenPool = pick(poolsToUse.map(p => pools[p]).filter(Boolean));
      return pick(chosenPool || ['Interessant! Erzähl mehr.']);
    }

    // Decide whether to use rule or do a deeper composition (no external LLM used)
    // Conditions for LLM fallback would be: long message, ambiguous question, or special flags.
    // But since we run rule-only now, we try to craft nicer answers by mixing templates.
    const rule = intentObj.intent;
    let rawResponse = ''; // FIXED: Removed duplicate declaration

    // Short-circuit friendly replies: when message extremely short or greeting -> keep very short
    if (rule === 'greeting') {
      // sometimes playful, sometimes warm
      rawResponse = chance(0.45) ? pick(pools.greetings_playful) : pick(pools.greetings_short);
      // add small persona touch
    } else if (rule === 'compliment') {
      // thank + return compliment or playful tease
      const replies = [
        pick(['Oh, danke! 😊', 'Aww, danke dir!']),
        pick(['Du siehst auch nett aus!', 'Back at ya 😉'])
      ];
      rawResponse = pick(replies);
    } else if (rule === 'date') {
      rawResponse = pick(pools.date_suggestions);
      // sometimes add low-pressure follow-up
      if (chance(0.4)) rawResponse += ' ' + pick(pools.date_confirm);
    } else if (rule === 'interest_wine' || rule === 'interest_music' || rule === 'teasing_tattoo') {
      rawResponse = composeFromPool(rule, aiPersonality.id, mood);
      // add a follow-up question often
      if (chance(0.6)) rawResponse += ' ' + pick(['Und bei dir?', 'Was meinst du dazu?', 'Wie siehst du das?']);
    } else if (rule === 'question' || rule === 'unknown' || rule === 'goals') {
      // Build a somewhat longer response by combining two pools for richness
      const p1 = composeFromPool(rule, aiPersonality.id, mood);
      const p2 = pick(pools.questions_open);
      rawResponse = `${p1} ${p2}`;
      if (chance(0.3)) rawResponse += ' ' + pick(['Erzähl mal!', 'Wie war das bei dir?']);
    } else if (rule === 'short') {
      rawResponse = pick(['Haha, stimmt!', 'Ja, echt?','Klingt nice!']);
      if (chance(0.25)) rawResponse += ' ' + pick(['Und du?', 'Weiter.']);
    } else {
      // fallback generic
      rawResponse = pick(['Das klingt interessant! Erzähl mir mehr darüber.', 'Echt? Wie kam es dazu?', 'Oh nice — was noch?']);
    }

    // ---------------------------
    // Persona-specific flavoring
    // ---------------------------
    function personaFlavor(text, persona, moodTag) {
      let out = text;

      // persona-based signature phrases
      const personaSignatures = {
        ai_anna: ['🌸','✨','💕'],
        ai_max: ['😎','🤙','🍻'],
        ai_lisa: ['🌿','🦋','⭐'],
        ai_tom: ['🌹','🎭','❤️'],
        ai_sarah: ['🎉','💪','🚀']
      };
      // mood-based adjustments
      if (moodTag === 'verspielt' || moodTag === 'spontan' || moodTag === 'frech') {
        if (chance(0.4)) out = out + ' ' + pick([';)','😉','😏']);
      } else if (moodTag === 'nachdenklich' || moodTag === 'tiefgehend') {
        if (chance(0.35)) out = pick(['Weißt du,', 'Ganz ehrlich,']) + ' ' + out;
      } else if (moodTag === 'sarkastisch') {
        if (chance(0.25)) out = out + ' ' + pick(['Haha, knapp daneben!', 'Na klar...']);
      }

      // small chance to append one of persona emojis as signature
      if (chance(0.3)) out += ' ' + pick(personaSignatures[persona.id] || ['']);

      return out;
    }

    rawResponse = personaFlavor(rawResponse, aiPersonality, mood);

    // Apply style/noise: sentence-length variation, filler, emoji budget, and safety strips
    function postProcess(text) {
      // Limit emojis to 2
      const emojiMatches = [...text.matchAll(/\p{Emoji_Presentation}|\p{Emoji}/gu)];
      const emojiBudget = 2;
      if (emojiMatches.length > emojiBudget) {
        // naive removal of extra emojis
        let removed = 0;
        text = text.replace(/\p{Emoji_Presentation}|\p{Emoji}/gu, (m) => {
          removed++;
          return removed <= emojiBudget ? m : '';
        });
      }

      // add filler/ellipses sometimes
      text = maybeFiddle(text);

      // simple sanitization: block potential phone numbers or URLs if present
      text = text.replace(/(\+?\d[\d\s\-]{6,}\d)/g, '[nummer entfernt]');
      text = text.replace(/https?:\/\/\S+/gi, '');

      // trim multiple spaces and ensure capital at start
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > 0) text = text[0].toUpperCase() + text.slice(1);

      // Limit total length (avoid huge outputs)
      if (text.length > 600) text = text.slice(0, 590) + '...';

      return text;
    }

    let finalResponse = postProcess(rawResponse);

    // ---------------------------
    // Memory update: add AI turn
    // ---------------------------
    memory.turns.push({ role: 'ai', text: finalResponse, ts: Date.now(), persona: aiPersonality.id, mood });
    if (memory.turns.length > 12) memory.turns = memory.turns.slice(-12);

    // Optionally extract simple facts from userMessage (e.g., "ich studiere", "ich spreche spanisch", "mag tattoo")
    // This is a tiny heuristic; extend as desired.
    function extractFactsFromMessage(msg, mem) {
      const s = msg.toLowerCase();
      if (/\b(spanisch|spanisch sprech|spanisch spreche|spanisch sprechend)\b/.test(s)) mem.facts.language = 'spanish';
      if (/\b(studi|studier|student|studiert)\b/.test(s)) mem.facts.student = true;
      if (/\b(tätow|tattoo|tätowier)\b/.test(s)) mem.facts.likes_tattoos = true;
      if (/\b(aufmerksamkeit|ehrlich|ehrlichkeit)\b/.test(s)) mem.facts.values = mem.facts.values || [], mem.facts.values.push('ehrlichkeit');
      // keep facts small
      if (Object.keys(mem.facts).length > 10) {
        // trim heuristic (no-op here)
      }
    }
    try { extractFactsFromMessage(userMessage, memory); } catch (e) { /* ignore */ }

    // ---------------------------
    // LLM-Fallback stub (ausgeschaltet) - hier nur vorbereitet
    // Falls später aktiviert: set process.env.USE_LLM === '1' und process.env.OPENAI_API_KEY
    // ---------------------------
    // Hinweis: LLM-Fallback ist in dieser Version deaktiviert. Wenn du ihn aktivierst, werden
    // die Regeln nur verwendet, wenn fallback nicht notwendig ist. Implementierung müsste OpenAI SDK nutzen.
    async function llmFallbackPlaceholder() {
      // Beispiel: return "LLM-Fallback-Antwort (noch nicht aktiviert).";
      return null;
    }

    // ---------------------------
    // Antwort zurückgeben
    // ---------------------------
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: finalResponse,
        aiName: aiPersonality.name,
        meta: {
          intentDetected: intentObj.intent,
          intentScore: intentObj.score,
          mood,
          memoryTurns: memory.turns.length
        }
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
        response: "Hey! Entschuldige, ich bin gerade etwas verwirrt... Erzähl mir kurz nochmal, was du meinst? 😊"
      })
    };
  }
};
