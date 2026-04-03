// @flow

const addIfMissing = (object, key, value) => {
  if (typeof object[key] === 'undefined') object[key] = value;
};

const LEGACY_DRAW_MODES = Object.freeze({
  POINTS: 'point-list',
  LINES: 'line-list',
  LINE_STRIP: 'line-strip',
  TRIANGLES: 'triangle-list',
  TRIANGLE_STRIP: 'triangle-strip',
});

const LEGACY_SCALE_MODES = Object.freeze({
  NEAREST: 'nearest',
  LINEAR: 'linear',
});

const LEGACY_WRAP_MODES = Object.freeze({
  CLAMP: 'clamp-to-edge',
  REPEAT: 'repeat',
  MIRRORED_REPEAT: 'mirror-repeat',
});

const isPlainObject = value =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const VIDEO_RESOURCE_EXTENSIONS = [
  'mp4',
  'webm',
  'ogv',
  'ogg',
  'mov',
  'm4v',
  'm3u8',
];

const getCrossOriginValue = options => {
  if (!options) return undefined;
  const value =
    typeof options.crossOrigin !== 'undefined'
      ? options.crossOrigin
      : options.crossorigin;

  if (value === true) return 'anonymous';
  if (value === false || value === null) return undefined;
  return value;
};

const isVideoResourceString = (resource, options) => {
  if (typeof resource !== 'string') return false;

  if (resource.startsWith('data:video/')) return true;

  const normalizedResource = resource.split('#')[0].split('?')[0];
  const dotIndex = normalizedResource.lastIndexOf('.');
  const extension =
    dotIndex === -1 ? '' : normalizedResource.substring(dotIndex + 1).toLowerCase();

  if (VIDEO_RESOURCE_EXTENSIONS.includes(extension)) {
    return true;
  }

  return !!(
    options &&
    (typeof options.autoPlay !== 'undefined' ||
      typeof options.loop !== 'undefined' ||
      typeof options.muted !== 'undefined' ||
      typeof options.playsInline !== 'undefined' ||
      typeof options.preload !== 'undefined' ||
      typeof options.updateFPS !== 'undefined')
  );
};

const createImageResource = (resource, options) => {
  if (typeof Image === 'function') {
    const image = new Image();
    const crossOrigin = getCrossOriginValue(options);
    if (typeof crossOrigin !== 'undefined') image.crossOrigin = crossOrigin;
    image.src = resource;
    return image;
  }

  if (typeof document !== 'undefined' && document.createElement) {
    const image = document.createElement('img');
    const crossOrigin = getCrossOriginValue(options);
    if (typeof crossOrigin !== 'undefined') image.crossOrigin = crossOrigin;
    image.src = resource;
    return image;
  }

  return resource;
};

const createVideoResource = (resource, options) => {
  if (typeof document === 'undefined' || !document.createElement) {
    return resource;
  }

  const video = document.createElement('video');
  const crossOrigin = getCrossOriginValue(options);
  if (typeof crossOrigin !== 'undefined') video.crossOrigin = crossOrigin;
  if (typeof options?.autoPlay !== 'undefined') video.autoplay = !!options.autoPlay;
  if (typeof options?.loop !== 'undefined') video.loop = !!options.loop;
  if (typeof options?.muted !== 'undefined') video.muted = !!options.muted;
  if (typeof options?.playsInline !== 'undefined') {
    video.playsInline = !!options.playsInline;
  }
  if (typeof options?.preload === 'string') {
    video.preload = options.preload;
  } else if (typeof options?.preload === 'boolean') {
    video.preload = options.preload ? 'auto' : 'none';
  }
  video.src = resource;
  return video;
};

const createLegacyTextureResource = (resource, options) =>
  isVideoResourceString(resource, options)
    ? createVideoResource(resource, options)
    : createImageResource(resource, options);

