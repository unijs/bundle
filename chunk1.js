deps[0] = function(require, module, exports) {

// MAIN
require('./first.js');
require('./second.js');
require('./lib.js');

};
deps[1] = function(require, module, exports) {

// FIRST
require('./lib.js');
require('./third.js');

};
deps[2] = function(require, module, exports) {

// SECOND
require('./lib.js');
require('./third.js');

};
deps[3] = function(require, module, exports) {

// LIB

};
deps[4] = function(require, module, exports) {

// THIRD
require('./lib.js');

};
