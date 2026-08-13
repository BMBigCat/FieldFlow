import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            checkDb: jest.fn().mockResolvedValue({ ok: false, error: "DATABASE_URL is not configured" }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("reports degraded status when the DB check fails", async () => {
    const result = await controller.check();
    expect(result.status).toBe("degraded");
    expect(result.db.ok).toBe(false);
  });
});
