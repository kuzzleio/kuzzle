'use strict';

const should = require('should');
const {
  KuzzleError,
  UnauthorizedError,
  TooManyRequestsError,
  SizeLimitError,
  ServiceUnavailableError,
  PreconditionError,
  PluginImplementationError,
  PartialError,
  NotFoundError,
  InternalError,
  GatewayTimeoutError,
  ForbiddenError,
  ExternalServiceError,
  BadRequestError,
} = require('kuzzle-common-objects');

const { checkDomains } = require('../../lib/kerror/codes');

const kuzzleObjectErrors = {
  KuzzleError,
  UnauthorizedError,
  TooManyRequestsError,
  SizeLimitError,
  ServiceUnavailableError,
  PreconditionError,
  PluginImplementationError,
  PartialError,
  NotFoundError,
  InternalError,
  GatewayTimeoutError,
  ForbiddenError,
  ExternalServiceError,
  BadRequestError,
};

describe('kerror: error codes loader', () => {
  let domains;

  beforeEach(() => {
    domains = {
      foo: {
        code: 111,
        subdomains: {
          sub1: {
            code: 234,
            errors: {
              err1: {
                code: 13,
                class: 'InternalError',
                description: 'description',
                message: 'message',
              },
              err2: {
                code: 42,
                class: 'InternalError',
                description: 'description',
                message: 'message',
              },
            },
          },
          sub2: {
            code: 235,
            errors: {
              err1: {
                code: 42,
                class: 'InternalError',
                description: 'description',
                message: 'message',
              },
            },
          },
        },
      },
      bar: {
        code: 222,
        subdomains: {
          sub1: {
            code: 234,
            errors: {
              err1: {
                code: 42,
                class: 'InternalError',
                description: 'description',
                message: 'message',
              },
            },
          },
        },
      },
    };
  });

  describe('#checkDomains', () => {
    it('should throw if a domain is missing a code', () => {
      delete domains.foo.code;
      should(() => checkDomains(domains)).throw(/missing required 'code' field/i);
    });

    it('should throw if the domain code is not an integer', () => {
      for (const code of [null, undefined, [], {}, 3.14, 'foo', false, true]) {
        domains.foo.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be an integer/i);
      }
    });

    it('should throw if the domain code is already used', () => {
      domains.bar.code = domains.foo.code;
      should(() => checkDomains(domains)).throw(/code .* is not unique/i);
    });

    it('should throw if the domain code exceeds the allowed range', () => {
      for (const code of [-1, 256]) {
        domains.foo.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be between 0 and 255/i);
      }

      // prevent domain code conflict
      delete domains.bar;

      for (let code = 0; code <= 0xff; code++) {
        domains.foo.code = code;
        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).not.throw();
      }
    });

    it('should throw if no subdomains are defined', () => {
      delete domains.foo.subdomains;
      should(() => checkDomains(domains)).throw(/missing required 'subdomains' field/i);
    });

    it('should throw if the subdomains property is not an object', () => {
      for (const subdomains of [null, undefined, [], 3.14, 'foo', false, true]) {
        domains.foo.subdomains = subdomains;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'subdomains' must be an object/i);
      }
    });

    it('should throw if a non-plugin subdomain is missing a code', () => {
      delete domains.bar.subdomains.sub1.code;
      should(() => checkDomains(domains)).throw(/missing required 'code' field/i);
    });

    it('should default plugin subdomains code to 0 if not set', () => {
      delete domains.bar.subdomains.sub1.code;
      should(() => checkDomains(domains, {plugin: true})).not.throw();
      should(domains.bar.subdomains.sub1.code).eql(0);
    });

    it('should throw if a subdomain code is not an integer', () => {
      for (const code of [null, undefined, [], {}, 3.14, 'foo', false, true]) {
        domains.foo.subdomains.sub2.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be an integer/i);
      }
    });

    it('should throw if a subdomain code is already used', () => {
      domains.foo.subdomains.sub1.code = 0;
      domains.foo.subdomains.sub2.code = 0;
      should(() => checkDomains(domains)).throw(/code .* is not unique/i);
    });

    it('should not throw if a plugin subdomain contains multiple defaulted codes', () => {
      delete domains.foo.subdomains.sub1;
      delete domains.foo.subdomains.sub2;
      should(() => checkDomains(domains, {plugin: true})).not.throw();
    });

    it('should throw if a plugin subdomain contain duplicates, non-default, codes', () => {
      domains.foo.subdomains.sub1.code = 42;
      domains.foo.subdomains.sub2.code = 42;
      should(() => checkDomains(domains, {plugin: true})).throw(/code .* is not unique/i);
    });

    it('should throw if a subdomain code exceeds the allowed range', () => {
      for (const code of [-1, 256]) {
        domains.foo.subdomains.sub2.code = code;
        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be between 0 and 255/i);
      }

      // prevent subdomain code conflict
      delete domains.foo.subdomains.sub2;

      for (let code = 0; code <= 0xff; code++) {
        domains.foo.subdomains.sub1.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).not.throw();
      }
    });

    it('should throw if a subdomain is missing an errors object', () => {
      delete domains.foo.subdomains.sub2.errors;
      should(() => checkDomains(domains)).throw(/missing required 'errors' field/i);
    });

    it('should throw if a subdomain has a non-object errors property', () => {
      for (const errors of [null, undefined, [], 3.14, 'foo', false, true]) {
        domains.foo.subdomains.sub2.errors = errors;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'errors' must be an object/i);
      }
    });

    it('should throw if an error is missing a code', () => {
      delete domains.foo.subdomains.sub1.errors.err1.code;
      should(() => checkDomains(domains)).throw(/missing required 'code' field/i);
    });

    it('should throw if an error code is not an integer', () => {
      for (const code of [null, undefined, [], {}, 3.14, 'foo', false, true]) {
        domains.foo.subdomains.sub2.errors.err1.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be an integer/i);
      }
    });

    it('should throw if an error code is outside its allowing range', () => {
      for (const code of [-1, 0, 65536]) {
        domains.foo.subdomains.sub2.errors.err1.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'code' must be between 1 and 65535/i);
      }

      for (let code = 1; code <= 0xffff; code++) {
        domains.foo.subdomains.sub2.errors.err1.code = code;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).not.throw();
      }
    });

    it('should throw if an error is missing a message', () => {
      delete domains.foo.subdomains.sub1.errors.err1.message;

      should(() => checkDomains(domains)).throw(/missing required 'message' field/i);
    });

    it('should throw if an error message is not a non-empty string', () => {
      for (const message of [null, undefined, [], {}, 3.14, false, true, '']) {
        domains.foo.subdomains.sub2.errors.err1.message = message;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'message' must be a non-empty string/i);
      }
    });

    it('should throw if an error is missing an error class', () => {
      delete domains.foo.subdomains.sub1.errors.err1.class;

      should(() => checkDomains(domains)).throw(/missing required 'class' field/i);
    });

    it('should throw if an error class is not a string', () => {
      for (const className of [null, undefined, [], {}, 3.14, false, true]) {
        domains.foo.subdomains.sub2.errors.err1.class = className;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'class' must be a string/i);
      }
    });

    it('should throw if an error class name does not match a known KuzzleError class', () => {
      domains.foo.subdomains.sub2.errors.err1.class = 'foo';

      should(() => checkDomains(domains)).throw(/field 'class' must target a known KuzzleError object/i);

      for (const name of Object.keys(kuzzleObjectErrors)) {
        domains.foo.subdomains.sub2.errors.err1.class = name;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).not.throw();
      }
    });

    it('should throw if a native error does not contain a description', () => {
      delete domains.foo.subdomains.sub2.errors.err1.description;

      should(() => checkDomains(domains)).throw(/field 'description' must be a non-empty string/i);

      for (const description of [null, undefined, [], {}, 3.14, false, true, '']) {
        domains.foo.subdomains.sub2.errors.err1.description = description;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'description' must be a non-empty string/i);
      }
    });

    it('should not throw if a plugin error does not contain a description', () => {
      delete domains.foo.subdomains.sub2.errors.err1.description;

      should(() => checkDomains(domains, {plugin: true})).not.throw();
    });

    it('should throw if a deprecated field is present and not a non-empty string', () => {
      for (const deprecated of [[], {}, 3.14, false, true, '']) {
        domains.foo.subdomains.sub2.errors.err1.deprecated = deprecated;

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => checkDomains(domains)).throw(/field 'deprecated' must be a non-empty string/i);
      }
    });
  });
});
