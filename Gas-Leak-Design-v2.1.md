# Design Aplikasi Monitoring Gas Leak Detector Multi-RU (Cursor-Ready v2.1 - Complete)

## 🚀 Quick Start Cursor Commands (Copy-Paste Ready)

```bash
# Monorepo Setup
npx nx@latest workspace gas-leak-monorepo --preset=nest
cd gas-leak-monorepo

# Frontend
npx nx g @nx/next:app frontend --directory=apps/frontend
cd apps/frontend && npx shadcn-ui@latest init

# Backend
npx nx g @nx/nest:app backend --directory=apps/backend
cd apps/backend && npm i @nestjs/graphql prisma @prisma/client timescaledb kafkajs @nestjs/bullmq
```

**Cursor Prompt Template**:
```
"Generate NestJS GraphQL module untuk [FEATURE] dengan Prisma schema, error handling, dan unit tests. Multi-tenant RU-aware."
```

## 📊 Hardware & Device Distribution (RU VII Kasim)

| RU | Cluster Head | Gateway | Node Sensor | Thermal Camera | Total Devices |
|----|--------------|---------|-------------|----------------|---------------|
| RU2 | 3 | 1 | 10 | 1 | **15** |
| RU3 | 3 | 1 | 4 | 1 | **9** |
| RU4 | 2 | 1 | 3 | 1 | **7** |
| RU5 | 3 | 1 | 2 | 1 | **7** |
| RU6 | 2 | 2 | 4 | 1 | **9** |
| RU7 | 11 | 1 | 5 | 1 | **18** |
| **TOTAL** | **24** | **8** | **28** | **7** | **65** |

**New Monitoring Metrics per Device**:
```yaml
battery:
  voltage: 3.0-4.2V
  soc: 0-100%
  cycles: count
  estimated_hours: int
network:
  rssi: -120 to 0 dBm
  peers_count: 0-12
  hops_to_gateway: 1-5
  quality_score: A-F
health:
  uptime_hours: float
  health_score: 0-100
  fw_version: semver
```

## 🏗️ Tech Stack (Production-Ready)

### Backend: NestJS 11 + GraphQL Federation
```
├── apps/backend/
│   ├── src/modules/
│   │   ├── auth/            # Keycloak JWT + RU Tenant Guard
│   │   ├── users/           # CRUD + RBAC
│   │   ├── devices/         # Registration + Health Monitoring
│   │   ├── sensors/         # MQTT + ML Inference
│   │   ├── thermal/         # OpenCV Plume Detection
│   │   ├── maps/            # GeoJSON RU Layouts
│   │   ├── events/          # Reports + PDF Generation
│   │   └── alerts/          # Kafka Real-time
│   ├── prisma/schema.prisma # TimescaleDB Hypertables
│   └── docker/Dockerfile
```

**Core Dependencies**:
```json
{
  "@nestjs/graphql": "^12.0.0",
  "prisma": "^5.12.0",
  "kafkajs": "^2.2.4",
  "@nestjs/bullmq": "^5.0.0",
  "class-validator": "^0.14.1"
}
```

### Frontend: Next.js 15 + Shadcn/UI + Mapbox GL
```
├── apps/frontend/
│   ├── src/app/
│   │   ├── (ru)/[ruId]/     # Parallel Routes per RU
│   │   │   ├── dashboard/
│   │   │   ├── map/
│   │   │   ├── devices/
│   │   │   └── users/
│   │   └── global/          # Cross-RU Admin
│   ├── components/
│   │   ├── ui/              # Shadcn Components
│   │   ├── map/             # Device Markers + Heatmaps
│   │   └── forms/           # Device/User Registration
│   └── lib/
│       ├── trpc/            # GraphQL Client
│       └── utils/           # Mapbox Helpers
```

**UI Dependencies**:
```bash
npx shadcn-ui@latest add table form button card dialog
npm i mapbox-gl maplibre-gl chroma-js recharts zustand lucide-react
npm i @trpc/client @trpc/server @trpc/react-query
```

## 👥 User Management (Multi-Tenant)

### Roles & Permissions Matrix

| Role | RU Scope | Permissions |
|------|----------|-------------|
| **RU_Operator** | Single | View Map/Alerts, Ack Events, View Devices |
| **RU_Supervisor** | Single | + Device Registration, Location Updates, Reports |
| **RU_Admin** | Single | + User Management, Maintenance Scheduling |
| **Global_Admin** | All | + System Config, Cross-RU Analytics, ML Models |

