import { JSONObject } from "../../../index";

export type ServerConfiguration = {
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
    accessLogFormat: "combined" | "logstash";

    /**
     * The offset to use as the client ip, from the FORWARDED-FOR chain,
     * beginning from the right (0 = the ip address of the last
     * client|proxy which connected to Kuzzle.
     *
     * @default 0
     */
    accessLogIpOffset: number;
  };

  /**
   * protocols accepted by Kuzzle.
   * protocols can be extended and configured in this section.
   */
  protocols: {
    http: {
      /**
       * Enables Kuzzle to accept additional Content-Types.
       * Note: This relies on the implementation of a
       * "protocol:http:beforeParsingPayload" pipe that implements
       * the formatting of the additional content types to JSON.
       * The default content types are:
       *   * application/json
       *   * application/x-www-form-urlencoded
       *   * multipart/form-data
       * @default []
       */
      additionalContentTypes: string[];

      /**
       * Enable support for compressed requests, using the Content-Encoding header
       * Currently supported compression algorithms:  gzip, deflate, identity
       * Note: "identity" is always an accepted value, even if compression support is disabled
       *
       * @default true
       */
      allowCompression: boolean;

      /**
       * Set to "false" to disable HTTP support
       *
       * @default true
       */
      enabled: boolean;

      /**
       * Maximum number of encoding layers that can be applied to an http message, using the Content-Encoding header.
       * This parameter is meant to prevent abuses by setting an abnormally large number
       * of encodings, forcing Kuzzle to  allocate as many decoders to handle the incoming request.
       *
       * @default 3
       */
      maxEncodingLayers: number;

      /**
       * Maximum size of requests sent via http forms
       *
       * @default "1MB"
       */
      maxFormFileSize: string;
    };
    mqtt: {
      /**
       * Set to true to enable MQTT support
       *
       * @default false
       */
      enabled: boolean;

      /**
       * Allow MQTT pub/sub capabilities or restrict to Kuzzle requests only
       *
       * @default false
       */
      allowPubSub: boolean;

      /**
       * Switches responseTopic back to a regular public topic
       *
       * @default false
       */
      developmentMode: boolean;

      /**
       * Delay in ms to apply between a disconnection notification is
       * received and the connection is actually removed
       *
       * @default 250
       */
      disconnectDelay: number;

      /**
       * Name of the topic listened by the plugin for requests
       *
       * @default 'Kuzzle/request'
       */
      requestTopic: string;

      /**
       * Name of the topic clients should listen to get requests result
       *
       * @default 'Kuzzle/response'
       */
      responseTopic: string;

      /**
       * Constructor options passed to underlying MQTT server.
       * See aedes documentation for further reference: https://github.com/moscajs/aedes
       */
      server: {
        /**
         * @default 1883
         */
        port: number;
      };

      /**
       * Set to "true" to enable realtime notifications like "TokenExpired" notifications
       *
       * @default true
       */
      realtimeNotifications: boolean;
    };
    websocket: {
      /**
       * Set to true to enable WebSocket support
       *
       * @default true
       */
      enabled: boolean;

      /**
       * The maximum time (in milliseconds) without sending or receiving a message from a client.
       * Once reached, the client's socket is forcibly closed.
       * If a client socket is inactive for too long, the server will send a PING request before closing the socket.
       * Minimum value: 1000 (but it's strongly advised to not set a value this low to forcibly close idle client sockets)
       *
       * @default 60000
       */
      idleTimeout: number;

      /**
       * Enable/Disable per message compression
       *
       * @default false
       */
      compression: boolean;

      /**
       * The maximum number of messages per second a single socket can
       * submit to the server.
       * @default 0
       */
      rateLimit: number;

      /**
       * Set to "true" to enable realtime notifications like "TokenExpired" notifications
       *
       * @default true
       */
      realtimeNotifications: boolean;

      /**
       * Whether or not we should automatically send pings to uphold a stable connection given whatever idleTimeout.
       */
      sendPingsAutomatically: boolean;

      /**
       * Whether or not we should reset the idle timeout on every message received.
       */
      resetIdleTimeoutOnSend: boolean;
    };
  };

  /**
   * @default true
   */
  strictSdkVersion: boolean;
};
