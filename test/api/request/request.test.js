'use strict';

const should = require('should');

const {
  KuzzleError,
  InternalError,
  BadRequestError
} = require('../../../lib/kerror/errors');
const { Request, KuzzleRequest } = require('../../../lib/api/request');
const { RequestContext } = require('../../../lib/api/request');
const { RequestInput } = require('../../../lib/api/request');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const { Koncorde } = require('koncorde');

describe('#Request', () => {
  let rq;
  let nodeEnv;

  beforeEach(() => {
    new KuzzleMock();

    nodeEnv = global.NODE_ENV;
    rq = new Request({});
  });

  afterEach(() => {
    global.NODE_ENV = nodeEnv;
  });

  it('should defaults other properties correctly', () => {
    should(rq.status).eql(102);
    should(rq.context).be.instanceOf(RequestContext);
    should(rq.input).be.instanceOf(RequestInput);
    should(rq.result).be.null();
    should(rq.error).be.null();
    should(rq.deprecations).be.undefined();
  });

  it('should initialize the request object with the provided options', () => {
    let
      result = { foo: 'bar' },
      error = new InternalError('foobar'),
      options = {
        status: 666,
        result,
        error,
        connectionId: 'connectionId',
        protocol: 'protocol',
        token: { token: 'token' },
        user: { user: 'user' }
      },
      request = new Request({}, options);

    should(request.status).eql(666);
    should(request.result).be.exactly(result);
    should(request.error).be.exactly(error);
    should(request.error).be.instanceOf(KuzzleError);
    should(request.error.message).be.exactly(error.message);
    should(request.error.stack).be.exactly(error.stack);
    should(request.error.status).be.exactly(request.error.status);
    should(request.context.protocol).eql('protocol');
    should(request.context.connectionId).eql('connectionId');
    should(request.context.token).match({ token: 'token' });
    should(request.context.user).match({ user: 'user' });
  });

  it('should instanciate a new KuzzleError object from a serialized error', () => {
    let
      result = { foo: 'bar' },
      error = new InternalError('foobar'),
      options = {
        status: 666,
        result,
        error: error.toJSON(),
        connectionId: 'connectionId',
        protocol: 'protocol',
        token: { token: 'token' },
        user: { user: 'user' }
      },
      request = new Request({}, options);

    should(request.status).eql(666);
    should(request.result).be.exactly(result);
    should(request.error).be.instanceOf(KuzzleError);
    should(request.error.message).be.exactly(error.message);
    should(request.error.stack).be.exactly(error.stack);
    should(request.error.status).be.exactly(request.error.status);
    should(request.context.protocol).eql('protocol');
    should(request.context.connectionId).eql('connectionId');
    should(request.context.token).match({ token: 'token' });
    should(request.context.user).match({ user: 'user' });
  });

  it('should throw if a non-object options argument is provided', () => {
    should(function () {
      new Request({}, []); 
    }).throw('Request options must be an object');
    should(function () {
      new Request({}, 'foobar'); 
    }).throw('Request options must be an object');
    should(function () {
      new Request({}, 123.45); 
    }).throw('Request options must be an object');
  });

  it('should throw if an invalid optional status is provided', () => {
    should(function () {
      new Request({}, { status: [] }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      new Request({}, { status: {} }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      new Request({}, { status: 'foobar' }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      new Request({}, { status: 123.45 }); 
    }).throw('Attribute status must be an integer');
  });

  it('should set an error properly', () => {
    let foo = new KuzzleError('bar', 666);

    rq.setError(foo);

    should(rq.error).be.exactly(foo);
    should(rq.status).eql(666);

    should(rq.error.toJSON()).match({ status: foo.status, message: foo.message });
  });

  it('should wrap a plain Error object into an InternalError one', () => {
    let foo = new Error('bar');

    rq.setError(foo);

    should(rq.error).not.be.exactly(foo);
    should(rq.error).be.instanceOf(InternalError);
    should(rq.error.message).eql('bar');
    should(rq.error.status).eql(500);
    should(rq.status).eql(500);
  });

  it('should throw if attempting to set a non-error object as a request error', () => {
    should(function () {
      rq.setError('foo'); 
    }).throw(/^Cannot set non-error object.*$/);
  });

  it('should set the provided result with default status 200', () => {
    let result = { foo: 'bar' };
    rq.setResult(result);

    should(rq.result).be.exactly(result);
    should(rq.status).eql(200);
  });

  it('should set a custom status code if one is provided', () => {
    let result = { foo: 'bar' };
    rq.setResult(result, { status: 666 });

    should(rq.result).be.exactly(result);
    should(rq.status).eql(666);
  });

  it('should throw if trying to set an error object as a result', () => {
    should(function () {
      rq.setResult(new Error('foobar')); 
    }).throw(/cannot set an error/);
  });

  it('should throw if trying to set a non-integer status', () => {
    should(function () {
      rq.setResult('foobar', { status: {} }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      rq.setResult('foobar', { status: [] }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      rq.setResult('foobar', { status: true }); 
    }).throw('Attribute status must be an integer');
    should(function () {
      rq.setResult('foobar', { status: 123.45 }); 
    }).throw('Attribute status must be an integer');
  });

  it('should throw if trying to set some non-object headers', () => {
    [42, [true, false], 'bar', true].forEach(value => {
      should(() => rq.setResult('foobar', { headers: value })).throw(
        BadRequestError,
        { message: 'Attribute headers must be of type "object"' });
    });
  });

  it('should set the raw response indicator if provided', () => {
    let result = { foo: 'bar' };

    should(rq.response.raw).be.false();

    rq.setResult(result, { raw: true });

    should(rq.result).be.exactly(result);
    should(rq.response.raw).be.true();
  });

  it('should build a well-formed response', () => {
    const
      result = { foo: 'bar' },
      responseHeaders = {
        'X-Foo': 'bar',
        'X-Bar': 'baz'
      },
      error = new InternalError('foobar'),
      data = {
        index: 'idx',
        collection: 'collection',
        controller: 'controller',
        action: 'action',
        _id: 'id',
        volatile: {
          some: 'meta'
        }
      },
      request = new Request(data);

    request.setResult(result, { status: 201, headers: responseHeaders });
    request.setError(error);

    const response = request.response;

    should(response.status).eql(500);
    should(response.error).be.exactly(error);
    should(response.requestId).eql(request.id);
    should(response.controller).eql(data.controller);
    should(response.action).eql(data.action);
    should(response.collection).eql(data.collection);
    should(response.index).eql(data.index);
    should(response.volatile).match(data.volatile);
    should(response.result).be.exactly(result);
    should(response.headers).match(responseHeaders);
  });

  it('should serialize the request correctly', () => {
    let
      result = { foo: 'bar' },
      error = new InternalError('foobar'),
      data = {
        body: { some: 'body' },
        timestamp: 'timestamp',
        index: 'idx',
        collection: 'collection',
        controller: 'controller',
        action: 'action',
        _id: 'id',
        volatile: {
          some: 'meta'
        },
        foo: 'bar'
      },
      options = {
        status: 666,
        connection: {
          id: 'connectionId',
          protocol: 'protocol',
          url: 'url',
          foobar: 'barfoo',
          ips: ['i', 'p', 's'],
          headers: { foo: 'args.headers' }
        }
      },
      request = new Request(data, options),
      serialized;

    request.setResult(result);
    request.setError(error);

    serialized = request.serialize();

    should(serialized.data.body).match({ some: 'body' });
    should(serialized.data.volatile).match({ some: 'meta' });
    should(serialized.data.controller).be.eql('controller');
    should(serialized.data.action).be.eql('action');
    should(serialized.data.index).be.eql('idx');
    should(serialized.data.collection).be.eql('collection');
    should(serialized.data._id).be.eql('id');
    should(serialized.data.timestamp).be.eql('timestamp');
    should(serialized.data.foo).be.eql('bar');

    should(serialized.options.connection).match(options.connection);

    should(serialized.options.error).match(error);
    should(serialized.options.result).match(result);
    should(serialized.options.status).be.eql(500);

    should(serialized.headers).match({ foo: 'args.headers' });

    const newRequest = new Request(serialized.data, serialized.options);
    should(newRequest.response.toJSON()).match(request.response.toJSON());
    should(newRequest.timestamp).be.eql('timestamp');
  });

  it('should clear the request error and status correctly', () => {
    const
      result = { foo: 'bar' },
      error = new InternalError('foobar'),
      data = {
        body: { some: 'body' },
        timestamp: 'timestamp',
        index: 'idx',
        collection: 'collection',
        controller: 'controller',
        action: 'action',
        _id: 'id',
        volatile: {
          some: 'meta'
        },
        foo: 'bar',
        headers: { foo: 'args.header' }
      },
      request = new Request(data);

    request.input.headers = { foo: 'input.header' };
    request.setResult(result);
    request.setError(error);

    should(request.error).be.instanceOf(InternalError);

    request.clearError();

    should(request.error).be.eql(null);
    should(request.status).eql(200);
  });

  it('should add a deprecation when kuzzle is in development', () => {
    global.NODE_ENV = 'development';
    rq.addDeprecation('1.0.0', 'You should now use Kuzzle v2');

    should(rq.deprecations).be.Array();
    should(rq.deprecations).be.lengthOf(1);
    should(rq.deprecations[0]).deepEqual({ version: '1.0.0', message: 'You should now use Kuzzle v2' });
  });

  it('should not add a deprecation when kuzzle is in production', () => {
    global.NODE_ENV = 'production';
    rq.addDeprecation('1.0.0', 'You should now use Kuzzle v2');

    should(rq.deprecations).be.undefined();
  });

  describe('param extraction methods', () => {
    let request;

    beforeEach(() => {
      request = new KuzzleRequest({});
    });

    describe('#getLangParam', () => {
      beforeEach(() => {
        request.input.args = {};
      });

      it('should have "elasticsearch" has default value', () => {
        const lang = request.getLangParam();

        should(lang).be.eql('elasticsearch');
      });

      it('should retrieve the "lang" param', () => {
        request.input.args.lang = 'koncorde';

        const lang = request.getLangParam();

        should(lang).be.eql('koncorde');
      });

      it('should throw an error if "lang" is invalid', () => {
        request.input.args.lang = 'turkish';

        should(() => request.getLangParam())
          .throwError({ id: 'api.assert.invalid_argument' });
      });
    });

    describe('#getBoolean', () => {
      beforeEach(() => {
        request = new Request({ doha: 0 }, {
          connection: {
            protocol: 'http'
          }
        });
      });

      it('sets the flag value to true if present in http', () => {
        should(request.getBoolean('doha')).be.true();
      });

      it('sets the flag value to false if not present in http', () => {
        delete request.input.args.doha;

        should(request.getBoolean('doha')).be.false();
      });

      it('does nothing if the flag is already a boolean with other protocols', () => {
        request.context.connection.protocol = 'ws';
        request.input.args.doha = false;

        should(request.getBoolean('doha')).be.false();
      });

      it('throw an error if flag is not a boolean with other protocols', () => {
        request.context.connection.protocol = 'ws';

        should(() => request.getBoolean('doha')).throw(
          BadRequestError,
          { id: 'api.assert.invalid_type' });
      });

      it('returns "false" if the flag is not set (not HTTP)', () => {
        request.context.connection.protocol = 'ws';
        should(request.getBoolean('ohnoes')).be.false();
      });
    });

    describe('#getBodyBoolean', () => {
      beforeEach(() => {
        request = new KuzzleRequest({ body: { doha: true } });
      });

      it('returns the value of the body boolean', () => {
        should(request.getBodyBoolean('doha')).be.true();

        request.input.body.doha = false;

        should(request.getBodyBoolean('doha')).be.false();
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
          defeatedBugsAt: 11,
          relations: {
            'lebron': ['james', 'curry', 'harden'],
            'kobe': ['bryant', 'jordan', 'love']
          },
          powers: {
            fire: {
              level: 'high',
              mana: 10,
              damage: 10.8,
            }
          }
        };
      });

      describe('#getBodyArray', () => {
        it('should return the array of the body (lodash parameter)', () => {
          should(request.getBodyArray('relations.lebron'))
            .exactly(request.input.body.relations.lebron);
        });

        it('extracts the required parameter', () => {
          should(request.getBodyArray('names'))
            .exactly(request.input.body.names);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getBodyArray('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = ['foo'];

          should(request.getBodyArray('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an array', () => {
          should(() => request.getBodyArray('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });

        it('should throw if the request does not have a body', () => {
          request.input.body = null;

          should(() => request.getBodyArray('names'))
            .throw(BadRequestError, { id: 'api.assert.body_required' });
        });

        it('should return the default value if one is provided, and if the request has no body', () => {
          const def = ['foo'];

          request.input.body = null;

          should(request.getBodyArray('names', def))
            .exactly(def);
        });
      });

      describe('#getBodyString', () => {
        it('should return the string of the body (lodash parameter)', () => {
          should(request.getBodyString('relatives.Peter'))
            .exactly(request.input.body.relatives.Peter);
        });

        it('should return the string of an array (lodash parameter)', () => {
          should(request.getBodyString('names.0'))
            .exactly(request.input.body.names[0]);
        });

        it('should return the string of an array (lodash parameter)', () => {
          should(request.getBodyString('relations.lebron[0]'))
            .exactly(request.input.body.relations.lebron[0]);
        });
 
        it('extracts the required parameter', () => {
          should(request.getBodyString('fullname'))
            .exactly(request.input.body.fullname);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getBodyString('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 'foo';

          should(request.getBodyString('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not a string', () => {
          should(() => request.getBodyString('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });

        it('should throw if the request does not have a body', () => {
          request.input.body = null;

          should(() => request.getBodyString('fullname'))
            .throw(BadRequestError, { id: 'api.assert.body_required' });
        });

        it('should return the default value if one is provided, and if the request has no body', () => {
          const def = 'foo';

          request.input.body = null;

          should(request.getBodyString('fullname', def))
            .exactly(def);
        });
      });

      describe('#getBodyObject', () => {
        it('should return the object of the body (lodash parameter)', () => {
          should(request.getBodyObject('powers.fire'))
            .exactly(request.input.body.powers.fire);
        });
  
        it('extracts the required parameter', () => {
          should(request.getBodyObject('relatives'))
            .exactly(request.input.body.relatives);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getBodyObject('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = { foo: 'bar' };

          should(request.getBodyObject('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an object', () => {
          should(() => request.getBodyObject('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });

        it('should throw if the request does not have a body', () => {
          request.input.body = null;

          should(() => request.getBodyObject('relatives'))
            .throw(BadRequestError, { id: 'api.assert.body_required' });
        });

        it('should return the default value if one is provided, and if the request has no body', () => {
          const def = { foo: 'bar' };

          request.input.body = null;

          should(request.getBodyObject('relatives', def))
            .exactly(def);
        });
      });

      describe('#getBodyNumber', () => {
        it('should return the number of the body (lodash parameter)', () => {
          should(request.getBodyNumber('powers.fire.damage'))
            .exactly(request.input.body.powers.fire.damage);
        });
        it('extracts the required parameter and convert it', () => {
          should(request.getBodyNumber('age'))
            .exactly(3011.5);

          should(request.getBodyNumber('year'))
            .exactly(5270);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getBodyNumber('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 123;

          should(request.getBodyNumber('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not a number', () => {
          should(() => request.getBodyNumber('fullname'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });

        it('should throw if the request does not have a body', () => {
          request.input.body = null;

          should(() => request.getBodyNumber('age'))
            .throw(BadRequestError, { id: 'api.assert.body_required' });
        });

        it('should return the default value if one is provided, and if the request has no body', () => {
          const def = 123;

          request.input.body = null;

          should(request.getBodyNumber('age', def))
            .exactly(def);
        });
      });

      describe('#getBodyInteger', () => {
        it('should return the integer of the body (lodash parameter)', () => {
          should(request.getBodyInteger('powers.fire.mana'))
            .exactly(request.input.body.powers.fire.mana);
        });

        it('extracts the required parameter and convert it', () => {
          should(request.getBodyInteger('year'))
            .exactly(5270);

          should(request.getBodyInteger('defeatedBugsAt'))
            .exactly(11);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getBodyInteger('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 123;

          should(request.getBodyInteger('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an integer', () => {
          should(() => request.getBodyInteger('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });

          should(() => request.getBodyInteger('fullname'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });

        it('should throw if the request does not have a body', () => {
          request.input.body = null;

          should(() => request.getBodyInteger('year'))
            .throw(BadRequestError, { id: 'api.assert.body_required' });
        });

        it('should return the default value if one is provided, and if the request has no body', () => {
          const def = 123;

          request.input.body = null;

          should(request.getBodyInteger('year', def))
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
          defeatedBugsAt: 11,
          birthDate: '2022-04-11T00:00:00.000Z'
        };
      });

      describe('#getArray', () => {
        it('extracts the required parameter', () => {
          should(request.getArray('names'))
            .exactly(request.input.args.names);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getArray('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = ['foo'];

          should(request.getArray('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an array', () => {
          should(() => request.getArray('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });
      });

      describe('#getString', () => {
        it('extracts the required parameter', () => {
          should(request.getString('fullname'))
            .exactly(request.input.args.fullname);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getString('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 'foo';

          should(request.getString('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not a string', () => {
          should(() => request.getString('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });
      });

      describe('#getObject', () => {
        it('extracts the required parameter', () => {
          should(request.getObject('relatives'))
            .exactly(request.input.args.relatives);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getObject('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = { foo: 'bar' };

          should(request.getObject('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an object', () => {
          should(() => request.getObject('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });
      });

      describe('#getDate', () => {
        it('extracts the birthdate in date format', () => {
          should(request.getDate('birthDate'))
            .eql(new Date('2022-04-11T00:00:00.000Z'));
        });

        it('extracts the birthdate in timestamp format', () => {
          should(request.getDate('birthDate', { format: 'timestamp' }))
            .exactly(1649628000000);
        });

        it('extracts the birthdate in ISO8061 format', () => {
          should(request.getDate('birthDate', { format: 'ISO8061' }))
            .exactly('2022-04-11T00:00:00.000Z');
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getDate('anotherDate'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });
      });

      describe('#getNumber', () => {
        it('extracts the required parameter and convert it', () => {
          should(request.getNumber('age'))
            .exactly(3011.5);

          should(request.getNumber('year'))
            .exactly(5270);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getNumber('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 123;

          should(request.getNumber('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not a number', () => {
          should(() => request.getNumber('fullname'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });
        });
      });

      describe('#getInteger', () => {
        it('extracts the required parameter and convert it', () => {
          should(request.getInteger('year'))
            .exactly(5270);

          should(request.getInteger('defeatedBugsAt'))
            .exactly(11);
        });

        it('should throw if the parameter is missing', () => {
          should(() => request.getInteger('childhood'))
            .throw(BadRequestError, { id: 'api.assert.missing_argument' });
        });

        it('should return the default value if provided, when the parameter is missing', () => {
          const def = 123;

          should(request.getInteger('childhood', def))
            .exactly(def);
        });

        it('should throw if the parameter is not an integer', () => {
          should(() => request.getInteger('age'))
            .throw(BadRequestError, { id: 'api.assert.invalid_type' });

          should(() => request.getInteger('fullname'))
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
        const param = request.getIndex();

        should(param).be.eql('index');
      });

      it('should throw if the index is missing', () => {
        request.input.args = {};

        should(() => {
          request.getIndex();
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
        const { index, collection } = request.getIndexAndCollection();

        should(index).be.eql('index');
        should(collection).be.eql('collection');
      });

      it('should throw if the index is missing', () => {
        request.input.args = {
          collection: 'collection'
        };

        should(() => {
          request.getIndexAndCollection();
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
          request.getIndexAndCollection();
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
        const param = request.getId();

        should(param).be.eql('id');
      });

      it('should throw if the id is missing', () => {
        request.input.args = {};

        should(() => {
          request.getId();
        }).throw({ id: 'api.assert.missing_argument' });
      });

      it('should throw if the id is wrong type', () => {
        request.input.args = {
          _id: 42
        };

        should(() => {
          request.getId();
        }).throw({ id: 'api.assert.invalid_type' });
      });
    });

    describe('#getKuid', () => {
      beforeEach(() => {
        request = new KuzzleRequest({}, {
          user: {
            _id: 'id'
          }
        });
      });

      it('should extract an user id', () => {
        const param = request.getKuid();

        should(param).be.eql('id');
      });
    });

    describe('#getSearchParams', () => {
      let input;

      beforeEach(() => {
        input = {
          from: 1,
          size: 11,
          scroll: '10m',
          searchBody: '{"query":{"foo":"bar"}}',
          body: { query: { foo: 'bar' } }
        };
      });

      it('should extract search params', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'POST' }
        });

        const { from, size, scrollTTL, query, searchBody } = request.getSearchParams();

        should(from).be.eql(1);
        should(size).be.eql(11);
        should(scrollTTL).be.eql('10m');
        should(query).be.eql({ foo: 'bar' });
        should(searchBody).be.eql({ query: { foo: 'bar' } });
      });

      it('should extract search params when invoking the route with GET', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'GET' }
        });
        request.input.body = null;

        const { from, query, scrollTTL, searchBody, size } = request.getSearchParams();

        should(from).be.eql(1);
        should(size).be.eql(11);
        should(scrollTTL).be.eql('10m');
        should(query).be.eql({});
        should(searchBody).be.eql({ query: { foo: 'bar' } });
      });

      it('should extract searchBody param when the route is invoked using GET', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'GET' }
        });
        request.input.body = null;

        const searchBody = request.getSearchBody();

        should(searchBody).be.eql({ query: { foo: 'bar' } });
      });

      it('should extract searchBody param', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'POST' }
        });

        const searchBody = request.getSearchBody();

        should(searchBody).be.eql({ query: { foo: 'bar' } });
      });

      it('should throw when the route is invoked with GET and invalid search body is provided', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'GET' }
        });
        request.input.body = null;
        request.input.args.searchBody = {};

        should(() => {
          request.getSearchBody();
        }).throw({ id: 'api.assert.invalid_type', message: 'Wrong type for argument "searchBody" (expected: string)' });
      });

      it('should provide empty body when the route is invoked with GET and no search body is provided', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'GET' }
        });
        request.input.body = null;
        delete request.input.args.searchBody;

        const searchBody = request.getSearchBody();

        should(searchBody).be.eql({});
      });

      it('should return a {} object when the route is invoked with GET with a null search body is provided', () => {
        request = new KuzzleRequest(input, {
          connection: { protocol: 'http', verb: 'GET' }
        });
        request.input.body = null;
        request.input.args.searchBody = null;

        should(() => {
          request.getSearchBody().be.eql({});
        });
      });

      it('should have have default value', () => {
        request = new KuzzleRequest({}, {
          connection: { protocol: 'http', verb: 'POST' }
        });

        const { from, size, scrollTTL, query, searchBody } = request.getSearchParams();

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
        const param = request.getScrollTTLParam();

        should(param).be.eql('10s');
      });

      it('should throw if the index is missing', () => {
        request.input.args.scroll = 32;

        should(() => {
          request.getScrollTTLParam();
        }).throw({ id: 'api.assert.invalid_type' });
      });
    });

    describe('#getBody', () => {
      it('should throw if the request does not have a body', () => {
        request.input.body = null;

        should(() => request.getBody()).throw(BadRequestError, {
          id: 'api.assert.body_required'
        });
      });

      it('should return the default value instead of throwing if one is provided', () => {
        request.input.body = null;

        should(request.getBody('foo')).eql('foo');
      });

      it('should return the request body', () => {
        const body = { foo: 'bar' };

        request.input.body = body;

        should(request.getBody()).exactly(body);
      });
    });
  });

  describe('#pojo', () => {
    it('returns a POJO usable to match with Koncorde', () => {
      const koncorde = new Koncorde();
      const request = new KuzzleRequest({
        controller: 'document',
        action: 'create',
        index: 'montenegro',
        collection: 'budva',
        _id: 'dana',
        body: {
          age: 30
        }
      });
      const id1 = koncorde.register({
        equals: { 'input.args.collection': 'budva' }
      });

      const ids = koncorde.test(request.pojo());

      should(ids).be.eql([id1]);
    });
  });
});
