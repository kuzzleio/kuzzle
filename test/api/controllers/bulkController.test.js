const
  should = require('should'),
  BulkController = require('../../../lib/api/controllers/bulkController'),
  {
    Request,
    errors: { PartialError }
  } = require('kuzzle-common-objects'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  BaseController = require('../../../lib/api/controllers/baseController');

xdescribe('Test the bulk controller', () => {
  let
    controller,
    kuzzle,
    storageEngine,
    foo = { foo: 'bar'},
    request;

  beforeEach(() => {
    request = new Request({
      controller: 'bulk',
      collection: 'unit-test-bulkController',
      index: 'unit-test-bulkController'
    });

    kuzzle = new KuzzleMock();

    storageEngine = kuzzle.services.publicStorage;

    controller = new BulkController(kuzzle);
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(controller).instanceOf(BaseController);
    });
  });

  describe('#import', () => {
    beforeEach(() => {
      request.input.action = 'bulk';
      request.input.body = { bulkData: 'fake' };
    });

    it('should trigger the proper methods and resolve to a valid response', () => {
      return controller.import(request)
        .then(response => {
          should(storageEngine.import)
            .be.calledOnce()
            .be.calledWith(request);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });

    it('should handle partial errors', () => {
      storageEngine.import.resolves({partialErrors: ['foo', 'bar']});

      return controller.import(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(request.status).be.eql(206);
          should(request.error).be.instanceOf(PartialError);
        });
    });
  });

  describe('#write', () => {
    beforeEach(() => {
      request.input.action = 'write';
      request.input.body = { name: 'Feanor', silmarils: 3 };
    });

    it('should createOrReplace the document without injecting meta', () => {
      return controller.write(request)
        .then(() => {
          should(kuzzle.notifier.notifyDocumentCreate).not.be.called();
          should(kuzzle.notifier.notifyDocumentReplace).not.be.called();
          should(storageEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWith(request, false);
        });
    });

    it('should notify if its specified', () => {
      request.input.args.notify = true;

      return controller.write(request)
        .then(() => {
          should(kuzzle.notifier.notifyDocumentReplace).be.called();
          should(storageEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWith(request, false);
        });
    });
  });

  describe('#mWrite', () => {
    beforeEach(() => {
      request.input.action = 'write';
      request.input.body = {
        documents: [
          { name: 'Maedhros' },
          { name: 'Maglor' },
          { name: 'Celegorm' },
          { name: 'Caranthis' },
          { name: 'Curufin' },
          { name: 'Amrod' },
          { name: 'Amras' }
        ]
      };
    });

    it('should mcreateOrReplace the document without injecting meta', () => {
      return controller.mWrite(request)
        .then(() => {
          should(kuzzle.notifier.notifyDocumentMChanges).not.be.called();
          should(storageEngine.mcreateOrReplace)
            .be.calledOnce()
            .be.calledWith(request, false);
        });
    });

    it('should notify if its specified', () => {
      request.input.args.notify = true;

      return controller.mWrite(request)
        .then(() => {
          should(kuzzle.notifier.notifyDocumentMChanges).be.called();
          should(storageEngine.mcreateOrReplace)
            .be.calledOnce()
            .be.calledWith(request, false);
        });
    });
  });
});
