const path = require('path');
const shell = require('shelljs');
const copy = require('recursive-copy');

const sourceRuntimePath = path.join(__dirname, '..', 'resources', 'GDJS', 'Runtime');
const destinationRuntimePath = path.join(
  __dirname,
  '..',
  'public',
  'GDJS',
  'Runtime'
);

if (!shell.test('-d', sourceRuntimePath)) {
  console.warn(
    `[import-browser-gdjs-runtime] Source runtime was not found at "${sourceRuntimePath}". Skipping.`
  );
  process.exit(0);
}

shell.rm('-rf', destinationRuntimePath);
shell.mkdir('-p', destinationRuntimePath);

copy(sourceRuntimePath, destinationRuntimePath, {
  overwrite: true,
  expand: true,
  dot: true,
  junk: false,
})
  .then(results => {
    console.log(
      `[import-browser-gdjs-runtime] Copied ${results.length} file(s) to "${destinationRuntimePath}".`
    );
  })
  .catch(error => {
    console.error(
      '[import-browser-gdjs-runtime] Failed to copy runtime for browser build:',
      error
    );
    process.exit(1);
  });
