'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const Notifier = require('../../../../lib/core/realtime/notifier');
const {
  DocumentNotification,
  UserNotification,
} = require('../../../../lib/model/notification');

describe('notify methods', () => {
  let
    kuzzle,
    request,
    notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    request = new Request({
      volatile: {foo: 'bar'},
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    }, {protocol: 'protocol'});

    kuzzle.hotelClerk.rooms.set('matchingSome', {
      channels: {
        matching_all: {state: 'all', scope: 'all', users: 'all', cluster: true },
        matching_in: {state: 'all', scope: 'in', users: 'none', cluster: true },
        matching_out: {state: 'all', scope: 'out', users: 'none', cluster: true },
        matching_none: {state: 'none', scope: 'none', users: 'none', cluster: true },
        matching_userIn: {state: 'none', scope: 'none', users: 'in', cluster: true },
        matching_userOut: {state: 'none', scope: 'none', users: 'out', cluster: true }
      }
    });

    kuzzle.hotelClerk.rooms.set('nonMatching', {
      channels: {
        foobar: { cluster: true  }
      }
    });

    kuzzle.hotelClerk.rooms.set('cluster', {
      channels: {
        clusterOn: {state: 'all', scope: 'all', users: 'all', cluster: true },
        clusterOff: {state: 'all', scope: 'all', users: 'all', cluster: false },
      }
    });

    kuzzle.hotelClerk.rooms.set('alwaysMatching', {
      channels: {
        always: {state: 'all', scope: 'all', cluster: true }
      }
    });
  });

  describe('#notifyDocument', () => {
    it('should emit the cluster sync event', async () => {
      notifier._notifyDocument = sinon.stub();
      const content = {some: 'content'};

      await notifier.notifyDocument(
          ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
          request,
          'out',
          'action',
          content);

      should(notifier._notifyDocument).be.calledWith(
        ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
        request,
        'out',
        'action',
        content,
        { fromCluster: false });

      should(kuzzle.emit.callCount).be.eql(1);
      should(kuzzle.emit.getCall(0).args).match([
        'core:notify:document',
        {
          rooms: [
            'matchingSome',
            'nonMatching',
            'alwaysMatching',
            'IAMERROR'
          ],
          scope: 'out',
          action: 'action',
          content,
          request: request.serialize()
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
          'action',
          { some: 'content'},
          { fromCluster: false });

        should(kuzzle.entryPoint.dispatch).not.be.called();
        should(kuzzle.emit).not.be.called();
      });

      it('should notify the right channels', async () => {
        sinon.spy(notifier, '_notifyDocument');
        const content = {some: 'content'};

        await notifier._notifyDocument(
            ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
            request,
            'out',
            'action',
            content,
            { fromCluster: false });

        should(notifier._notifyDocument.getCall(0).args[5])
          .be.eql({ fromCluster: false});

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
          index: request.input.resource.index,
          collection: request.input.resource.collection,
          controller: request.input.controller,
          action: 'action',
          protocol: request.context.protocol,
          scope: 'out',
          result: content
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
          'action',
          content,
          { fromCluster: false });

        should(kuzzle.entryPoint.dispatch).not.be.called();
      });
    });

    describe('call from the cluster', () => {
      it('should notify every channels', async () => {
        const content = {some: 'content'};

        await notifier._notifyDocument(
          ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR', 'cluster'],
          request,
          'out',
          'action',
          content);

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

    it('should notify the right channels', () => {
      const content = {some: 'content'};

      return notifier.notifyUser('matchingSome', request, 'out' , content)
        .then(() => {
          const dispatch = kuzzle.entryPoint.dispatch;

          should(dispatch).calledOnce();

          should(dispatch.firstCall.args[0]).be.eql('broadcast');

          should(dispatch.firstCall.args[1].channels)
            .match(['matching_all', 'matching_userOut']);

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
            user: 'out',
            result: content
          });

          should(kuzzle.emit.callCount).be.eql(1);
          should(kuzzle.emit.getCall(0).args).match([
            'core:notify:user',
            {
              room: 'matchingSome',
              scope: 'out',
              content,
              request: request.serialize()
            }
          ]);
          should(kuzzle.pipe.callCount).be.eql(2);

          should(kuzzle.pipe.getCall(0).args).match(
            ['notify:user', notification]);

          should(kuzzle.pipe.getCall(1).args).match(
            ['notify:dispatch', notification]);
        });
    });
  });

  describe('#notifyServer', () => {
    it('should do nothing if the provided rooms list is empty', () => {
      return notifier.notifyServer([], 'foobar', 'type', 'message')
        .then(() => {
          should(kuzzle.entryPoint.dispatch).not.be.called();
          should(kuzzle.pipe).not.be.called();
        });
    });

    it('should ignore non-existing rooms', () => {
      return notifier.notifyServer(['IAMERROR'], 'foobar', 'type', 'message')
        .then(() => {
          should(kuzzle.entryPoint.dispatch).not.be.called();
          should(kuzzle.pipe).not.be.called();
        });
    });

    it('should notify on all subscribed channels', () => {
      return notifier
        .notifyServer(
          ['nonMatching', 'alwaysMatching'], 'foobar', 'type', 'message')
        .then(() => {
          const dispatch = kuzzle.entryPoint.dispatch;
          should(dispatch).calledOnce();

          should(dispatch.firstCall.args[0]).be.eql('notify');

          should(dispatch.firstCall.args[1].connectionId).be.eql('foobar');

          should(dispatch.firstCall.args[1].channels).match(
            ['foobar', 'always']);

          const notification = dispatch.firstCall.args[1].payload;

          should(notification).match({
            status: 200,
            type: 'type',
            message: 'message',
            info: 'This is an automated server notification'
          });

          should(kuzzle.pipe.callCount).be.eql(2);
          should(kuzzle.pipe)
            .be.calledWith('notify:server', notification)
            .be.calledWith('notify:dispatch', notification);
        });
    });
  });
});
