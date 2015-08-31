var cp = require('child_process');
var fs = require('fs');
var os = require('os');
var fs = require('fs-extra');
var path = require('path');
var colors = require('colors');
var gernerate = require('./packageGenerator.js');

var sources = {};
var replSources = {};
var swappersToLoad = [];

var cache = {};

//var cache = {};

var workers = [];
var checksRunning = 0;
var packageCounter = 0;
var depKeyCounter = 0;

//var swappers = [];
/*var swappers = [{
	tags: ['split'],
	module: require.resolve('./test/replacement.js')
}];*/

var loadSwap = function(dep) {
	for (var i in globalOptions.swappers) {
		var match = false;
		for (var j in globalOptions.swappers[i].tags) {
			if (dep.tags.indexOf(globalOptions.swappers[i].tags[j]) >= 0) {
				match = true;
				break;
			}
		}
		if (match === true) {
			var swapId = dep.id;
			dep.id = globalOptions.swappers[i].module;
			if (sources[dep.id] != null) {
				dep.packages[dep.package] = true;
				sources[dep.id].swapper = true;
				for (var j in dep.tags) {
					if (sources[dep.id].tags.indexOf(dep.tags[j]) < 0) {
						sources[dep.id].tags.push(dep.tags[j]);
					}
				}
				for (var j in dep.packages) {
					if (sources[dep.id].packages[j] !== true) {
						sources[dep.id].packages[j] = true;
					}
				}
			} else {
				dep.key = depKeyCounter;
				dep.swapper = true;
				depKeyCounter++;
				dep.packages[dep.package] = true;
				sources[dep.id] = dep;
				loadDependency(dep);
			}
			sources[swapId].swap = sources[dep.id].key;
			return;
		}
	}
	throw new Error('Splitted Module could not get replaced!');
}

var isFinished = function() {
	for (var i in workers) {
		if (workers[i].jobs > 0) {
			return false;
		}
	}
	return true;
}

var loadDependency = function(dep) {
	var lowNumber = Infinity;
	var workerNumber = 0;
	for (var i in workers) {
		if (workers[i].jobs < 1) {
			return workers[i].loadCache(dep);
		}
		if (workers[i].jobs < lowNumber) {
			lowNumber = workers[i].jobs;
			workerNumber = i;
		}
	}
	workers[workerNumber].loadCache(dep);
}

var checkDependencies = function(dep) {
	var deps = dep.deps
	var stillrunning = false;
	for (var i in deps) {
		//console.log(deps[i].id, deps[i].tags, deps[i].package, deps[i].packages);
		if (sources[deps[i].id] == null) {
			sources[deps[i].id] = deps[i];

			sources[deps[i].id].key = depKeyCounter;
			depKeyCounter++;
			if (sources[deps[i].id].tags.indexOf('split') >= 0) {
				loadSwap(JSON.parse(JSON.stringify(deps[i])));
				packageCounter++;
				sources[deps[i].id].package = packageCounter;
				sources[deps[i].id].packages = {};
			}

			sources[deps[i].id].packages[deps[i].package] = true;
			loadDependency(sources[deps[i].id]);
			deps[i] = {
				id: deps[i].id,
				tags: JSON.parse(JSON.stringify(deps[i].tags)),
				node_module: deps[i].node_module,
				package: deps[i].package,
				packages: JSON.parse(JSON.stringify(deps[i].packages)),
				swap: deps[i].swap,
				use: deps[i].use,
				browser: deps[i].browser
			};
		} else {
			sources[deps[i].id].packages[deps[i].package] = true;
			if (deps[i].tags != null) {
				for (var j in deps[i].tags) {
					if (sources[deps[i].id].tags.indexOf(deps[i].tags[j]) < 0) {
						sources[deps[i].id].tags.push(deps[i].tags[j]);
					}
				}
			}
			if (deps[i].packages != null) {
				for (var j in deps[i].packages) {
					if (sources[deps[i].id].packages[j] !== true) {
						sources[deps[i].id].packages[j] = true;
					}
				}
			}
			sources[deps[i].id].use.client = sources[deps[i].id].use.client || deps[i].use.client;
			sources[deps[i].id].use.node = sources[deps[i].id].use.node || deps[i].use.node;
			
			deps[i] = {
				id: deps[i].id,
				tags: JSON.parse(JSON.stringify(deps[i].tags)),
				node_module: deps[i].node_module,
				package: deps[i].package,
				packages: JSON.parse(JSON.stringify(deps[i].packages)),
				swap: deps[i].swap,
				use: deps[i].use,
				browser: deps[i].browser
			};
		}
	}
	if (stillrunning === false && checksRunning < 1 && isFinished()) {

		var ac = getHrTime();


		if (globalOptions.changed === false) {
			console.log('Nothing changed!');
		}

		var c = 0;

		for (var i in workers) {
			c++;
			workers[i].on('close', function(code, signal) {
				c--;
				checkFin(c);
			});
			workers[i].kill();
		}

		var checkFin = function(a) {
			if (a < 1) {
				var stop = getHrTime();
				console.log('Bundled successful!'.green.bold);
				console.log(' > Time until loaded:', ac - start, 'ms');
				console.log(' > Total time:', stop - start, 'ms');
			}
		}

		if (globalOptions.changed === true) {
			c += 2;
			/*for(var i in sources){
				if(JSON.stringify(sources[i]) !== JSON.stringify(cache[i])){
					console.log('CH', i, sources[i]);
				}
			}*/

			fs.writeFile(globalOptions.cacheFile, JSON.stringify({
				cache: sources,
				depKeyCounter: depKeyCounter
			}), function(err) {
				if (err) throw err;
				c--;
				checkFin(c);
			});
			var st = function() {
				gernerate(sources, packageCounter, globalOptions, function() {
					c--;
					checkFin(c);
				});
			}

			if (removeCB === true) {
				console.log('Sta now');
				st();
			} else {
				console.log('Sta later');
				removeCB = st;
			}
		}
	}
	return true;
}

