'use strict';

'use strict';

const util = require('util');

let lineNumber = 1;
let cppCont = ```#include <stdio.h>
int main(int _AT_argc, char** _AT_argv) {
```;

class BeautyError {
  constructor(msg) {
    this.message = msg;
    this.lineNumber = lineNumber;
  }
  toString() {
    return `BeautyError: ${this.message}\n  at line ${this.lineNumber}`;
  }
}

class Scope {
  constructor(parent) {
    this._vars = {};
    this.parent = parent || null;
  }
  getVar(name) {
    let ret = this._vars[name];
    if ((ret === undefined || typeof ret === 'undefined') && this.parent) ret = this.parent.getVar(name);
    return ret;
  }
  getAllVars() {
    return this._vars;
  }
  deleteVar(name) {
    this._vars[name] = undefined;
  }
  addVar(variable) {
    this._vars[variable.name] = variable;
  }
}

const globalScope = new Scope();
let currentScope = globalScope;

class NullValue {
  constructor() {}
  toVal() {}
}

class Variable {
  constructor(name, type, scope) {
    this.name = name.toID(); // convert name to string, it's always an id
    this._val = new NullValue();
    this._type = type.toID() || '*'; // convert type to string, it's always an id
    this._scope = scope;
    this._cache = undefined;
  }
  setVal(val) {
    this._val = val;
    this._cache = undefined;
  }
  getVal(key) {
    let ret;
    if (this._val.getVal) {
      ret = this._val.getVal(key);
      if (ret === null || ret === undefined) {
        let val = this._val;
        if (this._val instanceof FunctionCall) {
          if (this._cache === undefined) this._cache = this._val.toVal();
          val = this._cache;
        } else {
          val = this._val.toVal();
        }
        ret = val[key];
      }
    } else {
      let val = this._val;
      if (this._val instanceof FunctionCall) {
        if (this._cache === undefined) this._cache = this._val.toVal();
        val = this._cache;
      } else {
        val = this._val.toVal();
      }
      ret = val[key];
    }
    ret = ret || new NullValue();
    return (ret.toVal) ? ret.toVal() : ret;
  }
  toIntermediate() {
    return this._val;
  }
  toVal(args) {}
}

class BNumber {
  constructor(num) {
    this._num = num;
    const NumberWrapperCtx = require('./classes').NumberWrapper.getCtx();
    this._wrapper = {};
    for (let key in NumberWrapperCtx) this._wrapper[key] = NumberWrapperCtx[key]._func.bind(this);
  }
  getVal(key) {
    return convertToBeautyType(this._wrapper[key]);
  }
  toVal() {}
}

class BString {
  constructor(str) {
    this._str = str;
    const StringWrapperCtx = require('./classes').StringWrapper.getCtx();
    this._wrapper = {};
    for (let key in StringWrapperCtx) this._wrapper[key] = StringWrapperCtx[key]._func.bind(this);
  }
  getVal(key) {
    return convertToBeautyType(this._wrapper[key]);
  }
  toVal() {}
}

class Identifier {
  constructor(id) {
    this._id = id;
    this._origScope = module.exports.currentScope;
  }
  toID() {
    return this._id;
  }
  toIntermediate() {
    return this.toVar().toIntermediate();
  }
  getVal(key) {
    const variable = this.toVar();
    let ret;
    if (variable.getVal) {
      ret = variable.getVal(key);
      ret = ret || variable.toVal()[key]
    } else {
      ret = variable.toVal()[key];
    }
    ret = ret || new NullValue();
    return (ret.toVal) ? ret.toVal() : ret;
  }
  toVar() {
    let variable = module.exports.currentScope.getVar(this._id);
    if (!variable) variable = this._origScope.getVar(this._id);
    if (!variable) throw new BeautyError(`No such variable: '${this._id}'`);
    return variable;
  }
  toVal() {}
}

class Block {
  constructor(stmts) {
    this._stmts = stmts;
  }
  toVal() {}
}

