/**
 * Filters storage and management
 */
var
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  md5 = require('crypto-md5'),
  Methods = require('./methods'),
  operators = require('./operators'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError;

module.exports = function Filters() {
  this.methods = new Methods(this);
  
  /**
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter, with the filters ID list and the corresponding operator arguments
   *
   * @example
   * Example for chat-room-kuzzle (see above)
   *  filtersTree = {
   *    index : { // -> index name
   *      collection : { // -> collection name
   *        globalFilterIds: [] // -> global filters to test each time (for a a subscribe on a whole collection, or if 'not exists' filter (see issue #1 on github)
   *        fields: {
   *          subject : { // -> attribute where a filter exists
   *            termSubjectKuzzle : {
   *              ids: [ 'f45de4d8ef4f3ze4ffzer85d4fgkzm41'], // -> ids of filters using this test
   *              args: {operator, not, field, value}
   *            }
   *          }
   *        }
   *      }
   *    }
   *  }
   */
  this.filtersTree = {};

  /**
   * A simple filterID->{encoded filter} object, used to test documents
   * against filters
   */
  this.filters = {};

  /**
   * Creates new entries in the filtersTree with the provided filters
   *
   * Transforms a filter like this one:
   * {
   *  term: { 'subject': 'kuzzle' }
   * }
   *
   * Into an encoded version:
   * {
   *  subject: { 'termSubjectKuzzle' : { args: {operator, not, field, value}, ids: [] } },
   * }
   *
   * @param {string} filterId
   * @param {string} index
   * @param {string} collection
   * @param {Object} filters
   * @returns {promise}
   */
  this.addSubscription = function (filterId, index, collection, filters) {
    var
      filterName,
      privateFilterName;

    if (filters === undefined) {
      return q.reject(new BadRequestError('Filters parameter can\'t be undefined'));
    }

    filterName = Object.keys(filters)[0];

    if (filterName === undefined) {
      return q.reject(new BadRequestError('Undefined filters'));
    }

    privateFilterName = _.camelCase(filterName);

    if (!this.methods[privateFilterName]) {
      return q.reject(new NotFoundError('Unknown filter with name '+ privateFilterName));
    }

    return this.methods[privateFilterName](filterId, index, collection, filters[filterName])
      .then(formattedFilters => {
        this.filters[filterId] = formattedFilters;
      });
  };

  /**
   * Subscribes a filter ID on a whole collection, adding it in the "Globals" section
   * of the filters tree
   *
   * @param filterId
   * @param index
   * @param collection
   * @returns {promise}
   */
  this.addCollectionSubscription = function (filterId, index, collection) {
    if (!this.filtersTree[index]) {
      this.filtersTree[index] = {};
    }

    if (!this.filtersTree[index][collection]) {
      this.filtersTree[index][collection] = {};
    }

    if (!this.filtersTree[index][collection].globalFilterIds) {
      this.filtersTree[index][collection].globalFilterIds = [];
    }

    if (this.filtersTree[index][collection].globalFilterIds.indexOf(filterId) === -1) {
      this.filtersTree[index][collection].globalFilterIds.push(filterId);
    }

    this.filters[filterId] = {};

    return q();
  };

  /**
   * Low-level method filling the filtersTree with a new user filter
   *
   * @param {String} index the index name
   * @param {String} collection the collection name
   * @param {String} field the field where we need to apply the filter
   * @param {String} operator the operator name that the user wants to execute against the document (defined in operator.js)
   * @param {*} value the value to test on the field
   * @param {String} encodedFunctionName
   * @param {String} filterId
   * @param {Boolean} not
   * @param {Boolean} [inGlobals] true if the filterId must be added in the global filters list (eg for 'not exists' filter)
   * @returns {Object} an object with the path and the new filter
   */
  this.add = function (index, collection, field, operator, value, encodedFunctionName, filterId, not, inGlobals) {
    var
      hashedFunctionName = md5(encodedFunctionName),
      path = index + '.' + collection + '.' + field + '.' + hashedFunctionName;

    if (operators[operator] === undefined) {
      return new BadRequestError(`Operator ${operator} doesn't exist`);
    }

    if (!this.filtersTree[index]) {
      this.filtersTree[index] = {};
    }

    if (!this.filtersTree[index][collection]) {
      this.filtersTree[index][collection] = {};
    }

    if (!this.filtersTree[index][collection].fields) {
      this.filtersTree[index][collection].fields = {};
    }

    if (!this.filtersTree[index][collection].fields[field]) {
      this.filtersTree[index][collection].fields[field] = {};
    }

    if (!this.filtersTree[index][collection].fields[field][hashedFunctionName]) {
      this.filtersTree[index][collection].fields[field][hashedFunctionName] = {
        ids: [],
        args: {operator, not, field, value}
      };
    }

    if (this.filtersTree[index][collection].fields[field][hashedFunctionName].ids.indexOf(filterId) === -1) {
      this.filtersTree[index][collection].fields[field][hashedFunctionName].ids.push(filterId);
    }

    if (inGlobals) {
      if (!this.filtersTree[index][collection].globalFilterIds) {
        this.filtersTree[index][collection].globalFilterIds = [];
      }

      if (this.filtersTree[index][collection].globalFilterIds.indexOf(filterId) === -1) {
        this.filtersTree[index][collection].globalFilterIds.push(filterId);
      }
    }

    return {
      path: path,
      filter: this.filtersTree[index][collection].fields[field][hashedFunctionName]
    };
  };

  /**
   * For a specific document sent by the user,
   * will try saved filter on each attribute in order to retrieve matching filter IDs
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {Object} flattenBody
   * @param {Object} cachedResults
   * @returns {Promise}
   */
  this.testFieldFilters = function (index, collection, flattenBody, cachedResults) {
    var
      deferred = q.defer(),
      matchedIds = [],
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
          cachedResults[cachePath] = evalFilterArguments(filter.args, flattenBody);
        }

        if (!cachedResults[cachePath]) {
          callbackFilter();
          return false;
        }

        // Gets all matching filter IDs
        findMatchingFilters.call(this, filter.ids, flattenBody, cachedResults)
          .then(foundIds => {
            matchedIds = _.uniq(matchedIds.concat(foundIds));
            callbackFilter();
          })
          .catch(error => callbackFilter(error));

      }, error => callbackField(error));

    }, error => {
      if (error) {
        return deferred.reject(error);
      }

      deferred.resolve(matchedIds);
    });

    return deferred.promise;
  };


  /**
   * Test global filters related to whole collections
   *
   * @param {string} index - the index on which the data apply
   * @param {string} collection - the collection on which the data apply
   * @param {Object} flattenBody
   * @param {Object} cachedResults
   * @returns {Promise}
   */
  this.testGlobalsFilters = function (index, collection, flattenBody, cachedResults) {
    /*
     If the entry "globalFilterIds" doesn't exist or is an empty array,
     we don't have a filter to test on every document of this collection
     */
    if (!this.filtersTree[index] ||
      !this.filtersTree[index][collection] ||
      !this.filtersTree[index][collection].globalFilterIds ||
      _.isEmpty(this.filtersTree[index][collection].globalFilterIds)) {

      return q([]);
    }

    return findMatchingFilters.call(this, this.filtersTree[index][collection].globalFilterIds, flattenBody, cachedResults);
  };
};

