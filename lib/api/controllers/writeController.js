'use strict';

var
  assertBody = require('./util/requestAssertions').assertBody,
  assertId = require('./util/requestAssertions').assertId,
  assertIndex = require('./util/requestAssertions').assertIndex,
  assertIndexAndCollection = require('./util/requestAssertions').assertIndexAndCollection,
  assertBodyAttribute = require('./util/requestAssertions').assertBodyAttribute,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function WriteController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Create a new document
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.create = function writeCreate (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

    assertBody(request, 'create');
    assertIndexAndCollection(request, 'create');

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
   * Publish a realtime message
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.publish = function writePublish (request) {

    assertBody(request, 'publish');
    assertIndexAndCollection(request, 'publish');

    return kuzzle.validation.validationPromise(request, false)
      .then(newRequest => kuzzle.notifier.publish(newRequest));
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplace = function writeCreateOrReplace (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

    assertBody(request, 'createOrReplace');
    assertIndexAndCollection(request, 'createOrReplace');

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
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.update = function writeUpdate (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

    assertBody(request, 'update');
    assertIndexAndCollection(request, 'update');
    assertId(request, 'update');

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
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.replace = function writeReplace (request) {
    /** @type KuzzleRequest */
    var modifiedRequest;

    assertBody(request, 'replace');
    assertIndexAndCollection(request, 'replace');
    assertId(request, 'replace');

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
  this.delete = function writeDelete (request) {
    assertIndexAndCollection(request, 'delete');
    assertId(request, 'delete');

    request.input.args.state = 'pending';
    kuzzle.notifier.publish(request);

    return engine.delete(request)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(request, [response._id]);

        return response;
      });
  };

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteByQuery = function writeDeleteByQuery (request) {
    assertBody(request, 'deleteByQuery');
    assertIndexAndCollection(request, 'deleteByQuery');
    assertBodyAttribute(request, 'query', 'deleteByQuery');

    if (!(request.input.body.query instanceof Object)) {
      throw new BadRequestError('deleteByQuery must specify a not empty body attribute "query" of type object.');
    }

    return engine.deleteByQuery(request)
      .then(response => {
        kuzzle.notifier.notifyDocumentDelete(request, response.ids);

        return response;
      });
  };

  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createCollection = function writeCreateCollection (request) {
    assertIndex(request, 'createCollection');

    return engine.createCollection(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return response;
      });
  };

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.validate = function writeValidate (request) {
    assertBody(request, 'validate');
    assertIndexAndCollection(request, 'validate');
    assertId(request, 'validate');

    return kuzzle.validation.validationPromise(request, true)
      .then(response => {
        if (!response.valid) {
          kuzzle.pluginsManager.trigger('validation:error', `The document does not comply with the ${request.input.resource.index} / ${request.input.resource.collection} : ${JSON.stringify(request.input.body)}`);
        }

        return response;
      });
  };
}

module.exports = WriteController;
