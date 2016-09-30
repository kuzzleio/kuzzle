var
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  glob = require('glob'),
  _ = require('lodash'),
  path = require('path'),
  collectionSpecificationProperties = ['strict', 'fields', 'validators'],
  fieldSpecificationProperties = ['mandatory', 'type', 'default_value', 'description', 'multivalued', 'type_options'],
  mandatoryFieldSpecificationProperties = ['mandatory', 'type'],
  multivaluedProperties = ['value', 'minCount', 'maxCount'],
  Promise = require('bluebird'),
  Dsl = require('../dsl');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Validation (kuzzle) {
  this.kuzzle = kuzzle;
  /** @type {...ValidationType} */
  this.types = {};
  /** @type {DocumentSpecification} */
  this.specification = {};
  this.dsl = new Dsl();
}

/**
 * Walks through the ./types directory and loads all types found in it
 */
Validation.prototype.init = function () {
  var
    typeFiles = glob.sync(path.join(__dirname, 'types', '*.js')),
    ValidationType;

  typeFiles.forEach(typeFile => {
    try {
      ValidationType = require(typeFile);
    }
    catch (error) {
      throw new InternalError(`The type file ${typeFile} can not be loaded properly.`);
    }

    this.addType(new ValidationType());
  });
};

/**
 * @param {RequestObject} requestObject
 * returns {Promise}
 */
Validation.prototype.validate = function (requestObject) {
  console.log(requestObject);
  // TODO
};

