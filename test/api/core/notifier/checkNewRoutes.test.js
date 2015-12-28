/**
 * This test is made to ensure that all known elasticsearch routes that should fire a notification are plugged
 * to the notifier core component.
 *
 * This is to ensure that new routes are firing notifications if they are meant to.
 */
var
  should = require('should'),
  winston = require('winston'),
  _ = require('lodash'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  Notifier = rewire('../../../../lib/api/core/notifier'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');


describe('Test: notifier.checkNewRoutes', function () {
  var
    kuzzle,
    blacklist = [
      'init',
      'search',
      'get',
      'mget',
      'count',
      'deleteCollection',
      'import',
      'putMapping',
      'getMapping',
      'listCollections',
      'deleteIndexes',
      'createCollection',
      'truncateCollection',
      'createIndex',
      'deleteIndex',
      'listIndexes',
      'getInfos'
    ],
    requestObject = new RequestObject({
      controller: 'write',
      action: '',
      requestId: 'foo',
      collection: 'bar',
      index: '%test',
      body: { foo: 'bar' }
    }),
    responseObject = new ResponseObject(requestObject, {});

  before(function () {
    kuzzle = new Kuzzle();

    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    return kuzzle.start(params, {dummy: true});
  });

  it('should map every notifiable action to a notification handler', function (done) {
    var
      knownActions = [],
      performedActions = [],
      mockupAction = function (responseObject) {
        performedActions.push(responseObject.action);
        return Promise.resolve({});
      };

    this.timeout(100);

    Notifier.__with__({
      notifyDocumentCreate: mockupAction,
      notifyDocumentUpdate: mockupAction,
      notifyDocumentDelete: mockupAction
    })(function () {
      for (var action in kuzzle.services.list.readEngine) {
        if (kuzzle.services.list.readEngine.hasOwnProperty(action) && typeof kuzzle.services.list.readEngine[action] === 'function') {
          knownActions.push(action);
          responseObject.action = action;
          (Notifier.__get__('workerNotification')).call(kuzzle, responseObject);
        }
      }

      setTimeout(() => {
        var diff = _.difference(knownActions, performedActions);
        try {
          should(diff.sort()).be.an.Array().and.match(blacklist.sort());
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });
  });
});
