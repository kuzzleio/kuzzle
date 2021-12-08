'use strict';

const should = require('should');
const { RequestContext } = require('../../../lib/api/request/requestContext');

describe('#RequestContext', () => {
  const args = {
    token: {token: 'token'},
    user: {user: 'user'},
    connection: {
      id: 'connectionId',
      protocol: 'protocol',
      ips: ['foo', 'bar'],
      foo: 'bar'
    }
  };

  let context;

  beforeEach(() => {
    context = new RequestContext(args);
  });

  it('should initialize itself with provided options', () => {
    should(context.connection.id).eql('connectionId');
    should(context.connection.protocol).eql('protocol');
    should(context.connection.ips).match(['foo', 'bar']);
    should(context.connection.misc.foo).eql('bar');
    should(context.token).match({token: 'token'});
    should(context.user).match({user: 'user'});

    // checking deprecated properties, ensuring compatibility
    // with older versions
    should(context.connectionId).eql('connectionId');
    should(context.protocol).eql('protocol');
  });

  it('should serialize properly', () => {
    should(context.toJSON())
      .match(args);
  });
});
