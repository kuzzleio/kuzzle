import {
  ServerConfiguration,
  ServicesConfiguration,
  SecurityConfiguration,
  HttpConfiguration,
  PluginsConfiguration,
  LimitsConfiguration,
  DumpConfiguration,
} from "../index";

export interface IKuzzleConfiguration {
  realtime: {
    /**
     * @default false
     */
    pcreSupport: boolean;
  };

  dump: DumpConfiguration;

  /**
   * The HTTP section lets you configure how Kuzzle should
   * handle HTTP requests.
   */
  http: HttpConfiguration;

  /**
   * Kuzzle configured limits.
   */
  limits: LimitsConfiguration;
  /**
   * The application section lets you configure your application.
   */
  application: Record<string, unknown>;

  /**
   * The plugins section lets you define plugins behaviors.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins
   */
  plugins: PluginsConfiguration;

  /**
   * The repositories are used internally by Kuzzle to store its data (users,
   * permissions, configuration etc.)
   */
  repositories: {
    common: {
      /**
       * Time to live (in seconds) of cached objects.
       *
       * Decreasing this value will lower Redis memory and disk consumption,
       * at the cost of increasing queries rate to the database and response times.
       *
       * @default 1440000
       */
      cacheTTL: number;
    };
  };

  /**
   * The security section contains the configuration for Kuzzle permissions
   * system.
   *
   */
  security: SecurityConfiguration;

  /**
   * Kuzzle server is the entry point for incoming requests.
   */
  server: ServerConfiguration;

  /**
   * Services are the external components Kuzzle relies on.
   */
  services: ServicesConfiguration;

  stats: {
    /**
     * @default true
     */
    enabled: boolean;

    /**
     * @default 3600
     */
    ttl: number;

    /**
     * @default 10
     */
    statsInterval: number;
  };

  cluster: {
    /**
     * @default true
     */
    enabled: boolean;

    /**
     * @default 50
     */
    activityDepth: number;

    /**
     * @default 2000
     */
    heartbeat: number;

    /**
     * @default null
     */
    interface: any;

    /**
     * @default false
     */
    ipv6: boolean;

    /**
     * @default 'private'
     */
    ip: string;

    /**
     * @default 60000
     */
    joinTimeout: number;

    /**
     * @default 1
     */
    minimumNodes: number;

    ports: {
      /**
       * @default 7510
       */
      command: number;

      /**
       * @default 7511
       */
      sync: number;
    };

    /**
     * @default 5000
     */
    syncTimeout: number;
  };

  internal: {
    hash: any;
  };

  validation: Record<string, unknown>;
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>;
