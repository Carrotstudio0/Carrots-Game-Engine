// @flow
import applyPixiCompat from './applyPixiCompat';

const safelyApplyCompat = (candidate: any) => {
  if (!candidate) return;
  if (typeof candidate !== 'object' && typeof candidate !== 'function') return;

  try {
    applyPixiCompat(candidate);
  } catch (error) {
    // Ignore immutable namespace objects in some bundling modes.
  }
};

const requirePixiMultistyleText = () => {
  // Ensure pixi compatibility surface is present before evaluating legacy UMD.
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

  // eslint-disable-next-line global-require
  return require('GDJS-for-web-app-only/Runtime/Extensions/BBText/pixi-multistyle-text/dist/pixi-multistyle-text.umd');
};

export default requirePixiMultistyleText;
