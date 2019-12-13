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
  errorsManager = require('../../util/errors'),
  { NativeController } = require('./base'),
  {
    assertHasBody,
    assertHasIndexAndCollection,
  } = require('../../util/requestAssertions');

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
      'validate'
    ]);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  search (request) {
    const
      { from, size, scrollTTL, searchBody } = this.getSearchParams(request),
      { index, collection } = this.getIndexAndCollection(request);

    if ( [',', '*', '+'].some(searchValue => index.indexOf(searchValue) !== -1)
      || index === '_all'
    ) {
      throw errorsManager.get('services', 'storage', 'no_multi_indexes');
    }
    if ( [',', '*', '+'].some(searchValue => collection.indexOf(searchValue) !== -1)
      || collection === '_all'
    ) {
      throw errorsManager.get('services', 'storage', 'no_multi_collections');
    }

    this.assertNotExceedMaxFetch(size - from);

    return this.publicStorage.search(
      index,
      collection,
      searchBody,
      { from, size, scroll: scrollTTL }
    )
      .then(({ scrollId, hits, aggregations, total }) => ({
        scrollId,
        hits,
        aggregations,
        total
      }));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scroll (request) {
    const
      scrollTTL = this.getScrollTTLParam(request),
      _scrollId = this.getString(request, 'scrollId');

    return this.publicStorage.scroll(_scrollId, { scrollTTL })
      .then(({ scrollId, hits, total }) => ({
        scrollId,
        hits,
        total
      }));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Boolean>}
   */
  exists (request) {
    const
      id = this.getId(request),
      { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.exists(index, collection, id);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  get (request) {
    const
      id = this.getId(request),
      { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.get(index, collection, id)
      .then(({ _id, _version, _source}) => ({
        _id,
        _version,
        _source
      }));
  }

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGet (request) {
    const
      ids = this.getBodyArray(request, 'ids'),
      { index, collection } = this.getIndexAndCollection(request);

    this.assertNotExceedMaxFetch(ids.length);

    return this.publicStorage.mGet(index, collection, ids)
      .then(({ items, errors }) => {
        return {
          successes: items,
          errors
        };
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  count (request) {
    const
      { searchBody } = this.getSearchParams(request),
      { index, collection } = this.getIndexAndCollection(request);

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
    let
      modifiedRequest,
      response;

    const
      id = request.input.resource._id,
      content = this.getBody(request),
      userId = this.getUserId(request),
      refresh = this.getString(request, 'refresh', 'false'),
      { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.create(
          index,
          collection,
          content,
          { userId, id, refresh });
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
    let
      modifiedRequest,
      response;

    const
      id = this.getId(request),
      content = this.getBody(request),
      userId = this.getUserId(request),
      refresh = this.getString(request, 'refresh', 'false'),
      { index, collection } = this.getIndexAndCollection(request);

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
    let modifiedRequest, response;

    const
      id = this.getId(request),
      content = this.getBody(request),
      userId = this.getUserId(request),
      refresh = this.getString(request, 'refresh', 'false'),
      retryOnConflict = request.input.args.retryOnConflict,
      { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.update(
          index,
          collection,
          id,
          content,
          { refresh, userId, retryOnConflict });
      })
      .then(_response => {
        // response: { _id, _version }
        response = _response;

        return this.kuzzle.notifier.notifyDocumentUpdate(modifiedRequest);
      })
      .then(() => response);
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
    let
      modifiedRequest,
      response;

    const
      id = this.getId(request),
      content = this.getBody(request),
      userId = this.getUserId(request),
      refresh = this.getString(request, 'refresh', 'false'),
      { index, collection } = this.getIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.publicStorage.replace(
          index,
          collection,
          id,
          content,
          { userId, refresh });
      })
      .then(_response => {
        // response: { _id, _version, _source }
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
  delete (request) {
    let document;

    const
      id = this.getId(request),
      { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.get(index, collection, id)
      .then(_document => {
        document = _document;

        return this.publicStorage.delete(index, collection, id);
      })
      .then(() => this.kuzzle.notifier.notifyDocumentMDelete(request, [document]))
      .then(() => ({
        _id: document._id
      }));
  }

  /**
   * Delete specific documents according to given ids
   * Delegates the notification to delete action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mDelete (request) {
    const
      ids = this.getBodyArray(request, 'ids'),
      refresh = this.getString(request, 'refresh', 'false'),
      { index, collection } = this.getIndexAndCollection(request);

    const { documents, errors } = await this.publicStorage.mDelete(
      index,
      collection,
      ids,
      { refresh });

    await this.kuzzle.notifier.notifyDocumentMDelete(request, documents);

    return {
      successes: documents.map(d => d._id),
      errors
    };
  }

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteByQuery (request) {
    const
      query = this.getBodyObject(request, 'query'),
      refresh = this.getString(request, 'refresh', 'false'),
      { index, collection } = this.getIndexAndCollection(request);

    const { documents } = await this.publicStorage.deleteByQuery(
      index,
      collection,
      query,
      { refresh });

    await this.kuzzle.notifier.notifyDocumentMDelete(request, documents);

    return { ids: documents.map(d => d._id) };
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
    const
      refresh = this.getString(request, 'refresh', 'false'),
      userId = this.getUserId(request),
      documents = this.getBodyArray(request, 'documents'),
      { index, collection } = this.getIndexAndCollection(request);

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
      successes: response.items,
      errors: response.errors
    };
  }
}

module.exports = DocumentController;