/**
 * Given an array of filter IDs, returns the filters matching the
 * provided document
 *
 * @param {Array} filterIds
 * @param {Object} flattenBody
 * @param {Object} cachedResults
 * @returns {Promise}
 */
function findMatchingFilters(filterIds, flattenBody, cachedResults) {
  var
    deferred = q.defer(),
    matchedIds = [];

  async.each(filterIds, (id, callback) => {
    var
      filter = this.filters[id],
      passAllFilters;

    if (!filter) {
      return callback(`Filter "${id}" not found`);
    }

    if (_.isEmpty(this.filters[id])) {
      // An empty filter means that the user subscribed on the whole collection
      passAllFilters = true;
    }
    else {
      passAllFilters = testFilterRecursively(flattenBody, this.filters[id], cachedResults, 'and');
    }

    if (passAllFilters) {
      matchedIds = _.uniq(matchedIds.concat(id));
    }

    callback();
  }, (error) => {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve(matchedIds);
  });

  return deferred.promise;
}

/**
 * Parse each of the document properties to test them recursively
 *
 * @param {Object} flattenBody - the currently observed flattened document
 * @param {Object} filters - filters that we have to test for check if the document matches a filter
 * @param {Object} cachedResults - an object with all already tested filters for the document
 * @param {String} upperOperand - represent the operand (and/or) on the upper level
 * @returns {Boolean} true if the document matches a filter
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

  arrayFilters.some(key => {
    var subBool;

    if (filterIsArray) {
      subBool = testFilterRecursively(flattenBody, key, cachedResults, upperOperand);
    }
    else if (key === 'or' || key === 'and') {
      subBool = testFilterRecursively(flattenBody, filters[key], cachedResults, key);
    }
    else {
      if (cachedResults[key] === undefined) {
        cachedResults[key] = evalFilterArguments(filters[key].args, flattenBody);
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
 * Evaluates a flattened document content against the operator
 * arguments stored in the filtersTree
 *
 * @param args - operator arguments
 * @param flattenBody - flattened document content
 * @returns {boolean}
 */
function evalFilterArguments(args, flattenBody) {
  var result = operators[args.operator](args.field, args.value, flattenBody);

  return args.not ? !result : result;
}
