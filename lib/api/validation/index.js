var
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  glob = require('glob'),
  _ = require('lodash'),
  path = require('path'),
  collectionSpecProperties = ['strict', 'fields', 'validators'],
  fieldSpecProperties = ['mandatory', 'type', 'default_value', 'description', 'multivalued', 'type_options'],
  mandatoryFieldSpecProperties = ['type'],
  multivaluedProperties = ['value', 'minCount', 'maxCount'],
  Promise = require('bluebird'),
  Dsl = require('../dsl'),
  typeAllowsChildren = [],
  defaultFieldSpecification = {
    'mandatory': false,
    'multivalued': {
      value: false
    }
  };

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Validation (kuzzle) {
  /** @type {Kuzzle} */
  this.kuzzle = kuzzle;

  /** @type {...ValidationType} */
  this.types = {};

  /** @type {DocumentSpecification} */
  this.specification = {};

  /** @type {Dsl} */
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
  var
    index = requestObject.index,
    collection = requestObject.collection,
    collectionSpec,
    documentBody;

  return new Promise((resolve, reject) => {
    if (!this.specification[index] || !this.specification[index][collection]) {
      resolve(requestObject);
    }

    if (requestObject.controller === 'write' && requestObject.action === 'update') {
      // TODO get and merge full document
    }

    /** @type {CollectionSpecification} */
    collectionSpec = this.specification[index][collection];
    documentBody = requestObject.data.body;

    try {
      if (collectionSpec.fields) {
        this.recurseFieldValidation(documentBody, collectionSpec.fields.children, collectionSpec.strict);
      }

      console.log(requestObject);

      if (collectionSpec.validators) {
        return this.dsl.test(index, collection, documentBody)
          .then(filters => {
            var result = false;

            filters.forEach(filter => {
              if (filter === collectionSpec.validators) {
                result = true;
                return false;
              }
            });

            if (!result) {
              return reject(new BadRequestError('The document does not match validation filters'));
            }

            return resolve(requestObject);
          });
      }

      return resolve(requestObject);
    }
    catch (error) {
      return reject(error);
    }
  });
};

Validation.prototype.recurseFieldValidation = function (documentSubset, collectionSpecSubset, strictness) {
  if (strictness) {
    if (!checkAllowedProperties(documentSubset, Object.keys(collectionSpecSubset))) {
      throw new BadRequestError('This field is strict and can not add new fields');
    }
  }

  Object.keys(collectionSpecSubset).forEach(fieldName => {
    var
      nestedStrictness,
      field = collectionSpecSubset[fieldName],
      fieldValues;

    if (field.mandatory && (!documentSubset.hasOwnProperty(fieldName) || typeof documentSubset[fieldName] === 'undefined' || documentSubset[fieldName] === null)) {
      throw new BadRequestError(`The field ${field.path.join('.')} is mandatory.`);
    }

    if (documentSubset.hasOwnProperty(fieldName) && typeof documentSubset[fieldName] !== 'undefined') {
      if (field.multivalued.value) {
        if (!Array.isArray(documentSubset[fieldName])) {
          throw new BadRequestError(`The field ${field.path.join('.')} is a multivalued field, scalar value provided.`);
        }

        if (field.multivalued.hasOwnProperty('minCount') && documentSubset[fieldName].length < field.multivalued.minCount || field.multivalued.hasOwnProperty('maxCount') && documentSubset[fieldName].length > field.multivalued.maxCount) {
          throw new BadRequestError(`The multivalued field ${field.path.join('.')} has not the expected value count.`);
        }

        fieldValues = documentSubset[fieldName];
      }
      else {
        if (Array.isArray(documentSubset[fieldName])) {
          throw new BadRequestError(`The field ${field.path.join('.')} is not a multivalued field, multiple values provided.`);
        }

        fieldValues = [documentSubset[fieldName]];
      }

      if (this.types[field.type].allowChildren) {
        nestedStrictness = this.types[field.type].getStrictness(field, strictness);
      }

      fieldValues.forEach(fieldValue => {
        if (!this.types[field.type].validate(field, fieldValue)) {
          throw new BadRequestError(`The field ${field.path.join('.')} has not the expected format.`);
        }

        if (this.types[field.type].allowChildren && typeof fieldValue === 'object' && field.children) {
          this.recurseFieldValidation(documentSubset[fieldName], field.children, nestedStrictness);
        }
      });
    }
    else if (field.default_value) {
      documentSubset[fieldName] = field.default_value;
    }
  });
};

