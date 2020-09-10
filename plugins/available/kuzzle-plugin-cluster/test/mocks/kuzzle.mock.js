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

const sinon = require('sinon');

class KuzzleMock {
  constructor () {
    this.config = {
      services: {
        internalCache: {
          node: {
            host: 'redis'
          }
        }
      }
    };

    this.context = {
      errors: {}
    };

    this.funnel = {
      controllers: new Map([
        ['realtime', {}]
      ])
    };

    this.storageEngine = {
      indexCache: {
        add: sinon.spy(),
        remove: sinon.spy(),
        reset: sinon.spy()
      }
    };

    this.janitor = {
      dump: sinon.spy()
    };

    this.pluginsManager = {
      listStrategies: sinon.stub().returns([]),
      registerStrategy: sinon.stub(),
      strategies: {},
      unregisterStrategy: sinon.stub()
    };

    this.koncorde = {
      getFilterIds: sinon.stub(),
      hasFilter: sinon.stub(),
      remove: sinon.stub(),
      store: sinon.stub()
    };

    this.services = {
      list: {
        storageEngine: {
          setAutoRefresh: sinon.spy(),
          settings: {
            autoRefresh: {}
          }
        }
      }
    };

    this.validation = {
      curateSpecification: sinon.stub().resolves()
    };

    this.ask = sinon.stub().resolves();
  }
}

module.exports = KuzzleMock;
