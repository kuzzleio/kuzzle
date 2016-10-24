var
  rc = require('rc');

/**
 * RC params can be overriden using some environment variables,
 * in which case all values are passed as strings.
 * 
 * When dealing with configuration, we can safely assume the expected 
 * correct type
 * 
 * @param cfg
 */
function unstringify (cfg) {
  Object.keys(cfg).forEach(k => {
    // exception - *version entries need to be kept as string
    if (/version$/i.test(k)) {
      return;
    }
    
    if (typeof cfg[k] === 'string') {
      if (cfg[k] === 'true') {
        cfg[k] = true;
      }
      else if (cfg[k] === 'false') {
        cfg[k] = false;
      }
      else if (/^[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseInt(cfg[k]);
      }
      else if (/^[0-9]+\.[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseFloat(cfg[k]);
      }
    }
    else if (cfg[k] instanceof Object) {
      cfg[k] = unstringify(cfg[k]);
    }
  });
  
  return cfg;
}

module.exports = unstringify(rc('kuzzle', require('../../default.config')));
