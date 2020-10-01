/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const Bluebird = require('bluebird');
const { format } = require('util');
const { domains } = require('./codes');
const _ = require('lodash');
const {
  KuzzleError,
  UnauthorizedError,
  TooManyRequestsError,
  SizeLimitError,
  ServiceUnavailableError,
  PreconditionError,
  PluginImplementationError,
  PartialError,
  NotFoundError,
  InternalError: KuzzleInternalError,
  GatewayTimeoutError,
  ForbiddenError,
  ExternalServiceError,
  BadRequestError,
} = require('kuzzle-common-objects');

const errors = {
  KuzzleError,
  UnauthorizedError,
  TooManyRequestsError,
  SizeLimitError,
  ServiceUnavailableError,
  PreconditionError,
  PluginImplementationError,
  PartialError,
  NotFoundError,
  InternalError: KuzzleInternalError,
  GatewayTimeoutError,
  ForbiddenError,
  ExternalServiceError,
  BadRequestError,
};

/**
 * Construct and return the corresponding error
 *
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 * @param  {object} options - Last param can be additional options { message }
 */
function get (domain, subdomain, error, ...placeholders) {
  let options = {};

  // extract options object from the placeholders
  if (_.isPlainObject(placeholders[placeholders.length - 1])) {
    options = placeholders.pop();
  }

  const kuzzleError = _.get(domains, `${domain}.subdomains.${subdomain}.errors.${error}`);

  if (! kuzzleError) {
    return get('core', 'fatal', 'unexpected_error', `${domain}.${subdomain}.${error}`);
  }

  let body = null;

  if (kuzzleError.class === 'PartialError') {
    body = placeholders.splice(-1)[0];
  }

  const message = options.message || format(kuzzleError.message, ...placeholders);
  const id = `${domain}.${subdomain}.${error}`;
  const code = domains[domain].code << 24
    | domains[domain].subdomains[subdomain].code << 16
    | domains[domain].subdomains[subdomain].errors[error].code;

  let kerror;
  if (kuzzleError.class === 'PartialError') {
    kerror = new errors[kuzzleError.class](message, body, id, code);
  }
  else {
    kerror = new errors[kuzzleError.class](message, id, code);
  }

  if (error.name !== 'InternalError') {
    cleanStackTrace(kerror, 3);
  }

  return kerror;
}

/**
 * Removes the n first lines of the stacktrace because they are related
 * to internal mechanisms.
 *
 * Eg:
 *  at new PluginImplementationError (
 *  at get (kuzzle/lib/kerror/index.js:70:14)
 *  at Object.get (kuzzle/lib/kerror/index.js:146:38)
 *  // Line that triggered the error =>
 *  at ControllerManager.add (kuzzle/lib/core/application/backend.ts:226:34)
 */
function cleanStackTrace (error, depth) {
  // Keep the original error message (2 lines for PluginImplementationError)
  let errorMessage = '';
  let i = error.name === 'PluginImplementationError' ? 2 : 1;
  while (i--) {
    const idx = error.stack.indexOf('\n') + 1;
    errorMessage += error.stack.slice(0, idx);
    error.stack = error.stack.slice(idx);
  }

  // Remove the first 3 lines of the stacktrace
  while (depth--) {
    const idx = error.stack.indexOf('\n') + 1;
    error.stack = error.stack.slice(idx);
  }
  error.stack = errorMessage + '[...Kuzzle internal calls deleted...]\n' + error.stack;
}

/**
 * Returns a promise rejected with the corresponding error
 *
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 */
function reject (domain, subdomain, error, ...placeholders) {
  return Bluebird.reject(get(domain, subdomain, error, ...placeholders));
}

/**
 * Returns a promise rejected with the corresponding error, with its stack
 * trace derivated from a provided source error
 *
 * @param  {Error}  source
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 */
function rejectFrom (source, domain, subdomain, error, ...placeholders) {
  return Bluebird.reject(
    getFrom(source, domain, subdomain, error, ...placeholders));
}

/**
 * Construct and return the corresponding error, with its stack
 * trace derivated from a provided source error
 *
 * @param  {Error}  source
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 */
function getFrom (source, domain, subdomain, error, ...placeholders) {
  const derivedError = get(domain, subdomain, error, ...placeholders);

  derivedError.stack = source.stack;

  return derivedError;
}

/**
 * Wrap error functions with the provided domain and subdomain.
 */
function wrap (domain, subdomain) {
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
    rejectFrom: (source, error, ...placeholders) => rejectFrom(
      source,
      domain,
      subdomain,
      error,
      ...placeholders)
  };
}

module.exports = {
  get,
  getFrom,
  reject,
  rejectFrom,
  wrap,
};
