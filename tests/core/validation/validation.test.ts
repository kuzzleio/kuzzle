import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BaseType from "../../../lib/core/validation/baseType";
import type {
  CollectionSpecification,
  CuratedCollectionSpecification,
  FieldSpecification,
  SpecificationValidationResult,
  StructuredFieldSpecification,
} from "../../../lib/core/validation/specification";
import Validation from "../../../lib/core/validation/validation";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/**
 * A validation type reduced to the one or two members a test is about.
 *
 * `addType` is public API — `pluginContext` hands it to every plugin — so what
 * a `BaseType` owes the subject is checked at runtime, not by the compiler.
 * A spec arranging `validation.types.string` is standing in for a plugin's
 * type, and a plugin's type is whatever it is.
 */
const stubType = (members: Partial<BaseType>): BaseType => members as BaseType;

/** The index and collection a curation is being asked about. */
const ANY_INDEX = "anIndex";
const ANY_COLLECTION = "aCollection";
const ANY_FIELD = "aField";

/** `anIndex.aCollection.aField`, which is how the subject names a field. */
const SCOPE = `${ANY_INDEX}.${ANY_COLLECTION}.${ANY_FIELD}`;

describe("#core/validation/validation", () => {
  let validation: Validation;
  let logger: ReturnType<typeof stubLogger>;
  let search: Mock;

  beforeEach(() => {
    logger = stubLogger();
    search = vi.fn().mockResolvedValue(undefined);

    /**
     * ⚠️ `internalIndex.search` rather than an `ask` answerer. The Mocha spec
     * stubbed `kuzzle.ask` with the event
     * `core:storage:private:document:search`, which the subject never names:
     * `getValidationConfiguration` calls `global.kuzzle.internalIndex.search`,
     * and `internalIndex` is a `Store` whose methods are *generated* as calls
     * onto that bus. The arrangement was live, but only through a mock that
     * subclassed the real `Store` — two indirections that had to be right for
     * a fixture to reach the subject. Stubbing the method the subject calls is
     * the same test with neither of them.
     */
    stubKuzzle({
      config: { validation: {} },
      internalIndex: { search },
      log: logger,
    });

    validation = new Validation();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("has the expected structure", () => {
    expect(validation.types).toBeTypeOf("object");
    expect(validation.specification).toBeTypeOf("object");
    expect(validation.koncorde).toBeTypeOf("object");
    expect(validation.rawConfiguration).toBeTypeOf("object");
    expect(Array.isArray(validation.typeAllowsChildren)).toBe(true);
  });

  describe("#init", () => {
    /**
     * ⚠️ The Mocha test registered a stub over each of the thirteen
     * `lib/core/validation/types/*` modules and asserted that the stub was
     * constructed thirteen times and `addType` called thirteen times. Both
     * counts, and nothing about *which* types were registered — it could not
     * say more, because every type was the same anonymous stub.
     *
     * The registration is directly observable: `init()` fills
     * `validation.types`, keyed by each type's own `typeName`. Asserting the
     * thirteen names tests `init` *and* `addType` against the public surface,
     * and catches a type dropped from `BUILT_IN_TYPES` — which the call count
     * would have reported only as "twelve".
     */
    it("registers every built-in type under its own name", () => {
      validation.init();

      expect(Object.keys(validation.types).sort()).toEqual([
        "anything",
        "boolean",
        "date",
        "email",
        "enum",
        "geo_point",
        "geo_shape",
        "integer",
        "ip_address",
        "numeric",
        "object",
        "string",
        "url",
      ]);
    });

    it("records the built-in types that allow children", () => {
      validation.init();

      expect(validation.typeAllowsChildren).toEqual(["object"]);
    });
  });

  describe("#curateSpecification", () => {
    /**
     * The three stored specifications the search answers with.
     *
     * `_id` is not read — `collectStoredSpecification` takes the index and the
     * collection off `_source` — which is why the Mocha fixture's third hit
     * could carry `_id: "anIndex#anotherCollection"` over an `_source` saying
     * `anotherIndex` without anyone noticing. Named consistently here.
     */
    const stored = (index: string, collection: string, spec: object) => ({
      _id: `${index}#${collection}`,
      _source: { collection, index, validation: spec },
    });

    const configuration = {
      anIndex: {
        aCollection: { a: "specification" },
        anotherCollection: { another: "specification" },
      },
      anotherIndex: {
        anotherCollection: { another: "specification" },
      },
    };

    beforeEach(() => {
      search.mockResolvedValue({
        hits: [
          stored("anIndex", "aCollection", { a: "specification" }),
          stored("anIndex", "anotherCollection", { another: "specification" }),
          stored("anotherIndex", "anotherCollection", {
            another: "specification",
          }),
        ],
        length: 3,
      });
    });

    it("builds a specification out of what is stored", async () => {
      const curate = vi.fn(
        async (index: string, collection: string, spec: unknown) => spec,
      );

      validation.curateCollectionSpecification =
        curate as unknown as Validation["curateCollectionSpecification"];

      await validation.curateSpecification();

      expect(validation.rawConfiguration).toEqual(configuration);
      expect(validation.specification).toEqual(configuration);
    });

    it("skips the collections that fail to curate, and logs each one", async () => {
      validation.curateCollectionSpecification = vi.fn(async () => {
        throw new Error("error");
      }) as unknown as Validation["curateCollectionSpecification"];

      await validation.curateSpecification();

      expect(validation.rawConfiguration).toEqual(configuration);
      expect(validation.specification).toEqual({});
      // two lines per failed collection: the collection, then the message
      expect(logger.error).toHaveBeenCalledTimes(6);
    });
  });

  describe("#validateFormat", () => {
    it("resolves valid when the specification curates", async () => {
      const curate = vi.fn(async () => ({}));

      validation.curateCollectionSpecification =
        curate as unknown as Validation["curateCollectionSpecification"];

      const result = await validation.validateFormat(
        ANY_INDEX,
        ANY_COLLECTION,
        { fields: {} },
      );

      expect(curate).toHaveBeenCalledOnce();
      expect(result.isValid).toBe(true);
    });

    it("resolves invalid when the curation rejects", async () => {
      const curate = vi
        .spyOn(validation, "curateCollectionSpecification")
        .mockRejectedValue(new Error("Mocked Error"));

      const result = await validation.validateFormat(
        ANY_INDEX,
        ANY_COLLECTION,
        { fields: {} },
      );

      expect(curate).toHaveBeenCalledOnce();
      expect(result.isValid).toBe(false);
    });

    it("carries the errors back in verbose mode", async () => {
      const curate = vi
        .spyOn(validation, "curateCollectionSpecification")
        .mockResolvedValue({ errors: ["some error"], isValid: false });

      const result = await validation.validateFormat(
        ANY_INDEX,
        ANY_COLLECTION,
        { fields: {} },
        true,
      );

      expect(curate).toHaveBeenCalledOnce();
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["some error"]);
    });
  });

  describe("#addType", () => {
    it("adds a type", () => {
      const validationType = stubType({
        allowChildren: false,
        typeName: "aType",
        validate: () => true,
        validateFieldSpecification: (options) => options,
      });

      validation.addType(validationType);

      expect(validation.types.aType).toBe(validationType);
      expect(validation.typeAllowsChildren).toEqual([]);
    });

    it("records a type that allows children", () => {
      const validationType = stubType({
        allowChildren: true,
        getStrictness: () => true,
        typeName: "aType",
        validate: () => true,
        validateFieldSpecification: (options) => options,
      });

      validation.addType(validationType);

      expect(validation.types.aType).toBe(validationType);
      expect(validation.typeAllowsChildren).toEqual(["aType"]);
    });

    /**
     * A plugin extends `context.constructors.BaseValidationType`, and v2.56.0
     * let it provide the three members any way JavaScript allows. These two
     * are the forms an own property set by the base constructor breaks: a
     * getter-only accessor (the assignment throws) and a prototype value (the
     * empty default shadows it).
     */
    it("keeps a plugin type's members provided as getters", () => {
      class GetterType extends BaseType {}
      Object.defineProperties(GetterType.prototype, {
        allowChildren: { get: () => true },
        allowedTypeOptions: { get: () => ["anOption"] },
        typeName: { get: () => "getterType" },
      });

      const validationType = new GetterType();
      validation.addType(validationType);

      expect(validation.types.getterType).toBe(validationType);
      expect(validationType.allowChildren).toBe(true);
      expect(validationType.allowedTypeOptions).toEqual(["anOption"]);
    });

    it("keeps a plugin type's members provided as prototype values", () => {
      class PrototypeType extends BaseType {}
      PrototypeType.prototype.typeName = "prototypeType";
      PrototypeType.prototype.allowChildren = true;
      PrototypeType.prototype.allowedTypeOptions = ["anOption"];

      const validationType = new PrototypeType();
      validation.addType(validationType);

      expect(validation.types.prototypeType).toBe(validationType);
      expect(validationType.allowChildren).toBe(true);
      expect(validationType.allowedTypeOptions).toEqual(["anOption"]);
    });

    /**
     * ⚠️ All six of these were written as `try { addType(…) } catch (error) {
     * should(error.id)… }`. A `catch` block is the only place they assert, so
     * **a subject that accepted the type would pass every one of them** — the
     * sixteenth dead-assertion form of this step, and the first that is a
     * control-flow shape rather than a weak matcher.
     */
    it("refuses to override an existing type", () => {
      validation.types.aType = stubType({});

      expect(() =>
        validation.addType(
          stubType({
            allowChildren: false,
            typeName: "aType",
            validate: () => true,
            validateFieldSpecification: (options) => options,
          }),
        ),
      ).toThrow(
        expect.objectContaining({ id: "validation.types.already_exists" }),
      );
    });

    it("refuses a type without a name", () => {
      expect(() =>
        validation.addType(
          invalid<BaseType>({
            allowChildren: false,
            validate: () => true,
            validateFieldSpecification: (options: unknown) => options,
          }),
        ),
      ).toThrow(
        expect.objectContaining({ id: "validation.types.missing_type_name" }),
      );
    });

    it("refuses a type without a validate function", () => {
      expect(() =>
        validation.addType(
          invalid<BaseType>({
            allowChildren: false,
            typeName: "aType",
            validateFieldSpecification: (options: unknown) => options,
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "validation.types.missing_function",
          message: expect.stringContaining(
            'The type "aType" must implement a function "validate".',
          ),
        }),
      );
    });

    it("refuses a type without a validateFieldSpecification function", () => {
      expect(() =>
        validation.addType(
          invalid<BaseType>({
            allowChildren: false,
            typeName: "aType",
            validate: () => true,
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "validation.types.missing_function",
          message: expect.stringContaining(
            'The type "aType" must implement a function "validateFieldSpecification".',
          ),
        }),
      );
    });

    it("refuses a type that allows children without a getStrictness function", () => {
      expect(() =>
        validation.addType(
          invalid<BaseType>({
            allowChildren: true,
            typeName: "aType",
            validate: () => true,
            validateFieldSpecification: (options: unknown) => options,
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "validation.types.missing_function",
          message: expect.stringContaining(
            'The type "aType" must implement a function "getStrictness".',
          ),
        }),
      );
    });
  });

  describe("#curateCollectionSpecification", () => {
    const curated = (
      overrides: Partial<CuratedCollectionSpecification> = {},
    ): CuratedCollectionSpecification => ({
      fields: {},
      strict: false,
      validators: null,
      ...overrides,
    });

    it("answers a default specification for an empty one", async () => {
      await expect(
        validation.curateCollectionSpecification(ANY_INDEX, ANY_COLLECTION, {}),
      ).resolves.toEqual(curated());
    });

    it("rejects a specification carrying a property it does not allow", async () => {
      await expect(
        validation.curateCollectionSpecification(
          ANY_INDEX,
          ANY_COLLECTION,
          invalid<CollectionSpecification>({ foo: "bar" }),
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          constructor: PreconditionError,
          id: "validation.assert.unexpected_properties",
        }),
      );
    });

    it("answers that property as an error in verbose mode", async () => {
      const response = (await validation.curateCollectionSpecification(
        ANY_INDEX,
        ANY_COLLECTION,
        invalid<CollectionSpecification>({ foo: "bar" }),
        false,
        true,
      )) as SpecificationValidationResult;

      expect(response.isValid).toBe(false);
      expect(response.errors).toEqual([
        `The object "${ANY_INDEX}.${ANY_COLLECTION}" contains unexpected properties (allowed: strict, fields, validators).`,
      ]);
    });

    it.each([
      { verbose: false, what: "" },
      { verbose: true, what: " in verbose mode" },
    ])(
      "answers the structured fields when a specification is provided$what",
      async ({ verbose }) => {
        const structure = vi.fn(
          (spec: CollectionSpecification) => spec.fields as never,
        );

        validation.structureCollectionValidation =
          structure as unknown as Validation["structureCollectionValidation"];

        await expect(
          validation.curateCollectionSpecification(
            ANY_INDEX,
            ANY_COLLECTION,
            { fields: { some: invalid<FieldSpecification>("field") } },
            false,
            verbose,
          ),
        ).resolves.toEqual(
          curated({
            fields: invalid<StructuredFieldSpecification>({ some: "field" }),
          }),
        );
      },
    );

    it("rejects when a field's curation throws", async () => {
      validation.structureCollectionValidation = vi.fn(() => {
        throw new Error("an error");
      }) as unknown as Validation["structureCollectionValidation"];

      await expect(
        validation.curateCollectionSpecification(ANY_INDEX, ANY_COLLECTION, {
          fields: { some: invalid<FieldSpecification>("bad field") },
        }),
      ).rejects.toThrow("an error");
    });

    it("rejects when a field's curation answers an error", async () => {
      vi.spyOn(validation, "structureCollectionValidation").mockReturnValue({
        errors: ["an error"],
        isValid: false,
      });

      await expect(
        validation.curateCollectionSpecification(ANY_INDEX, ANY_COLLECTION, {
          fields: { some: invalid<FieldSpecification>("bad field") },
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          constructor: BadRequestError,
          id: "validation.assert.invalid_specifications",
        }),
      );
    });

    /**
     * ⚠️ The Mocha test asserted this inside a `.catch(error => …)` on a
     * promise the subject **resolves** — the point of verbose mode is that it
     * answers the errors instead of throwing — so the callback never ran and
     * the test asserted nothing. Its three assertions were about an
     * `error.details` array no code path here produces. What the subject
     * actually does is below.
     */
    it("answers that error rather than rejecting, in verbose mode", async () => {
      vi.spyOn(validation, "structureCollectionValidation").mockReturnValue({
        errors: ["an error"],
        isValid: false,
      });

      const response = (await validation.curateCollectionSpecification(
        ANY_INDEX,
        ANY_COLLECTION,
        { fields: { some: invalid<FieldSpecification>("bad field") } },
        false,
        true,
      )) as SpecificationValidationResult;

      expect(response).toEqual({ errors: ["an error"], isValid: false });
    });

    it("answers the registered filter id when the validators are valid", async () => {
      const curateValidatorFilter = vi.fn(() => "aFilterId");

      validation.curateValidatorFilter = curateValidatorFilter;

      const validators = [{ some: "validators" }];

      await expect(
        validation.curateCollectionSpecification(
          ANY_INDEX,
          ANY_COLLECTION,
          { validators },
          true,
        ),
      ).resolves.toEqual(curated({ validators: "aFilterId" }));

      expect(curateValidatorFilter).toHaveBeenCalledWith(
        ANY_INDEX,
        ANY_COLLECTION,
        validators,
        true,
      );
    });

    it("rejects when the validators are not valid", async () => {
      vi.spyOn(validation, "curateValidatorFilter").mockImplementation(() => {
        throw new Error("error");
      });

      await expect(
        validation.curateCollectionSpecification(ANY_INDEX, ANY_COLLECTION, {
          validators: [{ bad: "validators" }],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          constructor: BadRequestError,
          id: "validation.assert.invalid_filters",
        }),
      );
    });
  });

  describe("#structureCollectionValidation", () => {
    it("assembles the curated fields into a tree", () => {
      const curate = vi.fn((fieldSpec: FieldSpecification) => ({
        fieldSpec,
        isValid: true,
      }));

      validation.curateFieldSpecification =
        curate as unknown as Validation["curateFieldSpecification"];
      validation.typeAllowsChildren.push("foo");

      const structured = validation.structureCollectionValidation(
        {
          fields: {
            "aField/aSubField": invalid<FieldSpecification>({ a: "subField" }),
            aField: invalid<FieldSpecification>({ a: "field", type: "foo" }),
            anotherField: invalid<FieldSpecification>({ another: "field" }),
          },
        },
        ANY_INDEX,
        ANY_COLLECTION,
      );

      expect(structured).toEqual({
        children: {
          aField: {
            a: "field",
            children: {
              aSubField: {
                a: "subField",
                depth: 2,
                path: ["aField", "aSubField"],
              },
            },
            depth: 1,
            path: ["aField"],
            type: "foo",
          },
          anotherField: {
            another: "field",
            depth: 1,
            path: ["anotherField"],
          },
        },
        root: true,
      });
      expect(curate).toHaveBeenCalledTimes(3);
    });

    it("answers an empty object when no field is specified", () => {
      expect(
        validation.structureCollectionValidation(
          { fields: {} },
          ANY_INDEX,
          ANY_COLLECTION,
        ),
      ).toEqual({});
    });

    it("stops at the first field whose curation throws", () => {
      const curate = vi.fn(() => {
        throw new Error("an error");
      });

      validation.curateFieldSpecification =
        curate as unknown as Validation["curateFieldSpecification"];

      expect(() =>
        validation.structureCollectionValidation(
          {
            fields: {
              aField: invalid<FieldSpecification>({ a: "field" }),
              anotherField: invalid<FieldSpecification>({ another: "field" }),
            },
          },
          ANY_INDEX,
          ANY_COLLECTION,
        ),
      ).toThrow("an error");

      expect(curate).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledOnce();
    });

    it("collects every field's errors in verbose mode", () => {
      const curate = vi
        .fn()
        .mockReturnValueOnce({ errors: ["error one"], isValid: false })
        .mockReturnValueOnce({ errors: ["error two"], isValid: false })
        .mockReturnValueOnce({ errors: ["error three"], isValid: false });

      validation.curateFieldSpecification =
        curate as unknown as Validation["curateFieldSpecification"];

      const response = validation.structureCollectionValidation(
        {
          fields: {
            "aField/aSubField": invalid<FieldSpecification>({ a: "subField" }),
            aField: invalid<FieldSpecification>({ a: "field" }),
            anotherField: invalid<FieldSpecification>({ another: "field" }),
          },
        },
        ANY_INDEX,
        ANY_COLLECTION,
        true,
      );

      expect(response).toEqual({
        errors: ["error one", "error two", "error three"],
        isValid: false,
      });
      expect(curate).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(3);
    });
  });

  describe("#curateFieldSpecification", () => {
    beforeEach(() => {
      vi.spyOn(validation, "curateFieldSpecificationFormat").mockReturnValue({
        isValid: true,
      });
    });

    const curateField = (
      fieldSpec: FieldSpecification,
      verbose = false,
    ): SpecificationValidationResult & { fieldSpec?: unknown } =>
      validation.curateFieldSpecification(
        fieldSpec,
        ANY_INDEX,
        ANY_COLLECTION,
        ANY_FIELD,
        verbose,
      );

    it("fills the defaults in", () => {
      validation.types.string = stubType({
        validateFieldSpecification: () => ({}),
      });

      expect(curateField({ type: "string" })).toEqual({
        fieldSpec: {
          mandatory: false,
          multivalued: { value: false },
          type: "string",
          typeOptions: {},
        },
        isValid: true,
      });
    });

    it("keeps the typeOptions the field's type answers", () => {
      validation.types.string = stubType({
        validateFieldSpecification: () => ({ foo: "bar" }),
      });

      expect(curateField({ type: "string" })).toEqual({
        fieldSpec: {
          mandatory: false,
          multivalued: { value: false },
          type: "string",
          typeOptions: { foo: "bar" },
        },
        isValid: true,
      });
    });

    it("validates the typeOptions the field declares", () => {
      validation.types.string = stubType({
        allowedTypeOptions: ["some"],
        validateFieldSpecification: () => ({ some: "options" }),
      });

      expect(
        curateField({ type: "string", typeOptions: { some: "options" } }),
      ).toEqual({
        fieldSpec: {
          mandatory: false,
          multivalued: { value: false },
          type: "string",
          typeOptions: { some: "options" },
        },
        isValid: true,
      });
    });

    it("throws what the type's validation throws", () => {
      validation.types.string = stubType({
        validateFieldSpecification: () => {
          throw new PreconditionError("foobar");
        },
      });

      expect(() => curateField({ type: "string" })).toThrow(
        expect.objectContaining({
          constructor: PreconditionError,
          message: "foobar",
        }),
      );
    });

    it("wraps a non-Kuzzle error thrown by a type", () => {
      validation.types.string = stubType({
        allowedTypeOptions: ["some"],
        validateFieldSpecification: () => {
          throw new Error("foobar");
        },
      });

      expect(() =>
        curateField({ type: "string", typeOptions: { some: "options" } }),
      ).toThrow(
        expect.objectContaining({
          constructor: PluginImplementationError,
          id: "plugin.runtime.unexpected_error",
        }),
      );
    });

    it("throws when a typeOption is not one the type allows", () => {
      validation.types.string = stubType({
        allowedTypeOptions: ["another"],
        validateFieldSpecification: () => true as never,
      });

      expect(() =>
        curateField({ type: "string", typeOptions: { some: "options" } }),
      ).toThrow(
        expect.objectContaining({
          id: "validation.assert.unexpected_properties",
          message: expect.stringContaining(
            `The object "${SCOPE}" contains unexpected properties`,
          ),
        }),
      );
    });

    it("answers that as an error in verbose mode", () => {
      validation.types.string = stubType({
        validateFieldSpecification: () => true as never,
      });

      const response = curateField(
        { type: "string", typeOptions: invalid<never>("foobar") },
        true,
      );

      expect(response.isValid).toBe(false);
      expect(response.errors).toHaveLength(1);
      expect(response.errors?.[0]).toMatch(
        new RegExp(`^The object "${SCOPE}" contains unexpected properties`),
      );
    });

    it("answers the format's own error in verbose mode", () => {
      vi.spyOn(validation, "curateFieldSpecificationFormat").mockReturnValue({
        errors: ["an error"],
        isValid: false,
      });

      expect(
        curateField({ type: "string", typeOptions: { some: "options" } }, true),
      ).toEqual({ errors: ["an error"], isValid: false });
    });
  });

  describe("#curateFieldSpecificationFormat", () => {
    const curateFormat = (fieldSpec: FieldSpecification, verbose = false) =>
      validation.curateFieldSpecificationFormat(
        fieldSpec,
        ANY_INDEX,
        ANY_COLLECTION,
        ANY_FIELD,
        verbose,
      );

    beforeEach(() => {
      validation.types.string = stubType({ typeName: "string" });
    });

    it("throws on a property it does not allow", () => {
      expect(() =>
        curateFormat(
          invalid<FieldSpecification>({ foo: "bar", type: "string" }),
        ),
      ).toThrow(
        expect.objectContaining({
          constructor: PreconditionError,
          id: "validation.assert.unexpected_properties",
        }),
      );
    });

    it("collects every problem in verbose mode", () => {
      expect(
        curateFormat(
          invalid<FieldSpecification>({ foo: "bar", type: "aType" }),
          true,
        ),
      ).toEqual({
        errors: [
          `The object "${SCOPE}" contains unexpected properties (allowed: mandatory, type, defaultValue, description, multivalued, typeOptions).`,
          `In "${SCOPE}": unknown type "aType".`,
        ],
        isValid: false,
      });
    });

    it("throws when the type is missing", () => {
      expect(() =>
        curateFormat(invalid<FieldSpecification>({ mandatory: true })),
      ).toThrow(`Missing property "type" in field "${SCOPE}".`);
    });

    it("throws on a type it does not know", () => {
      expect(() => curateFormat({ type: "not_recognized" })).toThrow(
        `In "${SCOPE}": unknown type "not_recognized".`,
      );
    });

    /**
     * The five malformed-`multivalued` cases the Mocha spec wrote as five
     * `it`s under **one** name — "should throw an error if the multivalued
     * field is malformed" — plus the non-boolean `value`, which had a name of
     * its own. One table, so a failure says which shape was accepted.
     */
    it.each([
      {
        message: `The object "${SCOPE}.multivalued" contains unexpected properties (allowed: value, minCount, maxCount).`,
        multivalued: { foo: "bar" },
        what: "an unknown property",
      },
      {
        message: `Missing property "value" in field "${SCOPE}.multivalued".`,
        multivalued: {},
        what: "no value",
      },
      {
        message: `Field "${SCOPE}": cannot set a property "minCount" if the field is not multivalued.`,
        multivalued: { minCount: 42, value: false },
        what: "a minCount on a single-valued field",
      },
      {
        message: `Field "${SCOPE}": cannot set a property "maxCount" if the field is not multivalued.`,
        multivalued: { maxCount: 42, value: false },
        what: "a maxCount on a single-valued field",
      },
      {
        message: `Property "${SCOPE}": invalid range (minCount > maxCount).`,
        multivalued: { maxCount: 42, minCount: 43, value: true },
        what: "minCount greater than maxCount",
      },
      {
        message: `Wrong type for parameter "${SCOPE}.multivalued.value" (expected: boolean).`,
        multivalued: { maxCount: 42, value: null },
        what: "a non-boolean value",
      },
    ])("throws on $what", ({ message, multivalued }) => {
      expect(() =>
        curateFormat({
          multivalued: invalid<FieldSpecification["multivalued"]>(multivalued),
          type: "string",
        }),
      ).toThrow(message);
    });

    it.each([
      { multivalued: undefined, what: "a single-valued field" },
      {
        multivalued: { maxCount: 42, minCount: 41, value: true },
        what: "a bounded multivalued field",
      },
    ])("answers valid for $what", ({ multivalued }) => {
      expect(curateFormat({ multivalued, type: "string" }).isValid).toBe(true);
    });
  });

  describe("#curateValidatorFilter", () => {
    const filter = [{ some: "filters" }];
    const expectedQuery = { bool: { must: filter } };

    let register: Mock;
    let validate: Mock;

    beforeEach(() => {
      register = vi.fn(() => "aFilterId");
      validate = vi.fn();

      validation.koncorde = invalid<Validation["koncorde"]>({
        register,
        validate,
      });
    });

    it("validates and registers the filter", () => {
      expect(
        validation.curateValidatorFilter(
          ANY_INDEX,
          ANY_COLLECTION,
          filter,
          false,
        ),
      ).toBe("aFilterId");

      expect(validate).toHaveBeenCalledWith(expectedQuery);
      expect(register).toHaveBeenCalledWith(
        expectedQuery,
        `${ANY_INDEX}/${ANY_COLLECTION}`,
      );
    });

    it("validates without registering on a dry run", () => {
      expect(
        validation.curateValidatorFilter(
          ANY_INDEX,
          ANY_COLLECTION,
          filter,
          true,
        ),
      ).toBeNull();

      expect(validate).toHaveBeenCalledWith(expectedQuery);
      expect(register).not.toHaveBeenCalled();
    });
  });
});
