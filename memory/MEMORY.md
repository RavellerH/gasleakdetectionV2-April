# Project Memory Index

> Notes compiled from all design docs, architecture files, and session research.
> Last updated: 2026-06-11

- [System Overview](system_overview.md) — full hardware+software topology, device counts, confirmed integration decisions
- [Backend Architecture](backend_architecture.md) — NestJS/GraphQL/Prisma/SQLite internals, resolvers, schema, what doesn't exist yet
- [GLD Payload Format](gld_payload_format.md) — binary AppFrame, 7-byte sensor payload, AI output, alarm rule, risk level mapping
- [CH Protocol](ch_protocol.md) — Cluster Head dual-LoRa protocol, message types, queue, state machine, two versions
- [Server Integration Plan](server_integration_plan.md) — full checklist: MQTT module, AppFrame parser, DB schema changes, pull scheduler, implementation order
- [Node-RED Integration](nodered_integration.md) — Node-RED as aggregator, MySQL staging, normalize functions per source type
- [Frontend & UI Plan](frontend_ui_plan.md) — Next.js stack, Mapbox, UI/UX roadmap, Tailwind migration tasks
- [Edge Firmware (Legacy)](edge_firmware_legacy.md) — older ESP8266/ESP32 firmware, LLCC68 radio, struct_message format, MQTT topics
- [Open Items](open_items.md) — unresolved decisions that block implementation
