'use strict';

var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Request = require('kuzzle-common-objects').Request,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertHasIndex = require('./util/requestAssertions').assertHasIndex;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function IndexController (kuzzle) {
  /** @type ElasticSearch */
  var engine = kuzzle.services.list.storageEngine;

  /**
   * Reset all indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mDelete = function indexMDelete (request) {
    var
      allowedIndexes = [],
      indexes;

    assertHasBody(request, 'index:mDelete');
    assertBodyHasAttribute(request, 'indexes', 'index:mDelete');

    return engine.listIndexes()
      .then(res => {
        indexes = res.indexes.filter(index => _.includes(request.input.body.indexes, index));

        return kuzzle.repositories.user.load(request.context.token.userId);
      })
      .then(user => {
        var promises = indexes.map(index => user.isActionAllowed(new Request({controller: 'index', action: 'delete', index}, request.context), kuzzle)
          .then(isAllowed => {
            if (isAllowed) {
              allowedIndexes.push(index);
            }
          }));

        return Promise.all(promises);
      })
      .then(() => {
        request.input.body.indexes = allowedIndexes;

        return Promise.resolve();
      })
      .then(() => {
        return engine.deleteIndexes(request);
      })
      .then(response => {
        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return Promise.resolve(response);
      });
  };

  /**
   * Create an empty index
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.create = function indexCreate (request) {
    assertHasIndex(request, 'index:create');

    return engine.createIndex(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index);

        return Promise.resolve(response);
      });
  };

  /**
   * Delete the entire index and associated collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.delete = function indexDelete (request) {
    assertHasIndex(request, 'index:delete');

    return engine.deleteIndex(request)
      .then(response => {
        kuzzle.indexCache.remove(request.input.resource.index);

        return Promise.resolve(response);
      });
  };


  /**
   * Forces the refresh of the given index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.refresh = function indexRefresh (request) {
    assertHasIndex(request, 'index:refresh');

    return engine.refreshIndex(request);
  };

  /**
   * @returns {Promise<Object>}
   */
  this.list = function readList () {
    return engine.listIndexes();
  };

  /**
   * Forces the refresh of the internal index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @returns {Promise<Object>}
   */
  this.refreshInternal = function indexRefreshInternal () {
    return kuzzle.internalEngine.refresh()
      .then(() => Promise.resolve({acknowledged: true}));
  };

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getAutoRefresh = function indexGetAutoRefresh (request) {
    assertHasIndex(request, 'index:getAutoRefresh');

    return engine.getAutoRefresh(request);
  };

  /**
   * Sets elasticsearch autorefresh on/off for current index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.setAutoRefresh = function indexSetAutoRefresh (request) {
    assertHasBody(request, 'index:setAutoRefresh');
    assertBodyHasAttribute(request, 'autoRefresh', 'index:setAutoRefresh');

    if (typeof request.input.body.autoRefresh !== 'boolean') {
      throw new BadRequestError('Invalid type for autoRefresh, expected Boolean got ' + typeof request.input.body.autoRefresh);
    }

    return engine.setAutoRefresh(request)
      .then(response => {
        return Promise.resolve({response});
      });
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.exists = function indexExists (request) {
    assertHasIndex(request, 'index:exists');

    return engine.indexExists(request);
  };
}

module.exports = IndexController;