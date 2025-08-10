import { neon } from '@netlify/neon';

const sql = neon();

export async function handler(event) {
  try {
    const { name, description, lat, lng } = JSON.parse(event.body);

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
