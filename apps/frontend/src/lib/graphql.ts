import { GraphQLClient } from 'graphql-request';

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://127.0.0.1:4000/graphql';

export const graphqlClient = new GraphQLClient(endpoint);

export interface DeviceLocation {
  lat: number;
  lng: number;
}

export interface BatteryMetrics {
  voltage: number;
  soc: number;
  cycles?: number | null;
  estimatedHours?: number | null;
}

export interface NetworkMetrics {
  rssi: number;
  rssiMesh?: number | null;
  rssiStar?: number | null;
  peersCount?: number | null;
  hopsToGateway?: number | null;
  qualityScore?: string | null;
  parentMac?: string | null;
}

export interface Device {
  id: string;
  macAddress: string;
  name: string;
  ruId: string;
  parentMac?: string | null;
  type: string;
  location: DeviceLocation;
  battery: BatteryMetrics;
  network: NetworkMetrics;
  healthScore: number;
  latestConfidence?: number;
  status: string;
}

const DEVICES_QUERY = /* GraphQL */ `
  query Devices($ruId: String!) {
    devices(ruId: $ruId) {
      id
      macAddress
      name
      ruId
      type
      parentMac
      location { lat lng }
      battery { voltage soc cycles estimatedHours }
      network { rssi rssiMesh rssiStar peersCount hopsToGateway qualityScore parentMac }
      healthScore
      latestConfidence
      status
    }
  }
`;

const UPDATE_DEVICE_LOCATION_MUTATION = /* GraphQL */ `
  mutation UpdateDeviceLocation($deviceId: String!, $location: CoordinatesInput!) {
    updateDeviceLocation(deviceId: $deviceId, location: $location) {
      id
      location { lat lng }
    }
  }
`;

const UPDATE_DEVICE_NAME_MUTATION = /* GraphQL */ `
  mutation UpdateDeviceName($deviceId: String!, $name: String!) {
    updateDeviceName(deviceId: $deviceId, name: $name) {
      id
      name
    }
  }
`;

export interface RuStats {
  ru: string;
  total: number;
  online: number;
  alerts: number;
  health: number;
  clusterHead: number;
  gateway: number;
  nodeSensor: number;
}

export interface TimelineEntry {
  time: string;
  confidence: number;
  alerts: number;
}

export interface Alert {
  id: string;
  severity: string;
  message: string;
  ru: string;
  time: string;
  device: string;
  status: string;
  type: string;
  scenario: string;
  resolvedAt?: string;
  notes?: string;
}

export interface BatteryDistEntry {
  range: string;
  count: number;
  fill: string;
}

export interface NetworkQualityEntry {
  grade: string;
  count: number;
  fill: string;
}

export interface DashboardStats {
  ruData: RuStats[];
  timelineData: TimelineEntry[];
  recentAlerts: Alert[];
  batteryDist: BatteryDistEntry[];
  networkQuality: NetworkQualityEntry[];
  totalDevices: number;
  onlineDevices: number;
  totalAlerts: number;
  avgHealth: number;
}

const DASHBOARD_STATS_QUERY = /* GraphQL */ `
  query GetDashboardStats {
    getDashboardStats {
      ruData {
        ru
        total
        online
        alerts
        health
        clusterHead
        gateway
        nodeSensor
      }
      timelineData {
        time
        confidence
        alerts
      }
      recentAlerts {
        id
        severity
        message
        ru
        time
        device
        status
        type
        scenario
        resolvedAt
        notes
      }
      batteryDist {
        range
        count
        fill
      }
      networkQuality {
        grade
        count
        fill
      }
      totalDevices
      onlineDevices
      totalAlerts
      avgHealth
    }
  }
`;

export interface WeeklyTrendEntry {
  day: string;
  avgPpm: number;
  alertCount: number;
}

export interface HeatmapEntry {
  day: string;
  hour: number;
  value: number;
}

export interface SiteRanking {
  ru: string;
  uptime: number;
  incidents: number;
  avgResponseTime: number;
}

