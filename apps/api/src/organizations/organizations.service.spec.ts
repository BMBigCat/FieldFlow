import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn().mockReturnValue(builder);
  builder.update = jest.fn().mockReturnValue(builder);
  builder.eq = jest.fn().mockReturnValue(builder);
  builder.single = jest.fn().mockResolvedValue(result);
  return builder;
}

describe("OrganizationsService", () => {
  let service: OrganizationsService;
  let userClientFactory: { forToken: jest.Mock };
  const requestUser = { id: "user-1", email: "admin@acme.test", orgId: "org-1", role: "admin" as const, accessToken: "tok" };

  beforeEach(async () => {
    userClientFactory = { forToken: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: SupabaseUserClientFactory, useValue: userClientFactory }],
    }).compile();
    service = module.get(OrganizationsService);
  });

  it("updateMine only patches provided fields", async () => {
    const orgRow = { id: "org-1", name: "Acme", display_name: "Acme HVAC", logo_url: null, brand_primary_color: "#112233", brand_updated_at: "2026-01-01T00:00:00Z", created_at: "2025-01-01T00:00:00Z" };
    const builder = makeQueryBuilder({ data: orgRow, error: null });
    userClientFactory.forToken.mockReturnValue({ from: jest.fn().mockReturnValue(builder) });

    const result = await service.updateMine(requestUser, { displayName: "Acme HVAC" });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Acme HVAC" }),
    );
    expect(builder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_primary_color: expect.anything() }),
    );
    expect(result.displayName).toBe("Acme HVAC");
  });

  it("updateLogo rejects disallowed file types before touching storage", async () => {
    const storage = { from: jest.fn() };
    userClientFactory.forToken.mockReturnValue({ storage, from: jest.fn() });

    await expect(
      service.updateLogo(requestUser, {
        mimetype: "application/pdf",
        buffer: Buffer.from(""),
        originalname: "logo.pdf",
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);

    expect(storage.from).not.toHaveBeenCalled();
  });

  it("updateLogo uploads and saves the resulting public URL", async () => {
    const orgRow = { id: "org-1", name: "Acme", display_name: null, logo_url: "https://example.test/logos/org-1/logo-1.png", brand_primary_color: null, brand_updated_at: "2026-01-01T00:00:00Z", created_at: "2025-01-01T00:00:00Z" };
    const orgBuilder = makeQueryBuilder({ data: orgRow, error: null });
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "https://example.test/logos/org-1/logo-1.png" } }),
    };
    userClientFactory.forToken.mockReturnValue({
      storage: { from: jest.fn().mockReturnValue(bucket) },
      from: jest.fn().mockReturnValue(orgBuilder),
    });

    const result = await service.updateLogo(requestUser, {
      mimetype: "image/png",
      buffer: Buffer.from("fake-image-bytes"),
      originalname: "logo.png",
    } as Express.Multer.File);

    expect(bucket.upload).toHaveBeenCalled();
    expect(result.logoUrl).toBe("https://example.test/logos/org-1/logo-1.png");
  });
});
