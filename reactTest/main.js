var React = require('react');
var Router = require('react-router');
var routes = require('./Routes.react.js');
window.onload = function() {
	Router.run(routes, Router.Location, function(Handler) {
		React.render(<Handler/> , document.getElementById('main'));
	});
};
