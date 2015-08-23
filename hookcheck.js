var hook = require('node-hook');

function logLoadedFilename(source, filename) {
	console.log('> REQ > ', filename);
	return 'console.log("> LOA > ", "' + filename + '");\n' + source;
}
hook.hook('.js', logLoadedFilename);
