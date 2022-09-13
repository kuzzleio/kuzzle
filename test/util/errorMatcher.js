"use strict";

const stableStringify = require("json-stable-stringify");

const kerror = require("../../lib/kerror");
const { Request } = require("../../index");
const { hilightUserCode } = require("../../lib/util/stackTrace");

/**
 * Returns a sinon matcher tailored-made to match error API responses depending
 * on the current global.NODE_ENV environment variable.
 */
function fromError(error) {
  let expectedError = new Request({}, { error });

  expectedError = expectedError.response.toJSON().content;

  delete expectedError.requestId;

  expectedError.error.stack =
    global.NODE_ENV === "development" ? "stacktrace" : undefined;

  return function (value) {
    let compared =
      typeof value === "string" || Buffer.isBuffer(value)
        ? JSON.parse(value)
        : value;

    let expectedStr;

    if (compared.content) {
      // api response object
      if (compared.content.error.stack) {
        compared.content.error.stack = "stacktrace";
      }

      compared = compared.content;
      expectedStr = stableStringify(expectedError);
    } else if (compared.error) {
      // stringified api response
      if (compared.error.stack) {
        compared.error.stack = "stacktrace";
      }

      expectedStr = stableStringify(expectedError);
    } else {
      // error object (HTTP)
      if (compared.stack) {
        compared.stack = "stacktrace";
      }
      expectedStr = stableStringify(expectedError.error);
    }

    delete compared.requestId;

    const comparedStr = stableStringify(compared),
      res = comparedStr === expectedStr;

    // makes debugging easier, since sinon does not have the expectedError
    // object
    if (!res) {
      // eslint-disable-next-line no-console
      console.error(`Error: error objects do not match (env = ${global.NODE_ENV})
Expected:
${expectedStr}
===
Got:
${comparedStr}
`);
    }

    return res;
  };
}

function fromMessage(domain, subdomain, id, message) {
  const error = kerror.get(domain, subdomain, id, message);

  error.stack = error.stack.split("\n").map(hilightUserCode).join("\n");

  return fromError(error);
}

module.exports = { fromMessage, fromError };
