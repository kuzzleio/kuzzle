/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Bluebird = require('bluebird'),
  debug = require('../kuzzleDebug')('kuzzle:util:ESCommon'),
  es = require('elasticsearch'),
  {
    BadRequestError,
    ServiceUnavailableError,
    NotFoundError,
    KuzzleError,
    ExternalServiceError,
  } = require('kuzzle-common-objects').errors;

const errorMessagesMapping = [
  {
    regex: /^\[es_rejected_execution_exception] rejected execution .*? on EsThreadPoolExecutor\[(.*?), .*$/,
    replacement: '"$1" threads buffer exceeded. Too many operations received at once'
  },
  {
    // [illegal_argument_exception] object mapping [titi] can't be changed from nested to non-nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from nested to non-nested$/,
    replacement: 'Can not change mapping for field "$1" from nested to another type'
  },
  {
    // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from non-nested to nested$/,
    replacement: 'Can not change mapping for field "$1" from object to another type'
  },
  {
    // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
    regex: /^\[illegal_argument_exception] Can't merge a non object mapping \[(.*?)] with an object mapping \[(.*?)]$/,
    replacement: 'Can not change mapping for field "$1" from object to a scalar type'
  },
  {
    // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
    regex: /^\[illegal_argument_exception] \[(.*?)] is defined as an object in mapping \[(.*?)] but this name is already used for a field in other types$/,
    replacement: 'Can not set mapping for field "$1" on collection "$2" because the field name is already used in another collection with a different type'
  },
  {
    // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
    regex: /^\[illegal_argument_exception] mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
    replacement: 'Can not change type of field "$1" from "$2" to "$3"'
  },
  {
    // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
    // eslint-disable-next-line no-regex-spaces
    regex: /^\[mapper_parsing_exception] Mapping definition for \[(.*?)] has unsupported parameters: \[(.*?)]$/,
    replacement: 'Parameter "$2" is not supported for field "$1"'
  },
  {
    // [mapper_parsing_exception] No handler for type [booleasn] declared on field [not]
    regex: /^\[mapper_parsing_exception] No handler for type \[(.*?)] declared on field \[(.*?)]$/,
    replacement: 'Can not set mapping for field "$2" because type "$1" does not exist'
  },
  {
    // [mapper_parsing_exception] failed to parse [conditions.host.flags]
    regex: /^\[mapper_parsing_exception] failed to parse \[(.*?)]$/,
    replacement: 'Failed to validate value of field "$1". Are you trying to insert nested value in a non-nested field ?'
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^\[index_not_found_exception] no such index, with { resource\.type=([^\s]+) (& )?resource\.id=([^\s]+) (& )?(index_uuid=.* )?index=([^\s]+) }$/,
    replacement: 'Index "$3" does not exist, please create it first'
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[fields] on field \[(.*?)] but got a class java\.lang\.String$/,
    replacement: 'Mapping for field "$1" must be an object with a property "type"'
  },
  {
    regex: /^\[version_conflict_engine_exception] \[data]\[(.*?)]: version conflict.*$/,
    replacement: 'Unable to modify document "$1": cluster sync failed (too many simultaneous changes applied)'
  }
];

class ESWrapper {

  constructor(client) {
    this.client = client;
  }

  /**
   * Transforms raw ES errors into a normalized Kuzzle version
   *
   * @param {Error} error
   * @returns {KuzzleError}
   */
  formatESError(error) {
    let
      kuzzleError,
      messageReplaced,
      message = error.message || '';

    if (error instanceof KuzzleError) {
      return error;
    }

    if (error instanceof es.errors.NoConnections) {
      return new ServiceUnavailableError('Elasticsearch service is not connected');
    }

    messageReplaced = errorMessagesMapping.some(mapping => {
      message = message.replace(mapping.regex, mapping.replacement);
      return message !== error.message;
    });

    switch (error.displayName) {
      case 'BadRequest':
        if (!messageReplaced) {
          if (error.body && error.body.error) {
            message = error.body.error.root_cause ? error.body.error.root_cause[0].reason : error.body.error.reason;
          }

          debug('unhandled "BadRequest" elasticsearch error: %a', error);
        }

        kuzzleError = new BadRequestError(message);
        break;
      case 'NotFound':
        if (!messageReplaced) {
          if (error.body && error.body.error) {
            message = error.body.error
              ? error.body.error.reason + ': ' + error.body.error['resource.id']
              : error.message + ': ' + error.body._id;
          }

          debug('unhandled "NotFound" elasticsearch error: %a', error);
        }

        kuzzleError = new NotFoundError(message);
        break;
      case 'Conflict':
        if (!messageReplaced) {
          debug('unhandled "Conflict" elasticsearch error: %a', error);
        }

        kuzzleError = new ExternalServiceError(message);
        break;
      default:
        kuzzleError = new ExternalServiceError(message);

        debug('unhandled default elasticsearch error: %a', message);
        break;
    }

    kuzzleError.internalError = error;
    kuzzleError.service = 'elasticsearch';

    return kuzzleError;
  }

  /**
   * Retrieve mapping definiton of index or index/collection
   *
   * @returns {Promise}
   */
  getMapping(data) {
    return this.client.indices.getMapping(data)
      .then(result => {
        for (const index of Object.keys(result)) {
          if (data && data.index && (index !== data.index)) {
            delete result[index];
          } else {
            for (const type of Object.keys(result[index].mappings)) {
              if (data && data.type && (type !== data.type)) {
                delete result[index].mappings[type];
              }
              else if (result[index].mappings[type].properties) {
                delete result[index].mappings[type].properties._kuzzle_info;
              }
            }
          }
          if (Object.keys(result[index].mappings).length === 0) {
            delete result[index];
          }
        }

        if (data && data.index && Object.keys(result).length === 0) {
          return Bluebird.reject(new NotFoundError(`No mapping found for index "${data.index}"`));
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }
}

module.exports = ESWrapper;
