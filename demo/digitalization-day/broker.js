// Local MQTT broker for the demo laptop (loopback only, no auth).
// In the field this role is played by the PertaminaGLD broker on 127.0.0.1:1884.
const aedes = require('aedes')();
const net = require('net');

const PORT = Number(process.env.DEMO_MQTT_PORT || 1884);
const server = net.createServer(aedes.handle);
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} sudah dipakai — kemungkinan broker PertaminaGLD sudah jalan. Broker demo tidak dijalankan.`);
    process.exit(0);
  }
  throw err;
});
server.listen(PORT, '127.0.0.1', () => console.log(`Broker MQTT demo aktif di 127.0.0.1:${PORT}`));
