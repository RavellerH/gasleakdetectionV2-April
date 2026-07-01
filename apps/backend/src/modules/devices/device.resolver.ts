import { Args, Int, Mutation, Query, Resolver, Float } from '@nestjs/graphql';
import { CoordinatesInput, CreateDeviceInput, UpdateDeviceInput, Device, GasReading, DashboardStats, SystemSettings, UpdateSettingsInput, User, CreateUserInput, LoginResult, RuSite, SensorTimeline } from './device.model';
import { DeviceService } from './device.service';

@Resolver(() => Device)
export class DeviceResolver {
  constructor(private readonly deviceService: DeviceService) {}

  // --- STATS & SETTINGS ---

  @Query(() => DashboardStats)
  async getDashboardStats(): Promise<DashboardStats> {
    return this.deviceService.getDashboardStats();
  }

  @Query(() => SystemSettings)
  async getSettings(): Promise<SystemSettings> {
    return this.deviceService.getSettings();
  }

  @Mutation(() => SystemSettings)
  async updateSettings(
    @Args('input') input: UpdateSettingsInput
  ): Promise<SystemSettings> {
    return this.deviceService.updateSettings(input);
  }

  @Mutation(() => GasReading)
  async addReading(
    @Args('macAddress', { type: () => String }) macAddress: string,
    @Args('confidence', { type: () => Float }) confidence: number,
    @Args('aiClass', { type: () => Int, nullable: true, defaultValue: 0 }) aiClass: number
  ): Promise<GasReading> {
    return this.deviceService.addReading(macAddress, confidence, aiClass);
  }

  @Query(() => [Device])
  async devices(
    @Args('ruId', { type: () => String }) ruId: string
  ): Promise<Device[]> {
    return this.deviceService.findAll(ruId);
  }

  @Mutation(() => Device)
  async createDevice(
    @Args('input') input: CreateDeviceInput
  ): Promise<Device> {
    return this.deviceService.create(input);
  }

  @Mutation(() => Device, { nullable: true })
  async updateDeviceLocation(
    @Args('deviceId', { type: () => String }) deviceId: string,
    @Args('location') location: CoordinatesInput
  ): Promise<Device | null> {
    return this.deviceService.updateLocation(deviceId, location);
  }

  @Mutation(() => Device, { nullable: true })
  async updateDeviceName(
    @Args('deviceId', { type: () => String }) deviceId: string,
    @Args('name', { type: () => String }) name: string
  ): Promise<Device | null> {
    return this.deviceService.updateName(deviceId, name);
  }

  @Mutation(() => Boolean)
  async deleteDevice(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return this.deviceService.deleteDevice(id);
  }

  @Mutation(() => Device)
  async updateDevice(
    @Args('id', { type: () => String }) id: string,
    @Args('input', { type: () => UpdateDeviceInput }) input: UpdateDeviceInput,
  ): Promise<Device> {
    return this.deviceService.updateDevice(id, input);
  }

  @Query(() => [SensorTimeline])
  async sensorTimeline(
    @Args('ruId', { type: () => String }) ruId: string,
  ): Promise<SensorTimeline[]> {
    return this.deviceService.getSensorTimeline(ruId);
  }
}

