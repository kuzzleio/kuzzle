'use strict';

const
  should = require('should'),
  rewire = require('rewire'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  GatewayTimeoutError = require('kuzzle-common-objects').errors.GatewayTimeoutError,
  Sandbox = rewire('../../../../lib/api/core/sandbox');

describe('Test: sandbox/sandboxTest', () => {
  let sandbox;

  afterEach(() => {
    if (!sandbox) {
      return;
    }

    if (sandbox.child && sandbox.child.connected && sandbox.child.kill) {
      sandbox.child.kill('SIGKILL');
    }
  });

  describe('#run', () => {
    it('should reject the promise if an error occurred', () => {
      let
        foo = Sandbox.__with__({
          setTimeout: () => { throw new Error('sandbox error'); }
        })(() => {
          sandbox = new Sandbox();

          return sandbox.run({
            code: 'var i = 0;'
          });
        });

      return should(foo).be.rejectedWith(Error, {message: 'sandbox error'});
    });

    it('should reject the promise if a job is already running', () => {
      sandbox = new Sandbox();
      sandbox.child = {connected: true};

      return should(sandbox.run({})).be.rejectedWith(InternalError);
    });

    it('should reject the promise if the sandboxed code timed out', () => {
      sandbox = new Sandbox();
      sandbox.timeout = 100;

      return should(
        sandbox.run({
          code: 'while(true) { }'
        }))
        .be.rejectedWith(GatewayTimeoutError);
    });

    it('should execute the given code', () => {
      sandbox = new Sandbox({timeout: 2000});

      return sandbox.run({code: '(() => { var a = 1; var b = 4; return (a + b); })()'})
        .then(result => {
          should(result.result).be.exactly(5);
        });
    });

    it('should be able to modify the given context', () => {
      sandbox = new Sandbox({timeout: 2000});

      return sandbox.run({
        sandbox: {
          i: 5
        },
        code: 'for (var j=0; j < 10; j++) { i++; }'
      })
        .then(result => {
          should(result.context.i).be.exactly(15);
          should(result.context.j).be.exactly(10);
        });
    });
  });
});
