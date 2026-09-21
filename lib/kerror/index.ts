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

import { format } from "util";

import _ from "lodash";
import type { JSONObject } from "kuzzle-sdk";

import type { Domains } from "./codes";
import { domains as internalDomains } from "./codes";
import * as errors from "./errors";
import type { KuzzleError } from "./errors";
import { isPlainObject } from "../util/safeObject";

/**
 * Gets this file name in the exact same format than the one printed in the
 * stacktraces (used to clean kerror lines from stacktraces)
 *
 * `module` is a CommonJS global. Kuzzle ships as CommonJS, but vitest loads
 * `lib/` as ESM, where `module` is undefined — and reading `.filename` off it
 * threw, which made EVERY vitest spec that reaches an error path crash. The
 * guard degrades gracefully instead: with no filename to match, stack-trace
 * cleaning is skipped, which is cosmetic.
 */
let _currentFileName: string | null = null;
function _getCurrentFileName(): string {
  if (_currentFileName !== null) {
    return _currentFileName;
  }

  _currentFileName =
    typeof module === "undefined" || !module.filename
      ? ""
      : module.filename.substring(process.cwd().length + 1);

  return _currentFileName;
}

/**
 * Construct and return the corresponding error
 *
 * @param  domains - Domains object with subDomains and error names
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 * @param  options - Last param can be additional options { message }
 */
export function rawGet(
  domains: Domains,
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): KuzzleError {
  let options: JSONObject = {};

  // extract options object from the placeholders
  const last = placeholders[placeholders.length - 1];

  if (isPlainObject(last)) {
    options = last;
    placeholders.pop();
  }

  // Walked rather than fetched through a dotted `_.get` path: the three
  // levels are what the code below reads the codes off, the guard then covers
  // all three at once, and the `as any as ErrorDefinition` that the string
  // path required is gone with it.
  const domainEntry = domains[domain];
  const subdomainEntry = domainEntry?.subDomains[subdomain];
  const kuzzleError = subdomainEntry?.errors[error];

  if (!domainEntry || !subdomainEntry || !kuzzleError) {
    return get(
      "core",
      "fatal",
      "unexpected_error",
      `${domain}.${subdomain}.${error}`,
    );
  }

  let body: KuzzleError[] | undefined;

  if (
    kuzzleError.class === "PartialError" ||
    kuzzleError.class === "MultipleErrorsError"
  ) {
    const [last] = placeholders.splice(-1);

    // The documented shape is the list of partial errors. Anything else was
    // handed to the constructor and dropped there — `Array.isArray(body)` is
    // the only thing it does with it — so the check moves to where the type
    // is decided.
    body = Array.isArray(last) ? last : undefined;
  }

  const message =
    options.message || format(kuzzleError.message, ...placeholders);
  const id = `${domain}.${subdomain}.${error}`;
  const code =
    (domainEntry.code << 24) | (subdomainEntry.code << 16) | kuzzleError.code;

  let kerror;
  if (
    kuzzleError.class === "PartialError" ||
    kuzzleError.class === "MultipleErrorsError"
  ) {
    kerror = new errors[kuzzleError.class](message, body, id, code);
  } else if (kuzzleError.class === "KuzzleError") {
    const status = kuzzleError.status || 500;
    kerror = new errors.KuzzleError(message, status, id, code);
  } else {
    kerror = new errors[kuzzleError.class](message, id as any, code as any);
  }

  kerror.props = placeholders;

  if (kuzzleError.class !== "InternalError") {
    cleanStackTrace(kerror);
  }

  return kerror;
}

/**
 * Removes the first lines of the stacktrace because they are related
 * to internal mechanisms.
 *
 * e.g.
 *  at new PluginImplementationError (
 *  at get (lib/kerror/index.js:70:14)
 *  at Object.get (lib/kerror/index.js:146:38) // only for wrapped kerror objects
 *  // Line that triggered the error =>
 *  at ControllerManager.add (kuzzle/lib/core/backend/backend.ts:226:34)
 */

