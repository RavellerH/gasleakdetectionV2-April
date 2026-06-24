# Usage Guide

This guide covers how to set up, run, and interact with the Gas Leak Detector application.

## 🚀 Installation (everyone — recommended)

This is the path for anyone running the app, technical or not. It needs **one thing installed** and **one file run**.

### Step 1: Install Node.js
Download and run the installer from **[nodejs.org](https://nodejs.org)** — click the green **LTS** button, then keep all default options. This is the only prerequisite; there's no database or other tool to install separately.

### Step 2: Get the app
Download or clone this repository to a folder on your computer.

### Step 3: Run the setup script

| Your OS | What to do |
|---|---|
| Windows | Double-click **`start.bat`** |
| Mac / Linux | Open a terminal in the project folder and run **`./start.sh`** |

The first run takes 1–3 minutes and does everything automatically: installs packages, creates configuration, sets up the database, and loads demo data. Two windows (or one terminal) will open running the app — leave them open while you use it.

### Step 4: Open the app
Go to **http://localhost:3000** in your browser.

```
Login:    admin@gld.com
Password: admin
```

To restart later, just run the same script again — it skips setup and launches straight away. To stop, close the windows it opened (or press Ctrl+C on Mac/Linux).

If something goes wrong, the script prints a plain-language explanation (e.g. "no internet connection," "Node.js isn't installed") instead of raw technical output — follow what it says and try again.

## 🛠️ Manual / developer installation

Only use this if you need fine-grained control over each step (e.g. active development). The script above does all of this for you automatically.

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [NPM](https://www.npmjs.com/)
- (Optional) Your own [Mapbox Access Token](https://www.mapbox.com/) — a demo token is provided by default.

**Steps:**

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
