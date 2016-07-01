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

/**
 * @constructor
 */
function Filters () {
  this.methods = new Methods(this);
  
  /**
   * A tree where we have an entry by collection, an entry by tag and
   * an entry by filter part.
   *
   * A filter part is a filter component potentially shared by multiple filters.
   * A filter part references the filter IDs using this filter part, and the
   * operator arguments used to test this part against documents data.
   *
   * @example
   * Example:
   *  filtersTree = {
   *    index : { // -> index name
   *      collection : { // -> collection name
   *        globalFilterIds: [] // -> global filters to test each time (for a a subscribe on a whole collection, or if 'not exists' filter (see issue #1 on github)
   *        fields: {
   *          encodedFieldName : { // -> attribute where a filter part exists, encoded with MD5
   *            encodedFieldFilter : { // -> field+filter part name, encoded with MD5
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
   * A simple filterID->filter object, used to keep filter references
   * and to test documents against filters
   *
   * Format:
   * {
   *   filterId: {
   *     index,
   *     collection,
   *     encodedFilters: {}
   *   }
   * }
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
   *  subject: { 'encodedFieldFilter' : { args: {operator, not, field, value}, ids: [] } },
   * }
   *
   * @param {string} filterId
   * @param {string} index
   * @param {string} collection
   * @param {Object} filters
   * @returns {promise} resolves to the filter unique ID
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
      .then(response => {
        this.filters[filterId] = {index, collection, encodedFilters: response.filter};
        return { diff: response.diff, filter: filterId };
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
    var 
      changed = false,
      diff = {ftG: {
        i: index,
        c: collection,
        fi: filterId
      }};

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
      changed = true;
      this.filtersTree[index][collection].globalFilterIds.push(filterId);
    }

    this.filters[filterId] = {index, collection, encodedFilters: {}};

    return q({diff: changed && [diff], filter: filterId});
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
      hashedFieldName = md5(field),
      changed = false,
      diff,
      path = index + '.' + collection + '.' + hashedFieldName + '.' + hashedFunctionName;

    diff = { ft: {
      i: index,
      c: collection,
      f: field,
      o: operator,
      v: value,
      fn: encodedFunctionName,
      fi: filterId,
      n: not,
      g: inGlobals
    }};

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

    if (!this.filtersTree[index][collection].fields[hashedFieldName]) {
      this.filtersTree[index][collection].fields[hashedFieldName] = {};
    }

    if (!this.filtersTree[index][collection].fields[hashedFieldName][hashedFunctionName]) {
      this.filtersTree[index][collection].fields[hashedFieldName][hashedFunctionName] = {
        ids: [],
        args: {operator, not, field, value}
      };
      changed = true;
    }

    if (this.filtersTree[index][collection].fields[hashedFieldName][hashedFunctionName].ids.indexOf(filterId) === -1) {
      this.filtersTree[index][collection].fields[hashedFieldName][hashedFunctionName].ids.push(filterId);
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
      diff: changed && diff,
      path: path,
      filter: this.filtersTree[index][collection].fields[hashedFieldName][hashedFunctionName]
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
      var
        fieldFilters,
        hashedFieldName = md5(field);

      if (!this.filtersTree[index] ||
        !this.filtersTree[index][collection] ||
        !this.filtersTree[index][collection].fields ||
        !this.filtersTree[index][collection].fields[hashedFieldName]) {
        callbackField();
        return false;
      }

      fieldFilters = this.filtersTree[index][collection].fields[hashedFieldName];

      // For each attribute, loop on all saved filters
      async.each(Object.keys(fieldFilters), (functionName, callbackFilter) => {
        var
        // Clean function name of potential '.' characters
          cleanFunctionName = functionName.split('.').join(''),
          filter = fieldFilters[functionName],
          cachePath = index + '.' + collection + '.' + hashedFieldName + '.' + cleanFunctionName;

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

  /**
   * Removes filters corresponding to the provided filter ID from
   * the filters tree
   *
   * @param {string} filterId
   * @returns {Promise<T>}
   */
  this.removeFilter = function (filterId) {
    removeGlobalFilter.call(this, filterId);
    return removeFieldFilter.call(this, filterId);
  };

  /**
   * Returns all filters IDs registered on an index-collection pair
   *
   * @param index
   * @param collection
   * @returns {Array} Array of matching filter IDs
   */
  this.getFilterIds = function (index, collection) {
    var
      ids = [],
      linkTree;

    if (!this.filtersTree[index] || !this.filtersTree[index][collection]) {
      return ids;
    }

    linkTree = this.filtersTree[index][collection];

    if (linkTree.globalFilterIds) {
      ids = linkTree.globalFilterIds;
    }

    if (linkTree.fields) {
      Object.keys(linkTree.fields).forEach(field => {
        Object.keys(linkTree.fields[field]).forEach(filterPart => {
          ids = ids.concat(linkTree.fields[field][filterPart].ids);
        });
      });
    }

    return _.uniq(ids);
  };
}

