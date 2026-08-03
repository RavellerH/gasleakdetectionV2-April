import { Args, Int, Mutation, Query, Resolver, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CoordinatesInput, CreateDeviceInput, UpdateDeviceInput, Device, GasReading, DashboardStats, SystemSettings, UpdateSettingsInput, User, CreateUserInput, LoginResult, RuSite, SensorTimeline, GatewayPullResult } from './device.model';
import { DeviceService } from './device.service';
import { GatewayKeyGuard } from './gateway-key.guard';
import { AdminGuard, GqlAuthGuard, IngestKeyGuard } from '../auth/auth';

@Resolver(() => Device)
export class DeviceResolver {
  constructor(private readonly deviceService: DeviceService) {}

  // --- STATS & SETTINGS ---

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

  @Mutation(() => SystemSettings)
  @UseGuards(GqlAuthGuard, AdminGuard)
  async updateSettings(
    @Args('input') input: UpdateSettingsInput
  ): Promise<SystemSettings> {
    return this.deviceService.updateSettings(input);
  }

  @Mutation(() => GasReading)
  @UseGuards(IngestKeyGuard)
  async addReading(
    @Args('macAddress', { type: () => String }) macAddress: string,
    @Args('confidence', { type: () => Float }) confidence: number,
    @Args('aiClass', { type: () => Int, nullable: true, defaultValue: 0 }) aiClass: number
  ): Promise<GasReading> {
    return this.deviceService.addReading(macAddress, confidence, aiClass);
  }

  @Query(() => [Device])
  @UseGuards(GqlAuthGuard)
  async devices(
    @Args('ruId', { type: () => String }) ruId: string
  ): Promise<Device[]> {
    return this.deviceService.findAll(ruId);
  }

  @Mutation(() => Device)
  @UseGuards(GqlAuthGuard, AdminGuard)
  async createDevice(
    @Args('input') input: CreateDeviceInput
  ): Promise<Device> {
    return this.deviceService.create(input);
  }

  @Mutation(() => Device, { nullable: true })
  @UseGuards(GqlAuthGuard, AdminGuard)
  async updateDeviceLocation(
    @Args('deviceId', { type: () => String }) deviceId: string,
    @Args('location') location: CoordinatesInput
  ): Promise<Device | null> {
    return this.deviceService.updateLocation(deviceId, location);
  }

  @Mutation(() => Device, { nullable: true })
  @UseGuards(GqlAuthGuard, AdminGuard)
  async updateDeviceName(
    @Args('deviceId', { type: () => String }) deviceId: string,
    @Args('name', { type: () => String }) name: string
  ): Promise<Device | null> {
    return this.deviceService.updateName(deviceId, name);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, AdminGuard)
  async deleteDevice(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return this.deviceService.deleteDevice(id);
  }

  @Mutation(() => Device)
  @UseGuards(GqlAuthGuard, AdminGuard)
  async updateDevice(
    @Args('id', { type: () => String }) id: string,
    @Args('input', { type: () => UpdateDeviceInput }) input: UpdateDeviceInput,
  ): Promise<Device> {
    return this.deviceService.updateDevice(id, input);
  }

  @Query(() => [SensorTimeline])
  @UseGuards(GqlAuthGuard)
  async sensorTimeline(
    @Args('ruId', { type: () => String }) ruId: string,
  ): Promise<SensorTimeline[]> {
    return this.deviceService.getSensorTimeline(ruId);
  }

  @UseGuards(GatewayKeyGuard)
  @Query(() => GatewayPullResult)
  async gatewayPull(
    @Args('since', { type: () => String }) since: string,
  ): Promise<GatewayPullResult> {
    return this.deviceService.getGatewayPull(new Date(since));
  }
}

