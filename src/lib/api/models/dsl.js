var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
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
      rooms = [];

    if (!data.collection) {
      deferred.reject('The data doesn\'t contain a collection');
      return deferred.promise;
    }

    if (!kuzzle.hotelClerk.filtersTree[data.collection]) {
      deferred.reject();
      return deferred.promise;
    }

    async.each(Object.keys(data.content), function (field, callbackField) {

      // TODO: test if the field contains a nested field

      var fieldFilters = kuzzle.hotelClerk.filtersTree[data.collection][field];

      if (!fieldFilters) {
        callbackField();
        return false;
      }

      async.each(Object.keys(fieldFilters), function (functionName, callbackFilter) {
        var
          filter = fieldFilters[functionName],
          cachePath = data.collection + '.' + field + '.' + functionName;

        if (cachedResults[cachePath] === undefined) {
          cachedResults[cachePath] = filter.fn(data.content[field]);
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

          passAllFilters = testFilterRecursively(data.content, room.filters, cachedResults);

          if (passAllFilters) {
            rooms = _.uniq(rooms.concat(fieldFilters[functionName].rooms));
          }

          callbackRoom();
        }, function (error) {
          if (error) {
            callbackFilter(error);
            return false;
          }

          callbackFilter();
        });
      }, function (error) {
        if (error) {
          callbackField(error);
          return false;
        }

        callbackField();
      });
    }, function (error) {
      if (error) {
        deferred.reject(error);
        return false;
      }

      kuzzle.hotelClerk.findRoomNamesFromIds(rooms)
        .then(function (roomsNames) {
          deferred.resolve(roomsNames);
        });
    });

    return deferred.promise;
  };

};


var testFilterRecursively = function (content, filters, cachedResults, upperOperand) {
  var bool;

  Object.keys(filters).some(function (key) {
    var subBool;
    if (key === 'or' || key === 'and') {
      subBool = testFilterRecursively(content, filters[key], cachedResults, key);
    }
    else {
      if (cachedResults[key] === undefined) {
        var value = getContentValueFromPath(content, key);
        if (value === undefined) {
          bool = false;

          // we can stop here the loop if the operand is an and
          if (upperOperand === 'and') {
            return true;
          }
        }

        cachedResults[key] = filters[key].fn(value);
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

var getContentValueFromPath = function (content, path) {
  var
    parent = content,
    subPath,
    error = false,
    i;

  path = path.split('.');
  // remove the first element (corresponding to the collection) from path
  path.shift();
  // remove the last element (corresponding to the function name)
  path.pop();

  // Loop inside the object for find the right entry
  for (i = 0; i < path.length-1; i++) {
    if (parent[path[i]] === undefined) {
      error = true;
      break;
    }
    parent = parent[path[i]];
  }

  subPath = path[path.length-1];

  if (error || parent[subPath] === undefined) {
    return undefined;
  }

  return parent[subPath];
};