class BFunction {
  constructor(id, params, block) {
    this._params = params;
    this._block = block;
    if (id) {
      this._id = id;
      this._var = new Variable(id, new Identifier('func'));
      this._var.setVal(this);
      this._var.toVal();
    }
  }
  toVal(args) {}
}

class FunctionCall {
  constructor(expr, args) {
    this._expr = expr;
    this._args = args;
  }
  /*getVal(key) {
    let ret;
    if (this._expr.getVal) {
      ret = this._expr.getVal(key);
      ret = ret || this.toVal()[key]
    } else {
      ret = this.toVal()[key];
    }
    ret = ret || new NullValue();
    return (ret.toVal) ? ret.toVal() : ret;
  }*/
  toVal() {}
}

class Operation {
  constructor(opcode, lhs, rhs) {
    this._opcode = opcode;
    this._lhs = lhs;
    this._rhs = rhs;
  }
  toVal() {}
}

class Statements {
  constructor() {
    this._stmts = [];
  }
  push(val) {
    this._stmts.push(val);
  }
  toVal() {}
}

class Return {
  constructor(expr) {
    this._expr = expr;
  }
  toVal() {}
}

class Assignment {
  constructor(lhs, rhs, isAccessor) {
    this._lhs = lhs;
    this._rhs = rhs;
    this._isAccessor = isAccessor;
  }
  toVal() {}
}

class BArray {
  constructor() {
    this._arr = [];
    const ArrayWrapperCtx = require('./classes').ArrayWrapper.getCtx();
    this._wrapper = {};
    for (let key in ArrayWrapperCtx) this._wrapper[key] = ArrayWrapperCtx[key]._func.bind(this);
  }
  getVal(id) {
    let ret;
    if (!Number.isNaN(parseInt(id))) {
      ret = this._arr[id];
    } else {
      ret = this._wrapper[id];
    }
    return convertToBeautyType(ret);
  }
  toIntermediate() {
    return this;
  }
  setVal(id, val) {
    this._arr[id] = convertToNativeType(val);
  }
  add(item) {
    this._arr.push(convertToNativeType(item));
  }
  toVal() {}
}

class BObject {
  constructor() {
    this._obj = [];
  }
  add(id, val) {
    let obj = {
      id: id,
      val: val,
      cache: undefined
    }
    if (obj.val instanceof FunctionCall) obj.cache = obj.val.toVal();
    this._obj.push(obj);
  }
  getVal(id) {
    for (let i = 0, len = this._obj.length; i < len; i++) {
      if (this._obj[i].id.toID() === id) {
        let val;
        if (this._obj[i].val instanceof FunctionCall) {
          if (this._obj[i].cache === undefined) this._obj[i].cache = this._obj[i].val.toVal();
          val = convertToBeautyType(this._obj[i].cache);
        } else {
          val = this._obj[i].val;
        }
        return val;
      }
    }
    return new NullValue();
  }
  toIntermediate() {
    return this;
  }
  setVal(id, val) {
    let found = false;
    for (let i = 0, len = this._obj.length; i < len; i++) {
      if (this._obj[i].id === id) {
        this._obj[i].val = val;
        if (this._obj[i].val instanceof FunctionCall) this._obj[i].cache = this._obj[i].val.toVal();
        found = true;
        break;
      }
    }
    if (!found) this.add(id, val);
    return null;
  }
  toVal() {}
}

class Accessor {
  constructor(expr, id, idIsExpr) {
    this._expr = expr;
    this._id = id;
    this._idAsExpr = idIsExpr;
  }
  toIntermediate() {
    return this._expr.toIntermediate().getVal(this._id);
  }
  setVal(val) {
    let ret = this._expr.toIntermediate().setVal(this._id, val);
    return ret;
  }
  toVal() {}
}

