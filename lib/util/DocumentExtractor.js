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

const extractors = ([
  {
    targets: ['delete', 'get'],
    methods: {
      extractFromRequest: request => [{ _id: request.input.resource._id }],
      extractFromResult: request => [request.result],
      insertInRequest: (documents, request) => {
        request.input.resource._id = documents[0] && documents[0]._id;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status });
        return request;
      }
    }
  },
  {
    targets: ['mDelete', 'mGet'],
    methods: {
      extractFromRequest: request => {
        const documents = [];

        for (let it = 0; it < request.input.body.ids.length; it++) {
          documents.push({ _id: request.input.body.ids[it] });
        }
        return documents;
      },
      extractFromResult: request => {
        if (request.input.action === 'mGet') {
          return request.result.hits;
        }
        const documents = [];

        for (let it = 0; it < request.result.length; it++) {
          documents.push({ _id: request.result[it] });
        }
        return documents;
      },
      insertInRequest: (documents, request) => {
        request.input.body.ids = [];

        for (let it = 0; it < documents.length; it++) {
          request.input.body.ids.push(documents[it]._id);
        }
        return request;
      },
      insertInResult: (documents, request) => {
        if (request.input.action === 'mGet') {
          request.setResult({}, { status: request.status });
          request.result.hits = documents;
          request.result.total = request.result.hits.length;
          return request;
        }
        const result = [];

        for (let it = 0; it < documents.length; it++) {
          result.push(documents[it]._id);
        }
        request.setResult(result, { status: request.status });
        return request;
      }
    }
  },
  {
    targets: ['mCreate', 'mCreateOrReplace', 'mReplace', 'mUpdate'],
    methods: {
      extractFromRequest: request => {
        const documents = [];

        for (let it = 0; it < request.input.body.documents.length; it++) {
          const { _id, body: _source } = request.input.body.documents[it];
          documents.push({ _id, _source });
        }
        return documents;
      },
      extractFromResult: request => request.result.hits,
      insertInRequest: (documents, request) => {
        request.input.body.documents = [];

        for (let it = 0; it < documents.length; it++) {
          const { _id, _source: body } = documents[it];
          request.input.body.documents.push({ _id, body});
        }
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult({}, { status: request.status });
        request.result.hits = documents;
        request.result.total = request.result.hits.length;
        return request;
      }
    }
  },
  {
    targets: ['create', 'createOrReplace', 'replace', 'update', '_default'],
    methods: {
      extractFromRequest: request => [{ _id: request.input.resource._id, _source: request.input.body }],
      extractFromResult: request => [request.result],
      insertInRequest: (documents, request) => {
        request.input.resource._id = documents[0] && documents[0]._id;
        request.input.body = documents[0] && documents[0]._source;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status });
        return request;
      }
    }
  }
]).reduce((acc, extractor) => {
  extractor.targets.forEach(target => {
    acc[target] = extractor.methods;
  });
  return acc;
}, {});

class DocumentExtractor {
  constructor(request) {
    this.request = request;

    const extractor = extractors[request.input.action] || extractors._default;
    this.extractMethod = extractor[request.result ? 'extractFromResult' : 'extractFromRequest'];
    this.insertMethod = extractor[request.result ? 'insertInResult' : 'insertInRequest'];
  }

  extract() {
    return this.extractMethod(this.request);
  }

  insert(documents) {
    return this.insertMethod(documents, this.request);
  }
}

module.exports = DocumentExtractor;
