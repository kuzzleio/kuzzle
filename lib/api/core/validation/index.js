var
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  glob = require('glob'),
  _ = require('lodash'),
  path = require('path'),
  collectionSpecProperties = ['strict', 'fields', 'validators'],
  fieldSpecProperties = ['mandatory', 'type', 'defaultValue', 'description', 'multivalued', 'typeOptions'],
  mandatoryFieldSpecProperties = ['type'],
  multivaluedProperties = ['value', 'minCount', 'maxCount'],
  Promise = require('bluebird'),
  Dsl = require('../../dsl'),
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

  this.rawConfiguration = {};
}

/**
 * Walks through the ./types directory and loads all types found in it
 */
Validation.prototype.init = function () {
  var
    typeFiles = glob.sync(path.join(__dirname, 'types', '**', '*.js')),
    ValidationType;

  typeFiles.forEach(typeFile => {
    try {
      ValidationType = require(typeFile);

      this.addType(new ValidationType());
    }
    catch (error) {
      throw new InternalError(`The type file ${typeFile} can not be loaded properly.`);
    }
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
    controller = requestObject.controller,
    action = requestObject.action,
    id;

  if (!requestObject.hasOwnProperty('data')) {
    return new BadRequestError('The request object must provide data');
  }

  if (!requestObject.data.hasOwnProperty('body')) {
    return new BadRequestError('The request object must provide a document body');
  }


  if (controller === 'write' && action === 'update') {
    if (!requestObject.data.hasOwnProperty('_id')) {
      return new BadRequestError('Update request must provide an _id.');
    }

    id = requestObject.data._id;
  }

  return this.validationPromise(index, collection, controller, action, id, requestObject.data.body, false)
    .then(validationObject => {
      if (!validationObject.validation) {
        throw new BadRequestError(validationObject.errorMessages.join('\n'));
      }

      // We only modify the requestObject if the validation succeeds
      requestObject.data.body = validationObject.documentBody;

      return requestObject;
    });
};

Validation.prototype.validationPromise = function (index, collection, controller, action, id, documentCandidate, structuredError) {
  var
    // Avoid side effects on the requestObject during the validation
    requestBodyClone = JSON.parse(JSON.stringify(documentCandidate)),
    updateBodyClone;

  structuredError = typeof structuredError !== 'undefined' && structuredError;

  return new Promise((resolve, reject) => {

    if (controller === 'write' && action === 'update') {
      this.kuzzle.services.list.storageEngine.get({
        index,
        collection,
        controller: 'read',
        action: 'get',
        data: {
          _id: id
        }
      }).then(document => {
        // Avoid side effects on the requestObject during the validation
        updateBodyClone = JSON.parse(JSON.stringify(requestBodyClone));
        _.defaultsDeep(requestBodyClone, document._source);
        return resolve(requestBodyClone);
      }).catch(error => {
        return reject(error);
      });
    }
    else {
      return resolve(documentCandidate);
    }
  }).then(documentBody => {
    var
      validation = true,
      strictnessError = false,
      errorMessages = structuredError ? {} : [],
      /** @type {CollectionSpecification} */
      collectionSpec;

    if (this.specification && this.specification[index] && this.specification[index][collection]) {
      collectionSpec = this.specification[index][collection];

      if (collectionSpec.fields) {
        try {
          validation = validation && this.recurseFieldValidation(documentBody, updateBodyClone || null, collectionSpec.fields.children, collectionSpec.strict, errorMessages, structuredError);
        }
        catch (error) {
          if (error.message === 'strictness') {
            // The strictness message can be received here only if it happens at the validation of the document's root
            addErrorMessage('document', errorMessages, 'The document validation is strict; it can not add unspecified sub-fields.', structuredError);
            strictnessError = true;
          }
        }

        if (!strictnessError && !validation) {
          addErrorMessage('document', errorMessages, 'The document is not valid due to field validation.', structuredError);
        }
      }

      if (collectionSpec.validators) {
        return this.dsl.test(index, collection, documentBody, id)
          .then(filters => {
            var result = false;

            filters.forEach(filter => {
              if (filter === collectionSpec.validators) {
                result = true;
                return false;
              }
            });

            if (!result) {
              validation = false;
              addErrorMessage('document', errorMessages, 'The document does not match validation filters.', structuredError);
            }

            return {
              documentBody: updateBodyClone || requestBodyClone,
              errorMessages: errorMessages,
              validation: validation
            };
          });
      }
    }

    return {
      documentBody: updateBodyClone || requestBodyClone,
      errorMessages: errorMessages,
      validation: validation
    };
  });
};

/**
 * @param {*} documentSubset
 * @param {*} originalBodySubset
 * @param {StructuredFieldSpecification} collectionSpecSubset
 * @param {boolean} strictness
 * @param {string[]} errorMessages
 * @param {boolean} structuredError
 */
Validation.prototype.recurseFieldValidation = function (documentSubset, originalBodySubset, collectionSpecSubset, strictness, errorMessages, structuredError) {
  if (strictness) {
    if (!checkAllowedProperties(documentSubset, Object.keys(collectionSpecSubset))) {
      // We use a throw to be able to provide information about the field or the document in whole
      throw new BadRequestError('strictness');
    }
  }

  return Object.keys(collectionSpecSubset).reduce((reductionResult, fieldName) => {
    var
      nestedStrictness,
      /** @type StructuredFieldSpecification */
      field = collectionSpecSubset[fieldName],
      fieldValues,
      i,
      fieldErrors;

    if (field.mandatory && !field.hasOwnProperty('defaultValue') && (!documentSubset.hasOwnProperty(fieldName) || typeof documentSubset[fieldName] === 'undefined' || documentSubset[fieldName] === null)) {
      addErrorMessage(field.path, errorMessages, 'The field is mandatory.', structuredError);
      return false;
    }

    if (documentSubset.hasOwnProperty(fieldName) && typeof documentSubset[fieldName] !== 'undefined') {
      if (field.multivalued.value) {
        if (!Array.isArray(documentSubset[fieldName])) {
          addErrorMessage(field.path, errorMessages, 'The field must be multivalued, unary value provided.', structuredError);
          return false;
        }

        if (field.multivalued.hasOwnProperty('minCount') && documentSubset[fieldName].length < field.multivalued.minCount) {
          addErrorMessage(field.path, errorMessages, 'The multivalued field has not enough values.', structuredError);
          return false;
        }

        if (field.multivalued.hasOwnProperty('maxCount') && documentSubset[fieldName].length > field.multivalued.maxCount) {
          addErrorMessage(field.path, errorMessages, 'The multivalued field has too much values.', structuredError);
          return false;
        }

        fieldValues = documentSubset[fieldName];
      }
      else {
        if (Array.isArray(documentSubset[fieldName])) {
          addErrorMessage(field.path, errorMessages, 'The field is not a multivalued field; Multiple values provided.', structuredError);
          return false;
        }

        fieldValues = [documentSubset[fieldName]];
      }

      if (this.types[field.type].allowChildren) {
        nestedStrictness = this.types[field.type].getStrictness(field.typeOptions, strictness);
      }

      for (i = 0; i < fieldValues.length; i++) {
        fieldErrors = [];

        if (!this.types[field.type].validate(field.typeOptions, fieldValues[i], fieldErrors)) {
          fieldErrors.forEach(message => addErrorMessage(field.path, errorMessages, message, structuredError));
          return false;
        }

        if (this.types[field.type].allowChildren && typeof fieldValues[i] === 'object' && field.children) {
          try {
            this.recurseFieldValidation(
              documentSubset[fieldName],
              originalBodySubset.hasOwnProperty(fieldValues) ? originalBodySubset[fieldValues] : null,
              field.children,
              nestedStrictness,
              errorMessages
            );
          }
          catch (error) {
            if (error.message === 'strictness') {
              addErrorMessage(field.path, errorMessages, 'The field validation is strict; it can not add unspecified sub-fields.', structuredError);
            } else {
              addErrorMessage(field.path, errorMessages, error.message, structuredError);
            }

            return false;
          }
        }
      }
    }
    else if (field.defaultValue) {
      if (originalBodySubset !== null) {
        originalBodySubset[fieldName] = field.defaultValue;
      }

      documentSubset[fieldName] = field.defaultValue;
    }

    return reductionResult;
  }, true);
};

/**
 * @returns {Promise.<T>}
 */
Validation.prototype.curateSpecification = function () {
  var
    promises = [],
    curatedCollectionSpecification,
    specification = {};

  return getValidationConfiguration(this.kuzzle)
    .then(validation => {
      this.rawConfiguration = validation;

      _.each(this.rawConfiguration, (indexSpec, indexName) => {
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
        validators: null
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
          field.path = fieldName.split('/');
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
  var returnedTypeOptions;

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

  if (!fieldSpec.hasOwnProperty('typeOptions')) {
    fieldSpec.typeOptions = {};
  }

  if (!checkAllowedProperties(fieldSpec.typeOptions, this.types[fieldSpec.type].allowedTypeOptions || [])) {
    throw new InternalError(`Field of type ${fieldSpec.type} is not specified properly`);
  }

  try {
    returnedTypeOptions = this.types[fieldSpec.type].validateFieldSpecification(fieldSpec.typeOptions);
  }
  catch (error) {
    throw error;
  }

  if (typeof returnedTypeOptions === 'boolean') {
    if (returnedTypeOptions) {
      return fieldSpec;
    }

    throw new InternalError(`Field of type ${fieldSpec.type} is not specified properly`);
  }
  else {
    fieldSpec.typeOptions = returnedTypeOptions;

    return fieldSpec;
  }
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

function addErrorMessage(context, errorHolder, message, structured) {
  var
    i,
    pointer;

  if (structured) {
    if (context === 'document') {
      if (!errorHolder.documentScope) {
        errorHolder.documentScope = [];
      }

      errorHolder.documentScope.push(message);
    }
    else {
      if (!errorHolder.fieldScope) {
        errorHolder.fieldScope = {};
      }

      pointer = errorHolder.fieldScope;

      for (i = 0; i < context.length; i++) {
        if (!pointer.hasOwnProperty(context[i])) {
          pointer[context[i]] = {};
        }
        pointer = pointer[context[i]];
      }

      if (!pointer.hasOwnProperty('messages')) {
        pointer.messages = [];
      }

      pointer.messages.push(message);
    }
  }
  else if (context === 'document') {
    errorHolder.unshift(`Document: ${message}`);
  }
  else {
    errorHolder.push(`Field ${context.join('.')}: ${message}`);
  }
}

/**
 * Retrieve the plugins list from the database and returns it,
 * along with their configuration
 *
 * @param kuzzle
 * @returns {Promise}
 */
function getValidationConfiguration(kuzzle) {

  return kuzzle.internalEngine
    .search('validation', false, 0, 1000)
    .then(result => {
      var
        validation = {};

      if (result.hits.length > 0) {
        result.hits.forEach(p => {
          if (!validation[p._source.index]) {
            validation[p._source.index] = {};
          }
          validation[p._source.index][p._source.collection] = p._source.validation;
        });
      }
      else if (kuzzle.config.validation) {
        // We can't wait prepareDb as it runs outside of the rest of the start
        validation = kuzzle.config.validation;
      }

      return Promise.resolve(validation);
    });
}

module.exports = Validation;