function convertToBeautyType(val, ctx) {
  let tmp = val;
  if (val === undefined || val === null) return new NullValue();
  if (val instanceof Array) {
    tmp = new BArray();
    for (const i in val) tmp.add(convertToBeautyType(val[i], ctx));
  } else if (typeof val === 'string' || val instanceof String) {
    tmp = new BString(val);
  } else if (typeof val === 'number' || val instanceof Number) {
    tmp = new BNumber(val);
  } else if (typeof val === 'function' || val instanceof Function) {
    if (ctx) {
      tmp = new NativeClassFunction(val);
      tmp.setCtx(ctx);
    } else {
      tmp = new NativeFunction(val);
    }
  } else if (typeof val === 'boolean' || val instanceof Boolean) {
    tmp = new BBoolean(val);
  } else if (val instanceof Error) {
    tmp = new BObject();
    tmp.add(new Identifier('message'), convertToBeautyType(val.message, ctx));
  } else if (Object.getPrototypeOf(val) === Object.prototype) {
    tmp = new BObject();
    for (const key in val) tmp.add(new Identifier(key), convertToBeautyType(val[key], ctx));
  }
  return tmp;
}

function convertToNativeType(val) {
  let tmp = val;
  if (val === undefined) tmp = null;
  if (val instanceof BFunction || val instanceof NativeFunction) {
    tmp = function() {
      const args = Array.prototype.slice.call(arguments, 0);
      const funcArgs = [];
      for (const arg of args) funcArgs.push(convertToBeautyType(arg));
      return val.toVal(funcArgs);
    }
  } else {
    for (let key in classes) {
      if (val instanceof module.exports[key]) tmp = val.toVal();
    }
  }
  return tmp;
}

class NativeFunction {
  constructor(func) {
    this._func = func;
  }
  toVal(args) {}
}

class If {
  constructor(expr, block, elseBlock) {
    this._expr = expr;
    this._block = block;
    this._else = elseBlock;
  }
  toVal() {}
}

class Unless {
  constructor(expr, block, elseBlock) {
    this._expr = expr;
    this._block = block;
    this._else = elseBlock;
  }
  toVal() {}
}

class BBoolean {
  constructor(bool) {
    this._bool = bool;
  }
  toVal() {}
}

class Class {
  constructor(id, block) {
    this._id = id;
    this._block = block;
    this._var = new Variable(id, new Identifier('const'), null, this);
    this._var.toVal();
    this._ctx = new BObject();
  }
  toType() {
    return this._id.toID();
  }
  getVal(key) {
    return this._ctx.getVal(key) || new NullValue();
  }
  toVal(args) {}
}

class ClassStatements {
  constructor() {
    this._stmts = [];
  }
  push(val) {
    this._stmts.push(val);
  }
  toVal() {}
}

class ClassBlock {
  constructor(stmts) {
    this._stmts = stmts;
  }
  toVal() {}
}

class ClassVariable {
  constructor(name, type, scope) {
    this.name = name.toID(); // convert name to string, it's always an id
    this._val = new NullValue();
    this._type = type.toID() || '*'; // convert type to string, it's always an id
    this._scope = scope;
  }
  setVal(val) {
    this._val = val;
  }
  toIntermediate() {
    return this._val;
  }
  toVal(args) {}
}

class ClassAssignment {
  constructor(lhs, rhs, isAccessor) {
    this._lhs = lhs;
    this._rhs = rhs;
    this._isAccessor = isAccessor;
  }
  toVal() {}
}

class ClassFunction {
  constructor(id, params, block) {
    this._params = params;
    this._block = block;
    this._id = id;
    this._var = new Variable(id, new Identifier('func'));
    this._var.setVal(this);
    this._ctx = null;
  }
  setCtx(obj) {
    this._ctx = obj;
  }
  toVal(args) {}
}

class New { // new/create is just syntactic sugar, so programmers know what is a class
  constructor(expr) {
    this._expr = expr;
  }
  getVal(key) {
    let ret;
    if (this._expr.getVal) {
      ret = this._expr.getVal(key);
      ret = ret || this_expr.toVal()[key]
    } else {
      ret = this._expr.toVal()[key];
    }
    ret = ret || new NullValue();
    return (ret.toVal) ? ret.toVal() : ret;
  }
  toVal() {}
}

