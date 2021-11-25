import {
  ServerConfiguration,
  ServicesConfiguration,
  SecurityConfiguration,
  HttpConfiguration,
  PluginsConfiguration,
  LimitsConfiguration,
} from '../index';


export interface IKuzzleConfiguration {
  /**
   * The HTTP section lets you configure how Kuzzle should
   * handle HTTP requests.
   */
  http: HttpConfiguration

  /**
   * Kuzzle configured limits.
   */
  limits: LimitsConfiguration
  /**
   * The application section lets you configure your application.
   */
  application: Record<string, unknown>,

  /**
   * The plugins section lets you define plugins behaviors.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins
   */
  plugins: PluginsConfiguration

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
  security: SecurityConfiguration,

  /**
   * Kuzzle server is the entry point for incoming requests.
   */
  server: ServerConfiguration,

  /**
   * Services are the external components Kuzzle relies on.
   */
  services: ServicesConfiguration
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>
