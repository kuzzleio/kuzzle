/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const { format } = require('util'),
  { domains } = require('../error-codes'),
  _ = require('lodash'),
  { errors } = require('kuzzle-common-objects');

/**
 * Construct and return the corresponding error
 *
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 */
function getError (domain, subdomain, error, ...placeholders) {
  const
    errorName = `${domain}.${subdomain}.${error}`,
    kuzzleError = _.get(domains, `${domain}.subdomains.${subdomain}.errors.${error}`);

  if (! kuzzleError) {
    return getError(
      'internal',
      'unexpected',
      'unknown_error',
      ...placeholders);
  }

  const code =
    (domains[domain].code >> 24) |
    (domains[domain].subdomains[subdomain].code >> 16) |
    domains[domain].subdomains[subdomain].errors[error].code;

  const message = format(kuzzleError.message, ...placeholders);

  if (kuzzleError.class === 'PartialError') {
    const body = placeholders.slice(-1)[0];
    return new errors[kuzzleError.class](message, body, errorName, code);
  }

  return new errors[kuzzleError.class](message, errorName, code);
}

/**
 * Construct and throw the corresponding error
 *
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 * @param  {string} error - Error name: (eg: 'index_not_found')
 * @param  {...any} placeholders - Placeholders value to inject in error message
 */
function throwError (domain, subdomain, error, ...placeholders) {
  throw getError(domain, subdomain, error, ...placeholders);
}

/**
 * Wrap getError and throw with the provided domain and subdomain.

 * The function have now the following signature:
 *   - getError(error, ...placeholders)
 *   - throw(error, ...placeholders)
 *
 * @param  {string} domain - Domain (eg: 'external')
 * @param  {string} subdomain - Subdomain (eg: 'elasticsearch')
 */
function wrap (domain, subdomain) {
  return {
    getError: (error, ...placeholders) => getError(domain, subdomain, error, ...placeholders),
    throw: (error, ...placeholders) => throwError(domain, subdomain, error, ...placeholders)
  };
}

module.exports = {
  getError,
  wrap,
  throw: throwError
};
