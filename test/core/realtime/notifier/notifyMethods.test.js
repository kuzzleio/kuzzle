'use strict';

const should = require('should');
const sinon = require('sinon');

const { Request } = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');
const Notifier = require('../../../../lib/core/realtime/notifier');
const {
  DocumentNotification,
  UserNotification,
} = require('../../../../lib/core/realtime/notification');

describe('notify methods', () => {
  let kuzzle;
  let request;
  let notifier;
  let hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    hotelClerk = new HotelClerk();
    sinon.stub(hotelClerk, 'removeUser');

    notifier = new Notifier({ hotelClerk });

    request = new Request({
      volatile: {foo: 'bar'},
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    }, {protocol: 'protocol'});

    hotelClerk.rooms.set('matchingSome', {
      channels: {
        matching_all: {state: 'all', scope: 'all', users: 'all', cluster: true },
        matching_in: {state: 'all', scope: 'in', users: 'none', cluster: true },
        matching_out: {state: 'all', scope: 'out', users: 'none', cluster: true },
        matching_none: {state: 'none', scope: 'none', users: 'none', cluster: true },
        matching_userIn: {state: 'none', scope: 'none', users: 'in', cluster: true },
        matching_userOut: {state: 'none', scope: 'none', users: 'out', cluster: true }
      }
    });

    hotelClerk.rooms.set('nonMatching', {
      channels: {
        foobar: { cluster: true }
      }
    });

    hotelClerk.rooms.set('cluster', {
      channels: {
        clusterOn: {state: 'all', scope: 'all', users: 'all', cluster: true },
        clusterOff: {state: 'all', scope: 'all', users: 'all', cluster: false },
      }
    });

    hotelClerk.rooms.set('alwaysMatching', {
      channels: {
        always: {state: 'all', scope: 'all', cluster: true }
      }
    });

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
      const content = {some: 'content'};
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

      const expectedNotification = new DocumentNotification(
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
          { some: 'content'},
          { fromCluster: false });

        should(kuzzle.entryPoint.dispatch).not.be.called();
        should(kuzzle.emit).not.be.called();
      });

      it('should notify the right channels', async () => {
        sinon.spy(notifier, '_notifyDocument');
        const content = {some: 'content'};
        const documentNotification = new DocumentNotification(
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

        should(kuzzle.pipe.callCount).be.eql(2);

        should(kuzzle.pipe.getCall(0).args).match(
          ['notify:document', notification]);

        should(kuzzle.pipe.getCall(1).args).match(
          ['notify:dispatch', notification]);
      });

      it('should not notify if no channel match the provided scope argument', async () => {
        const content = {some: 'content'};

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
        const content = {some: 'content'};
        const documentNotification = new DocumentNotification(
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
      const content = {some: 'content'};

      await notifier.notifyUser('matchingSome', request, 'out' , content);

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
      should(kuzzle.pipe.callCount).be.eql(2);

      should(kuzzle.pipe.getCall(0).args).match(
        ['notify:user', notification]);

      should(kuzzle.pipe.getCall(1).args).match(
        ['notify:dispatch', notification]);
    });
  });

  describe('#notifyTokenExpired', () => {
    it('should register a "tokenExpired" event', async () => {
      sinon.stub(notifier, 'notifyTokenExpired');

      kuzzle.ask.restore();
      await kuzzle.ask('core:realtime:tokenExpired:notify', 'connectionId');

      should(notifier.notifyTokenExpired).calledWith('connectionId');
    });

    it('should ignore non-existing rooms', async () => {
      hotelClerk.customers.clear();

      await notifier.notifyTokenExpired('foobar');

      should(kuzzle.entryPoint.dispatch).not.be.called();
      should(kuzzle.pipe).not.be.called();
      should(hotelClerk.removeUser).not.called();
    });

    it('should notify subscribed channels', async () => {
      hotelClerk.customers.set('foobar', new Map([
        ['nonMatching', null],
        ['alwaysMatching', null],
      ]));

      await notifier.notifyTokenExpired('foobar');

      const dispatch = kuzzle.entryPoint.dispatch;
      should(dispatch).calledOnce();

      should(dispatch.firstCall.args[0]).be.eql('notify');

      should(dispatch.firstCall.args[1].connectionId).be.eql('foobar');

      should(dispatch.firstCall.args[1].channels).match(
        ['foobar', 'always']);

      const notification = dispatch.firstCall.args[1].payload;

      should(notification).match({
        status: 200,
        type: 'TokenExpired',
        message: 'Authentication Token Expired',
        info: 'This is an automated server notification',
      });

      should(kuzzle.pipe.callCount).be.eql(2);
      should(kuzzle.pipe)
        .be.calledWith('notify:server', notification)
        .be.calledWith('notify:dispatch', notification);
    });
  });
});
