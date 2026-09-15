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

import Bluebird from "bluebird";
import { Koncorde } from "koncorde";
import type { JSONObject } from "kuzzle-sdk";
import _ from "lodash";

import type { KuzzleRequest } from "../../api/request";
import * as kerror from "../../kerror";
import { KuzzleError } from "../../kerror/errors";
import createDebug from "../../util/debug";
import { koncordeTest, toKoncordeIndex } from "../../util/koncordeCompat";
import { get, has, isPlainObject } from "../../util/safeObject";
import type BaseType from "./baseType";
import type {
  CollectionSpecification,
  CuratedCollectionSpecification,
  DocumentSpecification,
  ErrorMessages,
  FieldSpecification,
  RawSpecification,
  SpecificationValidationResult,
  StructuredFieldSpecification,
  VerboseErrorMessages,
} from "./specification";
import AnythingType from "./types/anything";
import BooleanType from "./types/boolean";
import DateType from "./types/date";
import EmailType from "./types/email";
import EnumType from "./types/enum";
import GeoPointType from "./types/geoPoint";
import GeoShapeType from "./types/geoShape";
import IntegerType from "./types/integer";
import IpAddressType from "./types/ipAddress";
import NumericType from "./types/numeric";
import ObjectType from "./types/object";
import StringType from "./types/string";
import UrlType from "./types/url";

const debug = createDebug("core:validation");

const assertionError = kerror.wrap("validation", "assert");

/**
 * The 13 built-in types, in the order `init` registers them.
 *
 * They were loaded by `require(`./types/${typeFile}`)` over a list of names.
 * That is a runtime `require` in a function body, which is the third spelling
 * of the defect TD-49 catalogued: a bundler cannot see it, so the module is
 * unloadable from a runner that resolves the import graph itself. Naming the
 * constructors statically also lets `addType`'s contract be checked at compile
 * time for the built-ins, where before only the runtime assertions in `addType`
 * stood between a typo and a broken boot.
 */
const BUILT_IN_TYPES = [
  AnythingType,
  BooleanType,
  DateType,
  EmailType,
  EnumType,
  GeoPointType,
  GeoShapeType,
  IntegerType,
  IpAddressType,
  NumericType,
  ObjectType,
  StringType,
  UrlType,
];

/**
 * The marker `recurseFieldValidation` throws when a document holds a field its
 * specification does not declare and the specification is strict.
 *
 * It is caught by message — `error.message !== "strictness"` — at two levels,
 * and carries the offending field name for the message the catcher builds. It
 * was a plain `Error` with an untyped `details` property bolted on.
 */
class StrictnessError extends Error {
  public details: { field: string };

  constructor(field: string) {
    super("strictness");
    this.details = { field };
  }
}

/**
 * Narrows the "a curated value, or a report of why it could not be curated"
 * pair that four of the curation methods answer with.
 *
 * The pair is not a discriminated union — the success branch is the curated
 * value itself and carries no tag — so the discriminator has to be the failure
 * shape. `"isValid" in result` is what makes this a guard rather than a cast,
 * and TD-43's `casts` ratchet is the reason it matters.
 */
function isCurationFailure<T extends object>(
  result: T | SpecificationValidationResult,
): result is SpecificationValidationResult {
  return "isValid" in result && result.isValid === false;
}

class Validation {
  public types: Record<string, BaseType>;
  public typeAllowsChildren: string[];
  public specification: DocumentSpecification;
  public koncorde: Koncorde;
  public rawConfiguration: RawSpecification;
  public logger: ReturnType<typeof global.kuzzle.log.child>;

  constructor() {
    this.types = {};

    this.typeAllowsChildren = [];

    this.specification = {};

    this.koncorde = new Koncorde();

    this.rawConfiguration = {};
    this.logger = global.kuzzle.log.child("core:validation");
  }

  /**
   * Registers every built-in validation type.
   */
  init(): void {
    for (const TypeConstructor of BUILT_IN_TYPES) {
      this.addType(new TypeConstructor());
    }
  }

