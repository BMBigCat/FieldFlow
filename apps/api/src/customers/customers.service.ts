import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type {
  Customer,
  CustomerDetail,
  CustomerNote,
  Equipment,
  ServiceAddress,
  UpdateCustomerRequest,
} from "@fieldflow/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestUser } from "../auth/request-user";
import { toCustomer, toCustomerNote, toEquipment, toServiceAddress } from "../common/mappers";
import { SupabaseUserClientFactory } from "../supabase/supabase-user-client.factory";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { CreateServiceAddressDto } from "./dto/create-service-address.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly userClientFactory: SupabaseUserClientFactory) {}

  async list(user: RequestUser): Promise<Customer[]> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped.from("customers").select("*").order("created_at", { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []).map(toCustomer);
  }

  async create(user: RequestUser, dto: CreateCustomerDto): Promise<Customer> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("customers")
      .insert({
        org_id: user.orgId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        billing_address: dto.billingAddress ?? null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create customer");
    }
    return toCustomer(data);
  }

  async getDetail(user: RequestUser, customerId: string): Promise<CustomerDetail> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    const { data, error } = await scoped
      .from("customers")
      .select("*, service_addresses(*), equipment(*), customer_notes(*)")
      .eq("id", customerId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Customer not found");
    }

    const { service_addresses, equipment, customer_notes, ...customerRow } = data;
    return {
      ...toCustomer(customerRow),
      serviceAddresses: (service_addresses ?? []).map(toServiceAddress),
      equipment: (equipment ?? []).map(toEquipment),
      notes: (customer_notes ?? []).map(toCustomerNote),
    };
  }

  async update(user: RequestUser, customerId: string, dto: UpdateCustomerRequest): Promise<Customer> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getCustomerOrThrow(scoped, customerId);

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.billingAddress !== undefined) patch.billing_address = dto.billingAddress;

    const { data, error } = await scoped.from("customers").update(patch).eq("id", customerId).select().single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to update customer");
    }
    return toCustomer(data);
  }

  async addAddress(user: RequestUser, customerId: string, dto: CreateServiceAddressDto): Promise<ServiceAddress> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getCustomerOrThrow(scoped, customerId);

    const { data, error } = await scoped
      .from("service_addresses")
      .insert({
        customer_id: customerId,
        label: dto.label ?? null,
        address: dto.address,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create service address");
    }
    return toServiceAddress(data);
  }

  async addEquipment(user: RequestUser, customerId: string, dto: CreateEquipmentDto): Promise<Equipment> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getCustomerOrThrow(scoped, customerId);

    // RLS alone wouldn't stop referencing a different customer's address
    // within the same org — check explicitly for a clean 400 instead of a
    // dangling FK-satisfied-but-wrong-customer row.
    const { data: addressRow, error: addressError } = await scoped
      .from("service_addresses")
      .select("id")
      .eq("id", dto.serviceAddressId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (addressError) {
      throw new InternalServerErrorException(addressError.message);
    }
    if (!addressRow) {
      throw new BadRequestException("serviceAddressId does not belong to this customer");
    }

    const { data, error } = await scoped
      .from("equipment")
      .insert({
        customer_id: customerId,
        service_address_id: dto.serviceAddressId,
        type: dto.type,
        make: dto.make ?? null,
        model: dto.model ?? null,
        serial_number: dto.serialNumber ?? null,
        install_date: dto.installDate ?? null,
        warranty_expires: dto.warrantyExpires ?? null,
        filter_size: dto.filterSize ?? null,
        notes: dto.notes ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create equipment");
    }
    return toEquipment(data);
  }

  async addNote(user: RequestUser, customerId: string, dto: CreateCustomerNoteDto): Promise<CustomerNote> {
    const scoped = this.userClientFactory.forToken(user.accessToken);
    await this.getCustomerOrThrow(scoped, customerId);

    const { data, error } = await scoped
      .from("customer_notes")
      .insert({ customer_id: customerId, author_id: user.id, body: dto.body })
      .select()
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message ?? "Failed to create customer note");
    }
    return toCustomerNote(data);
  }

  private async getCustomerOrThrow(client: SupabaseClient, customerId: string): Promise<void> {
    const { data, error } = await client.from("customers").select("id").eq("id", customerId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Customer not found");
    }
  }
}
