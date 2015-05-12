var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto'),
  q = require('q');


module.exports = function Dsl (kuzzle) {

  this.addCurriedFunction = function (filtersTree, roomId, collection, filters) {

    var
      deferred = q.defer(),
      filterName = Object.keys(filters)[0];

    if (filterName === undefined) {
      deferred.reject('Undefined filters');
      return deferred.promise;
    }

    if (!methods[filterName]) {
      deferred.reject('Unknown filter with name '+filterName);
      return deferred.promise;
    }

    return methods[filterName](filtersTree, roomId, collection, filters[filterName]);
  };

  /**
   * Test all filters in filtersTree for test which room to notify
   *
   * @param {Object} data
   * @returns {Promise} promise. Resolve a rooms list that we need to notify
   */
  this.testFilters = function (data) {
    var
      deferred = q.defer(),
      cachedResults = {},
      flattenContent = {},
      rooms = [];

    if (!data.collection) {
      deferred.reject('The data doesn\'t contain a collection');
      return deferred.promise;
    }

    // No filters set for this collection : we return an empty list
    if (!kuzzle.hotelClerk.filtersTree[data.collection]) {
      deferred.resolve(rooms);
      return deferred.promise;
    }

    // trick for easily parse nested document
    flattenContent = flattenObject(data.content);

    async.each(Object.keys(flattenContent), function (field, callbackField) {

      var fieldFilters = kuzzle.hotelClerk.filtersTree[data.collection][field];

      if (!fieldFilters) {
        callbackField();
        return false;
      }

      async.each(Object.keys(fieldFilters), function (functionName, callbackFilter) {
        var
          // Clean the function name because can contains '.' and we don't want it into the function name
          cleanFunctionName = functionName.split('.').join(''),
          filter = fieldFilters[functionName],
          cachePath = data.collection + '.' + field + '.' + cleanFunctionName;

        if (cachedResults[cachePath] === undefined) {
          cachedResults[cachePath] = filter.fn(flattenContent);
        }

        if (!cachedResults[cachePath]) {
          callbackFilter();
          return false;
        }

        async.each(filter.rooms, function (roomId, callbackRoom) {
          var
            room = kuzzle.hotelClerk.rooms[roomId],
            passAllFilters;

          if (!room) {
            callbackRoom('Room not found');
            return false;
          }

          passAllFilters = testFilterRecursively(flattenContent, room.filters, cachedResults, 'and');

          if (passAllFilters) {
            rooms = _.uniq(rooms.concat(fieldFilters[functionName].rooms));
          }

          callbackRoom();
        }, function (error) {
          callbackFilter(error);
        });
      }, function (error) {
        callbackField(error);
      });
    }, function (error) {
      if (error) {
        deferred.reject(error);
        return false;
      }

      deferred.resolve(rooms);
    });

    return deferred.promise;
  };

};

/**
 *
 * @param {Object} flattenContent the new flatten document
 * @param {Object} filters filters that we have to test for check if the document match the room
 * @param {Object} cachedResults an object with all already tested curried function for the document
 * @param {String} upperOperand represent the operand (and/or) on the upper level
 * @returns {Boolean} true if the document match a room filters
 */
var testFilterRecursively = function (flattenContent, filters, cachedResults, upperOperand) {
  var bool;

  Object.keys(filters).some(function (key) {
    var subBool;
    if (key === 'or' || key === 'and') {
      subBool = testFilterRecursively(flattenContent, filters[key], cachedResults, key);
    }
    else {
      if (cachedResults[key] === undefined) {
        cachedResults[key] = filters[key].fn(flattenContent);
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

      // if the result of the current filter is false and if the upper operand is an 'and', we can't stop here and bool is false
      return !bool;
    }
    if (upperOperand === 'or') {
      if (bool === undefined) {
        bool = subBool;
      }
      else {
        bool = bool || subBool;
      }

      // if the result of the current filter is true and if the upper operand is an 'or', we can't stop here and bool is true
      return bool;
    }

  });

  return bool;
};

/**
 * Retrieve the value for a specific field in a document
 *
 * @param {Object} content the document where we have to retrieve the field value
 * @param {String} path the path to the field
 * @returns {*} the value in field or undefined if the document has not this field
 */
var getContentValueFromPath = function (content, path) {
  var pathArray = path.split('.');

  // remove the first element (corresponding to the collection) from path
  pathArray.shift();
  // remove the last element (corresponding to the function name)
  pathArray.pop();

  return content[pathArray.join('.')];
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
 * @param {Object} target the object that we have to flatten
 * @returns {Object} the flatten object
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