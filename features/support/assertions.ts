import _ from "lodash";

// TODO should is deprecated it needs to be removed
// eslint-disable-next-line @typescript-eslint/no-require-imports
const should = require("should");

/**
 * What `should`'s own assertion context exposes to a custom assertion: the
 * value under test, and the description printed on failure. `should` is
 * `require`d untyped here, so the context has to be declared at the one place
 * that reads it.
 */
type ShouldAssertionContext = {
  obj: unknown;
  params: { operator: string };
};

should.Assertion.add(
  "matchObject",
  function (this: ShouldAssertionContext, expected: Record<string, unknown>) {
    this.params = { operator: "match object" };

    for (const [keyPath, expectedValue] of Object.entries(expected)) {
      const objectValue = _.get(this.obj, keyPath);

      if (expectedValue === "_ANY_") {
        should(objectValue).not.be.undefined();
      } else if (expectedValue === "_STRING_") {
        should(objectValue).be.String();
      } else if (expectedValue === "_NUMBER_") {
        should(objectValue).be.Number();
      } else if (expectedValue === "_OBJECT_") {
        should(objectValue).be.Object();
      } else if (expectedValue === "_UNDEFINED_") {
        should(objectValue).be.undefined();
      } else if (expectedValue === "_DATE_NOW_") {
        should(objectValue).be.approximately(Date.now(), 1000);
      } else if (expectedValue === "_DATE_NOW_SEC_") {
        should(objectValue).be.approximately(Date.now() / 1000, 1000);
      } else if (_.isPlainObject(objectValue)) {
        should(objectValue).matchObject(
          expectedValue,
          `"${keyPath}" does not match. Expected "${JSON.stringify(
            expectedValue,
          )}" have "${JSON.stringify(objectValue)}"`,
        );
      } else if (_.isArray(objectValue)) {
        // The expectation for an array has to be one too — a scalar here would
        // index into `undefined` and report every element as mismatched.
        if (!_.isArray(expectedValue)) {
          throw new Error(
            `"${keyPath}" is an array, but the expectation is not: ${JSON.stringify(expectedValue)}`,
          );
        }

        for (let i = 0; i < objectValue.length; i++) {
          should(objectValue[i]).matchObject(
            expectedValue[i],
            `"${keyPath}[${i}]" does not match. Expected "${JSON.stringify(
              expectedValue[i],
            )}" have "${JSON.stringify(objectValue[i])}"`,
          );
        }
      } else {
        should(objectValue).match(
          expectedValue,
          `"${keyPath}" does not match. Expected "${JSON.stringify(
            expectedValue,
          )}" have "${JSON.stringify(objectValue)}"`,
        );
      }
    }
  },
  false,
);
