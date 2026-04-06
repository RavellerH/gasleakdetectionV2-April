const axios = require('axios');

async function simulate() {
  const GQL_URL = 'http://localhost:3001/graphql';
  
  // Actual MAC addresses created by the seed.js
  const sensors = [
    'RU2-MAC-SNS-1', 'RU2-MAC-SNS-2',
    'RU3-MAC-SNS-1', 'RU3-MAC-SNS-2',
    'RU7-MAC-SNS-1', 'RU7-MAC-SNS-2'
  ];

  console.log('--- STARTING SENSOR SIMULATION ---');
  console.log(`Simulating ${sensors.length} devices...`);

  setInterval(async () => {
    for (const mac of sensors) {
      const ppm = (Math.random() * 50 + 5).toFixed(2);
      
      try {
        await axios.post(GQL_URL, {
          query: `
            mutation {
              addReading(macAddress: "${mac}", ppm: ${parseFloat(ppm)}) {
                id
                ppm
                timestamp
              }
            }
          `
        });
        console.log(`[Success] ${mac}: ${ppm} PPM`);
      } catch (e) {
        console.error(`[Error] Failed to send ${mac}. Is the backend running?`);
      }
    }
    console.log('-----------------------------------');
  }, 5000); 
}

simulate();
