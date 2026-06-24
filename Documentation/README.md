# Gas Leak Detector Documentation

Welcome to the documentation for the Gas Leak Detector application. This project is a multi-RU (Refinery Unit) monitoring system for gas sensors, thermal cameras, and networking gateways.

## 📖 Navigation

- **[Architecture](./Architecture.md)**: High-level system design and data flow.
- **[Tech Stack](./Tech-Stack.md)**: Technologies and frameworks used in this project.
- **[Usage Guide](./Usage-Guide.md)**: How to set up and use the application.
- **[Data Streaming](./Data-Streaming.md)**: How to input real-time data into the system.

## 🚀 Quick Start

To get the project running locally:

```bash
# 1. Install dependencies (Root and Apps)
npm install
cd apps/backend && npm install
cd ../frontend && npm install

# 2. Setup Backend Database
cd apps/backend
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev

# 3. Start Frontend
cd ../frontend
npm run dev

# 4. Simulate Sensor Data (in a new terminal)
node simulate-sensors.js
```

The frontend will be available at `http://localhost:3000`.
The backend GraphQL playground will be at `http://localhost:3001/graphql`.

### Mapbox token note

`start.bat` / `start.sh` ship a demo Mapbox token (base64-obfuscated in the script, not plaintext) so first-time setup needs zero configuration. Mapbox public tokens are inherently exposed to anyone using the app's frontend — obfuscation only stops casual repo scraping, it isn't real protection. To actually secure it, add a URL restriction to the token in the Mapbox account dashboard (Settings → Access tokens → restrict to your domain/`localhost`), or swap in your own token via `apps/frontend/.env.local`.
