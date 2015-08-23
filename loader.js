var detective = require('detective');
var fs = require('fs');
var path = require('path');

var getDependency = function(dep, file) {
	var node_module = dep.node_module;
	var tags = file.split('!');
	var name = tags.pop();
	var beforeSplitted = dep.id.split('/');
	beforeSplitted.pop();
	var before = beforeSplitted.join('/');
	var id = name;
	if (name[0] === '/' || (name[0] === '.' && (name[1] === '/' || (name[1] === '.' && name[2] === '/')))) {
		try {
			id = require.resolve(path.resolve(before, id));
		} catch (e) {
			console.log("Error when analysing '" + dep.id + "'");
			throw e;
		}
	} else {
		node_module = true;
		var toCheck, basePath = beforeSplitted.join('/');
		while (true) {
			toCheck = path.resolve(basePath, 'node_modules', id);
			try {
				id = require.resolve(toCheck);
				break;
			} catch (e) {
				if (beforeSplitted.length > 2) {
					beforeSplitted.pop();
					basePath = beforeSplitted.join('/');
				} else {
					if (beforeSplitted.length > 1) {
						beforeSplitted.pop();
						basePath = '/';
					} else {
						return {
							error: new Error('Failed to resolve module ' + name)
						}
					}
				}
			}
		}
	}
	return {
		id: id,
		tags: tags,
		node_module: node_module,
		package: dep.package,
		packages: dep.packages,
		swap: false
	};
	//entryFile(id, tags, node_module, deep, started);
}

var getDependenciesAndSource = function(dep, transformers, done, nodeExportCallback) {
	var transformers = transformers || [];

	fs.readFile(dep.id, {
		encoding: 'utf-8'
	}, function(err, src) {
		if (err) {
			throw err;
		}

		dep.src = src;

		if (dep.node_module === false) {
			for (var i = 0; i < transformers.length; i++) {
				try {
					dep.src = transformers[i](dep);
				} catch (e) {
					console.log('Error when running transformer', i, 'on ', dep.id);
					throw e;
				}
			}
		}
		
		try {
			dep.requires = detective(dep.src);
		} catch (e) {
			console.log('Error when running detective on ', dep.id);
			throw e;
		}
		dep.deps = [];

		for (var i in dep.requires) {
			var temp_dep = getDependency(dep, dep.requires[i]);
			if (temp_dep.error != null) {
				return done(temp_dep.error);
			}
			dep.deps.push(temp_dep);
		}

		done(null, dep);
	});
}


var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}


module.exports = getDependenciesAndSource;