/**
 * Removes a global filter
 *
 * @this Filters
 * @param {string} filterId of the filter to remove
 */
function removeGlobalFilter (filterId) {
  var
    index,
    filters = this.filters[filterId],
    treeLink;

  if (!filters || _.isEmpty(this.filtersTree[filters.index][filters.collection].globalFilterIds)) {
    return false;
  }

  treeLink = this.filtersTree[filters.index][filters.collection];
  index = treeLink.globalFilterIds.indexOf(filterId);

  if (index !== -1) {
    treeLink.globalFilterIds.splice(index, 1);

    // Check if we can delete the collection
    if (treeLink.globalFilterIds.length === 0 &&
      (!treeLink.fields || Object.keys(treeLink.fields).length === 0)) {
      delete this.filtersTree[filters.index][filters.collection];

      // Check if we can delete the index
      if (Object.keys(this.filtersTree[filters.index]).length === 0) {
        delete this.filtersTree[filters.index];
      }
    }
  }
}

/**
 * Removes a non-global filter
 *
 * @this Filters
 * @param {string} filterId of the filter to remove
 * @returns {Promise}
 */
function removeFieldFilter (filterId) {
  var
    deferred = q.defer(),
    filters = this.filters[filterId];

  if (!filters || !filters.encodedFilters) {
    deferred.resolve();
    return deferred.promise;
  }

  async.each(getFiltersPathsRecursively(filters.encodedFilters), (filterPath, callback) => {
    removeFilterPath.call(this, filterId, filterPath);
    callback();
  }, deferred.makeNodeResolver());

  return deferred.promise;
}

/**
 * Given an array of filter IDs, returns the filters matching the
 * provided document
 *
 * @this Filters
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

    if (_.isEmpty(this.filters[id].encodedFilters)) {
      // An empty filter means that the user subscribed on the whole collection
      passAllFilters = true;
    }
    else {
      passAllFilters = testFilterRecursively(flattenBody, this.filters[id].encodedFilters, cachedResults, 'and');
    }

    if (passAllFilters) {
      matchedIds.push(id);
    }

    callback();
  }, (error) => {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve(_.uniq(matchedIds));
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

/**
 * Removes recursively any reference to a given filterPath from the filters cache object
 *
 * @private
 * @param {string} filterId of the filter to remove
 * @param {string|Array} filterPath - the path of the filter in the filters collection
 * @returns {boolean}
 */
function removeFilterPath(filterId, filterPath) {
  var pathArray = Array.isArray(filterPath) ? filterPath : filterPath.split('.'),
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

  // If the current entry is the filter level, refering to filter IDs using a filter part
  if (parent[subPath] && parent[subPath].ids) {
    index = parent[subPath].ids.indexOf(filterId);

    if (index > -1) {
      parent[subPath].ids.splice(index, 1);
    }

    // If other filters use this filter part, we shouldn't delete it
    if (parent[subPath].ids.length > 0) {
      return false;
    }
  }

  // If we're at fields level and there are still fields stored
  if (parent.fields && !_.isEmpty(parent.fields[subPath])) {
    return false;
  }
  else if (parent[subPath] && parent[subPath].fields && !_.isEmpty(parent[subPath].fields)) {
    return false;
  }

  // If we're at collection level and there are still global filters stored
  if (parent[subPath] && parent[subPath].globalFilterIds && parent[subPath].globalFilterIds.length > 0) {
    return false;
  }

  // If we are at index level and there is other collections stored
  if (subPath === pathArray[0] && !_.isEmpty(parent[subPath])) {
    return false;
  }

  /*
   If there is no another filter using this filter part, we can remove it,
   unless there is still global filters in it
   */
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

  return removeFilterPath.call(this, filterId, pathArray);
}

/**
 * Get all paths from a complex nested object filters (with nested and/or)
 * @param {object} filters
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

module.exports = Filters;
