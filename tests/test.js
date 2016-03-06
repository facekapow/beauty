'use strict';

const beauty = require('../');
const fs = require('fs');
const colors = require('colors/safe');

beauty.exposePackage('test', types => desc => {
  process.stdout.write(`test - ${desc}\n`);
  let current = 1;
  return {
    'case': function(func) {
      process.stdout.write(`  * case ${current} - `);
      func(function(passMsg) {
        process.stdout.write(colors.green('pass\n'));
        if (passMsg) process.stdout.write(`    ${passMsg}\n`);
        current++;
      }, function(errMsg) {
        process.stdout.write(colors.red('fail\n'));
        if (errMsg) process.stdout.write(`    ${errMsg}\n`);
        current++;
      }, function(warnMsg) {
        process.stdout.write(colors.yellow('warn\n'));
        if (warnMsg) process.stdout.write(`    ${warnMsg}\n`);
        current++;
      });
    }
  }
});

beauty.parse(fs.readFileSync(`${__dirname}/test.beau`), `${__dirname}/test.beau`);
