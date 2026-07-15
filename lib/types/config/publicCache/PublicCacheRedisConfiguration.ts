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
     * Custom DNS lookup function, automatically set when `overrideDnsLookup`
     * is true. Only relevant when using a Redis Cluster config.
     */
    dnsLookup?: (
      address: string,
      callback: (err: Error | null, address: string) => void,
    ) => void;
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
   * Array of master nodes of the cluster. Only used when configuring a
   * Redis Cluster.
   */
  nodes?: Array<{ host: string; port: number }>;

  options?: Record<string, unknown>;

  /**
   * @default false
   */
  overrideDnsLookup: boolean;

  /**
   * Service initialization timeout, in milliseconds. Falls back to
   * `config.services.common.defaultInitTimeout` when not set.
   */
  initTimeout?: number;

  /**
   * Delay, in milliseconds, between application-level pings sent to keep
   * the connection alive (e.g. required by some managed Redis providers).
   * Disabled when not set.
   */
  pingKeepAlive?: number;
};
