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
  errorCodes = require('../error-codes'),
  _ = require('lodash'),
  { errors } = require('kuzzle-common-objects');

module.exports = {
  getError: (...args) => {

    const [domain, subdomain, errorName] = args;
    const placeholders = args.length > 3 ? args.slice(3) : '';
    const name = `${domain}-${subdomain}-${errorName}`;
    const error = _.get(errorCodes, `${domain}.subdomains.${subdomain}.errors.${errorName}`);
    if (!error) {
      return module.exports.getError('internal', 'unexpected', 'unknown_error', ...placeholders);
    }
    const code =
      (errorCodes[domain].code >> 24) |
      (errorCodes[domain].subdomains[subdomain].code >> 16) |
      errorCodes[domain].subdomains[subdomain].errors[errorName].code;
    const message = format(error.message, ...placeholders);
    if (error.class === 'PartialError') {
      const body = args.slice(-1)[0];
      return new errors[error.class](message, body, name, code);
    }
    return new errors[error.class](message, name, code);
  },

  /** Manage errors to be thrown
  *
  * @param {...args} ...args
  * @throws {KuzzleError}
  */

  throw: (...args) => {

    throw module.exports.getError(...args);
  },

  wrap: (domain, subdomain) => {
    return {
      getError: (...args) => module.exports.getError(domain, subdomain, ...args),
      throw: (...args) => module.exports.throw(domain, subdomain, ...args)
    };
  }
};