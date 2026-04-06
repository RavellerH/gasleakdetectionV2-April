# Usage Guide

This guide covers how to set up, run, and interact with the Gas Leak Detector application.

## 🛠️ Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [NPM](https://www.npmjs.com/)
- (Optional) [Mapbox Access Token](https://www.mapbox.com/) for mapping features.

## 🚀 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "Gas Leak Detector"
   ```

2. **Install Root Dependencies**:
   ```bash
   npm install
   ```

3. **Backend Setup**:
   ```bash
   cd apps/backend
   npm install
   # Create a .env file based on existing config if needed
   npx prisma generate
   npx prisma migrate dev --name init
   # (Optional) Seed the database with dummy data
   npm run prisma:seed # if available, or use existing dev.db
   npm run start:dev
   ```

4. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   # Create a .env.local file with your Mapbox Token:
   # NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
   npm run dev
   ```

## 🖥️ Using the Application

### 1. Dashboard Access
Open `http://localhost:3000` in your browser. You will see the main dashboard with an overview of all Refinery Units (RUs).

### 2. RU-Specific Views
Navigate to a specific RU (e.g., RU VII) to see:
- **Interactive Map**: Drag and drop device pins to update their physical location.
- **Sensor List**: A real-time table of all sensors, their current gas readings (PPM), battery levels, and health status.
- **Health Indicators**: Color-coded markers (Green: Good, Yellow: Warning, Red: Critical).

### 3. Device Management
- **Move Devices**: You can physically rearrange the sensor network on the map.
- **Alert Acknowledgement**: Ack alerts when PPM levels exceed thresholds (configurable in `SystemSettings`).

## ⚙️ Configuration
Backend configuration is managed via `apps/backend/prisma/schema.prisma` and `.env`.
Frontend configuration (like API URLs and Mapbox tokens) is in `apps/frontend/.env.local`.
