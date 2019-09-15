const
  { BadRequestError } = require('kuzzle-common-objects').errors,
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  BaseController = require('../../../lib/api/controllers/baseController');

describe('#base controller', () => {
  let
    kuzzle,
    actions,
    baseController,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    actions = ['speak', 'fight'];

    request = {
      input: {}
    };

    baseController = new BaseController(kuzzle, actions);
  });

  it('should initialize its actions list from the constructor', () => {
    baseController.privateAction = () => {};

    should(baseController.isAction('speak')).be.true();
    should(baseController.isAction('fight')).be.true();
    should(baseController.isAction('privateAction')).be.false();
  });

  describe('#tryGetBoolean', () => {
    beforeEach(() => {
      request = {
        context: {
          connection: {
            protocol: 'http'
          }
        },
        input: {
          args: {
            doha: ''
          }
        }
      };
    });

    it('set the flag value to true if present in http', () => {
      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('set the flag value to false if not present in http', () => {
      delete request.input.args.doha;

      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(false);
    });

    it('does not nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = true;

      const param = baseController.tryGetBoolean(request, 'args.doha');

      should(param).be.eql(true);
    });

    it('throw an error if flag is not a boolean with other protocols', done => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = 'hamad';

      try {
        baseController.tryGetBoolean(request, 'args.doha');
        done(new Error('Should throw BadRequestError'));
      } catch (error) {
        should(error).be.instanceOf(BadRequestError);
        should(error.message).be.eql('Invalid \'doha\' value (hamad).');
        done();
      }
    });
  });

  describe('#getArrayParam', () => {
    beforeEach(() => {
      request.input.body = {
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: 3000
      };
    });

    it('should extract an array param', () => {
      const param = baseController.getArrayParam(request, 'body.names');

      should(param).be.eql(['Ender', 'Speaker for the Dead', 'Xenocide']);
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getArrayParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not an array', () => {
      should(() => {
        baseController.getArrayParam(request, 'body.age');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#getStringParam', () => {
    beforeEach(() => {
      request.input.body = {
        name: 'Ender',
        age: 3000
      };
    });

    it('should extract an string param', () => {
      const param = baseController.getStringParam(request, 'body.name');

      should(param).be.eql('Ender');
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getStringParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not an string', () => {
      should(() => {
        baseController.getStringParam(request, 'body.age');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#getObjectParam', () => {
    beforeEach(() => {
      request.input.body = {
        name: 'Ender',
        age: { value: 3000 }
      };
    });

    it('should extract an object param', () => {
      const param = baseController.getObjectParam(request, 'body.age');

      should(param).be.eql({ value: 3000 });
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getObjectParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not an object', () => {
      should(() => {
        baseController.getObjectParam(request, 'body.name');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#getNumberParam', () => {
    beforeEach(() => {
      request.input.body = {
        name: 'Ender',
        age: 3000
      };
    });

    it('should extract a number param', () => {
      const param = baseController.getNumberParam(request, 'body.age');

      should(param).be.eql(3000);
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getNumberParam(request, 'body.childhood');
      }).throw({ errorName: 'api.base.missing_param' });
    });

    it('should throw if the param is not a number', () => {
      should(() => {
        baseController.getNumberParam(request, 'body.name');
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#getIndex', () => {
    beforeEach(() => {
      request.input.resource = {
        index: 'index'
      };
    });

    it('should extract an index', () => {
      const param = baseController.getIndex(request);

      should(param).be.eql('index');
    });

    it('should throw if the index is missing', () => {
      request.input.resource = {};

      should(() => {
        baseController.getIndex(request);
      }).throw({ errorName: 'api.base.missing_index' });
    });
  });

  describe('#getIndexAndCollection', () => {
    beforeEach(() => {
      request.input.resource = {
        index: 'index',
        collection: 'collection'
      };
    });

    it('should extract an index and a collection', () => {
      const { index, collection } = baseController.getIndexAndCollection(request);

      should(index).be.eql('index');
      should(collection).be.eql('collection');
    });

    it('should throw if the collection is missing', () => {
      request.input.resource = {
        index: 'index'
      };
      request.input.resource = {};

      should(() => {
        baseController.getIndex(request);
      }).throw({ errorName: 'api.base.missing_index' });
    });
  });

  describe('#getId', () => {
    beforeEach(() => {
      request.input.resource = {
        _id: 'id'
      };
    });

    it('should extract an id', () => {
      const param = baseController.getId(request);

      should(param).be.eql('id');
    });

    it('should throw if the id is missing', () => {
      request.input.resource = {};

      should(() => {
        baseController.getId(request);
      }).throw({ errorName: 'api.base.missing_id' });
    });

    it('should throw if the id is wrong type', () => {
      request.input.resource = {
        _id: 42
      };

      should(() => {
        baseController.getId(request);
      }).throw({ errorName: 'api.base.wrong_id_type' });
    });

    it('should throw if the id is the wrong format', () => {
      request.input.resource = {
        _id: '_id'
      };

      should(() => {
        baseController.getId(request);
      }).throw({ errorName: 'api.base.wrong_id_format' });
    });
  });

  describe('#getUserId', () => {
    beforeEach(() => {
      request.context = {
        user: {
          _id: 'id'
        }
      };
    });

    it('should extract an user id', () => {
      const param = baseController.getUserId(request);

      should(param).be.eql('id');
    });
  });

  describe('#getSearchParams', () => {
    beforeEach(() => {
      request.input.args = {
        from: 1,
        size: 11,
        scroll: '10m'
      };

      request.input.body = {
        query: { foo: 'bar' }
      };
    });

    it('should extract search params', () => {
      const
        { from, size, scroll, query, searchBody } = baseController.getSearchParams(request);

      should(from).be.eql(1);
      should(size).be.eql(11);
      should(scroll).be.eql('10m');
      should(query).be.eql({ foo: 'bar' });
      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should have have default value', () => {
      request.input.args = {};
      request.input.body = {};

      const
        { from, size, scroll, query, searchBody } = baseController.getSearchParams(request);

      should(from).be.eql(0);
      should(size).be.eql(10);
      should(scroll).be.undefined();
      should(query).be.eql({});
      should(searchBody).be.eql({});
    });
  });

  describe('#getScrollTTLParam', () => {
    beforeEach(() => {
      request.input.args = {
        scroll: '10s'
      };
    });

    it('should extract scroll param', () => {
      const param = baseController.getScrollTTLParam(request);

      should(param).be.eql('10s');
    });

    it('should throw if the index is missing', () => {
      request.input.args.scroll = 32;

      should(() => {
        baseController.getScrollTTLParam(request);
      }).throw({ errorName: 'api.base.invalid_param_type' });
    });
  });

  describe('#assertBodyHasNotAttributes', () => {
    beforeEach(() => {
      request.input.body = {
        invalid: '42'
      };
    });

    it('should throw', () => {
      should(() => {
        baseController.assertBodyHasNotAttributes(request, ['invalid']);
      }).throw({ errorName: 'api.base.must_not_specify_body_attribute' });
    });
  });

  describe('#assertIsStrategyRegistered', () => {
    it('should throw', () => {
      kuzzle.pluginsManager.listStrategies = sinon.stub().returns(['local', 'oauth']);

      should(() => {
        baseController.assertIsStrategyRegistered('glob');
      }).throw({ errorName: 'api.base.unknown_strategy' });
    });
  });

  describe('#assertNotExceedMaxFetch', () => {
    it('should throw', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => {
        baseController.assertNotExceedMaxFetch(3);
      }).throw({ errorName: 'api.base.search_page_size' });
    });
  });

});
