import React from 'react';
import {
	Route,
	DefaultRoute
} from 'react-router';

import About from './About.react';
console.log(About);
import Home from './Home.react';
console.log(Home);
import Wrapper from './Wrapper.react';
console.log(Wrapper);

var routes = (
	<Route handler={Wrapper} name="main" path="/">
		<Route handler={Home} name="home" path="/home"/>
		<Route handler={About} name="about" path="/about"/>
		<DefaultRoute handler={Home}/>
	</Route>
);

export
default routes;
