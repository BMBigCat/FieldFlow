import { InternalServerErrorException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

const POSTGRES_UNIQUE_VIOLATION = "23505";

export interface IdempotentInsertResult<T> {
  row: T;
  wasNew: boolean;
}

/**
 * Inserts a row keyed by a client-generated id. A retry with the same key
 * (unique violation) is treated as success — re-selects and returns the
 * existing row instead of erroring — which is what makes offline sync
 * replay safe (build plan §6).
 */
export async function idempotentInsert<T>(
  client: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  conflictKey: Record<string, string>,
): Promise<IdempotentInsertResult<T>> {
  const { data, error } = await client.from(table).insert(values).select().single();
  if (!error && data) {
    return { row: data as T, wasNew: true };
  }
  if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
    let query = client.from(table).select("*");
    for (const [column, value] of Object.entries(conflictKey)) {
      query = query.eq(column, value);
    }
    const { data: existing, error: selectError } = await query.single();
    if (selectError || !existing) {
      throw new InternalServerErrorException(selectError?.message ?? `Failed to load existing ${table} row`);
    }
    return { row: existing as T, wasNew: false };
  }
  throw new InternalServerErrorException(error?.message ?? `Failed to insert into ${table}`);
}
