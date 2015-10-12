var path = require('path');
var unijsBundle = require('./index.js');

unijsBundle({
	entryFile: require.resolve(path.join(__dirname, 'reactTest', 'main.js')),
	swappers: [{
		tags: ['split'],
		module: require.resolve('./test/replacement.js')
	}],
	transformers: [require.resolve('./babelTransformer.js')]
});


/*unijsBundle({
	entryFile: require.resolve(path.join(__dirname, 'soi.js'))
	/*swappers: [{
		tags: ['split'],
		module: require.resolve('./test/replacement.js')
	}],
	transformers: [require.resolve('./babelTransformer.js')]*
});*/
