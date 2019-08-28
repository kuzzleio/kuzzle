const
  should = require('should'),
  ClientConnection = require('../../../../../lib/api/core/entrypoints/embedded/clientConnection');

describe('core/clientConnection', () => {
  describe('#constructor', () => {
    let
      headers,
      connection;

    beforeEach(() => {
      headers = { foo: 'bar' };
      connection =
        new ClientConnection('protocol', ['ip1', 'ip2'], headers);
    });

    it('should throw if ips is not an array', () => {
      return should(() => new ClientConnection('protocol', 'ips'))
        .throw(TypeError, {message: 'Expected ips to be an Array, got string'});
    });

    it('should set headers', () => {
      should(connection.headers).be.exactly(headers);
    });

    it('should be frozen', () => {
      connection.id = 'not-set';
      connection.protocol = 'not-set';
      connection.headers.foo = 'not-set'

      should(() => connection.ips.push('not-pushed')).throw(TypeError);
      should(connection.headers.foo).not.be.eql('not-set');
      should(connection.id).not.be.eql('not-set');
      should(connection.protocol).not.be.eql('not-set');
    });
  });
});