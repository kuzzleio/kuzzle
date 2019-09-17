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
  });
});
