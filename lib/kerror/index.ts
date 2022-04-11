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

import { format } from 'util';

import _ from 'lodash';
import { JSONObject } from 'kuzzle-sdk';

import { domains as internalDomains } from './codes';
import * as errors from './errors';
import { KuzzleError } from './errors';
import { ErrorDefinition, ErrorDomains } from '../types';

/**
 * Gets this file name in the exact same format than the one printed in the
 * stacktraces (used to clean kerror lines from stacktraces)
 */
let _currentFileName = null;
function _getCurrentFileName () {
  if (_currentFileName !== null) {
    return _currentFileName;
  }

  _currentFileName = module.filename.substr(process.cwd().length + 1);

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
export function rawGet (domains: ErrorDomains, domain: string, subdomain: string, error: string, ...placeholders): KuzzleError {
  let options: JSONObject = {};

  // extract options object from the placeholders
  if (_.isPlainObject(placeholders[placeholders.length - 1])) {
    options = placeholders.pop();
  }

  const kuzzleError = _.get(domains, `${domain}.subDomains.${subdomain}.errors.${error}`) as any as ErrorDefinition;

  if (! kuzzleError) {
    return get('core', 'fatal', 'unexpected_error', `${domain}.${subdomain}.${error}`);
  }

  let body = null;

  if (kuzzleError.class === 'PartialError' || kuzzleError.class === 'MultipleErrorsError') {
    body = placeholders.splice(-1)[0];
  }

  const message = options.message || format(kuzzleError.message, ...placeholders);
  const id = `${domain}.${subdomain}.${error}`;
  const code = domains[domain].code << 24
    | domains[domain].subDomains[subdomain].code << 16
    | domains[domain].subDomains[subdomain].errors[error].code;

  let kerror;
  if (kuzzleError.class === 'PartialError' || kuzzleError.class === 'MultipleErrorsError') {
    kerror = new errors[kuzzleError.class](message, body, id, code);
  }
  else if (kuzzleError.class === 'KuzzleError') {
    const status = kuzzleError.status || 500;
    kerror = new errors.KuzzleError(message, status, id, code);
  }
  else {
    kerror = new errors[kuzzleError.class](message, id as any, code as any);
  }

  kerror.props = placeholders;

  if (kuzzleError.class !== 'InternalError') {
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

function cleanStackTrace (error: KuzzleError): void {
  // Keep the original error message
  const messageLength = error.message.split('\n').length;
  const currentFileName = _getCurrentFileName();

  // we keep the new error instantiation line ("new ...Error (") on purpose:
  // this will allow us to replace it without inserting a new line in the array,
  // saving us from building a new array
  const newStack = error.stack.split('\n')
    .filter((line, index) => {
      if (index < messageLength) {
        return true;
      }

      // filter all lines related to the kerror object
      return ! line.includes(currentFileName);
    });

  // insert a deletion message in place of the new error instantiation line
  newStack[messageLength] = '      [...Kuzzle internal calls deleted...]';

  error.stack = newStack.join('\n');
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
export function rawReject (domains: ErrorDomains, domain: string, subdomain: string, error: string, ...placeholders): Promise<any> {
  return Promise.reject(rawGet(domains, domain, subdomain, error, ...placeholders));
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
export function rawGetFrom (domains: ErrorDomains, source: Error, domain: string, subdomain: string, error: string, ...placeholders): KuzzleError {
  const derivedError = rawGet(domains, domain, subdomain, error, ...placeholders);

  // If a stacktrace is present, we need to modify the first line because it
  // still contains the original error message
  if (derivedError.stack && derivedError.stack.length) {
    const stackArray = source.stack.split('\n');
    stackArray.shift();
    derivedError.stack = [
      `${derivedError.constructor.name}: ${derivedError.message}`,
      ...stackArray
    ].join('\n');
  }

  return derivedError;
}

/**
 * Wrap error functions with the provided domain and subdomain.
 */
export function rawWrap (domains: ErrorDomains, domain: string, subdomain: string) {
  return {
    get: (error, ...placeholders) => rawGet(
      domains,
      domain,
      subdomain,
      error,
      ...placeholders),
    getFrom: (source, error, ...placeholders) => rawGetFrom(
      domains,
      source,
      domain,
      subdomain,
      error,
      ...placeholders),
    reject: (error, ...placeholders) => rawReject(
      domains,
      domain,
      subdomain,
      error,
      ...placeholders),
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
export function get (domain: string, subdomain: string, error: string, ...placeholders): KuzzleError {
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
export function reject (domain: string, subdomain: string, error: string, ...placeholders): Promise<any> {
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
export function getFrom (source: Error, domain: string, subdomain: string, error: string, ...placeholders): KuzzleError {
  return rawGetFrom(internalDomains, source, domain, subdomain, error, ...placeholders);
}

/**
 * Wrap error functions with the provided domain and subdomain.
 */
export function wrap (domain: string, subdomain: string) {
  return {
    get: (error, ...placeholders) => get(
      domain,
      subdomain,
      error,
      ...placeholders),
    getFrom: (source, error, ...placeholders) => getFrom(
      source,
      domain,
      subdomain,
      error,
      ...placeholders),
    reject: (error, ...placeholders) => reject(
      domain,
      subdomain,
      error,
      ...placeholders),
  };
}
