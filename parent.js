var cp = require('child_process');
var os = require('os');

var cache = {};

var workers = [];
var checksRunning = 0;
var packageCounter = 0;
var depKeyCounter = 0;

var enableStats = false;
var enableLocalWorker = false;
var enableQueue = false;
var localWorker;

if (enableLocalWorker === true) {
	localWorker = require('./localWorker.js');
}

var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}

var timers = {
	start: 0,
	startExport: 0,
	workersReady: 0,
	stop: 0
}

var setListener = function(i, worker) {
	worker.on('message', function(m) {
		switch (m.job) {
			case "retDependency":
				worker.jobs--;
				if (enableStats === true) {
					worker.stats.workerJobs--;
					if (worker.jobs === 0) {
						worker.stats.lastJob = getHrTime() - timers.start;
					}
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
			case "pong":
				timers.workersReady = getHrTime();
				worker.maxJobs = m.maxJobs;
				worker.ready = true;
				if (loadQueue.length > 0) {
					cleanUpQueue();
				}
				break;
			default:
				throw new Error('Unknown message from build child!');
				break;
		}
	});
	worker.load = function(dep) {
		if (enableStats === true) {
			worker.stats.workerJobs++;
			worker.stats.totalWorkerJobs++;
			if (worker.stats.workerJobs > worker.stats.maxWorkerJobs) {
				worker.stats.maxWorkerJobs = worker.stats.workerJobs;
			}
		}

		worker.send({
			job: 'loadDependency',
			dep: dep
		});
	}

	worker.loadCache = function(dep) {
		worker.jobs++;
		if (enableStats === true) {
			worker.stats.totalJobs++;
			if (worker.jobs > worker.stats.maxJobs) {
				worker.stats.maxJobs = worker.jobs;
			}
		}
		checksRunning++;
		if (globalOptions.cache === true) {
			fs.stat(dep.id, function(err, stats) {
				if (err) throw err;
				var mtime = (new Date(stats.mtime)).getTime();
				dep.mtime = mtime;
				checksRunning--;
				if (cache && cache[dep.id] && cache[dep.id].mtime && cache[dep.id].mtime === dep.mtime) {
					//sources[dep.id] = JSON.parse(JSON.stringify(cache[dep.id]));
					worker.jobs--;

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

	worker.send({
		job: 'ping'
	});
	// require.resolve('./babelTransformer.js')
}

var createWorkers = function(cpus) {
	if (enableLocalWorker === true) {
		cpus++;
	}
	for (var i = 0; i < cpus; i++) {
		if (i === 0 && enableLocalWorker === true) {
			var worker = localWorker;
		} else {
			var worker = cp.fork(__dirname + '/child.js', [], {
				silent: false
			});
		}
		worker.jobs = 0;
		worker.maxJobs = 99999999999;
		if (enableStats === true) {
			worker.stats = {
				maxJobs: 0,
				totalJobs: 0,
				lastJob: 0,
				workerJobs: 0,
				maxWorkerJobs: 0,
				totalWorkerJobs: 0
			}
		}
		worker.ready = false;
		workers[i] = worker;
		setListener(i, worker);
	}
}

var fs = require('fs-extra');
var path = require('path');
var colors = require('colors');
var gernerate = require('./packageGenerator.js');

var sources = {};
var replSources = {};
var swappersToLoad = [];
var dirname = process.cwd();


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

var loadQueue = [];

var cleanUpQueue = function() {
	while (loadQueue.length > 0) {
		var dep = loadQueue.shift();
		//console.log('Out of queue', dep.id);
		loadDependency(dep);
	}
}

var loadDependency = function(dep) {
	var lowNumber = Infinity;
	var found = false;

	var workerNumber = 0;
	for (var i in workers) {
		if (workers[i].ready === true || !enableQueue) {
			if (workers[i].jobs < 1) {
				return workers[i].loadCache(dep);
			}
			if ((workers[i].jobs < workers[i].maxJobs || !enableQueue) && workers[i].jobs < lowNumber) {
				lowNumber = workers[i].jobs;
				workerNumber = i;
				found = true;
			}
		}
	}
	if (found === true) {
		workers[workerNumber].loadCache(dep);
	} else {
		//console.log('queued', dep.id);
		loadQueue.push(dep);
	}
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
	if (stillrunning === false && checksRunning < 1 && loadQueue.length === 0 && isFinished()) {

		timers.startExport = getHrTime();


		if (globalOptions.changed === false) {
			console.log('');
			console.log('   ||------------------||'.yellow.bold);
			console.log('   || Nothing changed! ||'.yellow.bold);
			console.log('   ||------------------||'.yellow.bold);
			console.log('');
		}

		var c = 0;

		var checkFin = function(a) {
			if (a < 1) {
				timers.stop = getHrTime();
				console.log(' ✔ ✔ ✔ Bundled successful! ✔ ✔ ✔'.green.bold);
				console.log(' » Worker startup: ', timers.workersReady - timers.start, 'ms');
				console.log(' » Compile time:   ', timers.startExport - timers.workersReady, 'ms');
				console.log(' » Export time:    ', timers.stop - timers.startExport, 'ms');
				console.log(' » Total time:     '.bold, (timers.stop - timers.start + "").magenta.bold, 'ms'.bold);
			}
		}

		for (var i in workers) {
			c++;
			workers[i].on('close', function(code, signal) {
				c--;
				checkFin(c);
			});
			workers[i].kill();
			if (enableStats === true) {
				console.log(i, workers[i].stats);
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
				//console.log('Sta now');
				st();
			} else {
				//console.log('Sta later');
				removeCB = st;
			}
		}
	}
	return true;
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
	fs.ensureDir(globalOptions.buildpath, function(err) {
		if (err) throw err;
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
	});

}

var globalOptions = {};

var run = function(options) {
	timers.start = getHrTime();

	if (options == null || typeof options !== 'object' || options.entryFile == null || typeof options.entryFile !== 'string') {
		throw new Error('Options parameter needs to be an object and include the property entryFile!');
	}

	options.cpus = options.cpus || os.cpus().length / 2;
	options.cpus = Math.round(options.cpus);
	if (options.cpus < 1) {
		options.cpus = 1;
	}

	createWorkers(options.cpus);

	options.buildpath = options.buildpath ||  path.join(dirname, 'build');

	options.buildpathWeb = path.join(options.buildpath, 'web');
	options.buildpathNode = path.join(options.buildpath, 'node');
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

	for (var i in workers) {
		timers.workersReady = getHrTime();
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
		use: {
			client: true,
			node: true
		},
		swap: false
	});
}


module.exports = run;
