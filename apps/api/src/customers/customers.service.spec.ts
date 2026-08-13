import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import type { RequestUser } from "../auth/request-user";

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "eq", "order"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  // supabase-js query builders are thenable — `list()` awaits the chain
  // directly after `.order(...)` without a terminal `.single()` call.
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

const requestUser: RequestUser = {
  id: "user-1",
  email: "office@acme.test",
  orgId: "org-1",
  role: "office",
  accessToken: "tok",
};

describe("CustomersService", () => {
  let service: CustomersService;
  let userClientFactory: { forToken: jest.Mock };
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    userClientFactory = { forToken: jest.fn().mockReturnValue({ from: fromMock }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: SupabaseUserClientFactory, useValue: userClientFactory }],
    }).compile();

    service = module.get(CustomersService);
  });

  it("list returns mapped customers ordered by creation", async () => {
    const rows = [
      { id: "c-1", org_id: "org-1", name: "Acme Home", phone: null, email: null, billing_address: null, created_at: "2026-01-01T00:00:00Z", created_by: "user-1" },
    ];
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: rows, error: null }));

    const result = await service.list(requestUser);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Acme Home");
  });

  it("create sets orgId/createdBy from the request user, not the client body", async () => {
    const row = { id: "c-1", org_id: "org-1", name: "New Customer", phone: null, email: null, billing_address: null, created_at: "2026-01-01T00:00:00Z", created_by: "user-1" };
    const builder = makeQueryBuilder({ data: row, error: null });
    fromMock.mockReturnValueOnce(builder);

    const result = await service.create(requestUser, { name: "New Customer" });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: "org-1", created_by: "user-1", name: "New Customer" }),
    );
    expect(result.id).toBe("c-1");
  });

  it("getDetail returns nested addresses/equipment/notes mapped to camelCase", async () => {
    const row = {
      id: "c-1",
      org_id: "org-1",
      name: "Acme Home",
      phone: null,
      email: null,
      billing_address: null,
      created_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
      service_addresses: [{ id: "a-1", customer_id: "c-1", label: "Main", address: "1 Main St", lat: null, lng: null }],
      equipment: [{ id: "e-1", customer_id: "c-1", service_address_id: "a-1", type: "Furnace", make: null, model: null, serial_number: null, install_date: null, warranty_expires: null, filter_size: null, notes: null }],
      customer_notes: [{ id: "n-1", customer_id: "c-1", author_id: "user-1", body: "Called ahead", created_at: "2026-01-02T00:00:00Z" }],
    };
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: row, error: null }));

    const result = await service.getDetail(requestUser, "c-1");

    expect(result.serviceAddresses).toEqual([{ id: "a-1", customerId: "c-1", label: "Main", address: "1 Main St", lat: null, lng: null }]);
    expect(result.equipment[0].serviceAddressId).toBe("a-1");
    expect(result.notes[0].body).toBe("Called ahead");
  });

  it("getDetail throws NotFoundException when the customer doesn't exist (or isn't visible via RLS)", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.getDetail(requestUser, "missing")).rejects.toThrow(NotFoundException);
  });

  it("update only patches provided fields", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "c-1" }, error: null })); // getCustomerOrThrow
    const updateBuilder = makeQueryBuilder({
      data: { id: "c-1", org_id: "org-1", name: "Renamed", phone: null, email: null, billing_address: null, created_at: "2026-01-01T00:00:00Z", created_by: "user-1" },
      error: null,
    });
    fromMock.mockReturnValueOnce(updateBuilder);

    const result = await service.update(requestUser, "c-1", { name: "Renamed" });

    expect(updateBuilder.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(result.name).toBe("Renamed");
  });

  it("update throws NotFoundException when the customer doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.update(requestUser, "missing", { name: "x" })).rejects.toThrow(NotFoundException);
  });

  it("addAddress creates a service address for an existing customer", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "c-1" }, error: null })); // getCustomerOrThrow
    const insertBuilder = makeQueryBuilder({
      data: { id: "a-1", customer_id: "c-1", label: null, address: "1 Main St", lat: null, lng: null },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addAddress(requestUser, "c-1", { address: "1 Main St" });

    expect(result.address).toBe("1 Main St");
  });

  it("addAddress throws NotFoundException when the customer doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.addAddress(requestUser, "missing", { address: "1 Main St" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("addEquipment succeeds when the service address belongs to this customer", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "c-1" }, error: null })); // getCustomerOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "a-1" }, error: null })); // address ownership check
    const insertBuilder = makeQueryBuilder({
      data: { id: "e-1", customer_id: "c-1", service_address_id: "a-1", type: "Furnace", make: null, model: null, serial_number: null, install_date: null, warranty_expires: null, filter_size: null, notes: null },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addEquipment(requestUser, "c-1", { serviceAddressId: "a-1", type: "Furnace" });

    expect(result.type).toBe("Furnace");
  });

  it("addEquipment rejects a serviceAddressId belonging to a different customer", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "c-1" }, error: null })); // getCustomerOrThrow
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null })); // address ownership check fails

    await expect(
      service.addEquipment(requestUser, "c-1", { serviceAddressId: "a-from-another-customer", type: "Furnace" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("addEquipment throws NotFoundException when the customer doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(
      service.addEquipment(requestUser, "missing", { serviceAddressId: "a-1", type: "Furnace" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("addNote creates a note authored by the request user", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: { id: "c-1" }, error: null })); // getCustomerOrThrow
    const insertBuilder = makeQueryBuilder({
      data: { id: "n-1", customer_id: "c-1", author_id: "user-1", body: "Called ahead", created_at: "2026-01-02T00:00:00Z" },
      error: null,
    });
    fromMock.mockReturnValueOnce(insertBuilder);

    const result = await service.addNote(requestUser, "c-1", { body: "Called ahead" });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: "c-1", author_id: "user-1", body: "Called ahead" }),
    );
    expect(result.authorId).toBe("user-1");
  });

  it("addNote throws NotFoundException when the customer doesn't exist", async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }));

    await expect(service.addNote(requestUser, "missing", { body: "x" })).rejects.toThrow(NotFoundException);
  });
});
