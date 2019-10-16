const
  {
    When,
    Then
  } = require('cucumber'),
  { execSync } = require('child_process'),
  fs = require('fs'),
  ndjson = require('ndjson'),
  should = require('should');

When('I have a file {string} containing {string}', function (filePath, rawContent) {
  const content = JSON.parse(rawContent);

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
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

Then('a file {string} contain {int} documents', function (filePath, count) {
  const content = [];

  return new Promise(resolve => {
    fs.createReadStream(filePath)
      .pipe(ndjson.parse())
      .on('data', obj => content.push(obj))
      .on('finish', () => {
        should(content.length).be.eql(count);

        for (const document of content.slice(1)) {
          should(document).be.type('object');
          should(document.body).be.type('object');
          should(document._id).be.type('string');
          should(document.body._kuzzle_info).be.type('object');
        }

        resolve();
      });
  });
});
