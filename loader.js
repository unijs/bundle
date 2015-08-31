var detective = require('detective');
var fs = require('fs');
var path = require('path');

var core = require('./coreModules.json');

var resolve = function(id) {
	try {
		return require.resolve(id);
	} catch (e) {
		//console.log("Error when analysing '" + id + "'");
		throw e;
	}
}

var checkPackage = function(id, dep) {
	try {
		pack = require(path.resolve(id, 'package.json'));
		if (pack.browser != null) {
			switch (typeof pack.browser) {
				case 'string':
					return [{
						id: resolve(path.resolve(id, pack.browser)),
						use: {
							client: true,
							node: false
						}
					}, {
						id: resolve(path.resolve(id, pack.main)),
						use: {
							client: false,
							node: true
						}
					}];
					break;
				case 'object':
					if (pack.browser[pack.main] != null) {
						return [{
							id: resolve(path.resolve(id, pack.main)),
							use: {
								client: false,
								node: true
							},
							browser: pack.browser
						}, {
							id: resolve(path.resolve(id, pack.browser[pack.main])),
							use: {
								client: true,
								node: false
							},
							browser: pack.browser
						}];
					} else {
						return [{
							id: resolve(path.resolve(id, pack.main)),
							use: {
								client: true,
								node: true
							},
							browser: pack.browser
						}];
					}
					break;
				default:
					var e = new Error('Invalid type of browser field!');
					console.log("Error when analysing '" + id + "'");
					throw e;
			}
		} else {
			return [{
				id: resolve(path.resolve(id, pack.main)),
				use: {
					client: true,
					node: true
				}
			}];
		}
	} catch (e) {
		return [{
			id: resolve(id),
			use: {
				client: true,
				node: true
			}
		}];
	}
}

var getDependency = function(dep, file) {
	var node_module = dep.node_module;
	var tags = file.split('!');
	var name = tags.pop();
	var beforeSplitted = dep.id.split('/');
	beforeSplitted.pop();
	var before = beforeSplitted.join('/');
	var id = name,
		deps = [];
	if(core[name] === true){
		return [];
	}
	if (name[0] === '/' || (name[0] === '.' && (name[1] === '/' || (name[1] === '.' && name[2] === '/')))) {
		deps = checkPackage(path.resolve(before, id), dep, before);
	} else {
		node_module = true;
		var toCheck, basePath = beforeSplitted.join('/');
		while (true) {
			toCheck = path.resolve(basePath, 'node_modules', id);
			try {
				//id = require.resolve(toCheck);
				deps = checkPackage(toCheck, dep, before);
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
						var e = new Error('Failed to resolve module ' + name);
						console.log("Error when analysing '" + dep.id + "'");
						throw e;
					}
				}
			}
		}
	}
	for (var i in deps) {
		deps[i].tags = tags;
		deps[i].node_module = node_module;
		deps[i].package = dep.package;
		deps[i].packages = dep.packages;
		deps[i].swap = false;
	}
	return deps;
	/*return {
		id: id,
		tags: tags,
		node_module: node_module,
		package: dep.package,
		packages: dep.packages,
		swap: false
	};*/
	//entryFile(id, tags, node_module, deep, started);
}

var getDependenciesAndSource = function(dep, transformers, done) {
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
			var reqs = detective(dep.src);
		} catch (e) {
			console.log('Error when running detective on ', dep.id);
			throw e;
		}
		dep.deps = [];
		dep.requires = [];

		for (var i in reqs) {
			var temp_deps = getDependency(dep, reqs[i]);
			for (var j in temp_deps) {
				dep.deps.push(temp_deps[j]);
				dep.requires.push(reqs[i]);
			}
			//console.log(temp_deps);
		}

		done(null, dep);
	});
}


var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}


module.exports = getDependenciesAndSource;
