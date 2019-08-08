const { mapValues, assign, endsWith } = require('lodash');
const path = require('path');

const codeRE = /api-reference\/.+|protocols\/context\/|protocols\/entrypoint\/|protocols\/methods\/|plugins\/events\/.+|plugin-context|controllers\/.+|core-classes\/.+|virtual-classes\/.+|sdk\/.+\/protocols\/.+|core-structs\/.+|sdk\/.+\/classes\/.+/;

module.exports = (errorsByPath, ctx) => {
  return mapValues(errorsByPath, (errors, url) => {
    return errors.map(e => {
      if (e.error !== 'MISSING_KEY') {
        return e;
      }
      const fix = computeFix(url, e, ctx.pages);
      if (fix) {
        return assign({ fix }, e);
      } else {
        return e;
      }
    });
  });
};

function computeFix(url, error, nodes) {
  const node = getNodeByPath(url, nodes);
  if (!node) {
    return;
  }
  if (error.key === 'code') {
    if (codeRE.test(node.path)) {
      return {
        code: true
      };
    } else {
      return {
        code: false
      };
    }
  }
  if (error.key === 'type') {
    const children = getChildren(node, nodes);
    if (children.length) {
      if (
        node.frontmatter.type !== 'branch' &&
        node.frontmatter.type !== 'root'
      ) {
        return { type: 'branch' };
      }
    } else {
      if (node.frontmatter.type !== 'page') {
        return { type: 'page' };
      }
    }
  }
}

function getChildren(node, nodes) {
  const pathRE = new RegExp(`^${getNodeDirectory(node)}[a-zA-z_0-9\-]+/?$`);
  return nodes.filter(p => p.path.match(pathRE) && p.path !== node.path);
}

function getNodeDirectory(node) {
  if (endsWith(node.path, '/')) {
    return node.path;
  } else {
    return path.parse(node.path).dir;
  }
}

function getNodeByPath(path, nodes) {
  return nodes.find(p => p.path === path);
}
