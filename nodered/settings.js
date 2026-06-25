// Node-RED user settings for the per-RU GLD bridge.
// Run with: node-red -s ./settings.js
//
// Starts an Aedes MQTT broker embedded in this same Node.js process (per
// memory/nodered_integration.md: "Node-RED + embedded Aedes broker, one
// process per RU") and exposes the decoder + AES key to flow function nodes
// via functionGlobalContext, so the real key never has to be pasted into the
// flow JSON itself.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const net = require('net');
const aedes = require('aedes')();
const decode = require('./functions/pertamina-gld-decode');

const mqttPort = Number(process.env.MQTT_PORT) || 1884;
const broker = net.createServer(aedes.handle);
broker.listen(mqttPort, () => {
  console.log(`[gld-bridge] embedded Aedes broker listening on ${mqttPort}`);
});

const keyId = Number(process.env.GLD_KEY_ID) || 1;
const keyHex = process.env.GLD_AES128_KEY_HEX || '';
if (keyHex.length !== 32) {
  console.warn('[gld-bridge] GLD_AES128_KEY_HEX is not set to a 16-byte (32 hex char) key — decoding will fail until .env is configured');
}
const keysById = keyHex.length === 32 ? { [keyId]: Buffer.from(keyHex, 'hex') } : {};

module.exports = {
  uiPort: Number(process.env.NODE_RED_PORT) || 1880,
  userDir: __dirname,
  flowFile: 'flows/pertamina-gld-server.flow.json',
  functionGlobalContext: {
    gldDecode: decode,
    gldKeysById: keysById,
  },
};
