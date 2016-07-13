/*
 * This file tests the initRouterHttp function, which creates HTTP routes
 * for the Kuzzle REST API.
 */

var
  should = require('should'),
  http = require('http'),
  Promise = require('bluebird'),
  kuzzleParams = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  yamlToJson = require('parser-yaml').parse,
  RouterController = rewire('../../../../lib/api/controllers/routerController');

/*
 * This function helps keeping tests simple and clear while ensuring that
 * responses are well-formed.
 */
function parseHttpResponse (response, yaml) {
  var
    data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  return new Promise((resolve, reject) => {
    response.on('end', () => {
      var result;

      if (yaml === true) {
        yamlToJson(data, (err, res) => {
          if (err) {
            return reject(err);
          }

          result = res;
        });
      }
      else {
        try {
          result = JSON.parse(data);
        }
        catch (e) {
          return reject(e);
        }
      }

      resolve(result);
    });
  });
}

describe('Test: routerController.initRouterHttp', () => {
  var
    kuzzle,
    server,
    url,
    path,
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
  before(done => {
    var mockResponse;
    kuzzle = new Kuzzle();

    mockResponse = (params, request, response) => {
      if (!params.action) {
        params.action = request.params.action;
      }

      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(JSON.stringify(params));
    };

    kuzzle.start(kuzzleParams, {dummy: true})
      .then(() => {
        RouterController.__set__('executeFromRest', mockResponse);

        path = '/api/' + kuzzle.config.apiVersion;
        url = 'http://' + options.hostname + ':' + options.port + path;

        kuzzle.pluginsManager.routes = [
          {verb: 'get', url: '/myplugin/bar/:name', controller: 'myplugin/foo', action: 'bar'},
          {verb: 'post', url: '/myplugin/bar', controller: 'myplugin/foo', action: 'bar'}
        ];

        router = new RouterController(kuzzle);
        router.initRouterHttp();

        server = http.createServer((request, response) => {
          router.routeHttp(request, response);
        });

        server.listen(options.port, () => done());
      });
  });

  after(() => {
    server.close();
  });

  it('should reply with a list of available routes on a simple GET query', done => {
    http.get(url, response => {
      parseHttpResponse(response)
        .then(result => {
          should(result.status).be.exactly(200);
          should(result.error).be.null();
          should(result.result.message).be.exactly('Available routes for this API version by verb.');
          should(result.result.routes).be.an.Object();
          should(result.result.routes['myplugin/foo']).be.an.Object();
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  it('should create a route for message publication', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/collection';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('publish');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document creation', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/collection/_create';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('create');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document retrieving', done => {
    http.get(url + '/index/collection/documentID', response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('get');
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  it('should create a route for document searches', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/collection/_search';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('search');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for createOrReplace actions', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('createOrReplace');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document updates', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID/_update';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('update');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for replace actions', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID/_replace';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('replace');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document counting', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/collection/_count';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('count');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion, using a document ID', done => {
    var request;

    options.method = 'DELETE';
    options.path= path + '/index/collection/documentID';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('delete');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion, using a query', done => {
    var request;

    options.method = 'DELETE';
    options.path= path + '/index/collection/_query';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('deleteByQuery');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for collection mapping creation', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/_mapping';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('updateMapping');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for collection mapping retrieval', done => {
    var request;

    options.method = 'GET';
    options.path= path + '/index/collection/_mapping';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getMapping');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for bulk imports on a specific collection', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/collection/_bulk';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('bulk');
          should(result.action).be.exactly('import');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for global bulk imports', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/index/_bulk';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('bulk');
          should(result.action).be.exactly('import');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document deletion using PUT', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID/_delete';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('delete');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for document creation using alternative path', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID/_create';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('create');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for createOrReplace actions using alternative path', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection/documentID/_createOrReplace';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('createOrReplace');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should not create a route for code coverage by default', done => {
    server.close();

    delete process.env.FEATURE_COVERAGE;

    router.initRouterHttp();

    server = http.createServer((request, response) => {
      router.routeHttp(request, response);
    });

    server.listen(options.port);

    http.get('http://' + options.hostname + ':' + options.port + '/coverage', response => {
      should(response.statusCode).be.exactly(404);
      done();
    });
  });

  it('should create a route for code coverage when Kuzzle is started with FEATURE_COVERAGE=1', done => {
    server.close();

    process.env.FEATURE_COVERAGE = 1;

    router.initRouterHttp();

    server = http.createServer((request, response) => {
      router.routeHttp(request, response);
    });

    server.listen(options.port);

    http.get('http://' + options.hostname + ':' + options.port + '/coverage', response => {
      should(response.statusCode).be.exactly(200);
      done();
    });
  });

  it('should create a route for the getStats command', done => {
    var request;

    options.method = 'POST';
    options.path= path + '/_getStats';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getStats');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });


  it('should create a route for the getAllStats command', done => {
    var request;

    options.method = 'GET';
    options.path= path + '/_getAllStats';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('getAllStats');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a default route for the listCollection command', done => {
    http.get(url + '/index/_listCollections', response => {
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

  it('should create a GET route for listCollections', done => {
    http.get(url + '/index/_listCollections/all', response => {
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

  it('should create a route for the now command', done => {
    http.get(url + '/_now', response => {
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

  it('should create a route for the createCollection command', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index/collection';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('write');
          should(result.action).be.exactly('createCollection');
          done();
        })
        .catch(error => done(error));
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for the truncateCollection command', done => {
    var request;

    options.method = 'DELETE';
    options.path= path + '/index/collection/_truncate';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('truncateCollection');
          done();
        })
        .catch(error => done(error));
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for the listIndexes command', done => {
    var request;

    options.method = 'GET';
    options.path= path + '/_listIndexes';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('listIndexes');
          done();
        })
        .catch(error => done(error));
    });

    request.write('');
    request.end();
  });

  it('should create a route for the createIndex command', done => {
    var request;

    options.method = 'PUT';
    options.path= path + '/index';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('createIndex');
          done();
        })
        .catch(error => done(error));
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for the deleteIndex command', done => {
    var request;

    options.method = 'DELETE';
    options.path= path + '/index';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('deleteIndex');
          done();
        })
        .catch(error => done(error));
    });

    request.write('foobar');
    request.end();
  });

  it('should create a route for the deleteIndexes command', done => {
    var request;

    options.method = 'DELETE';
    options.path= path + '/_deleteIndexes';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('admin');
          should(result.action).be.exactly('deleteIndexes');
          done();
        })
        .catch(error => done(error));
    });

    request.write('foobar');
    request.end();
  });

  it('should create a GET route for plugin controller', done => {
    http.get(url + '/_plugin/myplugin/bar/name', response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('myplugin/foo');
          should(result.action).be.exactly('bar');
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  it('should create a POST route for plugin controller', done => {
    var request;
    options.method = 'POST';
    options.path= path + '/_plugin/myplugin/bar';

    request = http.request(options, response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('myplugin/foo');
          should(result.action).be.exactly('bar');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    request.write('foobar');
    request.end();
  });

  it('should create a GET route to get server informations', done => {
    http.get('http://' + options.hostname + ':' + options.port + '/api/_serverInfo', response => {
      parseHttpResponse(response)
        .then(result => {
          should(response.statusCode).be.exactly(200);
          should(result.controller).be.exactly('read');
          should(result.action).be.exactly('serverInfo');
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  it('should create a GET route to get server the swagger.json', done => {
    http.get('http://' + options.hostname + ':' + options.port + '/api/swagger.json', response => {
      parseHttpResponse(response)
        .then(result => {
          should(Object.keys(result).length).be.above(1);
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  it('should create a GET route to get server the swagger.yml', done => {
    http.get('http://' + options.hostname + ':' + options.port + '/api/swagger.yml', response => {
      parseHttpResponse(response, true)
        .then(result => {
          should(Object.keys(result).length).be.above(1);
          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

});
