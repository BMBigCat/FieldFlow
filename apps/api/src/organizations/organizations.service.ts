import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import type { Organization, UpdateOrganizationRequest } from "@fieldflow/shared-types";
import type { RequestUser } from "../auth/request-user";
import { toOrganization } from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

@Injectable()
export class OrganizationsService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async getMine(user: RequestUser): Promise<Organization> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped.from("organizations").select("*").eq("id", user.orgId).single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to load organization");
    }
    return toOrganization(data);
  }

  async updateMine(user: RequestUser, dto: UpdateOrganizationRequest): Promise<Organization> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const patch: Record<string, unknown> = { brand_updated_at: new Date().toISOString() };
    if (dto.displayName !== undefined) patch.display_name = dto.displayName;
    if (dto.brandPrimaryColor !== undefined) patch.brand_primary_color = dto.brandPrimaryColor;
    if (dto.defaultLaborRate !== undefined) patch.default_labor_rate = dto.defaultLaborRate;

    const { data, error } = await scoped
      .from("organizations")
      .update(patch)
      .eq("id", user.orgId)
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to update organization");
    }
    return toOrganization(data);
  }

  async updateLogo(user: RequestUser, file: Express.Multer.File): Promise<Organization> {
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Logo must be a PNG, JPEG, WebP, or SVG image");
    }

    const scoped = this.userClientFactory.forToken(user.accessToken);
    const extension = file.originalname.split(".").pop() ?? "png";
    const path = `${user.orgId}/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await scoped.storage.from("logos").upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (uploadError) {
      throw new InternalServerErrorException(uploadError.message);
    }

    const { data: publicUrlData } = scoped.storage.from("logos").getPublicUrl(path);

    const { data, error } = await scoped
      .from("organizations")
      .update({ logo_url: publicUrlData.publicUrl, brand_updated_at: new Date().toISOString() })
      .eq("id", user.orgId)
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to save logo URL");
    }
    return toOrganization(data);
  }
}
