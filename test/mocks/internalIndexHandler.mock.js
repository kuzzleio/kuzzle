'use strict';

const sinon = require('sinon');

const InternalIndexHandler = require('../../lib/kuzzle/internalIndexHandler');

class InternalIndexHandlerMock extends InternalIndexHandler {
  constructor (kuzzle) {
    super(kuzzle);

    sinon.stub(this, 'init');
    sinon.stub(this, 'createInitialSecurities').resolves();
    sinon.stub(this, 'createInitialValidations').resolves();
    sinon.stub(this, 'getSecret').resolves();
  }
}

module.exports = InternalIndexHandlerMock;
