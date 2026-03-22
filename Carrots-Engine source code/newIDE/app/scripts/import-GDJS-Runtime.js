/*
 * This builds GDJS game engine ("Runtime") and the extensions so that it can
 * be used by the editor (either by the "electron-app" or the "web-app").
 */

const shell = require('shelljs');
const path = require('path');
const copy = require('recursive-copy');
const args = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const { spawnSync } = require('child_process');

const gdevelopRootPath = path.join(__dirname, '..', '..', '..');
const destinationPaths = [
  path.join(__dirname, '..', 'resources', 'GDJS'),
  path.join(__dirname, '..', 'node_modules', 'GDJS-for-web-app-only'),
];

const cleanDestinationPath = destinationPath => {
  const maxAttempts = 5;
  const retryableErrorCodes = new Set(['ENOTEMPTY', 'EBUSY', 'EPERM']);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(destinationPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 150,
      });
      return;
    } catch (error) {
      const isRetryable =
        !!error && typeof error.code === 'string' && retryableErrorCodes.has(error.code);
      if (!isRetryable || attempt === maxAttempts) {
        shell.echo(
          `⚠️ Could not fully clean ${destinationPath} (${error.code || 'unknown'}). Continuing with existing files.`
        );
        return;
      }
      shell.echo(
        `Retrying cleanup for ${destinationPath} (${attempt}/${maxAttempts}) because of ${error.code}...`
      );
    }
  }
};

// Clean the paths where GDJS Runtime (and extensions) will be copied/bundled.
if (!args['skip-clean']) {
  destinationPaths.forEach(destinationPath => {
    shell.echo('Cleaning destination first...');
    cleanDestinationPath(destinationPath);
    shell.mkdir('-p', destinationPath);
  });
}

// Build GDJS runtime (and extensions).
destinationPaths.forEach(destinationPath => {
  const outPath = path.join(destinationPath, 'Runtime');
  const output = spawnSync(
    process.execPath,
    ['scripts/build.js', '--out', outPath],
    {
      cwd: path.join(gdevelopRootPath, 'GDJS'),
      stdio: 'inherit',
    }
  );
  if (output.status !== 0) {
    process.exit(1);
  }
});

// Copy the GDJS runtime and extension sources (used for autocompletions
// in the IDE). This is optional as this takes a lot of time that would add
// up whenever any change is made.
if (!args['skip-sources']) {
  shell.echo(
    `Copying GDJS and extensions runtime sources to ${destinationPaths.join(
      ', '
    )}...`
  );
  destinationPaths.forEach(destinationPath => {
    const copyOptions = {
      overwrite: true,
      expand: true,
      dot: true,
      junk: true,
    };

    const startTime = Date.now();

    const typesDestinationPath = path.join(
      destinationPath,
      'Runtime-sources',
      'types'
    );
    const pixiDestinationPath = path.join(typesDestinationPath, 'pixi');
    const pixiLibDestinationPath = path.join(pixiDestinationPath, 'lib');
    // TODO: Investigate the use of a smart & faster sync
    // that only copy files with changed content.
    return Promise.all([
      copy(
        path.join(gdevelopRootPath, 'GDJS', 'Runtime'),
        path.join(destinationPath, 'Runtime-sources'),
        copyOptions
      ),
      copy(
        path.join(gdevelopRootPath, 'Extensions'),
        path.join(destinationPath, 'Runtime-sources', 'Extensions'),
        { ...copyOptions, filter: ['**/*.js', '**/*.ts'] }
      ),
      copy(
        path.join(gdevelopRootPath, 'GDJS', 'node_modules', '@types', 'three'),
        path.join(typesDestinationPath, 'three'),
        { ...copyOptions, filter: ['*.d.ts'] }
      ),
      copy(
        path.join(
          gdevelopRootPath,
          'GDJS',
          'node_modules',
          '@types',
          'three',
          'src'
        ),
        path.join(typesDestinationPath, 'three', 'src'),
        { ...copyOptions, filter: ['**/*.d.ts'] }
      ),
      copy(
        path.join(gdevelopRootPath, 'GDJS', 'node_modules', 'pixi.js', 'lib'),
        pixiLibDestinationPath,
        { ...copyOptions, filter: ['**/*.d.ts'] }
      ),
      copy(
        path.join(gdevelopRootPath, 'GDJS', 'node_modules', '@pixi', 'colord'),
        path.join(pixiDestinationPath, 'colord'),
        { ...copyOptions, filter: ['**/*.d.ts'] }
      ),
    ])
      .then(function([
        unbundledResults,
        unbundledExtensionsResults,
        threeTypeResults,
        threeSourceTypeResults,
        pixiTypeResults,
        pixiColordTypeResults,
      ]) {
        const pixiColorTypePath = path.join(
          pixiLibDestinationPath,
          'color',
          'Color.d.ts'
        );
        if (fs.existsSync(pixiColorTypePath)) {
          shell.sed(
            '-i',
            "from '@pixi/colord'",
            "from '../../colord'",
            pixiColorTypePath
          );
        }

        fs.writeFileSync(
          path.join(pixiDestinationPath, 'index.d.ts'),
          `
  export * from './lib';
  export as namespace PIXI;
      `
        );
        const totalFilesCount =
          unbundledResults.length +
          unbundledExtensionsResults.length +
          threeTypeResults.length +
          threeSourceTypeResults.length +
          pixiTypeResults.length +
          pixiColordTypeResults.length;
        const duration = Date.now() - startTime;
        console.info(
          `Runtime source files copy done (${totalFilesCount} file(s) copied in ${duration}ms).`
        );
      })
      .catch(function(error) {
        console.error('Copy failed:', error);
      });
  });
}
