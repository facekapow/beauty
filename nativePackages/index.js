'use strict';

module.exports = function(isBrowser) {
  if (isBrowser) {
    return {
      math: require('./math'),
      json: require('./json')
    }
  } else {
    return {
      fs: require('./fs'),
      math: require('./math'),
      json: require('./json')
    }
  }
}
