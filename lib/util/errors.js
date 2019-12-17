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

const
  Bluebird = require('bluebird'),
  { format } = require('util'),
  { domains } = require('../config/error-codes'),
  _ = require('lodash'),
  { errors } = require('kuzzle-common-objects');

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
    return get('core', 'fatal', 'unexpected_error', ...placeholders);
  }

  let body = null;

  if (kuzzleError.class === 'PartialError') {
    body = placeholders.splice(-1)[0];
  }

  const
    message = options.message || format(kuzzleError.message, ...placeholders),
    id = `${domain}.${subdomain}.${error}`,
    code = domains[domain].code << 24
      | domains[domain].subdomains[subdomain].code << 16
      | domains[domain].subdomains[subdomain].errors[error].code;

  if (kuzzleError.class === 'PartialError') {
    return new errors[kuzzleError.class](message, body, id, code);
  }

  return new errors[kuzzleError.class](message, id, code);
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
  wrap,
  reject,
  rejectFrom,
};
