// @flow

const initializedModules = new WeakSet();

export const ensureGDevelopJsPlatformsInitialized = (
  gd: libGDevelop | Object
): void => {
  if (!gd || typeof gd.initializePlatforms !== 'function') {
    return;
  }

  if (initializedModules.has((gd: any))) {
    return;
  }

  gd.initializePlatforms();
  initializedModules.add((gd: any));
};
