const
  {
    When,
    Then
  } = require('cucumber'),
  { execSync } = require('child_process'),
  fs = require('fs'),
  should = require('should');

When('I have a file {string} containing {string}', function (filePath, rawContent) {
  const content = JSON.parse(rawContent);

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
});

When('I use the CLI command {string}', function (cliCommand) {
  execSync(`./bin/kuzzle ${cliCommand}`);
});

Then(/A file "([\w\.\/-]+)" exists( and contain '(.*)')?/, function (filePath, rawContent) {
  should(fs.existsSync(filePath)).be.eql(true);

  if (rawContent) {
    const expectedContent = JSON.parse(rawContent);
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    should(fileContent).match(expectedContent);
  }
});
