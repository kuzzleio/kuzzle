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

  describe('#getBoolean', () => {
    beforeEach(() => {
      request = {
        context: {
          connection: {
            protocol: 'http'
          }
        },
        input: {
          args: {
            doha: 0
          }
        }
      };
    });

    it('sets the flag value to true if present in http', () => {
      should(baseController.getBoolean(request, 'doha')).be.true();
    });

    it('sets the flag value to false if not present in http', () => {
      delete request.input.args.doha;

      should(baseController.getBoolean(request, 'doha')).be.false();
    });

    it('does nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = false;

      should(baseController.getBoolean(request, 'doha')).be.false();
    });

    it('throw an error if flag is not a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';

      should(() => baseController.getBoolean(request, 'doha')).throw(
        BadRequestError,
        { errorName: 'api.assert.invalid_type'});
    });

    it('returns "false" if the flag is not set (not HTTP)', () => {
      request.context.connection.protocol = 'ws';
      should(baseController.getBoolean(request, 'ohnoes')).be.false();
    });
  });

  describe('#getBodyBoolean', () => {
    beforeEach(() => {
      request = {
        context: {
          connection: {
            protocol: 'http'
          }
        },
        input: {
          body: {
            doha: 0
          }
        }
      };
    });

    it('sets the flag value to true if present in http', () => {
      should(baseController.getBodyBoolean(request, 'doha')).be.true();
    });

    it('sets the flag value to false if not present in http', () => {
      delete request.input.body.doha;

      should(baseController.getBodyBoolean(request, 'doha')).be.false();
    });

    it('does nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.body.doha = false;

      should(baseController.getBodyBoolean(request, 'doha')).be.false();
    });

    it('throw an error if flag is not a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';

      should(() => baseController.getBodyBoolean(request, 'doha')).throw(
        BadRequestError,
        { errorName: 'api.assert.invalid_type'});
    });

    it('returns "false" if the flag is not set (not HTTP)', () => {
      request.context.connection.protocol = 'ws';
      should(baseController.getBodyBoolean(request, 'ohnoes')).be.false();
    });
  });

  describe('#request body getters', () => {
    beforeEach(() => {
      request.input.body = {
        fullname: 'Andrew Wiggin',
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: 3011.5,
        relatives: {
          Peter: 'brother',
          Valentine: 'sister'
        },
        year: '5270',
        defeatedBugsAt: 11
      };
    });

    describe('#getBodyArray', () => {
      it('extracts the required parameter', () => {
        should(baseController.getBodyArray(request, 'names'))
          .exactly(request.input.body.names);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getBodyArray(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = ['foo'];

        should(baseController.getBodyArray(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an array', () => {
        should(() => baseController.getBodyArray(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => baseController.getBodyArray(request, 'names'))
          .throw(BadRequestError, { errorName: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = ['foo'];

        request.input.body = null;

        should(baseController.getBodyArray(request, 'names', def))
          .exactly(def);
      });
    });

    describe('#getBodyString', () => {
      it('extracts the required parameter', () => {
        should(baseController.getBodyString(request, 'fullname'))
          .exactly(request.input.body.fullname);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getBodyString(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 'foo';

        should(baseController.getBodyString(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a string', () => {
        should(() => baseController.getBodyString(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => baseController.getBodyString(request, 'fullname'))
          .throw(BadRequestError, { errorName: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 'foo';

        request.input.body = null;

        should(baseController.getBodyString(request, 'fullname', def))
          .exactly(def);
      });
    });

    describe('#getBodyObject', () => {
      it('extracts the required parameter', () => {
        should(baseController.getBodyObject(request, 'relatives'))
          .exactly(request.input.body.relatives);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getBodyObject(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = { foo: 'bar' };

        should(baseController.getBodyObject(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an object', () => {
        should(() => baseController.getBodyObject(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => baseController.getBodyObject(request, 'relatives'))
          .throw(BadRequestError, { errorName: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = { foo: 'bar' };

        request.input.body = null;

        should(baseController.getBodyObject(request, 'relatives', def))
          .exactly(def);
      });
    });

    describe('#getBodyNumber', () => {
      it('extracts the required parameter and convert it', () => {
        should(baseController.getBodyNumber(request, 'age'))
          .exactly(3011.5);

        should(baseController.getBodyNumber(request, 'year'))
          .exactly(5270);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getBodyNumber(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(baseController.getBodyNumber(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a number', () => {
        should(() => baseController.getBodyNumber(request, 'fullname'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => baseController.getBodyNumber(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 123;

        request.input.body = null;

        should(baseController.getBodyNumber(request, 'age', def))
          .exactly(def);
      });
    });

    describe('#getBodyInteger', () => {
      it('extracts the required parameter and convert it', () => {
        should(baseController.getBodyInteger(request, 'year'))
          .exactly(5270);

        should(baseController.getBodyInteger(request, 'defeatedBugsAt'))
          .exactly(11);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getBodyInteger(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(baseController.getBodyInteger(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an integer', () => {
        should(() => baseController.getBodyInteger(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });

        should(() => baseController.getBodyInteger(request, 'fullname'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => baseController.getBodyInteger(request, 'year'))
          .throw(BadRequestError, { errorName: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 123;

        request.input.body = null;

        should(baseController.getBodyInteger(request, 'year', def))
          .exactly(def);
      });
    });
  });

  describe('#request argument getters', () => {
    beforeEach(() => {
      request.input.args = {
        fullname: 'Andrew Wiggin',
        names: ['Ender', 'Speaker for the Dead', 'Xenocide'],
        age: 3011.5,
        relatives: {
          Peter: 'brother',
          Valentine: 'sister'
        },
        year: '5270',
        defeatedBugsAt: 11
      };
    });

    describe('#getArray', () => {
      it('extracts the required parameter', () => {
        should(baseController.getArray(request, 'names'))
          .exactly(request.input.args.names);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getArray(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = ['foo'];

        should(baseController.getArray(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an array', () => {
        should(() => baseController.getArray(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });
    });

    describe('#getString', () => {
      it('extracts the required parameter', () => {
        should(baseController.getString(request, 'fullname'))
          .exactly(request.input.args.fullname);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getString(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 'foo';

        should(baseController.getString(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a string', () => {
        should(() => baseController.getString(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });
    });

    describe('#getObject', () => {
      it('extracts the required parameter', () => {
        should(baseController.getObject(request, 'relatives'))
          .exactly(request.input.args.relatives);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getObject(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = { foo: 'bar' };

        should(baseController.getObject(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an object', () => {
        should(() => baseController.getObject(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });
    });

    describe('#getNumber', () => {
      it('extracts the required parameter and convert it', () => {
        should(baseController.getNumber(request, 'age'))
          .exactly(3011.5);

        should(baseController.getNumber(request, 'year'))
          .exactly(5270);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getNumber(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(baseController.getNumber(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a number', () => {
        should(() => baseController.getNumber(request, 'fullname'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });
    });

    describe('#getInteger', () => {
      it('extracts the required parameter and convert it', () => {
        should(baseController.getInteger(request, 'year'))
          .exactly(5270);

        should(baseController.getInteger(request, 'defeatedBugsAt'))
          .exactly(11);
      });

      it('should throw if the parameter is missing', () => {
        should(() => baseController.getInteger(request, 'childhood'))
          .throw(BadRequestError, { errorName: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(baseController.getInteger(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an integer', () => {
        should(() => baseController.getInteger(request, 'age'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });

        should(() => baseController.getInteger(request, 'fullname'))
          .throw(BadRequestError, { errorName: 'api.assert.invalid_type' });
      });
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
