// @flow
// Keep dependencies optional so this can run in Electron and test environments.

const optionalRequire = require('../Utils/OptionalRequire');
const remote = optionalRequire('@electron/remote');
const electron = optionalRequire('electron');
const app = remote ? remote.app : electron ? electron.app : null;
const fs = optionalRequire('fs');
const path = optionalRequire('path');
const process = optionalRequire('process');

const hasReadAccess = (targetPath /*: string */) /*: Promise<boolean> */ =>
  new Promise(resolve => {
    fs.access(targetPath, fs.constants.R_OK, err => resolve(!err));
  });

const isValidGdjsRoot = async (
  candidatePath /*: string */
) /*: Promise<boolean> */ => {
  if (!candidatePath) return false;

  const runtimePath = path.join(candidatePath, 'Runtime');
  const runtimeSourcesPath = path.join(candidatePath, 'Runtime-sources');
  const runtimeTypesPath = path.join(runtimePath, 'types');
  const runtimeExtensionsPath = path.join(runtimePath, 'Extensions');
  const extensionsPath = path.join(candidatePath, 'Extensions');
  const gdjsExtensionsPath = path.join(candidatePath, 'GDJS', 'Extensions');
  const [
    hasRuntime,
    hasRuntimeSources,
    hasRuntimeTypes,
    hasRuntimeExtensions,
    hasExtensions,
    hasGdjsExtensions,
  ] = await Promise.all([
    hasReadAccess(runtimePath),
    hasReadAccess(runtimeSourcesPath),
    hasReadAccess(runtimeTypesPath),
    hasReadAccess(runtimeExtensionsPath),
    hasReadAccess(extensionsPath),
    hasReadAccess(gdjsExtensionsPath),
  ]);

  const hasAnyRuntime = hasRuntime || hasRuntimeSources;
  const hasAnyExtensions =
    hasRuntimeExtensions || hasExtensions || hasGdjsExtensions;

  // Support both legacy and modern GDJS layouts.
  return hasAnyRuntime && (hasRuntimeTypes || hasAnyExtensions);
};

const deduplicatePaths = (paths /*: Array<string> */) /*: Array<string> */ => {
  const uniquePaths = [];
  const seen = new Set();
  for (const candidatePath of paths) {
    if (!candidatePath) continue;
    const normalizedPath = path.resolve(candidatePath);
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
    uniquePaths.push(normalizedPath);
  }
  return uniquePaths;
};

const getCandidateGdjsRoots = (
  appPath /*: string */
) /*: Array<string> */ => {
  const resourcesPath =
    process.resourcesPath || path.join(appPath, '..', 'resources');

  return deduplicatePaths([
    // Packaged Electron app (`extraResources -> resources/GDJS`).
    path.join(resourcesPath, 'GDJS'),
    // Some environments expose appPath inside app.asar.
    path.join(appPath, '..', 'GDJS'),
    // Development layout used by newIDE/app scripts.
    path.join(appPath, '..', '..', 'app', 'resources', 'GDJS'),
    // Fallback when launched from repository root.
    path.join(process.cwd(), 'newIDE', 'app', 'resources', 'GDJS'),
    // Legacy fallback for unusual packaging layouts.
    path.join(appPath, '..', '..', 'GDJS'),
    path.join(appPath, '..', '..', '..', 'GDJS'),
    // Common development locations when running from newIDE/app.
    path.join(process.cwd(), 'GDJS'),
    path.join(process.cwd(), '..', 'GDJS'),
    path.join(process.cwd(), '..', '..', 'GDJS'),
  ]);
};

const findGDJS = async () /*: Promise<{|gdjsRoot: string|}> */ => {
  if (!path || !process || !fs) {
    throw new Error('Unsupported');
  }

  const appPath = app ? app.getAppPath() : process.cwd();
  const candidatePaths = getCandidateGdjsRoots(appPath);

  for (const candidatePath of candidatePaths) {
    if (await isValidGdjsRoot(candidatePath)) {
      return { gdjsRoot: candidatePath };
    }
  }

  throw new Error(
    'Could not find GDJS runtime. Checked paths: ' + candidatePaths.join(', ')
  );
};

const localGDJSFinder = {
  findGDJS,
};

export { findGDJS };
export default localGDJSFinder;
