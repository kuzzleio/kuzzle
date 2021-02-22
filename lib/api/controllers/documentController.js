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

const kerror = require('../../kerror');
const { NativeController, ifMissingEnum } = require('./baseController');
const actionEnum = require('../../core/realtime/actionEnum');
const {
  assertHasBody,
  assertHasIndexAndCollection
} = require('../../util/requestAssertions');

/**
 * @class DocumentController
 */
class DocumentController extends NativeController {
  constructor() {
    super([
      'count',
      'create',
      'createOrReplace',
      'delete',
      'deleteByQuery',
      'deleteFields',
      'exists',
      'get',
      'mCreate',
      'mCreateOrReplace',
      'mDelete',
      'mGet',
      'mReplace',
      'mUpdate',
      'replace',
      'scroll',
      'search',
      'update',
      'upsert',
      'updateByQuery',
      'validate'
    ]);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async search (request) {
    const { from, size, scrollTTL, searchBody } = this.getSearchParams(request);
    const { index, collection } = this.getIndexAndCollection(request);
    const lang = this.getLangParam(request);

    if (hasMultiTargets(index)) {
      throw kerror.get('services', 'storage', 'no_multi_indexes');
    }

    if (hasMultiTargets(collection)) {
      throw kerror.get('services', 'storage', 'no_multi_collections');
    }

    this.assertNotExceedMaxFetch(size - from);

    if (lang === 'koncorde') {
      searchBody.query = await this.translateKoncorde(searchBody.query);
    }

    const result = await this.ask(
      'core:storage:public:document:search',
      index,
      collection,
      searchBody,
      { from, scroll: scrollTTL, size });

    return {
      aggregations: result.aggregations,
      hits: result.hits,
      remaining: result.remaining,
      scrollId: result.scrollId,
      total: result.total,
    };
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scroll (request) {
    const scrollTTL = this.getScrollTTLParam(request);
    const _scrollId = this.getString(request, 'scrollId');

    const result = await this.ask(
      'core:storage:public:document:scroll',
      _scrollId,
      { scrollTTL });

    return {
      hits: result.hits,
      remaining: result.remaining,
      scrollId: result.scrollId,
      total: result.total,
    };
  }

  /**
   * @param {Request} request
   * @returns {Promise<Boolean>}
   */
  exists (request) {
    const id = this.getId(request);
    const { index, collection } = this.getIndexAndCollection(request);

    return this.ask('core:storage:public:document:exist', index, collection, id);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async get (request) {
    const id = this.getId(request);
    const { index, collection } = this.getIndexAndCollection(request);

    const result = await this.ask(
      'core:storage:public:document:get',
      index,
      collection,
      id);

    return {
      _id: result._id,
      _source: result._source,
      _version: result._version,
    };
  }

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGet (request) {
    let ids;
    if ( request.input.body
      && request.input.body.ids
      && Object.keys(request.input.body.ids).length
    ) {
      ids = this.getBodyArray(request, 'ids');
    }
    else {
      ids = this.getArray(request, 'ids');
    }
    const { index, collection } = this.getIndexAndCollection(request);

    this.assertNotExceedMaxFetch(ids.length);

    return this.ask('core:storage:public:document:mGet', index, collection, ids)
      .then(({ items, errors }) => {
        return {
          errors,
          successes: items
        };
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async count (request) {
    const { searchBody } = this.getSearchParams(request);
    const { index, collection } = this.getIndexAndCollection(request);

    const count = await this.ask(
      'core:storage:public:document:count',
      index,
      collection,
      searchBody);

    return { count };
  }

  /**
   * Create a new document
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async create (request) {
    const id = this.getId(request, ifMissingEnum.IGNORE);
    const userId = this.getUserId(request);
    const refresh = this.getRefresh(request);
    const silent = this.getBoolean(request, 'silent');
    const { index, collection } = this.getIndexAndCollection(request);

    const validated = await global.kuzzle.validation.validate(request, false);

    const created = await this.ask(
      'core:storage:public:document:create',
      index,
      collection,
      this.getBody(validated),
      { id, refresh, userId });

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        validated,
        actionEnum.CREATE,
        created);
    }

    return created;
  }

  /**
   * Create the documents provided in the body
   * Delegates the notification to create action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreate (request) {
    return this._mChanges(request, 'mCreate', actionEnum.CREATE);
  }

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createOrReplace (request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    const modifiedRequest = await global.kuzzle.validation.validate(
      request,
      false);

    const response = await this.ask(
      'core:storage:public:document:createOrReplace',
      index,
      collection,
      id,
      content,
      { refresh, userId });

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        modifiedRequest,
        actionEnum.WRITE,
        response);
    }

    return response;
  }

  /**
   * Create or replace the documents provided in the body
   * Delegates the notification to createOrReplace action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreateOrReplace (request) {
    return this._mChanges(request, 'mCreateOrReplace', actionEnum.WRITE);
  }

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async update (request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const retryOnConflict = request.input.args.retryOnConflict;
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const modifiedRequest = await global.kuzzle.validation.validate(
      request,
      false);

    const updatedDocument = await this.ask(
      'core:storage:public:document:update',
      index,
      collection,
      id,
      content,
      { refresh, retryOnConflict, userId });

    const _updatedFields = Object
      .keys(content)
      .filter(k => k !== '_kuzzle_info');

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        modifiedRequest,
        actionEnum.UPDATE,
        {
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          _updatedFields,
        });
    }

    if (source) {
      return updatedDocument;
    }

    return {
      _id: updatedDocument._id,
      _source: content,
      _version: updatedDocument._version,
    };
  }


  /**
   * Applies a partial update to an existing document.
   * If the document doesn't already exist, a new document is created.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async upsert (request) {
    const id = this.getId(request);
    const content = this.getBodyObject(request, 'changes');
    const defaultValues = this.getBodyObject(request, 'default', {});
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const retryOnConflict = request.input.args.retryOnConflict;
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const updatedDocument = await this.ask(
      'core:storage:public:document:upsert',
      index,
      collection,
      id,
      content,
      { defaultValues, refresh, retryOnConflict, userId });

    if (! silent && updatedDocument.created) {
      await this.ask(
        'core:realtime:document:notify',
        request,
        actionEnum.CREATE,
        updatedDocument._source);
    }
    else if (! silent) {
      const _updatedFields = Object
        .keys(content)
        .filter(k => k !== '_kuzzle_info');

      await this.ask(
        'core:realtime:document:notify',
        request,
        actionEnum.UPDATE,
        {
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          _updatedFields,
        });
    }

    if (source) {
      return updatedDocument;
    }

    return {
      _id: updatedDocument._id,
      _version: updatedDocument._version,
      created: updatedDocument.created,
    };
  }

  /**
   * Update the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mUpdate (request) {
    return this._mChanges(request, 'mUpdate', actionEnum.UPDATE);
  }

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async replace (request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    const modifiedRequest = await global.kuzzle.validation.validate(
      request,
      false);

    const response = await this.ask(
      'core:storage:public:document:replace',
      index,
      collection,
      id,
      content,
      { refresh, userId });

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        modifiedRequest,
        actionEnum.REPLACE,
        {
          _id: modifiedRequest.input.resource._id,
          _source: modifiedRequest.input.body,
        });
    }

    return response;
  }

  /**
   * Replace the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mReplace (request) {
    return this._mChanges(request, 'mReplace', actionEnum.REPLACE);
  }

  /**
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async delete (request) {
    const id = this.getId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const document = await this.ask(
      'core:storage:public:document:get',
      index,
      collection,
      id);

    await this.ask('core:storage:public:document:delete', index, collection, id, {
      refresh,
    });

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        request,
        actionEnum.DELETE,
        document);
    }

    if (!source) {
      return { _id: document._id };
    }

    return document;
  }

  /**
   * Delete specific documents according to given ids
   * Delegates the notification to delete action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mDelete (request) {
    const ids = this.getBodyArray(request, 'ids');
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    const { documents, errors } = await this.ask(
      'core:storage:public:document:mDelete',
      index,
      collection,
      ids,
      { refresh });

    if (! silent) {
      await this.ask(
        'core:realtime:document:mNotify',
        request,
        actionEnum.DELETE,
        documents);
    }

    return {
      errors,
      successes: documents.map(d => d._id)
    };
  }

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteByQuery (request) {
    let query = this.getBodyObject(request, 'query', {});
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);
    const lang = this.getLangParam(request);

    if (lang === 'koncorde') {
      query = await this.translateKoncorde(query);
    }

    const result = await this.ask(
      'core:storage:public:document:deleteByQuery',
      index,
      collection,
      query,
      { refresh });

    if (! silent) {
      await this.ask(
        'core:realtime:document:mNotify',
        request,
        actionEnum.DELETE,
        result.documents);
    }

    if (! source) {
      result.documents.forEach(d => (d._source = undefined));
    }
    return {
      documents: result.documents,
      ids: result.documents.map(d => d._id)
    };
  }

  /**
  * Delete fields of a document. Throws an error if the document doesn't exist
  *
  * @param {Request} request
  * @returns {Promise<Object>}
  */
  async deleteFields (request) {
    const id = this.getId(request);
    const fields = this.getBodyArray(request, 'fields');
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const response = await this.ask(
      'core:storage:public:document:deleteFields',
      index,
      collection,
      id,
      fields,
      { refresh, userId });

    if (! silent) {
      await this.ask(
        'core:realtime:document:notify',
        request,
        actionEnum.UPDATE,
        {
          _id: response._id,
          _source: response._source,
        });
    }

    if (source) {
      return response;
    }

    return {
      _id: response._id,
      _version: response._version
    };
  }

  /**
   * Update several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object}
   */
  async updateByQuery (request) {
    let query = this.getBodyObject(request, 'query');
    const changes = this.getBodyObject(request, 'changes');
    const silent = this.getBoolean(request, 'silent');
    const userId = this.getUserId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);
    const lang = this.getLangParam(request);

    if (lang === 'koncorde') {
      query = await this.translateKoncorde(query);
    }

    const result = await this.ask(
      'core:storage:public:document:updateByQuery',
      index,
      collection,
      query,
      changes,
      { refresh, userId });

    if (! silent) {
      await this.ask(
        'core:realtime:document:mNotify',
        request,
        actionEnum.UPDATE,
        result.successes.map(doc => ({
          _id: doc._id,
          _source: doc._source,
          _updatedFields: Object.keys(changes).filter(k => k !== '_kuzzle_info'),
        })));
    }

    if (!source) {
      result.successes.forEach(d => (d._source = undefined));
    }

    return result;
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate (request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);

    // @todo validation service should not take request argument
    return global.kuzzle.validation.validate(request, true);
  }

  /**
   * Applies a multi-document change request (create, update,
   * replace, createOrReplace)
   *
   * @param  {Request} request
   * @param  {String} methodName ES Service method to apply
   * @param  {notifyActionEnum} action performed on the documents
   * @returns {Promise.<Object>} { successes, errors }
   */
  async _mChanges (request, methodName, action) {
    const userId = this.getUserId(request);
    const silent = this.getBoolean(request, 'silent');
    const refresh = this.getString(request, 'refresh', 'false');
    const documents = this.getBodyArray(request, 'documents');
    const { index, collection } = this.getIndexAndCollection(request);

    this.assertNotExceedMaxWrite(documents.length);

    if (documents.length === 0) {
      return {
        errors: [],
        successes: [],
      };
    }

    for (let i = 0; i < documents.length; i++) {
      if (documents[i]._source) {
        throw kerror.get(
          'api',
          'assert',
          'unexpected_argument',
          `documents[${i}]._source`,
          `documents[${i}].body`);
      }
    }

    const response = await this.ask(
      `core:storage:public:document:${methodName}`,
      index,
      collection,
      documents,
      { refresh, userId });

    // @todo inject _updatedFields property for mUpdate requests
    if (! silent) {
      await this.ask(
        'core:realtime:document:mNotify',
        request,
        action,
        response.items);
    }

    return {
      errors: response.errors,
      successes: response.items
    };
  }
}

function hasMultiTargets (str) {
  return [',', '*', '+'].some(chr => str.includes(chr)) || str === '_all';
}

module.exports = DocumentController;
