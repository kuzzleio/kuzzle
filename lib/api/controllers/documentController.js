'use strict';

var
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasId = require('./util/requestAssertions').assertHasId,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection,
  assertBodyAttributeType = require('./util/requestAssertions').assertBodyAttributeType,
  Request = require('kuzzle-common-objects').Request,
  PartialError = require('kuzzle-common-objects').errors.PartialError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function DocumentController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

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

    return engine.search(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.scroll = function documentScroll (request) {
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

    return engine.mget(request)
      .then(documents => {
        documents.total = documents.hits.length;

        return Promise.resolve(documents);
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
    var modifiedRequest;

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
    return doMultipleActions(kuzzle, request, 'create');
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplace = function documentCreateOrReplace (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

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
    return doMultipleActions(kuzzle, request, 'createOrReplace');
  };

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.update = function documentUpdate (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

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
    return doMultipleActions(kuzzle, request, 'update');
  };

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.replace = function documentReplace (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

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
    return doMultipleActions(kuzzle, request, 'replace');
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
        kuzzle.funnel.processRequest(deleteRequest)
          .then(() => {
            return resolve(deleteRequest);
          })
          .catch(error => {
            deleteRequest.setError(error);

            return resolve(deleteRequest);
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
 * Treat multiple document actions
 * Delegates the notification to the underlying action
 * Relies on the field "documents"
 * set a PartialError if one or more documents were not treated properly
 *
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {string} action
 *
 * @returns {Promise<Object>}
 */
function doMultipleActions (kuzzle, request, action) {
  let promises = [];

  assertHasBody(request);
  assertBodyHasAttribute(request, 'documents');
  assertBodyAttributeType(request, 'documents', 'array');
  assertHasIndexAndCollection(request);

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
      kuzzle.funnel.processRequest(modificationRequest)
        .then(result => {
          return resolve(result);
        })
        .catch(error => {
          modificationRequest.setError(error);

          return resolve(modificationRequest);
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
        request.setError(new PartialError(`${request.input.controller}:${request.input.action} was not able to treat all documents`, errors));
      }

      return Promise.resolve({hits: documents, total: documents.length});
    });
}

module.exports = DocumentController;
