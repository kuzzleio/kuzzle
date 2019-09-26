const
  { errors: { BadRequestError } } = require('kuzzle-common-objects'),
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
        should(error.errorName).be.eql('api.assert.invalid_type');
        done();
      }
    });
  });

  describe('#getBodyArg', () => {
    beforeEach(() => {
      request.input.body = {
        fullname: 'Andrew Wiggin',
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: '3011.5',
        relatives: {
          Peter: 'brother',
          Valentine: 'sister'
        },
        year: 5270
      };
    });

    it('should extract an array param', () => {
      const param = baseController.getBodyArg(request, 'names', 'array');

      should(param).be.eql(['Ender', 'Speaker for the Dead', 'Xenocide']);
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getBodyArg(request, 'childhood', 'array');
      }).throw({ errorName: 'api.assert.missing_argument' });
    });

    it('should not throw and return the default value if one is provided', () => {
      const def = ['foo'];
      should(baseController.getBodyArg(request, 'childhood', 'array', def)).exactly(def);
    });

    it('should throw if the param is not an array', () => {
      should(() => {
        baseController.getBodyArg(request, 'age', 'array');
      }).throw({ errorName: 'api.assert.invalid_type' });
    });

    it('should extract a string param', () => {
      const param = baseController.getBodyArg(request, 'fullname', 'string');

      should(param).be.eql(request.input.body.fullname);
    });

    it('should extract an object param', () => {
      const param = baseController.getBodyArg(request, 'relatives', 'object');

      should(param).be.eql(request.input.body.relatives);
    });

    it('should extract a number param', () => {
      const param = baseController.getBodyArg(request, 'age', 'number');

      should(param).eql(3011.5);
    });

    it('should extract an integer param', () => {
      const param = baseController.getBodyArg(request, 'year', 'integer');
      should(param).eql(5270);
    });

    it('should throw if not a string', () => {
      should(() => baseController.getBodyArg(request, 'year', 'string'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
    });

    it('should throw if not a number', () => {
      should(() => baseController.getBodyArg(request, 'fullname', 'number'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
    });

    it('should throw if not an integer', () => {
      should(() => baseController.getBodyArg(request, 'age', 'integer'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
    });
  });

  describe('#getArg', () => {
    beforeEach(() => {
      request.input.args = {
        fullname: 'Andrew Wiggin',
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: '3011.5',
        relatives: {
          Peter: 'brother',
          Valentine: 'sister'
        },
        year: 5270
      };
    });

    it('should extract an array param', () => {
      const param = baseController.getArg(request, 'names', 'array');

      should(param).be.eql(['Ender', 'Speaker for the Dead', 'Xenocide']);
    });

    it('should throw if the param is missing', () => {
      should(() => {
        baseController.getArg(request, 'childhood', 'array');
      }).throw({ errorName: 'api.assert.missing_argument' });
    });

    it('should not throw and return the default value if one is provided', () => {
      const def = ['foo'];
      should(baseController.getArg(request, 'childhood', 'array', def)).exactly(def);
    });

    it('should throw if the param is not an array', () => {
      should(() => {
        baseController.getArg(request, 'age', 'array');
      }).throw({ errorName: 'api.assert.invalid_type' });
    });

    it('should extract a string param', () => {
      const param = baseController.getArg(request, 'fullname', 'string');

      should(param).be.eql(request.input.args.fullname);
    });

    it('should extract an object param', () => {
      const param = baseController.getArg(request, 'relatives', 'object');

      should(param).be.eql(request.input.args.relatives);
    });

    it('should extract a number param', () => {
      const param = baseController.getArg(request, 'age', 'number');

      should(param).eql(3011.5);
    });

    it('should extract an integer param', () => {
      const param = baseController.getArg(request, 'year', 'integer');
      should(param).eql(5270);
    });

    it('should throw if not a string', () => {
      should(() => baseController.getArg(request, 'year', 'string'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
    });

    it('should throw if not a number', () => {
      should(() => baseController.getArg(request, 'fullname', 'number'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
    });

    it('should throw if not an integer', () => {
      should(() => baseController.getArg(request, 'age', 'integer'))
        .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
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
      }).throw({ errorName: 'api.assert.missing_argument' });
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

    it('should throw if the index is missing', () => {
      request.input.resource = {
        collection: 'collection'
      };

      should(() => {
        baseController.getIndexAndCollection(request);
      }).throw(BadRequestError, {
        errorName: 'api.assert.missing_argument',
        message: 'Missing argument "index".'
      });
    });

    it('should throw if the collection is missing', () => {
      request.input.resource = {
        index: 'index'
      };

      should(() => {
        baseController.getIndexAndCollection(request);
      }).throw(BadRequestError, {
        errorName: 'api.assert.missing_argument',
        message: 'Missing argument "collection".'
      });
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
      }).throw({ errorName: 'api.assert.missing_argument' });
    });

    it('should throw if the id is wrong type', () => {
      request.input.resource = {
        _id: 42
      };

      should(() => {
        baseController.getId(request);
      }).throw({ errorName: 'api.assert.invalid_type' });
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
        { from, size, scrollTTL, query, searchBody } = baseController.getSearchParams(request);

      should(from).be.eql(1);
      should(size).be.eql(11);
      should(scrollTTL).be.eql('10m');
      should(query).be.eql({ foo: 'bar' });
      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should have have default value', () => {
      request.input.args = {};
      request.input.body = {};

      const
        { from, size, scrollTTL, query, searchBody } = baseController.getSearchParams(request);

      should(from).be.eql(0);
      should(size).be.eql(10);
      should(scrollTTL).be.undefined();
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
      }).throw({ errorName: 'api.assert.invalid_type' });
    });
  });

  describe('#getBody', () => {
    it('should throw if the request does not have a body', () => {
      request.input.body = null;

      should(() => baseController.getBody(request)).throw(BadRequestError, {
        errorName: 'api.assert.body_required'
      });
    });

    it('should return the default value instead of throwing if one is provided', () => {
      request.input.body = null;

      should(baseController.getBody(request, 'foo')).eql('foo');
    });

    it('should return the request body', () => {
      const body = {foo: 'bar'};

      request.input.body = body;

      should(baseController.getBody(request)).exactly(body);
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
      }).throw({ errorName: 'api.assert.forbidden_argument' });
    });
  });

  describe('#assertIsStrategyRegistered', () => {
    it('should throw', () => {
      kuzzle.pluginsManager.listStrategies = sinon.stub().returns(['local', 'oauth']);

      should(() => {
        baseController.assertIsStrategyRegistered('glob');
      }).throw({ errorName: 'security.credentials.unknown_strategy' });
    });
  });

  describe('#assertNotExceedMaxFetch', () => {
    it('should throw', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => {
        baseController.assertNotExceedMaxFetch(3);
      }).throw({ errorName: 'services.storage.get_limit_exceeded' });
    });
  });

});