/**
 * @returns {Promise.<T>}
 */
Validation.prototype.curateSpecification = function () {
  var
    promises = [],
    curatedCollectionSpecification,
    specification = {};

  _.each(this.kuzzle.config.validation, (indexSpec, indexName) => {
    _.each(indexSpec, (collectionSpec, collectionName) => {
      var promise = new Promise((resolve) => {
        this.curateCollectionSpecification(indexName, collectionName, collectionSpec)
          .then(curatedSpec => {
            curatedCollectionSpecification = curatedSpec;

            if (!specification[indexName]) {
              specification[indexName] = {};
            }

            specification[indexName][collectionName] = curatedCollectionSpecification;

            this.kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${indexName} / ${collectionName} has been loaded.`);
            return resolve({});
          })
          .catch(error => {
            this.kuzzle.pluginsManager.trigger('log:error', `Specification for the collection ${collectionName} triggered an error`);
            this.kuzzle.pluginsManager.trigger('log:error', `Error: ${error.message}`);
            return resolve({});
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

/**
 * @param {string} indexName
 * @param {string} collectionName
 * @param {CollectionSpecification} collectionSpec
 */
Validation.prototype.validateSpecification = function (indexName, collectionName, collectionSpec) {
  // We make a deep clone to avoid side effects
  var specification = JSON.parse(JSON.stringify(collectionSpec));

  return new Promise (resolve => {
    this
      .curateCollectionSpecification(indexName, collectionName, specification, true)
      .then(() => {
        return resolve(true);
      })
      .catch(() => {
        return resolve(false);
      });
  });
};


/**
 * @param {string} indexName
 * @param {string} collectionName
 * @param {CollectionSpecification} collectionSpec
 * @param {boolean} dryRun
 * @returns {CollectionSpecification}
 * @rejects InternalError
 */
Validation.prototype.curateCollectionSpecification = function (indexName, collectionName, collectionSpec, dryRun) {
  dryRun = dryRun || false;

  return new Promise((resolve, reject) => {
    var
      maxDepth = 0,
      fields = {},
      treatedSpecification = {
        strict: collectionSpec.strict || false,
        fields: {},
        validators: []
      };

    if (!checkAllowedProperties(collectionSpec, collectionSpecProperties)) {
      return reject(new InternalError('The collection specification has invalid properties.'));
    }

    if (collectionSpec.fields) {
      Object.keys(collectionSpec.fields).forEach(fieldName => {
        var
          field,
          // We deep clone the field because we will modify it
          fieldSpecClone = JSON.parse(JSON.stringify(collectionSpec.fields[fieldName]));

        try {
          field = this.curateFieldSpecification(fieldSpecClone);
          field.path = fieldName.split('.');
          field.depth = field.path.length;
          if (field.depth > maxDepth) {
            maxDepth = field.depth;
          }

          if (!fields[field.depth]) {
            fields[field.depth] = [];
          }

          fields[field.depth].push(field);
        }
        catch (error) {
          this.kuzzle.pluginsManager.trigger('log:error', error);
          return reject(new InternalError(`Specification for the field ${fieldName} triggered an error`));
        }
      });

      if (Object.keys(fields).length > 0) {
        try {
          treatedSpecification.fields = curateStructuredFields(fields, maxDepth);
        }
        catch (error) {
          return reject(error);
        }
      }
    }

    if (collectionSpec.validators && Array.isArray(collectionSpec.validators)) {
      this
        .curateValidatorFilter(indexName, collectionName, collectionSpec.validators, dryRun)
        .then(validationFilter => {
          treatedSpecification.validators = validationFilter.id;

          return resolve(treatedSpecification);
        })
        .catch(error => {
          this.kuzzle.pluginsManager.trigger('log:error', error);
          return reject(new InternalError(`Validator specification of the collection triggered an error : ${JSON.stringify(collectionSpec.validators)}`));
        });
    }
    else {
      return resolve(treatedSpecification);
    }
  });
};

/**
 * @param {FieldSpecification} fieldSpec
 * @returns {FieldSpecification}
 * @throws InternalError
 */
Validation.prototype.curateFieldSpecification = function (fieldSpec) {

  if (!checkAllowedProperties(fieldSpec, fieldSpecProperties)) {
    throw new InternalError('The field specification has invalid properties.');
  }

  mandatoryFieldSpecProperties.forEach(propertyName => {
    if (!fieldSpec.hasOwnProperty(propertyName)) {
      throw new InternalError(`${propertyName} is a mandatory field specification property.`);
    }
  });

  if (!this.types[fieldSpec.type]) {
    throw new InternalError(`${fieldSpec.type} is not a recognized type.`);
  }

  if (fieldSpec.hasOwnProperty('multivalued')) {
    if (!checkAllowedProperties(fieldSpec.multivalued, multivaluedProperties)) {
      throw new InternalError('The multivalued field specification has invalid properties.');
    }

    if (!fieldSpec.multivalued.hasOwnProperty('value')) {
      throw new InternalError('"value" is a mandatory property for multivalued field specification.');
    }

    if (!fieldSpec.multivalued.value && (fieldSpec.multivalued.hasOwnProperty('minCount'))) {
      throw new InternalError('"minCount" is not valid when multivalued field is disabled.');
    }

    if (!fieldSpec.multivalued.value && (fieldSpec.multivalued.hasOwnProperty('maxCount'))) {
      throw new InternalError('"maxCount" is not valid when multivalued field is disabled.');
    }
  }

  _.defaultsDeep(fieldSpec, defaultFieldSpecification);

  if (this.types[fieldSpec.type].validateFieldSpecification(fieldSpec)) {
    return fieldSpec;
  }

  throw new InternalError(`Field of type ${fieldSpec.type} is not specified properly`);
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
    sandboxDsl = new Dsl(),
    query = {
      bool: {
        must: validatorFilter
      }
    };

  promise = sandboxDsl.register(indexName, collectionName, query);

  if (!dryRun) {
    promise.then(() => {
      return this.dsl.register(indexName, collectionName, query);
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
    throw new PluginImplementationError(`The type ${validationType.typeName} must implement the function 'validateFieldSpecification'.`);
  }

  if (this.types[validationType.typeName]) {
    throw new PluginImplementationError(`The type ${validationType.typeName} is already defined.`);
  }

  if (validationType.hasOwnProperty('allowChildren') && validationType.allowChildren) {
    if (!validationType.getStrictness || typeof validationType.getStrictness !== 'function') {
      throw new PluginImplementationError(`The allowing children type ${validationType.typeName} must implement the function 'getStrictness'`);
    }

    typeAllowsChildren.push(validationType.typeName);
  }

  this.types[validationType.typeName] = validationType;
};

/**
 * @param {*} object
 * @param {string[]} allowedProperties
 * @returns {boolean}
 */
function checkAllowedProperties(object, allowedProperties) {
  var result = true;

  if (typeof object !== 'object') {
    return false;
  }

  Object.keys(object).forEach(propertyName => {
    if (allowedProperties.indexOf(propertyName) === -1) {
      result = false;
      return false;
    }
  });

  return result;
}

/**
 * @param {StructuredFieldSpecification[][]} fields
 * @param {number} maxDepth : depth of the fields; counting starts at 1
 * @throws InternalError
 */
function curateStructuredFields(fields, maxDepth) {
  var
    i,
    structuredFields = {
      children: {},
      root: true
    };

  for (i = 1; i <= maxDepth; i++) {
    if (!fields.hasOwnProperty(i)) {
      throw new InternalError('All levels of an object have to be defined in the specification.');
    }

    fields[i].forEach(field => {
      var
        parent,
        childKey = field.path[field.path.length - 1];

      parent = getParent(structuredFields, field.path);

      if (!parent.root && typeAllowsChildren.indexOf(parent.type) === -1) {
        throw new InternalError(`The field type ${parent.type} is not allowed to have children fields.`);
      }

      if (!parent.hasOwnProperty('children')) {
        parent.children = {};
      }

      parent.children[childKey] = field;
    });
  }

  return structuredFields;
}

/**
 * @param {StructuredFieldSpecification} structuredFields
 * @param {string[]}fieldPath
 * @returns {StructuredFieldSpecification}
 */
function getParent(structuredFields, fieldPath) {
  var
    i,
    pointer = structuredFields;

  if (fieldPath.length === 1) {
    return structuredFields;
  }

  for (i = 0; i < fieldPath.length - 1; i++) {
    if (!pointer.children.hasOwnProperty(fieldPath[i])) {
      throw new InternalError(`The parent field of the field "${fieldPath.join('.')}" is not defined.`);
    }

    pointer = structuredFields.children[fieldPath[i]];
  }

  return pointer;
}

module.exports = Validation;