export interface TrendPoint { label: string; avgPpm: number; breachCount: number; }

export interface RuComparisonEntry {
  ruId: string; avgPpm: number; maxPpm: number; breachCount: number;
  totalDevices: number; onlineDevices: number; avgHealth: number;
}

export interface HeatmapCell { hour: number; ruId: string; avgPpm: number; }

export interface TopSensorEntry {
  deviceId: string; deviceName: string; ruId: string;
  avgPpm: number; maxPpm: number; breachCount: number;
}

export interface FleetBatteryBucket { range: string; count: number; }
export interface FleetNetworkBucket { grade: string; count: number; }
export interface FleetHealthStats {
  online: number; offline: number; total: number;
  batteryDist: FleetBatteryBucket[];
  networkDist: FleetNetworkBucket[];
}

export interface AnalyticsStats {
  weeklyTrends: WeeklyTrendEntry[];
  incidentsHeatmap: HeatmapEntry[];
  siteRankings: SiteRanking[];
  trendData: TrendPoint[];
  ruComparison: RuComparisonEntry[];
  heatmap: HeatmapCell[];
  topSensors: TopSensorEntry[];
  fleetHealth: FleetHealthStats;
}

const ANALYTICS_QUERY = /* GraphQL */ `
  query GetAnalytics($ruId: String, $hours: Int) {
    getAnalytics(ruId: $ruId, hours: $hours) {
      weeklyTrends { day avgPpm alertCount }
      siteRankings { ru uptime incidents avgResponseTime }
      trendData { label avgPpm breachCount }
      ruComparison { ruId avgPpm maxPpm breachCount totalDevices onlineDevices avgHealth }
      heatmap { hour ruId avgPpm }
      topSensors { deviceId deviceName ruId avgPpm maxPpm breachCount }
      fleetHealth {
        online offline total
        batteryDist { range count }
        networkDist { grade count }
      }
    }
  }
`;

export async function fetchAnalytics(params?: { ruId?: string; hours?: number }): Promise<AnalyticsStats> {
  const data = await graphqlClient.request<{ getAnalytics: AnalyticsStats }>(ANALYTICS_QUERY, {
    ruId: params?.ruId,
    hours: params?.hours,
  });
  return data.getAnalytics;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  ruId: string;
  role: string;
  createdAt: string;
}

export interface LoginResult {
  user?: User | null;
  error?: string | null;
}

const USERS_QUERY = /* GraphQL */ `
  query GetUsers {
    users {
      id
      email
      name
      ruId
      role
      createdAt
    }
  }
`;

const LOGIN_QUERY = /* GraphQL */ `
  query Login($email: String!) {
    login(email: $email) {
      user { id email name ruId role }
      error
    }
  }
`;

const CREATE_USER_MUTATION = /* GraphQL */ `
  mutation CreateUser($input: CreateUserInput!, $creatorId: String!) {
    createUser(input: $input, creatorId: $creatorId) {
      id
      email
      name
      role
    }
  }
`;

const DELETE_USER_MUTATION = /* GraphQL */ `
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;

const RU_SITES_QUERY = /* GraphQL */ `
  query GetRUSites {
    ruSites {
      id
    }
  }
`;

export interface RuSite {
  id: string;
}

export async function fetchRuSites(): Promise<RuSite[]> {
  const data = await graphqlClient.request<{ ruSites: RuSite[] }>(RU_SITES_QUERY);
  return data.ruSites;
}

export async function fetchUsers(): Promise<User[]> {
  const data = await graphqlClient.request<{ users: User[] }>(USERS_QUERY);
  return data.users;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
  ruId: string;
  role: string;
}

export async function login(email: string): Promise<LoginResult> {
  const data = await graphqlClient.request<{ login: LoginResult }>(LOGIN_QUERY, { email });
  return data.login;
}

export async function createUser(input: CreateUserInput, creatorId: string): Promise<User> {
  const data = await graphqlClient.request<{ createUser: User }>(CREATE_USER_MUTATION, { input, creatorId });
  return data.createUser;
}

export async function deleteUser(id: string): Promise<boolean> {
  const data = await graphqlClient.request<{ deleteUser: boolean }>(DELETE_USER_MUTATION, { id });
  return data.deleteUser;
}

const UPDATE_USER_MUTATION = /* GraphQL */ `
  mutation UpdateUser($id: String!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id email name ruId role createdAt
    }
  }
