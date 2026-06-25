import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import type { Request } from 'express';
import { DeviceModule } from './devices/device.module';
import { MqttConsumerModule } from './mqtt/mqtt-consumer.module';
import { CommissioningModule } from './commissioning/commissioning.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }: { req: Request }) => ({ req })
    }),
    DeviceModule,
    MqttConsumerModule,
    CommissioningModule
  ]
})
export class AppModule {}

