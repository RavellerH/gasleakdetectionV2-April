import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User, CreateUserInput, LoginResult, AnalyticsStats } from './device.model';
import { DeviceService } from './device.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly deviceService: DeviceService) {}

  @Query(() => AnalyticsStats)
  async getAnalytics(): Promise<AnalyticsStats> {
    return this.deviceService.getAnalytics();
  }

  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.deviceService.users();
  }

  @Query(() => LoginResult)
  async login(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string
  ): Promise<LoginResult> {
    return this.deviceService.login(email, password);
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
}
