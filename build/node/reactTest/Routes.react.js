var UniJSnodeReq = require;
var requireTags, require = function(req) {
requireTags = req.split('!');
return UniJSnodeReq(requireTags.pop());
};
require.resolve = UniJSnodeReq.resolve;
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRouter = require('react-router');

var _AboutReact = require('./About.react');

var _AboutReact2 = _interopRequireDefault(_AboutReact);

var _HomeReact = require('./Home.react');

var _HomeReact2 = _interopRequireDefault(_HomeReact);

var _WrapperReact = require('./Wrapper.react');

var _WrapperReact2 = _interopRequireDefault(_WrapperReact);

console.log(_AboutReact2['default']);

console.log(_HomeReact2['default']);

console.log(_WrapperReact2['default']);

var routes = _react2['default'].createElement(
	_reactRouter.Route,
	{ handler: _WrapperReact2['default'], name: 'main', path: '/' },
	_react2['default'].createElement(_reactRouter.Route, { handler: _HomeReact2['default'], name: 'home', path: '/home' }),
	_react2['default'].createElement(_reactRouter.Route, { handler: _AboutReact2['default'], name: 'about', path: '/about' }),
	_react2['default'].createElement(_reactRouter.DefaultRoute, { handler: _HomeReact2['default'] })
);

exports['default'] = routes;
module.exports = exports['default'];