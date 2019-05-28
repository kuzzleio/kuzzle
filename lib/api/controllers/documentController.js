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
  BaseController = require('./controller'),
  {
    errors: {
      BadRequestError,
      SizeLimitError,
      PartialError
    }
  } = require('kuzzle-common-objects'),
  {
    assertHasBody,
    assertHasId,
    assertBodyHasAttribute,
    assertHasIndexAndCollection,
    assertBodyAttributeType,
    assertIdStartsNotUnderscore
  } = require('../../util/requestAssertions'),
  Bluebird = require('bluebird');

/**
 * @class DocumentController
 * @param {Kuzzle} kuzzle
 */
class DocumentController extends BaseController {
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

    this.engine = kuzzle.services.list.storageEngine;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  search(request) {
    assertHasIndexAndCollection(request);

    if ([',', '*', '+'].some(searchValue => request.input.resource.index.indexOf(searchValue) !== -1)
      || request.input.resource.index === '_all') {
      throw new BadRequestError('Search on multiple indexes is not available.');
    }
    if ([',', '*', '+'].some(searchValue => request.input.resource.collection.indexOf(searchValue) !== -1)
      || request.input.resource.collection === '_all') {
      throw new BadRequestError('Search on multiple collections is not available.');
    }

    if (request.input.args.size) {
      const documentsCount = request.input.args.size - (request.input.args.from || 0);

      if (documentsCount > this.kuzzle.config.limits.documentsFetchCount) {
        throw new SizeLimitError(`Search cannot fetch more documents than the server configured limit (${this.kuzzle.config.limits.documentsFetchCount})`);
      }
    }

    return this.engine.search(request);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scroll(request) {
    if (!request.input.args.scrollId) {
      throw new BadRequestError('Scroll must specify a "scrollId" argument.');
    }

    return this.engine.scroll(request);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Boolean>}
   */
  exists(request) {
    assertHasId(request);

    return this.engine.get(request)
      .then(() => Bluebird.resolve(true))
      .catch(error => error.status === 404 ? Bluebird.resolve(false) : Bluebird.reject(error));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  get(request) {
    assertHasId(request);
    assertHasIndexAndCollection(request);

    return this.engine.get(request);
  }

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGet(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');
    assertHasIndexAndCollection(request);

    if (request.input.body.ids.length > this.kuzzle.config.limits.documentsFetchCount) {
      throw new SizeLimitError(`Number of gets to perform exceeds the server configured value (${this.kuzzle.config.limits.documentsFetchCount})`);
    }

    return this.engine.mget(request)
      .then(documents => {
        documents.total = documents.hits.length;
        return documents;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  count(request) {
    return this.engine.count(request);
  }

  /**
   * Create a new document
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  create(request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertIdStartsNotUnderscore(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        this.kuzzle.notifier.publish(modifiedRequest, 'unknown', 'pending');

        return this.engine.create(modifiedRequest);
      })
      .then(response => {
        this.kuzzle.notifier.notifyDocumentCreate(modifiedRequest, response);

        return response;
      });
  }

  /**
   * Create the documents provided in the body
   * Delegates the notification to create action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreate(request) {
    return this._mChanges(request, 'mcreate', false);
  }

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createOrReplace(request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        this.kuzzle.notifier.publish(modifiedRequest, 'unknown', 'pending');

        return this.engine.createOrReplace(modifiedRequest);
      })
      .then(response => {
        this.kuzzle.indexCache.add(modifiedRequest.input.resource.index, modifiedRequest.input.resource.collection);

        if (response.created) {
          this.kuzzle.notifier.notifyDocumentCreate(request, response);
        }
        else {
          this.kuzzle.notifier.notifyDocumentReplace(request);
        }

        return response;
      });
  }

  /**
   * Create or replace the documents provided in the body
   * Delegates the notification to createOrReplace action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreateOrReplace(request) {
    return this._mChanges(request, 'mcreateOrReplace', true);
  }

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  update(request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.engine.update(modifiedRequest);
      })
      .then(response => {
        this.kuzzle.notifier.notifyDocumentUpdate(modifiedRequest);

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
  mUpdate(request) {
    return this._mChanges(request, 'mupdate', true);
  }

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  replace(request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        this.kuzzle.notifier.publish(modifiedRequest, 'unknown', 'pending');

        return this.engine.replace(modifiedRequest);
      })
      .then(response => {
        this.kuzzle.notifier.notifyDocumentReplace(modifiedRequest);

        return response;
      });
  }

  /**
   * Replace the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mReplace(request) {
    return this._mChanges(request, 'mreplace', true);
  }

  /**
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  delete(request) {
    assertHasIndexAndCollection(request);
    assertHasId(request);

    // @deprecated - Notifications before action will be removed in Kuzzle v2
    this.kuzzle.notifier.publish(request, 'unknown', 'pending');

    return this.engine.delete(request)
      .then(response => {
        this.kuzzle.notifier.notifyDocumentMDelete(request, [response._id]);

        return response;
      });
  }

  /**
   * Delete specific documents according to given ids
   * Delegates the notification to delete action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDelete(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');
    assertHasIndexAndCollection(request);

    return this.engine.mdelete(request)
      .then(response => {
        if (response.error.length > 0) {
          request.setError(new PartialError('Some document creations failed', response.error));
        }

        this.kuzzle.notifier.notifyDocumentMDelete(request, response.result);
        return response.result;
      });
  }

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteByQuery(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'query');
    assertBodyAttributeType(request, 'query', 'object');
    assertHasIndexAndCollection(request);

    return this.engine.deleteByQuery(request)
      .then(response => {
        this.kuzzle.notifier.notifyDocumentMDelete(request, response.ids);

        return response;
      });
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate(request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);

    return this.kuzzle.validation.validate(request, true);
  }

  /**
   * Applies a multi-document change request (create, update,
   * replace, createOrReplace)
   *
   * @param  {Request} request
   * @param  {String} methodName ES Service method to apply
   * @param  {boolean} cached Action requires the notifier to pull ids from cache
   * @return {Promise}
   */
  _mChanges(request, methodName, cached) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'documents');
    assertBodyAttributeType(request, 'documents', 'array');
    assertHasIndexAndCollection(request);

    return this.engine[methodName](request)
      .then(response => {
        if (response.error.length > 0) {
          request.setError(new PartialError('Some document creations failed', response.error));
        }

        this.kuzzle.notifier.notifyDocumentMChanges(request, response.result, cached);
        return {hits: response.result, total: response.result.length};
      });
  }
}

module.exports = DocumentController;
