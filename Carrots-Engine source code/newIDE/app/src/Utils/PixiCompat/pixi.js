// @flow
import * as PIXI_ORIGINAL from 'pixi.js-original';
import applyPixiCompat from './applyPixiCompat';

// eslint-disable-next-line global-require
const PIXI_MUTABLE = require('pixi.js-original');
applyPixiCompat(PIXI_MUTABLE);
applyPixiCompat(
  PIXI_MUTABLE &&
    typeof PIXI_MUTABLE === 'object' &&
    PIXI_MUTABLE.default
    ? PIXI_MUTABLE.default
    : null
);

const PIXI = applyPixiCompat({ ...PIXI_MUTABLE, ...PIXI_ORIGINAL });

export * from 'pixi.js-original';
export default PIXI;

// Re-export legacy namespace keys so CommonJS/UMD consumers using require('pixi.js')
// receive the compatibility surface they expect from Pixi v7-era bundles.
export const filters = PIXI.filters;
export const Renderer = PIXI.Renderer;
export const BaseTexture = PIXI.BaseTexture;
export const RENDERER_TYPE = PIXI.RENDERER_TYPE;
export const TEXT_GRADIENT = PIXI.TEXT_GRADIENT;
export const BLEND_MODES = PIXI.BLEND_MODES;
export const DRAW_MODES = PIXI.DRAW_MODES;
export const SCALE_MODES = PIXI.SCALE_MODES;
export const WRAP_MODES = PIXI.WRAP_MODES;
export const settings = PIXI.settings;
export const utils = PIXI.utils;
