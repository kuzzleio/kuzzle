var
  Filters = require('./filters'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  async = require('async'),
  _ = require('lodash'),
  q = require('q'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto');

module.exports = function Dsl () {
  this.filters = new Filters();

  /**
   * Create an unique filter ID from an user filter.
   * The calculation is predictable, meaning the resulting
   * filter ID will always be the same with identical filters,
   * independently of the terms order.
   *
   * @param index
   * @param collection
   * @param filters
   * @results {string} unique room ID
   */
  this.createFilterId = function (index, collection, filters) {
    var idObject = {index, collection};

    idObject.filters = filters || {};

    return crypto.createHash('md5').update(stringify(idObject)).digest('hex');
  };

  /**
   * Subscribe a filter to the DSL
   *
   * @param {String} filterId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters
   * @return {promise}
   */
  this.subscribe = function (filterId, index, collection, filters) {
    if (!filters || _.isEmpty(filters)) {
      return this.filters.addCollectionSubscription(filterId, index, collection);
    }

    return this.filters.addSubscription(filterId, index, collection, filters);
  };
  
  /**
   * Test data against filters in the filters tree to get the matching
   * filters ID, if any
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {string} id - if the data refers to a document, the document unique ID
   * @param {Object} data to test filters on
   * @returns {Promise} Resolve to an array of filter IDs matching the provided data
   */
  this.test = function (index, collection, id, data) {
    var
      deferred = q.defer(),
      cachedResults = {},
      flattenBody = flattenObject(data, id);

    if (!index) {
      deferred.reject(new NotFoundError('The data doesn\'t contain an index'));
      return deferred.promise;
    }

    if (!collection) {
      deferred.reject(new NotFoundError('The data doesn\'t contain a collection'));
      return deferred.promise;
    }

    // No filters set for this index : we return an empty list
    if (!this.filters.filtersTree[index] || !this.filters.filtersTree[index][collection]) {
      deferred.resolve([]);
      return deferred.promise;
    }

    async.parallel({
      // Will try filters on field in document
      onFields: callback => {
        this.filters.testFieldFilters(index, collection, flattenBody, cachedResults)
          .then(rooms => callback(null, rooms))
          .catch(error => callback(error));
      },
      // Will try global filters and add rooms which subscribed on the whole collection
      onGlobals: callback => {
        this.filters.testGlobalsFilters(index, collection, flattenBody, cachedResults)
          .then(rooms => callback(null, rooms))
          .catch(error => callback(error));
      }
    }, (error, filters) => {
      if (error) {
        return deferred.reject(error);
      }

      deferred.resolve(_.uniq(filters.onFields.concat(filters.onGlobals)));
    });

    return deferred.promise;
  };

  /**
   * Removes all references to a given room
   *
   * @param room the room to remove
   * @returns {Promise}
   */
  this.removeRoom = function (room) {
    var
      deferred = q.defer(),
      that = this;

    // Remove roomId reference from both in global room for collection and room with filter on attribute
    async.parallel([
      callback => {
        removeRoomFromGlobal.call(that, room);
        callback();
      },
      callback => {
        removeRoomFromFields.call(that, room)
          .then(() => callback())
          .catch(error => callback(error));
      }
    ], error => {
      if (error) {
        return deferred.reject(error);
      }

      deferred.resolve();
    });

    return deferred.promise;
  };

};

/**
 * Remove the room id from filtersTree for the corresponding global room of this collection
 *
 * @param {Object} room room to remove
 */
function removeRoomFromGlobal (room) {
  var index;

  if (!this.filtersTree[room.index] ||
    !this.filtersTree[room.index][room.collection] ||
    !this.filtersTree[room.index][room.collection].rooms ||
    _.isEmpty(this.filtersTree[room.index][room.collection].rooms)) {
    return false;
  }

  index = this.filtersTree[room.index][room.collection].rooms.indexOf(room.id);
  if (index !== -1) {
    this.filtersTree[room.index][room.collection].rooms.splice(index, 1);
  }

  // Check if we can delete the collection
  if (this.filtersTree[room.index][room.collection].rooms.length === 0 &&
    (!this.filtersTree[room.index][room.collection].fields || Object.keys(this.filtersTree[room.index][room.collection].fields).length === 0)) {
    delete this.filtersTree[room.index][room.collection];
  }

  // Check if we can delete the index
  if (Object.keys(this.filtersTree[room.index]).length === 0) {
    delete this.filtersTree[room.index];
  }
}

/**
 * Remove room from each array in fields in corresponding collection
 *
 * @param room room to remove
 * @returns {Promise}
 */
function removeRoomFromFields (room) {
  var deferred = q.defer();

  if (!room.filters) {
    deferred.resolve();
    return deferred.promise;
  }

  async.each(getFiltersPathsRecursively(room.filters), (filterPath, callback) => {
    removeFilterPath.call(this, room, filterPath);
    callback();
  }, () => deferred.resolve());

  return deferred.promise;
}

/**
 * Flatten an object transform:
 * {
 *  title: "kuzzle",
 *  info : {
 *    tag: "news"
 *  }
 * }
 *
 * Into an object like:
 * {
 *  title: "kuzzle",
 *  info.tag: news
 * }
 *
 * @param {Object} target the object we have to flatten
 * @param {string} [id] of the document, if relevant
 * @returns {Object} the flattened object
 */
function flattenObject(target, id) {
  var
    delimiter = '.',
    output = {};

  if (id) {
    output._id = id;
  }

  function step(object, prev) {
    Object.keys(object).forEach(function(key) {
      var
        value = object[key],
        newKey;

      newKey = prev ? prev + delimiter + key : key;

      if (value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).length) {
        output[newKey] = value;
        return step(value, newKey);
      }

      output[newKey] = value;
    });
  }

  step(target);

  return output;
}

/**
 * Removes recursively any reference to a given filterPath from the filters cache object
 *
 * @private
 * @param {Object} room the room for which was attached the filter
 * @param {string} filterPath the path of the filter in the filters collection
 * @returns {boolean}
 */
function removeFilterPath(room, filterPath) {
  var pathArray = filterPath.split('.'),
    subPath = pathArray[pathArray.length - 1],
    parent = this.filtersTree,
    i,
    index;

  for (i = 0; i < pathArray.length-1; i++) {
    if (parent.fields) {
      parent = parent.fields[pathArray[i]];
    }
    else {
      parent = parent[pathArray[i]];
    }
  }

  // If the current entry is the filter containing the room list and the operator arguments
  if (parent[subPath] && parent[subPath].rooms) {
    index = parent[subPath].rooms.indexOf(room.id);
    if (index > -1) {
      parent[subPath].rooms.splice(index, 1);
    }

    // If other rooms use that filter, we shouldn't delete it
    if (parent[subPath].rooms.length > 0) {
      return false;
    }
  }

  // If it's not a function, test if the entry is not empty
  if (parent.fields && !_.isEmpty(parent.fields[subPath])) {
    return false;
  }
  else if (parent[subPath] && parent[subPath].fields && !_.isEmpty(parent[subPath].fields)) {
    return false;
  }

  // If we are on the index and if there is another collections
  if (subPath === pathArray[0] && !_.isEmpty(parent[subPath])) {
    return false;
  }

  // If there is no another rooms that use this filter, we can remove the filter
  if (parent.fields) {
    delete parent.fields[subPath];
  }
  else {
    delete parent[subPath];
  }

  pathArray.pop();

  if (_.isEmpty(pathArray)) {
    return false;
  }

  return removeFilterPath.call(this, room, pathArray.join('.'));
}

/**
 * Get all paths from a complex nested object filters (with nested and/or)
 * @param filters
 * @returns {Array} list of filter paths
 */
function getFiltersPathsRecursively(filters) {
  var paths = [];

  if (filters.and) {
    paths = paths.concat(getFiltersPathsRecursively(filters.and));
  }

  if (filters.or) {
    filters.or.forEach(subfilter => { paths = paths.concat(getFiltersPathsRecursively(subfilter)); });
  }

  _.each(filters, function (value, key) {
    if (key !== 'and' && key !== 'or') {
      paths.push(key);
    }
  });

  return paths;
}

