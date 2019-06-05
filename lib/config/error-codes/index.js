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
    
    if (!domainName.hasOwnProperty('subdomains')) { 
      throw new Error(`Error configuration file : Missing required 'subdomains' field in '${domain}'.`);
    } 
    if (typeof domainName.subdomains !== 'object') {
      throw new Error(`Error configuration file : Field 'subdomains' must be an object in '${domain}'.`);
    } 
    if (!domainName.hasOwnProperty('code')) {
      throw new Error(`Error configuration file : Missing required 'code' field in '${domain}'.`);
    } 
    if (!Number.isInteger(domainName.code)) {
      throw new Error(`Error configuration file : Field 'code' must be an integer in '${domain}'.`);
    } 
    if (!(domainName.code > 0x00 && domainName.code <= 0xFF)) {
      throw new Error(`Invalid error configuration file : Field 'code' must be between 0 and 255 in '${domain}'.`);
    }

    for (const subdomain of Object.keys(domainName.subdomains)) {
      const subdomainName = domainName.subdomains[subdomain];
      
      if (!subdomainName.hasOwnProperty('errors')) {
        throw new Error(`Error configuration file : Missing required 'errors' field in '${domain}-${subdomain}'.`);
      }
      if (typeof subdomainName.errors !== 'object') {
        throw new Error(`Error configuration file : Field 'subdomains' must be an object in '${domain}-${subdomain}'.`);
      }
      if (!subdomainName.hasOwnProperty('code')) {
        throw new Error(`Error configuration file : Missing required 'code' field in '${domain}-${subdomain}'.`);
      }
      if (!Number.isInteger(subdomainName.code)) {
        throw new Error(`Error configuration file : Field 'code' must be an integer in '${domain}-${subdomain}'.`);
      }
      if (!(subdomainName.code > 0x00 && subdomainName.code <= 0xFF)) {
        throw new Error(`Error configuration file : Field 'code' must be between 0 and 255 in '${domain}-${subdomain}'.`);
      }
      
      for (const error of Object.keys(subdomainName.errors)) {
        const errorName = subdomainName.errors[error];
        
        if (!errorName.hasOwnProperty('message')) {
          throw new Error(`Error configuration file : Missing required 'message' field in '${domain}-${subdomain}-${error}'.`);
        }
        if (typeof errorName.message !== 'string') {
          throw new Error(`Error configuration file : Field 'message' must be a string in '${domain}-${subdomain}-${error}'.`);
        }
        if (!errorName.hasOwnProperty('class')) {
          throw new Error(`Error configuration file : Missing required 'class' field in '${domain}-${subdomain}-${error}'.`);
        }
        if (typeof errorName.class !== 'string') {
          throw new Error(`Error configuration file : Field 'class' must be a string in '${domain}-${subdomain}-${error}'.`);
        }
        if (!errors.hasOwnProperty(errorName.class)) {
          throw new Error(`Error configuration file : Invalid field 'class' in '${domain}-${subdomain}-${error}', '${errorName.class}' does not exist.`);
        }
        if (!errorName.hasOwnProperty('code')) {
          throw new Error(`Error configuration file : Missing required 'code' field in '${domain}-${subdomain}-${error}'.`);
        }
        if (!Number.isInteger(errorName.code)) {
          throw new Error(`Error configuration file : Field 'code' must be an integer in '${domain}-${subdomain}-${error}'.`);
        }
        if (!(errorName.code > 0x0000 && errorName.code <= 0xFFFF)) {
          throw new Error(`Error configuration file : Field 'code' must be between 0 and 65535 in '${domain}-${subdomain}-${error}'.`);
        }
      }
    }
  }
}

checkErrorCodes({ api });

module.exports = {
  api
};
