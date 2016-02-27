'use strict';

const types = require('../runtime');
const fs = require('fs');
const path = require('path');

module.exports = {
  read: function(fn) {
    if (!path.isAbsolute(fn)) fn = path.join(types.currentScope.getVar('@dir').toVal(), fn);
    return String(fs.readFileSync(fn));
  },
  write: function(fn, data) {
    if (!path.isAbsolute(fn)) fn = path.join(types.currentScope.getVar('@dir').toVal(), fn);
    fs.writeFileSync(fn, data);
  },
  'exists?': function(fn) {
    if (!path.isAbsolute(fn)) fn = path.join(types.currentScope.getVar('@dir').toVal(), fn);
    try {
      fs.statSync(fn);
      return true;
    } catch(e) {
      if (e.code === 'ENOENT') return false;
      throw e;
    }
  }
}
