import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkAllowedProperties,
  curateStructuredFields,
  getParent,
  getValidationConfiguration,
  manageErrorMessage,
} from "../../../lib/core/validation/validationUtils";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError as KuzzleInternalError } from "../../../lib/kerror/errors/internalError";
import type {
  CuratedFieldSpecification,
  StructuredFieldSpecification,
  VerboseErrorMessages,
} from "../../../lib/core/validation/specification";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * These six were module-private in `validation.ts` and reached with
 * `rewire`'s `__get__`. `validation.ts` uses `export =`, which cannot carry
 * named exports beside it, so there was no other way to address them by name —
 * the spec had to reach into the compiled scope. They now live in their own
 * module and are exported, which is the whole of L6f's `lib/` change.
 */
describe("#core/validation/validationUtils", () => {
  describe("#checkAllowedProperties", () => {
    it("should accept an object whose properties are all allowed", () => {
      expect(checkAllowedProperties({ foo: "bar" }, ["foo", "mod"])).toBe(true);
    });

    it("should refuse anything that is not a plain object", () => {
      expect(checkAllowedProperties("notAnObject", ["foo"])).toBe(false);
      /* An array and a null both pass a naive `typeof === "object"`, and
       * neither is a specification. */
      expect(checkAllowedProperties(["foo"], ["foo"])).toBe(false);
      expect(checkAllowedProperties(null, ["foo"])).toBe(false);
    });

    it("should refuse an object carrying a property that is not allowed", () => {
      expect(checkAllowedProperties({ baz: "bar", foo: "bar" }, ["foo"])).toBe(
        false,
      );
    });
  });

  describe("#curateStructuredFields", () => {
    const field = (
      path: string[],
      type = "object",
    ): CuratedFieldSpecification => invalid({ path, type });

    it("should assemble the fields into the tree the validator walks", () => {
      const fields = {
        1: [field(["aField"]), field(["anotherField"])],
        2: [
          field(["aField", "aSubField"]),
          field(["aField", "anotherSubField"]),
        ],
        3: [
          field(["aField", "aSubField", "aSubSubField"]),
          field(["aField", "aSubField", "anotherSubSubField"]),
        ],
      };

      expect(curateStructuredFields(["object"], fields, 3)).toEqual({
        children: {
          aField: {
            children: {
              aSubField: {
                children: {
                  aSubSubField: {
                    path: ["aField", "aSubField", "aSubSubField"],
                    type: "object",
                  },
                  anotherSubSubField: {
                    path: ["aField", "aSubField", "anotherSubSubField"],
                    type: "object",
                  },
                },
                path: ["aField", "aSubField"],
                type: "object",
              },
              anotherSubField: {
                path: ["aField", "anotherSubField"],
                type: "object",
              },
            },
            path: ["aField"],
            type: "object",
          },
          anotherField: { path: ["anotherField"], type: "object" },
        },
        root: true,
      });
    });

    it("should refuse a depth with no fields in it", () => {
      const fields = {
        1: [field(["aField"]), field(["anotherField"])],
        3: [field(["aField", "aSubField", "aSubSubField"])],
      };

      expect(() => curateStructuredFields(["object"], fields, 3)).toThrow(
        expect.objectContaining({
          id: "validation.assert.missing_nested_spec",
        }),
      );
    });

    it("should refuse children under a type that cannot have any", () => {
      const fields = {
        1: [field(["aField"], "string"), field(["anotherField"])],
        2: [field(["aField", "aSubField"])],
      };

      expect(() => curateStructuredFields(["object"], fields, 2)).toThrow(
        expect.objectContaining({
          id: "validation.assert.unexpected_children",
        }),
      );
    });
  });

  describe("#getParent", () => {
    it("should answer the root for a field of the first level", () => {
      const structured = invalid<StructuredFieldSpecification>({
        children: { foo: "bar" },
      });

      expect(getParent(structured, ["foo"])).toBe(structured);
    });

    it("should answer the node the field hangs off", () => {
      const structured = invalid<StructuredFieldSpecification>({
        children: { foo: { children: { bar: { children: { baz: "mod" } } } } },
      });

      expect(getParent(structured, ["foo", "bar", "baz"])).toBe(
        invalid<{ children: { foo: { children: { bar: unknown } } } }>(
          structured,
        ).children.foo.children.bar,
      );
    });

    it("should refuse a path whose parent is missing", () => {
      const structured = invalid<StructuredFieldSpecification>({
        children: {
          foo: { children: { notBar: { children: { baz: "mod" } } } },
        },
      });

      expect(() => getParent(structured, ["foo", "bar", "baz"])).toThrow(
        expect.objectContaining({ id: "validation.assert.missing_parent" }),
      );
    });
  });

  describe("#manageErrorMessage", () => {
    it("should throw a field error when not collecting messages", () => {
      expect(() =>
        manageErrorMessage(["aField", "aSubField"], [], "a message", false),
      ).toThrow(
        expect.objectContaining({
          id: "validation.check.failed_field",
          message: expect.stringContaining("a message"),
        }),
      );

      expect(() =>
        manageErrorMessage(["aField"], [], "a message", false),
      ).toThrow(BadRequestError);
    });

    it("should throw a document error when the context is the document", () => {
      expect(() =>
        manageErrorMessage("document", [], "a message", false),
      ).toThrow(
        expect.objectContaining({ id: "validation.check.failed_document" }),
      );
    });

    it("should file a field message under its own path when collecting", () => {
      const holder: VerboseErrorMessages = {};

      manageErrorMessage(["aField", "aSubField"], holder, "a message", true);

      expect(holder).toEqual({
        fieldScope: {
          children: {
            aField: {
              children: { aSubField: { messages: ["a message"] } },
            },
          },
        },
      });
    });

    it("should append to the messages a path already holds", () => {
      const holder: VerboseErrorMessages = {
        fieldScope: {
          children: {
            aField: {
              children: { aSubField: { messages: ["an existing message"] } },
            },
          },
        },
      };

      manageErrorMessage(["aField", "aSubField"], holder, "a message", true);

      expect(
        holder.fieldScope?.children?.aField.children?.aSubField.messages,
      ).toEqual(["an existing message", "a message"]);
    });

    it("should leave a sibling's messages alone", () => {
      const holder: VerboseErrorMessages = {
        fieldScope: {
          children: {
            aField: {
              children: {
                anotherSubField: { messages: ["an existing message"] },
              },
              messages: ["another existing message"],
            },
          },
        },
      };

      manageErrorMessage(["aField", "aSubField"], holder, "a message", true);

      expect(holder.fieldScope?.children?.aField).toEqual({
        children: {
          aSubField: { messages: ["a message"] },
          anotherSubField: { messages: ["an existing message"] },
        },
        messages: ["another existing message"],
      });
    });

    it("should collect a document message in its own scope", () => {
      const holder: VerboseErrorMessages = {};

      manageErrorMessage("document", holder, "a message", true);
      manageErrorMessage("document", holder, "another message", true);

      expect(holder).toEqual({
        documentScope: ["a message", "another message"],
      });
    });
  });

  describe("#getValidationConfiguration", () => {
    let search: ReturnType<typeof vi.fn>;
    let config: Record<string, unknown>;

    beforeEach(() => {
      search = vi.fn(async () => ({ hits: [] }));
      config = { validation: { foo: "bar" } };

      stubKuzzle({ config, internalIndex: { search } });
    });

    afterEach(() => {
      restoreKuzzle();
    });

    it("should fall back to the configured specification when none is stored", async () => {
      await expect(getValidationConfiguration()).resolves.toEqual({
        foo: "bar",
      });

      expect(search).toHaveBeenCalledWith(
        "validations",
        {},
        { from: 0, size: 1000 },
      );
    });

    it("should answer an empty specification when there is no configuration either", async () => {
      delete config.validation;

      await expect(getValidationConfiguration()).resolves.toEqual({});
    });

    it("should assemble the stored specifications by index and collection", async () => {
      search.mockResolvedValue({
        hits: [
          {
            _id: "anIndex#aCollection",
            _source: {
              collection: "aCollection",
              index: "anIndex",
              validation: "validation1",
            },
          },
          {
            _id: "anIndex#anotherCollection",
            _source: {
              collection: "anotherCollection",
              index: "anIndex",
              validation: "validation2",
            },
          },
          {
            _id: "anotherIndex#aCollection",
            _source: {
              collection: "aCollection",
              index: "anotherIndex",
              validation: "validation3",
            },
          },
        ],
      });

      await expect(getValidationConfiguration()).resolves.toEqual({
        anIndex: {
          aCollection: "validation1",
          anotherCollection: "validation2",
        },
        anotherIndex: { aCollection: "validation3" },
      });
    });

    /* A stored specification missing any of the three fields names the
     * collection it came from — nothing asserted that refusal. */
    it.each(["index", "collection", "validation"])(
      "should refuse a stored specification with no %s",
      async (missing) => {
        const source: Record<string, string> = {
          collection: "aCollection",
          index: "anIndex",
          validation: "validation1",
        };

        delete source[missing];
        search.mockResolvedValue({
          hits: [{ _id: "anIndex#aCollection", _source: source }],
        });

        await expect(getValidationConfiguration()).rejects.toMatchObject({
          id: "validation.assert.incorrect_validation_format",
        });
        await expect(getValidationConfiguration()).rejects.toBeInstanceOf(
          KuzzleInternalError,
        );
      },
    );
  });
});