var setListener = function(i, worker) {
	worker.on('message', function(m) {
		switch (m.job) {
			case "retDependency":
				worker.jobs--;
				//console.log('HR', getHrTime() - m.dep.chtime);
				if (worker.jobs === 0) {
					worker.lastJob = Date.now() - start;
				}
				if (sources[m.dep.id] == null) {
					sources[m.dep.id] = m.dep;
					sources[m.dep.id].key = depKeyCounter;
					depKeyCounter++;
				} else {
					sources[m.dep.id].src = m.dep.src;
					sources[m.dep.id].deps = m.dep.deps;
					sources[m.dep.id].requires = m.dep.requires;
				}
				checkDependencies(m.dep);
				break;
			default:
				throw new Error('Unknown message from build child!');
				break;
		}
	});
	worker.load = function(dep) {
		worker.jobs++;
		worker.totalJobs++;
		if (worker.jobs > worker.maxJobs) {
			worker.maxJobs = worker.jobs;
		}

		//dep.chTime = getHrTime();
		//console.log(dep);
		worker.send({
			job: 'loadDependency',
			dep: dep
		});
	}

	worker.loadCache = function(dep) {
		checksRunning++;
		if (globalOptions.cache === true) {
			fs.stat(dep.id, function(err, stats) {
				if (err) throw err;
				var mtime = (new Date(stats.mtime)).getTime();
				dep.mtime = mtime;
				checksRunning--;
				if (cache && cache[dep.id] && cache[dep.id].mtime && cache[dep.id].mtime === dep.mtime) {
					//sources[dep.id] = JSON.parse(JSON.stringify(cache[dep.id]));

					if (sources[dep.id] == null) {
						sources[dep.id] = cache[dep.id];
						sources[dep.id].key = depKeyCounter;
						depKeyCounter++;
					} else {
						sources[dep.id].src = cache[dep.id].src;
						sources[dep.id].deps = cache[dep.id].deps;
						sources[dep.id].requires = cache[dep.id].requires;
					}

					checkDependencies(cache[dep.id]);

				} else {
					// Not Cached
					globalOptions.changed = true;
					worker.load(dep);
					deleteBuildPaths();
				}
			});
		} else {
			globalOptions.changed = true;
			deleteBuildPaths();
			worker.load(dep);
		}
	}

	worker.send({
		job: 'setTransformers',
		transformers: []
	});
	// require.resolve('./babelTransformer.js')
}

var createWorkers = function() {
	var cpus = os.cpus().length / 2;
	for (var i = 0; i < cpus; i++) {
		var worker = cp.fork(__dirname + '/child.js', [], {
			silent: false
		});
		worker.jobs = 0;
		worker.totalJobs = 0;
		worker.maxJobs = 0;
		worker.lastJob = 0;
		workers[i] = worker;
		setListener(i, worker);
	}
}

var removeCB = null;

var deleteBuildPaths = function() {
	var cb = function(a) {
		if (a < 1) {
			if (removeCB != null && removeCB !== true) {
				removeCB();
			} else {
				removeCB = true;
			}
		}
	}
	var c = 2;
	fs.remove(globalOptions.buildpathWeb, function(err) {
		if (err) throw err;
		c--;
		cb(c);
	});
	fs.remove(globalOptions.buildpathNode, function(err) {
		if (err) throw err;
		c--;
		cb(c);
	});
}

var start;
var globalOptions = {};
createWorkers();

var run = function(options) {

	start = getHrTime();

	if (options == null || typeof options !== 'object' || options.entryFile == null || typeof options.entryFile !== 'string') {
		throw new Error('Options parameter needs to be an object and include the property entryFile!');
	}
	options.buildpath = options.buildpath ||  path.join(__dirname, 'build');

	options.buildpathWeb = path.join(options.buildpath, 'web');
	options.buildpathNode = path.join(options.buildpath, 'node');

	//options.cpus = options.cpus || os.cpus().length / 2;
	options.swappers = options.swappers || [];
	options.transformers = options.transformers || [];
	options.cacheFile = options.cacheFile || path.join(options.buildpath, 'cache.json');

	if (options.cache != null && options.cache === false) {
		options.cache = false;
	} else {
		options.cache = true;
	}

	options.changed = false;

	globalOptions = options;

	for(var i in workers){
		workers[i].send({
			job: 'setTransformers',
			transformers: globalOptions.transformers
		});
	}

	try {
		temp = JSON.parse(fs.readFileSync(globalOptions.cacheFile));
		cache = temp.cache;
		//depKeyCounter = temp.depKeyCounter;
	} catch (e) {}

	workers[0].loadCache({
		id: globalOptions.entryFile,
		tags: [],
		node_module: false,
		package: 0,
		packages: {
			0: true
		},
		swap: false
	});
}

var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}

module.exports = run;
