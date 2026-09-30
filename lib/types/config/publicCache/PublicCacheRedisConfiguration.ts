import type { BaseCacheRedisConfiguration } from "../cache/BaseCacheRedisConfiguration";

export type PublicCacheRedisConfiguration = BaseCacheRedisConfiguration & {
  /**
   * @default 5
   */
  database: number;
};
