'use strict';

const should = require('should');
const sinon = require('sinon');

const { BadRequestError } = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const { NativeController } = require('../../../lib/api/controllers/baseController');

describe('#base/native controller', () => {
  let kuzzle;
  let actions;
  let nativeController;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    actions = ['speak', 'fight'];

    request = {
      input: {}
    };

    nativeController = new NativeController(actions);
  });

  it('should initialize its actions list from the constructor', () => {
    nativeController.privateAction = () => {};

    should(nativeController._isAction('speak')).be.true();
    should(nativeController._isAction('fight')).be.true();
    should(nativeController._isAction('privateAction')).be.false();
  });

  describe('translateKoncorde', () => {
    let koncordeFilters;

    beforeEach(() => {
      koncordeFilters = {
        equals: { name: 'Melis' }
      };

      kuzzle.ask
        .withArgs('core:storage:public:translate')
        .resolves({
          term: { name: 'Melis' }
        });
    });

    it('should translate the filter before passing it to the storage engine', async () => {
      const esQuery = await nativeController.translateKoncorde(koncordeFilters);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:translate',
        { equals: { name: 'Melis' } });

      should(esQuery).be.eql({ term: { name: 'Melis' } });
    });

    it('should validate the filter syntax with Koncorde', async () => {
      await nativeController.translateKoncorde(koncordeFilters);

      should(kuzzle.koncorde.validate)
        .be.calledWith({ equals: { name: 'Melis' } });
    });

    it('should reject if the query is not an object', () => {
      koncordeFilters = 'not an object';

      return should(nativeController.translateKoncorde(koncordeFilters)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_type' });
    });

    it('should reject when translation fail', () => {
      const error = new Error('message');
      error.keyword = { type: 'operator', name: 'n0t' };

      kuzzle.ask
        .withArgs('core:storage:public:translate')
        .rejects(error);

      return should(nativeController.translateKoncorde(koncordeFilters)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.koncorde_restricted_keyword' });
    });

    it('should return an empty object if the filters are empty', async () => {
      const esQuery = await nativeController.translateKoncorde({});

      should(kuzzle.ask).not.be.called();

      should(esQuery).be.eql({});
    });
  });

  describe('#getLangParam', () => {
    beforeEach(() => {
      request.input.args = {};
    });

    it('should have "elasticsearch" has default value', () => {
      const lang = nativeController.getLangParam(request);

      should(lang).be.eql('elasticsearch');
    });

    it('should retrieve the "lang" param', () => {
      request.input.args.lang = 'koncorde';

      const lang = nativeController.getLangParam(request);

      should(lang).be.eql('koncorde');
    });

    it('should throw an error if "lang" is invalid', () => {
      request.input.args.lang = 'turkish';

      should(() => nativeController.getLangParam(request))
        .throwError({ id: 'api.assert.invalid_argument'});
    });
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
      should(nativeController.getBoolean(request, 'doha')).be.true();
    });

    it('sets the flag value to false if not present in http', () => {
      delete request.input.args.doha;

      should(nativeController.getBoolean(request, 'doha')).be.false();
    });

    it('does nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.args.doha = false;

      should(nativeController.getBoolean(request, 'doha')).be.false();
    });

    it('throw an error if flag is not a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';

      should(() => nativeController.getBoolean(request, 'doha')).throw(
        BadRequestError,
        { id: 'api.assert.invalid_type'});
    });

    it('returns "false" if the flag is not set (not HTTP)', () => {
      request.context.connection.protocol = 'ws';
      should(nativeController.getBoolean(request, 'ohnoes')).be.false();
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
      should(nativeController.getBodyBoolean(request, 'doha')).be.true();
    });

    it('sets the flag value to false if not present in http', () => {
      delete request.input.body.doha;

      should(nativeController.getBodyBoolean(request, 'doha')).be.false();
    });

    it('does nothing if the flag is already a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';
      request.input.body.doha = false;

      should(nativeController.getBodyBoolean(request, 'doha')).be.false();
    });

    it('throw an error if flag is not a boolean with other protocols', () => {
      request.context.connection.protocol = 'ws';

      should(() => nativeController.getBodyBoolean(request, 'doha')).throw(
        BadRequestError,
        { id: 'api.assert.invalid_type'});
    });

    it('returns "false" if the flag is not set (not HTTP)', () => {
      request.context.connection.protocol = 'ws';
      should(nativeController.getBodyBoolean(request, 'ohnoes')).be.false();
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
        should(nativeController.getBodyArray(request, 'names'))
          .exactly(request.input.body.names);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getBodyArray(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = ['foo'];

        should(nativeController.getBodyArray(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an array', () => {
        should(() => nativeController.getBodyArray(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => nativeController.getBodyArray(request, 'names'))
          .throw(BadRequestError, { id: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = ['foo'];

        request.input.body = null;

        should(nativeController.getBodyArray(request, 'names', def))
          .exactly(def);
      });
    });

    describe('#getBodyString', () => {
      it('extracts the required parameter', () => {
        should(nativeController.getBodyString(request, 'fullname'))
          .exactly(request.input.body.fullname);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getBodyString(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 'foo';

        should(nativeController.getBodyString(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a string', () => {
        should(() => nativeController.getBodyString(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => nativeController.getBodyString(request, 'fullname'))
          .throw(BadRequestError, { id: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 'foo';

        request.input.body = null;

        should(nativeController.getBodyString(request, 'fullname', def))
          .exactly(def);
      });
    });

    describe('#getBodyObject', () => {
      it('extracts the required parameter', () => {
        should(nativeController.getBodyObject(request, 'relatives'))
          .exactly(request.input.body.relatives);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getBodyObject(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = { foo: 'bar' };

        should(nativeController.getBodyObject(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an object', () => {
        should(() => nativeController.getBodyObject(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => nativeController.getBodyObject(request, 'relatives'))
          .throw(BadRequestError, { id: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = { foo: 'bar' };

        request.input.body = null;

        should(nativeController.getBodyObject(request, 'relatives', def))
          .exactly(def);
      });
    });

    describe('#getBodyNumber', () => {
      it('extracts the required parameter and convert it', () => {
        should(nativeController.getBodyNumber(request, 'age'))
          .exactly(3011.5);

        should(nativeController.getBodyNumber(request, 'year'))
          .exactly(5270);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getBodyNumber(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(nativeController.getBodyNumber(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a number', () => {
        should(() => nativeController.getBodyNumber(request, 'fullname'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => nativeController.getBodyNumber(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 123;

        request.input.body = null;

        should(nativeController.getBodyNumber(request, 'age', def))
          .exactly(def);
      });
    });

    describe('#getBodyInteger', () => {
      it('extracts the required parameter and convert it', () => {
        should(nativeController.getBodyInteger(request, 'year'))
          .exactly(5270);

        should(nativeController.getBodyInteger(request, 'defeatedBugsAt'))
          .exactly(11);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getBodyInteger(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(nativeController.getBodyInteger(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an integer', () => {
        should(() => nativeController.getBodyInteger(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });

        should(() => nativeController.getBodyInteger(request, 'fullname'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => nativeController.getBodyInteger(request, 'year'))
          .throw(BadRequestError, { id: 'api.assert.body_required' });
      });

      it('should return the default value if one is provided, and if the request has no body', () => {
        const def = 123;

        request.input.body = null;

        should(nativeController.getBodyInteger(request, 'year', def))
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
        should(nativeController.getArray(request, 'names'))
          .exactly(request.input.args.names);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getArray(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = ['foo'];

        should(nativeController.getArray(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an array', () => {
        should(() => nativeController.getArray(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });
    });

    describe('#getString', () => {
      it('extracts the required parameter', () => {
        should(nativeController.getString(request, 'fullname'))
          .exactly(request.input.args.fullname);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getString(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 'foo';

        should(nativeController.getString(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a string', () => {
        should(() => nativeController.getString(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });
    });

    describe('#getObject', () => {
      it('extracts the required parameter', () => {
        should(nativeController.getObject(request, 'relatives'))
          .exactly(request.input.args.relatives);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getObject(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = { foo: 'bar' };

        should(nativeController.getObject(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an object', () => {
        should(() => nativeController.getObject(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });
    });

    describe('#getNumber', () => {
      it('extracts the required parameter and convert it', () => {
        should(nativeController.getNumber(request, 'age'))
          .exactly(3011.5);

        should(nativeController.getNumber(request, 'year'))
          .exactly(5270);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getNumber(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(nativeController.getNumber(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not a number', () => {
        should(() => nativeController.getNumber(request, 'fullname'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });
    });

    describe('#getInteger', () => {
      it('extracts the required parameter and convert it', () => {
        should(nativeController.getInteger(request, 'year'))
          .exactly(5270);

        should(nativeController.getInteger(request, 'defeatedBugsAt'))
          .exactly(11);
      });

      it('should throw if the parameter is missing', () => {
        should(() => nativeController.getInteger(request, 'childhood'))
          .throw(BadRequestError, { id: 'api.assert.missing_argument' });
      });

      it('should return the default value if provided, when the parameter is missing', () => {
        const def = 123;

        should(nativeController.getInteger(request, 'childhood', def))
          .exactly(def);
      });

      it('should throw if the parameter is not an integer', () => {
        should(() => nativeController.getInteger(request, 'age'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });

        should(() => nativeController.getInteger(request, 'fullname'))
          .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      });
    });
  });

  describe('#getIndex', () => {
    beforeEach(() => {
      request.input.args = {
        index: 'index'
      };
    });

    it('should extract an index', () => {
      const param = nativeController.getIndex(request);

      should(param).be.eql('index');
    });

    it('should throw if the index is missing', () => {
      request.input.args = {};

      should(() => {
        nativeController.getIndex(request);
      }).throw({ id: 'api.assert.missing_argument' });
    });
  });

  describe('#getIndexAndCollection', () => {
    beforeEach(() => {
      request.input.args = {
        index: 'index',
        collection: 'collection'
      };
    });

    it('should extract an index and a collection', () => {
      const { index, collection } = nativeController.getIndexAndCollection(request);

      should(index).be.eql('index');
      should(collection).be.eql('collection');
    });

    it('should throw if the index is missing', () => {
      request.input.args = {
        collection: 'collection'
      };

      should(() => {
        nativeController.getIndexAndCollection(request);
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "index".'
      });
    });

    it('should throw if the collection is missing', () => {
      request.input.args = {
        index: 'index'
      };

      should(() => {
        nativeController.getIndexAndCollection(request);
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "collection".'
      });
    });
  });

  describe('#getId', () => {
    beforeEach(() => {
      request.input.args = {
        _id: 'id'
      };
    });

    it('should extract an id', () => {
      const param = nativeController.getId(request);

      should(param).be.eql('id');
    });

    it('should throw if the id is missing', () => {
      request.input.args = {};

      should(() => {
        nativeController.getId(request);
      }).throw({ id: 'api.assert.missing_argument' });
    });

    it('should throw if the id is wrong type', () => {
      request.input.args = {
        _id: 42
      };

      should(() => {
        nativeController.getId(request);
      }).throw({ id: 'api.assert.invalid_type' });
    });
  });

  describe('#getKuid', () => {
    beforeEach(() => {
      request.context = {
        user: {
          _id: 'id'
        }
      };
    });

    it('should extract an user id', () => {
      const param = nativeController.getKuid(request);

      should(param).be.eql('id');
    });
  });

  describe('#getSearchParams', () => {
    beforeEach(() => {
      request.input.args = {
        from: 1,
        size: 11,
        scroll: '10m',
        searchBody: '{"query":{"foo":"bar"}}'
      };

      request.input.body = {
        query: { foo: 'bar' }
      };
    });

    it('should extract search params', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'POST' } } };
      const
        { from, size, scrollTTL, query, searchBody } = nativeController.getSearchParams(request);

      should(from).be.eql(1);
      should(size).be.eql(11);
      should(scrollTTL).be.eql('10m');
      should(query).be.eql({ foo: 'bar' });
      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should extract search params when invoking the route with GET', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'GET' } } };
      request.input.body = null;
      const
        { from, query, scrollTTL, searchBody, size } = nativeController.getSearchParams(request);

      should(from).be.eql(1);
      should(size).be.eql(11);
      should(scrollTTL).be.eql('10m');
      should(query).be.eql({});
      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should extract searchBody param when the route is invoked using GET', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'GET' } } };
      request.input.body = null;
      const searchBody = nativeController.getSearchBody(request);

      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should extract searchBody param', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'POST' } } };
      const searchBody = nativeController.getSearchBody(request);

      should(searchBody).be.eql({ query: { foo: 'bar' } });
    });

    it('should throw when the route is invoked with GET and invalid search body is provided', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'GET' } } };
      request.input.body = null;
      request.input.args.searchBody = {};

      should(() => {
        nativeController.getSearchBody(request);
      }).throw({ id: 'api.assert.invalid_type', message: 'Wrong type for argument "searchBody" (expected: string)' });
    });

    it('should provide empty body when the route is invoked with GET and no search body is provided', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'GET' } } };
      request.input.body = null;
      delete request.input.args.searchBody;
      const searchBody = nativeController.getSearchBody(request);

      should(searchBody).be.eql({});
    });

    it('should provide empty body when the route is invoked with GET with a null search body is provided', () => {
      request.context = { connection: { protocol: 'http', misc: { verb: 'GET' } } };
      request.input.body = null;
      request.input.args.searchBody = null;
      const searchBody = nativeController.getSearchBody(request);

      should(searchBody).be.eql({});
    });

    it('should have have default value', () => {
      request.input.args = {};
      request.input.body = {};
      request.context = { connection: { protocol: 'http', misc: { verb: 'POST' } } };

      const
        { from, size, scrollTTL, query, searchBody } = nativeController.getSearchParams(request);

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
      const param = nativeController.getScrollTTLParam(request);

      should(param).be.eql('10s');
    });

    it('should throw if the index is missing', () => {
      request.input.args.scroll = 32;

      should(() => {
        nativeController.getScrollTTLParam(request);
      }).throw({ id: 'api.assert.invalid_type' });
    });
  });

  describe('#getBody', () => {
    it('should throw if the request does not have a body', () => {
      request.input.body = null;

      should(() => nativeController.getBody(request)).throw(BadRequestError, {
        id: 'api.assert.body_required'
      });
    });

    it('should return the default value instead of throwing if one is provided', () => {
      request.input.body = null;

      should(nativeController.getBody(request, 'foo')).eql('foo');
    });

    it('should return the request body', () => {
      const body = {foo: 'bar'};

      request.input.body = body;

      should(nativeController.getBody(request)).exactly(body);
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
        nativeController.assertBodyHasNotAttributes(request, ['invalid']);
      }).throw({ id: 'api.assert.forbidden_argument' });
    });
  });

  describe('#assertIsStrategyRegistered', () => {
    it('should throw', () => {
      kuzzle.pluginsManager.listStrategies = sinon.stub().returns(['local', 'oauth']);

      should(() => {
        nativeController.assertIsStrategyRegistered('glob');
      }).throw({ id: 'security.credentials.unknown_strategy' });
    });
  });

  describe('#assertNotExceedMaxFetch', () => {
    it('should throw', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => {
        nativeController.assertNotExceedMaxFetch(3);
      }).throw({ id: 'services.storage.get_limit_exceeded' });
    });
  });

});
