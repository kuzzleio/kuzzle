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

import { inspect } from "node:util";

import Bluebird from "bluebird";
import { Koncorde } from "koncorde";
import type { JSONObject } from "kuzzle-sdk";
import { cloneDeep, defaultsDeep, isNil } from "lodash";

import type { KuzzleRequest } from "../../api/request";
import * as kerror from "../../kerror";
import { KuzzleError } from "../../kerror/errors";
import createDebug from "../../util/debug";
import { koncordeTest, toKoncordeIndex } from "../../util/koncordeCompat";
import { has, isPlainObject } from "../../util/safeObject";
import type BaseType from "./baseType";
import {
  checkAllowedProperties,
  curateStructuredFields,
  getValidationConfiguration,
  manageErrorMessage,
} from "./validationUtils";
import type {
  CollectionSpecification,
  CuratedCollectionSpecification,
  DocumentSpecification,
  ErrorMessages,
  FieldSpecification,
  RawSpecification,
  SpecificationValidationResult,
  CuratedFieldSpecification,
  StructuredFieldSpecification,
  UnplacedCuratedField,
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
 * The message of whatever was thrown.
 *
 * `catch` answers `unknown`, and the values that reach these handlers are not
 * all Errors: a plugin's validation type may throw anything, and the code has
 * always simply read `.message` off it. Narrowing to `Error` here would change
 * what those messages say, which the specs pin.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const message = "message" in error ? error.message : undefined;

    // `inspect`, not `String`: an object stringifies to "[object Object]".
    return typeof message === "string" ? message : inspect(error);
  }

  // A primitive. The strictness marker used to be a thrown string, and
  // reading it back verbatim is what recognises it.
  return typeof error === "string" ? error : inspect(error);
}

/**
 * The marker `recurseFieldValidation` throws when a document holds a field its
 * specification does not declare and the specification is strict.
 *
 * It is caught by message — `error.message !== "strictness"` — at two levels,
 * and carries the offending field name for the message the catcher builds. It
 * was a plain `Error` with an untyped `details` property bolted on.
 */
/**
 * The field name a strictness marker carries, read off whatever was thrown for
 * the same reason `messageOf` exists.
 */
