/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
  debug = require('./debug')('kuzzle:util:ESCommon'),
  es = require('@elastic/elasticsearch'),
  errorsManager = require('./errors').wrap('services', 'storage'),
  { errors: { KuzzleError } } = require('kuzzle-common-objects');

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
    regex: /^mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
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
    // [mapper_parsing_exception] No handler for type [boolean] declared on field [not]
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
    // Failed to parse mapping [_doc]: Expected map for property [fields] on field [enabled] but got a class java.lang.String
    regex: /^Failed to parse mapping \[.*\]: Expected \w+ for property \[(.*)\] on field \[(.*)\]/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: matches => [`${matches[2]}.${matches[1]}`]
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^no such index \[([%&])(.*)\.(.*)\]$/,
    subcode: 'unknown_index',
    getPlaceholders: matches => [
      matches[1] === '%' ? 'Internal' : 'User',
      matches[2],
      matches[3]
    ]
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[(.*?)] on field \[(.*?)] but got a class java\.lang\.String$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: matches => [`${matches[2]}.${matches[1]}`]
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
    getPlaceholders: () => []
  },
  {
    // Unknown key for a START_OBJECT in [term].
    regex: /^Unknown key for a START_OBJECT in \[(.*)\].*/,
    subcode: 'invalid_search_query',
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
      throw errorsManager.get('not_connected');
    }
    const message = _.get(error, 'meta.body.error.reason', error.message);

    // Try to match a known elasticsearch error
    for (const mapping of errorMessagesMapping) {
      const matches = message.match(mapping.regex);

      if (matches) {
        return errorsManager.get(
          mapping.subcode,
          ...mapping.getPlaceholders(matches));
      }
    }

    // Try to match using error codes
    if (error.meta) {
      switch (error.meta.statusCode) {
        case 400:
          return this._handleBadRequestError(error, message);
        case 404:
          return this._handleNotFoundError(error, message);
        case 409:
          return this._handleConflictError(error, message);
        default:
          break;
      }
    }

    return this._handleUnknownError(error, message);
  }

  reject (error) {
    return Bluebird.reject(this.formatESError(error));
  }

  _handleConflictError (error, message) {
    debug('unhandled "Conflict" elasticsearch error: %a', error);

    return errorsManager.get('unexpected_error', message);
  }

  _handleNotFoundError (error, message) {
    let errorMessage = message;

    // 404 on a GET document
    if (error.body.found === false) {
      return errorsManager.get('not_found', error.body._id);
    }

    // 404 on DELETE document (ES error payloads are so cool!)
    if (error.meta.body._id) {
      return errorsManager.get('not_found', error.meta.body._id);
    }

    if (error.meta.body && error.meta.body.error) {
      errorMessage = error.meta.body.error
        ? `${error.meta.body.error.reason}: ${error.meta.body.error['resource.id']}`
        : `${error.message}: ${error.body._id}`;
    }

    debug('unhandled "NotFound" elasticsearch error: %a', error);

    return errorsManager.get('unexpected_not_found', errorMessage);
  }

  _handleBadRequestError (error, message) {
    let errorMessage = message;

    if (error.meta.body && error.meta.body.error) {
      errorMessage = error.meta.body.error.root_cause
        ? error.meta.body.error.root_cause[0].reason
        : error.meta.body.error.reason;

      // empty query throws exception with ES 7
      if ( error.meta.body.error.type === 'parsing_exception'
        && _.get(error, 'meta.body.error.caused_by.type') === 'illegal_argument_exception')
      {
        errorMessage = error.meta.body.error.caused_by.reason;
      }
    }

    debug('unhandled "BadRequest" elasticsearch error: %a', _.get(error, 'meta.body.error.reason', error.message));

    return errorsManager.get('unexpected_bad_request', errorMessage);
  }

  _handleUnknownError (error, message) {
    debug(
      'unhandled elasticsearch error (unhandled type: %s): %a',
      _.get(error, 'error.meta.statusCode', '<no status code>'),
      message);

    return errorsManager.get('unexpected_error', message);
  }
}

module.exports = ESWrapper;
