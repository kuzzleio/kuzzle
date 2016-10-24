var
  rewire = require('rewire'),
  should = require('should'),
  Config = rewire('../../lib/config');

describe('lib/config/index.js', () => {
  describe('#unstringify', () => {
    var unstringify = Config.__get__('unstringify');

    it('should keep versions as string', () => {
      var config = unstringify({
        version: '0',
        someVersion: '1'
      });

      should(config.version).be.exactly('0');
      should(config.someVersion).be.exactly('1');
    });

    it('should convert bools', () => {
      var config = unstringify({
        foo: 'true',
        bar: 'false'
      });

      should(config.foo).be.true();
      should(config.bar).be.false();
    });

    it('should convert numbers', () => {
      var config = unstringify({
        foo: '42',
        bar: '0.25'
      });

      should(config.foo).be.exactly(42);
      should(config.bar).be.exactly(0.25);
    });

    it('should be recursive', () => {
      var config = unstringify({
        foo: '42',
        nested: {
          bar: 'true',
          sub: {
            baz: 'false'
          }
        }
      });

      should(config.foo).be.exactly(42);
      should(config.nested.bar).be.true();
      should(config.nested.sub.baz).be.false();
    });
  });
});
