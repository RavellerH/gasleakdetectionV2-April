# UI/UX Modernization - Execution Plan (Safe-Rollback Edition)

This plan focuses on migrating the **Gas Leak Monitoring Platform** from inline styles to **Tailwind CSS**, extracting reusable components, and enhancing interactivity.

---

## 🛡️ Safety & Rollback Strategy
Before starting each task, follow these backup protocols:
1.  **Git Branching:** `git checkout -b feature/ui-modernization` (Primary).
2.  **File-Level Backup:** Before major refactors (e.g., `GasLeakDashboard.tsx`), create a `.bak` copy: `cp file.tsx file.tsx.bak`.
3.  **Atomic Commits:** Commit after each successful component migration.

---

## 🛠️ Task List

### Phase 1: Infrastructure & Discovery
- [ ] **Verify Tailwind Setup:** 
    - [ ] Run `npm run dev:frontend` and test a simple Tailwind class (e.g., `<div className="bg-red-500">`) to ensure the PostCSS pipeline is active.
- [ ] **Inventory Discovery:**
    - [ ] Identify recurring colors, spacing, and shadows in the current inline styles to map them to Tailwind's `theme` extension in `tailwind.config.ts`.

### Phase 2: Component Extraction (Atomic Refactor)
*Goal: Remove logic-less UI from the main dashboard.*
- [ ] **UI Component Library (`apps/frontend/src/components/ui/`):**
    - [ ] **Badge:** Extract `statusColor`, `healthColor`, and `batteryColor` logic into a reusable `<Badge />`.
    - [ ] **Card:** Create a `<Card />` component that handles the "glassmorphism" look (`backdrop-filter`, `rgba` borders).
    - [ ] **Button:** Standardize the "Linear Gradient" buttons into a `<Button />` with `primary`, `danger`, and `ghost` variants.
    - [ ] **Input:** Create a `<Input />` component for consistent form styling.

### Phase 3: Main Dashboard Refactor (High Risk)
*Strategy: Surgical replacement of inline styles with Tailwind classes.*
- [ ] **Sidebar Refactor:**
    - [ ] Backup: `cp GasLeakDashboard.tsx GasLeakDashboard.sidebar.bak`
    - [ ] Replace sidebar container inline styles with `fixed`, `h-screen`, `bg-sidebar-bg`, etc.
    - [ ] Migrate `SIDEBAR_ITEMS` mapping to use Tailwind hover/active states.
- [ ] **Header Refactor:**
    - [ ] Migrate `LiveClock` and `RU_LIST` buttons to Tailwind.
- [ ] **KPI Grid Refactor:**
    - [ ] Convert the "Command Center" KPI cards to use a CSS Grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

### Phase 4: Maps & Data Visuals
- [ ] **DeviceMap Refactor:**
    - [ ] Move Mapbox popup styling from the `<style>` tag to Tailwind `@layer components` in `globals.css`.
- [ ] **Chart Container Refactor:**
    - [ ] Ensure `ResponsiveContainer` works correctly with Tailwind-defined height/width constraints.

### Phase 5: Theme & i18n
- [ ] **Theme Switcher:**
    - [ ] Refactor the `darkMode` state to toggle a `.dark` class on the `<html>` element.
    - [ ] Define custom colors in `tailwind.config.ts` (e.g., `brand-cyan`, `ui-dark-bg`).
- [ ] **i18n Foundation:**
    - [ ] Extract all hardcoded strings (e.g., "Active Alerts", "Rename Device") into a `locales/` JSON structure.

---

## 🚦 Validation & Rollback Checklist

### Success Criteria
- [ ] No visual regression: The dashboard looks identical or better.
- [ ] No "Flash of Unstyled Content" (FOUC).
- [ ] `GasLeakDashboard.tsx` file size reduced by at least 30% (less inline noise).
- [ ] Responsive behavior: Test at `375px`, `768px`, and `1440px`.

### Rollback Procedure
If a task breaks the layout:
1.  **Git Rollback:** `git checkout -- apps/frontend/src/components/GasLeakDashboard.tsx`
2.  **Manual Rollback:** `mv GasLeakDashboard.tsx.bak GasLeakDashboard.tsx`
3.  **Clean Cache:** `rm -rf .next` (if build errors persist).
