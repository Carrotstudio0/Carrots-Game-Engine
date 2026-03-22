// @flow
import * as PIXI from 'pixi.js';

const ensureTextureReadyPromises: WeakMap<Object, Promise<any>> = new WeakMap();

const rememberEnsureTextureReadyPromise = (
  source: Object,
  promise: Promise<any>
): Promise<any> => {
  ensureTextureReadyPromises.set(source, promise);
  promise.finally(() => {
    if (ensureTextureReadyPromises.get(source) === promise) {
      ensureTextureReadyPromises.delete(source);
    }
  });
  return promise;
};

const getTextureSource = (texture: any): any => {
  if (!texture) return null;

  return texture.source || texture.baseTexture || null;
};

const updateTextureSource = (texture: any) => {
  const source = getTextureSource(texture);
  if (source && typeof source.update === 'function') {
    source.update();
  }
  if (texture && typeof texture.update === 'function') {
    texture.update();
  }
};

const getTextureDomResource = (texture: any): any => {
  const source = getTextureSource(texture);
  if (!source) return null;

  if (source.resource && source.resource.source) {
    return source.resource.source;
  }

  return source.resource || null;
};

const isLoadedImageLikeResource = (resource: any): boolean =>
  !!(
    resource &&
    typeof resource.complete === 'boolean' &&
    resource.complete &&
    (resource.naturalWidth || resource.width)
  );

const isLoadedVideoLikeResource = (resource: any): boolean =>
  !!(
    resource &&
    typeof resource.readyState === 'number' &&
    resource.readyState >= 2 &&
    (resource.videoWidth || resource.width)
  );

const isTextureReady = (texture: any): boolean => {
  const source = getTextureSource(texture);
  if (!source) return false;

  const domResource = getTextureDomResource(texture);
  if (!domResource) {
    return true;
  }

  if (isLoadedImageLikeResource(domResource) || isLoadedVideoLikeResource(domResource)) {
    return true;
  }

  return !!(
    source.isValid ||
    (typeof source.width === 'number' &&
      typeof source.height === 'number' &&
      source.width > 0 &&
      source.height > 0)
  );
};

const callNativeLoadIfAny = (texture: any) => {
  const source = getTextureSource(texture);
  const domResource = getTextureDomResource(texture);

  if (source && typeof source.load === 'function') {
    return source.load();
  }

  if (domResource && typeof domResource.load === 'function') {
    return domResource.load();
  }

  return null;
};

const waitForTextureResource = (texture: any): Promise<any> => {
  if (isTextureReady(texture)) {
    updateTextureSource(texture);
    return Promise.resolve(texture);
  }

  const source = getTextureSource(texture);
  if (!source) {
    return Promise.resolve(texture);
  }

  const pendingPromise = ensureTextureReadyPromises.get(source);
  if (pendingPromise) {
    return pendingPromise;
  }

  const domResource = getTextureDomResource(texture);
  if (
    !domResource ||
    typeof domResource.addEventListener !== 'function' ||
    typeof domResource.removeEventListener !== 'function'
  ) {
    const loadPromise = callNativeLoadIfAny(texture);
    if (!loadPromise || typeof loadPromise.then !== 'function') {
      updateTextureSource(texture);
      return Promise.resolve(texture);
    }

    const promise = Promise.resolve(loadPromise).then(() => {
      updateTextureSource(texture);
      return texture;
    });
    return rememberEnsureTextureReadyPromise(source, promise);
  }

  const readyEvents = isLoadedVideoLikeResource(domResource)
    ? ['loadeddata', 'canplay', 'canplaythrough']
    : domResource.tagName === 'VIDEO'
    ? ['loadeddata', 'canplay', 'canplaythrough']
    : ['load'];

  const promise = new Promise((resolve, reject) => {
    const cleanup = () => {
      readyEvents.forEach(eventName =>
        domResource.removeEventListener(eventName, handleReady)
      );
      domResource.removeEventListener('error', handleError);
    };

    const handleReady = () => {
      cleanup();
      updateTextureSource(texture);
      resolve(texture);
    };

    const handleError = event => {
      cleanup();
      reject(event && event.error ? event.error : event);
    };

    if (isTextureReady(texture)) {
      handleReady();
      return;
    }

    readyEvents.forEach(eventName =>
      domResource.addEventListener(eventName, handleReady)
    );
    domResource.addEventListener('error', handleError);

    const loadPromise = callNativeLoadIfAny(texture);
    if (loadPromise && typeof loadPromise.then === 'function') {
      loadPromise.then(handleReady, handleError);
    }
  });

  return rememberEnsureTextureReadyPromise(source, promise);
};

const createTextureFromResource = (
  resource: any,
  options?: { [string]: any }
): any => {
  if (resource instanceof PIXI.Texture) {
    return resource;
  }

  const normalizedOptions = options || {};
  const { autoStart = true, ...textureOptions } = normalizedOptions;
  const texture = PIXI.Texture.from({
    ...textureOptions,
    resource,
  });

  if (texture && typeof textureOptions.scaleMode !== 'undefined') {
    setTextureScaleMode(texture, textureOptions.scaleMode);
  }

  if (texture && autoStart) {
    waitForTextureResource(texture).catch(() => {});
  }

  return texture;
};

