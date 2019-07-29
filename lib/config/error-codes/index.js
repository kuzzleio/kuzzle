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

const { errors } = require('kuzzle-common-objects');
const api = require('./api');
const internal = require('./internal');
const plugins = require('./plugins');
const _ = require('lodash');
const assert = require('assert');

/** Check the format of the error-codes config files
 *  @param {object} - error config file domain
 */

function checkErrorCodes(errorCodes) {

  for (const domain of Object.keys(errorCodes)) {
    const domainName = errorCodes[domain];
    
    assert(Boolean(domainName.subdomains), `Error configuration file : Missing required 'subdomains' field in '${domain}'.`);
    assert(_.isPlainObject(domainName.subdomains), `Error configuration file : Field 'subdomains' must be an object in '${domain}'.`);
    assert(domainName.hasOwnProperty('code'), `Error configuration file : Missing required 'code' field in '${domain}'.`);
    assert(Number.isInteger(domainName.code), `Error configuration file : Field 'code' must be an integer in '${domain}'.`);
    assert(domainName.code >= 0x00 && domainName.code <= 0xFF, `Invalid error configuration file : Field 'code' must be between 0 and 255 in '${domain}'.`); 

    for (const subdomain of Object.keys(domainName.subdomains)) {
      const subdomainName = domainName.subdomains[subdomain];
      
      assert(Boolean(subdomainName.errors), `Error configuration file : Missing required 'errors' field in '${domain}-${subdomain}'.`);
      assert(_.isPlainObject(subdomainName.errors), `Error configuration file : Field 'subdomains' must be an object in '${domain}-${subdomain}'.`);
      assert(subdomainName.hasOwnProperty('code'), `Error configuration file : Missing required 'code' field in '${domain}-${subdomain}'.`);
      assert(Number.isInteger(subdomainName.code), `Error configuration file : Field 'code' must be an integer in '${domain}-${subdomain}'.`);
      assert(subdomainName.code >= 0x00 && subdomainName.code <= 0xFF, `Error configuration file : Field 'code' must be between 0 and 255 in '${domain}-${subdomain}'.`);
      
      for (const error of Object.keys(subdomainName.errors)) {
        const errorName = subdomainName.errors[error];
        
        assert(Boolean(errorName.message), `Error configuration file : Missing required 'message' field in '${domain}-${subdomain}-${error}'.`);
        assert(typeof errorName.message === 'string', `Error configuration file : Field 'message' must be a string in '${domain}-${subdomain}-${error}'.`);
        assert(Boolean(errorName.class), `Error configuration file : Missing required 'class' field in '${domain}-${subdomain}-${error}'.`);
        assert(typeof errorName.class === 'string', `Error configuration file : Field 'class' must be a string in '${domain}-${subdomain}-${error}'.`);
        assert(Boolean(errors[errorName.class]), `Error configuration file : Invalid field 'class' in '${domain}-${subdomain}-${error}', '${errorName.class}' does not exist.`);
        assert(Boolean(errorName.code), `Error configuration file : Missing required 'code' field in '${domain}-${subdomain}-${error}'.`);
        assert(Number.isInteger(errorName.code), `Error configuration file : Field 'code' must be an integer in '${domain}-${subdomain}-${error}'.`);
        assert(errorName.code > 0x0000 && errorName.code <= 0xFFFF, `Error configuration file : Field 'code' must be between 0 and 65535 in '${domain}-${subdomain}-${error}'.`);
      }
    }
  }
}

checkErrorCodes({ api, internal, plugins });

module.exports = {
  api,
  internal,
  plugins
};
