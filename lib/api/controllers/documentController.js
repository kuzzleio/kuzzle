'use strict';

let
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasId = require('./util/requestAssertions').assertHasId,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection,
  assertBodyAttributeType = require('./util/requestAssertions').assertBodyAttributeType,
  Request = require('kuzzle-common-objects').Request,
  Promise = require('bluebird'),
  PartialError = require('kuzzle-common-objects').errors.PartialError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function DocumentController (kuzzle) {
  const engine = kuzzle.services.list.storageEngine;

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.search = function documentSearch (request) {
    assertHasIndexAndCollection(request);

    if (request.input.resource.index.split(',').length > 1) {
      throw new BadRequestError('document:search on multiple indexes is not available.');
    }
    if (request.input.resource.collection.split(',').length > 1) {
      throw new BadRequestError('document:search on multiple collections is not available.');
    }

    if (request.input.args.size) {
      let documentsCount = request.input.args.size - (request.input.args.from || 0);

      if (documentsCount > kuzzle.config.limits.documentsFetchCount) {
        throw new SizeLimitError(`document:search cannot fetch more documents than the server configured limit (${kuzzle.config.limits.documentsFetchCount})`);
      }
    }

    return engine.search(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.scroll = function documentScroll (request) {
    if (!request.input.args.scrollId) {
      throw new BadRequestError('document:scroll must specify an argument "scrollId"');
    }

    return engine.scroll(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.get = function documentGet (request) {
    assertHasId(request);
    assertHasIndexAndCollection(request);

    return engine.get(request);
  };

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGet = function documentMGet (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');
    assertHasIndexAndCollection(request);

    if (request.input.body.ids.length > kuzzle.config.limits.documentsFetchCount) {
      throw new SizeLimitError(`Number of gets to perform exceeds the server configured value (${kuzzle.config.limits.documentsFetchCount})`);
    }

    return engine.mget(request)
      .then(documents => {
        documents.total = documents.hits.length;
        return documents;
      });
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function documentCount (request) {
    assertHasBody(request);

    return engine.count(request);
  };

  /**
   * Create a new document
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.create = function documentCreate (request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        request.input.args.state = 'pending';
        kuzzle.notifier.publish(modifiedRequest);

        return engine.create(modifiedRequest);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentCreate(modifiedRequest, response);

        return response;
      });
  };

  /**
   * Create the documents provided in the body
   * Delegates the notification to create action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mCreate = function documentMCreate (request) {
    return doMultipleWriteActions(kuzzle, request, 'create');
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplace = function documentCreateOrReplace (request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        request.input.args.state = 'pending';
        kuzzle.notifier.publish(modifiedRequest);

        return engine.createOrReplace(modifiedRequest);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequest.input.resource.index, modifiedRequest.input.resource.collection);

        if (response.created) {
          kuzzle.notifier.notifyDocumentCreate(request, response);
        }
        else {
          kuzzle.notifier.notifyDocumentReplace(request);
        }

        return response;
      });
  };

  /**
   * Create or replace the documents provided in the body
   * Delegates the notification to createOrReplace action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mCreateOrReplace = function documentMCreateOrReplace (request) {
    return doMultipleWriteActions(kuzzle, request, 'createOrReplace');
  };

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.update = function documentUpdate (request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        return engine.update(modifiedRequest);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentUpdate(modifiedRequest);

        return response;
      });
  };

  /**
   * Update the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mUpdate = function documentMUpdate (request) {
    return doMultipleWriteActions(kuzzle, request, 'update');
  };

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.replace = function documentReplace (request) {
    /** @type KuzzleRequest */
    let modifiedRequest;

    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => {
        modifiedRequest = newRequest;

        request.input.args.state = 'pending';
        kuzzle.notifier.publish(modifiedRequest);

        return engine.replace(modifiedRequest);
      })
      .then(response => {
        kuzzle.notifier.notifyDocumentReplace(modifiedRequest);

        return response;
      });
  };

  /**
   * Replace the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mReplace = function documentMReplace (request) {
    return doMultipleWriteActions(kuzzle, request, 'replace');
  };

  /**
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.delete = function documentDelete (request) {
    assertHasIndexAndCollection(request);
    assertHasId(request);

    request.input.args.state = 'pending';
    kuzzle.notifier.publish(request);

    return engine.delete(request)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(request, [response._id]);

        return response;
      });
  };

  /**
   * Delete specific documents according to given ids
   * Delegates the notification to delete action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mDelete = function documentMDelete (request) {
    let promises = [];

    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');
    assertHasIndexAndCollection(request);

    if (request.input.body.ids.length > kuzzle.config.limits.documentsWriteCount) {
      throw new BadRequestError(`Number of delete to perform exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
    }

    request.input.body.ids.forEach(id => {
      let deleteRequest = new Request({
        index: request.input.resource.index,
        collection: request.input.resource.collection,
        controller: 'document',
        action: 'delete',
        _id: id
      }, request.context);

      if (request.input.args.refresh) {
        deleteRequest.input.args.refresh = request.input.args.refresh;
      }

      promises.push(new Promise(resolve => {
        kuzzle.funnel.getRequestSlot(deleteRequest, overload => {
          if (overload) {
            deleteRequest.setError(overload);
            return resolve(deleteRequest);
          }

          kuzzle.funnel.processRequest(deleteRequest)
            .catch(error => deleteRequest.setError(error))
            .finally(() => resolve(deleteRequest));
        });
      }));
    });

    return Promise.all(promises)
      .then(documentRequests => {
        let
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
          request.setError(new PartialError('document:mDelete was not able to remove all documents', errors));
        }

        return deletedIds;
      });
  };

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteByQuery = function documentDeleteByQuery (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'query');
    assertBodyAttributeType(request, 'query', 'object');
    assertHasIndexAndCollection(request);

    return engine.deleteByQuery(request)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(request, response.ids);

        return response;
      });
  };

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.validate = function documentValidate (request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertHasId(request);

    return kuzzle.validation.validationPromise(request, true)
      .then(response => {
        if (!response.valid) {
          kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${request.input.resource.index} / ${request.input.resource.collection} : ${JSON.stringify(request.input.body)}`);
        }

        return response;
      });
  };
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
  let promises = [];

  assertHasBody(request);
  assertBodyHasAttribute(request, 'documents');
  assertBodyAttributeType(request, 'documents', 'array');
  assertHasIndexAndCollection(request);

  if (request.input.body.documents.length > kuzzle.config.limits.documentsWriteCount) {
    throw new SizeLimitError(`Number of documents to update exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
  }

  request.input.body.documents.forEach(document => {
    let modificationRequest = new Request({
      index: request.input.resource.index,
      collection: request.input.resource.collection,
      controller: 'document',
      action,
      body: document.body || null
    }, request.context);

    if (document._id) {
      modificationRequest.input.resource._id = document._id;
    }

    if (request.input.args.refresh) {
      modificationRequest.input.args.refresh = request.input.args.refresh;
    }

    promises.push(new Promise(resolve => {
      kuzzle.funnel.getRequestSlot(modificationRequest, overload => {
        if (overload) {
          modificationRequest.setError(overload);
          return resolve(modificationRequest);
        }

        kuzzle.funnel.processRequest(modificationRequest)
          .catch(error => modificationRequest.setError(error))
          .finally(() => resolve(modificationRequest));
      });
    }));
  });

  return Promise.all(promises)
    .then(documentRequests => {
      let
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
        request.setError(new PartialError(`${request.input.controller}:${request.input.action} was not able to process all documents`, errors));
      }

      return {hits: documents, total: documents.length};
    });
}

module.exports = DocumentController;
