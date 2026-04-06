# Architecture

The Gas Leak Detector is designed as a multi-tenant monitoring platform capable of managing multiple Refinery Units (RUs).

## 🏗️ System Overview

The system follows a classic Client-Server-Database architecture with a focus on real-time data streaming and geographic visualization.

### 1. Backend (NestJS + GraphQL + Prisma)
- **Framework**: NestJS provides a modular and scalable backend structure.
- **API Layer**: GraphQL (Apollo) is used for efficient data fetching, allowing the frontend to request exactly what it needs.
- **ORM**: Prisma manages the database schema and provides type-safe queries.
- **Database**: 
  - **Development**: SQLite (`dev.db`) for easy setup and local development.
  - **Production (Planned)**: TimescaleDB (PostgreSQL-based) for high-performance time-series data (gas readings).

### 2. Frontend (Next.js + Mapbox)
- **Framework**: Next.js 15 (App Router) for the web interface.
- **Mapping**: Mapbox GL and `react-map-gl` for 2D/3D visualization of RU layouts and device positions.
- **UI Components**: Tailwind CSS for styling, with a modular component architecture (`DeviceMap`, `SensorListPanel`, etc.).
- **State Management**: React state and GraphQL hooks for data synchronization.

### 3. Data Flow
1. **Sensors/Gateways**: Devices in the field collect gas concentration (PPM), battery levels, and network metrics.
2. **Ingestion**: Data is sent via GraphQL Mutations (or potentially MQTT in a full production setup).
3. **Persistence**: The backend validates and stores the data using Prisma.
4. **Real-time Updates**: The frontend fetches the latest state via GraphQL Queries and Subscriptions (planned).
5. **Visualization**: Real-time readings are mapped to device pins on a Mapbox interface and visualized in charts using Recharts.

## 👥 Multi-Tenant Isolation (RU-based)
The system uses `ruId` as a tenant identifier. All users and devices are associated with a specific Refinery Unit (e.g., RU2, RU7), ensuring that operators only see data relevant to their area.

## 🌳 Topology Management
The system supports Tree/Mesh topology tracking:
- **Gateways**: Root of the topology.
- **Routing Nodes/Cluster Heads**: Intermediate nodes.
- **Sensors**: End-point devices connected to parents.
- **Parent-Child Relations**: Stored in the `Device` model to visualize the network mesh.
