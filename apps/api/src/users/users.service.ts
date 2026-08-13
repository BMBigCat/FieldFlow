import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { User } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { toUser } from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";

@Injectable()
export class UsersService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async list(user: RequestUser): Promise<User[]> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped.from("users").select("*").order("full_name", { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []).map(toUser);
  }
}
