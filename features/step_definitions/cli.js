const
  {
    When,
    Then
  } = require('cucumber'),
  { execSync } = require('child_process'),
  _ = require('lodash'),
  fs = require('fs'),
  should = require('should');

When('I have a file {string} containing {string}', function (filePath, rawContent) {
  const content = JSON.parse(rawContent);

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
});

When('I use the CLI command {string}', function (cliCommand) {
  execSync(`./bin/kuzzle ${cliCommand}`);
});

/* eslint-disable no-useless-escape */
Then(/A file "([\w\./-]+)" exists( and contain '(.*)')?/, function (filePath, rawContent) {
  should(fs.existsSync(filePath)).be.eql(true);

  if (rawContent) {
    const expectedContent = JSON.parse(rawContent);
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    should(fileContent).match(expectedContent);
  }
});

Then('a file {string} contain an array of {string} documents', function (filePath, countRaw) {
  const
    content = JSON.parse(fs.readFileSync(filePath, 'utf-8')),
    count = parseInt(countRaw);

  should(_.isArray(content)).be.eql(true);
  should(content.length).be.eql(count);

  for (const document of content) {
    should(_.isPlainObject(document)).be.eql(true);
  }
});
