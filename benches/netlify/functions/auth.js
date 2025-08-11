import { neon } from '@netlify/neon';
const sql = neon();

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const { action, email, password } = body;
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'E-Mail und Passwort erforderlich.' }) }
    }
    if (action === 'register') {
      // Prüfen ob User schon existiert
      const exists = await sql`SELECT 1 FROM users WHERE email = ${email}`;
      if (exists.length > 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Benutzer existiert bereits.' }) };
      }
      // User anlegen (Passwort bewusst unverschlüsselt, bitte in echt bcrypt verwenden!)
      await sql`INSERT INTO users (email, password) VALUES (${email}, ${password})`;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    if (action === 'login') {
      const user = await sql`SELECT * FROM users WHERE email = ${email} AND password = ${password}`;
      if (user.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ungültige Anmeldedaten.' }) };
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, email: user[0].email, isAdmin: !!user[0].is_admin }) }
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'Unbekannte Aktion.' }) }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}