'use strict';

const should = require('should');

const KuzzleMock = require('../mocks/kuzzle.mock');

const generateOpenApi = require('../../lib/api/openApiGenerator');

describe('OpenApiGenerator', () => {
  let kuzzle;
  let generatedApi;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.config.http.routes = [
      {
        action: 'nativeAction',
        controller: 'nativeController',
        path: '/nativeController/nativeAction',
        verb: 'GET'
      },
      {
        action: 'exists',
        controller: 'collection',
        path: '/:index/:collection/_exists',
        verb: 'get'
      }
    ];
    kuzzle.pluginsManager = {
      routes: [
        {
          action: 'pluginAction',
          controller: 'pluginController',
          path: '/_/pluginController/pluginAction',
          verb: 'post'
        }
      ]
    };

    generatedApi = generateOpenApi();

    should(generatedApi.paths).be.an.Object();
  });

  describe('#generateOpenApi', () => {
    it('should correctly merge native and plugin routes', () => {
      should(generatedApi.paths).have.ownProperty('/nativeController/nativeAction');
      should(generatedApi.paths).have.ownProperty('/_/pluginController/pluginAction');
    });

    it('should make sure that route verbs are lowercase only', () => {
      should(generatedApi.paths).have.ownProperty('/nativeController/nativeAction');
      should(generatedApi.paths['/nativeController/nativeAction'])
        .have.ownProperty('get');
    });

    it('should transform our :param path notation to {param}', () => {
      should(generatedApi.paths).have.ownProperty('/{index}/{collection}/_exists');
    });

    it('should extract parameters when required', () => {
      should(generatedApi.paths).have.ownProperty('/{index}/{collection}/_exists');
      should(generatedApi.paths['/{index}/{collection}/_exists'].get.parameters).match([
        { name: 'index', in: 'path' },
        { name: 'collection', in: 'path' },
      ]);
    });
  });
});
