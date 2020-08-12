'use strict';

const {
  BaseController,
  NativeController
} = require('../../lib/api/controller/base');
const {
  InternalError: KuzzleInternalError
} = require('kuzzle-common-objects');
const sinon = require('sinon');

function injectStubs (controller) {
  controller.failResult = new KuzzleInternalError('rejected action');
  controller.fail = sinon.stub().rejects(controller.failResult);

  // we need to use "callsFake" instead of "resolvesArg" because, for some
  // reason, .resolves and .resolvesArg behaviors are not overwritten
  // when we do "controller.succeed.returns('another value')": in that case,
  // "another value" is resolved as a promise result, which is not the
  // desired result
  controller.succeed = sinon.stub().callsFake(foo => Promise.resolve(foo));
}

class MockNativeController extends NativeController {
  constructor (kuzzle) {
    super(kuzzle);

    injectStubs(this);
  }

  _isAction(name) {
    return name === 'succeed' || name === 'fail';
  }
}

class MockBaseController extends BaseController {
  constructor () {
    super();

    injectStubs(this);
  }

  _isAction(name) {
    return name === 'succeed' || name === 'fail';
  }
}

module.exports = { MockBaseController, MockNativeController };
