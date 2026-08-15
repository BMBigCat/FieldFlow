import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { HealthModule } from "./health/health.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { JobsModule } from "./jobs/jobs.module";
import { MaintenancePlansModule } from "./maintenance-plans/maintenance-plans.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ReportsModule } from "./reports/reports.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { SyncModule } from "./sync/sync.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    SupabaseModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    UsersModule,
    JobsModule,
    SyncModule,
    InvoicesModule,
    NotificationsModule,
    MaintenancePlansModule,
    SchedulingModule,
    ReportsModule,
  ],
})
export class AppModule {}
