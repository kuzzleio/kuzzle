export type StorageEngineElasticsearch = {
  /**
   * Elasticsearch major version
   * @default "7"
   */
  majorVersion: "7" | "8";
  /**
   * @default ['storageEngine']
   */
  aliases: string[];

  /**
   * @default "elasticsearch"
   */
  backend: "elasticsearch";

  /**
   * Elasticsearch constructor options. Use this field to specify your
   * Elasticsearch config options, this object is passed through to the
   * Elasticsearch constructor and can contain all options/keys outlined here:
   *
   * @see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html
   *
   * @default
   *
   * {
   *    node: 'http://localhost:9200'
   * }
   *
   */
  client: any;

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
    dynamic: "true" | "false" | "strict";

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
          author: {
            type: string;
          };

          /**
           * @default
           *
           * [
           *   {
           *     type: 'date',
           *   }
           * ]
           */
          createdAt: {
            type: string;
          };

          /**
           * @default
           *
           * [
           *   {
           *     type: 'keyword',
           *   }
           * ]
           */
          updater: {
            type: string;
          };

          /**
           * @default
           *
           * [
           *   {
           *     type: 'date',
           *   }
           * ]
           */
          updatedAt: {
            type: string;
          };
        };
      };
    };
  };

  /**
   * Global settings to apply by default (if not overridden by user request ones)
   * @default
   * {
   *   number_of_shards: 1,
   *   number_of_replicas: 1
   * }
   */
  defaultSettings: {
    /**
     * @default 1
     */
    number_of_shards: number;

    /**
     * @default 1
     */
    number_of_replicas: number;
  };

  internalIndex: {
    /**
     * @default "kuzzle"
     */
    name: string;

    collections: {
      users: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          /**
           * @default 'false'
           */
          dynamic: "true" | "false" | "strict";

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
            profileIds: {
              type: string;
            };
          };
        };
      };

      profiles: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "false";
          properties: {
            tags: { type: "keyword" };
            policies: {
              properties: {
                roleId: { type: "keyword" };
                restrictedTo: {
                  type: "nested";
                  properties: {
                    index: { type: "keyword" };
                    collections: { type: "keyword" };
                  };
                };
              };
            };
          };
        };
      };

      roles: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "false";
          properties: {
            tags: { type: "keyword" };
            controllers: {
              dynamic: "false";
              properties: Record<string, unknown>;
            };
          };
        };
      };

      validations: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          properties: {
            index: { type: "keyword" };
            collection: { type: "keyword" };
            validations: {
              dynamic: "false";
              properties: Record<string, unknown>;
            };
          };
        };
      };

      config: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "false";
          properties: Record<string, unknown>;
        };
      };

      "api-keys": {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "false";
          properties: {
            userId: { type: "keyword" };
            hash: { type: "keyword" };
            description: { type: "text" };
            expiresAt: { type: "long" };
            ttl: { type: "keyword" };
            token: { type: "keyword" };
          };
        };
      };

      installations: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "strict";
          properties: {
            description: { type: "text" };
            handler: { type: "text" };
            installedAt: { type: "date" };
          };
        };
      };
      imports: {
        settings: {
          /**
           * @default 1
           */
          number_of_shards: number;

          /**
           * @default 1
           */
          number_of_replicas: number;
        };

        mappings: {
          dynamic: "strict";
          properties: {
            hash: { type: "keyword" };
          };
        };
      };
    };
  };
  maxScrollDuration: string;
  defaults: {
    onUpdateConflictRetries: number;
    scrollTTL: string;
  };

  /**
   * If true, Kuzzle will generate aliases for collections that don't have one.
   *
   * Typically, if an indice named `&platform.devices` does not have an alias
   * named `@&platform.devices` and pointing on the indice then it will be generated
   * even if another alias already exists on the indice.
   *
   * This option should be true only for retro-compatibility with Kuzzle < 2.14.0
   *
   * Also see https://github.com/kuzzleio/kuzzle/pull/2117
   */
  generateMissingAliases: boolean;
};
