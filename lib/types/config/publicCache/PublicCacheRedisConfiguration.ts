import { DNSLookupFunction } from "ioredis";

export type PublicCacheRedisConfiguration = {
  /**
   * @default 'redis'
   */
  backend: "redis";

  clusterOptions: {
    /**
     * @default true
     */
    enableReadyCheck: boolean;

    /**
     * Only set when `overrideDnsLookup` is enabled: skips DNS validation for
     * TLS certificates (needed to connect to an AWS ElastiCache cluster).
     */
    dnsLookup?: DNSLookupFunction;
  };

  /**
   * @default 5
   */
  database: number;

  node: {
    /**
     * @default 'localhost'
     */
    host: string;

    /**
     * @default 6379
     */
    port: number;
  };

  /**
   * List of master nodes of a Redis cluster. When set, the client connects
   * in cluster mode instead of connecting to the single `node` above.
   */
  nodes?: Array<{ host: string; port: number }>;

  options?: Record<string, unknown>;

  /**
   * @default false
   */
  overrideDnsLookup: boolean;

  /**
   * Interval in ms between keep-alive pings sent to the Redis server.
   *
   * @default 0
   */
  pingKeepAlive?: number;
};
