// @flow
import applyPixiCompat from './applyPixiCompat';
import createPixiTilemapCompat from './createPixiTilemapCompat';

let cachedTilemapCompatModule = null;

const safelyApplyCompat = (candidate: any) => {
  if (!candidate) return;
  if (typeof candidate !== 'object' && typeof candidate !== 'function') return;

  try {
    applyPixiCompat(candidate);
  } catch (error) {
    // Ignore immutable namespace objects in some bundling modes.
  }
};

const requirePixiTilemap = () => {
  if (cachedTilemapCompatModule) return cachedTilemapCompatModule;

  // Legacy pixi-tilemap is tied to the Pixi v7 renderer plugin API.
  // The editor only needs a draw-time compatible facade for previews.
  // eslint-disable-next-line global-require
  const pixiModule = require('pixi.js');
  safelyApplyCompat(pixiModule);
  safelyApplyCompat(
    pixiModule &&
      typeof pixiModule === 'object' &&
      pixiModule.default
      ? pixiModule.default
      : null
  );
  safelyApplyCompat(typeof global !== 'undefined' ? global.PIXI : null);

  const pixi =
    typeof global !== 'undefined' && global.PIXI ? global.PIXI : pixiModule;
  cachedTilemapCompatModule = createPixiTilemapCompat(pixi);
  return cachedTilemapCompatModule;
};

export default requirePixiTilemap;
