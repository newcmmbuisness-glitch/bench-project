const { Client } = require('@neondatabase/serverless');
const { faker } = require('@faker-js/faker');

// === Images for AI profiles ===
const images = {
  female: [
    "https://images.unsplash.com/photo-1699474072277-aeccb6e17263?q=80&w=2061&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1534865007446-5214dca11db4?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.pexels.com/photos/33852037/pexels-photo-33852037.jpeg",
    "https://images.pexels.com/photos/227288/pexels-photo-227288.jpeg",
    "https://images.pexels.com/photos/33870333/pexels-photo-33870333.jpeg",
    "https://images.pexels.com/photos/33858735/pexels-photo-33858735.jpeg",
    "https://res.cloudinary.com/dp3t4ctxz/image/upload/v1757679980/53832689223_8f7ae6292b_o_wadtce.jpg"
  ],
  male: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
  ]
};

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

// Expand clusters into many locations with small jitter (~2km)
function buildExpandedLocations(clusters) {
  const expanded = [];
  clusters.forEach(c => {
    for (let i = 0; i < c.count; i++) {
      const latJitter = (Math.random() - 0.5) * 0.03;
      const lngJitter = (Math.random() - 0.5) * 0.03;
      expanded.push({
        city: c.name,
        postalCode: c.postalCode,
        lat: c.lat + latJitter,
        lng: c.lng + lngJitter
      });
    }
  });
  return expanded;
}

const locationsExpanded = buildExpandedLocations(cityClusters);

// === Profile texts ===
const descriptions = [
  "Liebe Spaziergänge und gemütliche Abende.",
  "Musik, Filme und Sport machen mein Leben bunt.",
  "Kunst- und Kulturfan, tiefgründige Gespräche.",
  "Natur, Reisen und gutes Essen sind meine Leidenschaft.",
  "Humorvoll, entspannt und immer für Abenteuer zu haben."
];

const hobbyPool = [
  "Kochen", "Gaming", "Wandern", "Fotografie",
  "Musik", "Filme", "Sport", "Kunst", "Haustiere"
];

const prompts = [
  { q: "Ein perfekter erster Date ist...", a: "Ein Spaziergang am Fluss mit Kaffee." },
  { q: "Ich bin gerade besessen von...", a: "Neuen Rezepten und Serien." },
  { q: "Zwei Wahrheiten und eine Lüge...", a: "Ich liebe Hunde, ich hasse Pizza, ich spiele Gitarre." },
  { q: "Mein liebstes Reiseziel ist...", a: "Die Berge in Südtirol." },
  { q: "Was ich in meiner Freizeit tue...", a: "Sport treiben und Freunde treffen." }
];

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// === Lambda Handler ===
exports.handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL
  });

  try {
    await client.connect();
    const profiles = [];

    for (const gender of ['female', 'male']) {
      for (const img of images[gender]) {
        // Prüfen, ob es das Bild schon gibt
        const existingRes = await client.query(
          `SELECT * FROM ai_profiles WHERE profile_image=$1`,
          [img]
        );

        let profile;
        if (existingRes.rows.length > 0) {
          profile = existingRes.rows[0];
        } else {
          // Neues Profil erzeugen
          const location = randomFromArray(locationsExpanded);
          const shuffledHobbies = faker.helpers.shuffle(hobbyPool);
          const selectedHobbies = shuffledHobbies.slice(0, faker.number.int({ min: 2, max: 4 }));
          const [prompt1, prompt2] = faker.helpers.shuffle(prompts).slice(0, 2);

          profile = {
            profile_name: faker.person.firstName({ sex: gender }),
            age: faker.number.int({ min: 18, max: 31 }),
            gender,
            description: randomFromArray(descriptions),
            profile_image: img,
            postal_code: location.postalCode,
            latitude: location.lat,
            longitude: location.lng,
            used: true,
            interests: selectedHobbies,
            prompt_1: prompt1.q,
            answer_1: prompt1.a,
            prompt_2: prompt2.q,
            answer_2: prompt2.a
          };

          const insertRes = await client.query(
            `INSERT INTO ai_profiles 
              (profile_name, age, gender, description, profile_image, postal_code, latitude, longitude, used, interests, prompt_1, answer_1, prompt_2, answer_2) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING *`,
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

          profile = insertRes.rows[0];
        }

        profiles.push({
          ...profile,
          isAI: true
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        profiles
      })
    };

  } catch (err) {
    console.error("Fehler in generate_ai_profiles:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'AI-Profile konnten nicht geladen werden.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        profiles: []
      })
    };
  }
};
