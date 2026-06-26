// PertaminaGLD wire-protocol decoder for the per-RU Node-RED bridge.
// Spec: memory/pertamina_gld_protocol.md (authoritative, sourced from
// fadlurrahmanf/PertaminaGLD). Validated against that doc's AES-128-GCM test
// vector in pertamina-gld-decode.test.js.
//
// Confirmed 2026-06-26 against fadlurrahmanf/PertaminaGLD's actual Node-RED
// decode function: `frameHex` on `gld/gateway/uplink` is one or more
// concatenated raw GLDRecords (34 bytes each — a CLUSTER_DATA_RESPONSE can
// carry up to 2 per 80-byte MESH frame), with no outer AppFrame header. The
// AppFrame/0xAA-magic parser in their code is only used for a separate
// contract/direct-frame path, not gateway uplink.
//
// No dependencies beyond Node's built-in `crypto` — usable directly from a
// Node-RED function node (paste the body, or `require()` this file if your
// Node-RED instance allows external modules in function nodes).

const crypto = require('crypto');

const GLD_RECORD_LEN = 34;
const ENCRYPTED_PAYLOAD_LEN = 29;
const NONCE_LEN = 12;
const TAG_LEN = 12;
const CIPHERTEXT_LEN = 4;

const GAS_CLASS_NAMES = ['clear', 'lpg', 'propane', 'butane', 'methane', 'reserved', 'anomaly'];

function gasClassName(gasClass) {
  return GAS_CLASS_NAMES[gasClass] || 'unknown';
}

function nodeIdHex(nodeId) {
  return '0x' + nodeId.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Decrypt + validate a single 34-byte GLDRecord.
 * @param {Buffer} recordBuf - exactly GLD_RECORD_LEN bytes
 * @param {Record<number, Buffer>} keysById - keyId -> 16-byte AES key
 */
function decodeGLDRecord(recordBuf, keysById) {
  if (recordBuf.length !== GLD_RECORD_LEN) {
    return { ok: false, error: `bad record length ${recordBuf.length}, expected ${GLD_RECORD_LEN}` };
  }

  const nodeId = recordBuf.readUInt16BE(0);
  const seq = recordBuf.readUInt8(2);
  const flags = recordBuf.readUInt8(3);
  const payloadLen = recordBuf.readUInt8(4);
  const idHex = nodeIdHex(nodeId);

  if (payloadLen !== ENCRYPTED_PAYLOAD_LEN) {
    return { ok: false, nodeIdHex: idHex, seq, error: `bad payloadLen ${payloadLen}, expected ${ENCRYPTED_PAYLOAD_LEN}` };
  }

  const payload = recordBuf.subarray(5, 5 + ENCRYPTED_PAYLOAD_LEN);
  const keyId = payload.readUInt8(0);
  const nonce = payload.subarray(1, 1 + NONCE_LEN);
  const ciphertext = payload.subarray(1 + NONCE_LEN, 1 + NONCE_LEN + CIPHERTEXT_LEN);
  const tag = payload.subarray(1 + NONCE_LEN + CIPHERTEXT_LEN, ENCRYPTED_PAYLOAD_LEN);

  const key = keysById[keyId];
  if (!key) {
    return { ok: false, nodeIdHex: idHex, seq, error: `unknown keyId ${keyId}` };
  }

  // AAD = nodeId(2,BE) + gldSeq(1) + recordFlags(1) + keyId(1)
  const aad = Buffer.concat([recordBuf.subarray(0, 4), Buffer.from([keyId])]);

  let plaintext;
  try {
    const decipher = crypto.createDecipheriv('aes-128-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    return { ok: false, nodeIdHex: idHex, seq, decryptOk: false, error: `decrypt/tag verification failed: ${err.message}` };
  }

  const gasClass = plaintext.readUInt8(0);
  const confidence = plaintext.readUInt8(1);
  const batteryMv = plaintext.readUInt16BE(2);

  if (gasClass > 6 || gasClass === 5) {
    return { ok: false, nodeIdHex: idHex, seq, decryptOk: true, error: `invalid gasClass ${gasClass}` };
  }
  if (confidence > 100) {
    return { ok: false, nodeIdHex: idHex, seq, decryptOk: true, error: `invalid confidence ${confidence}` };
  }
  if (batteryMv === 0xffff) {
    return { ok: false, nodeIdHex: idHex, seq, decryptOk: true, error: 'invalid batteryMv (0xFFFF)' };
  }

  return {
    ok: true,
    kind: 'gld-event',
    nodeId,
    nodeIdHex: idHex,
    seq,
    gasClass,
    gasName: gasClassName(gasClass),
    confidence,
    batteryMv,
    alarm: (flags & 0x01) !== 0,
    externalPower: (flags & 0x10) !== 0,
    decryptOk: true,
  };
}

/**
 * Decode a gateway uplink envelope, which may bundle multiple GLDRecords.
 * @param {{gatewayId?: string, clusterId?: string, frameHex: string, rssi?: number, snr?: number}} envelope
 * @param {Record<number, Buffer>} keysById
 * @returns {object[]} one decoded/error event per GLDRecord found in the frame
 */
function decodeGatewayFrame(envelope, keysById) {
  const frameBuf = Buffer.from(envelope.frameHex, 'hex');

  if (frameBuf.length === 0 || frameBuf.length % GLD_RECORD_LEN !== 0) {
    return [{
      ok: false,
      error: `frame length ${frameBuf.length} is not a non-zero multiple of GLDRecord length ${GLD_RECORD_LEN}`,
      gatewayId: envelope.gatewayId,
    }];
  }

  const events = [];
  for (let offset = 0; offset < frameBuf.length; offset += GLD_RECORD_LEN) {
    const record = decodeGLDRecord(frameBuf.subarray(offset, offset + GLD_RECORD_LEN), keysById);
    events.push({
      ...record,
      gatewayId: envelope.gatewayId,
      clusterId: envelope.clusterId,
      rssi: envelope.rssi,
      snr: envelope.snr,
    });
  }
  return events;
}

module.exports = { decodeGLDRecord, decodeGatewayFrame, gasClassName, nodeIdHex };
