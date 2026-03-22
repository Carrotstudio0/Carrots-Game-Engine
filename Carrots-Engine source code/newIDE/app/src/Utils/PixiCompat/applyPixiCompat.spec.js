import applyPixiCompat from './applyPixiCompat';

describe('applyPixiCompat', () => {
  const originalImage = global.Image;
  const originalDocument = global.document;

  beforeEach(() => {
    global.Image = function FakeImage() {
      this.tagName = 'IMG';
      this.crossOrigin = undefined;
      this.src = '';
    };
    global.document = {
      createElement: jest.fn(tagName => ({
        tagName: tagName.toUpperCase(),
        crossOrigin: undefined,
        autoplay: false,
        loop: false,
        muted: false,
        playsInline: false,
        preload: '',
        src: '',
      })),
    };
  });

  afterEach(() => {
    global.Image = originalImage;
    global.document = originalDocument;
  });

  const createCache = () => {
    const entries = new Map();
    return {
      has: jest.fn(key => entries.has(key)),
      get: jest.fn(key => entries.get(key)),
      set: jest.fn((key, value) => {
        entries.set(key, value);
      }),
      remove: jest.fn(key => {
        entries.delete(key);
      }),
    };
  };

  it('backfills the legacy Pixi namespace surface expected by old UMD plugins', () => {
    const removeFromCache = jest.fn();
    const isWebGLSupported = jest.fn(() => true);
    const cache = createCache();
    const containerOn = jest.fn();
    const containerOff = jest.fn();
    const originalTextureFrom = jest.fn((resource, skipCache) => ({
      resource,
      skipCache,
      on: jest.fn(),
      source: {
        resource: resource.resource,
        update: jest.fn(),
        uploadMethodId: 'video',
      },
    }));
    const pixi = {
      WebGLRenderer: function WebGLRenderer() {},
      TextureSource: function TextureSource() {},
      Texture: {
        removeFromCache,
        from: originalTextureFrom,
      },
      Container: function Container() {},
      RendererType: {
        WEBGL: 1,
      },
      BlendMode: {
        NORMAL: 'normal',
      },
      Cache: cache,
      isWebGLSupported,
    };
    pixi.Container.prototype.on = containerOn;
    pixi.Container.prototype.off = containerOff;

    const compatPixi = applyPixiCompat(pixi);
    const texture = compatPixi.Texture.from('video.mp4', {
      scaleMode: 'linear',
      resourceOptions: {
        autoPlay: false,
        crossorigin: 'anonymous',
      },
    });

    expect(compatPixi.Renderer).toBe(compatPixi.WebGLRenderer);
    expect(compatPixi.BaseTexture).toBe(compatPixi.TextureSource);
    expect(compatPixi.BaseTexture.removeFromCache).toBe(removeFromCache);
    expect(compatPixi.RENDERER_TYPE).toBe(compatPixi.RendererType);
    expect(compatPixi.TEXT_GRADIENT).toEqual({
      LINEAR_VERTICAL: 0,
      LINEAR_HORIZONTAL: 1,
    });
    expect(compatPixi.BLEND_MODES).toBe(compatPixi.BlendMode);
    expect(compatPixi.DRAW_MODES.TRIANGLES).toBe('triangle-list');
    expect(compatPixi.SCALE_MODES.LINEAR).toBe('linear');
    expect(compatPixi.WRAP_MODES.REPEAT).toBe('repeat');
    expect(compatPixi.settings.ROUND_PIXELS).toBe(false);
    expect(compatPixi.utils.hex2rgb(0xff8040)).toEqual([1, 128 / 255, 64 / 255]);
    expect(compatPixi.utils.hex2string(0x00ffaa)).toBe('#00ffaa');
    expect(compatPixi.utils.string2hex('#0fa')).toBe(0x00ffaa);
    expect(compatPixi.utils.rgb2hex([1, 0.5, 0])).toBe(0xff8000);
    expect(compatPixi.utils.isWebGLSupported).toBe(isWebGLSupported);
    expect(typeof compatPixi.Container.prototype.addEventListener).toBe('function');
    expect(typeof compatPixi.Container.prototype.removeEventListener).toBe('function');
    expect(texture).toEqual(expect.objectContaining({
      resource: {
        scaleMode: 'linear',
        autoPlay: false,
        crossorigin: 'anonymous',
        resource: expect.objectContaining({
          tagName: 'VIDEO',
        }),
      },
      skipCache: false,
      on: expect.any(Function),
    }));
    expect(texture.resource.resource.src).toContain('video.mp4');
    expect(texture.resource.resource.source).toBe(texture.resource.resource);
    expect(typeof texture.resource.resource.load).toBe('function');
    expect(texture.source.update).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith('video.mp4', texture);
  });

  it('preserves existing compatibility values when they are already defined', () => {
    const existingFilters = { some: 'filter' };
    const existingGradient = { LINEAR_VERTICAL: 10, LINEAR_HORIZONTAL: 20 };
    const existingUtils = {
      hex2string: jest.fn(() => 'keep'),
    };
    const pixi = {
      filters: existingFilters,
      TEXT_GRADIENT: existingGradient,
      utils: existingUtils,
      settings: {
        ROUND_PIXELS: true,
      },
    };

    const compatPixi = applyPixiCompat(pixi);

    expect(compatPixi.filters).toBe(existingFilters);
    expect(compatPixi.TEXT_GRADIENT).toBe(existingGradient);
    expect(compatPixi.utils.hex2string).toBe(existingUtils.hex2string);
    expect(compatPixi.settings.ROUND_PIXELS).toBe(true);
  });

  it('keeps using the cache lookup path for already cached string resources', () => {
    const cache = createCache();
    const originalTextureFrom = jest.fn((resource, skipCache) => ({
      resource,
      skipCache,
    }));
    const pixi = {
      TextureSource: function TextureSource() {},
      Texture: {
        from: originalTextureFrom,
      },
      Cache: cache,
    };
    cache.set('cached.png', { cached: true });

    const compatPixi = applyPixiCompat(pixi);
    const texture = compatPixi.Texture.from('cached.png');

    expect(texture).toEqual({
      resource: 'cached.png',
      skipCache: false,
    });
  });

  it('converts object-form string image resources to DOM image elements', async () => {
    const cache = createCache();
    const originalTextureFrom = jest.fn((resource, skipCache) => ({
      resource,
      skipCache,
      on: jest.fn(),
      source: {
        resource: resource.resource,
        update: jest.fn(),
        uploadMethodId: 'image',
      },
    }));
    const pixi = {
      TextureSource: function TextureSource() {},
      Texture: {
        from: originalTextureFrom,
      },
      Cache: cache,
    };

    const compatPixi = applyPixiCompat(pixi);
    const texture = compatPixi.Texture.from({
      resource: 'res/invalid_texture.png',
      crossorigin: 'anonymous',
      autoLoad: false,
    });

    expect(texture.resource).toEqual({
      crossorigin: 'anonymous',
      autoLoad: false,
      resource: expect.objectContaining({
        tagName: 'IMG',
      }),
    });
    expect(texture.resource.resource.src).toContain('res/invalid_texture.png');
    expect(texture.resource.resource.source).toBe(texture.resource.resource);
    await expect(texture.resource.resource.load()).resolves.toBe(
      texture.resource.resource
    );
    expect(texture.source.update).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('res/invalid_texture.png', texture);
  });

  it('adds legacy addEventListener/removeEventListener aliases to containers', () => {
    const on = jest.fn();
    const off = jest.fn();
    const pixi = {
      Container: function Container() {},
    };
    pixi.Container.prototype.on = on;
    pixi.Container.prototype.off = off;

    const compatPixi = applyPixiCompat(pixi);
    const container = new compatPixi.Container();
    const listener = jest.fn();

    container.addEventListener('pointerdown', listener);
    container.removeEventListener('pointerdown', listener);

    expect(on).toHaveBeenCalledWith('pointerdown', listener, undefined);
    expect(off).toHaveBeenCalledWith('pointerdown', listener, undefined);
  });

  it('adds the legacy reset alias to renderers', () => {
    const resetState = jest.fn();
    const pixi = {
      Renderer: function Renderer() {},
    };
    pixi.Renderer.prototype.resetState = resetState;

    const compatPixi = applyPixiCompat(pixi);
    const renderer = new compatPixi.Renderer();

    renderer.reset();

    expect(resetState).toHaveBeenCalledTimes(1);
  });
});
