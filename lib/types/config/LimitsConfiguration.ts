export type LimitsConfiguration = {
  /**
   * Number of requests Kuzzle processes simultaneously.
   *
   * Requests received above this limit are buffered until a slot is freed
   *
   * This value should be kept low to avoid overloading Kuzzle's event loop.
   *
   * @default 100
   */
   concurrentRequests: number;

   /**
    * Maximum number of documents that can be fetched by a single API
    * request. The minimum value to this limit is 1.
    *
    * This limits is applied to any route returning multiple documents,
    * such as document:mGet or document:search
    *
    * You may have to configure ElasticSearch as well if you need
    * to set this value higher than 10000
    *
    * @default 10000
    */
   documentsFetchCount: number;

   /**
    * Maximum number of documents that can be written by a single API
    * request. The minimum value to this limit is 1.
    *
    * There is no higher limit to this value, but you may
    * also have to change the value of the `maxRequestSize` parameter
    * (in the `server` section) to make Kuzzle accept larger requests.
    *
    * @default 200
    */
   documentsWriteCount: number;

   /**
    * Maximum number of logins per second and per network connection.
    *
    * @default 1
    */
   loginsPerSecond: number;

   /**
    * Maximum number of requests that can be buffered.
    *
    * Requests received above this limit are discarded with a 503 error
    *
    * @default 50000
    */
   requestsBufferSize: number;

   /**
    * Number of buffered requests after which Kuzzle
    * will throw `core:overload` events.
    *
    * @see https://docs.kuzzle.io/core/2/framework/events/core/#core-overload
    *
    * @default 5000
    *
    */
   requestsBufferWarningThreshold: number;

   /**
    * Maximum number of conditions a subscription filter can contain.
    *
    * NB: A condition is either a "simple" operator (anything but "and",
    *     "or" and "bool"), or a boolean condition that contains only
    *     simple operators.
    *
    * @default 100
    */
   subscriptionConditionsCount: number;

   /**
    * Maximum number of minterms (AND) clauses after the filters are
    * transformed in their Canonical Disjunctive Normal Form (CDNF).
    *
    * Set to 0 for no limit.
    *
    * @default 0
    */
   subscriptionMinterms: number;

   /**
     * Maximum number of different subscription rooms.
     * (i.e. different index+collection+filters subscription configurations)
     *
     * Depends primarily on available memory.
     *
     * If set to 0, an unlimited number of rooms can be created.
     *
     * @default 1000000
    */
   subscriptionRooms: number

   /**
    * Maximum time (in seconds) a document will be kept in cache for
    * real-time subscriptions.
    *
    * This cache is used to notify subscriber when a document enters or
    * leaves a scope after an update.
    *
    * By default, subscriptions will be kept 72 hours.
    *
    * Please note that keeping subscriptions over a long period of
    * time may result in memory overuse.
    *
    * If set to 0, the subscription will be kept in cache forever.
    *
    * Setting the property to 0 will lead to a memory leak if
    * documents enter a real-time subscription scope and never exit
    * that scope.
    *
    * @default 259200000 (72 * 60 * 60)
    */
   subscriptionDocumentTTL: number;
}