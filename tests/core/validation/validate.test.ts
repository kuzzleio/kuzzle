import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Validation from "../../../lib/core/validation/validation";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { loadConfig } from "../../../lib/config";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/**
 * ⚠️ The Mocha spec replaced `manageErrorMessage` — a function the module calls
 * *itself* — with `function () { throw new Error(arguments[2]); }`, seven
 * times. That is the shape `rewire` exists for and `vi.mock` cannot do, and it
 * is also what made those tests assert their own stub: the message reached the
 * assertion because the stub put it there.
 *
 * The helper is a pure function that already throws the message it is handed,
 * so the port lets it run and asserts the error the subject actually produces.
 * Nothing is replaced, and the assertions got stronger — they now pin the
 * error's `id` as well as its text. (The helper moved to `validationUtils.ts`
 * for [L6f](../../../docs/adr-001/steps/13-sprint-10-test-closure.md); the
 * `rewire` did not move with it.)
 */
type Internals = {
  isValidField: (
    fieldName: string,
    documentSubset: unknown,
    collectionSpecSubset: unknown,
    strictness: boolean,
    errorMessages: unknown,
    verbose: boolean,
  ) => boolean;
  recurseApplyDefault: (
    isUpdate: boolean,
    documentSubset: unknown,
    collectionSpecSubset: unknown,
  ) => unknown;
  recurseFieldValidation: (
    documentSubset: unknown,
    collectionSpecSubset: unknown,
    strictness: boolean,
    errorMessages: unknown,
    verbose: boolean,
  ) => boolean;
};

const internalsOf = (validation: Validation) => invalid<Internals>(validation);