const ensureTextureReady = (texture: any): Promise<any> =>
  waitForTextureResource(texture);

const setTextureScaleMode = (texture: any, scaleMode: string) => {
  const source = getTextureSource(texture);
  if (source) {
    source.scaleMode = scaleMode;
  }
};

const renderToRenderTexture = (
  renderer: any,
  container: any,
  renderTexture: any,
  options?: {| clear?: boolean, clearColor?: [number, number, number, number] |}
) => {
  renderer.render({
    container,
    target: renderTexture,
    clear: options && typeof options.clear !== 'undefined' ? options.clear : true,
    clearColor: options && options.clearColor ? options.clearColor : undefined,
  });
};

const getSharedGlTextureForThree = (renderer: any, texture: any): any => {
  const source = getTextureSource(texture);
  if (!renderer || !renderer.texture || !source) {
    return null;
  }

  if (typeof renderer.texture.getGlSource === 'function') {
    try {
      return renderer.texture.getGlSource(source);
    } catch {
      // Fallback to legacy GPU data lookup below.
    }
  }

  const gpuData = source._gpuData || source._glTextures;
  if (!gpuData) {
    return null;
  }

  if (typeof renderer.uid === 'number' && gpuData[renderer.uid]) {
    return gpuData[renderer.uid];
  }

  if (
    typeof renderer.CONTEXT_UID !== 'undefined' &&
    gpuData[renderer.CONTEXT_UID]
  ) {
    return gpuData[renderer.CONTEXT_UID];
  }

  return null;
};

const bindPixiEvent = (
  displayObject: any,
  eventName: string,
  listener: Function,
  context?: any
) => {
  if (displayObject && typeof displayObject.on === 'function') {
    displayObject.on(eventName, listener, context);
    return;
  }

  if (displayObject && typeof displayObject.addEventListener === 'function') {
    displayObject.addEventListener(eventName, listener, context);
  }
};

const getPixiEventData = (event: any): any => {
  if (!event) return null;
  return event.data || event;
};

const getPixiGlobalPoint = (event: any): {| x: number, y: number |} => {
  const data = getPixiEventData(event);
  const globalPoint = data && data.global ? data.global : null;
  return {
    x: globalPoint && typeof globalPoint.x === 'number' ? globalPoint.x : 0,
    y: globalPoint && typeof globalPoint.y === 'number' ? globalPoint.y : 0,
  };
};

const getPixiOriginalEvent = (event: any): any => {
  const data = getPixiEventData(event);
  if (!data) return null;
  return (
    data.originalEvent || data.nativeEvent || event.originalEvent || event.nativeEvent || null
  );
};

const getPixiMouseButton = (event: any): number => {
  const originalEvent = getPixiOriginalEvent(event);
  if (originalEvent && typeof originalEvent.button === 'number') {
    return originalEvent.button;
  }

  const pointerType = originalEvent && originalEvent.pointerType;
  if (pointerType === 'touch') {
    return 0;
  }

  return 0;
};

const isPixiPrimaryEvent = (event: any): boolean => {
  const data = getPixiEventData(event);
  if (data && typeof data.isPrimary === 'boolean') {
    return data.isPrimary;
  }

  const originalEvent = getPixiOriginalEvent(event);
  if (originalEvent && typeof originalEvent.isPrimary === 'boolean') {
    return originalEvent.isPrimary;
  }

  return true;
};

const unbindPixiEvent = (
  displayObject: any,
  eventName: string,
  listener: Function,
  context?: any
) => {
  if (displayObject && typeof displayObject.off === 'function') {
    displayObject.off(eventName, listener, context);
    return;
  }

  if (displayObject && typeof displayObject.removeEventListener === 'function') {
    displayObject.removeEventListener(eventName, listener, context);
  }
};

const EditorPixiAdapter = {
  bindPixiEvent,
  createTextureFromResource,
  ensureTextureReady,
  getSharedGlTextureForThree,
  getPixiGlobalPoint,
  getPixiMouseButton,
  getPixiOriginalEvent,
  getTextureDomResource,
  getTextureSource,
  isPixiPrimaryEvent,
  isTextureReady,
  renderToRenderTexture,
  setTextureScaleMode,
  unbindPixiEvent,
};

export {
  bindPixiEvent,
  createTextureFromResource,
  ensureTextureReady,
  getSharedGlTextureForThree,
  getPixiGlobalPoint,
  getPixiMouseButton,
  getPixiOriginalEvent,
  getTextureDomResource,
  getTextureSource,
  isPixiPrimaryEvent,
  isTextureReady,
  renderToRenderTexture,
  setTextureScaleMode,
  unbindPixiEvent,
};

export default EditorPixiAdapter;
