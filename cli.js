#!/usr/bin/env node
'use strict';

const parser = require('./beauty').parser;
const types = require('./runtime');
parser.yy = types;
const native = require('./native');
const fs = require('fs');
const path = require('path');
const beauty = require('./');
const program = require('commander');

// defs
let shouldREPL = true;
const processInput = (input, scope) => {
  try {
    const result = beauty.eval(input, scope);
    if (!shouldREPL) process.stdout.write('result: ');
    console.log(result);
  } catch(e) {
    /*if (e.stack) {
      console.log(e.stack);
    } else if (e.message) {
      console.log(e.message);
    } else {
      console.log(e);
    }*/
    if (!(e instanceof types.BeautyError)) {
      console.log(e);
      console.error((new types.BeautyError('Parse error.')).stack);
    } else {
      console.error(e.stack);
    }
    shouldREPL = true;
  } finally {
    if (!shouldREPL) process.exit(0);
  }
}

const commands = {
  exit: function() {
    process.exit(0);
  }
}

program
  .version('1.0.0')
  .usage('[options] [file]')
  .parse(process.argv);

if (program.args.length > 0) {
  // process file
  let fp = program.args[0];
  if (!path.isAbsolute(fp)) fp = path.join(process.cwd(), fp);
  beauty.parse(fs.readFileSync(fp), fp);
} else {
  shouldREPL = true;
  const scope = new types.Scope(types.globalScope);
  const atFile = new types.Variable(new types.Identifier('@file'), new types.Identifier('const'), scope, new types.BString('@special_repl@'), true);
  const atDir = new types.Variable(new types.Identifier('@dir'), new types.Identifier('const'), scope, new types.BString(process.cwd()), true);
  atFile.toVal();
  atDir.toVal();
  const BPackage = new types.BObject();
  const packageVar = new types.Variable(new types.Identifier('package'), new types.Identifier('any'), scope);
  packageVar.setVal(BPackage);
  packageVar.toVal();
  // setup REPL
  const readline = require('readline-sync');
  readline.promptLoop((line) => {
    if (line.substr(0, 1) === '.') {
      let command = commands[line.substr(1)];
      if (!command) {
        console.error((new types.REPLError(`REPL keyword (\'${line.substr(1)}\') not found.`)).stack);
      } else {
        command.apply(command, line.split(' ').slice(1));
      }
    } else {
      processInput(line, scope);
    }
    types.currentLine();
  }, {
    prompt: 'b> ',
    keepWhitespace: true
  });
}
