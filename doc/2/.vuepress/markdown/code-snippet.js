const { fs, path } = require('@vuepress/shared-utils');
const fixIndents = require('./fix-indents.js');

module.exports = function snippet(md, options = {}) {
  const root = options.root || process.cwd();
  const docDir = process.env.DOC_DIR || 'src';

  function parser(state, startLine, endLine, silent) {
    const CH = '<'.charCodeAt(0);
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    // Look for snippet import tag
    for (let i = 0; i < 3; ++i) {
      const ch = state.src.charCodeAt(pos + i);
      if (ch !== CH || pos + i >= max) return false;
    }

    if (silent) {
      return true;
    }

    const start = pos + 3;
    const end = state.skipSpacesBack(max, pos);
    const sourcePath = state.src.slice(start, end).trim();
    let rawPath = sourcePath;

    // Extract raw path (absolute)
    if (/^@/.exec(sourcePath)) {
      rawPath = sourcePath.replace(/^@/, root);
    }

    // Extract raw path (relative)
    if (/^\./.exec(sourcePath)) {
      rawPath = sourcePath.replace(
        /^\./,
        path.dirname(path.normalize(`${root}/${docDir}/${state.env.relativePath}`))
      );
    }

    // Extract snippet id (if present)
    let snippetId = rawPath.match(/:\d+/);
    if (snippetId && snippetId[0]) {
      snippetId = snippetId[0];
      rawPath = rawPath.replace(snippetId, '');
    }

    // Extract line highligts (if present)
    let highlights = rawPath.match(/{.*}/);
    if (highlights && highlights[0]) {
      highlights = highlights[0];
      rawPath = rawPath.replace(highlights, '');
    }

    // Extract language highlighting (if present)
    let language = rawPath.match(/\[([a-z]*)\]/);
    if (language && language[0]) {
      rawPath = rawPath.replace(language[0], '');
      if (language[1]) {
        language = language[1];
      } else {
        language = null;
      }
    }

    // Generate snippet-extraction RegExp
    const SNIPPET_EXTRACT = generateSnippetRegex(snippetId);

    // Extract filename
    const filename = rawPath.split(/[\[{:\s]/).shift();

    // By default, import the whole file contents
    const fileExists = fs.existsSync(filename);
    let content = fileExists
      ? fs.readFileSync(filename).toString()
      : 'Not found: ' + filename;

    if (state.env.relativePath && ! fileExists) {
      console.error(`Cannot find snippet at ${filename}. Did you correctly set DOC_DIR ?`)
    }

    // Extract snippet from file content, if matches snippet:* tags
    const match = SNIPPET_EXTRACT.exec(content);
    if (match && match[1]) {
      content = match[1];
    }

    // Delete snippet extraction tags (if any)
    content = content.replace(/.*snippet:start(:\d+)?.*\n/g, '');
    content = content.replace(/.*snippet:end.*\n/g, '');

    // Fix indentation in code content
    content = fixIndents(content, {
      countSpaces: 2
    });

    // Extract meta (line highlight)
    const fileExtension = filename.split('.').pop();
    const meta = `${language ? language : fileExtension}${
      highlights ? highlights : ''
    }`;

    state.line = startLine + 1;

    // Create token
    const token = state.push('fence', 'code', 0);
    token.info = meta;
    token.content = content;
    token.markup = '```';
    token.map = [startLine, startLine + 1];

    return true;
  }

  md.block.ruler.at('snippet', parser);
};

function generateSnippetRegex(snippetId) {
  // if no snippet id is specfied, exclude all snippets that have an ID
  if (!snippetId) {
    snippetId = '[^:^0-9]';
  }

  return new RegExp(
    `^.*snippet:start${snippetId}.*$\\n((.|\\n)*?)^.*snippet:end.*$\\n`,
    'gm'
  );
}
