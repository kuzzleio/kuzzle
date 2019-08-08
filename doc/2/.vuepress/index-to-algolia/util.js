const path = require('path');
const { get, endsWith } = require('lodash');

function getNodeByPath(path, nodes) {
  return nodes.find(p => p.path === path);
}

function getPageDir(page) {
  if (endsWith(page.path, '/')) {
    return page.path;
  } else {
    return path.parse(page.path).dir;
  }
}

function getParentPath(node) {
  return path.normalize(`${getPageDir(node)}../`);
}

function getParentNode(node, nodes) {
  return getNodeByPath(getParentPath(node), nodes);
}

function findRootNode(node, nodes) {
  if (node.frontmatter.type === 'root') {
    return node;
  }
  const parent = getParentNode(node, nodes);
  if (!parent) {
    return node;
  }

  return findRootNode(parent, nodes);
}

module.exports = {
  findRootNode,
  getParentNode
};
