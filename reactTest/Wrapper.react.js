import React from 'react';

import {
	RouteHandler
} from 'react-router';

class Wrapper extends React.Component {
	render() {
		return (
			<div style={{textAlign: 'center', fontFamily: 'Helvetica, Arial'}}>
				<a href="/">
					<img height="100" src="https://avatars0.githubusercontent.com/u/13003405?v=3&s=200" width="100"></img>
				</a>
				<br/>
				<h1>UniJS Bundle Demo</h1>
				<br/>
				<hr style={{border: '0', height: '1px', background: '#e2e2e2'}}/>
				<RouteHandler/>
			</div>
		);
	}
}
export
default Wrapper;
