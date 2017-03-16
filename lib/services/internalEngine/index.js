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
'use strict';

const
  _ = require('lodash'),
  Promise = require('bluebird'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  KuzzleError = require('kuzzle-common-objects').errors.KuzzleError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError;

let
  es = require('elasticsearch');

/**
 * @param {Kuzzle} kuzzle instance
 * @param {string} index
 * @constructor
 */
class InternalEngine {
  constructor (kuzzle, index = '%kuzzle') {
    this.kuzzle = kuzzle;
    this.client = null;
    this.index = index;
    this.bootstrap = null;
  }


  /**
   * Initialize the elasticsearch client
   *
   * @returns {object} client
   */
  init (bootstrap) {
    this.bootstrap = bootstrap;

    if (!this.client) {
      this.client = new es.Client({
        host: this.kuzzle.config.services.db.host + ':' + this.kuzzle.config.services.db.port,
        apiVersion: this.kuzzle.config.services.db.apiVersion
      });
    }

    return this.kuzzle.indexCache.initInternal(this)
      .then(() => this);
  }


  /**
   * Search documents from elasticsearch with a query
   * @param {string} type - data collection
   * @param {object} [query] - optional
   * @param {number} [from] - manage pagination
   * @param {number} [size] - manage pagination
   * @returns {Promise} resolve documents matching the query
   */
  search (type, query, from, size) {
    const
      request = {
        index: this.index,
        type,
        body: {
          from: from || 0,
          size: size || 20
        }
      };

    if (query && query.query) {
      request.body.query = query.query;
    }
    else if (query) {
      request.body.query = query;
    }

    return this.client.search(request)
      .then(result => {
        // remove depth in object (replace hits.hits<array>, with hits<array>)
        if (result.hits) {
          result = _.extend(result, result.hits);
        }

        return result;
      })
      .catch(error => handleError(error));
  }

  /**
   *
   * @param type
   * @param id
   */
  exists (type, id) {
    return this.client.exists({
      index: this.index,
      type,
      id
    })
      .catch(error => handleError(error));
  }

  /**
   * Get the document with given ID
   *
   * @param {string} type - data collection
   * @param {string} id - id of the document to retrieve
   * @returns {Promise} resolve the document
   */
  get (type, id) {
    const request = {
      index: this.index,
      type,
      id
    };

    return this.client.get(request)
      .catch(error => handleError(error));
  }

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {string} type - data collection
   * @param {array} ids - list of document IDs to get
   * @returns {Promise}
   */
  mget (type, ids) {
    const request = {
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
      })
      .catch(error => handleError(error));
  }

  /**
   * Send to elasticsearch the new document
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  create (type, id, content) {
    const request = {
      index: this.index,
      type,
      id,
      body: content
    };

    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.create(request)
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  createOrReplace (type, id, content) {
    const request = {
      index: this.index,
      type,
      id,
      body: content
    };

    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.index(request)
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Performs a partial update to a document
   *
   * @param {string} type - data collection
   * @param {string} id of the document to update
   * @param {object} updateContent
   * @returns {Promise} resolve an object that contains _id
   */
  update (type, id, updateContent) {
    const request = {
      index: this.index,
      type,
      id,
      body: {
        doc: updateContent
      }
    };

    return this.client.update(request)
      .catch(error => handleError(error));
  }

  /**
   * Replace a document with new content
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  replace (type, id, content) {
    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.exists(type, id)
      .then(exists => {
        const request = {
          index: this.index,
          type,
          id,
          body: content
        };

        if (exists) {
          return this.client.index(request);
        }

        return Promise.reject(new NotFoundError('Document with id ' + id + ' not found.'));
      })
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {string} type - data collection
   * @param {string} id - id of the document to delete
   * @returns {Promise} resolve an object that contains _id
   */
  delete (type, id) {
    const request = {
      index: this.index,
      type,
      id
    };

    return this.client.delete(request)
      .catch(error => handleError(error));
  }

  /**
   * Get the list of existing indexes in elasticsearch
   *
   * @returns {Promise}
   */
  listIndexes () {
    return this.client.indices.getMapping()
      .then(response => Object.keys(response))
      .catch(error => handleError(error));
  }

  /**
   * Get the list of existing collections in elasticsearch
   *
   * @returns {Promise}
   */
  listCollections (index) {
    return this.client.indices.getMapping({index: index})
      .then(result => {
        return result[index] && result[index].mappings ? Object.keys(result[index].mappings) : [];
      })
      .catch(error => handleError(error));
  }

  /**
   * Retrieve mapping definiton of index or index/collection
   *
   * @returns {Promise}
   */
  getMapping (data) {
    return this.client.indices.getMapping(data)
      .catch(error => handleError(error));
  }

  /**
   * Create the internal index
   *
   * @returns {Promise}
   */
  createInternalIndex () {
    return this.client.indices.exists({index: this.index})
      .then(exists => {
        if (!exists) {
          return this.client.indices.create({
            index: this.index
          });
        }
      })
      .catch(error => handleError(error));
  }

  /**
   * Deletes the internal index
   *
   * @returns {*}
   */
  deleteIndex () {
    return this.client.indices.delete({
      index: this.index
    })
      .catch(error => handleError(error));
  }

  /**
   * Add a mapping definition to a specific type
   *
   * @param {string} type - data collection
   * @param {object} mapping
   * @return {Promise}
   */
  updateMapping (type, mapping) {
    const request = {
      index: this.index,
      type,
      body: mapping
    };

    return this.client.indices.putMapping(request)
      .catch(error => handleError(error));
  }

  /**
   * Refreshes the internal index
   * @returns {Promise}
   */
  refresh () {
    return this.client.indices.refresh({
      index: this.index
    })
      .catch(error => handleError(error));
  }
}

function handleError(error) {
  if (error instanceof es.errors.NoConnections) {
    return Promise.reject(new ServiceUnavailableError('es service is not connected'));
  }

  if (error instanceof KuzzleError) {
    return Promise.reject(error);
  }

  if (error.status === 404) {
    return Promise.reject(new NotFoundError(`Not found: ${error.body._type}/${error.body._id}`));
  }

  return Promise.reject(new InternalError(error));
}

module.exports = InternalEngine;
