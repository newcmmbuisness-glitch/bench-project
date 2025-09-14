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

// === Clustered locations across Germany ===
const cityClusters = [
  { name: 'Biberach', postalCode: '88400', lat: 48.095, lng: 9.786, count: 6 },
  { name: 'Ulm', postalCode: '89073', lat: 48.401, lng: 9.987, count: 6 },
  { name: 'Memmingen', postalCode: '87700', lat: 47.988, lng: 10.177, count: 4 },
  { name: 'München', postalCode: '80331', lat: 48.137, lng: 11.575, count: 12 },
  { name: 'Stuttgart', postalCode: '70173', lat: 48.7758, lng: 9.1829, count: 8 },
  { name: 'Karlsruhe', postalCode: '76131', lat: 49.0069, lng: 8.4037, count: 5 },
  { name: 'Freiburg', postalCode: '79098', lat: 47.999, lng: 7.842, count: 4 },
  { name: 'Augsburg', postalCode: '86150', lat: 48.3705, lng: 10.8978, count: 4 },
  { name: 'Nürnberg', postalCode: '90402', lat: 49.4521, lng: 11.0767, count: 5 },
  { name: 'Berlin', postalCode: '10115', lat: 52.532, lng: 13.384, count: 12 },
  { name: 'Hamburg', postalCode: '20095', lat: 53.55, lng: 10.0, count: 8 },
  { name: 'Bremen', postalCode: '28195', lat: 53.075, lng: 8.807, count: 4 },
];


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
