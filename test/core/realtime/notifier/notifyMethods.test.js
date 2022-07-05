'use strict';

const should = require('should');
const sinon = require('sinon');

const { Request } = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const { HotelClerk } = require('../../../../lib/core/realtime/hotelClerk');
const { Channel } = require('../../../../lib/core/realtime/channel');
const { Room } = require('../../../../lib/core/realtime/room');
const Notifier = require('../../../../lib/core/realtime/notifier');
const {
  DocumentNotification,
  UserNotification,
} = require('../../../../lib/core/realtime/notification');
const { ConnectionRooms } = require('../../../../lib/core/realtime/connectionRooms');

describe('notify methods', () => {
  let kuzzle;
  let request;
  let notifier;
  let hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    hotelClerk = new HotelClerk();
    sinon.stub(hotelClerk, 'removeConnection');

    notifier = new Notifier({ hotelClerk });

    request = new Request({
      volatile: { foo: 'bar' },
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    }, { protocol: 'protocol' });

    hotelClerk.rooms.set('matchingSome', new Room(
      'matchingSome',
      'index',
      'collection',
      new Map([
        ['matching_all', new Channel('matchingSome', { scope: 'all', users: 'all', propagate: true })],
        ['matching_in', new Channel('matchingSome', { scope: 'in', users: 'none', propagate: true })],
        ['matching_out', new Channel('matchingSome', { scope: 'out', users: 'none', propagate: true })],
        ['matching_none', new Channel('matchingSome', { scope: 'none', users: 'none', propagate: true })],
        ['matching_userIn', new Channel('matchingSome', { scope: 'none', users: 'in', propagate: true })],
        ['matching_userOut', new Channel('matchingSome', { scope: 'none', users: 'out', propagate: true })],
      ]),
    ));

    hotelClerk.rooms.set('nonMatching', new Room(
      'nonMatching',
      'index',
      'collection',
      new Map([
        ['foobar', new Channel('nonMatching', { scope: 'none', propagate: true })],
      ]),
    ));

    hotelClerk.rooms.set('cluster', new Room(
      'cluster',
      'index',
      'collection',
      new Map([
        ['clusterOn', new Channel('cluster', { scope: 'all', users: 'all', propagate: true }) ],
        ['clusterOff', new Channel('cluster', { scope: 'all', users: 'all', propagate: false }) ],
      ]),
    ));

    hotelClerk.rooms.set('alwaysMatching', new Room(
      'alwaysMatching',
      'index',
      'collection',
      new Map([
        ['always', new Channel('alwaysMatching', { scope: 'all', propagate: true })],
      ]),
    ));

    return notifier.init();
  });

  describe('#notifyDocument', () => {
    it('should do nothing if there is no room to notify', async () => {
      sinon.stub(notifier, '_notifyDocument');

      await notifier.notifyDocument([], request, 'out', 'action', {});

      should(notifier._notifyDocument).not.called();
      should(kuzzle.emit).not.called();
    });

    it('should emit the cluster sync event', async () => {
      notifier._notifyDocument = sinon.stub();
      const content = { some: 'content' };
      const rooms = [
        'matchingSome',
        'nonMatching',
        'alwaysMatching',
        'IAMERROR',
        'cluster'
      ];

      await notifier.notifyDocument(
        rooms,
        request,
        'out',
        'update',
        content);

      const expectedNotification = DocumentNotification.fromRequest(
        request,
        'out',
        'update',
        content);

      should(notifier._notifyDocument).be.calledWith(
        rooms,
        expectedNotification,
        { fromCluster: false });

      should(kuzzle.emit.callCount).be.eql(1);
      should(kuzzle.emit.getCall(0).args).match([
        'core:notify:document',
        {
          notification: expectedNotification,
          rooms,
        }
      ]);
    });
  });

  describe('#_notifyDocument', () => {
    describe('call from the core', () => {
      it('should do nothing if the provided rooms list is empty', async () => {
        await notifier._notifyDocument(
          [],
          request,
          'scope',
          'update',
          { some: 'content' },
          { fromCluster: false });

        should(kuzzle.entryPoint.dispatch).not.be.called();
        should(kuzzle.emit).not.be.called();
      });

      it('should notify the right channels', async () => {
        sinon.spy(notifier, '_notifyDocument');
        const content = { some: 'content' };
        const documentNotification = DocumentNotification.fromRequest(
          request,
          'out',
          'update',
          content);

        await notifier._notifyDocument(
          ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
          documentNotification,
          { fromCluster: false });

        const dispatch = kuzzle.entryPoint.dispatch;

        should(dispatch).calledOnce();
        should(dispatch.firstCall.args[0]).be.eql('broadcast');

        should(dispatch.firstCall.args[1].channels).eql(
          ['matching_all', 'matching_out', 'always', 'clusterOn', 'clusterOff']);

        should(dispatch.firstCall.args[1].payload).be.instanceof(
          DocumentNotification);

        const notification = dispatch.firstCall.args[1].payload;

        should(notification).match({
          status: 200,
          type: 'document',
          requestId: request.id,
          timestamp: request.timestamp,
          volatile: request.input.volatile,
          index: request.input.args.index,
          collection: request.input.args.collection,
          controller: request.input.controller,
          event: 'write',
          action: 'update',
          protocol: request.context.protocol,
          node: kuzzle.id,
          scope: 'out',
          result: content,
        });

        should(kuzzle.pipe.callCount).be.eql(3);

        should(kuzzle.pipe.getCall(0).args).match(
          ['notify:document', notification]);

        should(kuzzle.pipe.getCall(1).args).match(
          ['notify:dispatch', notification]);

        should(kuzzle.pipe.getCall(2).args).match(
          [
            'core:realtime:notification:dispatch:before',
            {
              channels: ['matching_all', 'matching_out', 'always', 'clusterOn', 'clusterOff'],
              notification,
            }
          ]);
      });

      it('should not notify if no channel match the provided scope argument', async () => {
        const content = { some: 'content' };

        await notifier.notifyDocument(
          ['nonMatching', 'IAMERROR'],
          request,
          'not a scope',
          'create',
          content,
          { fromCluster: false });

        should(kuzzle.entryPoint.dispatch).not.be.called();
      });
    });

    describe('call from the cluster', () => {
      it('should notify every channels', async () => {
        const content = { some: 'content' };
        const documentNotification = DocumentNotification.fromRequest(
          request,
          'out',
          'create',
          content);

        await notifier._notifyDocument(
          ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
          documentNotification);

        const dispatch = kuzzle.entryPoint.dispatch;
        should(dispatch.firstCall.args[1].channels).eql(
          ['matching_all', 'matching_out', 'always', 'clusterOn']);
      });
    });
  });

  describe('#notifyUser', () => {
    it('should ignore non-existing rooms', () => {
      return notifier.notifyUser('IAMERROR', request, 'all', {})
        .then(() => {
          should(kuzzle.entryPoint.dispatch).not.be.called();
        });
    });

    it('should not notify if no channel match the provided arguments', () => {
      return notifier.notifyUser('nonMatching', request, 'all', {})
        .then(() => {
          should(kuzzle.entryPoint.dispatch).not.be.called();
        });
    });

    it('should notify the right channels', async () => {
      const content = { some: 'content' };

      await notifier.notifyUser('matchingSome', request, 'out', content);

      const dispatch = kuzzle.entryPoint.dispatch;

      should(dispatch).calledOnce();
      should(dispatch.firstCall.args[0]).be.eql('broadcast');

      should(dispatch.firstCall.args[1].channels).match([
        'matching_all',
        'matching_userOut',
      ]);

      should(dispatch.firstCall.args[1].payload)
        .be.instanceof(UserNotification);

      const notification = dispatch.firstCall.args[1].payload;

      should(notification).match({
        status: 200,
        type: 'user',
        timestamp: request.timestamp,
        volatile: request.input.volatile,
        index: request.input.resource.index,
        collection: request.input.resource.collection,
        controller: request.input.controller,
        action: request.input.action,
        protocol: request.context.protocol,
        node: kuzzle.id,
        user: 'out',
        result: content
      });

      should(kuzzle.emit.callCount).be.eql(1);
      should(kuzzle.emit.getCall(0).args).match([
        'core:notify:user',
        {
          notification,
          room: 'matchingSome',
        }
      ]);
      should(kuzzle.pipe.callCount).be.eql(3);

      should(kuzzle.pipe.getCall(0).args).match(
        ['notify:user', notification]);

      should(kuzzle.pipe.getCall(1).args).match(
        ['notify:dispatch', notification]);
      
      should(kuzzle.pipe.getCall(2).args).match(
        [
          'core:realtime:notification:dispatch:before',
          {
            channels: ['matching_all', 'matching_userOut'],
            notification,
          }
        ]);
    });
  });

  describe('#notifyTokenExpired', () => {
    it('should register a "tokenExpired" event', async () => {
      sinon.stub(notifier, 'notifyTokenExpired');

      kuzzle.ask.restore();
      await kuzzle.ask('core:realtime:tokenExpired:notify', 'connectionId');

      should(notifier.notifyTokenExpired).calledWith('connectionId');
    });

    it('should notify on channel kuzzle:notification:server', async () => {
      hotelClerk.subscriptions.set('foobar', new ConnectionRooms(new Map([
        ['nonMatching', null],
        ['alwaysMatching', null],
      ])));

      await notifier.notifyTokenExpired('foobar');

      const dispatch = kuzzle.entryPoint.dispatch;
      should(dispatch).calledOnce();

      should(dispatch.firstCall.args[0]).be.eql('notify');

      should(dispatch.firstCall.args[1].connectionId).be.eql('foobar');

      should(dispatch.firstCall.args[1].channels).match(
        ['kuzzle:notification:server']);

      const notification = dispatch.firstCall.args[1].payload;

      should(notification).match({
        status: 200,
        type: 'TokenExpired',
        message: 'Authentication Token Expired',
        info: 'This is an automated server notification',
      });

      should(kuzzle.pipe.callCount).be.eql(3);
      should(kuzzle.pipe)
        .be.calledWith('notify:server', notification)
        .be.calledWith('notify:dispatch', notification)
        .be.calledWith('core:realtime:notification:dispatch:before', {
          channels: ['kuzzle:notification:server'],
          connectionId: 'foobar',
          notification,
        });
    });
  });

  describe('dispatch', () => {
    it('should call entrypoint.dispatch  with notify action when there is a connectionId',  async () => {
      await notifier._dispatch('my-event', ['channel-foo'], { foo: 'bar' }, 'connectionId');

      should(kuzzle.entryPoint.dispatch)
        .calledOnce()
        .and.be.calledWith('notify', {
          channels: [ 'channel-foo' ],
          connectionId: 'connectionId',
          payload: { foo: 'bar' },
        });
    });

    it('should call entrypoint.dispatch  with broadcast action when there is no connectionId',  async () => {
      await notifier._dispatch('my-event', ['channel-foo'], { foo: 'bar' });

      should(kuzzle.entryPoint.dispatch)
        .calledOnce()
        .and.be.calledWith('broadcast', {
          channels: [ 'channel-foo' ],
          connectionId: undefined,
          payload: { foo: 'bar' },
        });
    });

    it('should trigger the pipes', async () => {
      kuzzle.registerPluginPipe('my-event', async (payload) => {
        return {
          ...payload,
          bar: 'baz'
        };
      });

      kuzzle.registerPluginPipe('notify:dispatch', async (payload) => {
        return {
          ...payload,
          baz: 'alpha'
        };
      });

      kuzzle.registerPluginPipe('core:realtime:notification:dispatch:before', async (notificationContext) => {
        return {
          channels: [ 'channel-bar' ],
          connectionId: undefined,
          notification: {
            ...notificationContext.notification,
            alpha: 'beta'
          },
        };
      });

      await notifier._dispatch('my-event', ['channel-foo'], { foo: 'bar' }, 'foobar');

      await should(kuzzle.pipe)
        .be.calledWith('my-event', { foo: 'bar' })
        .be.calledWith('notify:dispatch', { foo: 'bar', bar: 'baz' })
        .be.calledWith('core:realtime:notification:dispatch:before', {
          channels: [ 'channel-foo' ],
          connectionId: 'foobar',
          notification: { foo: 'bar', bar: 'baz', baz: 'alpha' },
        });

      await should(kuzzle.entryPoint.dispatch)
        .calledOnce()
        .and.be.calledWith('broadcast', {
          channels: [ 'channel-bar' ],
          connectionId: undefined,
          payload: { foo: 'bar', bar: 'baz', baz: 'alpha', alpha: 'beta' },
        });
    });
  });
});
