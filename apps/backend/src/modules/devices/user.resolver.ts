import { Args, Mutation, Query, Resolver, Int } from '@nestjs/graphql';
import { User, CreateUserInput, LoginResult, AnalyticsStats, EventLog, CreateEventLogInput } from './device.model';
import { DeviceService } from './device.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly deviceService: DeviceService) {}

  @Query(() => AnalyticsStats)
  async getAnalytics(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('hours', { type: () => Int, nullable: true }) hours?: number,
  ): Promise<AnalyticsStats> {
    return this.deviceService.getAnalytics(ruId, hours ?? 24);
  }

  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.deviceService.users();
  }

  @Query(() => LoginResult)
  async login(
    @Args('email', { type: () => String }) email: string,
  ): Promise<LoginResult> {
    return this.deviceService.login(email);
  }

  @Mutation(() => User)
  async createUser(
    @Args('input', { type: () => CreateUserInput }) input: CreateUserInput,
    @Args('creatorId', { type: () => String }) creatorId: string
  ): Promise<User> {
    return this.deviceService.createUser(input, creatorId);
  }

  @Mutation(() => Boolean)
  async deleteUser(
    @Args('id', { type: () => String }) id: string
  ): Promise<boolean> {
    return this.deviceService.deleteUser(id);
  }

  @Query(() => [EventLog])
  async eventLogs(
    @Args('ruId', { type: () => String, nullable: true }) ruId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<EventLog[]> {
    return this.deviceService.getEventLogs({ ruId, limit });
  }

  @Mutation(() => EventLog)
  async createEventLog(
    @Args('input', { type: () => CreateEventLogInput }) input: CreateEventLogInput,
  ): Promise<EventLog> {
    return this.deviceService.createEventLog(input);
  }

  @Mutation(() => EventLog)
  async acknowledgeEvent(
    @Args('id', { type: () => String }) id: string,
    @Args('note', { type: () => String }) note: string,
    @Args('operatorId', { type: () => String }) operatorId: string,
    @Args('operatorEmail', { type: () => String }) operatorEmail: string,
  ): Promise<EventLog> {
    return this.deviceService.acknowledgeEvent(id, note, operatorId, operatorEmail);
  }
}
