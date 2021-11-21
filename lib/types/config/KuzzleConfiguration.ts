import { JSONObject } from '../../../index';
import {
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
  server: {
    /**
     * The maximum size of an incoming request.
     *
     * Units can be expressed in bytes ("b" or none), kilobytes ("kb"),
     * megabytes ("mb"), gigabytes ("gb") or terabytes ("tb").
     *
     * @default "1mb"
     */
    maxRequestSize: string;

    /**
     * The listening port for HTTP and WebSocket protocols.
     *
     * @default 7512
     */
    port: number;

    /**
     * Configuration section for Kuzzle access logs.
     */
    logs: {
      /**
       * An array of Winston transports configurations to output access
       * logs.
       *
       * Possible transport types are: console, file, elasticsearch and syslog.
       *
       * Please refer to https://github.com/winstonjs/winston/blob/master/docs/transports.md
       * for more information on transports configuration.
       *
       * @default
       *
       * [
          {
            transport: 'console',
            level: 'info',
            stderrLevels: [],
            silent: true
          }
        ]
       *
       */
      transports: JSONObject[];

      /**
       * Access log format.
       *
       * Currently supported are "combined" (=Apache combined logs format)
       * and "logstash".
       *
       * "logstash" will output the whole request input to JSON, ready to
       * be consumed by logstash agent.
       *
       * @default "combined"
       */
      accessLogFormat: string;

      /**
       * The offset to use as the client ip, from the FORWARDED-FOR chain,
       * beginning from the right (0 = the ip address of the last
       * client|proxy which connected to Kuzzle.
       *
       * @default 0
       */
      accessLogIpOffset: number
    },

    protocols: Record<string, unknown>,
  },

  /**
   * Services are the external components Kuzzle relies on.
   */
  services: ServicesConfiguration
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>
