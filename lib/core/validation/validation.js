/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

"use strict";

const Bluebird = require("bluebird");
const _ = require("lodash");
const { Koncorde } = require("koncorde");

const debug = require("../../util/debug")("core:validation");
const kerror = require("../../kerror");
const { KuzzleError } = require("../../kerror/errors");
const { has, isPlainObject, get } = require("../../util/safeObject");
const { koncordeTest, toKoncordeIndex } = require("../../util/koncordeCompat");

const assertionError = kerror.wrap("validation", "assert");
/**
 * @class Validation
 */
class Validation {
  constructor() {
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
      "anything",
      "boolean",
      "date",
      "email",
      "enum",
      "geoPoint",
      "geoShape",
      "integer",
      "ipAddress",
      "numeric",
      "object",
      "string",
      "url",
    ].forEach((typeFile) => {
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
  async validate(request, verbose = false) {
    const { _id, index, collection } = request.input.resource,
      collectionSpec =
        (isPlainObject(this.specification) &&
          has(this.specification, index) &&
          get(this.specification[index], collection)) ||
        {};

    let isUpdate = false,
      body = request.input.body;

    if (
      request.input.controller === "document" &&
      request.input.action === "update"
    ) {
      isUpdate = true;

      const document = await global.kuzzle.ask(
        "core:storage:public:document:get",
        index,
        collection,
        _id
      );

      // Avoid side effects on the request during the update validation
      body = _.cloneDeep(request.input.body);
      _.defaultsDeep(body, document._source);
    }

    const errorMessages = verbose ? {} : [];
    let isValid = true;

    if (collectionSpec) {
      if (collectionSpec.fields && collectionSpec.fields.children) {
        try {
          isValid = this.recurseFieldValidation(
            body,
            collectionSpec.fields.children,
            collectionSpec.strict,
            errorMessages,
            verbose
          );
        } catch (error) {
          // The strictness message can be received here only if it happens at
          // the validation of the document's root
          if (error.message !== "strictness") {
            throw error;
          }

          isValid = false;
          manageErrorMessage(
            "document",
            errorMessages,
            `The document validation is strict. Cannot add unspecified sub-field "${error.details.field}"`,
            verbose
          );
        }
      }

      if (collectionSpec.validators) {
        const filters = koncordeTest(
          this.koncorde,
          index,
          collection,
          body,
          _id
        );

        if (filters.length === 0 || filters[0] !== collectionSpec.validators) {
          isValid = false;
          manageErrorMessage(
            "document",
            errorMessages,
            "The document does not match validation filters.",
            verbose
          );
        }
      }
    }

    if (!verbose) {
      // We only modify the request if the validation succeeds
      if (collectionSpec.fields && collectionSpec.fields.children) {
        request.input.body = this.recurseApplyDefault(
          isUpdate,
          request.input.body,
          collectionSpec.fields.children
        );
      }

      return request;
    }

    return { errorMessages, valid: isValid };
  }

  /**
   * @param {boolean} isUpdate
   * @param {*} documentSubset
   * @param {...StructuredFieldSpecification} collectionSpecSubset
   */
  recurseApplyDefault(isUpdate, documentSubset, collectionSpecSubset) {
    Object.keys(collectionSpecSubset).forEach((fieldName) => {
      const specSubset = collectionSpecSubset[fieldName],
        field = documentSubset[fieldName];

      if (
        has(documentSubset, fieldName) &&
        this.types[specSubset.type].allowChildren &&
        specSubset.children
      ) {
        if (Array.isArray(field)) {
          for (let i = 0; i < field.length; i++) {
            field[i] = this.recurseApplyDefault(
              isUpdate,
              field[i],
              specSubset.children
            );
          }
        } else {
          documentSubset[fieldName] = this.recurseApplyDefault(
            isUpdate,
            field,
            specSubset.children
          );
        }
      } else if (
        specSubset.defaultValue &&
        (field === null || (!isUpdate && !has(documentSubset, fieldName)))
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
          const error = new Error("strictness");
          error.details = { field };
          throw error;
        }
      }
    }

    if (!verbose) {
      // We stop as soon as one field is not valid
      return Object.keys(collectionSpecSubset).every((fieldName) =>
        this.isValidField(
          fieldName,
          documentSubset,
          collectionSpecSubset,
          strictness,
          errorMessages,
          verbose
        )
      );
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
          verbose
        ) && reductionResult,
      true
    );
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

    if (
      field.mandatory &&
      !has(field, "defaultValue") &&
      _.isNil(documentSubset[fieldName])
    ) {
      manageErrorMessage(
        field.path,
        errorMessages,
        "The field is mandatory.",
        verbose
      );
      return false;
    }

    if (!_.isNil(documentSubset[fieldName])) {
      let nestedStrictness = false,
        fieldValues;

      if (field.multivalued.value) {
        if (!Array.isArray(documentSubset[fieldName])) {
          manageErrorMessage(
            field.path,
            errorMessages,
            "The field must be multivalued, unary value provided.",
            verbose
          );
          return false;
        }

        if (
          has(field.multivalued, "minCount") &&
          documentSubset[fieldName].length < field.multivalued.minCount
        ) {
          manageErrorMessage(
            field.path,
            errorMessages,
            `Not enough elements. Minimum count is set to ${field.multivalued.minCount}.`,
            verbose
          );
          return false;
        }

        if (
          has(field.multivalued, "maxCount") &&
          documentSubset[fieldName].length > field.multivalued.maxCount
        ) {
          manageErrorMessage(
            field.path,
            errorMessages,
            `Too many elements. Maximum count is set to ${field.multivalued.maxCount}.`,
            verbose
          );
          return false;
        }

        fieldValues = documentSubset[fieldName];
      } else {
        if (Array.isArray(documentSubset[fieldName])) {
          manageErrorMessage(
            field.path,
            errorMessages,
            "The field is not a multivalued field; Multiple values provided.",
            verbose
          );
          return false;
        }

        fieldValues = [documentSubset[fieldName]];
      }

      if (this.types[field.type].allowChildren) {
        nestedStrictness = this.types[field.type].getStrictness(
          field.typeOptions,
          strictness
        );
      }

      for (const val of fieldValues) {
        const fieldErrors = [];

        if (
          !this.types[field.type].validate(field.typeOptions, val, fieldErrors)
        ) {
          if (fieldErrors.length === 0) {
            // We still want to trigger an error, even if no message is provided
            manageErrorMessage(
              field.path,
              errorMessages,
              "An error has occurred during validation.",
              verbose
            );
          } else {
            fieldErrors.forEach((message) =>
              manageErrorMessage(field.path, errorMessages, message, verbose)
            );
          }
          return false;
        }

        if (this.types[field.type].allowChildren && field.children) {
          try {
            if (
              !this.recurseFieldValidation(
                val,
                field.children,
                nestedStrictness,
                errorMessages,
                verbose
              )
            ) {
              result = false;
            }
          } catch (error) {
            if (error.message === "strictness") {
              manageErrorMessage(
                field.path,
                errorMessages,
                `The field is set to "strict"; cannot add unspecified sub-field "${error.details.field}".`,
                verbose
              );
            } else if (verbose) {
              manageErrorMessage(
                field.path,
                errorMessages,
                error.message,
                verbose
              );
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
    const promises = [],
      specification = {};

    return getValidationConfiguration().then((validation) => {
      this.rawConfiguration = validation;

      for (const indexName of Object.keys(this.rawConfiguration)) {
        for (const collectionName of Object.keys(
          this.rawConfiguration[indexName]
        )) {
          const promise = this.curateCollectionSpecification(
            indexName,
            collectionName,
            this.rawConfiguration[indexName][collectionName]
          )
            .then((curatedSpec) => {
              if (!has(specification, indexName)) {
                specification[indexName] = {};
              }

              specification[indexName][collectionName] = curatedSpec;

              return null;
            })
            .catch((error) => {
              global.kuzzle.log.error(
                `Specification for the collection ${collectionName} triggered an error`
              );
              global.kuzzle.log.error(`Error: ${error.message}`);

              return null;
            });
          promises.push(promise);
        }
      }

      return Bluebird.all(promises).then(() => {
        this.specification = specification;
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
  validateFormat(
    indexName,
    collectionName,
    collectionSpec,
    verboseErrors = false
  ) {
    // We make a deep clone to avoid side effects
    const specification = _.cloneDeep(collectionSpec);

    return (
      this.curateCollectionSpecification(
        indexName,
        collectionName,
        specification,
        true,
        verboseErrors
      )
        .then((result) => {
          if (verboseErrors && result.isValid === false) {
            return result;
          }
          return { isValid: true };
        })
        // we do not want to reject since this method goal is
        // to know what is going wrong with the given spec
        .catch((error) => ({ errors: [error], isValid: false }))
    );
  }

  /**
   * @param {string} index
   * @param {string} collection
   * @param {CollectionSpecification} spec
   * @param {boolean} [dryRun]
   * @param {boolean} [verbose]
   * @returns {Promise<CollectionSpecification>}
   * @rejects PreconditionError
   */
  async curateCollectionSpecification(
    index,
    collection,
    spec,
    dryRun = false,
    verbose = false
  ) {
    let error = "";
    const processed = {
      fields: {},
      strict: spec.strict || false,
      validators: null,
    };
    const allowed = ["strict", "fields", "validators"];

    if (!checkAllowedProperties(spec, allowed)) {
      error = assertionError.get(
        "unexpected_properties",
        `${index}.${collection}`,
        allowed.join(", ")
      );

      if (verbose) {
        return { errors: [error.message], isValid: false };
      }

      throw error;
    }

    if (spec.fields) {
      const result = this.structureCollectionValidation(
        spec,
        index,
        collection,
        verbose
      );

      if (result.isValid === false) {
        if (verbose) {
          // do not fail fast if we need verbose errors
          return result;
        }

        throw assertionError.get(
          "invalid_specifications",
          result.errors.join("\n\t- ")
        );
      }
      processed.fields = result;
    }

    if (spec.validators && Array.isArray(spec.validators)) {
      try {
        const filterId = this.curateValidatorFilter(
          index,
          collection,
          spec.validators,
          dryRun
        );

        processed.validators = filterId;
      } catch (e) {
        global.kuzzle.log.error(e);
        throw assertionError.getFrom(e, "invalid_filters", e.message);
      }
    }

    return processed;
  }

  structureCollectionValidation(
    collectionSpec,
    indexName,
    collectionName,
    verboseErrors = false
  ) {
    const fields = {};
    let errors = [],
      maxDepth = 0;

    for (const fieldName of Object.keys(collectionSpec.fields)) {
      const // We deep clone the field because we will modify it
        fieldSpecClone = _.cloneDeep(collectionSpec.fields[fieldName]);

      try {
        const result = this.curateFieldSpecification(
          fieldSpecClone,
          indexName,
          collectionName,
          fieldName,
          verboseErrors
        );

        if (result.isValid === false) {
          errors = _.concat(errors, result.errors);
          global.kuzzle.log.error(result.errors.join("\n"));
        } else {
          const field = result.fieldSpec;

          field.path = fieldName.split("/");
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
        global.kuzzle.log.error(error);
        throwOrStoreError(error, verboseErrors, errors);
      }
    }

    if (errors.length > 0) {
      return { errors, isValid: false };
    }

    if (Object.keys(fields).length > 0) {
      return curateStructuredFields(this.typeAllowsChildren, fields, maxDepth);
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
      mandatory: false,
      multivalued: {
        value: false,
      },
    });

    if (!has(fieldSpec, "typeOptions")) {
      fieldSpec.typeOptions = {};
    }

    const allowed = this.types[fieldSpec.type].allowedTypeOptions || [];

    if (!checkAllowedProperties(fieldSpec.typeOptions, allowed)) {
      throwOrStoreError(
        assertionError.get(
          "unexpected_properties",
          `${indexName}.${collectionName}.${fieldName}`,
          allowed.join(", ")
        ),
        verboseErrors,
        errors
      );
    }

    try {
      fieldSpec.typeOptions = this.types[
        fieldSpec.type
      ].validateFieldSpecification(fieldSpec.typeOptions);
    } catch (e) {
      if (!verboseErrors) {
        if (e instanceof KuzzleError) {
          throw e;
        }
        throw kerror.getFrom(
          e,
          "plugin",
          "runtime",
          "unexpected_error",
          e.message
        );
      }

      errors.push(e.message);
    }

    if (errors.length > 0) {
      return { errors, isValid: false };
    }

    debug(
      "Loaded field validator: %s/%s/%s: %o",
      indexName,
      collectionName,
      fieldName,
      fieldSpec
    );

    return { fieldSpec, isValid: true };
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

    const props = [
      "mandatory",
      "type",
      "defaultValue",
      "description",
      "multivalued",
      "typeOptions",
    ];

    if (!checkAllowedProperties(fieldSpec, props)) {
      throwOrStoreError(
        assertionError.get(
          "unexpected_properties",
          `${indexName}.${collectionName}.${fieldName}`,
          props.join(", ")
        ),
        verboseErrors,
        errors
      );
    }

    if (!has(fieldSpec, "type")) {
      throwOrStoreError(
        assertionError.get(
          "missing_type",
          `${indexName}.${collectionName}.${fieldName}`
        ),
        verboseErrors,
        errors
      );
    }

    if (!has(this.types, fieldSpec.type)) {
      throwOrStoreError(
        assertionError.get(
          "unknown_type",
          `${indexName}.${collectionName}.${fieldName}`,
          fieldSpec.type
        ),
        verboseErrors,
        errors
      );
    }

    if (has(fieldSpec, "multivalued")) {
      const multivaluedProps = ["value", "minCount", "maxCount"];
      if (!checkAllowedProperties(fieldSpec.multivalued, multivaluedProps)) {
        throwOrStoreError(
          assertionError.get(
            "unexpected_properties",
            `${indexName}.${collectionName}.${fieldName}.multivalued`,
            multivaluedProps.join(", ")
          ),
          verboseErrors,
          errors
        );
      }

      if (!has(fieldSpec.multivalued, "value")) {
        throwOrStoreError(
          assertionError.get(
            "missing_value",
            `${indexName}.${collectionName}.${fieldName}.multivalued`
          ),
          verboseErrors,
          errors
        );
      }

      if (typeof fieldSpec.multivalued.value !== "boolean") {
        throwOrStoreError(
          assertionError.get(
            "invalid_type",
            `${indexName}.${collectionName}.${fieldName}.multivalued.value`,
            "boolean"
          ),
          verboseErrors,
          errors
        );
      }

      for (const unexpected of ["minCount", "maxCount"]) {
        if (
          !fieldSpec.multivalued.value &&
          has(fieldSpec.multivalued, unexpected)
        ) {
          throwOrStoreError(
            assertionError.get(
              "not_multivalued",
              `${indexName}.${collectionName}.${fieldName}`,
              unexpected
            ),
            verboseErrors,
            errors
          );
        }
      }

      if (
        has(fieldSpec.multivalued, "minCount") &&
        has(fieldSpec.multivalued, "maxCount") &&
        fieldSpec.multivalued.minCount > fieldSpec.multivalued.maxCount
      ) {
        throwOrStoreError(
          assertionError.get(
            "invalid_range",
            `${indexName}.${collectionName}.${fieldName}`,
            "minCount",
            "maxCount"
          ),
          verboseErrors,
          errors
        );
      }
    }

    if (errors.length > 0) {
      return { errors, isValid: false };
    }

    return { isValid: true };
  }

  /**
   * @param {string} indexName
   * @param {string} collectionName
   * @param {*} validatorFilter
   * @param {boolean} dryRun
   * @returns {string}
   */
  curateValidatorFilter(indexName, collectionName, validatorFilter, dryRun) {
    const query = {
      bool: {
        must: validatorFilter,
      },
    };

    this.koncorde.validate(query);

    if (!dryRun) {
      debug(
        "Registering filter validator %s/%s: %O",
        indexName,
        collectionName,
        query
      );

      return this.koncorde.register(
        query,
        toKoncordeIndex(indexName, collectionName)
      );
    }

    return null;
  }

  /**
   * @param {ValidationType} validationType
   * @throws {PluginImplementationError}
   */
  addType(validationType) {
    if (!validationType.typeName) {
      throw kerror.get("validation", "types", "missing_type_name");
    }

    if (
      !validationType.validate ||
      typeof validationType.validate !== "function"
    ) {
      throw kerror.get(
        "validation",
        "types",
        "missing_function",
        validationType.typeName,
        "validate"
      );
    }

    if (
      !validationType.validateFieldSpecification ||
      typeof validationType.validateFieldSpecification !== "function"
    ) {
      throw kerror.get(
        "validation",
        "types",
        "missing_function",
        validationType.typeName,
        "validateFieldSpecification"
      );
    }

    if (has(validationType, "allowChildren") && validationType.allowChildren) {
      if (
        !validationType.getStrictness ||
        typeof validationType.getStrictness !== "function"
      ) {
        throw kerror.get(
          "validation",
          "types",
          "missing_function",
          validationType.typeName,
          "getStrictness"
        );
      }

      this.typeAllowsChildren.push(validationType.typeName);
    }

    if (this.types[validationType.typeName]) {
      throw kerror.get(
        "validation",
        "types",
        "already_exists",
        validationType.typeName
      );
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
  if (!isPlainObject(object)) {
    return false;
  }

  return !Object.keys(object).some(
    (propertyName) => !allowedProperties.includes(propertyName)
  );
}

/**
 * @param {string[]} typeAllowsChildren
 * @param {StructuredFieldSpecification[][]} fields
 * @param {number} maxDepth : depth of the fields; counting starts at 1
 * @throws PreconditionError
 */
function curateStructuredFields(typeAllowsChildren, fields, maxDepth) {
  const /** @type StructuredFieldSpecification */
    structuredFields = {
      children: {},
      root: true,
    };

  for (let i = 1; i <= maxDepth; i++) {
    if (!has(fields, i)) {
      throw assertionError.get("missing_nested_spec");
    }

    fields[i].forEach((field) => {
      const parent = getParent(structuredFields, field.path),
        childKey = field.path[field.path.length - 1];

      if (!parent.root && typeAllowsChildren.indexOf(parent.type) === -1) {
        throw assertionError.get("unexpected_children", parent.type);
      }

      if (!has(parent, "children")) {
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
    if (!has(pointer.children, fieldPath[i])) {
      throw assertionError.get("missing_parent", fieldPath.join("."));
    }

    pointer = pointer.children[fieldPath[i]];
  }

  return pointer;
}

/**
 * @param {KuzzleError} error
 * @param {boolean} doNotThrow
 * @param {string[]} errors
 */
function throwOrStoreError(error, doNotThrow, errorMessages) {
  if (!doNotThrow) {
    throw error;
  }

  errorMessages.push(error.message);
}

/**
 * @param {string|string[]} errorContext
 * @param {string[]|{documentScope:string[], fieldScope: {children: ...*}}} errorHolder
 * @param {string} message
 * @param {boolean} structured
 */
function manageErrorMessage(errorContext, errorHolder, message, structured) {
  if (structured) {
    if (errorContext === "document") {
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

        if (!has(pointer.children, errorContext[i])) {
          pointer.children[errorContext[i]] = {};
        }
        pointer = pointer.children[errorContext[i]];
      }

      if (!has(pointer, "messages")) {
        pointer.messages = [];
      }

      pointer.messages.push(message);
    }
  } else if (errorContext === "document") {
    throw kerror.get("validation", "check", "failed_document", message);
  } else {
    throw kerror.get(
      "validation",
      "check",
      "failed_field",
      errorContext.join("."),
      message
    );
  }
}

/**
 * Retrieve the plugins list from the database and returns it,
 * along with their configuration
 *
 * @returns {Promise}
 */
function getValidationConfiguration() {
  return global.kuzzle.internalIndex
    .search("validations", {}, { from: 0, size: 1000 })
    .then((result) => {
      let validation = {};

      if (result && Array.isArray(result.hits) && result.hits.length > 0) {
        for (const { _source, _id } of result.hits) {
          const collectionName = `${_id.split("#")[0]}/${_id.split("#")[1]}`;

          if (!get(_source, "index")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "index"
            );
          }

          if (!get(_source, "collection")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "collection"
            );
          }

          if (!get(_source, "validation")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "validation"
            );
          }

          if (!has(validation, _source.index)) {
            validation[_source.index] = {};
          }

          validation[_source.index][_source.collection] = _source.validation;
        }
      } else if (global.kuzzle.config.validation) {
        // We can't wait prepareDb as it runs outside of the rest of the start
        validation = global.kuzzle.config.validation;
      }

      return validation;
    });
}

module.exports = Validation;
