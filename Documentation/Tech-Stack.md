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
- **MQTT**: Planned for direct hardware-to-backend communication.
- **HTTP/HTTPS**: For standard API interactions.
- **LoRaWAN**: The hardware layer uses LoRa for long-range, low-power sensor communication.
