var
  should = require('should'),
  rewire = require('rewire'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  GatewayTimeoutError = require.main.require('kuzzle-common-objects').Errors.gatewayTimeoutError,
  Sandbox = rewire('../../../../lib/api/core/sandbox');

describe('Test: sandbox/sandboxTest', () => {
  var sandbox;

  afterEach(() => {
    if (!sandbox) {
      return;
    }

    if (sandbox.child !== undefined && sandbox.child.connected && sandbox.child.kill) {
      sandbox.child.kill('SIGKILL');
    }
  });

  describe('#run', () => {
    it('should reject the promise if an error occurred', () => {
      var
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

      should(sandbox.run({})).be.rejectedWith(InternalError);
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

    it('should not allocate a new debug port if not needed', function (done) {
      var
        LocalSandbox = rewire('../../../../lib/api/core/sandbox'),
        timer,
        revert;

      this.timeout(500);

      revert = LocalSandbox.__set__({
        process: { execArgv: [] }
      });

      /** @type {Sandbox} */
      sandbox = new LocalSandbox();
      sandbox.timeout = 500;

      sandbox.run({
        code: 'while(true) {}'
      });

      timer = setInterval(() => {
        var result;

        if (sandbox.child === null) {
          return;
        }

        result = sandbox.child.spawnargs.some(arg => {
          return arg.match(/^(--debug|--debug-(?:brk|port))=(\d+)$/);
        });

        should(result).be.false();

        revert();
        clearInterval(timer);
        timer = null;

        done();
      }, 30);
    });

    it('should allocate a new debug port if needed', function (done) {
      var
        LocalSandbox = rewire('../../../../lib/api/core/sandbox'),
        anotherSandbox,
        timer,
        revert;

      this.timeout(500);

      revert = LocalSandbox.__set__({
        process: {
          debugPort: 17511,
          execArgv: ['--debug-port=17511']
        }
      });

      /** @type {Sandbox} */
      anotherSandbox = new LocalSandbox();
      anotherSandbox.timeout = 500;

      anotherSandbox.run({
        code: 'while(true) {}'
      });

      timer = setInterval(() => {
        var result;

        if (anotherSandbox.child === null) {
          return;
        }

        result = anotherSandbox.child.spawnargs.some(arg => {
          var
            port,
            match = arg.match(/^(--debug|--debug-(?:brk|port))=(\d+)$/);

          if (match) {
            should(match[2]).match(/^\d+$/);
            port = parseInt(match[2]);
            should(port).be.aboveOrEqual(8000);
          }

          return match;
        });

        should(result).be.true();

        revert();
        anotherSandbox.child.kill('SIGKILL');
        clearInterval(timer);
        timer = null;

        done();
      }, 30);
    });

    it('should execute the given code', done => {
      var anotherSandbox = new Sandbox();
      anotherSandbox.run({
        code: '(() => { var a = 1; var b = 4; return (a + b); })()'
      })
        .then(result => {
          should(result.result).be.exactly(5);
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should be able to modify the given context', done => {
      var anotherSandbox = new Sandbox();
      anotherSandbox.run({
        sandbox: {
          i: 5
        },
        code: 'for (var j=0; j < 10; j++) { i++; }'
      })
        .then(result => {
          should(result.context.i).be.exactly(15);
          should(result.context.j).be.exactly(10);
          done();
        })
        .catch(error => {
          done(error);
        });
    });

  });
});

