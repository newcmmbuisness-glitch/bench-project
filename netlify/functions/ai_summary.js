exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { messages } = JSON.parse(event.body);
        
        // HIER KOMMT IHR KI-INTEGRATIONSCODE HIN
        // Beispiel-Code (ersetzen Sie diesen):
        const fullConversation = messages.join(' ');
        const summary = `Dies ist eine KI-generierte Zusammenfassung der Unterhaltung. Die Konversation hat ${messages.length} Nachrichten.`
        
        // Beispiel für OpenAI-Integration:
        // const openai = require('openai');
        // const completion = await openai.chat.completions.create({ ... });
        // const summary = completion.choices[0].message.content;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, summary }),
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