`;

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
  ruId?: string;
  role?: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const data = await graphqlClient.request<{ updateUser: User }>(UPDATE_USER_MUTATION, { id, input });
  return data.updateUser;
}

const DELETE_DEVICE_MUTATION = /* GraphQL */ `
  mutation DeleteDevice($id: String!) {
    deleteDevice(id: $id)
  }
`;

const UPDATE_DEVICE_MUTATION = /* GraphQL */ `
  mutation UpdateDevice($id: String!, $input: UpdateDeviceInput!) {
    updateDevice(id: $id, input: $input) {
      id macAddress name ruId type healthScore status
      location { lat lng }
      battery { voltage soc }
      network { rssi qualityScore }
    }
  }
`;

const CREATE_DEVICE_MUTATION = /* GraphQL */ `
  mutation CreateDevice($input: CreateDeviceInput!) {
    createDevice(input: $input) {
      id macAddress name ruId type healthScore status
      location { lat lng }
      battery { voltage soc }
      network { rssi qualityScore }
    }
  }
`;

export interface UpdateDeviceInput {
  name?: string;
  deviceType?: string;
  ruId?: string;
  status?: string;
}

export async function deleteDevice(id: string): Promise<boolean> {
  const data = await graphqlClient.request<{ deleteDevice: boolean }>(DELETE_DEVICE_MUTATION, { id });
  return data.deleteDevice;
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<Device> {
  const data = await graphqlClient.request<{ updateDevice: Device }>(UPDATE_DEVICE_MUTATION, { id, input });
  return data.updateDevice;
}

export async function createDevice(input: {
  macAddress: string;
  name?: string;
  deviceType: string;
  ruId: string;
  location: { lat: number; lng: number };
  registeredBy: string;
}): Promise<Device> {
  const data = await graphqlClient.request<{ createDevice: Device }>(CREATE_DEVICE_MUTATION, { input });
  return data.createDevice;
}

export async function fetchAllDevices(): Promise<Device[]> {
  return fetchDevices('ALL');
}

export interface SystemSettings {
  id: number;
  warningThreshold: number;
  criticalThreshold: number;
  refreshInterval: number;
}

const SETTINGS_QUERY = /* GraphQL */ `
  query GetSettings {
    getSettings {
      id
      warningThreshold
      criticalThreshold
      refreshInterval
    }
  }
`;

const UPDATE_SETTINGS_MUTATION = /* GraphQL */ `
  mutation UpdateSettings($input: UpdateSettingsInput!) {
    updateSettings(input: $input) {
      id
      warningThreshold
      criticalThreshold
      refreshInterval
    }
  }
