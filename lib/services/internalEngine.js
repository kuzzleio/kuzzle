/*
  This is a light database service used by Kuzzle's core components, namely
  the plugins manager and the repositories.

  The differences with the standard database service are:

    - this service is not listed under kuzzle.services like other services, but
      is instead referenced in kuzzle.internalEngine.

    - This service is loaded prior to any other services and before the
      plugins manager

    - No plugins hooks are used in this service, because it is meant to be
      used by components before plugins initialization

    - Only the few database methods used by core components are implemented

    - Methods take detailed arguments, instead of request objects

    - Actions are limited to Kuzzle's internal index
 */

var
  _ = require('lodash'),
  q = require('q'),
  NotFoundError = require('../api/core/errors/notFoundError'),
  es = require('elasticsearch');

/**
 *
 * @param {Object} kuzzle instance
 */
module.exports = function (kuzzle) {
  this.client = null;
  this.engineType = 'internalEngine';
  this.index = kuzzle.config.internalIndex;

  /**
   * Initialize the elasticsearch client
   *
   * @returns {Object} client
   */
  this.init = function () {
    if (this.client) {
      return this;
    }

    this.client = new es.Client({
      host: kuzzle.config[this.engineType].hosts,
      apiVersion: kuzzle.config[this.engineType].apiVersion
    });

    return this;
  };

  /**
   * Search documents from elasticsearch with a query
   * @param {string} type - data collection
   * @param {object} [filters] - optional
   * @returns {Promise} resolve documents matching the filter
   */
  this.search = function (type, filters) {
    var
      request = {
        index: this.index,
        type,
        body: filters || {}
      };

    return this.client.search(request)
      .then(result => {
        // remove depth in object (replace hits.hits<array>, with hits<array>)
        if (result.hits) {
          result = _.extend(result, result.hits);
        }

        return result;
      });
  };

  /**
   * Get the document with given ID
   *
   * @param {string} type - data collection
   * @param {string} id of the document to retrieve
   * @returns {Promise} resolve the document
   */
  this.get = function (type, id) {
    var
      request = {
        index: this.index,
        type,
        id
      };

    return this.client.get(request);
  };

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {string} type - data collection
   * @param {array} ids - list of document IDs to get
   * @returns {Promise}
   */
  this.mget = function (type, ids) {
    var
      request = {
        index: this.index,
        type,
        body: {
          ids
        }
      };

    return this.client.mget(request)
      .then(result => {
        // harmonize response format based upon the search one
        if (result.docs) {
          result.hits = result.docs;
          delete result.docs;
        }

        return result;
      });
  };

  /**
   * Send to elasticsearch the new document
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  this.create = function (type, id, content) {
    var
      request = {
        index: this.index,
        type,
        id,
        body: content
      };

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.create(request)
      .then(result => _.extend(result, {_source: content}));
  };

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  this.createOrReplace = function (type, id, content) {
    var
      request = {
        index: this.index,
        type,
        id,
        body: content
      };

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.index(request)
      .then(result => _.extend(result, {_source: content}));
  };

  /**
   * Performs a partial update to a document
   *
   * @param {string} type - data collection
   * @param {string} id of the document to update
   * @param {object} updateContent
   * @returns {Promise} resolve an object that contains _id
   */
  this.update = function (type, id, updateContent) {
    var
      request = {
        index: this.index,
        type,
        id,
        body: {
          doc: updateContent
        }
      };

    return this.client.update(request);
  };

  /**
   * Replace a document with new content
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  this.replace = function (type, id, content) {
    var
      existRequest = {
        index: this.index,
        type: type,
        id: id
      };

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.exists(existRequest)
      .then(exists => {
        var
          request = {
            index: this.index,
            type,
            id,
            body: content
          };

        if (exists) {
          return this.client.index(request);
        }

        return q.reject(new NotFoundError('Document with id ' + id + ' not found.'));
      })
      .then(result => _.extend(result, {_source: content}));
  };

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {string} type - data collection
   * @param {string} id of the document to delete
   * @returns {Promise} resolve an object that contains _id
   */
  this.delete = function (type, id) {
    var
      request = {
        index: this.index,
        type,
        id
      };

    return this.client.delete(request);
  };

  /**
   * Create the internal index
   *
   * @returns promise}
   */
  this.createInternalIndex = function () {
    return this.client.indices.create({index: this.index});
  };
};
