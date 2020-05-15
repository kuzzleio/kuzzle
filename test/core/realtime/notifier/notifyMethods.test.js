'use strict';

const should = require('should');
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
        matching_all: {state: 'all', scope: 'all', users: 'all'},
        matching_in: {state: 'all', scope: 'in', users: 'none'},
        matching_out: {state: 'all', scope: 'out', users: 'none'},
        matching_none: {state: 'none', scope: 'none', users: 'none'},
        matching_userIn: {state: 'none', scope: 'none', users: 'in'},
        matching_userOut: {state: 'none', scope: 'none', users: 'out'}
      }
    });

    kuzzle.hotelClerk.rooms.set('nonMatching', {
      channels: {
        foobar: {}
      }
    });

    kuzzle.hotelClerk.rooms.set('alwaysMatching', {
      channels: {
        always: {state: 'all', scope: 'all'}
      }
    });
  });

  describe('#notifyDocument', () => {
    it('should do nothing if the provided rooms list is empty', () => {
      return notifier
        .notifyDocument([], request, 'scope', 'action', { some: 'content'})
        .then(() => {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.emit).not.be.called();
        });
    });

    it('should notify the right channels', () => {
      const content = {some: 'content'};

      return notifier
        .notifyDocument(
          ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR'],
          request,
          'out',
          'action',
          content)
        .then(() => {
          const dispatch = kuzzle.entryPoints.dispatch;

          should(dispatch).calledOnce();
          should(dispatch.firstCall.args[0]).be.eql('broadcast');

          should(dispatch.firstCall.args[1].channels).match(
            ['matching_all', 'matching_out', 'always']);

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
          should(kuzzle.pipe.callCount).be.eql(2);

          should(kuzzle.pipe.getCall(0).args).match(
            ['notify:document', notification]);

          should(kuzzle.pipe.getCall(1).args).match(
            ['notify:dispatch', notification]);
        });
    });

    it('should not notify if no channel match the provided scope argument', () => {
      const content = {some: 'content'};

      return notifier
        .notifyDocument(
          ['nonMatching', 'IAMERROR'],
          request,
          'not a scope',
          'action',
          content)
        .then(() => {
          should(kuzzle.entryPoints.dispatch).not.be.called();
        });
    });
  });

  describe('#notifyUser', () => {
    it('should ignore non-existing rooms', () => {
      return notifier.notifyUser('IAMERROR', request, 'all', {})
        .then(() => {
          should(kuzzle.entryPoints.dispatch).not.be.called();
        });
    });

    it('should not notify if no channel match the provided arguments', () => {
      return notifier.notifyUser('nonMatching', request, 'all', {})
        .then(() => {
          should(kuzzle.entryPoints.dispatch).not.be.called();
        });
    });

    it('should notify the right channels', () => {
      const content = {some: 'content'};

      return notifier.notifyUser('matchingSome', request, 'out' , content)
        .then(() => {
          const dispatch = kuzzle.entryPoints.dispatch;

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
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.pipe).not.be.called();
        });
    });

    it('should ignore non-existing rooms', () => {
      return notifier.notifyServer(['IAMERROR'], 'foobar', 'type', 'message')
        .then(() => {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.pipe).not.be.called();
        });
    });

    it('should notify on all subscribed channels', () => {
      return notifier
        .notifyServer(
          ['nonMatching', 'alwaysMatching'], 'foobar', 'type', 'message')
        .then(() => {
          const dispatch = kuzzle.entryPoints.dispatch;
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
