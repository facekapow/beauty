'use strict';

module.exports = {
  pi: 4*((4*Math.atan(1/5))-(Math.atan(1/239))), // more accurate than Math.PI
  tan: Math.tan,
  atan: Math.atan,
  random: function(min, max) {
    if (!min && min !== 0) min = 0;
    if (!max && max !== 0) max = 10;
    return Math.floor(Math.random()*(max-min+1)+min);
  },
  floor: Math.floor
}
