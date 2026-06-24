# Usage Guide

This guide covers how to set up, run, and interact with the Gas Leak Detector application.

## 🚀 Installation (everyone — recommended)

This is the path for anyone running the app, technical or not. There's nothing to install beforehand — the setup script handles it.

### Step 1: Get the app
Download or clone this repository to a folder on your computer.

### Step 2: Run the setup script

| Your OS | What to do |
|---|---|
| Windows | Double-click **`start.bat`** |
| Mac / Linux | Open a terminal in the project folder and run **`./start.sh`** |

On first run, the script automatically:
- Checks your internet connection
- Checks your computer meets the recommended specs (4 GB RAM, 2 GB free disk) and warns (but doesn't block) if it's below that
- Checks for a newer version of the app on GitHub and updates itself if one's available and you haven't made local changes
- **Installs Node.js for you if it's missing** — no need to visit nodejs.org yourself. Windows will show a permission prompt (click "Yes"); Mac/Linux will ask for your password. This is your operating system's normal "allow this program to make changes" prompt — it's expected.
- Installs packages, creates configuration, sets up the database, and loads demo data

This takes 1–3 minutes the first time. Two windows (or one terminal) will open running the app — leave them open while you use it.

### Step 3: Open the app
Go to **http://localhost:3000** in your browser.

```
Login:    admin@gld.com
Password: admin
```

The map needs a browser with WebGL support — any recent Chrome, Edge, Safari, or Firefox works. If WebGL isn't available, the app shows a plain-language message instead of a broken map.

To restart later, just run the same script again — it checks for updates, then skips setup and launches straight away. To stop, close the windows it opened (or press Ctrl+C on Mac/Linux).

If something goes wrong, the script prints a plain-language explanation (e.g. "no internet connection," "Node.js isn't installed") instead of raw technical output — follow what it says and try again.

### A note on the automatic Node.js install
Installing software requires your operating system's permission prompt (Windows UAC / macOS or Linux `sudo` password) — the script can't and doesn't bypass this, since that prompt is your confirmation that it's OK to proceed. If you'd rather install Node.js yourself first, see [nodejs.org](https://nodejs.org) — the script detects an existing install and skips this step entirely.

### A note on auto-update
Auto-update only works if the app was downloaded via `git clone` (not a zip download) and you haven't edited any files. If you have local changes, the script skips updating and tells you so rather than overwriting your work.

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
