/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

const kerror = require('../kerror');

const assertionError = kerror.wrap('api', 'assert');

const extractors = ([
  {
    methods: {
      extractFromRequest: request => [
        {
          _id: request.input.args._id,
          _source: request.input.body.fields,
        },
      ],
      extractFromResult: request => [request.result],
      insertInRequest: ([documents], request) => {
        request.input.args._id = documents._id;
        request.input.body.fields = documents._source;
        return request;
      },
      insertInResult: ([document], request) => {
        request.setResult(document, { status: request.status });
        return request;
      },
    },
    targets: [ 'deleteFields' ]
  },
  {
    methods: {
      extractFromRequest: request => [{ _id: request.input.args._id }],
      extractFromResult: request => [request.result],
      insertInRequest: (documents, request) => {
        request.input.args._id = documents[0] && documents[0]._id;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status });
        return request;
      }
    },
    targets: [ 'delete', 'get', 'exists' ]
  },
  {
    methods: {
      extractFromRequest: request => {
        let ids = [];
        if ( request.input.body
          && request.input.body.ids
          && Object.keys(request.input.body.ids).length
        ) {
          ids = request.input.body.ids;
        }
        else if (request.input.args.ids) {
          if (Array.isArray(request.input.args.ids)) {
            ids = request.input.args.ids;
          }
          else if (typeof request.input.args.ids === 'string') {
            ids = request.input.args.ids.split(',');
          }
          else {
            throw assertionError.get(
              'invalid_type',
              request.input.args.ids,
              'Array or String');
          }
        }
        return ids.map(_id => ({ _id }));
      },
      extractFromResult: request => {
        if (request.input.action === 'mGet') {
          return request.result.successes;
        }

        const documents = [];

        for (let it = 0; it < request.result.successes.length; it++) {
          documents.push({ _id: request.result.successes[it] });
        }

        return documents;
      },
      insertInRequest: (documents, request) => {
        if (request.input.body && Object.keys(request.input.body).length) {
          request.input.body.ids = documents.map(document => document._id);
        }
        else {
          request.input.args.ids = documents.map(document => document._id);
        }
        return request;
      },
      insertInResult: (documents, request) => {
        if (request.input.action === 'mGet') {
          request.setResult(
            {
              errors: request.result.errors,
              successes: documents
            },
            {
              status: request.status
            });

          return request;
        }

        const result = {
          errors: request.result.errors,
          successes: []
        };

        for (let it = 0; it < documents.length; it++) {
          result.successes.push(documents[it]._id);
        }

        request.setResult(result, { status: request.status });

        return request;
      }
    },
    targets: [ 'mDelete', 'mGet', 'mExists' ]
  },
  {
    methods: {
      extractFromRequest: request => {
        const documents = [];

        for (let it = 0; it < request.input.body.documents.length; it++) {
          const document = request.input.body.documents[it];

          if (request.input.action === 'mUpsert') {
            documents.push({
              _id: document._id,
              _source: { changes: document.changes, default: document.default }
            });
          }
          else {
            documents.push({ _id: document._id, _source: document.body });
          }
        }

        return documents;
      },
      extractFromResult: request => request.result.successes,
      insertInRequest: (documents, request) => {
        request.input.body.documents = [];

        for (let it = 0; it < documents.length; it++) {
          const document = documents[it];

          if (request.input.action === 'mUpsert') {
            request.input.body.documents.push({
              _id: document._id,
              changes: document._source.changes,
              default: document._source.default
            });
          }
          else {
            request.input.body.documents.push({
              _id: document._id,
              body: document._source
            });
          }
        }

        return request;
      },
      insertInResult: (documents, request) => {
        const result = {
          errors: request.result.errors,
          successes: documents
        };

        request.setResult(result, { status: request.status });

        return request;
      }
    },
    targets: [ 'mCreate', 'mCreateOrReplace', 'mReplace', 'mUpdate', 'updateByQuery', 'mUpsert' ]
  },
  {
    methods: {
      extractFromRequest: null, // not eligible for search queries
      extractFromResult: request => {
        return request.result.hits || request.result.documents;
      },
      insertInRequest: null, // not eligible for search queries
      insertInResult: (documents, request) => {
        if (request.input.action === 'search') {
          request.result.hits = documents;
        }
        else if (request.input.action === 'deleteByQuery') {
          request.result.documents = documents;
        }

        return request;
      },
    },
    targets: [ 'search', 'deleteByQuery', 'export' ],
  },
  {
    methods: {
      extractFromRequest: request => [
        { _id: request.input.args._id, _source: request.input.body },
      ],
      extractFromResult: request => [request.result],
      insertInRequest: (documents, request) => {
        request.input.args._id = documents[0] && documents[0]._id;
        request.input.body = documents[0] && documents[0]._source;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status });
        return request;
      },
    },
    targets: [ 'create', 'createOrReplace', 'replace', 'update' ],
  },
  {
    methods: {
      extractFromRequest: request => [
        {
          _id: request.input.args._id,
          _source: request.input.body.changes,
        },
      ],
      extractFromResult: request => [ request.result ],
      insertInRequest: ([document], request) => {
        if (document) {
          request.input.args._id = document._id;
          request.input.body._source = document._source;
        }

        return request;
      },
      insertInResult: ([document], request) => {
        request.setResult(document, { status: request.status });
        return request;
      },
    },
    targets: [ 'upsert' ],
  },
]).reduce((acc, extractor) => {
  extractor.targets.forEach(target => {
    acc[target] = extractor.methods;
  });
  return acc;
}, {});

class DocumentExtractor {
  constructor (request) {
    this.request = request;

    const extractor = extractors[request.input.action];

    if (extractor === undefined) {
      throw kerror.get('core', 'fatal', 'assertion_failed', `no generic documents extractor for ${request.input.action}`);
    }

    if (request.result) {
      this.extractMethod = extractor.extractFromResult;
      this.insertMethod = extractor.insertInResult;
    }
    else {
      this.extractMethod = extractor.extractFromRequest;
      this.insertMethod = extractor.insertInRequest;
    }
  }

  extract () {
    return this.extractMethod(this.request);
  }

  insert (documents) {
    return this.insertMethod(documents, this.request);
  }
}

module.exports = DocumentExtractor;
