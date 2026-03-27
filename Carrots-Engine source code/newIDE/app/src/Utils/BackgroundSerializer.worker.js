/* eslint-env worker */
// @flow

let modulePromise /*: ?Promise<libGDevelop>*/ = null;
// eslint-disable-next-line no-restricted-globals
const workerScope = typeof self !== 'undefined' ? self : {};
const workerLocation = workerScope.location;
const isLikelyLocalhost =
  !!workerLocation &&
  /(localhost|127\.0\.0\.1|\[::1\])/.test(workerLocation.hostname || '');

const buildVersionedAssetUrl = (
  fileName /*: string */,
  versionWithHash /*: string */
) /*: string */ => {
  const normalizedFileName = (fileName || '').replace(/^\/+/, '');
  const cacheBuster = isLikelyLocalhost
    ? `${versionWithHash}-${Date.now()}`
    : versionWithHash;
  const query = `cache-buster=${cacheBuster}`;
  const protocol = workerLocation && workerLocation.protocol;
  const href = workerLocation && workerLocation.href;

  // For Electron workers loaded from `file://`, absolute root paths fail.
  // Resolve assets relative to the worker file location.
  if (protocol === 'file:' && href) {
    try {
      return new URL(`${normalizedFileName}?${query}`, href).toString();
    } catch (error) {
      return `./${normalizedFileName}?${query}`;
    }
  }

  const origin = (workerLocation && workerLocation.origin) || '';
  if (!origin || origin === 'null') {
    return `./${normalizedFileName}?${query}`;
  }
  return `${origin}/${normalizedFileName}?${query}`;
};

const log = (message /*: string */) => {
  console.log(`[BackgroundSerializerWorker] ${message}`);
};

const getLibGDevelop = (versionWithHash /*: string */) => {
  if (modulePromise) return modulePromise;

  modulePromise = new Promise((resolve, reject) => {
    try {
      const libGdScriptUrl = buildVersionedAssetUrl('libGD.js', versionWithHash);
      // Load libGD.js in the worker context.
      // eslint-disable-next-line no-undef
      importScripts(libGdScriptUrl);

      /* eslint-disable no-undef */
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[cannot-resolve-name]
      if (typeof initializeGDevelopJs !== 'function') {
        /* eslint-enable no-undef */
        reject(new Error('Missing initializeGDevelopJs in worker'));
        return;
      }

      /* eslint-disable no-undef */
      // $FlowFixMe[cannot-resolve-name]
      initializeGDevelopJs({
        /* eslint-enable no-undef */
        // Override the resolved URL for the .wasm file,
        // to ensure a new version is fetched when the version changes.
        locateFile: (path /*: string */, prefix /*: string */) => {
          // This function is called by Emscripten to locate the .wasm file only.
          // Resolve to absolute public URL to avoid nested/chunk path resolution.
          return buildVersionedAssetUrl(path, versionWithHash);
        },
      })
        .then(module => {
          resolve(module);
        })
        .catch(reject);
    } catch (error) {
      reject(error);
      return;
    }
  }).catch(error => {
    modulePromise = null;
    throw error;
  });

  return modulePromise;
};

const unserializeBinarySnapshotToJson = (
  gd /*: libGDevelop */,
  binary /*: Uint8Array */
) => {
  const binaryArray =
    binary instanceof Uint8Array ? binary : new Uint8Array(binary);
  const binarySize = binaryArray.byteLength || binaryArray.length;

  // Allocate memory in Emscripten heap and copy binary data
  const binaryPtr = gd._malloc(binarySize);
  gd.HEAPU8.set(binaryArray, binaryPtr);

  const element = gd.BinarySerializer.deserializeBinarySnapshot(
    binaryPtr,
    binarySize
  );

  // Free the input buffer
  gd._free(binaryPtr);

  if (element.ptr === 0) {
    throw new Error('Failed to deserialize binary snapshot.');
  }

  const json = gd.Serializer.toJSON(element);
  element.delete();
  return json;
};

// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event /*: MessageEvent */) => {
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-use]
  const { type, binary, requestId, versionWithHash } = event.data || {};

  const startTime = Date.now();

  // $FlowFixMe[incompatible-type]
  log(`Request #${requestId} received (${type}).`);
  if (type !== 'SERIALIZE_TO_JSON' && type !== 'SERIALIZE_TO_JS_OBJECT') return;

  try {
    // $FlowFixMe[incompatible-type]
    const gd = await getLibGDevelop(versionWithHash);

    // $FlowFixMe[incompatible-type]
    const json = unserializeBinarySnapshotToJson(gd, binary);
    const result = type === 'SERIALIZE_TO_JSON' ? json : JSON.parse(json);

    // $FlowFixMe[incompatible-type]
    log(`Request #${requestId} done in ${Date.now() - startTime}ms.`);

    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'DONE',
      result,
      requestId,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'ERROR',
      requestId,
      message: error.message,
    });
  }
};
