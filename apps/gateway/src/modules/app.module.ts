import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import type { Request } from 'express';
import { DeviceModule } from './devices/device.module';
import { SyncModule } from './sync/sync.module';
import { extractUserFromRequest } from './auth/auth';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req }: { req: Request }) => ({ req, user: extractUserFromRequest(req) })
    }),
    DeviceModule,
    SyncModule,
  ]
})
export class AppModule {}
