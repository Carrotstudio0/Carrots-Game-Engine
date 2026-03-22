const mockTextureFrom = jest.fn();

jest.mock('pixi.js', () => {
  class MockTexture {
    constructor(resource) {
      this.source = {
        resource,
        update: jest.fn(),
        _gpuData: Object.create(null),
      };
      this.update = jest.fn();
    }
  }

  MockTexture.from = (...args) => mockTextureFrom(...args);

  return {
    Texture: MockTexture,
  };
});

const PIXI = require('pixi.js');
const {
  bindPixiEvent,
  createTextureFromResource,
  ensureTextureReady,
  getSharedGlTextureForThree,
  getTextureDomResource,
  getTextureSource,
  isTextureReady,
  renderToRenderTexture,
  setTextureScaleMode,
  unbindPixiEvent,
} = require('./EditorPixiAdapter');

describe('EditorPixiAdapter', () => {
  beforeEach(() => {
    mockTextureFrom.mockReset();
    mockTextureFrom.mockImplementation(options => {
      const texture = new PIXI.Texture(options.resource);
      texture.source.scaleMode = options.scaleMode;
      return texture;
    });
  });

  it('creates Pixi textures from raw resources through a single adapter entrypoint', () => {
    const resource = { complete: true, naturalWidth: 32, width: 32 };
    const texture = createTextureFromResource(resource, {
      scaleMode: 'nearest',
      autoStart: false,
    });

    expect(mockTextureFrom).toHaveBeenCalledWith({
      resource,
      scaleMode: 'nearest',
    });
    expect(texture.source.resource).toBe(resource);
    expect(texture.source.scaleMode).toBe('nearest');
  });

  it('resolves image readiness and updates the texture source', async () => {
    const listeners = {};
    const resource = {
      complete: false,
      naturalWidth: 0,
      width: 0,
      addEventListener: jest.fn((eventName, listener) => {
        listeners[eventName] = listener;
      }),
      removeEventListener: jest.fn((eventName, listener) => {
        if (listeners[eventName] === listener) {
          delete listeners[eventName];
        }
      }),
    };
    const texture = {
      source: {
        resource,
        update: jest.fn(),
      },
      update: jest.fn(),
    };

    const promise = ensureTextureReady(texture);
    resource.complete = true;
    resource.naturalWidth = 64;
    resource.width = 64;
    listeners.load();

    await expect(promise).resolves.toBe(texture);
    expect(texture.source.update).toHaveBeenCalledTimes(1);
    expect(texture.update).toHaveBeenCalledTimes(1);
    expect(isTextureReady(texture)).toBe(true);
  });

  it('reads the nested DOM resource and exposes the public texture source', () => {
    const domResource = { tagName: 'IMG' };
    const source = { resource: { source: domResource } };
    const texture = { source };

    expect(getTextureSource(texture)).toBe(source);
    expect(getTextureDomResource(texture)).toBe(domResource);
  });

  it('renders to Pixi render textures with the v8 target API', () => {
    const renderer = { render: jest.fn() };
    const container = { label: 'layer' };
    const renderTexture = { label: 'target' };

    renderToRenderTexture(renderer, container, renderTexture, {
      clear: true,
      clearColor: [0, 0, 0, 0],
    });

    expect(renderer.render).toHaveBeenCalledWith({
      container,
      target: renderTexture,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
  });

  it('extracts the shared WebGL texture from the public Pixi renderer texture system', () => {
    const glTexture = { texture: { id: 'shared-gl-texture' } };
    const texture = { source: { _gpuData: Object.create(null) } };
    const renderer = {
      texture: {
        getGlSource: jest.fn(() => glTexture),
      },
    };

    expect(getSharedGlTextureForThree(renderer, texture)).toBe(glTexture);
    expect(renderer.texture.getGlSource).toHaveBeenCalledWith(texture.source);
  });

  it('normalizes Pixi display object events onto on/off', () => {
    const displayObject = {
      on: jest.fn(),
      off: jest.fn(),
    };
    const listener = jest.fn();

    bindPixiEvent(displayObject, 'pointerdown', listener);
    unbindPixiEvent(displayObject, 'pointerdown', listener);
    setTextureScaleMode({ source: {} }, 'linear');

    expect(displayObject.on).toHaveBeenCalledWith(
      'pointerdown',
      listener,
      undefined
    );
    expect(displayObject.off).toHaveBeenCalledWith(
      'pointerdown',
      listener,
      undefined
    );
  });
});