`;

export async function fetchSettings(): Promise<SystemSettings> {
  const data = await graphqlClient.request<{ getSettings: SystemSettings }>(
    SETTINGS_QUERY
  );
  return data.getSettings;
}

export async function updateSettings(input: {
  warningThreshold?: number;
  criticalThreshold?: number;
  refreshInterval?: number;
}): Promise<SystemSettings> {
  const data = await graphqlClient.request<{ updateSettings: SystemSettings }>(
    UPDATE_SETTINGS_MUTATION,
    { input }
  );
  return data.updateSettings;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const data = await graphqlClient.request<{ getDashboardStats: DashboardStats }>(
    DASHBOARD_STATS_QUERY
  );
  return data.getDashboardStats;
}

export async function fetchDevices(ruId: string): Promise<Device[]> {
  const data = await graphqlClient.request<{ devices: Device[] }>(
    DEVICES_QUERY,
    { ruId }
  );
  return data.devices;
}

export async function updateDeviceLocation(
  deviceId: string,
  location: { lat: number; lng: number }
): Promise<{ id: string; location: DeviceLocation } | null> {
  const data = await graphqlClient.request<{
    updateDeviceLocation: { id: string; location: DeviceLocation } | null;
  }>(UPDATE_DEVICE_LOCATION_MUTATION, { deviceId, location });
  return data.updateDeviceLocation;
}

export async function updateDeviceName(
  deviceId: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const data = await graphqlClient.request<{
    updateDeviceName: { id: string; name: string } | null;
  }>(UPDATE_DEVICE_NAME_MUTATION, { deviceId, name });
  return data.updateDeviceName;
}

// ── EVENT LOG ──────────────────────────────────────────────────

export interface EventLog {
  id: string;
  type: string;
  severity: string;
  deviceId?: string | null;
  ruId?: string | null;
  operatorId?: string | null;
  operatorEmail?: string | null;
  message: string;
  details?: string | null;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  ackNote?: string | null;
  timestamp: string;
}

const EVENT_LOG_FIELDS = `
  id type severity deviceId ruId operatorId operatorEmail
  message details acknowledged acknowledgedBy acknowledgedAt ackNote timestamp
`;

const EVENT_LOGS_QUERY = /* GraphQL */ `
  query EventLogs($ruId: String, $limit: Int) {
    eventLogs(ruId: $ruId, limit: $limit) { ${EVENT_LOG_FIELDS} }
  }
`;

const CREATE_EVENT_LOG_MUTATION = /* GraphQL */ `
  mutation CreateEventLog($input: CreateEventLogInput!) {
    createEventLog(input: $input) { ${EVENT_LOG_FIELDS} }
  }
`;

const ACKNOWLEDGE_EVENT_MUTATION = /* GraphQL */ `
  mutation AcknowledgeEvent($id: String!, $note: String!, $operatorId: String!, $operatorEmail: String!) {
    acknowledgeEvent(id: $id, note: $note, operatorId: $operatorId, operatorEmail: $operatorEmail) { ${EVENT_LOG_FIELDS} }
  }
`;

export async function fetchEventLogs(filter?: { ruId?: string; limit?: number }): Promise<EventLog[]> {
  const data = await graphqlClient.request<{ eventLogs: EventLog[] }>(EVENT_LOGS_QUERY, {
    ruId: filter?.ruId,
    limit: filter?.limit,
  });
  return data.eventLogs;
}

export async function createEventLog(input: {
  type: string; severity?: string; deviceId?: string; ruId?: string;
  operatorId?: string; operatorEmail?: string; message: string; details?: string;
}): Promise<EventLog> {
  const data = await graphqlClient.request<{ createEventLog: EventLog }>(CREATE_EVENT_LOG_MUTATION, { input });
  return data.createEventLog;
}

export async function acknowledgeEvent(
  id: string, note: string, operatorId: string, operatorEmail: string
): Promise<EventLog> {
  const data = await graphqlClient.request<{ acknowledgeEvent: EventLog }>(ACKNOWLEDGE_EVENT_MUTATION, {
    id, note, operatorId, operatorEmail,
  });
  return data.acknowledgeEvent;
}

// ── SENSOR TIMELINE ────────────────────────────────────────────

export interface SensorDataPoint {
  hour: string;
  confidence: number;
}

export interface SensorTimeline {
  deviceId: string;
  deviceName: string;
  ruId: string;
  data: SensorDataPoint[];
}

const SENSOR_TIMELINE_QUERY = /* GraphQL */ `
  query SensorTimeline($ruId: String!) {
    sensorTimeline(ruId: $ruId) {
      deviceId deviceName ruId
      data { hour confidence }
    }
  }
`;

export async function fetchSensorTimeline(ruId: string): Promise<SensorTimeline[]> {
  const data = await graphqlClient.request<{ sensorTimeline: SensorTimeline[] }>(
    SENSOR_TIMELINE_QUERY, { ruId }
  );
  return data.sensorTimeline;
}
