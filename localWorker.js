var loader = require('./loader.js');

var transformers = [];
var cb = {};

var worker = {
   send: function(m){
      if (m.job === 'setTransformers') {
         transformers = [];
         for (var i in m.transformers) {
            transformers.push(require(m.transformers[i]))
         }
      }
      if (m.job === 'loadDependency') {
         loader(m.dep, transformers, function(err, dep) {
            cb.message({
               job: 'retDependency',
               dep: dep
            });
         });
      }
   	if (m.job === 'ping') {
   		cb.message({
   			job: 'pong',
            maxJobs: 1
   		});
   	}
   },
   on: function(key, fn){
      cb[key] = fn;
   },
   kill: function(){
      cb.close();
   }
}

module.exports = worker;
