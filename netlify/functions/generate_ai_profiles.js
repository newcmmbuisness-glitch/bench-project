const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

const usedImagesFile = path.join(__dirname, 'used_images.json');

const images = {
  female: [
    "https://images.unsplash.com/photo-1699474072277-aeccb6e17263?q=80&w=2061&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
  ],
  male: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  ]
};

const locations = [
  { postalCode: '10115', lat: 52.532, lng: 13.384 },
  { postalCode: '20095', lat: 53.550, lng: 10.000 },
  { postalCode: '80331', lat: 48.137, lng: 11.575 },
  { postalCode: '50667', lat: 50.941, lng: 6.958 },
  { postalCode: '28195', lat: 53.075, lng: 8.807 },
];

const descriptions = [
  "Liebe Spaziergänge und gemütliche Abende.",
  "Musik, Filme und Sport machen mein Leben bunt.",
  "Kunst- und Kulturfan, tiefgründige Gespräche.",
  "Natur, Reisen und gutes Essen sind meine Leidenschaft.",
  "Humorvoll, entspannt und immer für Abenteuer zu haben.",
];

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let usedImages = [];
if (fs.existsSync(usedImagesFile)) {
  usedImages = JSON.parse(fs.readFileSync(usedImagesFile, 'utf-8'));
}

exports.handler = async () => {
  const profiles = [];

  for (const gender of ['female','male']) {
    const freeImages = images[gender].filter(img => !usedImages.includes(img));
    for (let i = 0; i < freeImages.length; i++) {
      const profileImage = freeImages[i];
      usedImages.push(profileImage);

      const location = randomFromArray(locations);
      const name = faker.person.firstName(gender);
      const age = Math.floor(Math.random() * (31 - 18 + 1)) + 18;
      const description = randomFromArray(descriptions);

      profiles.push({
        user_id: `ai_${gender}_${i}_${Date.now()}`,
        profile_name: name,
        age,
        gender,
        description,
        profile_image: profileImage,
        interests: faker.helpers.arrayElements(['wine','420','Sport','Filme','Wandern','Musik','Fotografie'], 3),
        postal_code: location.postalCode,
        latitude: location.lat + (Math.random() - 0.5) * 0.05,
        longitude: location.lng + (Math.random() - 0.5) * 0.05,
        isAI: true
      });
    }
  }

  fs.writeFileSync(usedImagesFile, JSON.stringify(usedImages, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ profiles }),
  };
};
