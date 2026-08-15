import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { buildRedisConnectionOptions } from "./redis-connection";

export const RECURRING_MAINTENANCE_QUEUE = "recurring-maintenance";
export const JOB_REMINDERS_QUEUE = "job-reminders";

/** Build plan §6.2 background job + §2.5 job_reminder — real BullMQ/Upstash queues (Phase 6 gap close). */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisConnectionOptions(config.getOrThrow<string>("REDIS_URL")),
      }),
    }),
    BullModule.registerQueue({ name: RECURRING_MAINTENANCE_QUEUE }, { name: JOB_REMINDERS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
