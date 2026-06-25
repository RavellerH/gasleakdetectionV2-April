# Project Memory Index

> Notes compiled from all design docs, architecture files, and session research.
> Last updated: 2026-06-25

- [PertaminaGLD Protocol](pertamina_gld_protocol.md) — **authoritative** wire protocol: AppFrame/GLDRecord byte layout, AES-128-GCM encryption, MQTT topic map, test vector. Sourced from the real firmware repo (`fadlurrahmanf/PertaminaGLD`), supersedes our own drafts below.
- [Commissioning Mode](commissioning_mode.md) — new feature design: device lifecycle gating, RU site setup wizard, per-device onboarding wizard, AES key handling, Prisma schema additions
- [System Overview](system_overview.md) — full hardware+software topology, device counts, confirmed integration decisions
- [Backend Architecture](backend_architecture.md) — NestJS/GraphQL/Prisma/SQLite internals, resolvers, schema, what doesn't exist yet
- [GLD Payload Format](gld_payload_format.md) — ⚠️ superseded by `pertamina_gld_protocol.md`; kept for historical reference only
- [CH Protocol](ch_protocol.md) — ⚠️ message-type tables superseded by `pertamina_gld_protocol.md`; radio hardware params likely still valid but unconfirmed
- [Server Integration Plan](server_integration_plan.md) — MQTT consumer module, Prisma schema changes, commissioning gate, implementation order
- [Node-RED Integration](nodered_integration.md) — Node-RED as the AES-GCM decode/decrypt bridge (per RU, alongside NestJS), reusing PertaminaGLD's flow
- [Frontend & UI Plan](frontend_ui_plan.md) — Next.js stack, Mapbox, UI/UX roadmap, Tailwind migration tasks
- [Edge Firmware (Legacy)](edge_firmware_legacy.md) — older ESP8266/ESP32 firmware, LLCC68 radio, struct_message format, MQTT topics
- [Open Items](open_items.md) — unresolved decisions that block implementation
