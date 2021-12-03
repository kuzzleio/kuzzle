import { PublicCacheRedisConfiguration, InternalCacheConfiguration, StorageServiceElasticsearch } from '../index';

export type ServicesConfiguration = {

  common: {
    /**
     * Time in ms after which a service is considered failing if 
     * it has not init.
     * 
     * @default 120000
     */
    defaultInitTimeout: number
    
    /**
     * Default interval in ms between Kuzzle tries to init 
     * the service again on first failure.
     * 
     * @default 1000
     */
    retryInterval: number
  }
  
  /**
   * The database engine used for Kuzzle internal index
   */
  internalCache: InternalCacheConfiguration,

  memoryStorage: PublicCacheRedisConfiguration,

  /**
   * The database engine used for Kuzzle internal index
  */
  internalIndex: {
    /**
     * Maximum amount of time (in milliseconds)
     * to wait for a concurrent database bootstrap
     * 
     * @default 60000
     */
    bootstrapLockTimeout: number
  }
  /**
   * The default storage layer is Elasticsearch and it is 
   * currently the only storage layer we support.
   */
  storageEngine: StorageServiceElasticsearch
  }
