import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MaintenancePlansController } from "./maintenance-plans.controller";
import { MaintenancePlansService } from "./maintenance-plans.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MaintenancePlansController],
  providers: [MaintenancePlansService],
  exports: [MaintenancePlansService],
})
export class MaintenancePlansModule {}
