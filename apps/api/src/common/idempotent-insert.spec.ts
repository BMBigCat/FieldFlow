import { InternalServerErrorException } from "@nestjs/common";
import { idempotentInsert } from "./idempotent-insert";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "eq"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  return builder;
}

describe("idempotentInsert", () => {
  it("returns wasNew=true on a fresh insert", async () => {
    const builder = makeQueryBuilder({ data: { id: "n-1" }, error: null });
    const client = { from: jest.fn().mockReturnValue(builder) } as never;

    const result = await idempotentInsert(client, "job_notes", { body: "x" }, { job_id: "j-1", client_generated_id: "cg-1" });

    expect(result).toEqual({ row: { id: "n-1" }, wasNew: true });
  });

  it("re-selects and returns the existing row on a unique-violation retry", async () => {
    const insertBuilder = makeQueryBuilder({ data: null, error: { code: "23505", message: "duplicate" } });
    const selectBuilder = makeQueryBuilder({ data: { id: "n-1", client_generated_id: "cg-1" }, error: null });
    const client = {
      from: jest.fn().mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder),
    } as never;

    const result = await idempotentInsert(client, "job_notes", { body: "x" }, { job_id: "j-1", client_generated_id: "cg-1" });

    expect(result).toEqual({ row: { id: "n-1", client_generated_id: "cg-1" }, wasNew: false });
    expect(selectBuilder.eq).toHaveBeenCalledWith("job_id", "j-1");
    expect(selectBuilder.eq).toHaveBeenCalledWith("client_generated_id", "cg-1");
  });

  it("throws on any other error", async () => {
    const builder = makeQueryBuilder({ data: null, error: { code: "23503", message: "fk violation" } });
    const client = { from: jest.fn().mockReturnValue(builder) } as never;

    await expect(idempotentInsert(client, "job_notes", {}, { job_id: "j-1" })).rejects.toThrow(InternalServerErrorException);
  });
});
