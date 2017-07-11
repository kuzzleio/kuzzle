const
  should = require('should'),
  ClientConnection = require('../../../../../lib/api/core/entrypoints/embedded/clientConnection');

describe('core/clientConnection', () => {
  describe('#constructor', () => {
    it('should throw if ips is not an array', () => {
      return should(() => new ClientConnection('protocol', 'ips'))
        .throw(TypeError, {message: 'Expected ips to be an Array, got string'});
    });

    it('should set headers', () => {
      const
        headers = {foo: 'bar'},
        connection = new ClientConnection('protocol', ['ip1', 'ip2'], headers);

      should(connection.headers)
        .be.exactly(headers);
    });
  });
});
