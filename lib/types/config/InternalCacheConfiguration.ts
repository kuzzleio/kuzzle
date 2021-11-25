export type InternalCacheConfiguration = {
  /**
   * The cache service relies on Redis sample settings for Redis service (see also https://github.com/luin/ioredis)
   * 
   * 1. using a single Redis database:
   *  * node:
   *    * host:
   *        The host on which Redis can be reached.
   *        Can take an IP address, an URI or a hostname
   *    * port:
   *        The port on which Redis is running its database:
   *          * (optional, deprecated) database:
   *        ID of the redis database (default: 0)
   *        NOTE: this option is deprecated and will be removed in Kuzzle v3.
   *        Use 'options.db' instead. If both options are set, then
   *        "options.db" will take precedence.
   *  * (optional) options:
   *    Redis specific options compatible with IORedis.
   *    See Redis client constructor available options:
   *    https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options
   * 
   * 2. using a master/slaves Redis instance with Redis sentinels
   *   (cf. http://redis.io/topics/sentinel):
   *  * node:
   *    * sentinels:
   *        array of sentinels instances:
   *          * host:
   *              Host name/address of the sentinel server
   *              Can be an IP address, an URI or a hostname
   *          * port:
   *              Network port opened by Redis on the sentinel server
   *    * name:
   *        Group of Redis instances composed of a master and one
   *        or more slaves
   *    * (optional, deprecated) database:
   *        ID of the redis database (default: 0)
   *        NOTE: this option is deprecated and will be removed in Kuzzle v3.
   *              Use 'options.db' instead. If both options are set, then
   *              "options.db" will take precedence.
   *  * (optional) options:
   *      Redis specific options compatible with IORedis.
   *      See Redis client constructor available options:
   *      https://github.com/luin/ioredis/blob/master/API.md#redis--eventemitter
   * 
   * 3. using a redis cluster (cf. http://redis.io/topics/cluster-spec):
   *   * nodes: array of master nodes of the cluster
   *     * host:
   *         Host name/address of a redis cluster node
   *         Can be an IP address, an URI or a hostname
   *     * port:
   *        Network port opened by the redis cluster node
   *   * (optional, deprecated) database:
   *       ID of the redis database (default: 0)
   *       NOTE: this option is deprecated and will be removed in Kuzzle v3.
   *             Use 'options.db' instead. If both options are set, then
   *             "options.db" will take precedence.
   *   * (optional) options:
   *       Redis specific options compatible with IORedis.
   *       See Redis client constructor available options:
   *       https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options
   *   * (optional) clusterOptions:
   *       Redis Cluster specific options compatible with IORedis.
   *       See Redis Cluster client constructor available options:
   *       https://github.com/luin/ioredis/blob/master/API.md#new-clusterstartupnodes-options
   *   * (optional) overrideDnsLookup:
   *       Only available when using a Redis Cluster config.
   *       Use with caution: if set to true, it makes Kuzzle skip DNS validation for TLS certificates
   *       This is the only way to connect to an AWS Elasticache Cluster with TLS encryption.
   *       See: https://github.com/luin/ioredis#special-note-aws-elasticache-clusters-with-tls
   */
    
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
   * @default 0
  */
  database: number
  
  node: {
  /**
   * @default "localhost"
  */
  host: string
     
  /**
  * @default 6379
  */
  port: number
  
  /**
   * * (optional) options:
   *    Redis specific options compatible with IORedis.
   *    See Redis client constructor available options:
   *    https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options
   * 
  */
  options?: Record<string, unknown>,
   
  /**
  * Only available when using a Redis Cluster config.
  * Use with caution: if set to true, it makes Kuzzle skip DNS validation for TLS certificates
  * This is the only way to connect to an AWS Elasticache Cluster with TLS encryption.
  *  See: https://github.com/luin/ioredis#special-note-aws-elasticache-clusters-with-tls
  * @default false
  */
  overrideDnsLookup: boolean
  }
}