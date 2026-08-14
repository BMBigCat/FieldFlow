import { IsArray, IsString } from "class-validator";
import type { SyncPushItem, SyncPushRequest } from "@fieldflow/shared-types";

/**
 * `items` is a discriminated union (see packages/shared-types/src/sync.ts) —
 * deep per-item class-validator decoration isn't worth the complexity for an
 * internal mobile-only endpoint whose whole point is graceful per-item
 * failure. SyncService validates/handles each item's shape defensively and
 * reports a "rejected" outcome for anything malformed, rather than 400-ing
 * the whole batch.
 */
export class SyncPushDto implements SyncPushRequest {
  @IsString()
  deviceId!: string;

  @IsArray()
  items!: SyncPushItem[];
}
