const
  stripJson = require('strip-json-comments'),
  fs = require('fs');

describe('.kuzzlerc.sample', () => {
  it('should be able to load the kuzzlerc sample file without errors', () => {
    const
      content = fs.readFileSync(`${__dirname}/../../.kuzzlerc.sample`),
      stripped = stripJson(content.toString());

    // throw if malformed
    try {
      JSON.parse(stripped);
    } catch(e) {
      // eslint-disable-next-line
      console.error(stripped);
      throw e;
    }
  });
});
