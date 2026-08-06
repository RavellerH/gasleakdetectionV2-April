import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Device, DashboardStats, SystemSettings, RuSite, SensorTimeline, AnalyticsStats, User, LoginResult, EventLog } from './device.model';
import { DeviceService } from './device.service';
import { UseGuards } from '@nestjs/common';
import { AdminGuard, GqlAuthGuard } from '../auth/auth';

/**
 * Read-only GraphQL API — deliberately mirrors apps/backend's query shapes
 * (devices, getDashboardStats, getAnalytics, eventLogs, sensorTimeline,
 * getSettings, users, login) so apps/frontend needs zero code changes,
 * only NEXT_PUBLIC_GRAPHQL_URL pointed at this service. No mutations are
 * exposed — RU sites are the only writers.
 */
@Resolver(() => Device)
export class DeviceResolver {
  constructor(private readonly deviceService: DeviceService) {}

  @Query(() => DashboardStats)
  @UseGuards(GqlAuthGuard)
  async getDashboardStats(): Promise<DashboardStats> {
    return this.deviceService.getDashboardStats();
  }

  @Query(() => SystemSettings)
  @UseGuards(GqlAuthGuard)
  async getSettings(): Promise<SystemSettings> {
    return this.deviceService.getSettings();
  }

  @Query(() => [Device])
  @UseGuards(GqlAuthGuard)
  async devices(
    @Args('ruId', { type: () => String }) ruId: string
  ): Promise<Device[]> {
    return this.deviceService.findAll(ruId);
  }

  @Query(() => [SensorTimeline])
  @UseGuards(GqlAuthGuard)
  async sensorTimeline(
    @Args('ruId', { type: () => String }) ruId: string,
  ): Promise<SensorTimeline[]> {
    return this.deviceService.getSensorTimeline(ruId);
  }

  @Query(() => [RuSite])
  @UseGuards(GqlAuthGuard)
  async ruSites(): Promise<{ id: string }[]> {
    return this.deviceService.getRuSites();
  }

  @Query(() => AnalyticsStats)
  @UseGuards(GqlAuthGuard)
  async getAnalytics(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('hours', { type: () => Int, nullable: true }) hours?: number,
  ): Promise<AnalyticsStats> {
    return this.deviceService.getAnalytics(ruId, hours ?? 24);
  }

  @Query(() => [User])
  @UseGuards(GqlAuthGuard, AdminGuard)
  async users(): Promise<User[]> {
    return this.deviceService.users();
  }

  @Query(() => LoginResult)
  async login(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
  ): Promise<LoginResult> {
    return this.deviceService.login(email, password);
  }

  @Query(() => [EventLog])
  @UseGuards(GqlAuthGuard)
  async eventLogs(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<EventLog[]> {
    return this.deviceService.getEventLogs({ ruId, limit });
  }
}
