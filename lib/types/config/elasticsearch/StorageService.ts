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
          author: string

          /**
           * @default 
           * 
           * [
           *   {
           *     type: 'date',
           *   }
           * ]
           */
            createdAt: number

            /**
           * @default 
           * 
           * [
           *   {
           *     type: 'keyword',
           *   }
           * ]
           */
            updater: string
  
            /**
           * @default 
           * 
           * [
           *   {
           *     type: 'date',
           *   }
           * ]
           */
            updatedAt: number
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
            profileIds: string[]
          }
        }
      }
    }
  }