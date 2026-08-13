import type { ISODateString, UUID } from "./common.js";

/** Build plan §4 `customers`. */
export interface Customer {
  id: UUID;
  orgId: UUID;
  name: string;
  phone: string | null;
  email: string | null;
  billingAddress: string | null;
  createdAt: ISODateString;
  createdBy: UUID;
}

/** Build plan §4 `service_addresses`. */
export interface ServiceAddress {
  id: UUID;
  customerId: UUID;
  label: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
}

/** Build plan §4 `equipment`. */
export interface Equipment {
  id: UUID;
  customerId: UUID;
  serviceAddressId: UUID;
  type: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: ISODateString | null;
  warrantyExpires: ISODateString | null;
  filterSize: string | null;
  notes: string | null;
}

/** Build plan §4 `customer_notes`. */
export interface CustomerNote {
  id: UUID;
  customerId: UUID;
  authorId: UUID;
  body: string;
  createdAt: ISODateString;
}
