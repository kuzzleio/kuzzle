/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  debug = require('../../../kuzzleDebug')('kuzzle:validation'),
  Request = require('kuzzle-common-objects').Request,
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../../config/error-codes/throw'),
  Koncorde = require('koncorde'),
  { KuzzleError } = require('kuzzle-common-objects').errors;

/**
 * @class Validation
 * @param {Kuzzle} kuzzle
 */
class Validation {
  constructor(kuzzle) {
    /** @type {Kuzzle} */
    this.kuzzle = kuzzle;

    /** @type {...ValidationType} */
    this.types = {};

    /** @type {string[]} */
    this.typeAllowsChildren = [];

    /** @type {DocumentSpecification} */
    this.specification = {};

    /** @type {Koncorde} */
    this.koncorde = new Koncorde();

    this.rawConfiguration = {};
  }

  /**
   * Walks through all types in "defaultTypesFiles" initializes all types
   */
  init() {
    [
      'anything',
      'boolean',
      'date',
      'email',
      'enum',
      'geoPoint',
      'geoShape',
      'integer',
      'ipAddress',
      'numeric',
      'object',
      'string',
      'url'
    ].forEach(typeFile => {
      const TypeConstructor = require(`./types/${typeFile}`);
      this.addType(new TypeConstructor());
    });
  }

  /**
   * Validates a document against its collection specifications
   *
   * @param {Request} request
   * @param {boolean} [verbose]
   * @returns {Promise.<{documentBody: *, errorMessages:string[], valid: boolean}|KuzzleRequest>}
   */
  validate(request, verbose = false) {
    const
      { _id, index, collection } = request.input.resource,
      collectionSpec =
        this.specification &&
        this.specification[index] &&
        this.specification[index][collection] || {};

    let
      updateBodyClone,
      isUpdate = false;

    return new Bluebird((resolve, reject) => {
      if (request.input.controller === 'document'
        && request.input.action === 'update'
      ) {
        const updateRequest = new Request({_id, index, collection});
        isUpdate = true;

        this.kuzzle.services.publicStorage.get(updateRequest)
          .then(document => {
            // Avoid side effects on the request during the update validation
            updateBodyClone = _.cloneDeep(request.input.body);

            _.defaultsDeep(updateBodyClone, document._source);

            resolve(updateBodyClone);
          })
          .catch(e => reject(e));
      } else {
        return resolve(request.input.body);
      }
    })
      .then(documentBody => {
        const errorMessages = verbose ? {} : [];
        let isValid = true;

        if (collectionSpec) {
          if (collectionSpec.fields && collectionSpec.fields.children) {
            try {
              isValid = this.recurseFieldValidation(
                documentBody,
                collectionSpec.fields.children,
                collectionSpec.strict,
                errorMessages, verbose);
            } catch (error) {
              if (error.message === 'strictness') {
                // The strictness message can be received here only if it happens at the validation of the document's root
                manageErrorMessage(
                  'document',
                  errorMessages,
                  `The document validation is strict. Cannot add unspecified sub-field "${error.details.field}"`,
                  verbose);
                isValid = false;
              } else {
                throw error;
              }
            }
          }

          if (collectionSpec.validators) {
            const filters = this.koncorde.test(
              index,
              collection,
              documentBody,
              _id);

            if (filters.length === 0
              || filters[0] !== collectionSpec.validators
            ) {
              isValid = false;
              manageErrorMessage(
                'document',
                errorMessages,
                'The document does not match validation filters.',
                verbose);
            }
          }
        }

        return {
          errorMessages,
          valid: isValid
        };
      })
      .then(validationObject => {
        if (!verbose) {
          // We only modify the request if the validation succeeds
          if (collectionSpec.fields && collectionSpec.fields.children) {
            request.input.body = this.recurseApplyDefault(
              isUpdate,
              request.input.body,
              collectionSpec.fields.children);
          }

          return request;
        }

        return validationObject;
      });
  }

