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
  es = require('@elastic/elasticsearch'),
  errorsManager = require('../config/error-codes/throw'),
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
    subcode: 'invalid_change_from_nested',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from non-nested to nested$/,
    subcode: 'invalid_change_to_nested',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
    regex: /^\[illegal_argument_exception] Can't merge a non object mapping \[(.*?)] with an object mapping \[(.*?)]$/,
    subcode: 'invalid_change_to_scalar',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
    regex: /^\[illegal_argument_exception] \[(.*?)] is defined as an object in mapping \[(.*?)] but this name is already used for a field in other types$/,
    subcode: 'duplicate_field_name',
    getPlaceholders: matches => [matches[1], matches[2]]
  },
  {
    // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
    regex: /^\[illegal_argument_exception] mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
    subcode: 'invalid_type_change',
    getPlaceholders: matches => [matches[1], matches[2], matches[3]]
  },
  {
    // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
    // eslint-disable-next-line no-regex-spaces
    regex: /^\[mapper_parsing_exception] Mapping definition for \[(.*?)] has unsupported parameters: \[(.*?)]$/,
    subcode: 'unsupported_parameter_for_field',
    getPlaceholders: matches => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] No handler for type [booleasn] declared on field [not]
    regex: /^\[mapper_parsing_exception] No handler for type \[(.*?)] declared on field \[(.*?)]$/,
    subcode: 'type_does_not_exist',
    getPlaceholders: matches => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] failed to parse [conditions.host.flags]
    regex: /^\[mapper_parsing_exception] failed to parse \[(.*?)]$/,
    subcode: 'fail_to_parse_field',
    getPlaceholders: matches => [matches[1]]
  },
  {
    // Failed to parse mapping [_doc]: Expected map for property [fields] on field [enabled] but got a class java.lang.String
    regex: /^Failed to parse mapping \[.*\]: Expected \w+ for property \[.*\] on field \[(.*)\]/,
    subcode: 'cannot_parse_mapping',
    getPlaceholders: matches => [matches[1], matches[0]]
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^no such index \[([%#])(.*)\/(.*)\]$/,
    subcode: 'index_or_collection_not_found',
    getPlaceholders: matches => {
      return [matches[1] === '%' ? 'Internal' : 'User', matches[2], matches[3]];
    }
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[fields] on field \[(.*?)] but got a class java\.lang\.String$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: matches => [matches[1]]
  },
  {
    regex: /^\[version_conflict_engine_exception] \[data]\[(.*?)]: version conflict.*$/,
    subcode: 'too_many_changes',
    getPlaceholders: matches => [matches[1]]
  },
  {
    //[liia]: version conflict, document already exists (current version [2])
    regex: /^\[(.*)\]: version conflict, document already exists.*/,
    subcode: 'document_already_exists',
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

    if (error instanceof es.errors.NoLivingConnectionsError) {
      errorsManager.throw(
        'external',
        'elasticsearch',
        'elasticsearch_service_not_connected');
    }

    const message = _.get(error, 'meta.body.error.reason') || '';

    let kuzzleError = null;

    // Try to match a known elasticsearch error
    for (const mapping of errorMessagesMapping) {
      const matches = message.match(mapping.regex);

      if (matches) {
        kuzzleError = errorsManager.getError(
          'external',
          'elasticsearch',
          mapping.subcode,
          ...mapping.getPlaceholders(matches));

        break;
      }
    }
    console.log(error)
    switch (error.meta.statusCode) {
      case 400:
        kuzzleError = kuzzleError || this._handleBadRequestError(error, message);
        break;

      case 404:
        kuzzleError = kuzzleError || this._handleNotFoundError(error, message);
        break;

      case 409:
        kuzzleError = kuzzleError || this._handleConflictError(error, message);
        break;

      default:
        kuzzleError = kuzzleError || this._handleUnknownError(error, message);
        break;
    }

    return kuzzleError;
  }

  reject (error) {
    return Bluebird.reject(this.formatESError(error));
  }

  /**
   * Retrieve the mapping definition of an index, or of an index/collection pair
   *
   * @returns {Promise}
   */
  getMapping(data, includeMeta = false) {
    return this.client.indices.getMapping(data)
      .then(({ body: result }) => {
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

                _.set(picked, `${index}.mappings.${type}`, value);
              }
            }
          }
        }

        if (data && data.index && Object.keys(picked).length === 0) {
          errorsManager.throw(
            'external',
            'elasticsearch',
            'no_mapping_found',
            data.index);
        }

        return picked;
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  _handleConflictError (error, message) {
    debug('unhandled "Conflict" elasticsearch error: %a', error);

    return errorsManager.getError(
      'external',
      'elasticsearch',
      'unexpected_conflict_error',
      message);
  }

  _handleNotFoundError (error, message) {
    let errorMessage = message;

    // Check if it's a 404 on a document
    if (error.body.found === false) {
      return errorsManager.getError(
        'external',
        'elasticsearch',
        'document_not_found',
        error.body._id);
    }

    if (error.meta.body && error.meta.body.error) {
      errorMessage = error.meta.body.error
        ? `${error.meta.body.error.reason}: ${error.meta.body.error['resource.id']}`
        : `${error.message}: ${error.body._id}`;
    }

    debug('unhandled "NotFound" elasticsearch error: %a', error);

    return errorsManager.getError(
      'external',
      'elasticsearch',
      'unexpected_not_found_error',
      errorMessage);
  }

  _handleBadRequestError (error, message) {
    let errorMessage = message;

    if (error.meta.body && error.meta.body.error) {
      errorMessage = error.meta.body.error.root_cause
        ? error.meta.body.error.root_cause[0].reason
        : error.meta.body.error.reason;
    }

    debug('unhandled "BadRequest" elasticsearch error: %a', error);

    return errorsManager.getError(
      'external',
      'elasticsearch',
      'unexpected_bad_request_error',
      errorMessage);
  }

  _handleUnknownError (error, message) {
    debug(
      'unhandled elasticsearch error (unhandled type: %s): %a',
      error.meta.statusCode,
      message);

    return errorsManager.getError(
      'external',
      'elasticsearch',
      'unexpected_error',
      message);
  }
}

module.exports = ESWrapper;
