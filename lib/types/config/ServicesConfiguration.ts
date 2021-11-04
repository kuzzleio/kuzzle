import { JSONObject } from '../../../index';

export type ServicesConfiguration = {
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
  
      /**
       * The database engine used for Kuzzle internal index
       */
      internalCache: {
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
        backend: string
  
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
      memoryStorage: {
        /**
         * @default 'redis'
         */
         backend: string
  
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
      }
      
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
        storageEngine: {
          /**
           * @default ['storageEngine']
           */
          aliases: Array<string>
  
          /**
           * @default "elasticsearch"
           */
          backend: string
  
          /**
           * Elasticsearch constructor options. Use this field to specify your
           * Elasticsearch config options, this object is passed through to the
           * Elasticsearch constructor and can contain all options/keys outlined here:
           * @see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html
           */
          client: {
            /**
             * @default "http://localhost:9200"
             */
            node: string
          }
          /**
           * Default policy against new fields that are not referenced in the
           * collection mapping.
           * The value of this configuration will change Elasticsearch behavior
           * on fields that are not declared in the collection mapping.
           *   - "true": Stores document and update the collection mapping with
           *     inferred type
           *   - "false": Stores document and does not update the collection
           *     mapping (field are not indexed)
           *   - "strict": Rejects document
           * @see https://www.elastic.co/guide/en/elasticsearch/reference/7.4/dynamic-mapping.html
           */
           commonMapping: {
             /**
              * @default "false"
              */
             dynamic: string
  
             properties: {
              _kuzzle_info: {
                properties: {
                  /**
                   * @default 
                   * 
                   * [
                   *   {
                   *     type: 'keyword',
                   *   }
                   * ]
                   */
                  author: JSONObject
  
                  /**
                   * @default 
                   * 
                   * [
                   *   {
                   *     type: 'date',
                   *   }
                   * ]
                   */
                   createdAt: JSONObject
  
                   /**
                   * @default 
                   * 
                   * [
                   *   {
                   *     type: 'keyword',
                   *   }
                   * ]
                   */
                    updater: JSONObject
  
                    /**
                   * @default 
                   * 
                   * [
                   *   {
                   *     type: 'date',
                   *   }
                   * ]
                   */
                     updatedAt: JSONObject
                }
              }
             }
           }
  
           internalIndex: {
             /**
              * @default "kuzzle"
              */
             name: string
  
             collections: {
               users: {
                 /**
                  * @default 'false'
                  */
                 dynamic: string
  
                 properties: {
                   /**
                      * @default 
                      * 
                      * [
                      *   {
                      *     type: 'keyword',
                      *   }
                      * ]
                      */
                    profileIds: JSONObject
                 }
               }
             }
           }
        }
  }
