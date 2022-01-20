import { JSONObject } from '../../../../index';

export type StorageServiceElasticsearch = {
  /**
   * @default ['storageEngine']
  */
  aliases: string[],

  /**
   * @default "elasticsearch"
  */
  backend: 'elasticsearch'

  /**
   * Elasticsearch constructor options. Use this field to specify your
   * Elasticsearch config options, this object is passed through to the
   * Elasticsearch constructor and can contain all options/keys outlined here:
   * @see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html
   * 
  */
  client: JSONObject
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
    dynamic: 'true' | 'false' | 'strict'
  
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
            type: string
          }

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
              type: string
            }

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
              type: string
            }
  
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
              type: string
            }
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
          dynamic: 'true' | 'false' | 'strict'
  
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
              type: string,
            }
          }
        }
        profiles: {
          dynamic: 'false',
          properties: {
            tags: { type: 'keyword' },
            policies: {
              properties: {
                roleId: { type: 'keyword' },
                restrictedTo: {
                  type: 'nested',
                  properties: {
                    index: { type: 'keyword' },
                    collections: { type: 'keyword' }
                  }
                }
              }
            }
          }
        },
        roles: {
          dynamic: 'false',
          properties: {
            tags: { type: 'keyword' },
            controllers: {
              dynamic: 'false',
              properties: Record<string, unknown>,
            }
          }
        },
        validations: {
          properties: {
            index: { type: 'keyword' },
            collection: { type: 'keyword' },
            validations: {
              dynamic: 'false',
              properties: Record<string, unknown>,
            }
          }
        },
        config: {
          dynamic: 'false',
          properties: Record<string, unknown>,
        },
        'api-keys': {
          dynamic: 'false',
          properties: {
            userId: { type: 'keyword' },
            hash: { type: 'keyword' },
            description: { type: 'text' },
            expiresAt: { type: 'long' },
            ttl: { type: 'keyword' },
            token: { type: 'keyword' }
          }
        },
        installations: {
          dynamic: 'strict',
          properties: {
            description: { type: 'text' },
            handler: { type: 'text' },
            installedAt: { type: 'date' }
          },
        }
      }
    },
    maxScrollDuration: '1m',
    defaults: {
      onUpdateConflictRetries: 0,
      scrollTTL: '15s'
    }
}