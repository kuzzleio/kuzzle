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

import assert from "assert";
import ms from "ms";
import _ from "lodash";
import Bluebird from "bluebird";
import semver from "semver";

import { debug as debugBuilder } from "../../util/debug";
import ESWrapper from "./esWrapper";
import QueryTranslator from "./queryTranslator";
import didYouMean from "../../util/didYouMean";
import { Service } from "../service";
import { assertIsObject } from "../../util/requestAssertions";
import { VirtualIndex } from "./virtualIndex";
import { ScopeEnum } from "../../core/storage/storeScopeEnum";
import { Client } from "@elastic/elasticsearch";
import * as kerrorLib from "../../kerror";
const kerror = kerrorLib.wrap("services", "storage");

import { isPlainObject } from "../../util/safeObject";
import extractFields from "../../util/extractFields";
import { Mutex } from "../../util/mutex";
import { randomNumber } from "../../util/name-generator";
import { CollectionMappings, JSONObject } from "kuzzle-sdk";

const SCROLL_CACHE_PREFIX = "_docscroll_";

const ROOT_MAPPING_PROPERTIES = [
  "properties",
  "_meta",
  "dynamic",
  "dynamic_templates",
];
const CHILD_MAPPING_PROPERTIES = ["type"];

// Used for collection emulation
const HIDDEN_COLLECTION = "_kuzzle_keep";
const ALIAS_PREFIX = "@"; // @todo next major release: Add ALIAS_PREFIX in FORBIDDEN_CHARS
const PRIVATE_PREFIX = "%";
const PUBLIC_PREFIX = "&";
const INDEX_PREFIX_POSITION_IN_INDICE = 0;
const INDEX_PREFIX_POSITION_IN_ALIAS = 1;
const NAME_SEPARATOR = ".";
const FORBIDDEN_CHARS = `\\/*?"<>| \t\r\n,+#:${NAME_SEPARATOR}${PUBLIC_PREFIX}${PRIVATE_PREFIX}`;
const DYNAMIC_PROPERTY_VALUES = ["true", "false", "strict"];

const debug = debugBuilder("kuzzle:services:elasticsearch");

// used to check whether we need to wait for ES to initialize or not
const esStateEnum = Object.freeze({
  AWAITING: 1,
  NONE: 2,
  OK: 3,
});
let esState = esStateEnum.NONE;