function cleanStackTrace(error: KuzzleError): void {
  // `Error.stack` is not guaranteed — `Error.stackTraceLimit = 0` removes it,
  // and there is nothing to trim off an error that has none.
  if (error.stack === undefined) {
    return;
  }

  // Keep the original error message
  const messageLength = error.message.split("\n").length;
  const currentFileName = _getCurrentFileName();

  // we keep the new error instantiation line ("new ...Error (") on purpose:
  // this will allow us to replace it without inserting a new line in the array,
  // saving us from building a new array
  const newStack = error.stack.split("\n").filter((line, index) => {
    if (index < messageLength) {
      return true;
    }

    // filter all lines related to the kerror object. An empty
    // `currentFileName` (see above) matches everything, so guard it: no
    // filename means no filtering.
    return currentFileName === "" || !line.includes(currentFileName);
  });

  // insert a deletion message in place of the new error instantiation line
  newStack[messageLength] = "      [...Kuzzle internal calls deleted...]";

  error.stack = newStack.join("\n");
}

/**
 * Returns a promise rejected with the corresponding error
 *
 * @param  domains - Domains object with subDomains and error names
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 */
export function rawReject(
  domains: Domains,
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): Promise<any> {
  return Promise.reject(
    rawGet(domains, domain, subdomain, error, ...placeholders),
  );
}

/**
 * Construct and return the corresponding error, with its stack
 * trace derivated from a provided source error
 *
 * @param  domains - Domains object with subDomains and error names
 * @param  source - Original error
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 */
export function rawGetFrom(
  domains: Domains,
  /**
   * Whatever was thrown. `unknown`, not `Error`: the only thing read off it
   * is a stack, if it has one, and `pipeRunner` derives from what a plugin
   * rejected with — which may be a string.
   */
  source: unknown,
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): KuzzleError {
  const derivedError = rawGet(
    domains,
    domain,
    subdomain,
    error,
    ...placeholders,
  );

  // If a stacktrace is present, we need to modify the first line because it
  // still contains the original error message
  if (derivedError?.stack?.length && source instanceof Error && source.stack) {
    const stackArray = source.stack.split("\n");
    stackArray.shift();
    derivedError.stack = [
      `${derivedError.constructor.name}: ${derivedError.message}`,
      ...stackArray,
    ].join("\n");
  }

  return derivedError;
}

/**
 * Wrap error functions with the provided domain and subdomain.
 */
export function rawWrap(domains: Domains, domain: string, subdomain: string) {
  return {
    get: (error: string, ...placeholders: unknown[]) =>
      rawGet(domains, domain, subdomain, error, ...placeholders),
    getFrom: (source: unknown, error: string, ...placeholders: unknown[]) =>
      rawGetFrom(domains, source, domain, subdomain, error, ...placeholders),
    reject: (error: string, ...placeholders: unknown[]) =>
      rawReject(domains, domain, subdomain, error, ...placeholders),
  };
}

/**
 * Construct and return the corresponding error
 *
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 * @param  options - Last param can be additional options { message }
 */
export function get(
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): KuzzleError {
  return rawGet(internalDomains, domain, subdomain, error, ...placeholders);
}

/**
 * Returns a promise rejected with the corresponding error
 *
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 */
export function reject(
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): Promise<any> {
  return rawReject(internalDomains, domain, subdomain, error, ...placeholders);
}

/**
 * Construct and return the corresponding error, with its stack
 * trace derivated from a provided source error
 *
 * @param  source - Original error
 * @param  domain - Domain (eg: 'external')
 * @param  subdomain - Subdomain (eg: 'elasticsearch')
 * @param  error - Error name: (eg: 'index_not_found')
 * @param  placeholders - Placeholders value to inject in error message
 */
export function getFrom(
  source: unknown,
  domain: string,
  subdomain: string,
  error: string,
  ...placeholders: unknown[]
): KuzzleError {
  return rawGetFrom(
    internalDomains,
    source,
    domain,
    subdomain,
    error,
    ...placeholders,
  );
}

/**
 * Wrap error functions with the provided domain and subdomain.
 */
export function wrap(domain: string, subdomain: string) {
  return {
    get: (error: string, ...placeholders: unknown[]) =>
      get(domain, subdomain, error, ...placeholders),
    getFrom: (source: unknown, error: string, ...placeholders: unknown[]) =>
      getFrom(source, domain, subdomain, error, ...placeholders),
    reject: (error: string, ...placeholders: unknown[]) =>
      reject(domain, subdomain, error, ...placeholders),
  };
}
