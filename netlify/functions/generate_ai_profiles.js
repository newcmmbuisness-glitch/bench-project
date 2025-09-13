const { Client } = require('@neondatabase/serverless');
const { faker } = require('@faker-js/faker');

// === Cloudinary URL Parser mit Trim ===
function parseCloudinaryURL() {
  const raw = (process.env.CLOUDINARY_URL || "").trim();
  if (!raw) throw new Error("CLOUDINARY_URL ist nicht gesetzt");

  const match = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) throw new Error("Invalid CLOUDINARY_URL format");

  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

async function getCloudinaryImages(folder) {
  const { cloudName, apiKey, apiSecret } = parseCloudinaryURL();
  const expression = `folder="${folder}"`;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search?expression=${encodeURIComponent(expression)}&max_results=100`;

  const res = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64") }
  });
  if (!res.ok) throw new Error(`Cloudinary API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  return data.resources.map(r => r.secure_url);
}

// === Locations ===
const cityClusters = [ /* ... wie vorher ... */ ];
function buildExpandedLocations(clusters) {
  const expanded = [];
  clusters.forEach(c => {
    for (let i = 0; i < c.count; i++) {
      const latJitter = (Math.random() - 0.5) * 0.03;
      const lngJitter = (Math.random() - 0.5) * 0.03;
      expanded.push({ city: c.name, postalCode: c.postalCode, lat: c.lat + latJitter, lng: c.lng + lngJitter });
    }
  });
  return expanded;
}
const locationsExpanded = buildExpandedLocations(cityClusters);

// === Profile data ===
const descriptions = [ /* ... */ ];
const hobbyPool = [ /* ... */ ];
const prompts = [ /* ... */ ];
function randomFromArray(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// === Lambda Handler ===
exports.handler = async () => {
  const client = new Client({ connectionString: process.env.NETLIFY_DATABASE_URL });
  try {
    await client.connect();
    const profiles = [];

    for (const gender of ['female', 'male']) {
      const folder = gender === 'female' ? 'pic f' : 'pic m';
      const cloudinaryImages = await getCloudinaryImages(folder);

      // Alle Profile für das Gender laden
      const existingRes = await client.query(`SELECT * FROM ai_profiles WHERE gender=$1`, [gender]);
      const existingProfiles = existingRes.rows;
      profiles.push(...existingProfiles.map(p => ({ ...p, isAI: true })));

      // Neue Profile nur erstellen, wenn Cloudinary-Bild noch nicht in DB ist
      for (const img of cloudinaryImages) {
        const alreadyExists = existingProfiles.find(p => p.profile_image === img);
        if (alreadyExists) continue;

        const location = randomFromArray(locationsExpanded);
        const shuffledHobbies = faker.helpers.shuffle(hobbyPool);
        const selectedHobbies = shuffledHobbies.slice(0, faker.number.int({ min: 2, max: 4 }));
        const [prompt1, prompt2] = faker.helpers.shuffle(prompts).slice(0, 2);

        const profile = {
          profile_name: faker.person.firstName({ sex: gender }),
          age: faker.number.int({ min: 18, max: 31 }),
          gender,
          description: randomFromArray(descriptions),
          profile_image: img,
          postal_code: location.postalCode,
          latitude: location.lat,
          longitude: location.lng,
          used: true, // bleibt true, Bild gehört dauerhaft zu Profil
          interests: selectedHobbies,
          prompt_1: prompt1.q,
          answer_1: prompt1.a,
          prompt_2: prompt2.q,
          answer_2: prompt2.a
        };

        const insertRes = await client.query(
          `INSERT INTO ai_profiles 
          (profile_name, age, gender, description, profile_image, postal_code, latitude, longitude, used, interests, prompt_1, answer_1, prompt_2, answer_2) 
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            profile.profile_name,
            profile.age,
            profile.gender,
            profile.description,
            profile.profile_image,
            profile.postal_code,
            profile.latitude,
            profile.longitude,
            profile.used,
            profile.interests,
            profile.prompt_1,
            profile.answer_1,
            profile.prompt_2,
            profile.answer_2
          ]
        );
        profiles.push({ ...insertRes.rows[0], isAI: true });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, profiles })
    };

  } catch (err) {
    console.error("Fehler in generate_ai_profiles:", err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: err.message, profiles: [] })
    };
  } finally {
    await client.end();
  }
};
