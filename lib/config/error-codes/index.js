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

const { InternalError: KuzzleInternalError } = require('kuzzle-common-objects').errors;
const api = require('./api');

/** Check the format of the error-codes config files
 *  @param {object} - error config file domain
 */

function checkErrorCodes(errorCodes) {

  for (const domain of Object.keys(errorCodes)) {
    const domainName = errorCodes[domain];
    if (!(domainName.hasOwnProperty('subdomains')) || typeof domainName['subdomains'] !== 'object' 
      || !(domainName.hasOwnProperty('code')) || typeof domainName['code'] !== 'number' 
      || !(domainName['code'] > 0 && domainName['code'] < 10)) {
      throw new KuzzleInternalError(`Format error on error domain "${domain}".`, 'Invalid error file', 1);
    }
    for (const subdomain of Object.keys(domainName['subdomains'])) {
      const subdomainName = domainName['subdomains'][subdomain];
      if (!(subdomainName.hasOwnProperty('errors')) || typeof subdomainName['errors'] !== 'object'
        || !(subdomainName.hasOwnProperty('code')) || typeof subdomainName['code'] !== 'number'
        || !(subdomainName['code'] > 0 && subdomainName['code'] < 99)) {
        throw new KuzzleInternalError(`Format error on error subdomain "${domain}-${subdomain}"`, 'Invalid error file', 1);
      }
      for (const error of Object.keys(subdomainName['errors'])) {
        const errorName = subdomainName['errors'][error];
        if (!(errorName.hasOwnProperty('code')) || typeof errorName['code'] !== 'number'
          || !(errorName.hasOwnProperty('message')) || typeof errorName['message'] !== 'string'
          || !(errorName.hasOwnProperty('class')) || typeof errorName['class'] !== 'string'
          || !(errorName['code'] > 0 && errorName['code'] < 999)) {
          throw new KuzzleInternalError(`Format error on error "${domain}-${subdomain}-${error}"`, 'Invalid error file', 1);
        }
      }
    }
  }
}

checkErrorCodes({ api });

module.exports = {
  api
};
