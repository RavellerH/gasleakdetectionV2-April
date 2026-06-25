# Tech Stack

The Gas Leak Detector leverages a modern, production-ready tech stack focused on performance, type safety, and developer experience.

## 💻 Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (React 18+)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Mapping**: [Mapbox GL JS](https://www.mapbox.com/mapbox-gl-js) & [react-map-gl](https://visgl.github.io/react-map-gl/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **API Client**: `graphql-request` for lightweight GraphQL fetching.

## ⚙️ Backend
- **Framework**: [NestJS 11](https://nestjs.com/)
- **API**: [GraphQL](https://graphql.org/) (via `@nestjs/graphql` and Apollo Server)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Validation**: `class-validator` and `class-transformer`
- **Environment**: Node.js

## 🗄️ Database
- **Engine**: [SQLite](https://www.sqlite.org/) (Development) / [PostgreSQL/TimescaleDB](https://www.timescale.com/) (Planned for Production)
- **Schema Management**: Prisma Migrations

## 🛠️ DevOps & Tools
- **Containerization**: Docker (Docker Compose for development)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Full-stack)
- **Package Manager**: NPM
- **Linter/Formatter**: ESLint & Prettier

## 📡 Protocols (Simulated/Planned)
- **MQTT**: Planned for direct hardware-to-backend communication, via a per-RU Node-RED decode/decrypt bridge. Wire protocol and topic map defined by [`fadlurrahmanf/PertaminaGLD`](https://github.com/fadlurrahmanf/PertaminaGLD) (the firmware repo) — see `memory/pertamina_gld_protocol.md` for details.
- **AES-128-GCM**: Sensor payloads are encrypted end-to-end from the GLD node until the Node-RED decode bridge; the Gateway never decrypts.
- **HTTP/HTTPS**: For standard API interactions.
- **LoRa (mesh + star)**: The hardware layer uses LoRa for long-range, low-power sensor-to-gateway communication.
