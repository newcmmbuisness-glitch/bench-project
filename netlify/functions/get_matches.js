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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return { statusCode: 400, headers, body: 'Fehlende Benutzer-ID' };
    }

    // Letzte Nachrichten pro Match
    const lastMessages = await sql`
      SELECT DISTINCT ON (match_id) 
        match_id,
        sender_id,
        message_text,
        sent_at
      FROM chat_messages
      ORDER BY match_id, sent_at DESC
    `;

    // Matches mit echten Usern
    const realMatches = await sql`
      SELECT 
        m.id AS match_id,
        p.*,
        CASE WHEN m.user_id_1 = ${userId} THEN m.user_id_2 ELSE m.user_id_1 END AS matched_user_id,
        m.created_at
      FROM matches m
      JOIN meet_profiles p ON (p.user_id = m.user_id_1 OR p.user_id = m.user_id_2)
      WHERE (m.user_id_1 = ${userId} OR m.user_id_2 = ${userId})
        AND p.user_id != ${userId}
        AND (m.user_id_1 NOT IN (SELECT id FROM ai_profiles) 
             AND m.user_id_2 NOT IN (SELECT id FROM ai_profiles))
    `;

    // Matches mit AI-Profilen
    const aiMatches = await sql`
      SELECT 
        m.id AS match_id,
        ap.id AS matched_user_id,
        m.created_at,
        ap.profile_name,
        ap.age,
        ap.gender,
        ap.description,
        ap.profile_image
      FROM matches m
      JOIN ai_profiles ap ON (ap.id = m.user_id_1 OR ap.id = m.user_id_2)
      WHERE (m.user_id_1 = ${userId} OR m.user_id_2 = ${userId})
    `;

    const allMatches = [...realMatches, ...aiMatches];

    // Letzte Nachricht anhängen
    const structuredMatches = allMatches.map(match => {
      const lastMsg = lastMessages.find(lm => lm.match_id === match.match_id);
      return {
        ...match,
        last_message: lastMsg
          ? {
              sender_id: lastMsg.sender_id,
              text: lastMsg.message_text,
              sent_at: lastMsg.sent_at,
            }
          : null,
      };
    });

    // Sortierung: zuletzt aktiv
    structuredMatches.sort((a, b) => {
      const aTime = a.last_message?.sent_at || a.created_at;
      const bTime = b.last_message?.sent_at || b.created_at;
      return new Date(bTime) - new Date(aTime);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, matches: structuredMatches }),
    };
  } catch (error) {
    console.error('get_matches error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
