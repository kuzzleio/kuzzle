'use strict';

const should = require('should');

const { hilightUserCode } = require('../../lib/util/stackTrace');

describe('#hilightUserCode', () => {
  it('should ignore the error message', () => {
    const line = 'Something is wrong with people';

    const stack = hilightUserCode(line);

    should(stack).be.eql(line);
  });

  it('should ignore already enhanced lines', () => {
    const line = '> at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)';

    const stack = hilightUserCode(line);

    should(stack).be.eql(line);
  });

  it('should add padding for line about kuzzle code', () => {
    const line = ' at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)';

    const stack = hilightUserCode(line);

    should(stack).be.eql('  ' + line);
  });

  it('should add padding for line about node internal', () => {
    const line = ' at processImmediate (internal/timers.js:462:21)';

    const stack = hilightUserCode(line);

    should(stack).be.eql('  ' + line);
  });

  it('should add padding for line about module', () => {
    const line = ' at Assertion.value (node_modules/should/cjs/should.js:356:19)';

    const stack = hilightUserCode(line);

    should(stack).be.eql('  ' + line);
  });

  it('should hilight user code', () => {
    const line = ' at registerFoo (/home/aschen/projets/app/test.ts:12:18)';

    const stack = hilightUserCode(line);

    should(stack).be.eql('>' + line);
  });

});
