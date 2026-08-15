import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MaintenancePlansController } from "./maintenance-plans.controller";
import { MaintenancePlansService } from "./maintenance-plans.service";

@Module({
  imports: [AuthModule],
  controllers: [MaintenancePlansController],
  providers: [MaintenancePlansService],
})
export class MaintenancePlansModule {}
