const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const cheerio = require('cheerio');
const algolia = require('algoliasearch');
const c = require('chalk');

const { findRootNode, getParentNode } = require('./util.js');
const records = [];

module.exports = (options, ctx) => ({
  name: 'index-to-algolia',

  extendPageData($page) {
    const {
      _filePath, // file's absolute path
      _computed, // access the client global computed mixins at build time, e.g _computed.$localePath.
      _content, // file's raw content string
      _strippedContent, // file's content string without frontmatter
      key, // page's unique hash key
      frontmatter, // page's frontmatter object
      regularPath, // current page's default link (follow the file hierarchy)
      path: pagePath // current page's real link (use regularPath when permalink does not exist)
    } = $page;

    if (frontmatter.type !== 'page') {
      return;
    }

    const rootNode = findRootNode($page, ctx.pages);
    const parentNode = getParentNode($page, ctx.pages);
    records.push({
      objectID: key,
      title: frontmatter.title,
      description: frontmatter.description ? frontmatter.description : '',
      path: pagePath,
      tags: extractTags(pagePath),
      root: rootNode ? rootNode.title : '',
      parent: parentNode ? parentNode.title : '',
      toc: _computed.$page.headers
    });
  },

  ready() {},

  async generated(pagePaths) {
    enrichRecordsWithContent(records, ctx.outDir, true);
    await pushRecords(records, {
      appId: options.algoliaAppId,
      writeKey: options.algoliaWriteKey,
      index: options.algoliaIndex
    });
  }
});

function enrichRecordsWithContent(records, outDir, write = false) {
  console.log(`${c.blue('Algolia')} Enriching ${records.length} records...`);
  records.forEach(record => {
    const generatedFilePath = resolve(
      outDir,
      record.path.replace(/^\//, ''), // Strip first slash so that this path is not considered as absolute
      'index.html'
    );
    const fileContent = readFileSync(generatedFilePath).toString();
    const $ = cheerio.load(fileContent, {
      normalizeWhitespace: true
    });
    const content = $('.md-content');

    // remove useless content
    $('h1, pre, .md-clipboard__message', content).remove();

    record.content = content.text();
  });

  if (write) {
    writeFileSync('./algolia-records.json', JSON.stringify(records, null, 4));
  }
}

async function pushRecords(records, algoliaOptions) {
  if (!algoliaOptions.writeKey) {
    throw new Error('Please provide a valid Algolia Write Key');
  }

  console.log(`${c.blue('Algolia')} Pushing ${records.length} records...`);

  const client = algolia(algoliaOptions.appId, algoliaOptions.writeKey);
  const index = client.initIndex(algoliaOptions.index);

  await index.clearIndex()

  index.addObjects(records, (err, content) => {
    if (err) {
      return console.error(err);
    }
    console.log(`${c.blue('Algolia')} Successfully pushed records!`);
  });
}

function extractTags(path) {
  const start = 0,
    end = 4;

  return path
    .split('/')
    .filter(t => t !== '')
    .slice(start, end)
    .map(tag => {
      if (tag === 'sdk-reference') {
        return 'sdk';
      }
      if (/^[0-9]+$/.test(tag)) {
        return `${tag}.x`;
      }
      return tag;
    });
}
