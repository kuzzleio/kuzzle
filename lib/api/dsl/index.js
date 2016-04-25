var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  BadRequestError = require('../core/errors/badRequestError'),
  NotFoundError = require('../core/errors/notFoundError'),
  async = require('async'),
  _ = require('lodash'),
  q = require('q');


module.exports = function Dsl (kuzzle) {
  /**
   *
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter (curried function) with the rooms list
   * @example
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    app : { // -> index name
   *      message : { // -> collection name
   *        rooms: [] // -> global room to test each time (for a a subscribe on a whole collection, or if 'not exists' filter (see issue #1 on github)
   *        fields: {
   *          subject : { // -> attribute where a filter exists
   *            termSubjectKuzzle : {
   *              rooms: [ 'f45de4d8ef4f3ze4ffzer85d4fgkzm41'], // -> room id that match this filter
   *              fn: function () {} // -> function to execute on collection message, on field subject
   *            }
   *          }
   *        }
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};

  this.methods = require('./methods');
  this.methods.dsl = this;
  this.kuzzle = kuzzle;

  /**
   * Create a currified function with methods and operators. Will create a new filter on a specific field for a collection
   * @param {string} roomId
   * @param {string} index
   * @param {string} collection
   * @param {Object} filters
   * @returns {promise} the generated method
   */
  this.addCurriedFunction = function (roomId, index, collection, filters) {
    var
      deferred = q.defer(),
      filterName,
      privateFilterName;

    if (filters === undefined) {
      deferred.reject(new BadRequestError('Filters parameter can\'t be undefined'));
      return deferred.promise;
    }

    filterName = Object.keys(filters)[0];

    if (filterName === undefined) {
      deferred.reject(new BadRequestError('Undefined filters'));
      return deferred.promise;
    }

    privateFilterName = _.camelCase(filterName);

    if (!methods[privateFilterName]) {
      deferred.reject(new NotFoundError('Unknown filter with name '+ privateFilterName));
      return deferred.promise;
    }

    return this.methods[privateFilterName](roomId, index, collection, filters[filterName]);
  };

  /**
   * Subscribe a roomId on the whole collection
   *
   * @param roomId
   * @param index
   * @param collection
   */
  this.addCollectionSubscription = function (roomId, index, collection) {
    var
      deferred = q.defer();

    if (!this.filtersTree[index]) {
      this.filtersTree[index] = {};
    }

    if (!this.filtersTree[index][collection]) {
      this.filtersTree[index][collection] = {};
    }

    if (!this.filtersTree[index][collection].rooms) {
      this.filtersTree[index][collection].rooms = [];
    }

    if (this.filtersTree[index][collection].rooms.indexOf(roomId) === -1) {
      this.filtersTree[index][collection].rooms.push(roomId);
    }

    deferred.resolve();
    return deferred.promise;
  };

  /**
   * Test data against filters in filtersTree to get the rooms to notify
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {string} id - if the data refers to a document, the document unique ID
   * @param {Object} data to test filters on
   * @returns {Promise} Resolve a rooms list that we need to notify
   */
  this.testFilters = function (index, collection, id, data) {
    var
      deferred = q.defer(),
      cachedResults = {},
      flattenBody = flattenObject(data),
      that = this;

    if (!index) {
      deferred.reject(new NotFoundError('The data doesn\'t contain an index'));
      return deferred.promise;
    }

    if (!collection) {
      deferred.reject(new NotFoundError('The data doesn\'t contain a collection'));
      return deferred.promise;
    }

    // No filters set for this index : we return an empty list
    if (!this.filtersTree[index] || !this.filtersTree[index][collection]) {
      deferred.resolve([]);
      return deferred.promise;
    }

    // add the _id in flattenBody allowing to filter on it
    flattenBody._id = id;

    async.parallel({
      // Will try filters on field in document
      onFields: function (callback) {
        testFieldFilters.call(that, index, collection, flattenBody, cachedResults)
          .then(rooms => callback(null, rooms))
          .catch(error => callback(error));
      },
      // Will try global filters and add rooms which subscribed on the whole collection
      onGlobals: function (callback) {
        testGlobalsFilters.call(that, index, collection, flattenBody, cachedResults)
          .then(rooms => callback(null, rooms))
          .catch(error => callback(error));
      }
    }, (error, rooms) => {
      if (error) {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        deferred.reject(error);
        return false;
      }

      deferred.resolve(_.uniq(rooms.onFields.concat(rooms.onGlobals)));
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
 * For a specific document sent by the user, will try saved filter on each attribute in order to retrieve roomId to notify
 *
 * @param {string} index - the index on which the data apply
 * @param {string} collection - the collection on which the data apply
 * @param {Object} flattenBody
 * @param {Object} cachedResults
 * @returns {Promise}
 */
function testFieldFilters(index, collection, flattenBody, cachedResults) {
  var
    deferred = q.defer(),
    rooms = [],
    documentKeys = [];

  /*
    The flattenBody object contains complex keys like 'key1.key2.key3...keyn'
    We need to list each key level to test filters on each one of these:
      key1
      key1.key2
      key1.key2.key3
      ...
   */
  Object.keys(flattenBody).forEach(function(compoundField) {
    var key;
    compoundField.split('.').forEach(function(attr) {

      if (key) {
        key += '.' + attr;
      }
      else {
        key = attr;
      }
      documentKeys.push(key);
    });
  });
  
  // Loop on all document attributes
  async.each(documentKeys, (field, callbackField) => {
    var fieldFilters;

    if (!this.filtersTree[index] ||
      !this.filtersTree[index][collection] ||
      !this.filtersTree[index][collection].fields ||
      !this.filtersTree[index][collection].fields[field]) {
      callbackField();
      return false;
    }

    fieldFilters = this.filtersTree[index][collection].fields[field];

    // For each attribute, loop on all saved filters
    async.each(Object.keys(fieldFilters), (functionName, callbackFilter) => {
      var
      // Clean function name of potential '.' characters
        cleanFunctionName = functionName.split('.').join(''),
        filter = fieldFilters[functionName],
        cachePath = index + '.' + collection + '.' + field + '.' + cleanFunctionName;

      if (cachedResults[cachePath] === undefined) {
        cachedResults[cachePath] = filter.fn(flattenBody);
      }

      if (!cachedResults[cachePath]) {
        callbackFilter();
        return false;
      }

      // For each rooms of this filter we'll test which one must be notified
      testRooms.call(this, filter.rooms, flattenBody, cachedResults)
        .then(function (roomsToNotify) {
          rooms = _.uniq(rooms.concat(roomsToNotify));
          callbackFilter();
        })
        .catch(function (error) {
          callbackFilter(error);
        });

    }, error => callbackField(error));

  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    deferred.resolve(rooms);
  });

  return deferred.promise;
}

/**
 * For a given room array and document, will test which room pass filters
 *
 * @param {Array} roomsToTest
 * @param {Object} flattenBody
 * @param {Object} cachedResults
 * @returns {Promise}
 */
function testRooms(roomsToTest, flattenBody, cachedResults) {
  var
    deferred = q.defer(),
    roomsToNotify = [];

  async.each(roomsToTest, function (roomId, callback) {
    var
      room = this.kuzzle.hotelClerk.rooms[roomId],
      passAllFilters;

    if (!room) {
      callback('Room not found ' + roomId);
      return false;
    }

    if (!room.filters) {
      // Filters can be null if the room is subscribed on the whole collection
      passAllFilters = true;
    }
    else {
      passAllFilters = testFilterRecursively(flattenBody, room.filters, cachedResults, 'and');
    }

    if (passAllFilters) {
      roomsToNotify = _.uniq(roomsToNotify.concat(room.id));
    }

    callback();
  }.bind(this), function (error) {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve(roomsToNotify);
  });

  return deferred.promise;
}

/**
 * Test room related to a collection and not to a specific filter
 *
 * @param {string} index - the index on which the data apply
 * @param {string} collection - the collection on which the data apply
 * @param {Object} flattenBody
 * @param {Object} cachedResults
 * @returns {Promise}
 */
function testGlobalsFilters(index, collection, flattenBody, cachedResults) {
  /*
  If the entry "rooms" doesn't exist or is an empty array,
  we don't have a filter to test on every document of this collection
   */
  if (!this.filtersTree[index] ||
    !this.filtersTree[index][collection] ||
    !this.filtersTree[index][collection].rooms ||
    _.isEmpty(this.filtersTree[index][collection].rooms)) {

    return q([]);
  }

  return testRooms.call(this, this.filtersTree[index][collection].rooms, flattenBody, cachedResults);
}

/**
 *
 * @param {Object} flattenBody the new flatten document
 * @param {Object} filters filters that we have to test for check if the document match the room
 * @param {Object} cachedResults an object with all already tested curried function for the document
 * @param {String} upperOperand represent the operand (and/or) on the upper level
 * @returns {Boolean} true if the document match a room filters
 */
function testFilterRecursively(flattenBody, filters, cachedResults, upperOperand) {
  var
    bool,
    arrayFilters = filters,
    filterIsArray = true;

  if (!Array.isArray(filters)) {
    arrayFilters = Object.keys(filters);
    filterIsArray = false;
  }

  arrayFilters.some(function (key) {
    var subBool;

    if (filterIsArray) {
      subBool = testFilterRecursively(flattenBody, key, cachedResults, upperOperand);
    }
    else if (key === 'or' || key === 'and') {
      subBool = testFilterRecursively(flattenBody, filters[key], cachedResults, key);
    }
    else {
      if (cachedResults[key] === undefined) {
        cachedResults[key] = filters[key].fn(flattenBody);
      }

      subBool = cachedResults[key];
    }

    if (upperOperand === undefined) {
      bool = subBool;
      return false;
    }

    if (upperOperand === 'and') {
      if (bool === undefined) {
        bool = subBool;
      }
      else {
        bool = bool && subBool;
      }

      // AND operand: exit the loop at the first FALSE filter
      return !bool;
    }

    if (upperOperand === 'or') {
      if (bool === undefined) {
        bool = subBool;
      }
      else {
        bool = bool || subBool;
      }

      // OR operand: exit the loop at the first TRUE filter
      return bool;
    }
  });

  return bool;
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
 * @returns {Object} the flattened object
 */
function flattenObject(target) {
  var
    delimiter = '.',
    output = {};

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

  // If the current entry is the curried function (that contains the room list and the function definition)
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
