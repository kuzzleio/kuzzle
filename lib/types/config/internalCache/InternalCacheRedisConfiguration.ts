import { BaseCacheRedisConfiguration } from "../cache/BaseCacheRedisConfiguration";

export type InternalCacheConfiguration = BaseCacheRedisConfiguration & {
  /**
   * @default 0
   */
  database: number;
};
