import { GraphQLClient } from 'graphql-request';

const endpoint =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://127.0.0.1:3001/graphql';

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
  name: string;
  ruId: string;
  parentMac?: string | null;
  type: string;
  location: DeviceLocation;
  battery: BatteryMetrics;
  network: NetworkMetrics;
  healthScore: number;
  latestPpm?: number;
  status: string;
}

const DEVICES_QUERY = /* GraphQL */ `
  query Devices($ruId: String!) {
    devices(ruId: $ruId) {
      id
      name
      ruId
      type
      parentMac
      location { lat lng }
      battery { voltage soc cycles estimatedHours }
      network { rssi rssiMesh rssiStar peersCount hopsToGateway qualityScore parentMac }
      healthScore
      latestPpm
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
  ppm: number;
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
        ppm
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

export interface AnalyticsStats {
  weeklyTrends: WeeklyTrendEntry[];
  incidentsHeatmap: HeatmapEntry[];
  siteRankings: SiteRanking[];
}

const ANALYTICS_QUERY = /* GraphQL */ `
  query GetAnalytics {
    getAnalytics {
      weeklyTrends {
        day
        avgPpm
        alertCount
      }
      incidentsHeatmap {
        day
        hour
        value
      }
      siteRankings {
        ru
        uptime
        incidents
        avgResponseTime
      }
    }
  }
`;

export async function fetchAnalytics(): Promise<AnalyticsStats> {
  const data = await graphqlClient.request<{ getAnalytics: AnalyticsStats }>(ANALYTICS_QUERY);
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
  query Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
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

export async function fetchUsers(): Promise<User[]> {
  const data = await graphqlClient.request<{ users: User[] }>(USERS_QUERY);
  return data.users;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await graphqlClient.request<{ login: LoginResult }>(LOGIN_QUERY, { email, password });
  return data.login;
}

export async function createUser(input: any, creatorId: string): Promise<User> {
  const data = await graphqlClient.request<{ createUser: User }>(CREATE_USER_MUTATION, { input, creatorId });
  return data.createUser;
}

export async function deleteUser(id: string): Promise<boolean> {
  const data = await graphqlClient.request<{ deleteUser: boolean }>(DELETE_USER_MUTATION, { id });
  return data.deleteUser;
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
