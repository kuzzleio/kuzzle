import {
  ServerConfiguration,
  ServicesConfiguration,
  PluginsConfiguration,
  LimitsConfiguration,
  Security,
  DumpConfiguration,
  HttpConfiguration
} from '../index';

export type IKuzzleConfiguration = {
  /**
   * Realtime engine options
   * * pcreSupport (DEPRECATED):
   *     Backward-compatibility option. Since v1.11, Kuzzle's realtime engine
   *     has been switched to RE2 as its regular expressions engine, instead
   *     of regular PCREs. RE2 supports most of PCREs features, but not all.
   *     You can switch back to PCREs if you absolutely cannot convert
   *     existing regular expressions to make them compatible with RE2 in a
   *     timely fashion, but note that this will make Kuzzle vulnerable to
   *     ReDoS attacks (see https:en.wikipedia.org/wiki/ReDoS)
   *
   *     It is *VERY STRONGLY* advised to leave that option deactivated.
   *     This option is deprecated and will be removed from Kuzzle v2.
   *     More information about the RE2 engine: https://github.com/google/re2
   */
  realtime: {
    /**
     * @default false
     */
     pcreSupport: boolean

  }

  /**
   * Kuzzle provides diagnostic tools, enabling analysis, support
   * and debugging on unexpected events (errors, crashes)
   * DO NOT disable this feature if you bought enterprise support
   */
  dump: DumpConfiguration
  /**
   * The HTTP section lets you configure how Kuzzle should
   * handle HTTP requests.
   */
  http: HttpConfiguration,

  /**
   * Kuzzle configured limits.
   */
  limits: LimitsConfiguration,

  /**
   * The application section lets you configure your application.
   */
  application: Record<string, unknown>,

  /**
   * The plugins section lets you define plugins behaviors.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins
   */
  plugins: PluginsConfiguration,

  /**
   * The repositories are used internally by Kuzzle to store its data (users,
   * permissions, configuration etc.)
   */
  repositories: {

    /**
     * Time to live (in seconds) of cached objects.
     *
     * Decreasing this value will lower Redis memory and disk consumption,
     * at the cost of increasing queries rate to the database and response times.
     *
     * @default 1440
     */
    cacheTTL: number;
  },

  /**
   * The security section contains the configuration for Kuzzle permissions
   * system.
   *
   */
  security: Security

  /**
   * Kuzzle server is the entry point for incoming requests.
   */
  server: ServerConfiguration

  /**
   * Services are the external components Kuzzle relies on.
   */
  services: ServicesConfiguration
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>