  /**
   * @param {boolean} isUpdate
   * @param {*} documentSubset
   * @param {...StructuredFieldSpecification} collectionSpecSubset
   */
  recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset) {
    Object.keys(collectionSpecSubset).forEach(fieldName => {
      const
        specSubset = collectionSpecSubset[fieldName],
        field = documentSubset[fieldName];

      if (_.has(documentSubset, fieldName)
        && this.types[specSubset.type].allowChildren && specSubset.children
      ) {
        if (Array.isArray(field)) {
          for (let i = 0; i < field.length; i++) {
            field[i] = this.recurseApplyDefault(
              isUpdate,
              field[i],
              specSubset.children);
          }
        } else {
          documentSubset[fieldName] = this.recurseApplyDefault(
            isUpdate,
            field,
            specSubset.children);
        }
      } else if (specSubset.defaultValue
        && (field === null || (!isUpdate && !_.has(documentSubset, fieldName)))
      ) {
        documentSubset[fieldName] = specSubset.defaultValue;
      }
    });

    return documentSubset;
  }

  /**
   * @param {*} documentSubset
   * @param {StructuredFieldSpecification} collectionSpecSubset
   * @param {boolean} strictness
   * @param {string[]} errorMessages
   * @param {boolean} verbose
   */
  recurseFieldValidation(
    documentSubset,
    collectionSpecSubset,
    strictness,
    errorMessages,
    verbose
  ) {
    if (strictness) {
      for (const field of Object.keys(documentSubset)) {
        if (!collectionSpecSubset[field]) {
          const error = errorsManager.getError(
            'internal',
            'validation',
            'strictness');
          error.details = {
            field
          };
          throw error;
        }
      }
    }

    if (!verbose) {
      // We stop as soon as one field is not valid
      return Object.keys(collectionSpecSubset).every(fieldName =>
        this.isValidField(
          fieldName,
          documentSubset,
          collectionSpecSubset,
          strictness,
          errorMessages,
          verbose));
    }

    // We try to validate every field in order to get all error messages if any
    return Object.keys(collectionSpecSubset).reduce(
      (reductionResult, fieldName) =>
        this.isValidField(
          fieldName,
          documentSubset,
          collectionSpecSubset,
          strictness,
          errorMessages,
          verbose)
          && reductionResult,
      true);
  }

  /**
   * @param {string} fieldName
   * @param {*} documentSubset
   * @param {StructuredFieldSpecification} collectionSpecSubset
   * @param {boolean} strictness
   * @param {string[]} errorMessages
   * @param {boolean} verbose
   * @returns {boolean}
   */
  isValidField(
    fieldName,
    documentSubset,
    collectionSpecSubset,
    strictness,
    errorMessages,
    verbose
  ) {
    /** @type StructuredFieldSpecification */
    const field = collectionSpecSubset[fieldName];
    let result = true;

    if (field.mandatory
      && !_.has(field, 'defaultValue')
      && _.isNil(documentSubset[fieldName])
    ) {
      manageErrorMessage(
        field.path,
        errorMessages,
        'The field is mandatory.',
        verbose);
      return false;
    }

    if (!_.isNil(documentSubset[fieldName])) {
      let
        nestedStrictness = false,
        fieldValues;

      if (field.multivalued.value) {
        if (!Array.isArray(documentSubset[fieldName])) {
          manageErrorMessage(
            field.path,
            errorMessages,
            'The field must be multivalued, unary value provided.',
            verbose);
          return false;
        }

        if (_.has(field.multivalued, 'minCount')
          && documentSubset[fieldName].length < field.multivalued.minCount
        ) {
          manageErrorMessage(
            field.path,
            errorMessages,
            `Not enough elements. Minimum count is set to ${field.multivalued.minCount}.`,
            verbose);
          return false;
        }

        if (_.has(field.multivalued, 'maxCount')
          && documentSubset[fieldName].length > field.multivalued.maxCount
        ) {
          manageErrorMessage(
            field.path,
            errorMessages,
            `Too many elements. Maximum count is set to ${field.multivalued.maxCount}.`,
            verbose);
          return false;
        }

        fieldValues = documentSubset[fieldName];
      } else {
        if (Array.isArray(documentSubset[fieldName])) {
          manageErrorMessage(
            field.path,
            errorMessages,
            'The field is not a multivalued field; Multiple values provided.',
            verbose);
          return false;
        }

        fieldValues = [documentSubset[fieldName]];
      }

      if (this.types[field.type].allowChildren) {
        nestedStrictness = this.types[field.type].getStrictness(
          field.typeOptions,
          strictness);
      }

      for (const val of fieldValues) {
        const fieldErrors = [];

        if (!this.types[field.type].validate(
          field.typeOptions,
          val,
          fieldErrors)
        ) {
          if (fieldErrors.length === 0) {
            // We still want to trigger an error, even if no message is provided
            manageErrorMessage(
              field.path,
              errorMessages,
              'An error has occurred during validation.',
              verbose);
          } else {
            fieldErrors.forEach(
              message => manageErrorMessage(
                field.path,
                errorMessages,
                message,
                verbose));
          }
          return false;
        }

        if (this.types[field.type].allowChildren && field.children) {
          try {
            if (!this.recurseFieldValidation(
              val,
              field.children,
              nestedStrictness,
              errorMessages,
              verbose
            )) {
              result = false;
            }
          } catch (error) {
            if (error.message === 'strictness') {
              manageErrorMessage(
                field.path,
                errorMessages,
                `The field is set to "strict"; cannot add unspecified sub-field "${error.details.field}".`,
                verbose);
            } else if (verbose) {
              manageErrorMessage(
                field.path,
                errorMessages,
                error.message,
                verbose);
            } else {
              throw error;
            }

            result = false;
          }
        }
      }
    }
    return result;
  }

  /**
   * @returns {Promise.<T>}
   */
  curateSpecification() {
    const
      promises = [],
      specification = {};

    return getValidationConfiguration(this.kuzzle)
      .then(validation => {
        this.rawConfiguration = validation;

        for (const indexName of Object.keys(this.rawConfiguration)) {
          for (const collectionName of Object.keys(
            this.rawConfiguration[indexName])
          ) {
            const promise = this.curateCollectionSpecification(
              indexName,
              collectionName,
              this.rawConfiguration[indexName][collectionName]
            )
              .then(curatedSpec => {

                if (!_.has(specification, indexName)) {
                  specification[indexName] = {};
                }

                specification[indexName][collectionName] = curatedSpec;

                this.kuzzle.log.info(
                  `Validation specification for ${indexName} / ${collectionName} has been loaded.`);
                return null;
              })
              .catch(error => {
                this.kuzzle.log.error(
                  `Specification for the collection ${collectionName} triggered an error`);
                this.kuzzle.log.error(`Error: ${error.message}`);
                return null;
              });
            promises.push(promise);
          }
        }

        return Bluebird
          .all(promises)
          .then(() => {
            this.specification = specification;
            return this.kuzzle.log.info('Validators initialized');
          });
      });
  }

  /**
   * @param {string} indexName
   * @param {string} collectionName
   * @param {CollectionSpecification} collectionSpec
   * @param {boolean} [verboseErrors]
   * @returns {Promise<object>}
   */
  isValidSpecification(
    indexName,
    collectionName,
    collectionSpec,
    verboseErrors = false
  ) {
    // We make a deep clone to avoid side effects
    const specification = _.cloneDeep(collectionSpec);

    return this.curateCollectionSpecification(
      indexName,
      collectionName,
      specification,
      true,
      verboseErrors)
      .then(result => {
        if (verboseErrors && result.isValid === false) {
          return result;
        }
        return {isValid: true};
      })
      // we do not want to reject since this method goal is
      // to know what is going wrong with the given spec
      .catch(error => ({isValid: false, errors: [error]}));
  }

  /**
   * @param {string} indexName
   * @param {string} collectionName
   * @param {CollectionSpecification} collectionSpec
   * @param {boolean} [dryRun]
   * @param {boolean} [verboseErrors]
   * @returns {Promise<CollectionSpecification>}
   * @rejects PreconditionError
   */
  curateCollectionSpecification(
    indexName,
    collectionName,
    collectionSpec,
    dryRun = false,
    verboseErrors = false
  ) {
    let errorMessage = '';

    return new Bluebird((resolve, reject) => {
      const
        treatedSpecification = {
          strict: collectionSpec.strict || false,
          fields: {},
          validators: null
        };

      if (!checkAllowedProperties(
        collectionSpec,
        ['strict', 'fields', 'validators']
      )) {
        errorMessage =
          `${indexName}.${collectionName}: the collection specification has invalid properties.`;
        if (verboseErrors) {
          return resolve({isValid: false, errors: [errorMessage]});
        }
        return reject(errorsManager.throw(
          'internal',
          'validation',
          'invalid_properties_for_collection_specification',
          errorMessage));
      }

      if (collectionSpec.fields) {
        try {
          const result = this.structureCollectionValidation(
            collectionSpec,
            indexName,
            collectionName,
            verboseErrors);
          if (result.isValid === false) {
            if (verboseErrors) {
              // do not fail fast if we need verbose errors
              return resolve(result);
            }

            const errorObject = errorsManager.getError(
              'internal',
              'validation',
              'structure_collection_validation',
              result.errors[0]);
            errorObject.details = result.errors;
            return reject(errorObject);
          }
          treatedSpecification.fields = result;
        } catch (error) {
          return reject(error);
        }
      }

      if (collectionSpec.validators
        && Array.isArray(collectionSpec.validators)
      ) {
        this
          .curateValidatorFilter(
            indexName,
            collectionName,
            collectionSpec.validators,
            dryRun)
          .then(validationFilter => {
            treatedSpecification.validators = validationFilter.id;

            resolve(treatedSpecification);
          })
          .catch(error => {
            this.kuzzle.log.error(error);
            reject(errorsManager.getError(
              'internal',
              'validation',
              'validator_specification_of_collection_error',
              indexName,
              collectionName));
          });
      } else {
        resolve(treatedSpecification);
      }
    });
  }

  structureCollectionValidation(
    collectionSpec,
    indexName,
    collectionName,
    verboseErrors = false
  ) {
    const fields = {};
    let
      errors = [],
      maxDepth = 0;

    for (const fieldName of Object.keys(collectionSpec.fields)) {
      const
        // We deep clone the field because we will modify it
        fieldSpecClone = _.cloneDeep(collectionSpec.fields[fieldName]);

      try {
        const result = this.curateFieldSpecification(
          fieldSpecClone,
          indexName,
          collectionName,
          fieldName,
          verboseErrors);
        if (result.isValid === false) {
          errors = _.concat(errors, result.errors);
          this.kuzzle.log.error(result.errors.join('\n'));
        } else {
          const field = result.fieldSpec;
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
      } catch (error) {
        this.kuzzle.log.error(error);
        throwOrStoreError(
          `Specification for the field ${indexName}.${collectionName}.${fieldName} triggered an error`,
          verboseErrors,
          errors);
      }
    }

    if (errors.length > 0) {
      return {errors, isValid: false};
    }

    if (Object.keys(fields).length > 0) {
      return curateStructuredFields(
        this.typeAllowsChildren,
        fields,
        maxDepth
      );
    }
    return {};
  }

  /**
   * @param {FieldSpecification} fieldSpec
   * @param {string} indexName
   * @param {string} collectionName
   * @param {string} fieldName
   * @param {boolean} [verboseErrors]
   * @returns {object}
   * @throws PreconditionError
   */
  curateFieldSpecification(
    fieldSpec,
    indexName,
    collectionName,
    fieldName,
    verboseErrors = false
  ) {
    const errors = [];

    const result = this.curateFieldSpecificationFormat(
      fieldSpec,
      indexName,
      collectionName,
      fieldName,
      verboseErrors
    );

    if (result.isValid === false) {
      return result;
    }

    _.defaultsDeep(fieldSpec, {
      'mandatory': false,
      'multivalued': {
        value: false
      }
    });

    if (!_.has(fieldSpec, 'typeOptions')) {
      fieldSpec.typeOptions = {};
    }

    if (!checkAllowedProperties(
      fieldSpec.typeOptions,
      this.types[fieldSpec.type].allowedTypeOptions || []
    )) {
      throwOrStoreError(
        `Field ${indexName}.${collectionName}.${fieldName} of type ${fieldSpec.type} is not specified properly`,
        verboseErrors,
        errors);
    }

    try {
      fieldSpec.typeOptions =
        this.types[fieldSpec.type].validateFieldSpecification(fieldSpec.typeOptions);
    } catch (e) {
      if (!verboseErrors) {
        if (e instanceof KuzzleError) {
          throw e;
        }
        throw errorsManager.throw(
          'plugins',
          'runtime',
          'plugin_error',
          e.message);
      }
      errors.push(e.message);
    }

    if (errors.length > 0) {
      return {errors, isValid: false};
    }

    debug(
      'Loaded field validator: %s/%s/%s: %o',
      indexName,
      collectionName,
      fieldName,
      fieldSpec);

    return {fieldSpec, isValid: true};
  }

  /**
   * @param {FieldSpecification} fieldSpec
   * @param {string} indexName
   * @param {string} collectionName
   * @param {string} fieldName
   * @param {boolean} [verboseErrors]
   * @returns {object}
   * @throws PreconditionError
   */
  curateFieldSpecificationFormat(
    fieldSpec,
    indexName,
    collectionName,
    fieldName,
    verboseErrors = false
  ) {
    const errors = [];

    const valid = checkAllowedProperties(
      fieldSpec,
      [
        'mandatory',
        'type',
        'defaultValue',
        'description',
        'multivalued',
        'typeOptions'
      ]);

    if (!valid) {
      throwOrStoreError(`The field ${indexName}.${collectionName}.${fieldName} specification has invalid properties.`, verboseErrors, errors);
    }

    if (!_.has(fieldSpec, 'type')) {
      throwOrStoreError(
        `In ${indexName}.${collectionName}.${fieldName}, 'type' is a mandatory field specification property.`,
        verboseErrors,
        errors);
    }

    if (!this.types[fieldSpec.type]) {
      throwOrStoreError(
        `In ${indexName}.${collectionName}.${fieldName}: ${fieldSpec.type} is not a recognized type.`,
        verboseErrors,
        errors);
    }

    if (_.has(fieldSpec, 'multivalued')) {
      if (!checkAllowedProperties(
        fieldSpec.multivalued,
        ['value', 'minCount', 'maxCount'])
      ) {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, the multivalued field specification has invalid properties.`,
          verboseErrors,
          errors);
      }

      if (!_.has(fieldSpec.multivalued, 'value')) {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, "value" is a mandatory property for multivalued field specification.`,
          verboseErrors,
          errors);
      }

      if (typeof fieldSpec.multivalued.value !== 'boolean') {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, "multivalued.value" must be a boolean`,
          verboseErrors,
          errors);
      }

      if (!fieldSpec.multivalued.value
        && _.has(fieldSpec.multivalued, 'minCount')
      ) {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, "minCount" is not valid when multivalued field is disabled.`,
          verboseErrors,
          errors);
      }

      if (!fieldSpec.multivalued.value
        && _.has(fieldSpec.multivalued, 'maxCount')
      ) {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, "maxCount" is not valid when multivalued field is disabled.`,
          verboseErrors,
          errors);
      }

      if (_.has(fieldSpec.multivalued, 'minCount')
        && _.has(fieldSpec.multivalued, 'maxCount')
        && fieldSpec.multivalued.minCount > fieldSpec.multivalued.maxCount
      ) {
        throwOrStoreError(
          `In ${indexName}.${collectionName}.${fieldName}, "minCount" can not be greater than "maxCount".`,
          verboseErrors,
          errors);
      }
    }

    if (errors.length > 0) {
      return {errors, isValid: false};
    }

    return {isValid: true};
  }

  /**
   * @param {string} indexName
   * @param {string} collectionName
   * @param {*} validatorFilter
   * @param {boolean} dryRun
   * @returns {Promise}
   */
  curateValidatorFilter(indexName, collectionName, validatorFilter, dryRun) {
    const
      query = {
        bool: {
          must: validatorFilter
        }
      };

    const promise = this.koncorde.validate(query);

    if (!dryRun) {
      debug(
        'Registering filter validator %s/%s: %O',
        indexName,
        collectionName,
        query);
      return promise.then(() => this.koncorde.register(
        indexName,
        collectionName,
        query));
    }

    return promise;
  }

  /**
   * @param {ValidationType} validationType
   * @throws {PluginImplementationError}
   */
  addType(validationType) {
    if (!validationType.typeName) {
      errorsManager.throw(
        'internal',
        'validation',
        'missing_typename_property');
    }

    if (!validationType.validate
      || typeof validationType.validate !== 'function'
    ) {
      errorsManager.throw(
        'plugins',
        'validation',
        'function_validate_not_implemented',
        validationType.typeName);
    }

    if (!validationType.validateFieldSpecification
      || typeof validationType.validateFieldSpecification !== 'function'
    ) {
      errorsManager.throw(
        'plugins',
        'validation',
        'function_validateFieldSpecification_not_implemented',
        validationType.typeName);
    }

    if (_.has(validationType, 'allowChildren')
      && validationType.allowChildren
    ) {
      if (!validationType.getStrictness
        || typeof validationType.getStrictness !== 'function'
      ) {
        errorsManager.throw(
          'plugins',
          'validation',
          'function_getStrictness_not_implemented',
          validationType.typeName);
      }

      this.typeAllowsChildren.push(validationType.typeName);
    }

    if (this.types[validationType.typeName]) {
      errorsManager.throw(
        'internal',
        'validation',
        'type_already_defined',
        validationType.typeName);
    }

    this.types[validationType.typeName] = validationType;
  }

}

/**
 * @param {*} object
 * @param {string[]} allowedProperties
 * @returns {boolean}
 */
function checkAllowedProperties(object, allowedProperties) {
  if (typeof object !== 'object' || Array.isArray(object) || object === null) {
    return false;
  }

  return !Object.keys(object).some(
    propertyName => allowedProperties.indexOf(propertyName) === -1);
}

/**
 * @param {string[]} typeAllowsChildren
 * @param {StructuredFieldSpecification[][]} fields
 * @param {number} maxDepth : depth of the fields; counting starts at 1
 * @throws PreconditionError
 */
function curateStructuredFields(typeAllowsChildren, fields, maxDepth) {
  const
    /** @type StructuredFieldSpecification */
    structuredFields = {
      children: {},
      root: true
    };

  for (let i = 1; i <= maxDepth; i++) {
    if (!_.has(fields, i)) {
      errorsManager.throw(
        'internal',
        'validation',
        'object_level_undefined_in_specification');
    }

    fields[i].forEach(field => {
      const
        parent = getParent(structuredFields, field.path),
        childKey = field.path[field.path.length - 1];

      if (!parent.root && typeAllowsChildren.indexOf(parent.type) === -1) {
        errorsManager.throw(
          'internal',
          'validation',
          'type_not_allowed',
          parent.type);
      }

      if (!_.has(parent, 'children')) {
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
  if (fieldPath.length === 1) {
    return structuredFields;
  }

  let pointer = structuredFields;

  for (let i = 0; i < fieldPath.length - 1; i++) {
    if (!_.has(pointer.children, fieldPath[i])) {
      errorsManager.throw(
        'internal',
        'validation',
        'parent_field_not_defined',
        fieldPath.join('.'));
    }

    pointer = pointer.children[fieldPath[i]];
  }

  return pointer;
}

/**
 * @param {string} errorMessage
 * @param {boolean} doNotThrow
 * @param {string[]} errors
 */
function throwOrStoreError(errorMessage, doNotThrow, errors) {
  if (!doNotThrow) {
    errorsManager.throw(
      'internal',
      'validation',
      'throw_error',
      errorMessage);
  }
  errors.push(errorMessage);
}

/**
 * @param {string|string[]} errorContext
 * @param {string[]|{documentScope:string[], fieldScope: {children: ...*}}} errorHolder
 * @param {string} message
 * @param {boolean} structured
 */
function manageErrorMessage(errorContext, errorHolder, message, structured) {
  if (structured) {
    if (errorContext === 'document') {
      if (!errorHolder.documentScope) {
        errorHolder.documentScope = [];
      }

      errorHolder.documentScope.push(message);
    } else {
      if (!errorHolder.fieldScope) {
        errorHolder.fieldScope = {};
      }

      let pointer = errorHolder.fieldScope;

      for (let i = 0; i < errorContext.length; i++) {
        if (!pointer.children) {
          pointer.children = {};
        }

        if (!_.has(pointer.children, errorContext[i])) {
          pointer.children[errorContext[i]] = {};
        }
        pointer = pointer.children[errorContext[i]];
      }

      if (!_.has(pointer, 'messages')) {
        pointer.messages = [];
      }

      pointer.messages.push(message);
    }
  } else if (errorContext === 'document') {
    errorsManager.throw(
      'internal',
      'validation',
      'errorcontext_document',
      message);
  } else {
    errorsManager.throw(
      'internal',
      'validation',
      'errorcontext',
      errorContext.join('.'),
      message);
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
  return kuzzle.internalIndex
    .search('validations', false, {from: 0, size: 1000})
    .then(result => {
      let validation = {};

      if (result
        && result.hits
        && Array.isArray(result.hits)
        && result.hits.length > 0
      ) {
        for (const p of result.hits) {
          if (!validation[p._source.index]) {
            validation[p._source.index] = {};
          }
          validation[p._source.index][p._source.collection] =
            p._source.validation;
        }
      } else if (kuzzle.config.validation) {
        // We can't wait prepareDb as it runs outside of the rest of the start
        validation = kuzzle.config.validation;
      }

      return validation;
    });
}

module.exports = Validation;