const patchLegacyBaseTextureResource = source => {
  const resource = source && source.resource;
  if (!source || !resource || resource.__gdPatchedLegacyTextureResource) {
    return;
  }

  resource.__gdPatchedLegacyTextureResource = true;
  resource.source = resource;

  const nativeLoad =
    typeof resource.load === 'function' ? resource.load.bind(resource) : null;
  const hasEventApi =
    typeof resource.addEventListener === 'function' &&
    typeof resource.removeEventListener === 'function';

  const triggerSourceUpdate = () => {
    if (typeof source.update === 'function') {
      source.update();
    }
  };

  const waitForResourceEvent = (readyEvents, isReady) =>
    new Promise((resolve, reject) => {
      if (isReady()) {
        triggerSourceUpdate();
        resolve(resource);
        return;
      }

      if (!hasEventApi) {
        nativeLoad && nativeLoad();
        triggerSourceUpdate();
        resolve(resource);
        return;
      }

      const cleanup = () => {
        readyEvents.forEach(eventName =>
          resource.removeEventListener(eventName, handleReady)
        );
        resource.removeEventListener('error', handleError, true);
      };

      const handleReady = () => {
        cleanup();
        triggerSourceUpdate();
        resolve(resource);
      };

      const handleError = event => {
        cleanup();
        reject(event && event.error ? event.error : event);
      };

      readyEvents.forEach(eventName =>
        resource.addEventListener(eventName, handleReady)
      );
      resource.addEventListener('error', handleError, true);
      nativeLoad && nativeLoad();
    });

  if (source.uploadMethodId === 'video') {
    resource.load = () =>
      waitForResourceEvent(
        ['loadeddata', 'canplay', 'canplaythrough'],
        () => !!(resource.readyState >= 2 && (resource.videoWidth || resource.width))
      );
    return;
  }

  resource.load = () =>
    waitForResourceEvent(
      ['load'],
      () => !!(resource.complete && (resource.naturalWidth || resource.width))
    );
};

const aliasTextureInCache = (pixi, resource, texture) => {
  if (!pixi.Cache || !pixi.Cache.set || !resource || !texture) return;

  pixi.Cache.set(resource, texture);

  if (texture.on && pixi.Cache.remove) {
    texture.on('destroy', () => {
      if (pixi.Cache.has && pixi.Cache.has(resource)) {
        pixi.Cache.remove(resource);
      }
    });
  }
};

const getLegacyTextureFromInput = (resource, optionsOrSkipCache) => {
  if (typeof resource === 'string') {
    return {
      resourceId: resource,
      normalizedOptions: isPlainObject(optionsOrSkipCache) ? optionsOrSkipCache : null,
      skipCache: typeof optionsOrSkipCache === 'boolean' ? optionsOrSkipCache : false,
    };
  }

  if (isPlainObject(resource) && typeof resource.resource === 'string') {
    return {
      resourceId: resource.resource,
      normalizedOptions: resource,
      skipCache: typeof optionsOrSkipCache === 'boolean' ? optionsOrSkipCache : false,
    };
  }

  return null;
};

const patchLegacyEventListeners = pixi => {
  const containerPrototype = pixi.Container && pixi.Container.prototype;

  if (
    !containerPrototype ||
    !containerPrototype.on ||
    !containerPrototype.off ||
    containerPrototype.__gdPatchedEventListeners
  ) {
    return;
  }

  if (!containerPrototype.addEventListener) {
    containerPrototype.addEventListener = function(eventName, listener, context) {
      return this.on(eventName, listener, context);
    };
  }

  if (!containerPrototype.removeEventListener) {
    containerPrototype.removeEventListener = function(
      eventName,
      listener,
      context
    ) {
      return this.off(eventName, listener, context);
    };
  }

  containerPrototype.__gdPatchedEventListeners = true;
};

const patchLegacyRendererReset = pixi => {
  const rendererPrototype = pixi.Renderer && pixi.Renderer.prototype;

  if (
    !rendererPrototype ||
    rendererPrototype.reset ||
    !rendererPrototype.resetState
  ) {
    return;
  }

  rendererPrototype.reset = function() {
    return this.resetState();
  };
};

const patchLegacyTextureFrom = pixi => {
  if (
    !pixi.Texture ||
    !pixi.Texture.from ||
    !pixi.TextureSource ||
    !pixi.Cache ||
    pixi.Texture.__gdPatchedTextureFrom
  ) {
    return;
  }

  const originalTextureFrom = pixi.Texture.from.bind(pixi.Texture);

  pixi.Texture.from = (resource, optionsOrSkipCache) => {
    const legacyInput = getLegacyTextureFromInput(resource, optionsOrSkipCache);
    if (!legacyInput) {
      return originalTextureFrom(resource, optionsOrSkipCache);
    }

    const { resourceId, normalizedOptions, skipCache } = legacyInput;

    if (!skipCache && pixi.Cache.has && pixi.Cache.has(resourceId)) {
      return originalTextureFrom(resourceId, skipCache);
    }

    const resourceOptions =
      normalizedOptions && isPlainObject(normalizedOptions.resourceOptions)
        ? normalizedOptions.resourceOptions
        : null;

    const rest = normalizedOptions ? { ...normalizedOptions } : {};
    delete rest.resourceOptions;
    delete rest.resource;

    const textureOptions = {
      ...rest,
      ...(resourceOptions || {}),
      resource: createLegacyTextureResource(resourceId, {
        ...rest,
        ...(resourceOptions || {}),
      }),
    };

    const texture = originalTextureFrom(textureOptions, skipCache);
    patchLegacyBaseTextureResource(texture && (texture.source || texture.baseTexture));
    if (!skipCache) aliasTextureInCache(pixi, resourceId, texture);

    return texture;

  };

  pixi.Texture.__gdPatchedTextureFrom = true;
};

