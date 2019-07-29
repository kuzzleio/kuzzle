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
  BaseController = require('./baseController'),
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

    this.subdomain = 'document';
    this.engine = kuzzle.services.list.storageEngine;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  search(request) {
    assertHasIndexAndCollection(request);

    if ([',', '*', '+'].some(
      searchValue => request.input.resource.index.indexOf(searchValue) !== -1)
      || request.input.resource.index === '_all') {
      this.throw('search_on_multiple_indexes');
    }
    if ([',', '*', '+'].some(
      searchValue => request.input.resource.collection.indexOf(searchValue) !== -1)
      || request.input.resource.collection === '_all') {
      this.throw('search_on_multiple_collections');
    }

    if (request.input.args.size) {
      const documentsCount = 
        request.input.args.size - (request.input.args.from || 0);

      if (documentsCount > this.kuzzle.config.limits.documentsFetchCount) {
        this.throw(
          'get_limit_reached',
          this.kuzzle.config.limits.documentsFetchCount
        );
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
      this.throw('missing_scroll_id');
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
      .catch(error => 
        error.status === 404
          ? Bluebird.resolve(false)
          : Bluebird.reject(error)
      );
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

    if (
      request.input.body.ids.length >
      this.kuzzle.config.limits.documentsFetchCount
    ) {
      this.throw(
        'get_limit_reached',
        this.kuzzle.config.limits.documentsFetchCount
      );
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
    let modifiedRequest, response;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertIdStartsNotUnderscore(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        return this.kuzzle.notifier.publish(
          modifiedRequest, 'unknown', 'pending');
      })
      .then(() => this.engine.create(modifiedRequest))
      .then(_response => {
        response = _response;
        return this.kuzzle.notifier.notifyDocumentCreate(
          modifiedRequest, _response);
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
    let modifiedRequest, response;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        return this.kuzzle.notifier.publish(
          modifiedRequest, 'unknown', 'pending');
      })
      .then(() => this.engine.createOrReplace(modifiedRequest))
      .then(_response => {
        response = _response;

        if (response.created) {
          return this.kuzzle.notifier.notifyDocumentCreate(request, response);
        }

        return this.kuzzle.notifier.notifyDocumentReplace(request);
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
    let modifiedRequest, response;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return this.engine.update(modifiedRequest);
      })
      .then(_response => {
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
    let modifiedRequest, response;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return this.kuzzle.validation.validate(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        // @deprecated - Notifications before action will be removed in Kuzzle v2
        return this.kuzzle.notifier.publish(
          modifiedRequest, 'unknown', 'pending');
      })
      .then(() => this.engine.replace(modifiedRequest))
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

    let response;

    // @deprecated - Notifications before action will be removed in Kuzzle v2
    return this.kuzzle.notifier.publish(request, 'unknown', 'pending')
      .then(() => this.engine.delete(request))
      .then(_response => {
        response = _response;
        return this.kuzzle.notifier.notifyDocumentMDelete(
          request, [response._id]);
      })
      .then(() => response);
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

    let response;

    return this.engine.mdelete(request)
      .then(_response => {
        response = _response;

        if (response.error.length > 0) {
          request.setError(this.getError('deletion_failed', response.error));
        }

        return this.kuzzle.notifier.notifyDocumentMDelete(
          request, response.result);
      })
      .then(() => response.result);
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
      .then(response =>
        this.kuzzle.notifier.notifyDocumentMDelete(request, response.ids)
          .then(() => response));
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

    let response;

    return this.engine[methodName](request)
      .then(_response => {
        response = _response;

        if (response.error.length > 0) {
          request.setError(this.getError('creation_failed', response.error));
        }

        return this.kuzzle.notifier.notifyDocumentMChanges(
          request, response.result, cached);
      })
      .then(() => ({hits: response.result, total: response.result.length}));
  }
}

module.exports = DocumentController;
