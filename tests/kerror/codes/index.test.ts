import { beforeEach, describe, expect, it } from "vitest";

import {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../../lib/kerror/errors";
import { checkDomains } from "../../../lib/kerror/codes";
import type { Domains } from "../../../lib/kerror/codes";
import { invalid } from "../../helpers/invalid";

/** The `class` names `checkDomains` accepts, as the package exports them. */
const kuzzleErrorClasses = {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
};

/**
 * A valid two-domain tree, rebuilt per test because every test breaks it in
 * one place. The literal shape (rather than `Domains`) is what makes
 * `domains.foo.subDomains.sub1` an exact property access under
 * `noUncheckedIndexedAccess`.
 */
function validDomains() {
  const error = () => ({
    code: 13,
    class: "InternalError",
    description: "description",
    message: "message",
  });

  return {
    foo: {
      code: 111,
      subDomains: {
        sub1: {
          code: 234,
          errors: {
            err1: { ...error(), code: 13 },
            err2: { ...error(), code: 42 },
          },
        },
        sub2: { code: 235, errors: { err1: { ...error(), code: 42 } } },
      },
    },
    bar: {
      code: 222,
      subDomains: {
        sub1: { code: 234, errors: { err1: { ...error(), code: 42 } } },
      },
    },
  };
}

/**
 * `delete` on a field the fixture type declares as required — the removal is
 * what the test is about, so it is not a hole in the fixture's typing.
 */
function remove<T extends object>(target: T, key: keyof T): void {
  Reflect.deleteProperty(target, key);
}

describe("#kerror/codes", () => {
  let domains: ReturnType<typeof validDomains>;

  beforeEach(() => {
    domains = validDomains();
  });

  /* The fixture is deliberately broken in each test; `checkDomains` is what
   * decides whether it is a valid `Domains`, so it cannot be asked to take one. */
  const check = (options?: { plugin: boolean }) => () =>
    options === undefined
      ? checkDomains(invalid<Domains>(domains))
      : checkDomains(invalid<Domains>(domains), options);

  describe("#checkDomains", () => {
    it("should throw if a domain is missing a code", () => {
      remove(domains.foo, "code");

      expect(check()).toThrow(/missing required 'code' field/i);
    });

    it("should throw if the domain code is not an integer", () => {
      for (const code of [null, undefined, [], {}, 3.14, "foo", false, true]) {
        domains.foo.code = invalid<number>(code);

        expect(check()).toThrow(/field 'code' must be an integer/i);
      }
    });

    it("should throw if the domain code is already used", () => {
      domains.bar.code = domains.foo.code;

      expect(check()).toThrow(/code .* is not unique/i);
    });

    it("should throw if the domain code exceeds the allowed range", () => {
      for (const code of [-1, 256]) {
        domains.foo.code = code;

        expect(check()).toThrow(/field 'code' must be between 0 and 255/i);
      }

      // prevent domain code conflict
      remove(domains, "bar");

      for (let code = 0; code <= 0xff; code++) {
        domains.foo.code = code;

        expect(check()).not.toThrow();
      }
    });

    it("should throw if no subDomains are defined", () => {
      remove(domains.foo, "subDomains");

      expect(check()).toThrow(/missing required 'subDomains' field/i);
    });

    it("should throw if the subDomains property is not an object", () => {
      for (const subDomains of [
        null,
        undefined,
        [],
        3.14,
        "foo",
        false,
        true,
      ]) {
        domains.foo.subDomains =
          invalid<typeof domains.foo.subDomains>(subDomains);

        expect(check()).toThrow(/field 'subDomains' must be an object/i);
      }
    });

    it("should throw if a non-plugin subdomain is missing a code", () => {
      remove(domains.bar.subDomains.sub1, "code");

      expect(check()).toThrow(/missing required 'code' field/i);
    });

    it("should default plugin subDomains code to 0 if not set", () => {
      remove(domains.bar.subDomains.sub1, "code");

      expect(check({ plugin: true })).not.toThrow();
      expect(domains.bar.subDomains.sub1.code).toBe(0);
    });

    it("should throw if a subdomain code is not an integer", () => {
      for (const code of [null, undefined, [], {}, 3.14, "foo", false, true]) {
        domains.foo.subDomains.sub2.code = invalid<number>(code);

        expect(check()).toThrow(/field 'code' must be an integer/i);
      }
    });

    it("should throw if a subdomain code is already used", () => {
      domains.foo.subDomains.sub1.code = 0;
      domains.foo.subDomains.sub2.code = 0;

      expect(check()).toThrow(/code .* is not unique/i);
    });

    it("should not throw if a plugin subdomain contains multiple defaulted codes", () => {
      remove(domains.foo.subDomains, "sub1");
      remove(domains.foo.subDomains, "sub2");

      expect(check({ plugin: true })).not.toThrow();
    });

    it("should throw if a plugin subdomain contains duplicate, non-default, codes", () => {
      domains.foo.subDomains.sub1.code = 42;
      domains.foo.subDomains.sub2.code = 42;

      expect(check({ plugin: true })).toThrow(/code .* is not unique/i);
    });

    it("should throw if a subdomain code exceeds the allowed range", () => {
      for (const code of [-1, 256]) {
        domains.foo.subDomains.sub2.code = code;

        expect(check()).toThrow(/field 'code' must be between 0 and 255/i);
      }

      // prevent subdomain code conflict
      remove(domains.foo.subDomains, "sub2");

      for (let code = 0; code <= 0xff; code++) {
        domains.foo.subDomains.sub1.code = code;

        expect(check()).not.toThrow();
      }
    });

    it("should throw if a subdomain is missing an errors object", () => {
      remove(domains.foo.subDomains.sub2, "errors");

      expect(check()).toThrow(/missing required 'errors' field/i);
    });

    it("should throw if a subdomain has a non-object errors property", () => {
      for (const errors of [null, undefined, [], 3.14, "foo", false, true]) {
        domains.foo.subDomains.sub2.errors =
          invalid<typeof domains.foo.subDomains.sub2.errors>(errors);

        expect(check()).toThrow(/field 'errors' must be an object/i);
      }
    });

    it("should throw if an error is missing a code", () => {
      remove(domains.foo.subDomains.sub1.errors.err1, "code");

      expect(check()).toThrow(/missing required 'code' field/i);
    });

    it("should throw if an error code is not an integer", () => {
      for (const code of [null, undefined, [], {}, 3.14, "foo", false, true]) {
        domains.foo.subDomains.sub2.errors.err1.code = invalid<number>(code);

        expect(check()).toThrow(/field 'code' must be an integer/i);
      }
    });

    it("should throw if an error code is outside its allowed range", () => {
      for (const code of [-1, 0, 65536]) {
        domains.foo.subDomains.sub2.errors.err1.code = code;

        expect(check()).toThrow(/field 'code' must be between 1 and 65535/i);
      }

      for (let code = 1; code <= 0xffff; code++) {
        domains.foo.subDomains.sub2.errors.err1.code = code;

        expect(check()).not.toThrow();
      }
    });

    it("should throw if an error is missing a message", () => {
      remove(domains.foo.subDomains.sub1.errors.err1, "message");

      expect(check()).toThrow(/missing required 'message' field/i);
    });

    it("should throw if an error message is not a non-empty string", () => {
      for (const message of [null, undefined, [], {}, 3.14, false, true, ""]) {
        domains.foo.subDomains.sub2.errors.err1.message =
          invalid<string>(message);

        expect(check()).toThrow(/field 'message' must be a non-empty string/i);
      }
    });

    it("should throw if an error is missing an error class", () => {
      remove(domains.foo.subDomains.sub1.errors.err1, "class");

      expect(check()).toThrow(/missing required 'class' field/i);
    });

    it("should throw if an error class is not a string", () => {
      for (const className of [null, undefined, [], {}, 3.14, false, true]) {
        domains.foo.subDomains.sub2.errors.err1.class =
          invalid<string>(className);

        expect(check()).toThrow(/field 'class' must be a string/i);
      }
    });

    it("should throw if an error class name does not match a known KuzzleError class", () => {
      domains.foo.subDomains.sub2.errors.err1.class = "foo";

      expect(check()).toThrow(
        /field 'class' must target a known KuzzleError object/i,
      );

      for (const name of Object.keys(kuzzleErrorClasses)) {
        domains.foo.subDomains.sub2.errors.err1.class = name;

        expect(check()).not.toThrow();
      }
    });

    it("should throw if a native error does not contain a description", () => {
      remove(domains.foo.subDomains.sub2.errors.err1, "description");

      expect(check()).toThrow(
        /field 'description' must be a non-empty string/i,
      );

      for (const description of [
        null,
        undefined,
        [],
        {},
        3.14,
        false,
        true,
        "",
      ]) {
        domains.foo.subDomains.sub2.errors.err1.description =
          invalid<string>(description);

        expect(check()).toThrow(
          /field 'description' must be a non-empty string/i,
        );
      }
    });

    it("should not throw if a plugin error does not contain a description", () => {
      remove(domains.foo.subDomains.sub2.errors.err1, "description");

      expect(check({ plugin: true })).not.toThrow();
    });

    it("should throw if a deprecated field is present and not a non-empty string", () => {
      for (const deprecated of [[], {}, 3.14, false, true, ""]) {
        Object.assign(domains.foo.subDomains.sub2.errors.err1, { deprecated });

        expect(check()).toThrow(
          /field 'deprecated' must be a non-empty string/i,
        );
      }
    });
  });
});
