// @flow
import applyPixiCompat from './applyPixiCompat';

const applyCompatToCandidate = candidate => {
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return;
  }

  try {
    applyPixiCompat(candidate);
  } catch (error) {
    // Ignore immutable namespace objects. A mutable CommonJS export is patched below too.
  }
};

// Patch the actual pixi package export object early so legacy UMDs requiring
// "pixi.js" receive the compatibility surface before they evaluate.
// eslint-disable-next-line global-require
const pixiModule = require('pixi.js-original');

applyCompatToCandidate(pixiModule);
applyCompatToCandidate(
  pixiModule &&
    typeof pixiModule === 'object' &&
    pixiModule.default
    ? pixiModule.default
    : null
);
applyCompatToCandidate(
  typeof global !== 'undefined' && global.PIXI ? global.PIXI : null
);
