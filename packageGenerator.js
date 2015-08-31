var fs = require('fs-extra');
var path = require('path');
var nodeExport = require('./nodeExport.js');

var packages = {};
var packageCounter = 0;
var sources = {};
var buildpath;
var buildpathWeb;
var buildpathNode;

var writeDependencyToStream = function(pkg, dep) {
	sources[dep.id].inPack = pkg.id;
	if (dep.swapper === true) {
		pkg.stream.write('deps[' + dep.key + '] = [function(require, module, exports, load) {\n');
	} else {
		pkg.stream.write('deps[' + dep.key + '] = [function(require, module, exports) {\n');
	}
	pkg.stream.write(dep.src);
	pkg.stream.write('\n');
	var r = {};
	for (var i in dep.requires) {
		r[dep.requires[i]] = sources[dep.deps[i].id].key;
		packages[pkg.key].reqs[sources[dep.deps[i].id].key] = true;
	}
	packages[pkg.key].deps[dep.key] = true;
	pkg.stream.write('}, ' + JSON.stringify(r) + '];\n');
}

var endStream = function(pkg) {
	pkg.stream.end('\n');

	//dep.requires;
	//pkg.stream.end('\n');
}

var packagesHash = function(max, packages) {
	var a = new Array(max);
	for (var i in packages) {
		a[i] = i;
	}
	var s = '';
	for (var i in a) {
		if (a[i] != null) {
			s += '-' + a[i];
		}
	}
	return s.substr(1);
}

var createPackage = function(key, id) {
	packages[key] = {};
	packages[key].id = id;
	packages[key].key = key;
	packages[key].deps = {};
	packages[key].reqs = {};
	packages[key].packs = {};
	packages[key].replacers = {};
	packages[key].stream = fs.createOutputStream(path.join(buildpathWeb, 'c' + packages[key].id + '.js'));
	if (id === 0) {
		packages[key].stream.write('var deps = {}, process = {env: {}};\n');
	}
}

var getPackage = function(key, pkgs) {
	if (packages[key] == null) {
		var numberkey = 0;
		if (pkgs != null && Object.keys(pkgs).length > 1) {
			packageCounter++;
			numberkey = packageCounter;
		} else {
			numberkey = parseInt(key);
		}
		createPackage(key, numberkey, pkgs);
	}
	if (pkgs) {
		for (var i in pkgs) {
			var tmp_key = i.toString();
			if (tmp_key !== key) {
				if (packages[tmp_key] == null) {
					createPackage(tmp_key, i);
				}
				packages[tmp_key].packs[packages[key].id] = true;
			}
		}
	}
	return packages[key];
}

var generate = function(srcs, pkgCount, options, callback) {

	buildpath = options.buildpath;
	buildpathWeb = options.buildpathWeb;
	buildpathNode = options.buildpathNode;

	//var a = getHrTime();
	//fs.removeSync(buildpathWeb);
	//fs.removeSync(buildpathNode);
	//console.log('ttok', getHrTime()-a);

	createPackage('0', 0);
	sources = srcs;
	packageCounter = pkgCount;
	var swapMap = {};
	var sourceMap = {};
	var packageMap = {};
	var c = 0;
	for (var i in sources) {
		var dep = sources[i];

		if (dep.swap !== false) {
			swapMap[dep.key] = dep.swap;
		}

		if (!dep.node_module && dep.use.node === true) {
			c++;
			nodeExport(buildpathNode, dep.id, dep.src, function(err) {
				if (err) {
					console.log('Failed to export for nodeJS!', dep.id, err);
				}
				c--;
				if (c < 1) {
					callback();
				}
			});
		}
		if (dep.use.client === true) {
			if (dep.packages[0] === true) {
				var pkg = getPackage('0');
				writeDependencyToStream(pkg, dep);
			} else {
				var pkgId = packagesHash(packageCounter, dep.packages);
				var pkg = getPackage(pkgId, dep.packages);
				writeDependencyToStream(pkg, dep);
			}
			if (sources[i].inPack > 0) {
				sourceMap[sources[i].key] = sources[i].inPack;
			}
		}
	}

	for (var i in packages) {
		tempArray = [];
		for (var j in packages[i].packs) {
			tempArray.push(parseInt(j));
		}
		if (tempArray.length > 0) {
			packageMap[packages[i].id] = tempArray;
		}
	}
	//console.log('packages', packages);

	packages[0].stream.write('deps.s = ' + JSON.stringify(swapMap) + ';\n');
	packages[0].stream.write('deps.d = ' + JSON.stringify(sourceMap) + ';\n');
	packages[0].stream.write('deps.p = ' + JSON.stringify(packageMap) + ';\n');
	packages[0].stream.write('deps.l = {"0": true};\n');

	for (var i in packages) {
		var pkg = packages[i];
		if (pkg.id > 0) {
			pkg.stream.write('deps.o(' + pkg.id + ');');
		} else {
			pkg.stream.write(fs.readFileSync('client.js'));
		}
		pkg.stream.end();
	}
	if (c < 1) {
		callback();
	}
}

var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}


module.exports = generate;
