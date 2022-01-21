export type PublicCacheRedisConfiguration = {
  /**
   * @default 'redis'
   */
  backend: 'redis'
  
  clusterOptions: {
    /**
     * @default true
     */
    enableReadyCheck: boolean
  }

  /**
  * @default 5
  */
  database: number

  node: {
    /**
     * @default 'localhost'
     */
    host: string,

    /**
     * @default 6379
     */
    port: number
  }

  options?: Record<string, unknown>,

  /**
   * @default false
   */
  overrideDnsLookup: boolean
}
