# bundle
Bundle System especially for ReactJS Apps.

* **Universal:** Bundles your app for usage in the browser and uses the same transformers to compile the modules for nodeJS.
* **Multicore:** Takes 1/5 of the time of browserify (without cache)!

# Usage
```js
var path = require('path');
var unijsBundle = require('unijs-bundle');

unijsBundle({
	entryFile: require.resolve(path.join(__dirname, 'client', 'js', 'main.js')),
	swappers: [],
	transformers: [require.resolve('./babelTransformer.js')]
});
```

# More Documentation coming soon!
