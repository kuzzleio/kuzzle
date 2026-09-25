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

import type { JSONObject } from "kuzzle-sdk";

import * as kerror from "../kerror";
import type { KuzzleRequest } from "./request";

const assertionError = kerror.wrap("api", "assert");

type ExtractMethod = (request: KuzzleRequest) => JSONObject[];
type InsertMethod = (
  documents: JSONObject[],
  request: KuzzleRequest,
) => KuzzleRequest;

interface ExtractorMethods {
  extractFromRequest: ExtractMethod | null;
  extractFromResult: ExtractMethod;
  insertInRequest: InsertMethod | null;
  insertInResult: InsertMethod;
}

interface ExtractorDefinition {
  methods: ExtractorMethods;
  targets: string[];
}

/**
 * The body of a request whose action declares one. Every extractor below runs
 * on an action that takes a body — `deleteFields`, `mCreate`, `upsert` — and
 * read `request.input.body` straight through; `body` is `JSONObject | null`
 * on every request, and a request arriving without one raised a TypeError
 * rather than the 400 this error is.
 */
function bodyOf(request: KuzzleRequest): JSONObject {
  const body = request.input.body;

  if (body === null) {
    throw assertionError.get("body_required");
  }

  return body;
}

const extractorDefinitions: ExtractorDefinition[] = [
  {
    methods: {
      extractFromRequest: (request) => [
        {
          _id: request.input.args._id,
          _source: bodyOf(request).fields,
        },
      ],
      extractFromResult: (request) => [request.result],
      insertInRequest: ([document], request) => {
        if (document) {
          request.input.args._id = document._id;
          bodyOf(request).fields = document._source;
        }

        return request;
      },
      insertInResult: ([document], request) => {
        request.setResult(document, { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20
        return request;
      },
    },
    targets: ["deleteFields"],
  },
  {
    methods: {
      extractFromRequest: (request) => [{ _id: request.input.args._id }],
      extractFromResult: (request) => [request.result],
      insertInRequest: (documents, request) => {
        request.input.args._id = documents[0]?._id;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20
        return request;
      },
    },
    targets: ["delete", "get", "exists"],
  },
  {
    methods: {
      extractFromRequest: (request) => {
        let ids: unknown[] = [];
        if (
          request.input.body?.ids &&
          Object.keys(request.input.body.ids).length
        ) {
          ids = request.input.body.ids;
        } else if (request.input.args.ids) {
          if (Array.isArray(request.input.args.ids)) {
            ids = request.input.args.ids;
          } else if (typeof request.input.args.ids === "string") {
            ids = request.getArrayOrCsv("ids");
          } else {
            throw assertionError.get(
              "invalid_type",
              request.input.args.ids,
              "Array or String",
            );
          }
        }
        return ids.map((_id: unknown) => ({ _id }));
      },
      extractFromResult: (request) => {
        if (request.input.action === "mGet") {
          return request.result.successes;
        }

        const documents = [];

        for (const success of request.result.successes) {
          documents.push({ _id: success });
        }

        return documents;
      },
      insertInRequest: (documents, request) => {
        const body = request.input.body;

        if (body && Object.keys(body).length) {
          body.ids = documents.map((document) => document._id);
        } else {
          request.input.args.ids = documents.map((document) => document._id);
        }
        return request;
      },
      insertInResult: (documents, request) => {
        if (request.input.action === "mGet") {
          const mResult = {
            errors: request.result.errors,
            successes: documents,
          };

          request.setResult(mResult, { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20

          return request;
        }

        const result: { errors: unknown; successes: unknown[] } = {
          errors: request.result.errors,
          successes: [],
        };

        for (const document of documents) {
          result.successes.push(document._id);
        }

        request.setResult(result, { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20

        return request;
      },
    },
    targets: ["mDelete", "mGet", "mExists"],
  },
  {
    methods: {
      extractFromRequest: (request) => {
        const documents = [];

        for (const document of bodyOf(request).documents) {
          if (request.input.action === "mUpsert") {
            documents.push({
              _id: document._id,
              _source: document.changes,
            });
          } else {
            documents.push({ _id: document._id, _source: document.body });
          }
        }

        return documents;
      },
      extractFromResult: (request) => request.result.successes,
      insertInRequest: (documents, request) => {
        const body = bodyOf(request);
        const tmpDocuments: JSONObject[] = body.documents;
        const rewritten: JSONObject[] = [];

        for (const [it, document] of documents.entries()) {
          if (request.input.action === "mUpsert") {
            rewritten.push({
              _id: document._id,
              changes: document._source,
              default: tmpDocuments[it]?.default,
            });
          } else {
            rewritten.push({
              _id: document._id,
              body: document._source,
            });
          }
        }

        body.documents = rewritten;

        return request;
      },
      insertInResult: (documents, request) => {
        const result = {
          errors: request.result.errors,
          successes: documents,
        };

        request.setResult(result, { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20

        return request;
      },
    },
    targets: [
      "mCreate",
      "mCreateOrReplace",
      "mReplace",
      "mUpdate",
      "updateByQuery",
      "mUpsert",
    ],
  },
  {
    methods: {
      extractFromRequest: null, // not eligible for search queries
      extractFromResult: (request) => {
        return request.result.hits || request.result.documents;
      },
      insertInRequest: null, // not eligible for search queries
      insertInResult: (documents, request) => {
        if (request.input.action === "search") {
          request.result.hits = documents;
        } else if (request.input.action === "deleteByQuery") {
          request.result.documents = documents;
        }

        return request;
      },
    },
    targets: ["search", "deleteByQuery", "export"],
  },
  {
    methods: {
      extractFromRequest: (request) => [
        { _id: request.input.args._id, _source: request.input.body },
      ],
      extractFromResult: (request) => [request.result],
      insertInRequest: (documents, request) => {
        request.input.args._id = documents[0]?._id;
        request.input.body = documents[0]?._source;
        return request;
      },
      insertInResult: (documents, request) => {
        request.setResult(documents[0], { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20
        return request;
      },
    },
    targets: ["create", "createOrReplace", "replace", "update"],
  },
  {
    methods: {
      extractFromRequest: (request) => [
        {
          _id: request.input.args._id,
          _source: bodyOf(request).changes,
        },
      ],
      extractFromResult: (request) => [request.result],
      insertInRequest: ([document], request) => {
        if (document) {
          request.input.args._id = document._id;
          bodyOf(request).changes = document._source;
        }

        return request;
      },
      insertInResult: ([document], request) => {
        request.setResult(document, { status: request.status }); // NOSONAR: deprecated API kept for behaviour parity, migration tracked in TD-20
        return request;
      },
    },
    targets: ["upsert"],
  },
];

const extractors = extractorDefinitions.reduce<
  Record<string, ExtractorMethods>
>((acc, extractor) => {
  extractor.targets.forEach((target) => {
    acc[target] = extractor.methods;
  });
  return acc;
}, {});

class DocumentExtractor {
  private readonly request: KuzzleRequest;
  private readonly extractMethod: ExtractMethod | null;
  private readonly insertMethod: InsertMethod | null;

  constructor(request: KuzzleRequest) {
    this.request = request;

    const extractor =
      request.input.action === null
        ? undefined
        : extractors[request.input.action];

    if (extractor === undefined) {
      throw kerror.get(
        "core",
        "fatal",
        "assertion_failed",
        `no generic documents extractor for ${request.input.action}`,
      );
    }

    if (request.result) {
      this.extractMethod = extractor.extractFromResult;
      this.insertMethod = extractor.insertInResult;
    } else {
      this.extractMethod = extractor.extractFromRequest;
      this.insertMethod = extractor.insertInRequest;
    }
  }

  extract() {
    // `search`, `deleteByQuery` and `export` have no request-side extractor:
    // they are in `documentEventAliases.notBefore`, so the "before" pass that
    // would ask for one never runs. Both were invoked unchecked.
    if (this.extractMethod === null) {
      throw kerror.get(
        "core",
        "fatal",
        "assertion_failed",
        `no request-side documents extractor for ${this.request.input.action}`,
      );
    }

    return this.extractMethod(this.request);
  }

  insert(documents: JSONObject[]) {
    if (this.insertMethod === null) {
      throw kerror.get(
        "core",
        "fatal",
        "assertion_failed",
        `no request-side documents extractor for ${this.request.input.action}`,
      );
    }

    return this.insertMethod(documents, this.request);
  }
}

export = DocumentExtractor;
