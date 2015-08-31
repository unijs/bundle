var fs = require('fs-extra');
var path = require('path');

var dirname = process.cwd();

var exportModule = function(buildpath, modId, src, callback) {
   if(dirname.length > modId.length){
      return callback(new Error('Module outside of the Project not allowed!'));
   }
   var target = path.join(buildpath, modId.substr(dirname.length));
   src = "var UniJSnodeReq = require;\nvar requireTags, require = function(req) {\nrequireTags = req.split('!');\nreturn UniJSnodeReq(requireTags.pop());\n};\nrequire.resolve = UniJSnodeReq.resolve;\n"+src;
   fs.outputFile(target, src, function(err){
      if(err) return callback(err);
      callback(false, target);
   });
}

module.exports = exportModule;