function detailedField(error: unknown): string | undefined {
  if (error instanceof StrictnessError) {
    return error.details.field;
  }

  if (typeof error === "object" && error !== null && "details" in error) {
    const details = error.details;

    if (typeof details === "object" && details !== null && "field" in details) {
      // A field name is a string; anything else is not one to report.
      return typeof details.field === "string" ? details.field : undefined;
    }
  }

  return undefined;
}

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
    // Read from `input.args`, which is what the deprecated `input.resource`
    // getters return: same values, typed as those getters declare them.
    const { args } = request.input;
    const _id: string | null = args._id;
    const index: string | null = args.index;
    const collection: string | null = args.collection;

    // `has` rather than a plain lookup: `index` and `collection` come from the
    // request, so an inherited property must not answer for a specification.
    const indexSpec =
      index !== null && has(this.specification, index)
        ? this.specification[index]
        : undefined;
    const collectionSpec: Partial<CuratedCollectionSpecification> =
      (isPlainObject(this.specification) &&
        indexSpec !== undefined &&
        collection !== null &&
        has(indexSpec, collection) &&
        indexSpec[collection]) ||
      {};

    const { body, isUpdate } = await this.resolveValidationBody(
      request,
      index,
      collection,
      _id,
    );

    const errorMessages: ErrorMessages = verbose ? {} : [];
    let isValid = true;

    // `collectionSpec` is always truthy — it falls back to `{}` above — so the
    // enclosing `if (collectionSpec)` the JavaScript had was dead.
    const children = collectionSpec.fields?.children;

    if (children) {
      isValid = this.checkDocumentFields(
        body,
        children,
        collectionSpec.strict === true,
        errorMessages,
        verbose,
      );
    }

    if (collectionSpec.validators && index !== null && collection !== null) {
      isValid =
        this.checkValidators(
          index,
          collection,
          _id,
          body,
          collectionSpec.validators,
          errorMessages,
          verbose,
        ) && isValid;
    }

    if (!verbose) {
      // We only modify the request if the validation succeeds
      if (children) {
        request.input.body = this.recurseApplyDefault(
          isUpdate,
          request.input.body ?? {},
          children,
        );
      }

      return request;
    }

    return { errorMessages, valid: isValid };
  }

  /**
   * The body validation runs against: the request's own, or — on an update —
   * a copy merged over the stored document, so that a partial update is
   * validated as the document it will produce.
   */
  private async resolveValidationBody(
    request: KuzzleRequest,
    index: string | null,
    collection: string | null,
    _id: string | null,
  ): Promise<{ body: JSONObject | null; isUpdate: boolean }> {
    if (
      request.input.controller !== "document" ||
      request.input.action !== "update"
    ) {
      return { body: request.input.body, isUpdate: false };
    }

    const document = await global.kuzzle.ask(
      "core:storage:public:document:get",
      index,
      collection,
      _id,
    );

    // Avoid side effects on the request during the update validation
    const body = cloneDeep(request.input.body ?? {}); // NOSONAR structuredClone is not equivalent here: specifications and documents are user data, and a conversion does not get to change clone semantics
    defaultsDeep(body, document._source);

    return { body, isUpdate: true };
  }

  /**
   * Walks the document against the collection's field tree, turning a
   * root-level strictness breach into a message rather than an exception.
   */
  private checkDocumentFields(
    body: JSONObject | null,
    children: Record<string, CuratedFieldSpecification>,
    strict: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    try {
      return this.recurseFieldValidation(
        body,
        children,
        strict,
        errorMessages,
        verbose,
      );
    } catch (error) {
      // The strictness message can be received here only if it happens at
      // the validation of the document's root. Matched on the message, not on
      // `instanceof StrictnessError`: a validation type is plugin code and may
      // throw its own object, which is what the specs feed this.
      if (messageOf(error) !== "strictness") {
        throw error;
      }

      manageErrorMessage(
        "document",
        errorMessages,
        `The document validation is strict. Cannot add unspecified sub-field "${detailedField(error)}"`,
        verbose,
      );

      return false;
    }
  }

  /**
   * Checks the document against the collection's Koncorde validator filter.
   */
  private checkValidators(
    index: string,
    collection: string,
    _id: string | null,
    body: JSONObject | null,
    validators: string,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    const filters = koncordeTest(
      this.koncorde,
      index,
      collection,
      body ?? {},
      _id ?? undefined,
    );

    if (filters.length === 0 || filters[0] !== validators) {
      manageErrorMessage(
        "document",
        errorMessages,
        "The document does not match validation filters.",
        verbose,
      );

      return false;
    }

    return true;
  }

  /**
   * Fills a document subset in with the default values its specification
   * declares, recursing through the fields that allow children.
   */
  recurseApplyDefault(
    isUpdate: boolean,
    documentSubset: JSONObject,
    collectionSpecSubset: Record<string, CuratedFieldSpecification>,
  ): JSONObject {
    Object.entries(collectionSpecSubset).forEach(([fieldName, specSubset]) => {
      const field = documentSubset[fieldName];

      if (
        has(documentSubset, fieldName) &&
        this.typeOf(specSubset.type).allowChildren &&
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
    documentSubset: JSONObject | null,
    collectionSpecSubset: Record<string, CuratedFieldSpecification>,
    strictness: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    if (strictness) {
      for (const field of Object.keys(documentSubset ?? {})) {
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
          documentSubset ?? {},
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
          documentSubset ?? {},
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
    collectionSpecSubset: Record<string, CuratedFieldSpecification>,
    strictness: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    const field = collectionSpecSubset[fieldName];

    // Both callers drive this from the map's own keys; a name that is not in
    // it has no specification to check the document against.
    if (field === undefined) {
      return true;
    }

    if (
      field.mandatory &&
      !has(field, "defaultValue") &&
      isNil(documentSubset[fieldName])
    ) {
      manageErrorMessage(
        field.path,
        errorMessages,
        "The field is mandatory.",
        verbose,
      );
      return false;
    }

    if (isNil(documentSubset[fieldName])) {
      return true;
    }

    const fieldValues = this.resolveFieldValues(
      field,
      documentSubset[fieldName],
      errorMessages,
      verbose,
    );

    if (fieldValues === null) {
      return false;
    }

    const type = this.typeOf(field.type);
    const nestedStrictness = type.allowChildren
      ? type.getStrictness(field.typeOptions, strictness)
      : false;

    let result = true;

    for (const val of fieldValues) {
      if (!this.validateFieldValue(field, val, errorMessages, verbose)) {
        return false;
      }

      if (type.allowChildren && field.children) {
        result =
          this.validateFieldChildren(
            field,
            val,
            nestedStrictness,
            errorMessages,
            verbose,
          ) && result;
      }
    }

    return result;
  }

  /**
   * Answers the values to validate — the array itself for a multivalued field,
   * a single-element list otherwise — or `null` once it has filed the reason
   * the field's arity is wrong.
   */
  private resolveFieldValues(
    field: CuratedFieldSpecification,
    value: JSONObject,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): JSONObject[] | null {
    if (!field.multivalued.value) {
      if (Array.isArray(value)) {
        manageErrorMessage(
          field.path,
          errorMessages,
          "The field is not a multivalued field; Multiple values provided.",
          verbose,
        );
        return null;
      }

      return [value];
    }

    if (!Array.isArray(value)) {
      manageErrorMessage(
        field.path,
        errorMessages,
        "The field must be multivalued, unary value provided.",
        verbose,
      );
      return null;
    }

    const { minCount, maxCount } = field.multivalued;

    if (minCount !== undefined && value.length < minCount) {
      manageErrorMessage(
        field.path,
        errorMessages,
        `Not enough elements. Minimum count is set to ${minCount}.`,
        verbose,
      );
      return null;
    }

    if (maxCount !== undefined && value.length > maxCount) {
      manageErrorMessage(
        field.path,
        errorMessages,
        `Too many elements. Maximum count is set to ${maxCount}.`,
        verbose,
      );
      return null;
    }

    return value;
  }

  /**
   * Hands one value to the field's registered type.
   */
  private validateFieldValue(
    field: CuratedFieldSpecification,
    val: unknown,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    const fieldErrors: string[] = [];

    if (this.typeOf(field.type).validate(field.typeOptions, val, fieldErrors)) {
      return true;
    }

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

  /**
   * Recurses into a value's children, turning this field's strictness breach
   * into a message rather than an exception.
   */
  private validateFieldChildren(
    field: CuratedFieldSpecification,
    val: JSONObject,
    nestedStrictness: boolean,
    errorMessages: ErrorMessages,
    verbose: boolean,
  ): boolean {
    try {
      return this.recurseFieldValidation(
        val,
        field.children ?? {},
        nestedStrictness,
        errorMessages,
        verbose,
      );
    } catch (error) {
      if (messageOf(error) === "strictness") {
        manageErrorMessage(
          field.path,
          errorMessages,
          `The field is set to "strict"; cannot add unspecified sub-field "${detailedField(error)}".`,
          verbose,
        );
      } else if (verbose) {
        manageErrorMessage(
          field.path,
          errorMessages,
          messageOf(error),
          verbose,
        );
      } else {
        throw error;
      }

      return false;
    }
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

      for (const [indexName, collections] of Object.entries(
        this.rawConfiguration,
      )) {
        for (const [collectionName, collectionSpec] of Object.entries(
          collections,
        )) {
          const promise = this.curateCollectionSpecification(
            indexName,
            collectionName,
            collectionSpec,
          )
            .then((curatedSpec) => {
              const indexSpec = (specification[indexName] ??= {});

              indexSpec[collectionName] = curatedSpec;

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
    const specification = cloneDeep(collectionSpec); // NOSONAR structuredClone is not equivalent here: specifications and documents are user data, and a conversion does not get to change clone semantics

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
          (result.errors ?? []).join("\n\t- "),
        );
      }

      processed.fields = result;
    }

    if (spec.validators && Array.isArray(spec.validators)) {
      processed.validators = this.curateValidators(
        index,
        collection,
        spec.validators,
        dryRun,
      );
    }

    return processed;
  }

  /**
   * Registers a specification's validator filter and answers its id.
   *
   * The wrapping is what `curateCollectionSpecification` did inline: a filter
   * Koncorde refuses is an `invalid_filters` assertion, logged on the way
   * past.
   */
  private curateValidators(
    index: string,
    collection: string,
    validators: JSONObject[],
    dryRun: boolean,
  ): string | null {
    try {
      return this.curateValidatorFilter(index, collection, validators, dryRun);
    } catch (e) {
      this.logger.error(e);

      throw assertionError.getFrom(
        e instanceof Error ? e : new Error(messageOf(e)),
        "invalid_filters",
        messageOf(e),
      );
    }
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
    const fields: Record<number, CuratedFieldSpecification[]> = {};
    let errors: string[] = [];
    let maxDepth = 0;

    for (const [fieldName, fieldSpec] of Object.entries(
      collectionSpec.fields ?? {},
    )) {
      const // We deep clone the field because we will modify it
        fieldSpecClone = cloneDeep(fieldSpec); // NOSONAR structuredClone is not equivalent here: specifications and documents are user data, and a conversion does not get to change clone semantics

      try {
        const result = this.curateFieldSpecification(
          fieldSpecClone,
          indexName,
          collectionName,
          fieldName,
          verboseErrors,
        );

        if (result.isValid === false || result.fieldSpec === undefined) {
          const resultErrors = result.errors ?? [];

          errors = errors.concat(resultErrors);
          this.logger.error(resultErrors.join("\n"));
        } else {
          // `curateFieldSpecification` answers everything but the field's
          // place in the tree; the key it was filed under is what gives it one.
          const path = fieldName.split("/");
          const field: CuratedFieldSpecification = {
            ...result.fieldSpec,
            depth: path.length,
            path,
          };

          if (field.depth > maxDepth) {
            maxDepth = field.depth;
          }

          const sameDepth = (fields[field.depth] ??= []);

          sameDepth.push(field);
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
    fieldSpec?: UnplacedCuratedField;
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

    // Built rather than `defaultsDeep`-ed in place: the defaults are what turn
    // a submitted field into a curated one, and saying so is what lets the
    // return type be `UnplacedCuratedField` instead of the submitted shape.
    const curated: UnplacedCuratedField = {
      ...fieldSpec,
      mandatory: fieldSpec.mandatory ?? false,
      multivalued: { value: false, ...fieldSpec.multivalued },
      typeOptions: fieldSpec.typeOptions ?? {},
    };

    const allowed = this.typeOf(curated.type).allowedTypeOptions || [];

    if (!checkAllowedProperties(curated.typeOptions, allowed)) {
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
      curated.typeOptions = this.typeOf(
        curated.type,
      ).validateFieldSpecification(curated.typeOptions);
    } catch (e) {
      const cause = e instanceof Error ? e : new Error(messageOf(e));

      if (!verboseErrors) {
        if (e instanceof KuzzleError) {
          throw e;
        }
        throw kerror.getFrom(
          cause,
          "plugin",
          "runtime",
          "unexpected_error",
          cause.message,
        );
      }

      errors.push(cause.message);
    }

    if (errors.length > 0) {
      return { errors, isValid: false };
    }

    debug(
      "Loaded field validator: %s/%s/%s: %o",
      indexName,
      collectionName,
      fieldName,
      curated,
    );

    return { fieldSpec: curated, isValid: true };
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

    checkMultivaluedSpecification(
      fieldSpec,
      indexName,
      collectionName,
      fieldName,
      verboseErrors,
      errors,
    );

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

  /**
   * The validation type a curated field declares.
   *
   * Every caller reaches this through a field that `curateFieldSpecification`
   * has been through, and that method refuses a `type` the map does not hold —
   * so the throw here is the invariant restated where the compiler can see it,
   * not a new failure mode.
   *
   * @throws {PreconditionError} when the type is not registered
   */
  private typeOf(typeName: string): BaseType {
    const type = this.types[typeName];

    if (type === undefined) {
      throw kerror.get("validation", "types", "missing_type_name", typeName);
    }

    return type;
  }
}

/**
 * Checks a field's `multivalued` block. Lifted verbatim out of
 * `curateFieldSpecificationFormat`, whose cognitive complexity the `.js` → `.ts`
 * rename re-scored as new code.
 */
function checkMultivaluedSpecification(
  fieldSpec: FieldSpecification,
  indexName: string,
  collectionName: string,
  fieldName: string,
  verboseErrors: boolean,
  errors: string[],
): void {
  const multivalued = fieldSpec.multivalued;

  if (multivalued === undefined) {
    return;
  }

  const multivaluedProps = ["value", "minCount", "maxCount"];
  if (!checkAllowedProperties(multivalued, multivaluedProps)) {
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

  if (!has(multivalued, "value")) {
    throwOrStoreError(
      assertionError.get(
        "missing_value",
        `${indexName}.${collectionName}.${fieldName}.multivalued`,
      ),
      verboseErrors,
      errors,
    );
  }

  if (typeof multivalued.value !== "boolean") {
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
    if (!multivalued.value && has(multivalued, unexpected)) {
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
    multivalued.minCount !== undefined &&
    multivalued.maxCount !== undefined &&
    multivalued.minCount > multivalued.maxCount
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

/**
 * Rethrows, or collects the message — the single place the verbose/fail-fast
 * choice is made during curation.
 */
function throwOrStoreError(
  error: unknown,
  doNotThrow: boolean,
  errorMessages: string[],
): void {
  if (!doNotThrow) {
    throw error;
  }

  errorMessages.push(messageOf(error));
}

export = Validation;
