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
  _ = require('lodash'),
  debug = require('../kuzzleDebug')('kuzzle:util:ESCommon'),
  es = require('elasticsearch'),
  errorsManager = require('./errors').wrap('services', 'storage'),
  { KuzzleError } = require('kuzzle-common-objects').errors;

const errorMessagesMapping = [
  {
    regex: /^\[es_rejected_execution_exception] rejected execution .*? on EsThreadPoolExecutor\[(.*?), .*$/,
    subCode: 'too_many_operations',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] object mapping [titi] can't be changed from nested to non-nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from nested to non-nested$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from non-nested to nested$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
    regex: /^\[illegal_argument_exception] Can't merge a non object mapping \[(.*?)] with an object mapping \[(.*?)]$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
    regex: /^\[illegal_argument_exception] \[(.*?)] is defined as an object in mapping \[(.*?)] but this name is already used for a field in other types$/,
    subcode: 'duplicate_field_mapping',
    getPlaceholders: matches => [matches[1], matches[2]]
  },
  {
    // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
    regex: /^\[illegal_argument_exception] mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
    // eslint-disable-next-line no-regex-spaces
    regex: /^\[mapper_parsing_exception] Mapping definition for \[(.*?)] has unsupported parameters: \[(.*?)]$/,
    subcode: 'unexpected_properties',
    getPlaceholders: matches => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] No handler for type [booleasn] declared on field [not]
    regex: /^\[mapper_parsing_exception] No handler for type \[(.*?)] declared on field \[(.*?)]$/,
    subcode: 'invalid_mapping_type',
    getPlaceholders: matches => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] failed to parse [conditions.host.flags]
    regex: /^\[mapper_parsing_exception] failed to parse \[(.*?)]$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^\[index_not_found_exception] no such index, with { resource\.type=([^\s]+) (& )?resource\.id=([^\s]+) (& )?(index_uuid=.* )?index=([^\s]+) }$/,
    subcode: 'unknown_index',
    getPlaceholders: matches => [matches[3]]
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[(.*?)] on field \[(.*?)] but got a class java\.lang\.String$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: matches => [`${matches[1]}.${matches[2]}`]
  },
  {
    regex: /^\[version_conflict_engine_exception] \[data]\[(.*?)]: version conflict.*$/,
    subcode: 'too_many_changes',
    getPlaceholders: matches => [matches[1]]
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
    if (error instanceof KuzzleError) {
      return error;
    }

    if (error instanceof es.errors.NoConnections) {
      errorsManager.throw('not_connected');
    }

    let message = error.message || '';

    let kuzzleError = null;

    for (const mapping of errorMessagesMapping) {
      const matches = message.match(mapping.regex);

      if (matches) {
        kuzzleError = errorsManager.get(
          mapping.subcode,
          ...mapping.getPlaceholders(matches));

        break;
      }
    }

    switch (error.displayName) {
      case 'BadRequest':
        if (kuzzleError) {
          break;
        }

        if (error.body && error.body.error) {
          message = error.body.error.root_cause
            ? error.body.error.root_cause[0].reason
            : error.body.error.reason;
        }

        kuzzleError = errorsManager.get('unexpected_bad_request', message);

        debug('unhandled "BadRequest" elasticsearch error: %a', error);

        break;

      case 'NotFound':
        if (kuzzleError) {
          break;
        }

        if (error.body && error.body.error) {
          message = error.body.error
            ? `${error.body.error.reason}: ${error.body.error['resource.id']}`
            : `${error.message}: ${error.body._id}`;
        }

        kuzzleError = errorsManager.get('unexpected_not_found', message);

        debug('unhandled "NotFound" elasticsearch error: %a', error);

        break;

      case 'Conflict':
        if (kuzzleError) {
          break;
        }

        kuzzleError = errorsManager.get('unexpected_error', message);

        debug('unhandled "Conflict" elasticsearch error: %a', error);

        break;

      default:
        debug(
          'unhandled elasticsearch error (unhandled type: %s): %a',
          error.displayName,
          message);

        kuzzleError = errorsManager.get('unexpected_error', message);

        break;
    }

    kuzzleError.stack = error.stack;

    return kuzzleError;
  }

  /**
   * Retrieve the mapping definition of an index, or of an index/collection pair
   *
   * @returns {Promise}
   */
  getMapping(data, includeMeta = false) {
    return this.client.indices.getMapping(data)
      .then(result => {
        const picked = {};

        // There can be multiple mappings retrieved if the queried index is
        // an alias.
        for (const index of Object.keys(result)) {
          if (
            result[index].mappings &&
            Object.keys(result[index].mappings).length > 0
          ) {
            for (const type of Object.keys(result[index].mappings)) {
              if (!data || !data.type || data.type === type) {
                let value;

                if (!includeMeta && result[index].mappings[type].properties) {
                  value = _.omit(
                    result[index].mappings[type],
                    'properties._kuzzle_info');
                } else {
                  value = result[index].mappings[type];
                }

                if (!picked[index]) {
                  picked[index] = {mappings: {}};
                }
                picked[index].mappings[type] = value;
              }
            }
          }
        }

        if (data && data.index && Object.keys(picked).length === 0) {
          errorsManager.throw('no_mapping_found', data.index);
        }

        return picked;
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }
}

module.exports = ESWrapper;
