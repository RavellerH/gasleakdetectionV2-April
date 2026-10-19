import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import type { Request } from 'express';
import { DeviceModule } from './devices/device.module';
import { IngestModule } from './ingest/ingest.module';
import { extractUserFromRequest } from './auth/auth';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req }: { req: Request }) => ({ req, user: extractUserFromRequest(req) })
    }),
    DeviceModule,
    IngestModule
  ]
})
export class AppModule {}