describe("#core/validation/Validation — validate", () => {
  const index = "anIndex";
  const collection = "aCollection";

  let validation: Validation;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let typeValidate: ReturnType<typeof vi.fn>;
  let getStrictness: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    answers = {};
    ask = vi.fn(async (event: string) => answers[event]);
    typeValidate = vi.fn(() => true);
    getStrictness = vi.fn(() => true);

    stubKuzzle({
      ask,
      config: JSON.parse(JSON.stringify(loadConfig())),
      log: stubLogger(),
    });

    validation = new Validation();

    /* Two types, one that takes children and one that does not: every test
     * below is about what the validator does around a type, not about any
     * type's own rules. */
    validation.addType(
      invalid({
        allowChildren: true,
        getStrictness: () => getStrictness,
        typeName: "typeChildren",
        validate: typeValidate,
        validateFieldSpecification: () => {},
      }),
    );
    validation.addType(
      invalid({
        allowChildren: false,
        typeName: "typeNoChild",
        validate: typeValidate,
        validateFieldSpecification: () => {},
      }),
    );
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const requestFor = (input: Record<string, unknown> = {}) =>
    new KuzzleRequest({ collection, index, ...input }, {});

  const specFor = (spec: Record<string, unknown>) => {
    validation.specification = invalid({ [index]: { [collection]: spec } });
  };

  describe("#validate", () => {
    it("should answer the request when the specification holds no field", async () => {
      const request = requestFor();
      const recurse = vi
        .spyOn(internalsOf(validation), "recurseFieldValidation")
        .mockReturnValue(true);

      specFor({
        fields: { children: {} },
        strict: false,
        validators: null,
      });

      await expect(validation.validate(request, false)).resolves.toBe(request);

      expect(recurse).toHaveBeenCalledExactlyOnceWith(
        null,
        {},
        false,
        [],
        false,
      );
    });

    it("should answer the request when there is no specification at all", async () => {
      const request = requestFor();
      const recurse = vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      );

      validation.specification = {};

      await expect(validation.validate(request, false)).resolves.toBe(request);

      expect(recurse).not.toHaveBeenCalled();
    });

    it("should answer a verbose report when asked for one", async () => {
      const request = requestFor();

      vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      ).mockReturnValue(true);

      specFor({
        fields: { children: {} },
        strict: false,
        validators: null,
      });

      await expect(validation.validate(request, true)).resolves.toEqual({
        errorMessages: {},
        valid: true,
      });
    });

    it("should run the field and the filter validation the specification asks for", async () => {
      const documentBody = {};
      const request = requestFor({ _id: "anId", body: documentBody });
      const recurse = vi
        .spyOn(internalsOf(validation), "recurseFieldValidation")
        .mockReturnValue(true);
      const test = vi
        .spyOn(validation.koncorde, "test")
        .mockReturnValue(["someFilter", "anotherFilter"]);

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: "someFilter",
      });

      await expect(validation.validate(request, false)).resolves.toBe(request);

      expect(recurse).toHaveBeenCalledExactlyOnceWith(
        documentBody,
        { aField: "validation" },
        true,
        [],
        false,
      );
      /* The document is tested under its own id, in the collection's own
       * Koncorde index. */
      expect(test).toHaveBeenCalledExactlyOnceWith(
        { _id: "anId" },
        `${index}/${collection}`,
      );
    });

    it("should validate a strict collection that specifies no field", async () => {
      const documentBody = { foo: "barbar" };
      const request = requestFor({ body: documentBody });
      const recurse = vi
        .spyOn(internalsOf(validation), "recurseFieldValidation")
        .mockReturnValue(true);

      specFor({ fields: { children: {} }, strict: true });

      await expect(validation.validate(request, false)).resolves.toBe(request);

      expect(recurse).toHaveBeenCalledExactlyOnceWith(
        documentBody,
        {},
        true,
        [],
        false,
      );
    });

    it("should forward an error raised by field validation", async () => {
      const error = new Error("Mocked error");

      vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      ).mockImplementation(() => {
        throw error;
      });

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: "someFilter",
      });

      await expect(validation.validate(requestFor(), false)).rejects.toBe(
        error,
      );
    });

    it("should refuse a document no validation filter matches", async () => {
      vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      ).mockReturnValue(true);
      vi.spyOn(validation.koncorde, "test").mockReturnValue([]);

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: "someFilter",
      });

      /* The real `manageErrorMessage` throws this, so the assertion pins the
       * error the API answers rather than a stub's echo. */
      await expect(validation.validate(requestFor(), false)).rejects.toThrow(
        "The document does not match validation filters.",
      );
      await expect(
        validation.validate(requestFor(), false),
      ).rejects.toMatchObject({ id: "validation.check.failed_document" });
    });

    it("should turn a strictness error into the message it is for", async () => {
      const error = invalid<Error>(new BadRequestError("strictness"));

      invalid<{ details: unknown }>(error).details = { field: "field" };

      vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      ).mockImplementation(() => {
        throw error;
      });

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: null,
      });

      await expect(validation.validate(requestFor(), false)).rejects.toThrow(
        'The document validation is strict. Cannot add unspecified sub-field "field"',
      );
    });

    it("should file a strictness error in the report when verbose", async () => {
      const error = invalid<Error>(new Error("strictness"));

      invalid<{ details: unknown }>(error).details = { field: "field" };

      const recurse = vi
        .spyOn(internalsOf(validation), "recurseFieldValidation")
        .mockImplementation(() => {
          throw error;
        });

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: null,
      });

      /* ⚠️ The Mocha test stubbed `manageErrorMessage` and asserted the
       * *argument* it received, so the report itself — what an API client
       * reads — was never checked. */
      await expect(validation.validate(requestFor(), true)).resolves.toEqual({
        errorMessages: {
          documentScope: [
            'The document validation is strict. Cannot add unspecified sub-field "field"',
          ],
        },
        valid: false,
      });

      /* The fourth argument is the report itself — the same object the
       * assertion above reads, which is how a verbose run collects. */
      expect(recurse).toHaveBeenCalledExactlyOnceWith(
        null,
        { aField: "validation" },
        true,
        expect.any(Object),
        true,
      );
    });

    it("should forward any other error raised during field validation", async () => {
      const error = new BadRequestError("foo");

      vi.spyOn(
        internalsOf(validation),
        "recurseFieldValidation",
      ).mockImplementation(() => {
        throw error;
      });

      specFor({
        fields: { children: { aField: "validation" } },
        strict: true,
        validators: null,
      });

      await expect(validation.validate(requestFor(), false)).rejects.toBe(
        error,
      );
    });

    it("should read the stored document back when updating one", async () => {
      const request = requestFor({
        _id: "foo",
        action: "update",
        controller: "document",
      });

      answers["core:storage:public:document:get"] = { _id: "foo" };
      validation.specification = {};

      await expect(validation.validate(request, false)).resolves.toBe(request);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:get",
        index,
        collection,
        "foo",
      );
    });
  });

  describe("#recurseApplyDefault", () => {
    it("should fill in the defaults of missing and null fields", () => {
      expect(
        internalsOf(validation).recurseApplyDefault(
          false,
          { aDefaultField: null, aField: { anotherSubField: "some value" } },
          {
            aDefaultField: {
              defaultValue: "some default",
              type: "typeNoChild",
            },
            aField: {
              children: {
                aSubField: {
                  defaultValue: "another default",
                  type: "typeNoChild",
                },
              },
              type: "typeChildren",
            },
            aNormalField: { type: "typeNoChild" },
          },
        ),
      ).toEqual({
        aDefaultField: "some default",
        aField: { aSubField: "another default", anotherSubField: "some value" },
      });
    });

    it("should only fill in null fields when updating", () => {
      expect(
        internalsOf(validation).recurseApplyDefault(
          true,
          { aField: { aSubField: null, anotherSubField: "some value" } },
          {
            aDefaultField: {
              defaultValue: "some default",
              type: "typeNoChild",
            },
            aField: {
              children: {
                aSubField: {
                  defaultValue: "another default",
                  type: "typeNoChild",
                },
              },
              type: "typeChildren",
            },
            aNormalField: { type: "typeNoChild" },
          },
        ),
      ).toEqual({
        aField: { aSubField: "another default", anotherSubField: "some value" },
      });
    });

    it("should fill in the defaults of every element of a multivalued field", () => {
      expect(
        internalsOf(validation).recurseApplyDefault(
          true,
          {
            aField: [
              { aSubField: null, anotherSubField: "some value" },
              { aSubField: null, anotherSubField: "some other value" },
            ],
          },
          {
            aField: {
              children: {
                aSubField: {
                  defaultValue: "another default",
                  type: "typeNoChild",
                },
              },
              multivalues: { value: true },
              type: "typeChildren",
            },
          },
        ),
      ).toEqual({
        aField: [
          { aSubField: "another default", anotherSubField: "some value" },
          { aSubField: "another default", anotherSubField: "some other value" },
        ],
      });
    });
  });

  describe("#recurseFieldValidation", () => {
    const twoFields = {
      aField: { some: "specification" },
      anotherField: { some: "other specification" },
    };
    const twoValues = { aField: "some value", anotherField: "some value" };

    it("should refuse an unspecified property when strict", () => {
      expect(() =>
        internalsOf(validation).recurseFieldValidation(
          { anotherField: "some value" },
          { aField: { some: "specification" } },
          true,
          [],
          false,
        ),
      ).toThrow("strictness");
    });

    it("should forward an error raised while validating a field", () => {
      const isValidField = vi
        .spyOn(internalsOf(validation), "isValidField")
        .mockImplementation(() => {
          throw invalid<Error>({ message: "an error" });
        });

      expect(() =>
        internalsOf(validation).recurseFieldValidation(
          twoValues,
          twoFields,
          false,
          [],
          false,
        ),
      ).toThrow("an error");

      expect(isValidField).toHaveBeenCalledOnce();
    });

    it.each([true, false])(
      "should answer true when every field is valid (verbose: %s)",
      (verbose) => {
        const isValidField = vi
          .spyOn(internalsOf(validation), "isValidField")
          .mockReturnValue(true);

        expect(
          internalsOf(validation).recurseFieldValidation(
            twoValues,
            twoFields,
            !verbose,
            [],
            verbose,
          ),
        ).toBe(true);

        expect(isValidField).toHaveBeenCalledTimes(2);
      },
    );

    /* Verbose mode keeps going to collect every message; fail-fast stops at
     * the first invalid field. That difference is the whole point of the
     * flag, and it is what the call counts below say. */
    it("should check every field before answering false when verbose", () => {
      const isValidField = vi
        .spyOn(internalsOf(validation), "isValidField")
        .mockReturnValue(false);

      expect(
        internalsOf(validation).recurseFieldValidation(
          twoValues,
          twoFields,
          false,
          [],
          true,
        ),
      ).toBe(false);

      expect(isValidField).toHaveBeenCalledTimes(2);
    });

    it("should stop at the first invalid field when not verbose", () => {
      const isValidField = vi
        .spyOn(internalsOf(validation), "isValidField")
        .mockReturnValue(false);

      expect(
        internalsOf(validation).recurseFieldValidation(
          twoValues,
          twoFields,
          true,
          [],
          false,
        ),
      ).toBe(false);

      expect(isValidField).toHaveBeenCalledOnce();
    });
  });

  describe("#isValidField", () => {
    /** The verbose report a failing field files its message into. */
    let errorMessages: Record<string, unknown>;

    const fieldSpec = (spec: Record<string, unknown>) => ({
      aField: { path: ["aField"], type: "typeNoChild", ...spec },
    });

    const check = (
      name: string,
      document: unknown,
      spec: unknown,
      verbose = true,
    ) =>
      internalsOf(validation).isValidField(
        name,
        document,
        spec,
        true,
        verbose ? errorMessages : [],
        verbose,
      );

    /** The messages filed against one field of the verbose report. */
    const messagesFor = (field: string) =>
      invalid<{
        fieldScope: { children: Record<string, { messages: string[] }> };
      }>(errorMessages).fieldScope.children[field].messages;

    beforeEach(() => {
      errorMessages = {};
    });

    it("should accept a valid unary field", () => {
      expect(
        check(
          "aField",
          { aField: "some value" },
          fieldSpec({ multivalued: { value: false } }),
        ),
      ).toBe(true);
    });

    it("should accept a valid multivalued field", () => {
      expect(
        check(
          "aField",
          { aField: ["some value", "some other value"] },
          fieldSpec({ multivalued: { minCount: 2, value: true } }),
        ),
      ).toBe(true);
    });

    it("should throw when the type refuses the value and the report is fail-fast", () => {
      typeValidate.mockReturnValue(false);

      expect(() =>
        check(
          "aField",
          { aField: "some value" },
          fieldSpec({ multivalued: { value: false } }),
          false,
        ),
      ).toThrow(
        expect.objectContaining({ id: "validation.check.failed_field" }),
      );
      expect(() =>
        check(
          "aField",
          { aField: "some value" },
          fieldSpec({ multivalued: { value: false } }),
          false,
        ),
      ).toThrow(BadRequestError);
    });

    it.each([
      [
        "the type refuses the value",
        { aField: "some value" },
        { multivalued: { value: false } },
        "An error has occurred during validation.",
        false,
      ],
      [
        "a multivalued field holds a single value",
        { aField: "some other value" },
        { multivalued: { value: true } },
        "The field must be multivalued, unary value provided.",
        true,
      ],
      [
        "a multivalued field holds too few elements",
        { aField: ["some value"] },
        { multivalued: { minCount: 2, value: true } },
        "Not enough elements. Minimum count is set to 2.",
        true,
      ],
      [
        "a multivalued field holds too many elements",
        { aField: ["a", "b", "c"] },
        { multivalued: { maxCount: 2, value: true } },
        "Too many elements. Maximum count is set to 2.",
        true,
      ],
      [
        "a unary field holds an array",
        { aField: ["a", "b", "c"] },
        { multivalued: { value: false } },
        "The field is not a multivalued field; Multiple values provided.",
        true,
      ],
    ])(
      "should report that %s",
      (_name, document, spec, message, typeAnswer) => {
        typeValidate.mockReturnValue(typeAnswer);

        expect(check("aField", document, fieldSpec(spec))).toBe(false);
        expect(messagesFor("aField")).toEqual([message]);
      },
    );

    it("should report a mandatory field that is not there", () => {
      expect(
        check(
          "anotherField",
          { aField: ["some value"] },
          {
            anotherField: {
              mandatory: true,
              path: ["anotherField"],
              type: "typeNoChild",
            },
          },
        ),
      ).toBe(false);
      expect(messagesFor("anotherField")).toEqual(["The field is mandatory."]);
    });

    /** A field with one child, both of the stubbed types. */
    const nestedSpec = {
      aField: {
        children: {
          aSubField: {
            multivalued: { value: false },
            path: ["aField", "aSubField"],
            type: "typeNoChild",
          },
        },
        multivalued: { value: false },
        path: ["aField"],
        type: "typeChildren",
      },
    };
    const nestedDocument = { aField: { aSubField: "bad value" } };

    it("should report an invalid subfield under its own path", () => {
      typeValidate.mockReturnValueOnce(true).mockReturnValueOnce(false);

      expect(check("aField", nestedDocument, nestedSpec)).toBe(false);

      expect(
        invalid<{
          fieldScope: {
            children: {
              aField: { children: { aSubField: { messages: string[] } } };
            };
          };
        }>(errorMessages).fieldScope.children.aField.children.aSubField
          .messages,
      ).toEqual(["An error has occurred during validation."]);
    });

    it("should throw on an invalid subfield when the report is fail-fast", () => {
      typeValidate.mockReturnValueOnce(true).mockReturnValueOnce(false);

      expect(() => check("aField", nestedDocument, nestedSpec, false)).toThrow(
        expect.objectContaining({ id: "validation.check.failed_field" }),
      );
    });

    it("should report an error a subfield's type raised", () => {
      typeValidate.mockReturnValueOnce(true).mockImplementationOnce(() => {
        throw invalid<Error>({ message: "an error" });
      });

      expect(check("aField", nestedDocument, nestedSpec)).toBe(false);
      expect(messagesFor("aField")).toEqual(["an error"]);
    });

    it("should report a subfield's strictness error as the message it is for", () => {
      typeValidate.mockReturnValueOnce(true).mockImplementationOnce(() => {
        throw invalid<Error>({
          details: { field: "field" },
          message: "strictness",
        });
      });

      expect(check("aField", nestedDocument, nestedSpec)).toBe(false);
      expect(messagesFor("aField")).toEqual([
        'The field is set to "strict"; cannot add unspecified sub-field "field".',
      ]);
    });
  });
});
