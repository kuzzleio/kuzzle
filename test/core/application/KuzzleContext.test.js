'use strict';

const should = require('should');

const { Backend } = require('../../../lib/core/application/backend');
const { KuzzleContext } = require('../../../lib/core/application/kuzzleContext');

class Service extends KuzzleContext {}

describe('KuzzleContext', () => {
  let application;
  let service;

  beforeEach(() => {
    service = new Service();
    Backend._instantiated = false;
    application = new Backend('black-mesa');
  });

  describe('#app', () => {
    it('should expose the application instance', () => {
      should(service.app).be.eql(application);
    });
  });
});
