'use strict';

var
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasId = require('./util/requestAssertions').assertHasId,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection,
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
    assertHasIndexAndCollection(request, 'document:search');

    if (request.input.resource.index.split(',').length > 1) {
      throw new BadRequestError('search on multiple indexes is not available.');
    }
    if (request.input.resource.collection.split(',').length > 1) {
      throw new BadRequestError('search on multiple collections is not available.');
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
    assertHasId(request, 'document:get');
    assertHasIndexAndCollection(request, 'document:get');

    return engine.get(request);
  };

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGet = function documentMGet (request) {
    assertHasBody(request, 'document:mGet');
    assertBodyHasAttribute(request, 'ids', 'document:mGet');
    assertHasIndexAndCollection(request, 'document:mGet');

    if (!Array.isArray(request.input.body.ids)) {
      throw new BadRequestError('document:mGet must specify an array of "ids"');
    }

    return engine.mget(request)
      .then(documents => {
        return Promise.resolve({hits: documents, total: documents.hits.length});
      });
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function documentCount (request) {
    assertHasBody(request, 'document:count');

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

    assertHasBody(request, 'document:create');
    assertHasIndexAndCollection(request, 'document:create');

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
    return doMultipleActions(kuzzle, request, 'create', ['created']);
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

    assertHasBody(request, 'document:createOrReplace');
    assertHasIndexAndCollection(request, 'document:createOrReplace');
    assertHasId(request, 'document:createOrReplace');

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
    return doMultipleActions(kuzzle, request, 'createOrReplace', ['created', 'updated']);
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

    assertHasBody(request, 'document:update');
    assertHasIndexAndCollection(request, 'document:update');
    assertHasId(request, 'document:update');

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
   * Update the the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mUpdate = function documentMUpdate (request) {
    return doMultipleActions(kuzzle, request, 'update', ['updated']);
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

    assertHasBody(request, 'document:replace');
    assertHasIndexAndCollection(request, 'document:replace');
    assertHasId(request, 'document:replace');

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
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.delete = function documentDelete (request) {
    assertHasIndexAndCollection(request, 'document:delete');
    assertHasId(request, 'document:delete');

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

    assertHasBody(request, 'document:mDelete');
    assertBodyHasAttribute(request, 'ids', 'document:mDelete');
    assertHasIndexAndCollection(request, 'document:mDelete');

    if (!Array.isArray(request.input.body.ids)) {
      throw new BadRequestError('document:mDelete must specify an array of "ids".');
    }

    for (let i = 0; i < request.input.body.ids.length; i++) {
      let deleteRequest = new Request({
        index: request.input.resource.index,
        collection: request.input.resource.collection,
        controller: 'document',
        action: 'delete',
        _id: request.input.body.ids[i]
      }, request.context);

      promises[i] = new Promise(resolve => {
        kuzzle.funnel.processRequest(deleteRequest)
          .then(() => {
            return resolve(deleteRequest);
          })
          .catch(error => {
            deleteRequest.setError(error);

            return resolve(deleteRequest);
          });
      });
    }

    return Promise.all(promises)
      .then(documentsRequests => {
        let
          deletedIds = [],
          errorMessages = [];

        for (let i = 0; i < documentsRequests.length; i++) {
          if (documentsRequests[i].error || documentsRequests[i].result.result !== 'deleted') {
            errorMessages.push('document:mDelete was not able to delete the document ' + documentsRequests[i].input.resource._id);
          }
          else {
            deletedIds.push(documentsRequests[i].input.resource._id);
          }
        }

        if (errorMessages.length > 0) {
          request.setError(new PartialError('document:mDelete was not able to remove all documents', errorMessages.join('; ')));
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
    assertHasBody(request, 'document:deleteByQuery');
    assertHasIndexAndCollection(request, 'document:deleteByQuery');
    assertBodyHasAttribute(request, 'query', 'document:deleteByQuery');

    if (!(request.input.body.query instanceof Object)) {
      throw new BadRequestError('document:deleteByQuery must specify a not empty body attribute "query" of type object.');
    }

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
    assertHasBody(request, 'document:validate');
    assertHasIndexAndCollection(request, 'document:validate');
    assertHasId(request, 'document:validate');

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
 * @param {string[]} resultStates
 *
 * @returns {Promise<Object>}
 */
function doMultipleActions (kuzzle, request, action, resultStates) {
  let
    promises = [],
    multiActionName = 'm' + capitalizeFirstLetter(action);

  assertHasBody(request, `document:${multiActionName}`);
  assertBodyHasAttribute(request, 'documents', `document:${multiActionName}`);
  assertHasIndexAndCollection(request, `document:${multiActionName}`);

  if (!Array.isArray(request.input.body.documents)) {
    throw new BadRequestError(`document:${multiActionName} must specify an array of "documents".`);
  }

  for (let i = 0; i < request.input.body.documents.length; i++) {
    let modificationRequest = new Request({
      index: request.input.resource.index,
      collection: request.input.resource.collection,
      controller: 'document',
      action,
      body: request.input.body.documents[i].body || null
    }, request.context);

    if (request.input.body.documents[i]._id) {
      modificationRequest.input.resource._id = request.input.body.documents[i]._id;
    }

    promises[i] = new Promise(resolve => {
      kuzzle.funnel.processRequest(modificationRequest)
        .then(() => {
          return resolve(modificationRequest);
        })
        .catch(error => {
          modificationRequest.setError(error);

          return resolve(modificationRequest);
        });
    });
  }

  return Promise.all(promises)
    .then(documentsRequests => {
      let
        documents = [],
        errorMessages = [];

      for (let i = 0; i < documentsRequests.length; i++) {
        if (documentsRequests[i].error || resultStates.indexOf(documentsRequests[i].result.result) === -1) {
          errorMessages.push(`document:${multiActionName} was not able to treat the document ${documentsRequests[i].input.resource._id}`);
        }
        else {
          documents.push(documentsRequests[i].result);
        }
      }

      if (errorMessages.length > 0) {
        request.setError(new PartialError(`document:${multiActionName} was not able to treat all documents`, errorMessages.join('; ')));
      }

      return Promise.resolve({hits: documents, total: documents.length});
    });
}

/**
 * @param {string} string
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = DocumentController;
