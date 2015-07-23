var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto'),
  q = require('q');


module.exports = function Dsl (kuzzle) {

  if (!(this instanceof Dsl)) {
    return new Dsl(kuzzle);
  }

  /**
   *
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter (curried function) with the rooms list
   * @example
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    message : { // -> collection name
   *      subject : { // -> attribute where a filter exists
   *        termSubjectKuzzle : {
   *          rooms: [ 'f45de4d8ef4f3ze4ffzer85d4fgkzm41'], // -> room id that match this filter
   *          fn: function () {} // -> function to execute on collection message, on field subject
   *        }
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};

  this.methods = require('./methods');
  this.methods.dsl = this;

  /**
   *
   * @param {string} roomId
   * @param {string} collection
   * @param {Object} filters
   * @returns {promise} the generated method
   */
  this.addCurriedFunction = function (roomId, collection, filters) {
    var
      deferred = q.defer(),
      filterName,
      privateFilterName;

    if (filters === undefined) {
      deferred.reject('Filters parameter can\'t be undefined');
      return deferred.promise;
    }

    filterName = Object.keys(filters)[0];

    if (filterName === undefined) {
      deferred.reject('Undefined filters');
      return deferred.promise;
    }

    privateFilterName = _.camelCase(filterName);

    if (!methods[privateFilterName]) {
      deferred.reject('Unknown filter with name '+ privateFilterName);
      return deferred.promise;
    }

    return this.methods[privateFilterName](roomId, collection, filters[filterName]);
  };

  /**
   * Test all filters in filtersTree to get the rooms to notify
   *
   * @param {RequestObject|ResponseObject} modelObject
   * @returns {Promise} promise. Resolve a rooms list that we need to notify
   */
  this.testFilters = function (modelObject) {

    kuzzle.emit('filter:start', modelObject);
    var
      deferred = q.defer(),
      cachedResults = {},
      documentKeys =[],
      flattenBody = {},
      rooms = [];

    if (!modelObject.collection) {
      deferred.reject('The data doesn\'t contain a collection');
      return deferred.promise;
    }

    // No filters set for this collection : we return an empty list
    if (!this.filtersTree[modelObject.collection]) {
      deferred.resolve(rooms);
      return deferred.promise;
    }

    // trick to easily parse nested document
    flattenBody = flattenObject(modelObject.data.body);

    // we still need to get the real field keys
    Object.keys(flattenBody).forEach(function(compoundField){
      var key;

      compoundField.split('.').forEach(function(attr){
        if (key) {
          key += '.' + attr;
        }
        else {
          key = attr;
        }
        documentKeys.push(key);
      });
    });

    async.each(documentKeys, function (field, callbackField) {
      var fieldFilters = this.filtersTree[modelObject.collection][field];

      if (!fieldFilters) {
        callbackField();
        return false;
      }

      async.each(Object.keys(fieldFilters), function (functionName, callbackFilter) {
        var
          // Clean function name of potential '.' characters
          cleanFunctionName = functionName.split('.').join(''),
          filter = fieldFilters[functionName],
          cachePath = modelObject.collection + '.' + field + '.' + cleanFunctionName;

        if (cachedResults[cachePath] === undefined) {
          cachedResults[cachePath] = filter.fn(flattenBody);
        }

        if (!cachedResults[cachePath]) {
          callbackFilter();
          return false;
        }

        async.each(
          filter.rooms,
          function (roomId, callbackRoom) {
            var
              room = kuzzle.hotelClerk.rooms[roomId],
              passAllFilters;

            if (!room) {
              callbackRoom('Room not found '+roomId);
              return false;
            }

            passAllFilters = testFilterRecursively(flattenBody, room.filters, cachedResults, 'and');

            if (passAllFilters) {
              rooms = _.uniq(rooms.concat(room.id));
            }

            callbackRoom();
        }.bind(this),
        function (error) {
          callbackFilter(error);
        });
      }.bind(this),
      function (error) {
        callbackField(error);
      });
    }.bind(this), function (error) {

      kuzzle.emit('filter:stop', modelObject);
      if (error) {
        deferred.reject(error);
        return false;
      }

      deferred.resolve(rooms);
    });

    return deferred.promise;
  };


  /**
   * Removes all references to a given room
   *
   * @param room the room to remove
   * @returns {promise}
   */
  this.removeRoom = function (room) {
    var deferred = q.defer();

    async.each(getFiltersPathsRecursively(room.filters), function (filterPath, callback) {
        removeFilterPath.call(this, room, filterPath);
        callback();
    }.bind(this), function (error) {
        deferred.resolve();
      }
    );

    return deferred.promise;
  };

};

/**
 *
 * @param {Object} flattenBody the new flatten document
 * @param {Object} filters filters that we have to test for check if the document match the room
 * @param {Object} cachedResults an object with all already tested curried function for the document
 * @param {String} upperOperand represent the operand (and/or) on the upper level
 * @returns {Boolean} true if the document match a room filters
 */
var testFilterRecursively = function (flattenBody, filters, cachedResults, upperOperand) {
  var bool;

  Object.keys(filters).some(function (key) {
    var subBool;
    if (key === 'or' || key === 'and') {
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
};

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
var flattenObject = function (target) {
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
        return step(value, newKey);
      }

      output[newKey] = value;
    });
  }

  step(target);

  return output;
};

/**
 * Removes recursively any reference to a given filterPath from the filters cache object
 *
 * @private
 * @param {Object} room the room for which was attached the filter
 * @param {string} filterPath the path of the filter in the filters collection
 * @returns {boolean}
 */
var removeFilterPath = function (room, filterPath) {
  var pathArray = filterPath.split('.'),
    subPath = pathArray[pathArray.length - 1],
    parent = this.filtersTree,
    i,
    index;

  for(i = 0; i < pathArray.length-1; i++) {
    parent = parent[pathArray[i]];
  }

  // If the current entry is the curried function (that contains the room list and the function definition)
  if (parent[subPath].rooms !== undefined) {
    index = parent[subPath].rooms.indexOf(room.id);
    if (index > -1) {
      parent[subPath].rooms.splice(index, 1);
    }

    if (parent[subPath].rooms.length > 0) {
      return false;
    }
  }
  // If it's not a function, test if the entry is not empty
  else if (!_.isEmpty(parent[subPath])) {
    return false;
  }

  delete parent[subPath];
  pathArray.pop();

  if (_.isEmpty(pathArray)) {
    return false;
  }

  return removeFilterPath.call(this, room, pathArray.join('.'));
};

/**
 * Get all paths from a complex nested object filters (with nested and/or)
 * @param filters
 * @returns {Array} list of filter paths
 */
var getFiltersPathsRecursively = function (filters) {
  var paths = [];

  if (filters.and) {
    paths = paths.concat(getFiltersPathsRecursively(filters.and));
  }
  if (filters.or) {
    paths = paths.concat(getFiltersPathsRecursively(filters.or));
  }

  _.each(filters, function (value, key) {
    if (key === 'and' || key === 'or') {
      return false;
    }

    paths.push(key);
  });

  return paths;
};


