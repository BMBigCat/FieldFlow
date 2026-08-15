import type { ConnectionOptions } from "bullmq";

/**
 * BullMQ/ioredis want host/port/tls broken out, not a bare connection
 * string. Upstash's connection string is always `rediss://` (TLS) — that
 * scheme is what drives enabling `tls` here, not a separate flag.
 */
export function buildRedisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    // BullMQ requirement for blocking commands (e.g. worker polling).
    maxRetriesPerRequest: null,
  };
}
