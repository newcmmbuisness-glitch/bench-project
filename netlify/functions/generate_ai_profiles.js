const { Client } = require('@neondatabase/serverless');
const { faker } = require('@faker-js/faker');

const images = {
  female: [
    "https://images.unsplash.com/photo-1699474072277-aeccb6e17263?q=80&w=2061&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face"
  ],
  male: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
  ]
};

const locations = [
  { postalCode: '10115', lat: 52.532, lng: 13.384 },
  { postalCode: '20095', lat: 53.550, lng: 10.000 },
  { postalCode: '80331', lat: 48.137, lng: 11.575 },
  { postalCode: '50667', lat: 50.941, lng: 6.958 },
  { postalCode: '28195', lat: 53.075, lng: 8.807 }
];

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

exports.handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL
  });

  try {
    await client.connect();
    const profiles = [];

    for (const gender of ['female', 'male']) {
      for (const img of images[gender]) {
        // Prüfen, ob schon ein Profil mit diesem Bild existiert
        const existingRes = await client.query(
          `SELECT * FROM ai_profiles WHERE profile_image=$1`,
          [img]
        );

        let profile;
        if (existingRes.rows.length > 0) {
          // bereits vorhandenes Profil zurückgeben
          profile = existingRes.rows[0];
        } else {
          // neues Profil erstellen
          const location = randomFromArray(locations);
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
            latitude: location.lat + (Math.random() - 0.5) * 0.05,
            longitude: location.lng + (Math.random() - 0.5) * 0.05,
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