export const applyPixiCompat = <TPixi: { [string]: any }>(pixi: TPixi): TPixi => {
  if (!pixi) return pixi;

  addIfMissing(pixi, 'filters', {});

  if (!pixi.BaseTexture && pixi.TextureSource) {
    pixi.BaseTexture = pixi.TextureSource;
  }

  if (
    pixi.BaseTexture &&
    !pixi.BaseTexture.removeFromCache &&
    pixi.Texture &&
    pixi.Texture.removeFromCache
  ) {
    pixi.BaseTexture.removeFromCache = pixi.Texture.removeFromCache;
  }

  if (!pixi.RENDERER_TYPE && pixi.RendererType) {
    pixi.RENDERER_TYPE = pixi.RendererType;
  }

  if (!pixi.TEXT_GRADIENT) {
    pixi.TEXT_GRADIENT = {
      LINEAR_VERTICAL: 0,
      LINEAR_HORIZONTAL: 1,
    };
  }

  if (!pixi.BLEND_MODES) {
    if (pixi.BlendMode) {
      pixi.BLEND_MODES = pixi.BlendMode;
    } else {
      pixi.BLEND_MODES = {
        NORMAL: 'normal',
        ADD: 'add',
        MULTIPLY: 'multiply',
        SCREEN: 'screen',
        OVERLAY: 'overlay',
        DARKEN: 'darken',
        LIGHTEN: 'lighten',
        COLOR_DODGE: 'color-dodge',
        COLOR_BURN: 'color-burn',
        HARD_LIGHT: 'hard-light',
        SOFT_LIGHT: 'soft-light',
        DIFFERENCE: 'difference',
        EXCLUSION: 'exclusion',
        HUE: 'hue',
        SATURATION: 'saturation',
        COLOR: 'color',
        LUMINOSITY: 'luminosity',
        ERASE: 'erase',
        SUBTRACT: 'subtract',
        XOR: 'xor',
      };
    }
  }

  pixi.DRAW_MODES = LEGACY_DRAW_MODES;
  pixi.SCALE_MODES = LEGACY_SCALE_MODES;
  pixi.WRAP_MODES = LEGACY_WRAP_MODES;

  if (!pixi.settings) pixi.settings = {};
  addIfMissing(pixi.settings, 'ROUND_PIXELS', false);

  if (!pixi.ExtensionType) pixi.ExtensionType = {};
  addIfMissing(pixi.ExtensionType, 'RendererPlugin', []);
  addIfMissing(pixi.ExtensionType, 'CanvasRendererPlugin', []);

  if (!pixi.utils) pixi.utils = {};

  if (!pixi.utils.hex2rgb) {
    pixi.utils.hex2rgb = function(hex, out) {
      const rgb = out || [0, 0, 0];
      rgb[0] = ((hex >> 16) & 255) / 255;
      rgb[1] = ((hex >> 8) & 255) / 255;
      rgb[2] = (hex & 255) / 255;
      return rgb;
    };
  }

  if (!pixi.utils.hex2string) {
    pixi.utils.hex2string = function(hex) {
      let normalized = (hex >>> 0).toString(16);
      while (normalized.length < 6) normalized = `0${normalized}`;
      return `#${normalized}`;
    };
  }

  if (!pixi.utils.string2hex) {
    pixi.utils.string2hex = function(value) {
      if (typeof value !== 'string') return 0;
      let normalized = value.trim();
      if (!normalized) return 0;
      if (normalized[0] === '#') normalized = normalized.slice(1);
      if (normalized.length === 3) {
        normalized =
          normalized[0] +
          normalized[0] +
          normalized[1] +
          normalized[1] +
          normalized[2] +
          normalized[2];
      }
      const parsed = Number.parseInt(normalized, 16);
      return Number.isFinite(parsed) ? parsed : 0;
    };
  }

  if (!pixi.utils.rgb2hex) {
    pixi.utils.rgb2hex = function(rgb) {
      return (
        ((Math.round((rgb[0] || 0) * 255) & 255) << 16) |
        ((Math.round((rgb[1] || 0) * 255) & 255) << 8) |
        (Math.round((rgb[2] || 0) * 255) & 255)
      );
    };
  }

  if (!pixi.utils.createIndicesForQuads && pixi.createIndicesForQuads) {
    pixi.utils.createIndicesForQuads = pixi.createIndicesForQuads;
  }

  patchLegacyTextureFrom(pixi);
  patchLegacyEventListeners(pixi);
  patchLegacyRendererReset(pixi);

  if (typeof global !== 'undefined') {
    global.PIXI = pixi;
  }

  return pixi;
};

export default applyPixiCompat;
