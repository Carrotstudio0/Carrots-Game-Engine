// Keep dependencies optional so this can run in Electron and test environments.

import localGDJSFinderDefault, {
  findGDJS as namedFindGDJS,
} from '../GameEngineFinder/LocalGDJSFinder';
const optionalRequire = require('../Utils/OptionalRequire');
const remote = optionalRequire('@electron/remote');
const electron = optionalRequire('electron');
const app = remote ? remote.app : electron ? electron.app : null;
const path = optionalRequire('path');
const fs = optionalRequire('fs');
const process = optionalRequire('process');

const hasReadAccess = targetPath =>
  new Promise(resolve => {
    if (!fs || !fs.access || !fs.constants) {
      return resolve(false);
    }
    fs.access(targetPath, fs.constants.R_OK, err => resolve(!err));
  });

const isValidGdjsRoot = async candidatePath => {
  if (!candidatePath || !path || !fs) return false;

  const runtimePath = path.join(candidatePath, 'Runtime');
  const runtimeExtensionsPath = path.join(runtimePath, 'Extensions');
  const [hasRuntime, hasRuntimeExtensions] = await Promise.all([
    hasReadAccess(runtimePath),
    hasReadAccess(runtimeExtensionsPath),
  ]);

  return hasRuntime && hasRuntimeExtensions;
};

const deduplicatePaths = paths => {
  if (!path) return [];

  const seen = new Set();
  const uniquePaths = [];
  for (const candidatePath of paths) {
    if (!candidatePath) continue;
    const normalizedPath = path.resolve(candidatePath);
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
    uniquePaths.push(normalizedPath);
  }
  return uniquePaths;
};

const getCandidateGdjsRoots = () => {
  if (!path || !process) return [];

  const appPath = app ? app.getAppPath() : process.cwd();
  const resourcesPath =
    process.resourcesPath || path.join(appPath, '..', 'resources');

  return deduplicatePaths([
    path.join(resourcesPath, 'GDJS'),
    path.join(appPath, '..', 'GDJS'),
    path.join(appPath, '..', '..', 'app', 'resources', 'GDJS'),
    path.join(process.cwd(), 'newIDE', 'app', 'resources', 'GDJS'),
    path.join(appPath, '..', '..', 'GDJS'),
  ]);
};

const probeLocalGdjsRoot = async () => {
  const candidatePaths = getCandidateGdjsRoots();
  for (const candidatePath of candidatePaths) {
    if (await isValidGdjsRoot(candidatePath)) {
      return { gdjsRoot: candidatePath };
    }
  }

  throw new Error(
    'Unable to locate GDJS runtime while probing local filesystem. Checked paths: ' +
      candidatePaths.join(', ')
  );
};

const resolveFindGDJS = () => {
  if (typeof namedFindGDJS === 'function') {
    return namedFindGDJS;
  }

  const localGDJSFinder = localGDJSFinderDefault;
  if (typeof localGDJSFinder === 'function') {
    return localGDJSFinder;
  }
  if (localGDJSFinder && typeof localGDJSFinder.findGDJS === 'function') {
    return localGDJSFinder.findGDJS;
  }
  if (
    localGDJSFinder &&
    localGDJSFinder.default &&
    typeof localGDJSFinder.default === 'function'
  ) {
    return localGDJSFinder.default;
  }
  if (
    localGDJSFinder &&
    localGDJSFinder.default &&
    typeof localGDJSFinder.default.findGDJS === 'function'
  ) {
    return localGDJSFinder.default.findGDJS;
  }
  return null;
};

const findGDJSWithFallback = onFindGDJS => {
  if (typeof onFindGDJS === 'function') {
    return onFindGDJS();
  }

  const findGDJS = resolveFindGDJS();
  if (!findGDJS) {
    return probeLocalGdjsRoot();
  }

  return Promise.resolve()
    .then(() => findGDJS())
    .catch(error => {
      console.warn(
        'findGDJS from LocalGDJSFinder failed. Retrying with direct filesystem probing.',
        error
      );
      return probeLocalGdjsRoot();
    });
};

const checkIfPathHasJsExtensionModule = extensionFolderPath => {
  return new Promise(resolve => {
    const jsExtensionModulePath = path.join(
      extensionFolderPath,
      'JsExtension.js'
    );
    fs.stat(jsExtensionModulePath, (err, stats) => {
      if (err) {
        return resolve(null);
      }

      return resolve(stats.isFile() ? jsExtensionModulePath : null);
    });
  });
};

const findJsExtensionModules = ({ filterExamples, onFindGDJS }) => {
  return findGDJSWithFallback(onFindGDJS)
    .then(({ gdjsRoot }) => {
      const extensionsRoot = path.join(gdjsRoot, 'Runtime', 'Extensions');
      console.info(
        `Searching for JS extensions (file called JsExtension.js) in ${extensionsRoot}...`
      );
      return new Promise((resolve, reject) => {
        fs.readdir(extensionsRoot, (error, extensionFolders) => {
          if (error) {
            return reject(error);
          }

          const filteredExtensionFolders = extensionFolders.filter(folder => {
            if (!filterExamples) return true;

            return folder.indexOf('Example') === -1;
          });

          Promise.all(
            filteredExtensionFolders.map(extensionFolder =>
              checkIfPathHasJsExtensionModule(
                path.join(extensionsRoot, extensionFolder)
              )
            )
          ).then(modulePaths => {
            resolve(modulePaths.filter(modulePath => !!modulePath));
          }, reject);
        });
      });
    })
    .catch(error => {
      console.error(
        'Unable to resolve local JS extensions modules. Continuing with an empty list.',
        error
      );
      return [];
    });
};

export { findJsExtensionModules };
const localJsExtensionsFinder = {
  findJsExtensionModules,
};
export default localJsExtensionsFinder;
