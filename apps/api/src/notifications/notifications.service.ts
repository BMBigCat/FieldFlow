import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { RequestUser } from "../auth/request-user";
import { SupabaseAdminService } from "../supabase/supabase-admin.service";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  /**
   * `users` only has RLS UPDATE policies for admins managing other org
   * members (0001_init.sql/0003) — there's no self-service policy yet, and
   * adding one means column-level grants to keep it from also opening up
   * self-editing `role`/`org_id`, which is more than this checkpoint needs.
   * Using the service-role client here instead, narrowly: only `push_token`,
   * only for this exact authenticated user's own id.
   */
  async registerPushToken(user: RequestUser, dto: RegisterPushTokenDto): Promise<void> {
    const { error } = await this.supabaseAdmin.client
      .from("users")
      .update({ push_token: dto.pushToken })
      .eq("id", user.id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
