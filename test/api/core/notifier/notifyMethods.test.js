const
  async = require('async'),
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  Notification = require('../../../../lib/api/core/models/notifications');

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

    kuzzle.hotelClerk.rooms = {
      matchingSome: {
        channels: {
          matching_all: {state: 'all', scope: 'all', users: 'all'},
          matching_in: {state: 'all', scope: 'in', users: 'none'},
          matching_out: {state: 'all', scope: 'out', users: 'none'},
          matching_pending: {state: 'pending', scope: 'all', users: 'none'},
          matching_done: {state: 'done', scope: 'all', users: 'none'},
          matching_none: {state: 'none', scope: 'none', users: 'none'},
          matching_userIn: {state: 'none', scope: 'none', users: 'in'},
          matching_userOut: {state: 'none', scope: 'none', users: 'out'}
        }
      },
      nonMatching: {
        channels: {
          foobar: {}
        }
      },
      alwaysMatching: {
        channels: {
          always: {state: 'all', scope: 'all'}
        }
      }
    };
  });

  describe('#notifyDocument', () => {
    it('should do nothing if the provided rooms list is empty', done => {
      notifier.notifyDocument([], request, 'scope', 'state', 'action', { some: 'content'});

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.pluginsManager.trigger).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });

    it('should notify the right channels', done => {
      const content = {some: 'content'};
      notifier.notifyDocument(
        ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR'],
        request,
        'out',
        'pending',
        'action',
        content
      );

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).calledOnce();

          should(kuzzle.entryPoints.dispatch.firstCall.args[0]).be.eql('broadcast');

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].channels)
            .match(['matching_all', 'matching_out', 'matching_pending', 'always']);

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].payload)
            .be.instanceof(Notification.Document);

          const notification = kuzzle.entryPoints.dispatch.firstCall.args[1].payload;

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
            state: 'pending',
            result: content
          });

          should(kuzzle.pluginsManager.trigger.callCount).be.eql(3);
          should(kuzzle.pluginsManager.trigger.getCall(0).args).match([
            'core:notify:document',
            {
              rooms: ['matchingSome', 'nonMatching', 'alwaysMatching', 'IAMERROR'],
              scope: 'out',
              state: 'pending',
              action: 'action',
              content,
              request: request.serialize()
            }
          ]);
          should(kuzzle.pluginsManager.trigger.getCall(1).args).match(['notify:document', notification]);
          should(kuzzle.pluginsManager.trigger.getCall(2).args).match(['notify:dispatch', notification]);
          cb();
        }
        catch (e) {
          cb(e);
        }
      }, done);
    });

    it('should not notify if no channel match the provided scope/state arguments', done => {
      const content = {some: 'content'};
      notifier.notifyDocument(
        ['nonMatching', 'IAMERROR'],
        request,
        'not a state',
        'not a scope',
        'action',
        content
      );

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });
  });

  describe('#notifyUser', () => {
    it('should ignore non-existing rooms', done => {
      notifier.notifyUser('IAMERROR', request, 'all', {});

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });

    it('should not notify if no channel match the provided arguments', done => {
      notifier.notifyUser('nonMatching', request, 'all', {});

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });

    it('should notify the right channels', done => {
      const content = {some: 'content'};
      notifier.notifyUser('matchingSome', request, 'out' , content);

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).calledOnce();

          should(kuzzle.entryPoints.dispatch.firstCall.args[0]).be.eql('broadcast');

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].channels)
            .match(['matching_all', 'matching_userOut']);

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].payload)
            .be.instanceof(Notification.User);

          const notification = kuzzle.entryPoints.dispatch.firstCall.args[1].payload;

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

          should(kuzzle.pluginsManager.trigger.callCount).be.eql(3);
          should(kuzzle.pluginsManager.trigger.getCall(0).args).match([
            'core:notify:user',
            {
              room: 'matchingSome',
              scope: 'out',
              content,
              request: request.serialize()
            }
          ]);
          should(kuzzle.pluginsManager.trigger.getCall(1).args).match(['notify:user', notification]);
          should(kuzzle.pluginsManager.trigger.getCall(2).args).match(['notify:dispatch', notification]);
          cb();
        }
        catch (e) {
          cb(e);
        }
      }, done);
    });
  });

  describe('#notifyServer', () => {
    it('should do nothing if the provided rooms list is empty', done => {
      notifier.notifyServer([], 'foobar', 'type', 'message');

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.pluginsManager.trigger).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });

    it('should ignore non-existing rooms', done => {
      notifier.notifyServer(['IAMERROR'], 'foobar', 'type', 'message');

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).not.be.called();
          should(kuzzle.pluginsManager.trigger).not.be.called();
          cb();
        }
        catch(e) {
          cb(e);
        }
      }, done);
    });

    it('should notify on all subscribed channels', done => {
      notifier.notifyServer(['nonMatching', 'alwaysMatching'], 'foobar', 'type', 'message');

      async.retry({times: 20, interval: 20}, cb => {
        try {
          should(kuzzle.entryPoints.dispatch).calledOnce();

          should(kuzzle.entryPoints.dispatch.firstCall.args[0]).be.eql('notify');

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].connectionId).be.eql('foobar');

          should(kuzzle.entryPoints.dispatch.firstCall.args[1].channels)
            .match(['foobar', 'always']);

          const notification = kuzzle.entryPoints.dispatch.firstCall.args[1].payload;

          should(notification).match({
            status: 200,
            type: 'type',
            message: 'message',
            info: 'This is an automated server notification'
          });

          should(kuzzle.pluginsManager.trigger.callCount).be.eql(2);
          should(kuzzle.pluginsManager.trigger)
            .be.calledWith('notify:server', notification)
            .be.calledWith('notify:dispatch', notification);
          cb();
        }
        catch (e) {
          cb(e);
        }
      }, done);
    });
  });
});