### User Schema
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  ruId      String   // Tenant isolation
  role      UserRole
  devices   Device[] @relation("RegisteredBy")
  createdAt DateTime @default(now())
}
```

**QR Login Flow**:
```
1. Scan QR → keycloak.ru7.local/register?token=xxx
2. Auto-assign RU_tenant_id from QR metadata
3. JWT with ruId claim → All queries filtered by tenant
```

## 🔧 Device Management (Self-Service)

### Device Registration Workflow
```
1. **Scan QR** → {mac, fw_version, capabilities, ru_id}
2. **Form Validation** → Name, Type, Initial Location
3. **Map Picker** → Drag marker within RU boundary
4. **Backend** → Validate MAC unique → MQTT bootstrap
5. **Online** → Green marker + Health metrics
```

### Drag & Drop Location Update
```tsx
function DeviceMarker({ device, onDragEnd }) {
  return (
    <Marker 
      draggable 
      position={device.location}
      onDragEnd={onDragEnd}
      icon={healthIcon(device.health_score)}
    >
      <Popup>
        <DeviceHealthCard device={device} />
        <Button onClick={() => calibrateBattery(device.id)}>
          Calibrate Battery
        </Button>
      </Popup>
    </Marker>
  )
}
```

**Device Health Schema**:
```prisma
model Device {
  id            String   @id @default(cuid())
  mac_address   String   @unique
  device_type   DeviceType
  ru_id         String
  location      Json     // {lat, lng, x_norm, y_norm}
  battery_stats Json     // {voltage, soc, cycles}
  network_stats Json     // {rssi, peers, hops}
  health_score  Int      @default(100)
  status        DeviceStatus @default(ONLINE)
  registered_by String   // user_id
  registered_at DateTime @default(now())
  
  @@index([ru_id, status])
}

enum DeviceType { SENSOR CLUSTER GATEWAY THERMAL }
enum DeviceStatus { ONLINE OFFLINE MAINTENANCE }
```

## 🗺️ Interactive Map (Enhanced)

**Layers** (Mapbox GL JS):
```
1. RU Boundary (GeoJSON polygon)
2. Device Markers (drag-enabled, health-colored)
3. LoRa Mesh (curved lines, RSSI thickness)
4. Thermal Plume (heatmap, animated)
5. Battery Heatmap (low battery clusters = red)
6. Alert Pins (severity-based)
```

**Map Interactions**:
```
- Drag device → Real-time location API call
- Click marker → Health popup + quick actions
- Filter sidebar → Type/Status/Health
- Network overlay toggle → Mesh topology
```

**Mapbox Implementation**:
```tsx
import { Map, Marker, Popup, Layer } from 'react-map-gl'

<Map
  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
  initialViewState={{
    longitude: 131.25,
    latitude: -0.86,
    zoom: 15
  }}
>
  {devices.map(device => (
    <Marker
      key={device.id}
      longitude={device.location.lng}
      latitude={device.location.lat}
      draggable={hasPermission('move_device')}
      onDragEnd={(e) => updateLocation(device.id, e.lngLat)}
    >
      <DevicePin health={device.health_score} />
    </Marker>
  ))}
