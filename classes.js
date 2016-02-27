'use strict';

const types = require('./runtime');

const StringWrapper = new types.NativeClass('String', function(str) {
  this._str = String(str);
});
StringWrapper.setMethod('substring', function(start, length) {
  return this._str.substr(start, length);
});
StringWrapper.setMethod('length', function() {
  return this._str.length;
});
StringWrapper.setMethod('whereIs?', function(substr) {
  let ret = this._str.indexOf(substr);
  if (ret === -1) ret = null;
  return ret;
});
StringWrapper.setMethod('toArray', function(delim) {
  return this._str.split(delim);
});

const NumberWrapper = new types.NativeClass('Number', function(num) {
  this._num = Number(num);
});
NumberWrapper.setMethod('subnumber', function(start, length) {
  return Number(String(this._num).substr(-start, length));
});
NumberWrapper.setMethod('digitLength', function() {
  return String(this._num).replace(/\./g, '').split('').length;
});
NumberWrapper.setMethod('digits', function() {
  return String(this._num).replace(/\./g, '').split('');
});

const ArrayWrapper = new types.NativeClass('Array', function(arr) {
  this._arr = arr;
});
ArrayWrapper.setMethod('length', function() {
  return this._arr.length;
});
ArrayWrapper.setMethod('has?', function(val) {
  let ret = false;
  if (this._arr.indexOf(val) !== -1) ret = true;
  return ret;
});
ArrayWrapper.setMethod('add', function(item) {
  this._arr.push(item);
});

const ErrorWrapper = new types.NativeClass('Error', function(message) {
  this.message = message;
});

module.exports = {
  StringWrapper: StringWrapper,
  NumberWrapper: NumberWrapper,
  ArrayWrapper: ArrayWrapper,
  ErrorWrapper: ErrorWrapper
}
