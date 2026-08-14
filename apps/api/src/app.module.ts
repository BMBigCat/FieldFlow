import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { HealthModule } from "./health/health.module";
import { JobsModule } from "./jobs/jobs.module";
import { OrganizationsModule } from "./organizations/organizations.module";
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
  ],
})
export class AppModule {}
