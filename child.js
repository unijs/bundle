var loader = require('./loader.js');

var transformers = [];

process.on('message', function(m) {
	if (m.job === 'setTransformers') {
		transformers = [];
		for (var i in m.transformers) {
			transformers.push(require(m.transformers[i]))
		}
	}
	if (m.job === 'loadDependency') {
		//console.log('LOOOO', getHrTime() - m.dep.chTime)
		loader(m.dep, transformers, function(err, dep) {
			process.send({
				job: 'retDependency',
				dep: dep
			});
		});
	}
});

var getHrTime = function() {
	var hrTime = process.hrtime();
	return (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000;
}
