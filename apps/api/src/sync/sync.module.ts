import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JobsModule } from "../jobs/jobs.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [AuthModule, JobsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
