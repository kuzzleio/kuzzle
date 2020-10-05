'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const mockAssertions = require('../../mocks/mockAssertions');

const BulkController = require('../../../lib/api/controller/bulk');
const { NativeController } = require('../../../lib/api/controller/base');
const actionEnum = require('../../../lib/core/realtime/actionEnum');

describe('Test the bulk controller', () => {
  let controller;
  let kuzzle;
  let index;
  let collection;
  let request;

  beforeEach(() => {
    collection = 'yellow-taxi';

    index = 'nyc-open-data';

    request = new Request({
      controller: 'bulk',
      collection,
      index
    });

    kuzzle = new KuzzleMock();

    controller = mockAssertions(new BulkController(kuzzle));
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(controller).instanceOf(NativeController);
    });
  });

  describe('#import', () => {
    let bulkData;

    beforeEach(() => {
      bulkData = ['fake', 'data'];

      request.input.action = 'bulk';

      request.input.body = { bulkData };

      controller.publicStorage.import.resolves({
        items: ['fake', 'data'],
        errors: []
      });
    });

    it('should trigger the proper methods and resolve to a valid response', async () => {
      const response = await controller.import(request);

      should(controller.publicStorage.import)
        .be.calledWith(index, collection, bulkData, { refresh: 'false', userId: null });

      should(response).match({
        successes: ['fake', 'data'],
        errors: []
      });
    });

    it('should handle errors', async () => {
      controller.publicStorage.import.resolves({
        items: [],
        errors: ['fake', 'data']
      });

      const response = await controller.import(request);

      should(response).match({
        successes: [],
        errors: ['fake', 'data']
      });
    });
  });

  describe('#write', () => {
    let _source;
    let _id;
    let notifyStub;

    beforeEach(() => {
      _id = 'tolkien';
      _source = { name: 'Feanor', silmarils: 3 };

      request.input.action = 'write';
      request.input.body = _source;
      request.input.resource._id = _id;

      controller.publicStorage.createOrReplace.resolves({
        _id,
        _source,
        _version: 1,
        result: 'created',
      });

      notifyStub = kuzzle.ask.withArgs(
        'core:realtime:document:notify',
        sinon.match.object,
        sinon.match.number,
        sinon.match.object);
    });

    it('should createOrReplace the document without injecting meta', async () => {
      const response = await controller.write(request);

      should(notifyStub).not.called();
      should(controller.publicStorage.createOrReplace).be.calledWith(
        index,
        collection,
        _id,
        _source,
        { refresh: 'false', injectKuzzleMeta: false});

      should(response).match({
        _id,
        _source,
        _version: 1,
      });
    });

    it('should send "document written" notifications if asked to', async () => {
      request.input.args.notify = true;

      controller.publicStorage.createOrReplace.resolves({
        _id,
        _source,
        _version: 1,
        result: 'created',
        created: true,
      });

      await controller.write(request);

      should(notifyStub).be.calledWithMatch(
        'core:realtime:document:notify',
        request,
        actionEnum.WRITE,
        { _id, _source });
    });
  });

  describe('#mWrite', () => {
    let documents;
    let mCreateOrReplaceResult;
    let notifyMChangesStub;

    beforeEach(() => {
      documents = [
        { name: 'Maedhros' },
        { name: 'Maglor' },
        { name: 'Celegorm' },
        { name: 'Caranthis' },
        { name: 'Curufin' },
        { name: 'Amrod' },
        { name: 'Amras' }
      ];

      request.input.action = 'write';
      request.input.body = { documents };

      mCreateOrReplaceResult = [
        { _id: 'maed', _source: { name: 'Maedhros' }, _version: 1, created: true },
        { _id: 'magl', _source: { name: 'Maglor' }, _version: 1, created: true }
      ];

      controller.publicStorage.mCreateOrReplace.resolves({
        items: mCreateOrReplaceResult,
        errors: []
      });

      notifyMChangesStub = kuzzle.ask.withArgs(
        'core:realtime:document:mNotify',
        sinon.match.object,
        sinon.match.number,
        sinon.match.every(sinon.match.object));
    });

    it('should mCreateOrReplace the document without injecting meta', async () => {
      const response = await controller.mWrite(request);

      should(notifyMChangesStub).not.be.called();
      should(controller.publicStorage.mCreateOrReplace).be.calledWith(
        index,
        collection,
        documents,
        { refresh: 'false', limits: false, injectKuzzleMeta: false });

      should(response).match({
        successes: [
          { _id: 'maed', _source: { name: 'Maedhros' }, _version: 1 },
          { _id: 'magl', _source: { name: 'Maglor' }, _version: 1 }
        ],
        errors: []
      });
    });

    it('should notify if its specified', async () => {
      request.input.args.notify = true;

      await controller.mWrite(request);

      should(notifyMChangesStub).be.calledWith(
        'core:realtime:document:mNotify',
        request,
        actionEnum.WRITE,
        mCreateOrReplaceResult);
    });
  });

  describe('#deleteByQuery', async () => {
    let query;

    beforeEach(() => {
      query = {
        range: { age: { gt: 21 } }
      };

      request.input.action = 'deleteByQuery';
      request.input.args.refresh = 'wait_for';
      request.input.body = { query };

      controller.publicStorage.deleteByQuery.resolves({
        deleted: 2
      });
    });

    it('should call deleteByQuery with fetch=false and size=-1', async () => {
      const response = await controller.deleteByQuery(request);

      should(controller.publicStorage.deleteByQuery).be.calledWith(
        index,
        collection,
        query,
        { refresh: 'wait_for', fetch: false, size: -1 });

      should(response.deleted).be.eql(2);
    });
  });
});