class NativeClass {
  constructor(id, constr, ctx) {
    this._id = id;
    this._constr = constr;
    this._ctx = ctx || {};
  }
  setMethod(name, func) {
    this._ctx[name] = new NativeClassFunction(func);
    this._ctx[name].setCtx(this._ctx);
  }
  getCtx() {
    return this._ctx;
  }
  makeInstance() {
    return new NativeClass(this._id, this._constr, this._ctx);
  }
  toType() {
    return this._id;
  }
  getVal(key) {
    return this._ctx[key] || new NullValue();
  }
  toVal(args) {}
}

class NativeClassFunction {
  constructor(func) {
    this._func = func;
    this._ctx = null;
  }
  setCtx(ctx) {
    this._ctx = ctx;
  }
  toVal(args) {}
}

class Range {
  constructor(start, end, includesEnd) {
    this._start = start;
    this._end = end;
    this._withEnd = includesEnd;
    this._arr = new BArray();
  }
  getVal(key) {
    return this._arr.getVal(key);
  }
  toVal() {}
}

class For {
  constructor(type, id, expr, block) {
    this._type = type;
    this._id = id;
    this._expr = expr;
    this._block = block;
  }
  toVal() {}
}

class While {
  constructor(expr, block) {
    this._expr = expr;
    this._block = block;
  }
  toVal() {}
}

class Until {
  constructor(expr, block) {
    this._expr = expr;
    this._block = block;
  }
  toVal() {}
}

class VarOperation {
  constructor(type, lhs, rhs) {
    this._type = type;
    this._lhs = lhs;
    this._rhs = rhs;
  }
  toVal() {}
}

class Throw {
  constructor(err) {
    this._err = err;
  }
  toVal() {}
}

class Try {
  constructor(tryBlk, catchId, catchBlk) {
    this._block = tryBlk;
    this._id = catchId;
    this._block2 = catchBlk;
  }
  toVal() {}
}

const classes = {
  BNumber: BNumber,
  BString: BString,
  Identifier: Identifier,
  Variable: Variable,
  Block: Block,
  BFunction: BFunction,
  FunctionCall: FunctionCall,
  Operation: Operation,
  Statements: Statements,
  Return: Return,
  Assignment: Assignment,
  NullValue: NullValue,
  BArray: BArray,
  BObject: BObject,
  Accessor: Accessor,
  NativeFunction: NativeFunction,
  If: If,
  Unless: Unless,
  BBoolean: BBoolean,
  Scope: Scope,
  Class: Class,
  ClassStatements: ClassStatements,
  ClassBlock: ClassBlock,
  ClassVariable: ClassVariable,
  ClassAssignment: ClassAssignment,
  ClassFunction: ClassFunction,
  New: New,
  NativeClass: NativeClass,
  NativeClassFunction: NativeClassFunction,
  Range: Range,
  For: For,
  While: While,
  Until: Until,
  VarOperation: VarOperation,
  Throw: Throw,
  Try: Try
}

module.exports = {
  BNumber: BNumber,
  BString: BString,
  Identifier: Identifier,
  Variable: Variable,
  Block: Block,
  BFunction: BFunction,
  FunctionCall: FunctionCall,
  Operation: Operation,
  Statements: Statements,
  Return: Return,
  Assignment: Assignment,
  NullValue: NullValue,
  BArray: BArray,
  BObject: BObject,
  Accessor: Accessor,
  globalScope: globalScope,
  NativeFunction: NativeFunction,
  If: If,
  Unless: Unless,
  BBoolean: BBoolean,
  Scope: Scope,
  currentScope: globalScope,
  Class: Class,
  ClassStatements: ClassStatements,
  ClassBlock: ClassBlock,
  ClassVariable: ClassVariable,
  ClassAssignment: ClassAssignment,
  ClassFunction: ClassFunction,
  New: New,
  convertToNativeType: convertToNativeType,
  convertToBeautyType: convertToBeautyType,
  NativeClass: NativeClass,
  NativeClassFunction: NativeClassFunction,
  Range: Range,
  For: For,
  While: While,
  Until: Until,
  VarOperation: VarOperation,
  Throw: Throw,
  Try: Try,
  currentLine: () => lineNumber++,
  getLineNumber: () => lineNumber
}
