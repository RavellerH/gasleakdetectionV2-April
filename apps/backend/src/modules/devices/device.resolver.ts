import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CoordinatesInput, CreateDeviceInput, Device, GasReading, DashboardStats, SystemSettings, UpdateSettingsInput, User, CreateUserInput, LoginResult } from './device.model';
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
    @Args('ppm', { type: () => Number }) ppm: number
  ): Promise<GasReading> {
    return this.deviceService.addReading(macAddress, ppm);
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
}

