const axios = require('axios');
const INGEST_KEY = process.env.DEVICE_INGEST_KEY || 'change-me-device-ingest-key';

async function simulate() {
  const GQL_URL = 'http://localhost:4000/graphql';
  
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
      const confidence = Math.random();
      const aiClass = confidence >= 0.7 ? Math.floor(Math.random() * 8) + 1 : 0;
      
      try {
        await axios.post(GQL_URL, {
          query: `
            mutation {
              addReading(macAddress: "${mac}", confidence: ${confidence}, aiClass: ${aiClass}) {
                id
                confidence
                aiClass
                riskLevel
                timestamp
              }
            }
          `
        }, { headers: { 'x-ingest-key': INGEST_KEY } });
        console.log(`[Success] ${mac}: class ${aiClass}, confidence ${confidence.toFixed(2)}`);
      } catch (e) {
        console.error(`[Error] Failed to send ${mac}. Is the backend running?`);
      }
    }
    console.log('-----------------------------------');
  }, 5000); 
}

simulate();
