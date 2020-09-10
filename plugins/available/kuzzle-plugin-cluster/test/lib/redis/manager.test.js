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
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  NodeMock = require('../../mocks/node.mock'),
  RedisMock = require('../../mocks/redis.mock'),
  StateManager = require('../../../lib/redis/manager');

describe('lib/redis/manager', () => {
  let
    manager;

  beforeEach(() => {
    const cluster = {
      kuzzle: new KuzzleMock(),
      redis: new RedisMock(),
      deleteRoomCount: sinon.stub(),
      setRoomCount: sinon.stub()
    };

    const node = new NodeMock(cluster);
    manager = new StateManager(node);
  });

  describe('#getVersion', () => {
    it('should return the version for the index/collection tuple', () => {
      manager._versions.set('index', new Map([['collection', 42]]));

      should(manager.getVersion()).eql(-1);
      should(manager.getVersion('i dont', 'exist')).eql(0);
      should(manager.getVersion('index', 'collection')).eql(42);
    });
  });

  describe('#setVersion', () => {
    it('should set the version', () => {
      // global
      manager.setVersion(42);
      should(manager.getVersion('*', '*')).eql(42);

      manager.setVersion(3, 'index', 'collection');
      should(manager.getVersion('index', 'collection')).eql(3);
    });
  });

  describe('#sync', () => {
    beforeEach(() => {
      manager.node.redis.clusterState.resolves([3, [
        ['id1', JSON.stringify({index: 'i1', collection: 'c1', filters: 'f1'}), 7],
        ['id2', JSON.stringify({index: 'i2', collection: 'c2', filters: 'f2'}), 12],
        ['id3', JSON.stringify({index: 'i3', collection: 'c3', filters: 'f3'}), 1]
      ]]);
    });

    afterEach(() => {
      manager.locks.delete.clear();
      manager.locks.create.clear();
    });

    it('should do nothing if the current version is more recent than the one received from redis', () => {
      manager.node.redis.clusterState.resolves([-1, []]);
      manager.setVersion = sinon.stub();

      return manager.sync({
        index: 'index',
        collection: 'collection'
      })
        .then(() => {
          should(manager.setVersion)
            .not.be.called();
        });
    });

    it('should update the current version and sync the rooms', () => {
      manager.setVersion = sinon.stub();
      manager.kuzzle.koncorde.getFilterIds.returns(['id4', 'id5']);

      manager.locks.delete.add('id2');
      manager.locks.create.add('id4');

      return manager.sync({index: 'index', collection: 'collection'})
        .then(() => {
          should(manager.setVersion)
            .be.calledWith(3, 'index', 'collection');

          should(manager.node.context.setRoomCount)
            .be.calledTwice()
            .be.calledWith('i1', 'c1', 'id1', 7)
            .be.calledWith('i3', 'c3', 'id3', 1);

          should(manager.kuzzle.koncorde.store)
            .be.calledTwice()
            .be.calledWith({
              index: 'i1',
              collection: 'c1',
              normalized: 'f1',
              id: 'id1'
            })
            .be.calledWith({
              index: 'i3',
              collection: 'c3',
              normalized: 'f3',
              id: 'id3'
            });

          should(manager.node.context.deleteRoomCount)
            .be.calledOnce()
            .be.calledWith('id5');
          should(manager.kuzzle.koncorde.remove)
            .be.calledOnce()
            .be.calledWith('id5');
        });
    });
  });

  describe('#syncAll', () => {
    it('should sync every index/collection tuple and refresh global settings', () => {
      manager.sync = sinon.stub();
      manager.node.redis.smembers.resolves([
        'i1/c1',
        'i2/c2',
        'i3/c3'
      ]);

      return manager.syncAll({})
        .then(() => {
          should(manager.sync)
            .be.calledThrice()
            .be.calledWith({index: 'i1', collection: 'c1'})
            .be.calledWith({index: 'i2', collection: 'c2'})
            .be.calledWith({index: 'i3', collection: 'c3'});

          should(manager.node.sync)
            .be.calledOnce()
            .be.calledWith({event: 'strategies'});
        });
    });
  });
});
