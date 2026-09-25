import type {
  DumpConfiguration,
  HttpConfiguration,
  LimitsConfiguration,
  PluginsConfiguration,
  SecurityConfiguration,
  ServerConfiguration,
  ServicesConfiguration,
} from "../index";

/**
 * The **merged, runtime** configuration: a user's `.kuzzlerc` applied over the
 * packaged defaults. Nothing here is optional, because `loadConfig()` always
 * produces every section — this is what `global.kuzzle.config` holds.
 *
 * For what a user may *write*, see {@link KuzzleConfiguration}.
 */
export interface IKuzzleConfiguration {
  /**
   * Kuzzle version, populated at runtime from `package.json`.
   *
   * Optional here, like the other members v2.56.0's declaration did not have
   * (`cluster.retransmitBuffer`, `internal.allowAllOrigins`, `vault`): a
   * required new member breaks code that builds this type. The loaded
   * configuration always has them (the packaged defaults and `loadConfig()`
   * fill them), so Kuzzle's own readers assert them present.
   */
  version?: string;

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

    /**
     * How many of its last sync messages a node keeps, so that a peer that
     * missed some can ask for them again instead of evicting itself. The
     * oldest are dropped as soon as either bound is exceeded; 0 disables it.
     *
     * Optional here for the reason given on {@link IKuzzleConfiguration.version}.
     */
    retransmitBuffer?: {
      /**
       * @default 1000
       */
      messages: number;

      /**
       * @default 16777216 (16 MiB)
       */
      bytes: number;
    };
  };

  internal: {
    hash: any;
    notifiableProtocols: string[];

    /**
     * Derived at startup from "http.accessControlAllowOrigin": true when the
     * configured origins contain the "*" wildcard.
     *
     * Optional here for the reason given on {@link IKuzzleConfiguration.version}.
     */
    allowAllOrigins?: boolean;
  };

  /**
   * Collection specifications to apply at startup, by index then collection.
   * Read when the internal index holds none of its own — the database is not
   * necessarily prepared when validation first loads.
   *
   * Their shape is a `RawSpecification`, which validation reads it as; the
   * declaration is v2.56.0's, which code compiled against it assigns to.
   */
  validation: Record<string, unknown>;

  controllers: {
    definition: {
      /**
       * Allow additional properties in action definitions.
       *
       * @default false
       */
      allowAdditionalActionProperties: boolean;
    };
  };

  /**
   * The vault section lets you configure the secrets vault behavior.
   *
   * Optional here for the reason given on {@link IKuzzleConfiguration.version}.
   */
  vault?: {
    /**
     * Opt-in for the new vault encryption algorithm (AES-256-GCM) instead
     * of the legacy one (AES-256-CBC).
     *
     * @default false
     */
    newAlgorithm: boolean;
  };
}

/**
 * What `lib/config/default.config.ts` ships: every section except the two
 * `loadConfig()` derives at startup — `version`, read from `package.json`, and
 * `internal`, computed from the rest (the hash seed, the notifiable protocols,
 * the `allowAllOrigins` flag). Declaring the omission is what keeps the defaults
 * file total — any other missing section is an error, not an oversight.
 */
export type PackagedKuzzleConfiguration = Omit<
  IKuzzleConfiguration,
  "version" | "internal"
>;

/**
 * Recursively optional. Written out here rather than imported because the user
 * shape below is its only use: an override is always *partial at every depth*,
 * and a shallow `Partial` demands the whole of any section it is given.
 *
 * Arrays and functions are left alone — a partial array element is not a thing
 * a config override can express, and `_.merge` replaces arrays wholesale.
 */
type DeepPartial<T> = T extends unknown[]
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/**
 * What a **user** may supply: a `.kuzzlerc` file, the object passed to
 * `app.config.merge()`, an environment override. Everything is optional, at
 * every depth, because the packaged defaults provide the rest — and because
 * that is what `rc` and `_.merge` actually accept.
 *
 * This is **not** the shape of `global.kuzzle.config`, which is this merged
 * over `lib/config/default.config.ts` and therefore total — that one is
 * {@link IKuzzleConfiguration}. One name used for both is what kept every
 * config reader out of `strict`: see ADR-0001, TD-53 (#2756).
 */
export type KuzzleConfigurationOverrides = DeepPartial<IKuzzleConfiguration>;

/**
 * v2.56.0's name for a configuration that may omit whole sections — but not
 * keys within one: `Partial`, not {@link KuzzleConfigurationOverrides}. Kept
 * as it was, because code compiled against it reads a section it set back
 * without `?.` (`config.limits!.documentsFetchCount` as a `number`).
 */
export type KuzzleConfiguration = Partial<IKuzzleConfiguration>;
