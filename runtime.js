'use strict';

const util = require('util');

let lineNumber = 1;

class BeautyError {
  constructor(msg) {
    this.message = msg;
    this.lineNumber = module.exports.getLineNumber();
    this.stack = `BeautyError: ${this.message}\n    at line ${this.lineNumber}`;
    //this.stack += `\nJS Trace:\n${(new Error()).stack.split('\n').slice(1).join('\n')}`;
  }
  toString() {
    return this.stack;
  }
}

class REPLError {
  constructor(msg) {
    this.message = msg;
    this.lineNumber = module.exports.getLineNumber();
    this.stack = `REPLError: ${this.message}\n    at line ${this.lineNumber}`;
  }
  toString() {
    return this.stack;
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
  toType() {
    return 'void';
  }
  toVal() {
    return null;
  }
}

function compareTypes(a, b) {
  let ret = false;
  switch (a.toType()) {
    case 'any':
      ret = true;
      break;
    case 'const':
      ret = {isConst: true};
      break;
    case 'bool':
    case 'string':
    case 'number':
    case 'void':
    case 'array':
    case 'object':
      if (b.toType() === 'any' || b.toType() === 'const') {
        ret = true;
      } else {
        ret = (a.toType() === b.toType());
      }
      break;
    default:
      ret = (b.isCompatibleWith) ? b.isCompatibleWith(a) : (a.toType() === b.toType());
      break;
  }
  return ret;
}

function unknownToType(val) {
  let ret = 'any';
  if (typeof val === 'undefined' || val === null || val === undefined) return 'void';
  switch(typeof val) {
    case 'string':
    case 'number':
      ret = typeof val;
      break;
    case 'boolean':
      ret = 'bool';
      break;
    default:
      if (Object.getPrototypeOf(val) === Object.prototype) {
        ret = 'object';
      } else if (val instanceof Array) {
        ret = 'array';
      } else {
        ret = (val.toType) ? val.toType() : 'any';
      }
      break;
  }
  return ret;
}

class Variable {
  constructor(name, type, scope, val, override) {
    this.name = name.toID(); // convert name to string, it's always an id
    this._type = type.toID() || 'any'; // convert type to string, it's always an id
    this._override = override;
    this._val = val || new NullValue();
    this._cache = undefined;
    this._scope = scope;
  }
  setVal(val) {
    const comp = compareTypes(this, val);
    if (!comp) throw new BeautyError(`Type encountered ('${(val.toType) ? val.toType() : val}') is incompatible with: '${this._type}'`);
    if (comp.isConst) throw new BeautyError(`Variable cannot be reassigned, it's a const.`);
    this._val = val;
    this._cache = undefined;
  }
  toType() {
    return this._type;
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
  toVal(args) {
    (this._scope || module.exports.currentScope).addVar(this);
    let ret;
    if (!this._override) {
      const comp = compareTypes(this, this._val);
      if (!comp) throw new BeautyError(`Type encountered ('${(this._val.toType) ? this._val.toType() : this._val}') is incompatible with: '${this._type}'`);
    }
    if (this._val instanceof FunctionCall) {
      if (this._cache === undefined) this._cache = this._val.toVal();
      ret = this._cache;
    } else {
      ret = this._val.toVal();
    }
    return ret;
  }
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
  toType() {
    return 'number';
  }
  toVal() {
    let ret = this._num;
    if (this._num.toVal) ret = this._num.toVal();
    return (new Number(ret)).valueOf();
  }
}

class BString {
  constructor(str) {
    this._str = str;
    const StringWrapperCtx = require('./classes').StringWrapper.getCtx();
    this._wrapper = {};
    for (let key in StringWrapperCtx) this._wrapper[key] = StringWrapperCtx[key]._func.bind(this);
  }
  toType() {
    return 'string';
  }
  getVal(key) {
    return convertToBeautyType(this._wrapper[key]);
  }
  toVal() {
    let ret = this._str;
    if (this._str.toVal) ret = this._str.toVal();
    return (new String(ret)).valueOf();
  }
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
  toType() {
    return this.toVar().toType();
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
  toVal() {
    let ret = this.toVar();
    return ret.toVal();
  }
}

class Block {
  constructor(stmts) {
    this._stmts = stmts;
  }
  toVal() {
    return this._stmts.toVal();
  }
}

class BFunction {
  constructor(id, params, block) {
    this._params = params;
    this._block = block;
    if (id) {
      this._id = id;
      this._var = new Variable(id, new Identifier('any'));
      this._var.setVal(this);
      this._var.toVal();
    }
  }
  toType() {
    return 'any';
  }
  toVal(args) {
    if (!args) return this;
    module.exports.currentScope = new Scope(module.exports.currentScope);
    for (let i = 0, len = this._params.length; i < len; i++) {
      const currVar = new Variable(this._params[i], new Identifier('any'));
      currVar.setVal(args[i] || new NullValue());
      currVar.toVal();
    }
    const ret = this._block.toVal();
    module.exports.currentScope = module.exports.currentScope.parent;
    return ret;
  }
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
  toType() {
    return (this._expr.toType) ? this._expr.toType() : 'any';
  }
  toVal() {
    return this._expr.toVal().toVal(this._args);
  }
}

class Operation {
  constructor(opcode, lhs, rhs) {
    this._opcode = opcode;
    this._lhs = lhs;
    this._rhs = rhs;
  }
  toType() {
    return unknownToType(this.toVal());
  }
  toVal() {
    let ret = null;
    switch(this._opcode) {
      case 0:
        // Addition
        ret = this._lhs.toVal() + this._rhs.toVal();
        break;
      case 1:
        // Subtraction
        ret = this._lhs.toVal() - this._rhs.toVal();
        break;
      case 2:
        // Multiplication
        ret = this._lhs.toVal() * this._rhs.toVal();
        break;
      case 3:
        // Division
        ret = this._lhs.toVal() / this._rhs.toVal();
        break;
      case 4:
        // Power of/to
        ret = Math.pow(this._lhs.toVal(), this._rhs.toVal());
        break;
      case 5:
        // Remainder/Modulo
        ret = this._lhs.toVal() % this._rhs.toVal();
        break;
      case 6:
        // Negation
        ret = -this._lhs.toVal();
        break;
      case 7:
        // Equality
        ret = this._lhs.toVal() === this._rhs.toVal();
        break;
      case 8:
        // And
        ret = this._lhs.toVal() && this._rhs.toVal();
        break;
      case 9:
        // Or
        ret = this._lhs.toVal() || this._rhs.toVal();
        break;
      case 10:
        // Inequality
        ret = this._lhs.toVal() !== this._rhs.toVal();
        break;
    }
    return ret;
  }
}

class Statements {
  constructor() {
    this._stmts = [];
  }
  push(val) {
    this._stmts.push(val);
  }
  toVal() {
    let ret = null;
    for (const stmt of this._stmts) ret = stmt.toVal();
    return ret;
  }
}

class Return {
  constructor(expr) {
    this._expr = expr;
  }
  toVal() {
    return this._expr.toVal();
  }
}

class Assignment {
  constructor(lhs, rhs, isAccessor) {
    this._lhs = lhs;
    this._rhs = rhs;
    this._isAccessor = isAccessor;
  }
  toVal() {
    if (this._isAccessor) {
      this._lhs.setVal(this._rhs);
    } else {
      this._lhs.toVar().setVal(this._rhs);
    }
  }
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
  toType() {
    return 'array';
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
  toVal() {
    return this._arr;
  }
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
  toType() {
    return 'object';
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
  toVal() {
    const ret = {};
    for (let i = 0, len = this._obj.length; i < len; i++) {
      let val;
      if (this._obj[i].val instanceof FunctionCall) {
        if (this._obj[i].cache === undefined) this._obj[i].cache = this._obj[i].val.toVal();
        val = this._obj[i].cache;
      } else {
        val = this._obj[i].val.toVal();
      }
      ret[this._obj[i].id.toID()] = val;
    }
    return ret;
  }
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
  toType() {
    return 'any';
  }
  toVal() {
    let key;
    if (this._idAsExpr) {
      key = this._id.toVal();
    } else {
      key = this._id.toID();
    }
    let ret = (this._expr.getVal) ? this._expr.getVal(key) : this._expr.toVal()[key];
    ret = ret || new NullValue();
    return (ret.toVal) ? ret.toVal() : ret;
  }
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
  constructor(func, raw) {
    this._func = func;
    this._raw = raw;
  }
  toType() {
    return 'any';
  }
  toVal(args) {
    if (!args) return this;
    let funcArgs = [];
    if (!this._raw) {
      for (const arg of args) funcArgs.push(convertToNativeType(arg));
    } else {
      funcArgs = args;
    }
    return convertToBeautyType(this._func.apply(this._func, funcArgs)).toVal();
  }
}

class If {
  constructor(expr, block, elseBlock) {
    this._expr = expr;
    this._block = block;
    this._else = elseBlock;
  }
  toVal() {
    let ret = null;
    if (this._expr.toVal()) {
      ret = this._block.toVal();
    } else if (this._else) {
      ret = this._else.toVal();
    }
    return ret;
  }
}

class Unless {
  constructor(expr, block, elseBlock) {
    this._expr = expr;
    this._block = block;
    this._else = elseBlock;
  }
  toVal() {
    let ret = null;
    if (!this._expr.toVal()) {
      ret = this._block.toVal();
    } else if (this._else) {
      ret = this._else.toVal();
    }
    return ret;
  }
}

class BBoolean {
  constructor(bool) {
    this._bool = bool;
  }
  toType() {
    return 'bool';
  }
  toVal() {
    return !!this._bool;
  }
}

class Class {
  constructor(id, block) {
    this._id = id;
    this._block = block;
    this._var = new Variable(id, new Identifier(this.toType()), null, this, true);
    this._var.toVal();
    this._ctx = new BObject();
  }
  toType() {
    return this._id.toID();
  }
  getVal(key) {
    return this._ctx.getVal(key) || new NullValue();
  }
  toVal(args) {
    if (!args) return this;
    module.exports.currentScope = new Scope(module.exports.currentScope);
    const stmts = this._block.toVal();
    let constructorFunc = null;
    for (const stmt of stmts) {
      if (stmt instanceof ClassFunction) {
        module.exports.currentScope.addVar(stmt._var);
      } else {
        stmt.toVal();
      }
    }
    let vars = module.exports.currentScope.getAllVars();
    for (const varName in vars) {
      if (varName === 'constructor') {
        constructorFunc = vars[varName];
      } else if (varName !== 'this') {
        if (vars[varName].toVal() instanceof ClassFunction) vars[varName].toVal().setCtx(this._ctx);
        this._ctx.add(new Identifier(varName), vars[varName]);
      }
    }
    if (constructorFunc) {
      constructorFunc.toVal().setCtx(this._ctx);
      constructorFunc.toVal().toVal(args);
    }
    module.exports.currentScope = module.exports.currentScope.parent;
    return this._ctx.toVal();
  }
}

class ClassStatements {
  constructor() {
    this._stmts = [];
  }
  push(val) {
    this._stmts.push(val);
  }
  toVal() {
    return this._stmts;
  }
}

class ClassBlock {
  constructor(stmts) {
    this._stmts = stmts;
  }
  toVal() {
    return this._stmts.toVal();
  }
}

class ClassVariable {
  constructor(name, type, scope) {
    this.name = name.toID(); // convert name to string, it's always an id
    this._val = new NullValue();
    this._type = type.toID() || '*'; // convert type to string, it's always an id
    this._scope = scope;
  }
  toType() {
    return this._type;
  }
  setVal(val) {
    const comp = compareTypes(this, val);
    if (!comp) throw new BeautyError(`Type encountered is incompatible with: '${this._type}'`);
    this._val = val;
    this._cache = undefined;
  }
  toIntermediate() {
    return this._val;
  }
  toVal(args) {
    (this._scope || module.exports.currentScope).addVar(this);
    return this._val.toVal();
  }
}

class ClassAssignment {
  constructor(lhs, rhs, isAccessor) {
    this._lhs = lhs;
    this._rhs = rhs;
    this._isAccessor = isAccessor;
  }
  toVal() {
    if (this._isAccessor) {
      this._lhs.setVal(this._rhs);
    } else {
      this._lhs.toVar().setVal(this._rhs);
    }
  }
}

class ClassFunction {
  constructor(id, params, block) {
    this._params = params;
    this._block = block;
    this._id = id;
    this._var = new Variable(id, new Identifier('any'), null, this, true);
    this._ctx = null;
  }
  toType() {
    return 'any';
  }
  setCtx(obj) {
    this._ctx = obj;
  }
  toVal(args) {
    if (!args) return this;
    module.exports.currentScope = new Scope(module.exports.currentScope);
    const thisVar = new Variable(new Identifier('this'), new Identifier('const'), module.exports.currentScope, this._ctx, true);
    thisVar.toVal();
    for (let i = 0, len = this._params.length; i < len; i++) {
      const currVar = new Variable(this._params[i], new Identifier('any'));
      currVar.setVal(args[i] || new NullValue());
      currVar.toVal();
    }
    const ret = this._block.toVal();
    module.exports.currentScope = module.exports.currentScope.parent;
    return ret;
  }
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
  toType() {
    return this._expr.toType();
  }
  toVal() {
    return this._expr.toVal();
  }
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
  toVal(args) {
    if (!args) return this;
    const funcArgs = [];
    for (const arg of args) funcArgs.push(convertToNativeType(arg));
    this._constr.apply(this._ctx, funcArgs);
    return this._ctx;
  }
}

class NativeClassFunction {
  constructor(func) {
    this._func = func;
    this._ctx = null;
  }
  setCtx(ctx) {
    this._ctx = ctx;
  }
  toVal(args) {
    if (!args) return this;
    const funcArgs = [];
    for (const arg of args) funcArgs.push(convertToNativeType(arg));
    return convertToBeautyType(this._func.apply(this._ctx, funcArgs)).toVal();
  }
}

class Range {
  constructor(start, end, includesEnd) {
    this._start = start;
    this._end = end;
    this._withEnd = includesEnd;
    this._arr = new BArray();
  }
  toType() {
    return 'array';
  }
  getVal(key) {
    return this._arr.getVal(key);
  }
  toVal() {
    let len = (this._withEnd) ? this._end.toVal() + 1 : this._end.toVal();
    for (let i = this._start.toVal(), j = 0; i < len; i++, j++) this._arr.setVal(j, convertToBeautyType(i));
    return this._arr.toVal();
  }
}

class For {
  constructor(type, id, expr, block) {
    this._type = type;
    this._id = id;
    this._expr = expr;
    this._block = block;
  }
  toVal() {
    const exprVal = this._expr.toVal();
    if (this._type === 0) {
      // of loop
      for (let i in exprVal) {
        module.exports.currentScope = new Scope(module.exports.currentScope);
        const variable = new Variable(this._id, new Identifier('any'));
        variable.setVal(convertToBeautyType(exprVal[i]));
        variable.toVal();
        this._block.toVal();
        module.exports.currentScope = module.exports.currentScope.parent;
      }
    } else {
      // in loop
      for (let i in exprVal) {
        module.exports.currentScope = new Scope(module.exports.currentScope);
        const variable = new Variable(this._id, new Identifier('any'));
        variable.setVal(convertToBeautyType(i));
        variable.toVal();
        this._block.toVal();
        module.exports.currentScope = module.exports.currentScope.parent;
      }
    }
  }
}

class While {
  constructor(expr, block) {
    this._expr = expr;
    this._block = block;
  }
  toVal() {
    module.exports.currentScope = new Scope(module.exports.currentScope);
    while (this._expr.toVal()) this._block.toVal();
    module.exports.currentScope = module.exports.currentScope.parent;
  }
}

class Until {
  constructor(expr, block) {
    this._expr = expr;
    this._block = block;
  }
  toVal() {
    module.exports.currentScope = new Scope(module.exports.currentScope);
    while (!this._expr.toVal()) this._block.toVal();
    module.exports.currentScope = module.exports.currentScope.parent;
  }
}

class VarOperation {
  constructor(type, lhs, rhs) {
    this._type = type;
    this._lhs = lhs;
    this._rhs = rhs;
  }
  toType() {
    return 'any';
  }
  toVal() {
    let lhs = this._lhs;
    if (this._lhs instanceof Identifier) lhs = this._lhs.toVar();
    switch(this._type) {
      case 0:
        lhs.setVal(convertToBeautyType(this._lhs.toVal() + this._rhs.toVal()));
        break;
      case 1:
        lhs.setVal(convertToBeautyType(this._lhs.toVal() - this._rhs.toVal()));
        break;
      case 2:
        lhs.setVal(convertToBeautyType(this._lhs.toVal() + 1));
        break;
      case 3:
        lhs.setVal(convertToBeautyType(this._lhs.toVal() - 1));
        break;
    }
    return null;
  }
}

class Throw {
  constructor(err) {
    this._err = err;
  }
  toVal() {
    let thrw = this._err.toVal();
    if (thrw.message) thrw = new Error(thrw.message);
    throw thrw;
    return null;
  }
}

class Try {
  constructor(tryBlk, catchId, catchBlk) {
    this._block = tryBlk;
    this._id = catchId;
    this._block2 = catchBlk;
  }
  toVal() {
    let ret = null;
    try {
      ret = this._block.toVal();
    } catch(err) {
      if (this._id && this._block2) {
        const eVar = new Variable(this._id, new Identifier('any'));
        eVar.setVal(convertToBeautyType(err));
        eVar.toVal();
        ret = this._block2.toVal();
      }
    }
    return ret;
  }
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
  BeautyError: BeautyError,
  REPLError: REPLError,
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
