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


const
  should = require('should'),
  RedisMock = require('../../mocks/redis.mock'),
  State = require('../../../lib/redis/state');

describe('lib/redis/state', () => {
  let
    redis;

  beforeEach(() => {
    redis = new RedisMock();
  });

  describe('#constructor', () => {
    it('should parse the raw data from redis', () => {
      const state = new State(['42', [
        ['id1', JSON.stringify({foo: 'bar'}), '3'],
        ['id2', JSON.stringify({bar: 'baz'}), '7'],
        ['id3', null, '42']
      ]]);

      should(state.version).eql(42);
      should(state.rooms).eql([
        {
          id: 'id1',
          filter: {foo: 'bar'},
          count: 3
        },
        {
          id: 'id2',
          filter: {bar: 'baz'},
          count: 7
        },
        {
          id: 'id3',
          filter: null,
          count: 42
        }
      ]);
    });

    it('should init the version to 1 if no response was gotten from redis', () => {
      const state = new State([null, []]);
      should(state.version).eql(1);
    });
  });

  describe('#current', () => {
    it('should return a state object fed from redis data', () => {
      redis.clusterState.resolves([42, [
        ['id1', JSON.stringify({foo: 'bar'}), 3],
        ['id2', JSON.stringify({bar: 'baz'}), 7]
      ]]);

      return State.current(redis, 'index', 'collection')
        .then(state => {
          should(redis.clusterState)
            .be.calledWith('{index/collection}');

          should(state.version).eql(42);
          should(state.rooms).eql([
            {
              id: 'id1',
              filter: {foo: 'bar'},
              count: 3
            },
            {
              id: 'id2',
              filter: {bar: 'baz'},
              count: 7
            }
          ]);
        });
    });
  });
});


