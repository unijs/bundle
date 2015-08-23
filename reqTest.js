var UniJSnodeReq = require;
var requireTags, require = function(req) {
	requireTags = req.split('!');
	return UniJSnodeReq(requireTags.pop());
};
require.resolve = UniJSnodeReq.resolve;

//var test = require('./lol.js');
//console.log(test);
var react = require('lol!react');
console.log(requireTags);
var react = require('rofl!xD!react');
console.log(requireTags);
console.log('REACT:');
for (var i in react) {
	console.log('>', i);
}
console.log(require.resolve('react'));


/*
//require('./hookcheck.js');
var nodeReq = require;

function demo(require) {
	var test = require('./lol.js');
	console.log(test);
	var react = require('react');
	console.log('REACT:');
	for (var i in react) {
		console.log('>', i);
	}
}

demo(unction(txt) {
	if (txt[0] === '.') {
		return 'TEEEEEST'
	} else {
		return nodeReq(txt);
	}
});

*/
