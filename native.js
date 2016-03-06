'use strict';

const types = require('./runtime');
const index = require('./index');
const path = require('path');
const util = require('util');
const readline = require('readline-sync');
const fs = require('fs');
const nativePackages = require('./nativePackages');
const classes = require('./classes');
//const require_rel = require('require-relative');

const io = new types.BObject();
io.add(new types.Identifier('out'), new types.NativeFunction(function() {
  const strs = Array.prototype.slice.call(arguments, 0);
  for (const str of strs) {
    if (str === null || str === undefined) continue;
    let out = String(str);
    if (typeof str === 'object') out = util.inspect(str);
    process.stdout.write(out);
  }
  process.stdout.write('\n');
}));
io.add(new types.Identifier('trimOut'), new types.NativeFunction(function() {
  const strs = Array.prototype.slice.call(arguments, 0);
  for (const str of strs) {
    let out = String(str);
    if (typeof str === 'object') out = util.inspect(str);
    process.stdout.write(out);
  }
}));
io.add(new types.Identifier('in'), new types.NativeFunction(() => {
  return String(readline.question(null, {
    keepWhitespace: true
  }));
}));
io.add(new types.Identifier('charIn'), new types.NativeFunction(() => {
  return String(readline.keyIn(null, {
    keepWhitespace: true
  }));
}));

const ioVar = new types.Variable(new types.Identifier('io'), new types.Identifier('const'), types.globalScope, io, true);
ioVar.toVal();

const order = new types.Variable(new types.Identifier('order'), new types.Identifier('const'), types.globalScope, new types.NativeFunction(function(file) {
  if (nativePackages[file]) return nativePackages[file];
  let fp = path.join(types.currentScope.getVar('@dir').toVal(), file);
  if (path.extname(fp) === '') fp = fp + '.beau';
  const scope = new types.Scope(types.currentScope);
  const atFile = new types.Variable(new types.Identifier('@file'), new types.Identifier('const'), scope, new types.BString(fp), true);
  const atDir = new types.Variable(new types.Identifier('@dir'), new types.Identifier('const'), scope, new types.BString(path.dirname(fp)), true);
  atFile.toVal();
  atDir.toVal();
  const BPackage = new types.BObject();
  const packageVar = new types.Variable(new types.Identifier('package'), new types.Identifier('any'), scope);
  packageVar.setVal(BPackage);
  packageVar.toVal();
  index.eval(String(fs.readFileSync(fp)), scope);
  return packageVar.toVal();
}), true);
order.toVal();

/*const upgrade_order = new types.Variable(new types.Identifier('upgrade_order'), new types.Identifier('const'), types.globalScope, new types.NativeFunction(function(file) {
  return require_rel(file, types.currentScope.getVar('@dir').toVal());
}));
upgrade_order.toVal();*/

const unwrap = new types.Variable(new types.Identifier('unwrap'), new types.Identifier('const'), types.globalScope, new types.NativeFunction(function() {
  const objects = Array.prototype.slice.call(arguments, 0);
  for (const object of objects) {
    if (Object.getPrototypeOf(object) !== Object.prototype) continue;
    for (const key in object) {
      let variable = new types.Variable(new types.Identifier(key), new types.Identifier('any'), types.currentScope);
      variable.setVal(types.convertToBeautyType(object[key]));
      variable.toVal();
    }
  }
}), true);
unwrap.toVal();

const evalVar = new types.Variable(new types.Identifier('eval'), new types.Identifier('const'), types.globalScope, new types.NativeFunction(function(code) {
  const scope = new types.Scope(types.currentScope);
  return index.eval(code, scope);
}), true);
evalVar.toVal();

const stringVar = new types.Variable(new types.Identifier('String'), new types.Identifier('String'), types.globalScope, classes.StringWrapper, true);
stringVar.toVal();

const numberVar = new types.Variable(new types.Identifier('Number'), new types.Identifier('Number'), types.globalScope, classes.NumberWrapper, true);
numberVar.toVal();

const arrayVar = new types.Variable(new types.Identifier('Array'), new types.Identifier('Array'), types.globalScope, classes.ArrayWrapper, true);
arrayVar.toVal();

const errorVar = new types.Variable(new types.Identifier('Error'), new types.Identifier('Error'), types.globalScope, classes.ErrorWrapper, true);
errorVar.toVal();

module.exports.addPackage = (name, override, func) => {
  if (typeof override === 'function') {
    func = override;
    override = false;
  }
  if (!override && nativePackages[name]) return false;
  nativePackages[name] = func(types);
  return true;
}