  /**
   * Validates a document against its collection specifications.
   *
   * Answers the request itself when `verbose` is false — the caller's document
   * has had its defaults applied in place — and a report when it is true.
   */
  async validate(
    request: KuzzleRequest,
    verbose?: false,
  ): Promise<KuzzleRequest>;
  async validate(
    request: KuzzleRequest,
    verbose: true,
  ): Promise<{ errorMessages: VerboseErrorMessages; valid: boolean }>;
  async validate(
    request: KuzzleRequest,
    verbose = false,
  ): Promise<KuzzleRequest | { errorMessages: ErrorMessages; valid: boolean }> {
    const { _id, index, collection } = request.input.resource;

    // `has` rather than a plain lookup: `index` and `collection` come from the
    // request, so an inherited property must not answer for a specification.
    const indexSpec = has(this.specification, index)
      ? this.specification[index]
      : undefined;
    const collectionSpec: Partial<CuratedCollectionSpecification> =
      (isPlainObject(this.specification) &&
        indexSpec !== undefined &&
        has(indexSpec, collection) &&
        indexSpec[collection]) ||
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
        _id,
      );

      // Avoid side effects on the request during the update validation
      body = _.cloneDeep(request.input.body);
      _.defaultsDeep(body, document._source);
    }

    const errorMessages: ErrorMessages = verbose ? {} : [];
    let isValid = true;

    if (collectionSpec) {
      if (collectionSpec.fields && collectionSpec.fields.children) {
        try {
          isValid = this.recurseFieldValidation(
            body,
            collectionSpec.fields.children,
            collectionSpec.strict,
            errorMessages,
            verbose,
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
            verbose,
          );
        }
      }

      if (collectionSpec.validators) {
        const filters = koncordeTest(
          this.koncorde,
          index,
          collection,
          body,
          _id,
        );

        if (filters.length === 0 || filters[0] !== collectionSpec.validators) {
          isValid = false;
          manageErrorMessage(
            "document",
            errorMessages,
            "The document does not match validation filters.",
            verbose,
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
          collectionSpec.fields.children,
        );
      }

      return request;
    }

    return { errorMessages, valid: isValid };
  }

  /**
   * Fills a document subset in with the default values its specification
   * declares, recursing through the fields that allow children.
   */
  recurseApplyDefault(
    isUpdate: boolean,
    documentSubset: JSONObject,
    collectionSpecSubset: Record<string, StructuredFieldSpecification>,
  ): JSONObject {
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
              specSubset.children,
            );
          }
        } else {
          documentSubset[fieldName] = this.recurseApplyDefault(
            isUpdate,
            field,
            specSubset.children,
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
   * Validates every field of a document subset against its specification.
   *
   * @throws {StrictnessError} when `strictness` holds and the subset declares a
   * field the specification does not — caught by the two callers, which turn it
   * into a message naming the field.
   */
  recurseFieldValidation(
    documentSubset: JSONObject,
    collectionSpecSubset: Record<string, StructuredFieldSpecification>,
    strictness: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    if (strictness) {
      for (const field of Object.keys(documentSubset)) {
        if (!collectionSpecSubset[field]) {
          throw new StrictnessError(field);
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
          verbose,
        ),
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
          verbose,
        ) && reductionResult,
      true,
    );
  }

  /**
   * Validates one field of a document subset against its specification.
   */
  isValidField(
    fieldName: string,
    documentSubset: JSONObject,
    collectionSpecSubset: Record<string, StructuredFieldSpecification>,
    strictness: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
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
        verbose,
      );
      return false;
    }

    if (!_.isNil(documentSubset[fieldName])) {
      let nestedStrictness = false;
      let fieldValues: unknown[];

      if (field.multivalued.value) {
        if (!Array.isArray(documentSubset[fieldName])) {
          manageErrorMessage(
            field.path,
            errorMessages,
            "The field must be multivalued, unary value provided.",
            verbose,
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
            verbose,
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
            verbose,
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
            verbose,
          );
          return false;
        }

        fieldValues = [documentSubset[fieldName]];
      }

      if (this.types[field.type].allowChildren) {
        nestedStrictness = this.types[field.type].getStrictness(
          field.typeOptions,
          strictness,
        );
      }

      for (const val of fieldValues) {
        const fieldErrors: string[] = [];

        if (
          !this.types[field.type].validate(field.typeOptions, val, fieldErrors)
        ) {
          if (fieldErrors.length === 0) {
            // We still want to trigger an error, even if no message is provided
            manageErrorMessage(
              field.path,
              errorMessages,
              "An error has occurred during validation.",
              verbose,
            );
          } else {
            fieldErrors.forEach((message) =>
              manageErrorMessage(field.path, errorMessages, message, verbose),
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
                verbose,
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
                verbose,
              );
            } else if (verbose) {
              manageErrorMessage(
                field.path,
                errorMessages,
                error.message,
                verbose,
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
   * Loads every stored specification, curates it, and swaps the result in.
   *
   * A collection whose specification does not curate is logged and skipped, so
   * one bad specification cannot keep the others from being applied.
   */
  curateSpecification(): Promise<void> {
    const promises: Promise<null>[] = [];
    const specification: DocumentSpecification = {};

    return getValidationConfiguration().then((validation) => {
      this.rawConfiguration = validation;

      for (const indexName of Object.keys(this.rawConfiguration)) {
        for (const collectionName of Object.keys(
          this.rawConfiguration[indexName],
        )) {
          const promise = this.curateCollectionSpecification(
            indexName,
            collectionName,
            this.rawConfiguration[indexName][collectionName],
          )
            .then((curatedSpec) => {
              if (!has(specification, indexName)) {
                specification[indexName] = {};
              }

              specification[indexName][collectionName] = curatedSpec;

              return null;
            })
            .catch((error) => {
              this.logger.error(
                `Specification for the collection ${collectionName} triggered an error`,
              );
              this.logger.error(`Error: ${error.message}`);

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
   * Reports whether a specification would curate, without registering it.
   */
  validateFormat(
    indexName: string,
    collectionName: string,
    collectionSpec: CollectionSpecification,
    verboseErrors = false,
  ): Promise<SpecificationValidationResult> {
    // We make a deep clone to avoid side effects
    const specification = _.cloneDeep(collectionSpec);

    return (
      this.curateCollectionSpecification(
        indexName,
        collectionName,
        specification,
        true,
        verboseErrors,
      )
        .then((result) => {
          if (verboseErrors && isCurationFailure(result)) {
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
   * Turns a submitted specification into the tree the validator walks.
   *
   * Answers a {@link SpecificationValidationResult} instead of throwing when
   * `verbose` holds, which is what lets `validateFormat` collect every problem
   * rather than the first one.
   *
   * @throws {PreconditionError}
   */
  async curateCollectionSpecification(
    index: string,
    collection: string,
    spec: CollectionSpecification,
    dryRun?: boolean,
    verbose?: false,
  ): Promise<CuratedCollectionSpecification>;
  async curateCollectionSpecification(
    index: string,
    collection: string,
    spec: CollectionSpecification,
    dryRun: boolean,
    verbose: boolean,
  ): Promise<CuratedCollectionSpecification | SpecificationValidationResult>;
  async curateCollectionSpecification(
    index: string,
    collection: string,
    spec: CollectionSpecification,
    dryRun = false,
    verbose = false,
  ): Promise<CuratedCollectionSpecification | SpecificationValidationResult> {
    let error: KuzzleError;
    const processed: CuratedCollectionSpecification = {
      fields: {},
      strict: spec.strict || false,
      validators: null,
    };
    const allowed = ["strict", "fields", "validators"];

    if (!checkAllowedProperties(spec, allowed)) {
      error = assertionError.get(
        "unexpected_properties",
        `${index}.${collection}`,
        allowed.join(", "),
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
        verbose,
      );

      if (isCurationFailure(result)) {
        if (verbose) {
          // do not fail fast if we need verbose errors
          return result;
        }

        throw assertionError.get(
          "invalid_specifications",
          result.errors.join("\n\t- "),
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
          dryRun,
        );

        processed.validators = filterId;
      } catch (e) {
        this.logger.error(e);
        throw assertionError.getFrom(e, "invalid_filters", e.message);
      }
    }

    return processed;
  }

  /**
   * Curates every field of a specification, then assembles them into a tree.
   */
  structureCollectionValidation(
    collectionSpec: CollectionSpecification,
    indexName: string,
    collectionName: string,
    verboseErrors = false,
  ): StructuredFieldSpecification | SpecificationValidationResult {
    const fields: Record<number, StructuredFieldSpecification[]> = {};
    let errors: string[] = [];
    let maxDepth = 0;

    for (const fieldName of Object.keys(collectionSpec.fields)) {
      const // We deep clone the field because we will modify it
        fieldSpecClone = _.cloneDeep(collectionSpec.fields[fieldName]);

      try {
        const result = this.curateFieldSpecification(
          fieldSpecClone,
          indexName,
          collectionName,
          fieldName,
          verboseErrors,
        );

        if (result.isValid === false) {
          errors = _.concat(errors, result.errors);
          this.logger.error(result.errors.join("\n"));
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
        this.logger.error(error);
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
   * Fills a field specification's defaults in and hands its `typeOptions` to
   * the type that owns them.
   *
   * @throws {PreconditionError}
   */
  curateFieldSpecification(
    fieldSpec: FieldSpecification,
    indexName: string,
    collectionName: string,
    fieldName: string,
    verboseErrors = false,
  ): SpecificationValidationResult & {
    fieldSpec?: StructuredFieldSpecification;
  } {
    const errors: string[] = [];

    const result = this.curateFieldSpecificationFormat(
      fieldSpec,
      indexName,
      collectionName,
      fieldName,
      verboseErrors,
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
          allowed.join(", "),
        ),
        verboseErrors,
        errors,
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
          e.message,
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
      fieldSpec,
    );

    return { fieldSpec, isValid: true };
  }

  /**
   * Checks a field specification's shape, before any type is consulted.
   *
   * @throws {PreconditionError}
   */
  curateFieldSpecificationFormat(
    fieldSpec: FieldSpecification,
    indexName: string,
    collectionName: string,
    fieldName: string,
    verboseErrors = false,
  ): SpecificationValidationResult {
    const errors: string[] = [];

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
          props.join(", "),
        ),
        verboseErrors,
        errors,
      );
    }

    if (!has(fieldSpec, "type")) {
      throwOrStoreError(
        assertionError.get(
          "missing_type",
          `${indexName}.${collectionName}.${fieldName}`,
        ),
        verboseErrors,
        errors,
      );
    }

    if (!has(this.types, fieldSpec.type)) {
      throwOrStoreError(
        assertionError.get(
          "unknown_type",
          `${indexName}.${collectionName}.${fieldName}`,
          fieldSpec.type,
        ),
        verboseErrors,
        errors,
      );
    }

    if (has(fieldSpec, "multivalued")) {
      const multivaluedProps = ["value", "minCount", "maxCount"];
      if (!checkAllowedProperties(fieldSpec.multivalued, multivaluedProps)) {
        throwOrStoreError(
          assertionError.get(
            "unexpected_properties",
            `${indexName}.${collectionName}.${fieldName}.multivalued`,
            multivaluedProps.join(", "),
          ),
          verboseErrors,
          errors,
        );
      }

      if (!has(fieldSpec.multivalued, "value")) {
        throwOrStoreError(
          assertionError.get(
            "missing_value",
            `${indexName}.${collectionName}.${fieldName}.multivalued`,
          ),
          verboseErrors,
          errors,
        );
      }

      if (typeof fieldSpec.multivalued.value !== "boolean") {
        throwOrStoreError(
          assertionError.get(
            "invalid_type",
            `${indexName}.${collectionName}.${fieldName}.multivalued.value`,
            "boolean",
          ),
          verboseErrors,
          errors,
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
              unexpected,
            ),
            verboseErrors,
            errors,
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
            "maxCount",
          ),
          verboseErrors,
          errors,
        );
      }
    }

    if (errors.length > 0) {
      return { errors, isValid: false };
    }

    return { isValid: true };
  }

  /**
   * Registers a collection's validators as a Koncorde filter and answers its
   * id — or validates it and answers `null`, on a dry run.
   */
  curateValidatorFilter(
    indexName: string,
    collectionName: string,
    validatorFilter: JSONObject[],
    dryRun: boolean,
  ): string | null {
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
        query,
      );

      return this.koncorde.register(
        query,
        toKoncordeIndex(indexName, collectionName),
      );
    }

    return null;
  }

  /**
   * Registers a validation type, built-in or plugin-provided.
   *
   * This is public API: `pluginContext` hands it to every plugin, so the
   * runtime assertions below are the contract and stay exactly as they were —
   * a plugin's type is not checked by the compiler.
   *
   * @throws {PluginImplementationError}
   */
  addType(validationType: BaseType): void {
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
        "validate",
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
        "validateFieldSpecification",
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
          "getStrictness",
        );
      }

      this.typeAllowsChildren.push(validationType.typeName);
    }

    if (this.types[validationType.typeName]) {
      throw kerror.get(
        "validation",
        "types",
        "already_exists",
        validationType.typeName,
      );
    }

    this.types[validationType.typeName] = validationType;
  }
}

/**
 * Narrows `object` to a plain object holding none but the allowed properties.
 */
function checkAllowedProperties(
  object: unknown,
  allowedProperties: string[],
): object is Record<string, unknown> {
  if (!isPlainObject(object)) {
    return false;
  }

  return !Object.keys(object).some(
    (propertyName) => !allowedProperties.includes(propertyName),
  );
}

/**
 * Assembles curated fields, grouped by depth, into the tree the validator
 * walks. Depth counting starts at 1.
 *
 * @throws {PreconditionError}
 */
function curateStructuredFields(
  typeAllowsChildren: string[],
  fields: Record<number, StructuredFieldSpecification[]>,
  maxDepth: number,
): StructuredFieldSpecification {
  const structuredFields: StructuredFieldSpecification = {
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
 * Walks a field's path down the tree and answers the node that must hold it.
 *
 * @throws {PreconditionError} when an intermediate node is missing
 */
function getParent(
  structuredFields: StructuredFieldSpecification,
  fieldPath: string[],
): StructuredFieldSpecification {
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
 * Rethrows, or collects the message — the single place the verbose/fail-fast
 * choice is made during curation.
 */
function throwOrStoreError(
  error: KuzzleError,
  doNotThrow: boolean,
  errorMessages: string[],
): void {
  if (!doNotThrow) {
    throw error;
  }

  errorMessages.push(error.message);
}

/**
 * Files a validation message, or throws it.
 *
 * When `structured` holds, the message is hung off `errorHolder` at the field's
 * own path so the caller can report it in place; when it does not, the first
 * message throws and the holder is never written to.
 *
 * @throws {BadRequestError} when `structured` is false
 */
function manageErrorMessage(
  errorContext: string | string[],
  errorHolder: ErrorMessages,
  message: string,
  structured: boolean,
): void {
  if (structured) {
    // `structured` and the holder's shape are the same fact: `validate` builds
    // an object exactly when `verbose` holds, and a list when it does not. The
    // narrowing is what says so; the branch cannot be taken.
    if (Array.isArray(errorHolder)) {
      return;
    }

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
    // Everything that is not the "document" literal is a field path.
    throw kerror.get(
      "validation",
      "check",
      "failed_field",
      Array.isArray(errorContext) ? errorContext.join(".") : errorContext,
      message,
    );
  }
}

/**
 * Reads every stored specification, falling back to the one in the
 * configuration when the internal index holds none — the database is not
 * necessarily prepared yet when this first runs.
 */
function getValidationConfiguration(): Promise<RawSpecification> {
  return global.kuzzle.internalIndex
    .search("validations", {}, { from: 0, size: 1000 })
    .then((result) => {
      let validation: RawSpecification = {};

      if (result && Array.isArray(result.hits) && result.hits.length > 0) {
        for (const { _source, _id } of result.hits) {
          const collectionName = `${_id.split("#")[0]}/${_id.split("#")[1]}`;

          if (!get(_source, "index")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "index",
            );
          }

          if (!get(_source, "collection")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "collection",
            );
          }

          if (!get(_source, "validation")) {
            throw assertionError.get(
              "incorrect_validation_format",
              collectionName,
              "validation",
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

export = Validation;