export class Elasticsearch extends Service {
  /**
   * Returns a new elasticsearch client instance
   *
   * @returns {Object}
   */
  static buildClient(config): Client {
    // Passed to Elasticsearch's client to make it use
    // Bluebird instead of ES6 promises

    const defer = function defer() {
      let resolve;
      let reject;

      const promise = new Bluebird((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, reject, resolve };
    };

    return new Client({ defer, ...config });
  }

  private client: Client;
  public readonly scope: ScopeEnum;
  private indexPrefix: string;
  private esWrapper: ESWrapper;
  private esVersion: string;
  private translator: QueryTranslator;
  public searchBodyKeys: string[];
  public scriptKeys: string[];
  public scriptAllowedArgs: string[];
  public maxScrollDuration: number;
  public scrollTTL: number;

  private virtualIndex: VirtualIndex;

  static getRandomNumber(max) {
    return randomNumber(max);
  }

  constructor(config: JSONObject, scope, virtualIndex) {
    super("elasticsearch", config);
    this.virtualIndex = virtualIndex;
    this.scope = scope;
    this.indexPrefix =
      scope === ScopeEnum.PRIVATE ? PRIVATE_PREFIX : PUBLIC_PREFIX;

    this.client = null;
    this.esWrapper = null;
    this.esVersion = null;
    this.translator = new QueryTranslator();

    // Allowed root key of a search query
    this.searchBodyKeys = [
      "aggregations",
      "aggs",
      "collapse",
      "explain",
      "from",
      "highlight",
      "query",
      "search_after",
      "search_timeout",
      "size",
      "sort",
      "suggest",
      "_name",
      "_source",
      "_source_excludes",
      "_source_includes",
    ];

    /**
     * Only allow stored-scripts in queries
     */
    this.scriptKeys = ["script", "_script"];
    this.scriptAllowedArgs = ["id", "params"];

    this.maxScrollDuration = this.loadMsConfig("maxScrollDuration");

    this.scrollTTL = this.loadMsConfig("defaults.scrollTTL");
  }

  async init() {
    await this.initSequence();
    await this.listIndexes();
  }

  /**
   * Initializes the elasticsearch client
   *
   * @override
   * @returns {Promise}
   */
  private async initSequence() {
    if (this.client) {
      return;
    }

    if (
      global.NODE_ENV !== "development" &&
      this._config.commonMapping.dynamic === "true"
    ) {
      global.kuzzle.log.warn(
        [
          "Your dynamic mapping policy is set to 'true' for new fields.",
          "Elasticsearch will try to automatically infer mapping for new fields, and those cannot be changed afterward.",
          'See the "services.storageEngine.commonMapping.dynamic" option in the kuzzlerc configuration file to change this value.',
        ].join("\n")
      );
    }

    this.client = Elasticsearch.buildClient(this._config.client);

    await this.waitForElasticsearch();

    this.esWrapper = new ESWrapper(this.client);

    const {
      body: { version },
    } = await this.client.info();

    if (
      version &&
      !semver.satisfies(semver.coerce(version.number), ">= 7.0.0")
    ) {
      throw kerror.get("version_mismatch", version.number);
    }

    this.esVersion = version;
  }

  /**
   * Translate Koncorde filters to Elasticsearch query
   *
   * @param {Object} filters - Set of valid Koncorde filters
   * @returns {Object} Equivalent Elasticsearch query
   */
  translateKoncordeFilters(filters) {
    return this.translator.translate(filters);
  }

  /**
   * Returns some basic information about this service
   * @override
   *
   * @returns {Promise.<Object>} service informations
   */
  info() {
    const result = {
      lucene: "",
      nodes: null,
      spaceUsed: -1,
      status: -1,
      type: "elasticsearch",
      version: this.esVersion,
    };

    return this.client
      .info()
      .then(({ body }) => {
        result.version = body.version.number;
        result.lucene = body.version.lucene_version;

        return this.client.cluster.health();
      })
      .then(({ body }) => {
        result.status = body.status;

        return this.client.cluster.stats({ human: true });
      })
      .then(({ body }) => {
        result.spaceUsed = body.indices.store.size;
        result.nodes = body.nodes;

        return result;
      })
      .catch((error) => this.esWrapper.reject(error));
  }

  /**
   * Returns detailed multi-level storage stats data
   *
   * @returns {Promise.<Object>}
   */
  async stats() {
    const esRequest = {
      metric: ["docs", "store"],
    };

    const { body } = await this.client.indices.stats(esRequest);
    const indexes = {};
    let size = 0;

    for (const [indice, indiceInfo] of Object.entries(body.indices)) {
      // Ignore non-Kuzzle indices
      if (
        indice[INDEX_PREFIX_POSITION_IN_INDICE] !== PRIVATE_PREFIX &&
        indice[INDEX_PREFIX_POSITION_IN_INDICE] !== PUBLIC_PREFIX
      ) {
        continue;
      }

      const aliases = await this.getAliasFromIndice(indice);
      const alias = aliases[0];
      const indexName = this.extractIndex(alias);
      const collectionName = this.extractCollection(alias);

      if (
        alias[INDEX_PREFIX_POSITION_IN_ALIAS] !== this.indexPrefix ||
        collectionName === HIDDEN_COLLECTION
      ) {
        continue;
      }

      if (!indexes[indexName]) {
        indexes[indexName] = {
          collections: [],
          name: indexName,
          size: 0,
        };
      }
      // @ts-ignore
      indexes[indexName].collections.push({
        // @ts-ignore
        documentCount: indiceInfo.total.docs.count,
        name: collectionName,
        // @ts-ignore
        size: indiceInfo.total.store.size_in_bytes,
      });
      // @ts-ignore
      indexes[indexName].size += indiceInfo.total.store.size_in_bytes;
      // @ts-ignore
      size += indiceInfo.total.store.size_in_bytes;
    }

    return {
      indexes: Object.values(indexes),
      size,
    };
  }

  /**
   * Scrolls results from previous elasticsearch query.
   * Automatically clears the scroll context after the last result page has
   * been fetched.
   *
   * @param {String} scrollId - Scroll identifier
   * @param {Object} options - scrollTTL (default scrollTTL)
   *
   * @returns {Promise.<{ scrollId, hits, aggregations, total }>}
   */
  // @ts-ignore
  async scroll(scrollId, { scrollTTL } = {}) {
    const _scrollTTL = scrollTTL || this._config.defaults.scrollTTL;
    const esRequest = {
      scroll: _scrollTTL,
      scrollId,
    };

    const cacheKey =
      SCROLL_CACHE_PREFIX + global.kuzzle.hash(esRequest.scrollId);

    debug("Scroll: %o", esRequest);

    if (_scrollTTL) {
      const scrollDuration = ms(_scrollTTL);

      if (scrollDuration > this.maxScrollDuration) {
        throw kerror.get("scroll_duration_too_great", _scrollTTL);
      }
    }

    const stringifiedScrollInfo = await global.kuzzle.ask(
      "core:cache:internal:get",
      cacheKey
    );

    if (!stringifiedScrollInfo) {
      throw kerror.get("unknown_scroll_id");
    }

    const scrollInfo = JSON.parse(stringifiedScrollInfo);

    try {
      const body: Record<string, any> = (await this.client.scroll(esRequest))
        .body;

      scrollInfo.fetched += body.hits.hits.length;

      if (scrollInfo.fetched >= body.hits.total.value) {
        debug("Last scroll page fetched: deleting scroll %s", body._scroll_id);
        await global.kuzzle.ask("core:cache:internal:del", cacheKey);
        await this.clearScroll(body._scroll_id);
      } else {
        await global.kuzzle.ask(
          "core:cache:internal:store",
          cacheKey,
          JSON.stringify(scrollInfo),
          {
            ttl: ms(_scrollTTL) || this.scrollTTL,
          }
        );
      }

      body.remaining = body.hits.total.value - scrollInfo.fetched;

      return await this.formatSearchResult(body, scrollInfo);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Searches documents from elasticsearch with a query
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   * @param targets - contain index and collections for multisearch. If target is not null, index and collection sould be null.
   * @param {Object} options - from (undefined), size (undefined), scroll (undefined)
   *
   * @returns {Promise.<{ scrollId, hits, aggregations, suggest, total }>}
   */
  async search(
    // @ts-ignore
    { index, collection, searchBody, targets } = {},
    // @ts-ignore
    { from, size, scroll } = {}
  ) {
    let esIndexes;

    if (targets && targets.length > 0) {
      const indexes = new Set();
      for (const target of targets) {
        for (const targetCollection of target.collections) {
          const alias = this.getAlias(target.index, targetCollection);
          indexes.add(alias);
        }
      }
      esIndexes = Array.from(indexes).join(",");
    } else {
      esIndexes = this.getAlias(index, collection);
    }

    const esRequest = {
      body: this.sanitizeSearchBody(searchBody, index),
      from,
      index: esIndexes,
      scroll,
      size,
      trackTotalHits: true,
    };

    if (scroll) {
      const scrollDuration = ms(scroll);

      if (scrollDuration > this.maxScrollDuration) {
        throw kerror.get("scroll_duration_too_great", scroll);
      }
    }

    debug("Search: %j", esRequest);

    try {
      const { body } = await this.client.search(esRequest);

      if (body._scroll_id) {
        const ttl =
          (esRequest.scroll && ms(esRequest.scroll)) ||
          ms(this._config.defaults.scrollTTL);

        await global.kuzzle.ask(
          "core:cache:internal:store",
          SCROLL_CACHE_PREFIX + global.kuzzle.hash(body._scroll_id),
          JSON.stringify({
            collection,
            fetched: body.hits.hits.length,
            index,
            targets,
          }),
          { ttl }
        );

        body.remaining = body.hits.total.value - body.hits.hits.length;
      }

      return await this.formatSearchResult(body, {
        collection,
        index,
        targets,
      });
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Generate a map that associate an alias to a pair of index and collection
   *
   * @param {*} targets
   * @returns
   */
  private mapTargetsToAlias(targets) {
    const aliasToTargets = {};

    for (const target of targets) {
      for (const targetCollection of target.collections) {
        const alias = this.getAlias(target.index, targetCollection);
        if (!aliasToTargets[alias]) {
          aliasToTargets[alias] = {
            collection: targetCollection,
            index: target.index,
          };
        }
      }
    }

    return aliasToTargets;
  }

  private async formatSearchResult(
    body,
    searchInfo = { collection: null, index: null, targets: null }
  ) {
    let aliasToTargets = {};
    const aliasCache = new Map();
    if (searchInfo.targets) {
      /**
       * We need to map the alias to the target index and collection,
       * so we can later retrieve informations about an index & collection
       * based on its alias.
       */
      aliasToTargets = this.mapTargetsToAlias(searchInfo.targets);
    }

    const formatHit = async (hit) => {
      let index = searchInfo.index;
      let collection = searchInfo.collection;

      /**
       * If the search has been done on multiple targets, we need to
       * retrieve the appropriate index and collection based on the alias
       */
      if (hit._index && searchInfo.targets) {
        // Caching to reduce call to ES
        let aliases = aliasCache.get(hit._index);
        if (!aliases) {
          // Retrieve all the alias associated to one index
          aliases = await this.getAliasFromIndice(hit._index);
          aliasCache.set(hit._index, aliases);
        }

        /**
         * Since multiple alias can point to the same index in ES, we need to
         * find the first alias that exists in the map of aliases associated
         * to the targets.
         */
        const alias = aliases.find((_alias) => aliasToTargets[_alias]);

        // Retrieve index and collection information based on the matching alias
        index = aliasToTargets[alias].index;
        collection = aliasToTargets[alias].collection;
      }

      return {
        _id: this.virtualIndex.getVirtualId(index, hit._id),
        _score: hit._score,
        _source: hit._source,
        collection,
        highlight: hit.highlight,
        index,
      };
    };

    async function formatInnerHits(innerHits) {
      if (!innerHits) {
        return undefined;
      }

      const formattedInnerHits = {};
      for (const [name, _innerHit] of Object.entries(innerHits)) {
        const innerHit: any = _innerHit;
        formattedInnerHits[name] = await Bluebird.map(
          innerHit.hits.hits,
          formatHit
        );
      }
      return formattedInnerHits;
    }

    const hits = await Bluebird.map(body.hits.hits, async (hit: any) => ({
      inner_hits: await formatInnerHits(hit.inner_hits),
      ...(await formatHit(hit)),
    }));

    return {
      aggregations: body.aggregations,
      hits,
      remaining: body.remaining,
      scrollId: body._scroll_id,
      suggest: body.suggest,
      total: body.hits.total.value,
    };
  }

  /**
   * Gets the document with given ID
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async get(index, collection, id) {
    const esRequest = {
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
    };

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all
    // document without filter because the body is empty in HTTP by default
    if (esRequest.id === "_search") {
      return kerror.reject("search_as_an_id");
    }

    debug("Get document: %o", esRequest);

    try {
      const { body } = await this.client.get(esRequest);

      return {
        _id: this.virtualIndex.getVirtualId(index, body._id),
        _source: body._source,
        _version: body._version,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Returns the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single
   * index/collection, using the body { ids: [.. } syntax.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Document IDs
   *
   * @returns {Promise.<{ items: Array<{ _id, _source, _version }>, errors }>}
   */
  async mGet(index, collection, ids) {
    if (ids.length === 0) {
      return { errors: [], item: [] };
    }

    const esRequest = {
      body: {
        docs: ids.map((_id) => ({
          _id,
          _index: this.getAlias(index, collection),
        })),
      },
    };

    debug("Multi-get documents: %o", esRequest);

    let body;

    try {
      ({ body } = await this.client.mget(esRequest));
    } catch (e) {
      throw this.esWrapper.formatESError(e);
    }

    const errors = [];
    const items = [];

    for (let i = 0; i < body.docs.length; i++) {
      const doc = body.docs[i];

      if (doc.found) {
        items.push({
          _id: doc._id,
          _source: doc._source,
          _version: doc._version,
        });
      } else {
        errors.push(doc._id);
      }
    }

    return { errors, items };
  }

  /**
   * Counts how many documents match the filter given in body
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   *
   * @returns {Promise.<Number>} count
   */
  async count(index, collection, searchBody = {}) {
    const esRequest = {
      body: this.sanitizeSearchBody(searchBody, index),
      index: this.getAlias(index, collection),
    };

    debug("Count: %o", esRequest);

    try {
      const { body } = await this.client.count(esRequest);
      return body.count;
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Sends the new document to elasticsearch
   * Cleans data to match elasticsearch specifications
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} content - Document content
   * @param {Object} options - id (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  async create(
    index,
    collection,
    content,
    // @ts-ignore
    { id, refresh, userId = null } = {}
  ) {
    assertIsObject(content);
    if (!id && this.virtualIndex.isVirtual(index)) {
      id = this.virtualIndex.randomString(20);
    }
    const esRequest = {
      body: content,
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
      op_type: id ? "create" : "index",
      refresh,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: getKuid(userId),
      createdAt: Date.now(),
      index,
      updatedAt: null,
      updater: null,
    };

    debug("Create document: %o", esRequest);

    try {
      // @ts-ignore
      const { body } = await this.client.index(esRequest);

      return {
        _id: this.virtualIndex.getVirtualId(index, body._id),
        _source: esRequest.body,
        _version: body._version,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Creates a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (undefined), userId (null), injectKuzzleMeta (true)
   *
   * @returns {Promise.<Object>} { _id, _version, _source, created }
   */
  async createOrReplace(
    index,
    collection,
    id,
    content,
    { refresh = false, userId = null, injectKuzzleMeta = true } = {}
  ) {
    const esRequest = {
      body: content,
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
      refresh,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    if (injectKuzzleMeta) {
      esRequest.body._kuzzle_info = {
        author: getKuid(userId),
        createdAt: Date.now(),
        index,
        updatedAt: Date.now(),
        updater: getKuid(userId),
      };
    }

    debug("Create or replace document: %o", esRequest);

    try {
      const { body } = await this.client.index(esRequest);

      return {
        _id: this.virtualIndex.getVirtualId(index, body._id),
        _source: esRequest.body,
        _version: body._version,
        created: body.result === "created", // Needed by the notifier
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Sends the partial document to elasticsearch with the id to update
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - refresh (undefined), userId (null), retryOnConflict (0)
   *
   * @returns {Promise.<{ _id, _version }>}
   */
  async update(
    index,
    collection,
    id,
    content,
    // @ts-ignore
    { refresh, userId = null, retryOnConflict } = {}
  ) {
    const esRequest = {
      _source: true,
      body: { doc: content },
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
      refresh,
      retry_on_conflict:
        retryOnConflict || this._config.defaults.onUpdateConflictRetries,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body.doc._kuzzle_info = {
      index,
      updatedAt: Date.now(),
      updater: getKuid(userId),
    };

    debug("Update document: %o", esRequest);

    try {
      // @ts-ignore
      const { body } = await this.client.update(esRequest);
      return {
        _id: body._id,
        _source: body.get._source,
        _version: body._version,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Sends the partial document to elasticsearch with the id to update
   * Creates the document if it doesn't already exist
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - defaultValues ({}), refresh (undefined), userId (null), retryOnConflict (0)
   *
   * @returns {Promise.<{ _id, _version }>}
   */
  async upsert(
    index,
    collection,
    id,
    content,
    // @ts-ignore
    { defaultValues = {}, refresh, userId = null, retryOnConflict } = {}
  ) {
    const esRequest = {
      _source: true,
      body: {
        doc: content,
        upsert: { ...defaultValues, ...content },
      },
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
      refresh,
      retry_on_conflict:
        retryOnConflict || this._config.defaults.onUpdateConflictRetries,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    const user = getKuid(userId);
    const now = Date.now();

    esRequest.body.doc._kuzzle_info = {
      index,
      updatedAt: now,
      updater: user,
    };
    esRequest.body.upsert._kuzzle_info = {
      author: user,
      createdAt: now,
    };

    debug("Upsert document: %o", esRequest);

    try {
      // @ts-ignore
      const { body } = await this.client.update(esRequest);

      return {
        _id: body._id,
        _source: body.get._source,
        _version: body._version,
        created: body.result === "created",
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Replaces a document to ElasticSearch
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (undefined), userId (null)
   *
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async replace(
    index,
    collection,
    id,
    content,
    // @ts-ignore
    { refresh, userId = null } = {}
  ) {
    const alias = this.getAlias(index, collection);
    const esRequest = {
      body: content,
      id: this.virtualIndex.getId(index, id),
      index: alias,
      refresh,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: getKuid(userId),
      createdAt: Date.now(),
      index,
      updatedAt: Date.now(),
      updater: getKuid(userId),
    };

    try {
      const { body: exists } = await this.client.exists({ id, index: alias });

      if (!exists) {
        throw kerror.get("not_found", id, index, collection);
      }

      debug("Replace document: %o", esRequest);

      const { body } = await this.client.index(esRequest);

      return {
        _id: id,
        _source: esRequest.body,
        _version: body._version,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Sends to elasticsearch the document id to delete
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} options - refresh (undefined)
   *
   * @returns {Promise}
   */
  async delete(
    index,
    collection,
    id,
    // @ts-ignore
    { refresh } = {}
  ) {
    const esRequest = {
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
      refresh,
    };

    assertWellFormedRefresh(esRequest);

    debug("Delete document: %o", esRequest);

    try {
      await this.client.delete(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
    return null;
  }

  /**
   * Deletes all documents matching the provided filters.
   * If fetch=false, the max documents write limit is not applied.
   *
   * Options:
   *  - size: size of the batch to retrieve documents (no-op if fetch=false)
   *  - refresh: refresh option for ES
   *  - fetch: if true, will fetch the documents before delete them
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} options - size (undefined), refresh (undefined), fetch (true)
   *
   * @returns {Promise.<{ documents, total, deleted, failures: Array<{ _shardId, reason }> }>}
   */
  async deleteByQuery(
    index,
    collection,
    query,
    // @ts-ignore
    { refresh, size = 1000, fetch = true } = {}
  ) {
    const esRequest = {
      body: this.sanitizeSearchBody({ query }, index),
      index: this.getAlias(index, collection),
      scroll: "5s",
      size,
    };

    if (!isPlainObject(query)) {
      throw kerror.get("missing_argument", "body.query");
    }

    try {
      let documents = [];

      if (fetch) {
        documents = await this.getAllDocumentsFromQuery(esRequest);
      }

      debug("Delete by query: %o", esRequest);
      // @ts-ignore
      esRequest.refresh = refresh === "wait_for" ? true : refresh;
      const { body } = await this.client.deleteByQuery(esRequest);

      return {
        deleted: body.deleted,
        documents,
        failures: body.failures.map(({ shardId, reason }) => ({
          reason,
          shardId,
        })),
        total: body.total,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Delete fields of a document and replace it
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Array}  fields - Document fields to be removed
   * @param {Object} options - refresh (undefined), userId (null)
   *
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async deleteFields(
    index,
    collection,
    id,
    fields,

    { refresh = undefined, userId = undefined } = {}
  ) {
    const alias = this.getAlias(index, collection);
    const esRequest = {
      id: this.virtualIndex.getId(index, id),
      index: alias,
    };

    try {
      debug("DeleteFields document: %o", esRequest);
      const { body } = await this.client.get(esRequest);

      for (const field of fields) {
        if (_.has(body._source, field)) {
          _.set(body._source, field, undefined);
        }
      }

      body._source._kuzzle_info = {
        ...body._source._kuzzle_info,
        updatedAt: Date.now(),
        updater: getKuid(userId),
      };

      const newEsRequest = {
        body: body._source,
        id,
        index: alias,
        refresh,
      };

      assertNoRouting(newEsRequest);
      assertWellFormedRefresh(newEsRequest);

      const { body: updated } = await this.client.index(newEsRequest);

      return {
        _id: id,
        _source: body._source,
        _version: updated._version,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Updates all documents matching the provided filters
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} changes - Changes wanted on documents
   * @param {Object} options - refresh (undefined), size (undefined)
   *
   * @returns {Promise.<{ successes: [_id, _source, _status], errors: [ document, status, reason ] }>}
   */
  async updateByQuery(
    index,
    collection,
    query,
    changes,
    { refresh = undefined, size = 1000, userId = null } = {}
  ) {
    try {
      const esRequest = {
        body: this.sanitizeSearchBody({ query }, index),
        index: this.getAlias(index, collection),
        scroll: "5s",
        size,
      };

      const documents = await this.getAllDocumentsFromQuery(esRequest);

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        document._source = undefined;
        document.body = changes;
      }

      debug("Update by query: %o", esRequest);

      const { errors, items } = await this.mUpdate(
        index,
        collection,
        documents,
        // @ts-ignore
        { refresh, userId }
      );
      return {
        errors,
        successes: items,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Updates all documents matching the provided filters
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} changes - Changes wanted on documents
   * @param {Object} options - refresh (undefined)
   *
   * @returns {Promise.<{ successes: [_id, _source, _status], errors: [ document, status, reason ] }>}
   */
  async bulkUpdateByQuery(
    index,
    collection,
    query,
    changes,
    { refresh = "false" } = {}
  ) {
    const script = {
      params: {},
      source: "",
    };

    const flatChanges = extractFields(changes, { alsoExtractValues: true });

    for (const { key, value } of flatChanges) {
      script.source += `ctx._source.${key} = params['${key}'];`;
      script.params[key] = value;
    }

    const esRequest = {
      body: {
        query: this.sanitizeSearchBody({ query }, index).query,
        script,
      },
      index: this.getAlias(index, collection),
      refresh,
    };

    debug("Bulk Update by query: %o", esRequest);

    let response;
    try {
      // @ts-ignore
      response = await this.client.updateByQuery(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    if (response.body.failures.length) {
      const errors = response.body.failures.map(({ shardId, reason }) => ({
        reason,
        shardId,
      }));

      throw kerror.get("incomplete_update", response.body.updated, errors);
    }

    return {
      updated: response.body.updated,
    };
  }

  /**
   * Execute the callback with a batch of documents of specified size until all
   * documents matched by the query have been processed.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Function} callback - callback that will be called with the "hits" array
   * @param {Object} options - size (10), scrollTTL ('5s')
   *
   * @returns {Promise.<any[]>} Array of results returned by the callback
   */
  async mExecute(
    index,
    collection,
    query,
    callback,
    { size = 10, scrollTTl = "5s" } = {}
  ) {
    const esRequest = {
      body: this.sanitizeSearchBody({ query }, index),
      from: 0,
      index: this.getAlias(index, collection),
      scroll: scrollTTl,
      size,
    };

    if (!isPlainObject(query)) {
      throw kerror.get("missing_argument", "body.query");
    }

    const client = this.client;
    let results = [];

    let processed = 0;
    let scrollId = null;

    try {
      results = await new Bluebird((resolve, reject) => {
        this.client.search(
          esRequest,
          async function getMoreUntilDone(
            error,
            { body: { hits, _scroll_id } }
          ) {
            if (error) {
              reject(error);
              return;
            }

            scrollId = _scroll_id;

            const ret = callback(hits.hits);

            results.push(await ret);
            processed += hits.hits.length;

            if (hits.total.value !== processed) {
              client.scroll(
                {
                  scroll: esRequest.scroll,
                  // @ts-ignore
                  scrollId: _scroll_id,
                },
                getMoreUntilDone
              );
            } else {
              resolve(results);
            }
          }
        );
      });
    } finally {
      this.clearScroll(scrollId);
    }

    return results;
  }

  /**
   * Creates a new index.
   *
   * This methods creates an hidden collection in the provided index to be
   * able to list it.
   * This methods resolves if the index name does not already exists either as
   * private or public index.
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  async createIndex(index) {
    this.assertValidIndexAndCollection(index);

    let body;

    try {
      ({ body } = await this.client.cat.aliases({ format: "json" }));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const aliases = body.map(({ alias: name }) => name);
    for (const alias of aliases) {
      const indexName = this.extractIndex(alias);
      if (index === indexName) {
        const indexType =
          alias[INDEX_PREFIX_POSITION_IN_ALIAS] === PRIVATE_PREFIX
            ? "private"
            : "public";

        throw kerror.get("index_already_exists", indexType, index);
      }
    }
    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("index_already_exists", "virtual", index);
    }
    await this.createHiddenCollection(index);
    return null;
  }

  /**
   * Creates an empty collection.
   * Mappings and settings will be applied if supplied.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} config - mappings ({}), settings ({})
   *
   * @returns {Promise}
   */
  async createCollection(
    index,
    collection,
    {
      mappings = {
        _meta: undefined,
        dynamic: undefined,
        properties: undefined,
      },
      settings = {},
    } = {}
  ) {
    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("create_virtual_collection");
    }

    this.assertValidIndexAndCollection(index, collection);

    if (collection === HIDDEN_COLLECTION) {
      throw kerror.get("collection_reserved", HIDDEN_COLLECTION);
    }

    const mutex = new Mutex(`hiddenCollection/create/${index}`);
    try {
      await mutex.lock();

      if (await this.hasHiddenCollection(index)) {
        await this.deleteCollection(index, HIDDEN_COLLECTION);
      }
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    } finally {
      await mutex.unlock();
    }

    const esRequest = {
      body: {
        aliases: {
          [this.getAlias(index, collection)]: {},
        },
        mappings: {},
        settings,
      },
      index: await this.getAvailableIndice(index, collection),
    };

    this.checkDynamicProperty(mappings);

    const exists = await this.hasCollection(index, collection);
    if (exists) {
      return this.updateCollection(index, collection, { mappings, settings });
    }
    this.checkMappings(mappings);

    esRequest.body.mappings = {
      _meta: mappings._meta || this._config.commonMapping._meta,
      dynamic: mappings.dynamic || this._config.commonMapping.dynamic,
      properties: _.merge(
        mappings.properties,
        this._config.commonMapping.properties
      ),
    };

    try {
      await this.client.indices.create(esRequest);
    } catch (error) {
      if (
        _.get(error, "meta.body.error.type") ===
        "resource_already_exists_exception"
      ) {
        // race condition: the indice has been created between the "exists"
        // check above and this "create" attempt
        return null;
      }

      throw this.esWrapper.formatESError(error);
    }
    return null;
  }

  /**
   * Retrieves settings definition for index/type
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<{ settings }>}
   */
  async getSettings(index, collection) {
    const indice = await this.getIndice(index, collection);
    const esRequest = {
      index: indice,
    };

    debug("Get settings: %o", esRequest);

    try {
      const { body } = await this.client.indices.getSettings(esRequest);

      return body[indice].settings.index;
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Retrieves mapping definition for index/type
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} options - includeKuzzleMeta (false)
   *
   * @returns {Promise.<{ dynamic, _meta, properties }>}
   */
  async getMapping(
    index,
    collection,
    { includeKuzzleMeta = false } = {}
  ): Promise<CollectionMappings> {
    const indice = await this.getIndice(index, collection);
    const esRequest = {
      index: indice,
    };

    debug("Get mapping: %o", esRequest);

    try {
      const { body } = await this.client.indices.getMapping(esRequest);

      const properties = includeKuzzleMeta
        ? body[indice].mappings.properties
        : _.omit(body[indice].mappings.properties, "_kuzzle_info");

      return {
        _meta: body[indice].mappings._meta,
        dynamic: body[indice].mappings.dynamic,
        properties,
      };
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Updates a collection mappings and settings
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} config - mappings ({}), settings ({})
   *
   * @returns {Promise}
   */
  async updateCollection(
    index,
    collection,
    {
      mappings = { _meta: null, dynamic: null, properties: null },
      settings = {},
    } = {}
  ) {
    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("update_virtual_collection");
    }
    const esRequest = {
      index: await this.getIndice(index, collection),
    };

    // If either the putMappings or the putSettings operation fail, we need to
    // rollback the whole operation. Since mappings can't be rollback, we try to
    // update the settings first, then the mappings and we rollback the settings
    // if putMappings fail.
    let indexSettings;
    try {
      indexSettings = await this._getSettings(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    if (!_.isEmpty(settings)) {
      await this.updateSettings(index, collection, settings);
    }

    try {
      if (!_.isEmpty(mappings)) {
        const previousMappings: CollectionMappings = await this.getMapping(
          index,
          collection
        );

        await this.updateMapping(index, collection, mappings);

        if (this.dynamicChanges(previousMappings, mappings)) {
          await this.updateSearchIndex(index, collection);
        }
      }
    } catch (error) {
      const allowedSettings = this.getAllowedIndexSettings(indexSettings);

      // Rollback to previous settings
      if (!_.isEmpty(settings)) {
        await this.updateSettings(index, collection, allowedSettings);
      }

      throw error;
    }

    return null;
  }

  /**
   * Given index settings we return a new version of index settings
   * only with allowed settings that can be set (during update or create index).
   * @param indexSettings the index settings
   * @returns {{index: *}} a new index settings with only allowed settings.
   */
  getAllowedIndexSettings(indexSettings) {
    return {
      index: _.omit(indexSettings.index, [
        "creation_date",
        "provided_name",
        "uuid",
        "version",
      ]),
    };
  }

  /**
   * Sends an empty UpdateByQuery request to update the search index
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @returns {Promise.<Object>} {}
   */
  async updateSearchIndex(index, collection) {
    const esRequest = {
      body: {},
      // @cluster: conflicts when two nodes start at the same time
      conflicts: "proceed",
      index: this.getAlias(index, collection),
      refresh: true,
      // This operation can take some time: this should be an ES
      // background task. And it's preferable to a request timeout when
      // processing large indexes.
      waitForCompletion: false,
    };

    debug("UpdateByQuery: %o", esRequest);

    try {
      // @ts-ignore
      await this.client.updateByQuery(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Update a collection mappings
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} mappings - Collection mappings in ES format
   *
   * @returns {Promise.<{ dynamic, _meta, properties }>}
   */
  async updateMapping(index, collection, mappings: CollectionMappings) {
    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("update_virtual_collection");
    }

    const esRequest = {
      body: undefined,
      index: this.getAlias(index, collection),
    };

    this.checkDynamicProperty(mappings);

    const collectionMappings: CollectionMappings = await this.getMapping(
      index,
      collection,
      {
        includeKuzzleMeta: true,
      }
    );

    this.checkMappings(mappings);

    esRequest.body = {
      _meta: mappings._meta || collectionMappings._meta,
      dynamic: mappings.dynamic || collectionMappings.dynamic,
      properties: mappings.properties,
    };

    debug("Update mapping: %o", esRequest);

    try {
      await this.client.indices.putMapping(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const fullProperties = _.merge(
      collectionMappings.properties,
      mappings.properties
    );

    return {
      _meta: esRequest.body._meta,
      dynamic: esRequest.body.dynamic,
      properties: fullProperties,
    };
  }

  /**
   * Updates a collection settings (eg: analyzers)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} settings - Collection settings in ES format
   *
   * @returns {Promise}
   */
  async updateSettings(index, collection, settings = {}) {
    const esRequest = {
      index: this.getAlias(index, collection),
    };

    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("update_virtual_index");
    }

    await this.client.indices.close(esRequest);

    try {
      await this.client.indices.putSettings({ ...esRequest, body: settings });
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    } finally {
      await this.client.indices.open(esRequest);
    }

    return null;
  }

  /**
   * Empties the content of a collection. Keep the existing mapping and settings.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise}
   */
  async truncateCollection(index, collection) {
    let mappings: CollectionMappings;
    let settings;

    if (this.virtualIndex.isVirtual(index)) {
      return this.deleteByQuery(index, collection, {});
    }

    const esRequest = {
      index: await this.getIndice(index, collection),
    };

    try {
      mappings = await this.getMapping(index, collection, {
        includeKuzzleMeta: true,
      });
      settings = await this._getSettings(esRequest);
      settings = {
        ...settings,
        ...this.getAllowedIndexSettings(settings),
      };
      await this.client.indices.delete(esRequest);

      await this.client.indices.create({
        ...esRequest,
        body: {
          aliases: {
            [this.getAlias(index, collection)]: {},
          },
          mappings,
          settings,
        },
      });

      return null;
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Runs several action and document
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents to import
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async import(
    index,
    collection,
    documents,
    { refresh = undefined, timeout = undefined, userId = undefined } = {}
  ) {
    const alias = this.getAlias(index, collection);
    const actionNames = ["index", "create", "update", "delete"];
    const dateNow = Date.now();
    const esRequest = {
      body: documents,
      refresh,
      timeout,
    };
    const kuzzleMeta = {
      created: {
        author: getKuid(userId),
        createdAt: dateNow,
        updatedAt: null,
        updater: null,
      },
      updated: {
        updatedAt: dateNow,
        updater: getKuid(userId),
      },
    };

    assertWellFormedRefresh(esRequest);
    this.scriptCheck(documents);

    let lastAction;

    /**
     * @warning Critical code section
     *
     * bulk body can contain more than 10K elements
     */

    for (let i = 0; i < esRequest.body.length; i++) {
      const item = esRequest.body[i];
      lastAction = this.prepareItem(
        item,
        actionNames,
        lastAction,
        alias,
        kuzzleMeta
      );
    }
    /* end critical code section */

    let response;
    try {
      response = await this.client.bulk(esRequest);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const body = response.body;

    const result = {
      errors: [],
      items: [],
    };

    let idx = 0;

    /**
     * @warning Critical code section
     *
     * bulk body can contain more than 10K elements
     */

    for (let i = 0; i < body.items.length; i++) {
      const row = body.items[i];
      this.formatItemResult(result, row, idx, documents);
      idx = Object.keys(row)[0] === "delete" ? idx + 1 : idx + 2;
    }
    /* end critical code section */
    return result;
  }

  /**
   * return the last action
   */
  private prepareItem(item, actionNames, lastAction, alias, kuzzleMeta) {
    const action = Object.keys(item)[0];

    if (actionNames.indexOf(action) !== -1) {
      item[action]._index = alias;

      if (item[action]._type) {
        item[action]._type = undefined;
      }
    } else if (lastAction === "index" || lastAction === "create") {
      item._kuzzle_info = kuzzleMeta.created;
    } else if (lastAction === "update") {
      // we can only update metadata on a partial update, or on an upsert
      for (const prop of ["doc", "upsert"]) {
        if (isPlainObject(item[prop])) {
          item[prop]._kuzzle_info = kuzzleMeta.updated;
        }
      }
    }
    return action;
  }

  formatItemResult(result, row, idx, documents) {
    const action = Object.keys(row)[0];
    const item = row[action];

    if (item.status >= 400) {
      const error = {
        _id: item._id,
        _source: null,
        error: null,
        status: item.status,
      };

      // update action contain body in "doc" field
      // the delete action is not followed by an action payload
      if (action === "update") {
        error._source = documents[idx + 1].doc;
        error._source._kuzzle_info = undefined;
      } else if (action !== "delete") {
        error._source = documents[idx + 1];
        error._source._kuzzle_info = undefined;
      }

      // ES response does not systematicaly include an error object
      // (e.g. delete action with 404 status)
      if (item.error) {
        error.error = {
          reason: item.error.reason,
          type: item.error.type,
        };
      }

      result.errors.push({ [action]: error });
    } else {
      result.items.push({
        [action]: {
          _id: item._id,
          status: item.status,
        },
      });
    }
  }
  /**
   * Retrieves the complete list of existing collections in the current index
   *
   * @param {String} index - Index name
   * @param {Object.Boolean} includeHidden - Optional: include HIDDEN_COLLECTION in results
   *
   * @returns {Promise.<Array>} Collection names
   */
  async listCollections(
    index,
    { includeHidden = false } = {}
  ): Promise<string[]> {
    let body;

    try {
      ({ body } = await this.client.cat.aliases({ format: "json" }));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const aliases = body.map(({ alias }) => alias);

    const schema = this.extractSchema(aliases, { includeHidden });

    return schema[this.virtualIndex.getRealIndex(index)] || [];
  }

  /**
   * Retrieves the complete list of indexes
   *
   * @returns {Promise.<Array>} Index names
   */
  async listIndexes(includeVirtual = true): Promise<string[]> {
    let body;

    try {
      ({ body } = await this.client.cat.aliases({ format: "json" }));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const aliases = body.map(({ alias }) => alias);

    const schema = this.extractSchema(aliases, {
      includeVirtual: includeVirtual,
    });

    return Object.keys(schema);
  }

  /**
   * Returns an object containing the list of indexes and collections
   *
   * @returns {Object.<String, String[]>} Object<index, collections>
   */
  async getSchema(includeVirtual = true) {
    // This check avoids a breaking change for those who were using Kuzzle before
    // alias attribution for each indice was the standard ('auto-version')
    await this.ensureAliasConsistency();

    let body;
    try {
      ({ body } = await this.client.cat.aliases({ format: "json" }));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const aliases = body.map(({ alias }) => alias);

    const schema = this.extractSchema(aliases, {
      includeHidden: true,
      includeVirtual: includeVirtual,
    });

    for (const [index, collections] of Object.entries(schema)) {
      schema[index] = collections.filter((c) => c !== HIDDEN_COLLECTION);
    }

    return schema;
  }

  /**
   * Retrieves the complete list of aliases
   *
   * @returns {Promise.<Object[]>} [ { alias, index, collection, indice } ]
   */
  async listAliases() {
    let body;

    try {
      ({ body } = await this.client.cat.aliases({ format: "json" }));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    const aliases = [];

    for (const { alias, index: indice } of body) {
      if (alias[INDEX_PREFIX_POSITION_IN_ALIAS] === this.indexPrefix) {
        aliases.push({
          alias,
          collection: this.extractCollection(alias),
          index: this.extractIndex(alias),
          indice,
        });
      }
    }
    return aliases;
  }

  /**
   * Deletes a collection
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise}
   */
  async deleteCollection(index, collection) {
    if (this.virtualIndex.isVirtual(index)) {
      throw kerror.get("delete_virtual_collection");
    }
    const esRequest = {
      index: await this.getIndice(index, collection),
    };

    try {
      await this.client.indices.delete(esRequest);

      await this.createHiddenCollection(index);
    } catch (e) {
      throw this.esWrapper.formatESError(e);
    }

    return null;
  }

  /**
   * Deletes multiple indexes
   *
   * @param {String[]} indexes - Index names
   *
   * @returns {Promise.<String[]>}
   */
  async deleteIndexes(indexes = []): Promise<string[]> {
    if (indexes.length === 0) {
      return Bluebird.resolve([]);
    }
    const deleted = new Array<string>();
    for (const index of indexes) {
      if (this.virtualIndex.isVirtual(index)) {
        await this.removeDocumentsFromVirtualIndex(index);
        await this.virtualIndex.removeVirtualIndex(index);
        deleted.push(index);
      }
    }
    try {
      const { body } = await this.client.cat.aliases({ format: "json" });

      const esRequest = body.reduce(
        (request, { alias, index: indice }) => {
          const index = this.extractIndex(alias);

          if (
            alias[INDEX_PREFIX_POSITION_IN_ALIAS] !== this.indexPrefix ||
            !indexes.includes(index)
          ) {
            return request;
          }

          deleted.push(index);
          if (!this.virtualIndex.isVirtual(index)) {
            request.index.push(indice);
          }

          return request;
        },
        { index: [] }
      );

      debug("Delete indexes: %o", esRequest);
      if (esRequest.index.length !== 0) {
        await this.client.indices.delete(esRequest);
      }
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    return deleted;
  }

  /**
   * Deletes an index
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  async deleteIndex(index) {
    await this.deleteIndexes([index]);
    return null;
  }

  /**
   * Forces a refresh on the collection.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<Object>} { _shards }
   */
  async refreshCollection(index, collection) {
    const esRequest = {
      index: this.getAlias(index, collection),
    };

    let _shards;

    try {
      ({
        body: { _shards },
      } = await this.client.indices.refresh(esRequest));
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    return { _shards };
  }

  /**
   * Returns true if the document exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<boolean>}
   */
  async exists(index, collection, id) {
    const esRequest = {
      id: this.virtualIndex.getId(index, id),
      index: this.getAlias(index, collection),
    };

    try {
      const { body: exists } = await this.client.exists(esRequest);

      return exists;
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Returns the list of documents existing with the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single
   * index/collection, using the body { ids: [.. } syntax.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Document IDs
   *
   * @returns {Promise.<{ items: Array<{ _id, _source, _version }>, errors }>}
   */
  async mExists(index, collection, ids) {
    if (ids.length === 0) {
      return { errors: [], item: [] };
    }

    const esRequest = {
      _source: false,
      body: {
        docs: ids.map((_id) => ({ _id: this.virtualIndex.getId(index, _id) })),
      },
      index: this.getAlias(index, collection),
    };

    debug("mExists: %o", esRequest);

    let body;

    try {
      // @ts-ignore
      ({ body } = await this.client.mget(esRequest));
    } catch (e) {
      throw this.esWrapper.formatESError(e);
    }

    const errors = [];
    const items = [];

    for (let i = 0; i < body.docs.length; i++) {
      const doc = body.docs[i];

      if (doc.found) {
        items.push(doc._id);
      } else {
        errors.push(doc._id);
      }
    }

    return { errors, items };
  }

  /**
   * Returns true if the index exists
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<boolean>}
   */
  async hasIndex(index, virtual: true) {
    if (virtual && this.virtualIndex.isVirtual(index)) {
      return true;
    }

    const indexes = await this.listIndexes();

    return indexes.some((idx) => idx === index);
  }

  /**
   * Returns true if the collection exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<boolean>}
   */
  async hasCollection(index, collection) {
    const collections = await this.listCollections(index);

    return collections.some((col) => col === collection);
  }

  /**
   * Returns true if the index has the hidden collection
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<boolean>}
   */
  private async hasHiddenCollection(index) {
    const collections = await this.listCollections(index, {
      includeHidden: true,
    });

    return collections.some((col) => col === HIDDEN_COLLECTION);
  }

  /**
   * Creates multiple documents at once.
   * If a content has no id, one is automatically generated and assigned to it.
   * If a content has a specified identifier, it is rejected if it already exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  async mCreate(
    index,
    collection,
    documents,
    { refresh = undefined, timeout = undefined, userId = null } = {}
  ) {
    const alias = this.getAlias(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getKuid(userId),
          createdAt: Date.now(),
          index,
          updatedAt: null,
          updater: null,
        },
      },
      { rejected, extractedDocuments, documentsToGet } = this.extractMDocuments(
        index,
        documents,
        kuzzleMeta,
        { prepareMGet: true }
      );

    // prepare the mget request, but only for document having a specified id
    const { body } =
      documentsToGet.length > 0
        ? await this.client.mget({
            body: { docs: documentsToGet },
            index: alias,
          })
        : { body: { docs: [] } };

    const existingDocuments = body.docs;
    const esRequest = {
      body: [],
      index: alias,
      refresh,
      timeout,
    };
    const toImport = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0, idx = 0; i < extractedDocuments.length; i++) {
      const document = extractedDocuments[i];

      // Documents are retrieved in the same order than we got them from user
      if (typeof document._id === "string" && existingDocuments[idx]) {
        if (existingDocuments[idx].found) {
          document._source._kuzzle_info = undefined;

          rejected.push({
            document: {
              _id: document._id,
              body: document._source,
            },
            reason: "document already exists",
            status: 400,
          });

          idx++;
        } else {
          esRequest.body.push({
            index: {
              _id: document._id,
              _index: alias,
            },
          });
          esRequest.body.push(document._source);

          toImport.push(document);
        }
      } else {
        esRequest.body.push({ index: { _index: alias } });
        esRequest.body.push(document._source);

        toImport.push(document);
      }
    }
    /* end critical code section */

    return this._mExecute(esRequest, toImport, rejected);
  }

  /**
   * Creates or replaces multiple documents at once.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null), injectKuzzleMeta (false), limits (true)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async mCreateOrReplace(
    index,
    collection,
    documents,
    {
      refresh = undefined,
      timeout = undefined,
      userId = undefined,
      injectKuzzleMeta = true,
      limits = true,
      source = true,
    } = {}
  ) {
    let kuzzleMeta = {};

    if (injectKuzzleMeta) {
      kuzzleMeta = {
        _kuzzle_info: {
          author: getKuid(userId),
          createdAt: Date.now(),
          index,
          updatedAt: null,
          updater: null,
        },
      };
    }

    const alias = this.getAlias(index, collection);
    const esRequest = {
      body: [],
      index: alias,
      refresh,
      timeout,
    };
    const { rejected, extractedDocuments } = this.extractMDocuments(
      index,
      documents,
      kuzzleMeta
    );

    esRequest.body = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < extractedDocuments.length; i++) {
      esRequest.body.push({
        index: {
          _id: extractedDocuments[i]._id,
          _index: alias,
        },
      });
      esRequest.body.push(extractedDocuments[i]._source);
    }
    /* end critical code section */

    return this._mExecute(esRequest, extractedDocuments, rejected, {
      limits,
      source,
    });
  }

  /**
   * Updates multiple documents with one request
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "update" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), retryOnConflict (0), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  async mUpdate(
    index,
    collection,
    documents,
    // @ts-ignore
    { refresh, retryOnConflict = 0, timeout, userId = null } = {}
  ) {
    const alias = this.getAlias(index, collection),
      toImport = [],
      esRequest = {
        body: [],
        index: alias,
        refresh,
        timeout,
      },
      kuzzleMeta = {
        _kuzzle_info: {
          index,
          updatedAt: Date.now(),
          updater: getKuid(userId),
        },
      },
      { rejected, extractedDocuments } = this.extractMDocuments(
        index,
        documents,
        kuzzleMeta
      );

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < extractedDocuments.length; i++) {
      const extractedDocument = extractedDocuments[i];

      if (typeof extractedDocument._id === "string") {
        esRequest.body.push({
          update: {
            _id: extractedDocument._id,
            _index: alias,
            retry_on_conflict:
              retryOnConflict || this._config.defaults.onUpdateConflictRetries,
          },
        });

        // _source: true => makes ES return the updated document source in the
        // response. Required by the real-time notifier component
        esRequest.body.push({
          _source: true,
          doc: extractedDocument._source,
        });
        toImport.push(extractedDocument);
      } else {
        extractedDocument._source._kuzzle_info = undefined;

        rejected.push({
          document: {
            _id: extractedDocument._id,
            body: extractedDocument._source,
          },
          reason: "document _id must be a string",
          status: 400,
        });
      }
    }
    /* end critical code section */

    const response = await this._mExecute(esRequest, toImport, rejected);

    // with _source: true, ES returns the updated document in
    // response.result.get._source
    // => we replace response.result._source with it so that the notifier
    // module can seamlessly process all kind of m* response*
    response.items = response.items.map((item) => ({
      _id: item._id,
      _source: item.get._source,
      _version: item._version,
      status: item.status,
    }));

    return response;
  }

  /**
   * Creates or replaces multiple documents at once.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - refresh (undefined), retryOnConflict (0), timeout (undefined), userId (null)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async mUpsert(
    index,
    collection,
    documents,
    {
      refresh = undefined,
      retryOnConflict = 0,
      timeout = undefined,
      userId = null,
    } = {}
  ) {
    const alias = this.getAlias(index, collection);
    const esRequest = {
      body: [],
      refresh,
      timeout,
    };

    const user = getKuid(userId);
    const now = Date.now();
    const kuzzleMeta = {
      doc: {
        _kuzzle_info: {
          updatedAt: now,
          updater: user,
        },
      },
      upsert: {
        _kuzzle_info: {
          author: user,
          createdAt: now,
        },
      },
    };

    const { rejected, extractedDocuments } = this.extractMDocuments(
      index,
      documents,
      kuzzleMeta,
      {
        prepareMUpsert: true,
        requireId: true,
      }
    );

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < extractedDocuments.length; i++) {
      esRequest.body.push(
        {
          update: {
            _id: extractedDocuments[i]._id,
            _index: alias,
            _source: true,
            retry_on_conflict:
              retryOnConflict || this._config.defaults.onUpdateConflictRetries,
          },
        },
        {
          doc: extractedDocuments[i]._source.changes,
          upsert: extractedDocuments[i]._source.default,
        }
      );
      // _source: true
      // Makes ES return the updated document source in the response.
      // Required by the real-time notifier component
    }
    /* end critical code section */

    const response = await this._mExecute(
      esRequest,
      extractedDocuments,
      rejected
    );

    // with _source: true, ES returns the updated document in
    // response.result.get._source
    // => we replace response.result._source with it so that the notifier
    // module can seamlessly process all kind of m* response*
    response.items = response.items.map((item) => ({
      _id: item._id,
      _source: item.get._source,
      _version: item._version,
      created: item.result === "created", // Needed by the notifier
      status: item.status,
    }));

    return response;
  }

  /**
   * Replaces multiple documents at once.
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "replace" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  async mReplace(
    index,
    collection,
    documents,
    { refresh = undefined, timeout = undefined, userId = null } = {}
  ) {
    const alias = this.getAlias(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getKuid(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null,
        },
      },
      { rejected, extractedDocuments, documentsToGet } = this.extractMDocuments(
        index,
        documents,
        kuzzleMeta,
        {
          prepareMGet: true,
          requireId: true,
        }
      );

    if (documentsToGet.length < 1) {
      return { errors: rejected, items: [] };
    }

    const { body } = await this.client.mget({
      body: { docs: documentsToGet },
      index: alias,
    });

    const existingDocuments = body.docs;
    const esRequest = {
      body: [],
      refresh,
      timeout,
    };
    const toImport = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < extractedDocuments.length; i++) {
      const document = extractedDocuments[i];

      // Documents are retrieved in the same order than we got them from user
      if (existingDocuments[i] && existingDocuments[i].found) {
        esRequest.body.push({
          index: {
            _id: document._id,
            _index: alias,
          },
        });
        esRequest.body.push(document._source);

        toImport.push(document);
      } else {
        document._source._kuzzle_info = undefined;

        rejected.push({
          document: {
            _id: document._id,
            body: document._source,
          },
          reason: "document not found",
          status: 404,
        });
      }
    }
    /* end critical code section */

    return this._mExecute(esRequest, toImport, rejected);
  }

  /**
   * Deletes multiple documents with one request
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Documents IDs
   * @param {Object} options - timeout (undefined), refresh (undefined)
   *
   * @returns {Promise.<{ documents, errors }>
   */
  async mDelete(
    index: string,
    collection: string,
    ids: string[],
    { refresh = undefined } = {}
  ) {
    const query = { ids: { values: [] } },
      validIds = [],
      partialErrors = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < ids.length; i++) {
      const _id = ids[i];

      if (typeof _id === "string") {
        validIds.push(_id);
      } else {
        partialErrors.push({
          _id,
          reason: "document _id must be a string",
          status: 400,
        });
      }
    }
    /* end critical code section */
    await this.refreshCollection(index, collection);

    const { items } = await this.mGet(index, collection, validIds);

    let idx = 0;

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < validIds.length; i++) {
      const validId = validIds[i];
      const item = items[idx];

      if (item && item._id === validId) {
        query.ids.values.push(validId);
        idx++;
      } else {
        partialErrors.push({
          _id: validId,
          reason: "document not found",
          status: 404,
        });
      }
    }
    /* end critical code section */

    // @todo duplicated query to get documents body, mGet here and search in
    // deleteByQuery
    const { documents } = await this.deleteByQuery(index, collection, query, {
      refresh,
    });

    return { documents, errors: partialErrors };
  }

  /**
   * Executes an ES request prepared by mcreate, mupdate, mreplace, mdelete or mwriteDocuments
   * Returns a standardized ES response object, containing the list of
   * successfully performed operations, and the rejected ones
   *
   * @param  {Object} esRequest - Elasticsearch request
   * @param  {Object[]} documents - Document sources (format: {_id, _source})
   * @param  {Object[]} partialErrors - pre-rejected documents
   * @param  {Object} options - limits (true)
   *
   * @returns {Promise.<Object[]>} results
   */
  private async _mExecute(
    esRequest,
    documents,
    partialErrors,
    { limits = true, source = true } = {}
  ) {
    assertWellFormedRefresh(esRequest);

    if (
      limits &&
      documents.length > global.kuzzle.config.limits.documentsWriteCount
    ) {
      return kerror.reject("write_limit_exceeded");
    }

    let response = { body: { items: [] } };

    if (documents.length > 0) {
      try {
        response = await this.client.bulk(esRequest);
      } catch (error) {
        throw this.esWrapper.formatESError(error);
      }
    }

    const body = response.body;
    const successes = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      this.processExecutedItem(
        item,
        partialErrors,
        successes,
        documents[i],
        source
      );
    }
    /* end critical code section */

    return {
      errors: partialErrors, // @todo rename items to documents
      items: successes,
    };
  }

  private processExecutedItem(
    item,
    partialErrors,
    successes,
    document,
    source
  ) {
    const result = item[Object.keys(item)[0]];

    if (result.status >= 400) {
      if (result.status === 404) {
        partialErrors.push({
          document: {
            _id: document._id,
            body: document._source,
          },
          reason: "document not found",
          status: result.status,
        });
      } else {
        partialErrors.push({
          document: document,
          reason: result.error.reason,
          status: result.status,
        });
      }
    } else {
      successes.push({
        _id: result._id,
        _source: source ? document._source : undefined,
        _version: result._version,
        created: result.result === "created",
        get: result.get,
        result: result.result,
        status: result.status, // used by mUpdate to get the full document body
      });
    }
  }

  /**
   * Extracts, injects metadata and validates documents contained
   * in a Request
   *
   * Used by mCreate, mUpdate, mUpsert, mReplace and mCreateOrReplace
   *
   * @param  {Object[]} documents - Documents
   * @param  {Object} metadata - Kuzzle metadata
   * @param  {Object} options - prepareMGet (false), requireId (false)
   *
   * @returns {Object} { rejected, extractedDocuments, documentsToGet }
   */
  private extractMDocuments(
    index,
    documents,
    metadata,
    { prepareMGet = false, requireId = false, prepareMUpsert = false } = {}
  ) {
    const rejected = [];
    const extractedDocuments = [];
    const documentsToGet = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      if (
        !this.isRejectedDocument(document, rejected, prepareMUpsert, requireId)
      ) {
        let extractedDocument;
        if (prepareMUpsert) {
          extractedDocument = {
            _source: {
              // Do not use destructuring, it's 10x slower
              changes: Object.assign({}, metadata.doc, document.changes),
              default: Object.assign(
                {},
                metadata.upsert,
                document.changes,
                document.default
              ),
            },
          };
        } else {
          extractedDocument = {
            // Do not use destructuring, it's 10x slower
            _source: Object.assign({}, metadata, document.body),
          };
        }

        if (document._id) {
          //TODO : generate id
          extractedDocument._id = this.virtualIndex.getId(index, document._id);
        } else if (this.virtualIndex.isVirtual(index)) {
          extractedDocument._id = this.virtualIndex.getId(
            index,
            this.virtualIndex.randomString(20)
          );
        }
        document._id = extractedDocument._id;

        extractedDocuments.push(extractedDocument);

        if (prepareMGet && typeof document._id === "string") {
          documentsToGet.push({
            _id: document._id,
            _source: false,
          });
        }
      }
    }
    /* end critical code section */
    return { documentsToGet, extractedDocuments, rejected };
  }

  /**
   * Return true if the document is rejected, and add reject reason in rejected array
   * else, return false
   * @param document
   * @param rejected
   * @param prepareMUpsert
   * @param requireId
   */
  private isRejectedDocument(
    document,
    rejected,
    prepareMUpsert,
    requireId
  ): boolean {
    if (!isPlainObject(document.body) && !prepareMUpsert) {
      rejected.push({
        document,
        reason: "document body must be an object",
        status: 400,
      });
      return true;
    }
    if (!isPlainObject(document.changes) && prepareMUpsert) {
      rejected.push({
        document,
        reason: "document changes must be an object",
        status: 400,
      });
      return true;
    }
    if (
      prepareMUpsert &&
      document.default &&
      !isPlainObject(document.default)
    ) {
      rejected.push({
        document,
        reason: "document default must be an object",
        status: 400,
      });
      return true;
    }
    if (requireId && typeof document._id !== "string") {
      rejected.push({
        document,
        reason: "document _id must be a string",
        status: 400,
      });
      return true;
    }
    return false;
  }

  /**
   * Throws an error if the provided mapping is invalid
   *
   * @param {Object} mapping
   * @throws
   */
  private checkMappings(mapping, path = [], check = true) {
    const properties = Object.keys(mapping);
    const mappingProperties =
      path.length === 0
        ? ROOT_MAPPING_PROPERTIES
        : [...ROOT_MAPPING_PROPERTIES, ...CHILD_MAPPING_PROPERTIES];

    for (const property of properties) {
      if (mapping[property]) {
        if (check && !mappingProperties.includes(property)) {
          const currentPath = [...path, property].join(".");

          throw kerror.get(
            "invalid_mapping",
            currentPath,
            didYouMean(property, mappingProperties)
          );
        }

        if (property === "properties") {
          // type definition level, we don't check
          this.checkMappings(mapping[property], [...path, "properties"], false);
        } else if (mapping[property] && mapping[property].properties) {
          // root properties level, check for "properties", "dynamic" and "_meta"
          this.checkMappings(mapping[property], [...path, property], true);
        }
      }
    }
  }

  /**
   * Given index + collection, returns the associated alias name.
   * Prefer this function to `getIndice` and `getAvailableIndice` whenever it is possible.
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} Alias name (eg: '@&nepali.liia')
   */
  private getAlias(index, collection) {
    const realIndex = this.virtualIndex.getRealIndex(index);
    return `${ALIAS_PREFIX}${this.indexPrefix}${realIndex}${NAME_SEPARATOR}${collection}`;
  }

  /**
   * Given index + collection, returns the associated indice name.
   * Use this function if ES does not accept aliases in the request. Otherwise use `getAlias`.
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} Indice name (eg: '&nepali.liia')
   * @throws If there is not exactly one indice associated
   */
  private async getIndice(index, collection) {
    const physicalIndex = this.virtualIndex.getRealIndex(index);
    const alias = `${ALIAS_PREFIX}${this.indexPrefix}${physicalIndex}${NAME_SEPARATOR}${collection}`;
    const { body } = await this.client.cat.aliases({
      format: "json",
      name: alias,
    });

    if (body.length < 1) {
      throw kerror.get("unknown_index_collection");
    } else if (body.length > 1) {
      throw kerror.get(
        "multiple_indice_alias",
        `"alias" starting with "${ALIAS_PREFIX}"`,
        '"indices"'
      );
    }

    return body[0].index;
  }

  /**
   * Given an ES Request returns the settings of the corresponding indice.
   *
   * @param esRequest the ES Request with wanted settings.
   * @return {Promise<*>} the settings of the indice.
   * @private
   */
  private async _getSettings(esRequest) {
    const response = await this.client.indices.getSettings(esRequest);
    return response.body[esRequest.index].settings;
  }

  /**
   * Given index + collection, returns an available indice name.
   * Use this function when creating the associated indice. Otherwise use `getAlias`.
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} Available indice name (eg: '&nepali.liia2')
   */
  private async getAvailableIndice(index, collection) {
    let indice = this.getAlias(index, collection).substring(
      INDEX_PREFIX_POSITION_IN_ALIAS
    );

    if (!(await this.client.indices.exists({ index: indice })).body) {
      return indice;
    }

    let notAvailable;
    let suffix;
    do {
      suffix = `.${Elasticsearch.getRandomNumber(100000)}`;

      const overflow = Buffer.from(indice + suffix).length - 255;
      if (overflow > 0) {
        const indiceBuffer = Buffer.from(indice);
        indice = indiceBuffer
          .slice(0, indiceBuffer.length - overflow)
          .toString();
      }

      notAvailable = (
        await this.client.indices.exists({
          index: indice + suffix,
        })
      ).body;
    } while (notAvailable);

    return indice + suffix;
  }

  /**
   * Given an indice, returns the associated alias name.
   *
   * @param {String} indice
   *
   * @returns {String} Alias name (eg: '@&nepali.liia')
   * @throws If there is not exactly one alias associated that is prefixed with @
   */
  private async getAliasFromIndice(indice) {
    const { body } = await this.client.indices.getAlias({ index: indice });
    const aliases = Object.keys(body[indice].aliases).filter((alias) =>
      alias.startsWith(ALIAS_PREFIX)
    );

    if (aliases.length < 1) {
      throw kerror.get("unknown_index_collection");
    }

    return aliases;
  }

  /**
   * Check for each indice whether it has an alias or not.
   * When the latter is missing, create one based on the indice name.
   *
   * This check avoids a breaking change for those who were using Kuzzle before
   * alias attribution for each indice turned into a standard ('auto-version').
   */
  private async ensureAliasConsistency() {
    try {
      const { body } = await this.client.cat.indices({ format: "json" });
      const indices = body.map(({ index: indice }) => indice);
      const aliases = await this.listAliases();

      const indicesWithoutAlias = indices.filter(
        (indice) =>
          indice[INDEX_PREFIX_POSITION_IN_INDICE] === this.indexPrefix &&
          !aliases.some((alias) => alias.indice === indice)
      );

      const esRequest = { body: { actions: [] } };
      for (const indice of indicesWithoutAlias) {
        esRequest.body.actions.push({
          add: { alias: `${ALIAS_PREFIX}${indice}`, index: indice },
        });
      }

      if (esRequest.body.actions.length > 0) {
        await this.client.indices.updateAliases(esRequest);
      }
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Throws if index or collection includes forbidden characters
   *
   * @param {String} index
   * @param {String} collection
   */
  public assertValidIndexAndCollection(index, collection = null) {
    if (!this.isIndexNameValid(index)) {
      throw kerror.get("invalid_index_name", index);
    }

    if (collection !== null && !this.isCollectionNameValid(collection)) {
      throw kerror.get("invalid_collection_name", collection);
    }
  }

  /**
   * Given an alias, extract the associated index.
   *
   * @param {String} alias
   *
   * @returns {String} Index name
   */
  private extractIndex(alias) {
    return alias.substring(
      INDEX_PREFIX_POSITION_IN_ALIAS + 1,
      alias.indexOf(NAME_SEPARATOR) - INDEX_PREFIX_POSITION_IN_ALIAS + 1
    );
  }

  /**
   * Given an alias, extract the associated collection.
   *
   * @param {String} alias
   *
   * @returns {String} Collection name
   */
  private extractCollection(alias) {
    const separatorPos = alias.indexOf(NAME_SEPARATOR);

    return alias.substring(separatorPos + 1, alias.length + 1);
  }

  /**
   * Given aliases, extract indexes and collections.
   *
   * @param {Array.<String>} aliases
   * @param {Object.Boolean} includeHidden Only refers to `HIDDEN_COLLECTION` occurences. An empty index will still be listed. Default to `false`.
   *
   * @returns {Object.<String, String[]>} Indexes as key and an array of their collections as value
   */
  private extractSchema(
    aliases,
    { includeHidden = false, includeVirtual = true } = {}
  ): { [key: string]: string[] } {
    const schema = {};

    for (const alias of aliases) {
      this.extractAliasSchema(alias, includeHidden, schema);
    }

    if (includeVirtual) {
      for (const [key, value] of this.virtualIndex.virtualIndexMap) {
        if (schema[value]) {
          schema[key] = schema[value];
        }
      }
    }

    return schema;
  }

  private extractAliasSchema(alias, includeHidden, schema) {
    const [indexName, collectionName] = alias
      .substring(INDEX_PREFIX_POSITION_IN_ALIAS + 1, alias.length + 1)
      .split(NAME_SEPARATOR);

    if (
      alias[INDEX_PREFIX_POSITION_IN_ALIAS] === this.indexPrefix &&
      (collectionName !== HIDDEN_COLLECTION || includeHidden)
    ) {
      if (!schema[indexName]) {
        schema[indexName] = [];
      }

      if (!schema[indexName].includes(collectionName)) {
        schema[indexName].push(collectionName);
      }
    }
  }

  /**
   * Creates the hidden collection on the provided index if it does not already
   * exists
   *
   * @param {String} index Index name
   */
  private async createHiddenCollection(index) {
    const mutex = new Mutex(`hiddenCollection/${index}`);

    try {
      await mutex.lock();

      if (await this.hasHiddenCollection(index)) {
        return;
      }

      await this.client.indices.create({
        body: {
          aliases: {
            [this.getAlias(index, HIDDEN_COLLECTION)]: {},
          },
          settings: {
            number_of_replicas: 1,
            number_of_shards: 1,
          },
        },
        index: await this.getAvailableIndice(index, HIDDEN_COLLECTION),
      });
    } catch (e) {
      throw this.esWrapper.formatESError(e);
    } finally {
      await mutex.unlock();
    }
  }

  /**
   * Scroll indice in elasticsearch and return all document that match the filter
   * /!\ throws a write_limit_exceed error: this method is intended to be used
   * by deleteByQuery and updateByQuery
   *
   * @param {Object} esRequest - Search request body
   *
   * @returns {Promise.<Array>} resolve to an array of documents
   */
  private async getAllDocumentsFromQuery(esRequest) {
    let {
      body: { hits, _scroll_id },
    } = await this.client.search(esRequest);

    if (hits.total.value > global.kuzzle.config.limits.documentsWriteCount) {
      throw kerror.get("write_limit_exceeded");
    }

    let documents = hits.hits.map((h) => ({ _id: h._id, _source: h._source }));

    while (hits.total.value !== documents.length) {
      ({
        body: { hits, _scroll_id },
      } = await this.client.scroll({
        scroll: esRequest.scroll,
        scrollId: _scroll_id,
      } as any));

      documents = documents.concat(
        hits.hits.map((h) => ({
          _id: h._id,
          _source: h._source,
        }))
      );
    }

    await this.clearScroll(_scroll_id);

    return documents;
  }

  /**
   * Clean and normalize the searchBody
   * Ensure only allowed parameters are passed to ES
   *
   * @param {Object} searchBody - ES search body (with query, aggregations, sort, etc)
   */
  private sanitizeSearchBody(searchBody, index: string = null) {
    // Only allow a whitelist of top level properties
    for (const key of Object.keys(searchBody)) {
      if (searchBody[key] !== undefined && !this.searchBodyKeys.includes(key)) {
        throw kerror.get("invalid_search_query", key);
      }
    }

    // Ensure that the body does not include a script
    this.scriptCheck(searchBody);

    // Avoid empty queries that causes ES to respond with an error.
    // Empty queries are turned into match_all queries
    if (_.isEmpty(searchBody.query)) {
      searchBody.query = { match_all: {} };
    }

    if (index && this.virtualIndex.isVirtual(index)) {
      return this.virtualIndex.sanitizeSearchBodyForVirtualIndex(
        searchBody,
        index
      );
    }

    return searchBody;
  }

  /**
   * Throw if a script is used in the query.
   *
   * Only Stored Scripts are accepted
   *
   * @param {Object} object
   */
  private scriptCheck(object) {
    for (const [key, value] of Object.entries(object)) {
      if (this.scriptKeys.includes(key)) {
        for (const scriptArg of Object.keys(value)) {
          if (!this.scriptAllowedArgs.includes(scriptArg)) {
            throw kerror.get("invalid_query_keyword", `${key}.${scriptArg}`);
          }
        }
      }
      // Every object must be checked here, even the ones nested into an array
      else if (typeof value === "object" && value !== null) {
        this.scriptCheck(value);
      }
    }
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @returns {Boolean}
   */
  isCollectionNameValid(name) {
    return isObjectNameValid(name);
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @returns {Boolean}
   */
  isIndexNameValid(name) {
    return isObjectNameValid(name);
  }

  /**
   * Clears an allocated scroll
   * @param  {[type]} id [description]
   * @returns {[type]}    [description]
   */
  async clearScroll(id) {
    if (id) {
      debug("clearing scroll: %s", id);
      // @ts-ignore

      await this.client.clearScroll({ scrollId: id });
    }
  }

  /**
   * Loads a configuration value from services.storageEngine and assert a valid
   * ms format.
   *
   * @param {String} key - relative path to the key in configuration
   *
   * @returns {Number} milliseconds
   */
  private loadMsConfig(key) {
    const configValue = _.get(this._config, key);

    assert(
      typeof configValue === "string",
      `services.storageEngine.${key} must be a string.`
    );

    const parsedValue = ms(configValue);

    assert(
      typeof parsedValue === "number",
      `Invalid parsed value from ms() for services.storageEngine.${key} ("${typeof parsedValue}").`
    );

    return parsedValue;
  }

  /**
   * Returns true if one of the mappings dynamic property changes value from
   * false to true
   */
  private dynamicChanges(previousMappings, newMappings) {
    const previousValues = findDynamic(previousMappings);

    for (const [path, previousValue] of Object.entries(previousValues)) {
      if (previousValue.toString() !== "false") {
        continue;
      }

      const newValue = _.get(newMappings, path);

      if (newValue && newValue.toString() !== "false") {
        return true;
      }
    }

    return false;
  }

  async waitForElasticsearch() {
    if (esState !== esStateEnum.NONE) {
      while (esState !== esStateEnum.OK) {
        await Bluebird.delay(1000);
      }

      return;
    }

    esState = esStateEnum.AWAITING;

    global.kuzzle.log.info("[ℹ] Trying to connect to Elasticsearch...");

    while (esState !== esStateEnum.OK) {
      try {
        // Wait for at least 1 shard to be initialized
        const health = await this.client.cluster.health({
          // @ts-ignore
          waitForNoInitializingShards: true,
        });

        if (health.body.number_of_pending_tasks === 0) {
          global.kuzzle.log.info("[✔] Elasticsearch is ready");
          esState = esStateEnum.OK;
        } else {
          global.kuzzle.log.info(
            `[ℹ] Still waiting for Elasticsearch: ${health.body.number_of_pending_tasks} cluster tasks remaining`
          );
          await Bluebird.delay(1000);
        }
      } catch (e) {
        await Bluebird.delay(1000);
      }
    }
  }

  /**
   * Checks if the dynamic properties are correct
   */
  private checkDynamicProperty(mappings) {
    const dynamicProperties = findDynamic(mappings);
    for (const [path, value] of Object.entries(dynamicProperties)) {
      // Prevent common mistake
      if (typeof value === "boolean") {
        _.set(mappings, path, value.toString());
      } else if (typeof value !== "string") {
        throw kerror.get(
          "invalid_mapping",
          path,
          "Dynamic property value should be a string."
        );
      }

      if (!DYNAMIC_PROPERTY_VALUES.includes(value.toString())) {
        throw kerror.get(
          "invalid_mapping",
          path,
          `Incorrect dynamic property value (${value}). Should be one of "${DYNAMIC_PROPERTY_VALUES.join(
            '", "'
          )}"`
        );
      }
    }
  }

  public async createVirtualIndex(virtualIndex: string, index: string) {
    return this.virtualIndex.createVirtualIndex(virtualIndex, index);
  }

  private async removeDocumentsFromVirtualIndex(index: string) {
    const collections = await this.listCollections(index);
    return Promise.all(
      collections.map(async (collection) => {
        await this.refreshCollection(index, collection);
        this.deleteByQuery(index, collection, {});
      })
    );
  }
}

/**
 * Finds paths and values of mappings dynamic properties
 *
 * @example
 *
 * findDynamic(mappings);
 * {
 *   "properties.metadata.dynamic": "true",
 *   "properties.user.properties.address.dynamic": "strict"
 * }
 */
function findDynamic(mappings, path = [], results = {}) {
  if (mappings.dynamic !== undefined) {
    results[path.concat("dynamic").join(".")] = mappings.dynamic;
  }

  for (const [key, value] of Object.entries(mappings)) {
    if (isPlainObject(value)) {
      findDynamic(value, path.concat(key), results);
    }
  }

  return results;
}

/**
 * Forbids the use of the _routing ES option
 *
 * @param {Object} esRequest
 * @throws
 */
function assertNoRouting(esRequest) {
  if (esRequest.body._routing) {
    throw kerror.get("no_routing");
  }
}

/**
 * Checks if the optional "refresh" argument is well-formed
 *
 * @param {Object} esRequest
 * @throws
 */
function assertWellFormedRefresh(esRequest) {
  if (!["wait_for", "false", false, undefined].includes(esRequest.refresh)) {
    throw kerror.get("invalid_argument", "refresh", '"wait_for", false');
  }
}

function getKuid(userId) {
  if (!userId) {
    return null;
  }
  return String(userId);
}

/**
 * Checks if an index or collection name is valid
 *
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/7.4/indices-create-index.html
 *
 * Beware of the length check: ES allows indice names up to 255 bytes, but since
 * in Kuzzle we emulate collections as indices, we have to make sure
 * that the privacy prefix, the index name, the separator and the collection
 * name ALL fit within the 255-bytes limit of Elasticsearch. The simplest way
 * is to limit index and collection names to 126 bytes and document that
 * limitation (prefix(1) + index(1..126) + sep(1) + collection(1..126) = 4..254)
 *
 * @param  {string}  name
 * @returns {Boolean}
 */
function isObjectNameValid(name) {
  if (typeof name !== "string" || name.length === 0) {
    return false;
  }

  if (name.toLowerCase() !== name) {
    return false;
  }

  if (Buffer.from(name).length > 126) {
    return false;
  }

  if (name === "_all") {
    return false;
  }

  let valid = true;

  for (let i = 0; valid && i < FORBIDDEN_CHARS.length; i++) {
    valid = !name.includes(FORBIDDEN_CHARS[i]);
  }

  return valid;
}
