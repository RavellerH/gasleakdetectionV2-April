// Regression test against the AES-128-GCM test vector documented in
// memory/pertamina_gld_protocol.md. Plain Node, no test framework/deps:
//   node nodered/functions/pertamina-gld-decode.test.js
const assert = require('assert');
const { decodeGLDRecord, decodeGatewayFrame, gasClassName, nodeIdHex } = require('./pertamina-gld-decode');

const KEY = Buffer.from('000102030405060708090A0B0C0D0E0F', 'hex');
const NODE_ID = 0xf001;
const GLD_SEQ = 0x2a;
const RECORD_FLAGS = 0x11; // ALARM (bit0) + EXT_POWER (bit4)
const NONCE = Buffer.from('101112131415161718191A1B', 'hex');
const CIPHERTEXT = Buffer.from('C57E0DDB', 'hex');
const TAG = Buffer.from('F88ABEC591E9F5BFAD982A6C', 'hex');
const KEY_ID = 1;

const header = Buffer.alloc(5);
header.writeUInt16BE(NODE_ID, 0);
header.writeUInt8(GLD_SEQ, 2);
header.writeUInt8(RECORD_FLAGS, 3);
header.writeUInt8(29, 4); // payloadLen

const encryptedPayload = Buffer.concat([Buffer.from([KEY_ID]), NONCE, CIPHERTEXT, TAG]);
assert.strictEqual(encryptedPayload.length, 29, 'encrypted payload must be 29 bytes');

const record = Buffer.concat([header, encryptedPayload]);
assert.strictEqual(record.length, 34, 'GLDRecord must be 34 bytes');
assert.strictEqual(
  record.toString('hex').toUpperCase(),
  'F0012A111D01101112131415161718191A1BC57E0DDBF88ABEC591E9F5BFAD982A6C',
  'record bytes must match the documented test vector layout',
);

const keysById = { [KEY_ID]: KEY };

const decoded = decodeGLDRecord(record, keysById);
assert.strictEqual(decoded.ok, true, `expected ok decode, got error: ${decoded.error}`);
assert.strictEqual(decoded.nodeIdHex, '0xF001');
assert.strictEqual(decoded.seq, GLD_SEQ);
assert.strictEqual(decoded.gasClass, 1);
assert.strictEqual(decoded.gasName, 'lpg');
assert.strictEqual(decoded.confidence, 80);
assert.strictEqual(decoded.batteryMv, 3700);
assert.strictEqual(decoded.alarm, true);
assert.strictEqual(decoded.externalPower, true);
assert.strictEqual(decoded.decryptOk, true);
console.log('PASS: decodeGLDRecord matches documented test vector', decoded);

// Tampered tag must fail closed, never silently decode.
const tampered = Buffer.from(record);
tampered[tampered.length - 1] ^= 0xff;
const tamperedResult = decodeGLDRecord(tampered, keysById);
assert.strictEqual(tamperedResult.ok, false);
assert.strictEqual(tamperedResult.decryptOk, false);
console.log('PASS: tampered tag rejected', tamperedResult.error);

// Unknown keyId must fail closed.
const unknownKeyResult = decodeGLDRecord(record, {});
assert.strictEqual(unknownKeyResult.ok, false);
assert.match(unknownKeyResult.error, /unknown keyId/);
console.log('PASS: unknown keyId rejected', unknownKeyResult.error);

// Gateway envelope wrapping (single record).
const events = decodeGatewayFrame(
  { gatewayId: 'gw-01', clusterId: '0x0064', frameHex: record.toString('hex'), rssi: -72, snr: 9.5 },
  keysById,
);
assert.strictEqual(events.length, 1);
assert.strictEqual(events[0].ok, true);
assert.strictEqual(events[0].gatewayId, 'gw-01');
assert.strictEqual(events[0].clusterId, '0x0064');
assert.strictEqual(events[0].rssi, -72);
console.log('PASS: decodeGatewayFrame single-record envelope', events[0]);

// Gateway envelope wrapping two concatenated records (CLUSTER_DATA_RESPONSE case).
const twoRecordEvents = decodeGatewayFrame(
  { gatewayId: 'gw-01', frameHex: Buffer.concat([record, record]).toString('hex') },
  keysById,
);
assert.strictEqual(twoRecordEvents.length, 2);
assert.ok(twoRecordEvents.every((e) => e.ok));
console.log('PASS: decodeGatewayFrame two-record envelope');

// Sanity on the small helpers.
assert.strictEqual(gasClassName(2), 'propane');
assert.strictEqual(gasClassName(99), 'unknown');
assert.strictEqual(nodeIdHex(1), '0x0001');

console.log('\nAll pertamina-gld-decode tests passed.');