</Map>
```

## 📈 Dashboard Components

### Device Health Cards
```
┌─────────────────────┐
│ 🟢 Sensor-001       │  Battery: 87% 🔋
│ Tank Farm A         │  RSSI: -62dBm 📶 
│ Health: 98% ❤️      │  Uptime: 124h ⏱️
│ [Move] [Calibrate]  │  Peers: 4/6 👥
└─────────────────────┘
```

### Real-time Metrics Table (Shadcn)
```tsx
const deviceColumns = [
  { accessorKey: "name", header: "Device" },
  { accessorKey: "location", header: "Location", 
    cell: ({ row }) => <MapPreview coords={row.original.location} /> 
  },
  { accessorKey: "battery_stats.soc", header: "Battery %",
    cell: ({ row }) => (
      <Badge variant={row.original.battery_stats.soc < 30 ? "destructive" : "default"}>
        {row.original.battery_stats.soc}%
      </Badge>
    )
  },
  { accessorKey: "network_stats.rssi", header: "RSSI" },
  { accessorKey: "health_score", header: "Health" },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => moveDevice(row.original.id)}>
            📍 Move Location
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => calibrate(row.original.id)}>
            🔋 Calibrate Battery
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => maintenance(row.original.id)}>
            🔧 Set Maintenance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
]
```

## 🔄 User Workflows

### 1. Operator Daily Routine
```
1. Login QR → RU2 Dashboard
2. Map view → Filter battery<30% 
3. Navigate → Ack low battery alert
4. Device list → Schedule replacement
5. Reports → Export daily summary
```

### 2. Supervisor Device Setup
```
1. Physical install → Scan QR registration
2. Drag marker to exact tank position
3. Test connectivity → RSSI validation
4. Set thresholds → High sensitivity zone
5. Invite operators → Team access
```

### 3. Admin Health Monitoring
```
1. Global dashboard → Cross-RU battery heatmap
2. Identify weak clusters → Plan maintenance
3. Deploy firmware update → OTA via MQTT
4. ML model retrain → Edge deployment
```

## 🛠️ Backend API (GraphQL)

```graphql
# Real-time Subscriptions
subscription deviceHealthUpdates($ruId: String!) {
  deviceHealthUpdates(ruId: $ruId) {
    id
    name
    battery {
      voltage
      soc
      estimatedHours
    }
    network {
      rssi
      peers
      qualityScore
    }
    healthScore
    timestamp
  }
}

# Device CRUD
mutation registerDevice($input: RegisterDeviceInput!) {
  registerDevice(input: $input) {
    id
    name
    macAddress
    location {
      lat
      lng
    }
    status
  }
}

mutation updateDeviceLocation($deviceId: ID!, $location: CoordinatesInput!) {
  updateDeviceLocation(deviceId: $deviceId, location: $location) {
    id
    location {
      lat
      lng
    }
  }
}

# Queries with Filters
query devices($ruId: String!, $filters: DeviceFiltersInput) {
  devices(ruId: $ruId, filters: $filters) {
    id
    name
    type
    location
    battery { soc }
    network { rssi }
    healthScore
    status
  }
}

# User Management
mutation inviteUser($input: InviteUserInput!) {
  inviteUser(input: $input) {
    id
    email
    role
    ruId
  }
}
```

**NestJS Resolver Example**:
```typescript
@Resolver(() => Device)
export class DeviceResolver {
  @Query(() => [Device])
  @UseGuards(JwtAuthGuard, RuTenantGuard)
  async devices(
    @CurrentRu() ruId: string,
    @Args('filters', { nullable: true }) filters?: DeviceFiltersInput
  ): Promise<Device[]> {
    return this.deviceService.findAll(ruId, filters)
  }

  @Mutation(() => Device)
  @UseGuards(JwtAuthGuard, PermissionGuard('device:write'))
  async updateDeviceLocation(
    @Args('deviceId') deviceId: string,
    @Args('location') location: CoordinatesInput
  ): Promise<Device> {
    return this.deviceService.updateLocation(deviceId, location)
  }

  @Subscription(() => DeviceHealth)
  @UseGuards(JwtAuthGuard)
  deviceHealthUpdates(@Args('ruId') ruId: string) {
    return this.pubSub.asyncIterator(`device_health_${ruId}`)
  }
}
```

## 📦 Docker + Kubernetes Deployment

**docker-compose.dev.yml**:
```yaml
version: '3.8'
services:
  backend:
    build: 
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/gasleak
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
      - kafka

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3001/graphql

  db:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: gasleak
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    depends_on:
      - zookeeper

  grafana:
    image: grafana/grafana-oss
    ports:
      - "3002:3000"

volumes:
  pgdata:
```

**Kubernetes HPA** (Auto-scaling):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gas-leak-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gas-leak-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: device_health_alerts_per_second
      target:
        type: AverageValue
        averageValue: "50"
```

**Helm Chart Structure**:
```
helm/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    ├── ingress.yaml
    └── secrets.yaml
```

## 🎯 Cursor Development Roadmap

### Week 1: Foundation
```
✅ User auth (Keycloak integration)
✅ Device CRUD (Prisma schema + GraphQL)
✅ Basic map (Mapbox + device markers)
```

**Cursor Commands**:
```
"Generate Keycloak JWT auth guard untuk NestJS dengan RU tenant context"
"Generate Prisma schema untuk devices dengan battery/network stats"
"Generate Next.js map page dengan Mapbox dan device markers"
```

