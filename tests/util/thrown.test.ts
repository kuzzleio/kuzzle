import { describe, expect, it } from "vitest";

import { causeOf } from "../../lib/util/thrown";

describe("#thrown", () => {
  describe("causeOf", () => {
    it("returns an Error as is", () => {
      const error = new TypeError("foo");

      expect(causeOf(error)).toBe(error);
    });

    it("keeps the message of an object and nothing else", () => {
      const cause = causeOf({ message: "foo", secret: "s3cr3t" });

      expect(cause).toBeInstanceOf(Error);
      expect(cause.message).toBe("foo");
      expect(cause.stack).not.toContain("s3cr3t");
    });

    it.each([
      ["a string", "foo"],
      ["a number", 42],
      ["an object without a message", { foo: "bar" }],
      ["null", null],
      ["undefined", undefined],
    ])('says "undefined" for %s, which has no message', (_name, thrown) => {
      expect(causeOf(thrown).message).toBe("undefined");
    });
  });
});
