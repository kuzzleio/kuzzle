/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  {
    BadRequestError,
    SizeLimitError,
    PartialError
  } = require('kuzzle-common-objects').errors,
  {
    assertHasBody,
    assertHasId,
    assertBodyHasAttribute,
    assertHasIndexAndCollection,
    assertBodyAttributeType,
    assertIdStartsNotUnderscore
  } = require('../../util/requestAssertions'),
  Request = require('kuzzle-common-objects').Request,
  Bluebird = require('bluebird');

/**
 * @class DocumentController
 * @param {Kuzzle} kuzzle
 */
class DocumentController {
  constructor(kuzzle) {
    this.engine = kuzzle.services.list.storageEngine;
    this.kuzzle = kuzzle;
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
    assertHasBody(request);

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

    return this.kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

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
    return doMultipleWriteActions(this.kuzzle, request, 'create');
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
    assertIdStartsNotUnderscore(request);

    return this.kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

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
    return doMultipleWriteActions(this.kuzzle, request, 'createOrReplace');
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

    return this.kuzzle.validation.validationPromise(request, false)
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
    return doMultipleWriteActions(this.kuzzle, request, 'update');
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

    return this.kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

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
    return doMultipleWriteActions(this.kuzzle, request, 'replace');
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

    this.kuzzle.notifier.publish(request, 'unknown', 'pending');

    return this.engine.delete(request)
      .then(response => {
        this.kuzzle.notifier.notifyDocumentDelete(request, [response._id]);

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
    const promises = [];

    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');
    assertHasIndexAndCollection(request);

    if (request.input.body.ids.length > this.kuzzle.config.limits.documentsWriteCount) {
      throw new BadRequestError(`Number of delete to perform exceeds the server configured value (${this.kuzzle.config.limits.documentsWriteCount})`);
    }

    request.input.body.ids.forEach(id => {
      const deleteRequest = new Request({
        index: request.input.resource.index,
        collection: request.input.resource.collection,
        controller: 'document',
        action: 'delete',
        _id: id
      }, request.context);

      if (request.input.args.refresh) {
        deleteRequest.input.args.refresh = request.input.args.refresh;
      }

      promises.push(Bluebird.promisify(this.kuzzle.funnel.mExecute, {context: this.kuzzle.funnel})(deleteRequest));
    });

    return Bluebird.all(promises)
      .then(documentRequests => {
        const
          deletedIds = [],
          errors = [];

        documentRequests.forEach(documentRequest => {
          if (documentRequest.error) {
            errors.push(documentRequest.error);
          }
          else {
            deletedIds.push(documentRequest.input.resource._id);
          }
        });

        if (errors.length > 0) {
          request.setError(new PartialError('Operation was not able to remove all documents.', errors));
        }

        return deletedIds;
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
        this.kuzzle.notifier.notifyDocumentDelete(request, response.ids);

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
    assertHasId(request);

    return this.kuzzle.validation.validationPromise(request, true)
      .then(response => {
        if (!response.valid) {
          this.kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${request.input.resource.index} / ${request.input.resource.collection} : ${JSON.stringify(request.input.body)}`);
        }

        return response;
      });
  }
}

/**
 * Processes multiple document actions
 * Delegates the notification to the underlying action
 * Relies on the field "documents"
 * set a PartialError if one or more document actions fail
 *
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {string} action
 *
 * @returns {Promise<Object>}
 */
function doMultipleWriteActions (kuzzle, request, action) {
  const promises = [];

  assertHasBody(request);
  assertBodyHasAttribute(request, 'documents');
  assertBodyAttributeType(request, 'documents', 'array');
  assertHasIndexAndCollection(request);

  if (request.input.body.documents.length > kuzzle.config.limits.documentsWriteCount) {
    throw new SizeLimitError(`Number of documents to update exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
  }

  request.input.body.documents.forEach(document => {
    const modificationRequest = new Request({
      action,
      index: request.input.resource.index,
      collection: request.input.resource.collection,
      controller: 'document',
      body: document.body || null
    }, request.context);

    if (document._id) {
      modificationRequest.input.resource._id = document._id;
    }

    if (request.input.args.refresh) {
      modificationRequest.input.args.refresh = request.input.args.refresh;
    }

    if (request.input.args.retryOnConflict) {
      modificationRequest.input.args.retryOnConflict = request.input.args.retryOnConflict;
    }

    promises.push(Bluebird.promisify(kuzzle.funnel.mExecute, {context: kuzzle.funnel})(modificationRequest));
  });

  return Bluebird.all(promises)
    .then(documentRequests => {
      const
        documents = [],
        errors = [];

      documentRequests.forEach(documentRequest => {
        if (documentRequest.error) {
          errors.push(documentRequest.error);
        }
        else {
          documents.push(documentRequest.result);
        }
      });

      if (errors.length > 0) {
        request.setError(new PartialError('Operation was not able to process all documents.', errors));
      }

      return {hits: documents, total: documents.length};
    });
}

module.exports = DocumentController;