### Week 2: Real-time Features
```
✅ Device health subscriptions (GraphQL)
✅ Drag-drop location update
✅ Battery monitoring dashboard
```

**Cursor Commands**:
```
"Generate GraphQL subscription untuk device health dengan Redis PubSub"
"Generate draggable markers di Mapbox dengan location update API"
"Generate Shadcn dashboard dengan battery cards dan charts"
```

### Week 3: Advanced Features
```
✅ QR device registration
✅ Thermal plume overlay
✅ Event reports + PDF generation
```

**Cursor Commands**:
```
"Generate QR scanner component dengan device registration flow"
"Generate thermal heatmap layer untuk Mapbox dengan Chroma.js"
"Generate PDF report generator dengan Puppeteer + event timeline"
```

### Week 4: Production Ready
```
✅ Docker + K8s deployment
✅ Grafana monitoring
✅ Load testing + optimization
```

**Cursor Commands**:
```
"Generate Docker compose untuk full stack dengan TimescaleDB dan Kafka"
"Generate Kubernetes manifests dengan HPA dan ingress"
"Generate Grafana dashboards untuk device health metrics"
```

## 📊 Production Metrics & SLA

**Performance Targets**:
```
- MQTT → Map Latency: <1 second
- GraphQL Query: <100ms (p95)
- Device Registration: <5 seconds
- Map Load Time: <2 seconds
- Battery Alert Response: <500ms
```

**Scale Capabilities**:
```
- Devices: 1000+ concurrent
- RU Sites: 20+
- Concurrent Users: 500+
- MQTT Messages: 10K/sec
- Database: 100M+ sensor readings
```

**Cost Estimate** (AWS EKS):
```
- Compute: 3x t3.large ($0.083/hr) = ~$180/mo
- Database: RDS PostgreSQL db.t3.medium = ~$70/mo
- Storage: 100GB EBS + S3 = ~$20/mo
- Network: Data transfer = ~$50/mo
- Monitoring: CloudWatch + Grafana = ~$30/mo
- Load Balancer: ALB = ~$25/mo
- Redis: ElastiCache t3.micro = ~$15/mo
- Kafka: MSK t3.small = ~$100/mo
----------------------------------------
Total: ~$490/month (production-ready)
```

## 🔐 Security Checklist

- [x] Keycloak JWT authentication
- [x] RU-based tenant isolation (row-level security)
- [x] RBAC with granular permissions
- [x] API rate limiting (100 req/min per user)
- [x] MQTT TLS encryption
- [x] Database connection pooling + prepared statements
- [x] Input validation (class-validator)
- [x] XSS protection (content security policy)
- [x] CORS whitelist (RU domains only)
- [x] Secrets management (Kubernetes secrets + Vault)
- [x] Audit logging (all device changes)
- [x] Network policies (K8s)

## 📚 Documentation Links

```
Backend API Docs: http://localhost:3001/graphql
Grafana Dashboards: http://localhost:3002
Storybook UI: http://localhost:6006
Prisma Studio: npx prisma studio
```

## 🚀 Getting Started (5 Minutes)

```bash
# 1. Clone & Install
git clone <repo> && cd gas-leak-monorepo
npm install

# 2. Setup Database
docker-compose up -d db redis
npx prisma migrate dev

# 3. Start Development
npm run dev:backend  # Port 3001
npm run dev:frontend # Port 3000

# 4. Open Browser
http://localhost:3000  → Dashboard
http://localhost:3001/graphql → GraphQL Playground
```

## 🎓 Cursor AI Prompts Library

```
# Backend
"Generate NestJS CRUD module untuk [entity] dengan Prisma, validation, error handling"
"Generate GraphQL resolver untuk [feature] dengan authentication dan RU tenant guard"
"Generate Prisma migration untuk [schema_change]"

# Frontend
"Generate Next.js page untuk [feature] dengan Shadcn components dan loading states"
"Generate Mapbox map component dengan [feature] interaction"
"Generate form dengan react-hook-form dan zod validation"

# DevOps
"Generate Dockerfile multi-stage untuk NestJS production build"
"Generate K8s deployment dengan health checks dan resource limits"
"Generate GitHub Actions CI/CD pipeline dengan testing dan deployment"
```

---

**Generated**: 2026-03-04 11:15 WIB  
**Version**: v2.1 (User & Device Management)  
**Ready for**: Cursor AI + Claude 3.5 Sonnet  
**Status**: ✅ Production-Ready Architecture
