const { Client } = require('@neondatabase/serverless');
const { faker } = require('@faker-js/faker');

const images = {
  female: [
    "https://images.unsplash.com/photo-1699474072277-aeccb6e17263?q=80&w=2061&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1534865007446-5214dca11db4?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
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

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

exports.handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL
  });

  try {
    // Connect to database
    await client.connect();

    const profiles = [];

    for (const gender of ['female', 'male']) {
      // Fixed: Added backticks around SQL query
      const res = await client.query(
        `SELECT profile_image FROM ai_profiles WHERE gender=$1 AND (used IS NULL OR used=false)`,
        [gender]
      );

      const usedImages = res.rows.map(r => r.profile_image);
      const freeImages = images[gender].filter(img => !usedImages.includes(img));

      for (const img of freeImages) {
        const location = randomFromArray(locations);
        const profile = {
          profile_name: faker.person.firstName({ gender }),
          age: Math.floor(Math.random() * (31 - 18 + 1)) + 18,
          gender,
          description: randomFromArray(descriptions),
          profile_image: img,
          postal_code: location.postalCode,
          latitude: location.lat + (Math.random() - 0.5) * 0.05,
          longitude: location.lng + (Math.random() - 0.5) * 0.05,
          used: true
        };

        // Fixed: Added backticks around SQL query
        await client.query(
          `INSERT INTO ai_profiles (profile_name, age, gender, description, profile_image, postal_code, latitude, longitude, used) 
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            profile.profile_name,
            profile.age,
            profile.gender,
            profile.description,
            profile.profile_image,
            profile.postal_code,
            profile.latitude,
            profile.longitude,
            profile.used
          ]
        );

        profiles.push({
          ...profile,
          isAI: true
        });
      }
    }

    // No need to close connection with neon() pattern

    console.log(`Generated ${profiles.length} AI profiles`);

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
        profiles: profiles // Ensure profiles is always an array
      })
    };

  } catch (err) {
    console.error("Fehler in generate_ai_profiles:", err);
    console.error("Stack trace:", err.stack);
    
    // No need to close connection with neon() pattern

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
        profiles: [] // Always provide empty array as fallback
      })
    };
  }
};
