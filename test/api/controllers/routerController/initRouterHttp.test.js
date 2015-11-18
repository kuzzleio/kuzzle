/*
 * This file tests the initRouterHttp function, which creates HTTP routes
 * for the Kuzzle REST API.
 */

var
  should = require('should'),
  winston = require('winston'),
  http = require('http'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

require('should-promised');

/*
 * This function helps keeping tests simple and clear while ensuring that
 * responses are well-formed.
 */
function parseHttpResponse(response) {
  var
    deferred = q.defer(),
    data = '';

  response.on('data', function (chunk) {
    data += chunk;
  });

  response.on('end', function () {
    var result;

    try {
      result = JSON.parse(data);
    }
    catch (e) {
      deferred.reject(e);
    }

    deferred.resolve(result);
  });

  return deferred.promise;
}


describe('Test: routerController.initRouterHttp', function () {
  var
    kuzzle,
    server,
    router,
    options = {
      hostname: 'localhost',
      port: 6666
    };

  /*
   * In order to test the presence of these routes, we need first to create a
   * listening server, and then use the initRouterHttp function to create these.
   *
   * We rewire the 'executeFromRest' function into a mockup that will answer
   * with the params passed to it by initRouterHttp, so we can also test if
   * the answer is correctly constructed.
   */
  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

    var mockResponse = function (params, request, response) {
      if (!params.action) {
        params.action = request.params.action;
      }

      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(JSON.stringify(params));
    };

    kuzzle.start(params, {dummy: true})
      .then(function () {
        RouterController.__set__('executeFromRest', mockResponse);

        router = new RouterController(kuzzle);
        router.initRouterHttp();

        server = http.createServer(function (request, response) {
          router.routeHttp(request, response);
        });

        server.listen(options.port);

        done();
      });
  });

  after(function () {
    server.close();
  });

  it('should reply with a Hello World on a simple GET query', function (done) {
    http.get('http://' + options.hostname + ':' + options.port + '/api', function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(result.status).be.exactly(200);
          should(result.error).be.null();
          should(result.result).be.exactly('Hello from Kuzzle :)');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  it('should create a route for document creation', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/collection';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('create');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document retrieving', function (done) {
    http.get('http://' + options.hostname + ':' + options.port + '/api/collection/documentID', function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('get');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  it('should create a route for document searches', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/collection/_search';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('search');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for createOrUpdate actions', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/documentID';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('createOrUpdate');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document updates', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/documentID/_update';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('update');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document counting', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/collection/_count';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('count');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion, using a document ID', function (done) {
    var request;

    options.method = 'DELETE';
    options.path= '/api/collection/documentID';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('delete');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion, using a query', function (done) {
    var request;

    options.method = 'DELETE';
    options.path= '/api/collection/_query';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('deleteByQuery');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for collection deletion', function (done) {
    var request;

    options.method = 'DELETE';
    options.path= '/api/collection';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('deleteCollection');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for collection mapping creation', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/_mapping';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('putMapping');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for collection mapping retrieval', function (done) {
    var request;

    options.method = 'GET';
    options.path= '/api/collection/_mapping';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getMapping');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for bulk imports on a specific collection', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/collection/_bulk';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('bulk');
          should(result.action).be.exactly('import');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for global bulk imports', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/_bulk';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('bulk');
          should(result.action).be.exactly('import');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion using PUT', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/documentID/_delete';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('delete');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document creation using alternative path', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/documentID/_create';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('create');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for createOrUpdate actions using alternative path', function (done) {
    var request;

    options.method = 'PUT';
    options.path= '/api/collection/documentID/_createOrUpdate';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('createOrUpdate');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should not create a route for code coverage by default', function (done) {
    server.close();

    delete process.env.FEATURE_COVERAGE;

    router.initRouterHttp();

    server = http.createServer(function (request, response) {
      router.routeHttp(request, response);
    });

    server.listen(options.port);

    http.get('http://' + options.hostname + ':' + options.port + '/coverage', function (response) {
      should(response.statusCode).be.exactly(404);
      done();
    });
  });

  it('should create a route for code coverage when Kuzzle is started with FEATURE_COVERAGE=1', function (done) {
    server.close();

    process.env.FEATURE_COVERAGE = 1;

    router.initRouterHttp();

    server = http.createServer(function (request, response) {
      router.routeHttp(request, response);
    });

    server.listen(options.port);

    http.get('http://' + options.hostname + ':' + options.port + '/coverage', function (response) {
      should(response.statusCode).be.exactly(200);
      done();
    });
  });

  it('should create a route for the getStats command', function (done) {
    var request;

    options.method = 'POST';
    options.path= '/api/_getStats';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getStats');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });


  it('should create a route for the getAllStats command', function (done) {
    var request;

    options.method = 'GET';
    options.path= '/api/_getAllStats';

    request = http.request(options, function (response) {
      parseHttpResponse(response)
        .then(function (result) {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getAllStats');
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for the listCollection command', function (done) {
    http.get('http://' + options.hostname + ':' + options.port + '/api/_listCollections', function (response) {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('listCollections');
          done();
        })
        .catch(error => done(error));
    });
  });


  it('should create a route for the now command', function (done) {
    http.get('http://' + options.hostname + ':' + options.port + '/api/_now', function (response) {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('now');
          done();
        })
        .catch(error => done(error));
    });
  });
});
