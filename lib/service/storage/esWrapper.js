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

/* eslint sort-keys: 0 */

'use strict';

const Bluebird = require('bluebird');
const _ = require('lodash');
const es = require('@elastic/elasticsearch');

const { KuzzleError } = require('../../kerror/errors');
const debug = require('../../util/debug')('kuzzle:services:storage:ESCommon');
const kerror = require('../../kerror').wrap('services', 'storage');

const errorMessagesMapping = [
  {
    regex: /^\[es_rejected_execution_exception] rejected execution .*? on EsThreadPoolExecutor\[(.*?), .*$/,
    subCode: 'too_many_operations',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // [illegal_argument_exception] object mapping [titi] can't be changed from nested to non-nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from nested to non-nested$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from non-nested to nested$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
    regex: /^\[illegal_argument_exception] Can't merge a non object mapping \[(.*?)] with an object mapping \[(.*?)]$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
    regex: /^\[illegal_argument_exception] \[(.*?)] is defined as an object in mapping \[(.*?)] but this name is already used for a field in other types$/,
    subcode: 'duplicate_field_mapping',
    getPlaceholders: (esError, matches) => [matches[1], matches[2]]
  },
  {
    // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
    regex: /^mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
    subcode: 'cannot_change_mapping',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
    // eslint-disable-next-line no-regex-spaces
    regex: /^\[mapper_parsing_exception] Mapping definition for \[(.*?)] has unsupported parameters: \[(.*?)]$/,
    subcode: 'unexpected_properties',
    getPlaceholders: (esError, matches) => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] No handler for type [boolean] declared on field [not]
    regex: /^\[mapper_parsing_exception] No handler for type \[(.*?)] declared on field \[(.*?)]$/,
    subcode: 'invalid_mapping_type',
    getPlaceholders: (esError, matches) => [matches[2], matches[1]]
  },
  {
    // [mapper_parsing_exception] failed to parse [conditions.host.flags]
    regex: /^\[mapper_parsing_exception] failed to parse \[(.*?)]$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // Failed to parse mapping [_doc]: Expected map for property [fields] on field [enabled] but got a class java.lang.String
    regex: /^Failed to parse mapping \[.*\]: Expected \w+ for property \[(.*)\] on field \[(.*)\]/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: (esError, matches) => [`${matches[2]}.${matches[1]}`]
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^no such index \[([%&])(.*)\.(.*)\]$/,
    subcode: 'unknown_collection',
    getPlaceholders: (esError, matches) => [
      matches[2],
      matches[3]
    ]
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[(.*?)] on field \[(.*?)] but got a class java\.lang\.String$/,
    subcode: 'wrong_mapping_property',
    getPlaceholders: (esError, matches) => [`${matches[2]}.${matches[1]}`]
  },
  {
    regex: /^\[version_conflict_engine_exception] \[data]\[(.*?)]: version conflict.*$/,
    subcode: 'too_many_changes',
    getPlaceholders: (esError, matches) => [matches[1]]
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
    getPlaceholders: (esError, matches) => [matches[1]]
  },
  {
    // mapping set to strict, dynamic introduction of [lehuong] within [_doc] is not allowed
    regex: /^mapping set to strict, dynamic introduction of \[(.+)\] within \[.+\] is not allowed/,
    subcode: 'strict_mapping_rejection',
    getPlaceholders: (esError, matches) => {
      // "/%26index.collection/_doc"
      const esPath = esError.meta.meta.request.params.path;
      // keep only "index"
      const index = esPath.split('.')[0].split('%26')[1];
      // keep only "collection"
      const collection = esPath.substr(esPath.indexOf('.') + 1).split('/')[0];

      return [matches[1], index, collection];
    }
  },

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

    if (global.NODE_ENV !== 'development') {
      global.kuzzle.log.info(JSON.stringify({
        message: `Elasticsearch Client error: ${error.message}`,
        // /!\ not all ES error classes have a "meta" property
        meta: error.meta || null,
        stack: error.stack,
      }));
    }

    if (error instanceof es.errors.NoLivingConnectionsError) {
      throw kerror.get('not_connected');
    }
    const message = _.get(error, 'meta.body.error.reason', error.message);

    // Try to match a known elasticsearch error
    for (const betterError of errorMessagesMapping) {
      const matches = message.match(betterError.regex);

      if (matches) {
        return kerror.get(
          betterError.subcode,
          ...betterError.getPlaceholders(error, matches));
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

    return kerror.get('unexpected_error', message);
  }

  _handleNotFoundError (error, message) {
    let errorMessage = message;

    // _index= "&nyc-open-data.yellow-taxi"
    const index = error.body._index.split('.')[0].slice(1);
    const collection = error.body._index.split('.')[1];

    // 404 on a GET document
    if (error.body.found === false) {
      return kerror.get('not_found', error.body._id, index, collection);
    }

    // 404 on DELETE document (ES error payloads are so cool!)
    if (error.meta.body._id) {
      return kerror.get('not_found', error.meta.body._id, index, collection);
    }

    if (error.meta.body && error.meta.body.error) {
      errorMessage = error.meta.body.error
        ? `${error.meta.body.error.reason}: ${error.meta.body.error['resource.id']}`
        : `${error.message}: ${error.body._id}`;
    }

    debug('unhandled "NotFound" elasticsearch error: %a', error);

    return kerror.get('unexpected_not_found', errorMessage);
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

    return kerror.get('unexpected_bad_request', errorMessage);
  }

  _handleUnknownError (error, message) {
    debug(
      'unhandled elasticsearch error (unhandled type: %s): %o',
      _.get(error, 'error.meta.statusCode', '<no status code>'),
      error);

    return kerror.get('unexpected_error', message);
  }
}

module.exports = ESWrapper;
