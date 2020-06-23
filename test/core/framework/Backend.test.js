'use strict';

const _ = require('lodash');
const should = require('should');

const { Backend } = require('../../../lib/core/framework/backend.ts');

describe('Backend', () => {
  let application;

  beforeEach(() => {
    application = new Backend('black-mesa');
  });

  describe('PipeManager#register', () => {
    it('should register a new pipe', () => {
      const handler = async () => {};
      const handler_bis = async () => {};

      application.pipe.register('kuzzle:state:ready', handler);
      application.pipe.register('kuzzle:state:ready', handler_bis);

      should(application._pipes['kuzzle:state:ready']).have.length(2);
      should(application._pipes['kuzzle:state:ready'][0]).be.eql(handler);
      should(application._pipes['kuzzle:state:ready'][1]).be.eql(handler_bis);
    });

    it('should throw an error if the pipe handler is invalid', () => {

    });

    it('should throw an error if the application is already started', () => {

    });
  });
});