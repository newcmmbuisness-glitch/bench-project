import { neon } from '@netlify/neon';

const sql = neon();

export async function handler(event) {
  try {
    const data = JSON.parse(event.body);

    // Felder aus dem Request-Objekt extrahieren oder generieren
    const name = data.name && data.name.length > 0
      ? data.name
      : "Bank an " + (data.address?.road || "Ort unbekannt");
    const description = data.display_name || "Keine Beschreibung";
    const lat = parseFloat(data.lat || data.latitude);
    const lng = parseFloat(data.lon || data.lng || data.longitude);

    await sql`
      INSERT INTO benches (name, description, latitude, longitude)
      VALUES (${name}, ${description}, ${lat}, ${lng})
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Bench added successfully!' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
