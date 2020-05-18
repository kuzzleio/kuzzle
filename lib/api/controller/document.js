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
const { NativeController } = require('./base');
const { assertHasBody, assertHasIndexAndCollection } = require('../../util/requestAssertions');

/**
 * @class DocumentController
 * @param {Kuzzle} kuzzle
 */
class DocumentController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
      'count',
      'create',
      'createOrReplace',
      'delete',
      'deleteByQuery',
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
      'updateByQuery',
      'validate'
    ]);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  search (request) {
    const { from, size, scrollTTL, searchBody } = this.getSearchParams(request);
    const { index, collection } = this.getIndexAndCollection(request);

    if ( [',', '*', '+'].some(searchValue => index.indexOf(searchValue) !== -1)
      || index === '_all'
    ) {
      throw kerror.get('services', 'storage', 'no_multi_indexes');
    }
    if ( [',', '*', '+'].some(searchValue => collection.indexOf(searchValue) !== -1)
      || collection === '_all'
    ) {
      throw kerror.get('services', 'storage', 'no_multi_collections');
    }

    this.assertNotExceedMaxFetch(size - from);

    return this.publicStorage.search(
      index,
      collection,
      searchBody,
      { from, scroll: scrollTTL, size }
    )
      .then(({ scrollId, hits, aggregations, total }) => ({
        aggregations,
        hits,
        scrollId,
        total
      }));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scroll (request) {
    const scrollTTL = this.getScrollTTLParam(request);
    const _scrollId = this.getString(request, 'scrollId');

    return this.publicStorage.scroll(_scrollId, { scrollTTL })
      .then(({ scrollId, hits, total }) => ({
        hits,
        scrollId,
        total
      }));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Boolean>}
   */
  exists (request) {
    const id = this.getId(request);
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.exists(index, collection, id);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  get (request) {
    const id = this.getId(request);
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.get(index, collection, id)
      .then(({ _id, _version, _source}) => ({
        _id,
        _source,
        _version
      }));
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

    return this.publicStorage.mGet(index, collection, ids)
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
  count (request) {
    const { searchBody } = this.getSearchParams(request);
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.count(index, collection, searchBody)
      .then(count => ({
        count
      }));
  }

  /**
   * Create a new document
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  create (request) {
    let modifiedRequest;
    let response;

    const id = request.input.resource._id;
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.create(
          index,
          collection,
          content,
          { id, refresh, userId });
      })
      .then(_response => {
        // response: { _id, _version, _source }
        response = _response;

        return this.kuzzle.notifier.notifyDocumentCreate(
          modifiedRequest,
          response);
      })
      .then(() => response);
  }

  /**
   * Create the documents provided in the body
   * Delegates the notification to create action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreate (request) {
    return this._mChanges(request, 'mCreate', false);
  }

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createOrReplace (request) {
    let modifiedRequest;
    let response;

    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.createOrReplace(
          index,
          collection,
          id,
          content,
          { refresh, userId });
      })
      .then(_response => {
        // response: { _id, _version, _source, created }
        response = _response;

        if (response.created) {
          return this.kuzzle.notifier.notifyDocumentCreate(
            modifiedRequest,
            response);
        }

        return this.kuzzle.notifier.notifyDocumentReplace(modifiedRequest);
      })
      .then(() => response);
  }

  /**
   * Create or replace the documents provided in the body
   * Delegates the notification to createOrReplace action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreateOrReplace (request) {
    return this._mChanges(request, 'mCreateOrReplace', true);
  }

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  update (request) {
    let modifiedRequest;
    let response;

    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const retryOnConflict = request.input.args.retryOnConflict;
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.update(
          index,
          collection,
          id,
          content,
          { refresh, retryOnConflict, userId });
      })
      .then(_response => {
        response = _response;
        return this.kuzzle.notifier.notifyDocumentUpdate(modifiedRequest, response);
      })
      .then(() => {
        if (!source) {
          return {_id: response._id, _version: response._version};
        }
        return response;
      });
  }

  /**
   * Update the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mUpdate (request) {
    return this._mChanges(request, 'mUpdate', true);
  }

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  replace (request) {
    let modifiedRequest;
    let response;

    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.replace(
          index,
          collection,
          id,
          content,
          { refresh, userId });
      })
      .then(_response => {
        response = _response;

        return this.kuzzle.notifier.notifyDocumentReplace(modifiedRequest);
      })
      .then(() => response);
  }

  /**
   * Replace the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mReplace (request) {
    return this._mChanges(request, 'mReplace', true);
  }

  /**
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async delete (request) {
    const id = this.getId(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const document = await this.publicStorage.get(index, collection, id);

    await this.publicStorage.delete(index, collection, id, { refresh });

    await this.kuzzle.notifier.notifyDocumentMDelete(request, [document]);

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
    const refresh = this.getString(request, 'refresh', 'false');
    const { index, collection } = this.getIndexAndCollection(request);

    const { documents, errors } = await this.publicStorage.mDelete(
      index,
      collection,
      ids,
      { refresh });

    await this.kuzzle.notifier.notifyDocumentMDelete(request, documents);

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
    const query = this.getBodyObject(request, 'query');
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const { documents } = await this.publicStorage.deleteByQuery(
      index,
      collection,
      query,
      { refresh });

    await this.kuzzle.notifier.notifyDocumentMDelete(request, documents);

    if (!source) {
      return { ids: documents.map(d => d._id) };
    }
    return { documents };
  }

  /**
   * Update several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object}
   */
  async updateByQuery (request) {
    const query = this.getBodyObject(request, 'query');
    const changes = this.getBodyObject(request, 'changes');
    const refresh = this.getString(request, 'refresh', 'false');
    const source = this.getBoolean(request, 'source');
    const { index, collection } = this.getIndexAndCollection(request);

    const result = await this.publicStorage.updateByQuery(
      index,
      collection,
      query,
      changes,
      { refresh });

    await this.kuzzle.notifier.notifyDocumentMChanges(request, result.successes);

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
    return this.kuzzle.validation.validate(request, true);
  }

  /**
   * Applies a multi-document change request (create, update,
   * replace, createOrReplace)
   *
   * @param  {Request} request
   * @param  {String} methodName ES Service method to apply
   * @param  {boolean} cached Action requires the notifier to pull ids from cache
   * @return {Promise.<Object>} { successes, errors }
   */
  async _mChanges (request, methodName, cached) {
    const refresh = this.getString(request, 'refresh', 'false');
    const userId = this.getUserId(request);
    const documents = this.getBodyArray(request, 'documents');
    const { index, collection } = this.getIndexAndCollection(request);

    this.assertNotExceedMaxWrite(documents.length);

    const response = await this.publicStorage[methodName](
      index,
      collection,
      documents,
      { refresh, userId });

    await this.kuzzle.notifier.notifyDocumentMChanges(
      request,
      response.items,
      cached);

    return {
      errors: response.errors,
      successes: response.items
    };
  }
}

module.exports = DocumentController;
