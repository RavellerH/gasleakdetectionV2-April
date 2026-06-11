# Node-RED Integration

Node-RED acts as an aggregator of mixed hardware sources, normalizing data into MySQL, which the backend then polls.

## Architecture

```
Hardware Sources
  MQTT sensors / HTTP sensors / Serial / existing MySQL
         ↓
      Node-RED
   [normalize function]
   → { mac_address, riskLevel/ppm, source, timestamp }
         ↓ INSERT
   Existing MySQL DB  (user has this — schema not yet shared)
   table: sensor_readings
         ↓ poll every 10s (SELECT WHERE id > lastSeen)
   NestJS ReadingsPollerService
         ↓ deviceService.addReading()
      SQLite (existing app logic unchanged)
```

## Confirmed Decisions

| Item | Decision |
|---|---|
| Data sources | Mixed: MQTT, HTTP, Serial, MySQL |
| MySQL schema | Existing DB (user has it — still needs to share `DESCRIBE table_name`) |
| DB strategy | **Hybrid** — SQLite for app, MySQL for ingestion staging only |
| Node identity | nodeId as hex string `"0x0005"` in `macAddress` field |
| Device registration | Not yet decided: skip unknown MAC or auto-create device |

## Node-RED Normalize Functions Per Source

**MQTT (JSON payload):**
```javascript
const raw = typeof msg.payload === 'string'
  ? JSON.parse(msg.payload) : msg.payload;
msg.payload = {
  mac_address: raw.mac || raw.macAddress || raw.device_id,
  ppm:         parseFloat(raw.ppm ?? raw.value ?? raw.reading),
  source:      'mqtt'
};
return msg;
```

**Serial / CSV string `"AA:BB:CC,42.5"`:**
```javascript
const parts = String(msg.payload).trim().split(',');
msg.payload = {
  mac_address: parts[0].trim(),
  ppm:         parseFloat(parts[1]),
  source:      'serial'
};
return msg;
```

**Raw number (single sensor, fixed MAC in flow context):**
```javascript
msg.payload = {
  mac_address: flow.get('SENSOR_MAC'),
  ppm:         parseFloat(msg.payload),
  source:      'http'
};
return msg;
```

**MySQL rows already in Node-RED:**
```javascript
msg.payload = msg.payload.map(row => ({
  mac_address: row.device_mac || row.mac,
  ppm:         parseFloat(row.gas_ppm || row.ppm),
  source:      'mysql'
}));
return msg;  // use split node after this
```

> Note: `ppm` above is a placeholder field name. The actual field may be `riskLevel` or `aiClass` + `confidence` depending on what the hardware sends. Normalize to whatever the MySQL staging table stores.

## NestJS ReadingsPollerService (to build)

```typescript
@Injectable()
export class ReadingsPollerService implements OnModuleInit {
  private lastPolledId = 0;

  @Cron(CronExpression.EVERY_10_SECONDS)
  async poll() {
    const rows = await mysqlConn.query(
      'SELECT * FROM sensor_readings WHERE id > ? ORDER BY id ASC LIMIT 100',
      [this.lastPolledId]
    );
    for (const row of rows) {
      await this.deviceService.addReading(row.mac_address, row.ai_class, row.confidence, ...);
    }
    if (rows.length) this.lastPolledId = rows[rows.length - 1].id;
  }
}
```

## Still Needed

- MySQL table schema: run `DESCRIBE sensor_readings;` and share output
- Final field mapping: what columns does the Node-RED MySQL insert use?
- Device registration decision: skip vs auto-create
