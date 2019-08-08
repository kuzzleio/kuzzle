const path = require('path');
const { get, endsWith } = require('lodash');

const hashRE = /#.*$/;
const extRE = /\.(md|html)$/;
const endingSlashRE = /\/$/;
const outboundRE = /^(https?:|mailto:|tel:)/;

export function getOldSDK(sdkList) {
  return sdkList
    .filter(sdk => !sdk.newArchitecture)
    .map(sdk => `${sdk.language}${sdk.version}`);
}

export function setItemLocalStorage(key, item) {
  const storeItem = typeof item === 'object' ? JSON.stringify(item) : item;
  localStorage.setItem(key, storeItem);
}

export function getItemLocalStorage(key) {
  const item = localStorage.getItem(key);
  return typeof item === 'string' ? JSON.parse(item) : item;
}

function normalize(path) {
  return decodeURI(path)
    .replace(hashRE, '')
    .replace(extRE, '');
}

function getHash(path) {
  const match = path.match(hashRE);
  if (match) {
    return match[0];
  }
}

function isExternal(path) {
  return outboundRE.test(path);
}

function isMailto(path) {
  return /^mailto:/.test(path);
}

function isTel(path) {
  return /^tel:/.test(path);
}

function ensureExt(path) {
  if (isExternal(path)) {
    return path;
  }
  const hashMatch = path.match(hashRE);
  const hash = hashMatch ? hashMatch[0] : '';
  const normalized = normalize(path);

  if (endingSlashRE.test(normalized)) {
    return path;
  }
  return normalized + '.html' + hash;
}

function isActive(route, path) {
  const routeHash = route.hash;
  const linkHash = getHash(path);
  if (linkHash && routeHash !== linkHash) {
    return false;
  }
  const routePath = normalize(route.path);
  const pagePath = normalize(path);
  return routePath === pagePath;
}

function resolvePage(pages, rawPath, base) {
  if (base) {
    rawPath = resolvePath(rawPath, base);
  }
  const path = normalize(rawPath);
  for (let i = 0; i < pages.length; i++) {
    if (normalize(pages[i].path) === path) {
      return Object.assign({}, pages[i], {
        type: 'page',
        path: ensureExt(rawPath)
      });
    }
  }
  console.error(
    `[vuepress] No matching page found for sidebar item "${rawPath}"`
  );
  return {};
}

function resolvePath(relative, base, append) {
  const firstChar = relative.charAt(0);
  if (firstChar === '/') {
    return relative;
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative;
  }

  const stack = base.split('/');

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop();
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/');
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === '..') {
      stack.pop();
    } else if (segment !== '.') {
      stack.push(segment);
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('');
  }

  return stack.join('/');
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

function groupPagesByPath(pages) {
  const sections = [];
  let currentSection = null;
  let currentSectionRE = null;
  pages.forEach(p => {
    if (!currentSection || !p.path.match(currentSectionRE)) {
      if (currentSection) {
        currentSection.children.sort(sortPagesByOrderAndTitle);
      }
      currentSection = Object.assign({}, p, { children: [] });
      currentSectionRE = new RegExp(`^${currentSection.path}.+`);
      sections.push(currentSection);
    } else {
      currentSection.children.push(p);
    }
  });
  return sections.sort(sortPagesByOrderAndTitle);
}

function sortPagesByOrderAndTitle(p1, p2) {
  const o1 = +get(p1, 'frontmatter.order', NaN);
  const o2 = +get(p2, 'frontmatter.order', NaN);

  if (isNaN(o1) && !isNaN(o2)) {
    return 1;
  }
  if (isNaN(o2) && !isNaN(o1)) {
    return -1;
  }
  if (isNaN(o1) || o1 === o2) {
    return p1.title < p2.title ? -1 : 1;
  }

  return o1 < o2 ? -1 : 1;
}

function groupHeaders(headers) {
  // group h3s under h2
  headers = headers.map(h => Object.assign({}, h));
  let lastH2;
  headers.forEach(h => {
    if (h.level === 2) {
      lastH2 = h;
    } else if (lastH2) {
      (lastH2.children || (lastH2.children = [])).push(h);
    }
  });
  return headers.filter(h => h.level === 2);
}

function resolveNavLinkItem(linkItem) {
  return Object.assign(linkItem, {
    type: linkItem.items && linkItem.items.length ? 'links' : 'link'
  });
}

function resolveMatchingConfig(route, config) {
  if (Array.isArray(config)) {
    return {
      base: '/',
      config: config
    };
  }
  for (const base in config) {
    if (ensureEndingSlash(route.path).indexOf(base) === 0) {
      return {
        base,
        config: config[base]
      };
    }
  }
  return {};
}

function ensureEndingSlash(path) {
  return /(\.html|\/)$/.test(path) ? path : path + '/';
}

function resolveItem(item, pages, base, isNested) {
  if (typeof item === 'string') {
    return resolvePage(pages, item, base);
  } else if (Array.isArray(item)) {
    return Object.assign(resolvePage(pages, item[0], base), {
      title: item[1]
    });
  } else {
    if (isNested) {
      console.error(
        '[vuepress] Nested sidebar groups are not supported. ' +
          'Consider using navbar + categories instead.'
      );
    }
    const children = item.children || [];
    return {
      type: 'group',
      title: item.title,
      children: children.map(child => resolveItem(child, pages, base, true)),
      collapsable: item.collapsable !== false
    };
  }
}

export const getPageChildren = (page, pages) => {
  const pathRE = new RegExp(`^${getPageDir(page)}[a-zA-z_0-9\-]+/?$`);

  return pages
    .filter(p => p.path.match(pathRE) && p.path !== page.path)
    .sort(sortPagesByOrderAndTitle);
};

export const findRootNode = (node, nodes) => {
  if (node.frontmatter.type === 'root') {
    return node;
  }
  const parent = getParentNode(node, nodes);
  if (!parent) {
    return node;
  }

  return findRootNode(parent, nodes);
};

export const getFirstValidChild = (node, nodes) => {
  const children = getPageChildren(node, nodes);

  if (!children.length) {
    return node;
  }

  return getFirstValidChild(children[0], nodes);
};

export const getValidLinkByRootPath = (pagePath, pages) => {
  const page = getNodeByPath(pagePath, pages);

  if (!page) {
    console.warn(`Unable to find tree node for path ${pagePath}`);
    return;
  }

  const validPage = getFirstValidChild(page, pages);

  if (!validPage) {
    return;
  }

  return validPage.path;
};

export const getNodeByPath = (path, nodes) => {
  return nodes.find(p => p.path === path);
};

export const getParentNode = (node, nodes) => {
  return getNodeByPath(getParentPath(node), nodes);
};

export const resolveHeaders = page => {
  const headers = groupHeaders(page.headers || []);
  return [
    {
      type: 'group',
      collapsable: false,
      title: page.title,
      children: headers.map(h => ({
        type: 'auto',
        title: h.title,
        basePath: page.path,
        path: page.path + '#' + h.slug,
        children: h.children || []
      }))
    }
  ];
};
