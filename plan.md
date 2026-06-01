# Gas Leak Monitoring Platform - Enhancement Plan (v2.2)

This document outlines the strategic roadmap for improving the **Gas Leak Monitoring Platform** across three core pillars: **UI/UX Modernization**, **Advanced Features**, and **System Architecture**.

---

## 🎨 1. UI/UX Modernization
*Goal: Move from a functional prototype to a high-polish, production-grade interface.*

### 1.1 Design System Implementation
- [ ] **Tailwind CSS Migration:** Replace current heavy inline styling in `GasLeakDashboard.tsx` and `DeviceMap.tsx` with utility-first Tailwind classes to improve maintainability and performance.
- [ ] **Standardized Component Library:** Create reusable UI primitives (Buttons, Cards, Modals, Badges) using Headless UI or Radix UI for consistent interaction patterns.
- [ ] **Responsive Design Audit:** Optimize layouts for tablets and mobile devices (currently optimized primarily for desktop "Command Center" view).

### 1.2 Interactive Visualizations
- [ ] **Enhanced Unit Layout Map:** 
    - Implement drag-and-drop for manual node positioning in the star/mesh topology.
    - Add "Pulse" animations on nodes when a new reading is received.
    - Interactive tooltips showing real-time sensor health on hover.
- [ ] **Advanced Charting:**
    - Add multi-sensor comparison views in the Analytics tab.
    - Implement "Brush & Zoom" on the 24h timeline to inspect specific leak events.
    - Add a "Heatmap" overlay on the Unit Layout for gas concentration density.

### 1.3 Personalization & Accessibility
- [ ] **Persistent Theme Engine:** Save Dark/Light mode preference in LocalStorage or User Profile.
- [ ] **Language Support (i18n):** Full support for Indonesian (ID) and English (EN) across all dashboard elements.
- [ ] **Accessibility (A11y):** Ensure high contrast ratios, screen reader support for alerts, and full keyboard navigation.

---

## 🚀 2. Feature Enhancements
*Goal: Expand the platform's utility for site operators and safety officers.*

### 2.1 Real-time Engine (WebSocket)
- [ ] **Socket.io Integration:** Replace 10-second polling with a real-time WebSocket stream for:
    - Instant Gas Readings.
    - Critical Alarm broadcasts.
    - Device Online/Offline status changes.
- [ ] **Browser Notifications:** Implement Web Push API for high-severity alerts even when the dashboard tab is closed.

### 2.2 Thermal Camera Integration (Placeholder Implementation)
- [ ] **Live Feed Panel:** Add a dedicated "Visual Verification" panel for each RU.
- [ ] **Snapshot on Alarm:** Automatically capture and display a thermal image/frame when a `CRITICAL` leak is detected.
- [ ] **PTZ Controls:** Basic Pan-Tilt-Zoom UI controls for compatible edge cameras.

### 2.3 Automated Reporting & Export
- [ ] **PDF Incident Reports:** Generate a professional one-page summary for any `CRITICAL` alarm (Time, RU, Device, Max PPM, Resolution).
- [ ] **CSV Analytics Export:** Allow safety officers to export historical sensor data for compliance reporting.
- [ ] **Weekly Safety Digest:** Automated email summary of RU performance and sensor health.

### 2.4 Maintenance & Lifecycle
- [ ] **Calibration Tracking:** Field to record the last calibration date for each sensor; alert when calibration is overdue (>6 months).
- [ ] **Battery Health Prediction:** Use historical SoC (State of Charge) data to estimate "Days until battery replacement."

---

## 🛠️ 3. Technical Debt & Infrastructure
*Goal: Improve system stability, developer experience, and scalability.*

### 3.1 Backend & API
- [ ] **API Documentation:** Integrate Swagger/OpenAPI for the REST parts and ensure the GraphQL Playground is secured.
- [ ] **Structured Logging:** Implement Pino or Winston for better error tracking and audit trails of user actions (e.g., who acknowledged an alert).
- [ ] **Rate Limiting:** Protect the GraphQL endpoint from excessive queries.

### 3.2 Testing & Quality
- [ ] **Unit Testing (Jest):** Coverage for critical logic like `mapToDevice` and `getDashboardStats`.
- [ ] **E2E Testing (Playwright):** Automated flows for Login -> Select RU -> View Map -> Acknowledge Alert.
- [ ] **CI/CD Pipeline:** GitHub Actions for automated linting and build verification.

### 3.3 State Management
- [ ] **Zustand/React Query:** Move away from local component state for global data (Devices, Settings, Users) to improve performance and data consistency across tabs.

---

## 📅 Implementation Roadmap

### Phase 1: Core Polish (Weeks 1-2)
- Tailwind CSS Migration.
- Socket.io Implementation for real-time readings.
- Persistent Dark Mode & i18n.

### Phase 2: Safety & Reporting (Weeks 3-4)
- PDF/CSV Export.
- Calibration & Maintenance tracking.
- Browser Notifications.

### Phase 3: Advanced Visuals (Weeks 5-6)
- Thermal Camera Feed integration.
- Interactive Topology drag-and-drop.
- Predictive battery analytics.
