const path = '../config/error-codes/';
const internal = require(`${path}internal`);
const external = require(`${path}external`);
const api = require(`${path}/api`);
const network = require(`${path}network`);
const plugins = require(`${path}plugins`);
const fs = require('fs');

function errorLink(errorClass) {
  switch (errorClass) {
    case 'BadRequestError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'ForbiddenError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'KuzzleError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'ParseError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'PluginImplementationError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'SizeLimitError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'ExternalServiceError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'GatewayTimeoutError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'InternalError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'NotFoundError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'PartialError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'PreconditionError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'ServiceUnavailableError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    case 'UnauthorizedError':
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${errorClass.toLowerCase()})`;
    default :
      return `[${errorClass}](https://docs.kuzzle.io/core/1/api/essentials/errors/)`;
  }
}

function buildSubcodesDoc(errorCodesFiles) {
  
  let doc = '---\ncode: false\ntype: page\ntitle: Error Subcodes\ndescription: error subcodes definitions\norder: 500\n---\n\n# Error subcodes definitions\n';
  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];
   
    doc += `\n## ${domainName}, code: ${domain.code}\n\n`;
    for (const subdomainName of Object.keys(domain.subdomains)) {
      const subdomain = domain.subdomains[subdomainName];

      doc += `\n\n### Subdomain: ${subdomainName}, code: ${subdomain.code}\n\n`;
      doc += '| Code | Message          | Class              | Error              | FullName           |\n------ | -----------------| ------------------ | ------------------ | ------------------ |\n';
      for (const errorName of Object.keys(subdomain.errors)) {
        const error = subdomain.errors[errorName];
        
        doc += `${domain.code}${subdomain.code}${error.code}  | \`${error.message.replace(/%s/g, '<placeholder>')}\` | ${errorLink(error.class)} | ${errorName} | ${domainName}.${subdomainName}.${errorName}\n`;
      }
      doc += '\n---\n';
    }
    doc += '\n---\n';
  }
  fs.writeFile('../../doc/1/api/essentials/errors/subcodes/index.md', doc, (err => {
    if (err) {
      throw new Error(err);
    }
  }));
}

buildSubcodesDoc({ internal, external, api, network, plugins });
