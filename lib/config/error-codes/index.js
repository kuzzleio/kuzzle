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

const errors = require('kuzzle-common-objects').errors;
const api = require('./api');

/** Check the format of the error-codes config files
 *  @param {object} - error config file domain
 */

function checkErrorCodes(errorCodes) {

  for (const domain of Object.keys(errorCodes)) {
    const domainName = errorCodes[domain];
    if (!(domainName.hasOwnProperty('subdomains')) || typeof domainName.subdomains !== 'object' 
      || !(domainName.hasOwnProperty('code')) || !(Number.isInteger(domainName.code)) 
      || !(domainName.code > 0x00 && domainName.code <= 0xFF)) {
      throw new errors.InternalError(`Format error on error domain "${domain}".`, 'Invalid error file', 1);
    }
    for (const subdomain of Object.keys(domainName.subdomains)) {
      const subdomainName = domainName.subdomains[subdomain];
      if (!(subdomainName.hasOwnProperty('errors')) || typeof subdomainName.errors !== 'object'
        || !(subdomainName.hasOwnProperty('code')) || !(Number.isInteger(subdomainName.code))
        || !(subdomainName.code > 0x00 && subdomainName.code <= 0xFF)) {
        throw new errors.InternalError(`Format error on error subdomain "${domain}-${subdomain}"`, 'Invalid error file', 1);
      }
      for (const error of Object.keys(subdomainName.errors)) {
        const errorName = subdomainName.errors[error];
        if (!(errorName.hasOwnProperty('code')) || !(Number.isInteger(errorName.code))
          || !(errorName.hasOwnProperty('message')) || typeof errorName.message !== 'string'
          || !(errorName.hasOwnProperty('class')) || typeof errorName.class !== 'string'
          || !(errors.hasOwnProperty(errorName.class))
          || !(errorName.code > 0x0000 && errorName.code <= 0xFFFF)) {
          throw new errors.InternalError(`Format error on error "${domain}-${subdomain}-${error}"`, 'Invalid error file', 1);
        }
      }
    }
  }
}

checkErrorCodes({ api });

module.exports = {
  api
};
