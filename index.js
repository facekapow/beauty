'use strict';

Error.stackTraceLimit = 100;

// requires
const parser = require('./beauty').parser;
const types = require('./runtime');
parser.yy = types;
const native = require('./native');
const args = process.argv.slice(2);
const fs = require('fs');
const path = require('path');

module.exports.eval = function(code, scope) {
  types.currentScope = scope || types.globalScope;
  const result = parser.parse(code);
  types.currentScope = scope.parent || types.globalScope;
  return result;
}

module.exports.parse = function(cont, fp) {
  const scope = new types.Scope(types.globalScope);
  const atFile = new types.Variable(new types.Identifier('@file'), new types.Identifier('const'), scope, new types.BString(fp), true);
  const atDir = new types.Variable(new types.Identifier('@dir'), new types.Identifier('const'), scope, new types.BString(path.dirname(fp)), true);
  atFile.toVal();
  atDir.toVal();
  const BPackage = new types.BObject();
  const packageVar = new types.Variable(new types.Identifier('package'), new types.Identifier('any'), scope);
  packageVar.setVal(BPackage);
  packageVar.toVal();
  return module.exports.eval(String(cont), scope);
}

module.exports.exposePackage = (name, override, func) => native.addPackage(name, override, func);

module.exports.exposeNatives = func => func(types);