Validation.prototype.curateSpecification = function () {
  var
    promises = [],
    curatedCollectionSpecification,
    specification = this.kuzzle.config.validation;

  _.each(specification, (indexSpecification, indexName) => {
    _.each(indexSpecification, (collectionSpecification, collectionName) => {
      var promise = new Promise((resolve) => {
        this.curateCollectionSpecification(indexName, collectionName, collectionSpecification)
          .then(curatedSpecification => {
            curatedCollectionSpecification = curatedSpecification;

            if (!specification[indexName]) {
              specification[indexName] = {};
            }

            specification[indexName][collectionName] = curatedCollectionSpecification;

            this.kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${indexName} / ${collectionName} has been loaded`);
            resolve({});
          })
          .catch(error => {
            this.kuzzle.pluginsManager.trigger('log:error', `Specification for the collection ${collectionName} triggered an error`);
            this.kuzzle.pluginsManager.trigger('log:error', `Error: ${error.message}`);
            resolve({});
          });
      });

      promises.push(promise);
    });
  });

  return Promise
    .all(promises)
    .then(() => {
      this.kuzzle.pluginsManager.trigger('log:info', 'All validation specifications have been treated.');
      this.specification = specification;
    });
};

Validation.prototype.validateSpecification = function (indexName, collectionName, collectionSpecification) {
  return new Promise (resolve => {
    this
      .curateCollectionSpecification(indexName,collectionName,collectionSpecification, true)
      .then(() => {
        resolve(true);
      })
      .catch(() => {
        resolve(false);
      });
  });
};


/**
 * @param {string} indexName
 * @param {string} collectionName
 * @param {CollectionSpecification} collectionSpecification
 * @param {boolean} dryRun
 * @returns {CollectionSpecification}
 */
Validation.prototype.curateCollectionSpecification = function (indexName, collectionName, collectionSpecification, dryRun) {
  dryRun = dryRun || false;

  return new Promise((resolve, reject) => {
    var treatedSpecification = {
      strict: collectionSpecification.strict || false,
      fields: {},
      validators: []
    };

    Object.keys(collectionSpecification).forEach(propertyName => {
      if (collectionSpecificationProperties.indexOf(propertyName) === -1) {
        reject(new InternalError(`${propertyName} is not a valid collection specification property.`));
      }
    });

    if (collectionSpecification.fields) {
      Object.keys(collectionSpecification.fields).forEach(fieldName => {
        try {
          treatedSpecification.fields[fieldName] = this.curateFieldSpecification(collectionSpecification.fields[fieldName]);
        }
        catch (error) {
          this.kuzzle.pluginsManager.trigger('log:error', error);
          reject(new InternalError(`Specification for the field ${fieldName} triggered an error`));
        }
      });
    }

    if (collectionSpecification.validators && Array.isArray(collectionSpecification.validators)) {
      this
        .curateValidatorFilter(indexName, collectionName, collectionSpecification.validators, dryRun)
        .then(validators => {
          treatedSpecification.validators = validators;

          resolve(treatedSpecification);
        })
        .catch(error => {
          this.kuzzle.pluginsManager.trigger('log:error', error);
          reject(new InternalError(`Validator specification of the collection triggered an error : ${JSON.stringify(collectionSpecification.validators)}`));
        });
    }
    else {
      resolve(treatedSpecification);
    }
  });
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @returns {FieldSpecification}
 */
Validation.prototype.curateFieldSpecification = function (fieldSpecification) {
  /** @type {FieldSpecification} */
  var treatedSpecification;

  Object.keys(fieldSpecification).forEach(propertyName => {
    if (fieldSpecificationProperties.indexOf(propertyName) === -1) {
      throw new InternalError(`${propertyName} is not a valid field specification property.`);
    }
  });

  mandatoryFieldSpecificationProperties.forEach(propertyName => {
    if (!fieldSpecification.hasOwnProperty(propertyName)) {
      throw new InternalError(`${propertyName} is a mandatory field specification property.`);
    }
  });

  if (!this.types[fieldSpecification.type]) {
    throw new InternalError(`${fieldSpecification.type} is not a recognized type.`);
  }

  if (fieldSpecification.multivalued) {
    Object.keys(fieldSpecification.multivalued).forEach(propertyName => {
      if (multivaluedProperties.indexOf(propertyName) === -1) {
        throw new InternalError(`${propertyName} is not a valid multivalued field specification property.`);
      }
    });
  }

  treatedSpecification = this.types[fieldSpecification.type].validateFieldSpecification(fieldSpecification);

  if (typeof treatedSpecification === 'boolean') {
    if (treatedSpecification) {
      return fieldSpecification;
    }

    throw new InternalError(`Field of type ${fieldSpecification.type} is not specified properly`);
  }

  return treatedSpecification;
};

/**
 * @param {string} indexName
 * @param {string} collectionName
 * @param {*} validatorFilter
 * @param {boolean} dryRun
 * @returns {Promise}
 */
Validation.prototype.curateValidatorFilter = function (indexName, collectionName, validatorFilter, dryRun) {
  var
    promise,
    query = {
      bool: {
        must: validatorFilter
      }
    },
    filterId = this.dsl.createFilterId(indexName, collectionName, query),
    filterIds = this.dsl.getFilterIds(indexName, collectionName);

  promise = this.dsl.register(filterId, indexName, collectionName, query);

  if (dryRun && filterIds.indexOf(filterId) === -1) {
    promise.then(() => {
      return this.dsl.remove(filterId);
    });
  }

  return promise;
};

/**
 * @param {ValidationType} validationType
 * @throws {PluginImplementationError}
 */
Validation.prototype.addType = function (validationType) {
  if (!validationType.typeName) {
    throw new PluginImplementationError('The typeName property must be defined in the validation type object.');
  }

  if (!validationType.validate || typeof validationType.validate !== 'function') {
    throw new PluginImplementationError(`The type ${validationType.typeName} must implement the function 'validate'`);
  }

  if (!validationType.validateFieldSpecification || typeof validationType.validateFieldSpecification !== 'function') {
    throw new PluginImplementationError(`The type ${validationType.typeName} must implement the function 'validateFieldSpecification'`);
  }

  if (this.types[validationType.typeName]) {
    throw new PluginImplementationError(`The type ${validationType.typeName} is already defined.`);
  }

  this.types[validationType.typeName] = validationType;
};

module.exports = Validation;