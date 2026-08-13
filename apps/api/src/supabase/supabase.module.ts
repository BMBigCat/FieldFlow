import { Global, Module } from "@nestjs/common";
import { SupabaseAdminService } from "./supabase-admin.service";
import { SupabaseAnonService } from "./supabase-anon.service";
import { SupabaseUserClientFactory } from "./supabase-user-client.factory";

@Global()
@Module({
  providers: [SupabaseAdminService, SupabaseAnonService, SupabaseUserClientFactory],
  exports: [SupabaseAdminService, SupabaseAnonService, SupabaseUserClientFactory],
})
export class SupabaseModule {}
