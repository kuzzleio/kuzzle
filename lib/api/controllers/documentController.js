'use strict';

var
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasId = require('./util/requestAssertions').assertHasId,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection;

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
    assertHasIndexAndCollection(request, 'search');

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

    return engine.get(request);
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
      throw new BadRequestError('deleteByQuery must specify a not empty body attribute "query" of type object.');
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

module.exports = DocumentController;
