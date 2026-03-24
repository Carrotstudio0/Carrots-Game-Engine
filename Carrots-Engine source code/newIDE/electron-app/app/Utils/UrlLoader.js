const { protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const developmentServerBaseUrl = 'http://localhost:3000';
const appPublicFolderBasePath = path.resolve(__dirname, '..', 'www');
const appPublicFolderBaseFileUrl = pathToFileURL(
  appPublicFolderBasePath + path.sep
).toString();

const getMimeTypeForPath = requestPath => {
  const extension = path.extname(requestPath).toLowerCase();
  if (extension === '.js' || extension === '.mjs') {
    return 'application/javascript';
  }
  if (extension === '.json') {
    return 'application/json';
  }
  if (extension === '.wasm') {
    return 'application/wasm';
  }
  if (extension === '.css') {
    return 'text/css';
  }
  if (extension === '.html') {
    return 'text/html';
  }
  if (extension === '.svg') {
    return 'image/svg+xml';
  }
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  if (extension === '.ico') {
    return 'image/x-icon';
  }
  if (extension === '.woff') {
    return 'font/woff';
  }
  if (extension === '.woff2') {
    return 'font/woff2';
  }
  return 'application/octet-stream';
};

const getSafeLocalPathForRequest = requestUrl => {
  const requestPath = requestUrl.replace('gdide://', '');
  const decodedPath = decodeURIComponent(requestPath.split('?')[0].split('#')[0]);
  const relativePath = decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(appPublicFolderBasePath, relativePath);

  if (
    resolvedPath !== appPublicFolderBasePath &&
    !resolvedPath.startsWith(appPublicFolderBasePath + path.sep)
  ) {
    throw new Error(`Blocked gdide path traversal: ${requestUrl}`);
  }

  return resolvedPath;
};

/**
 * Load the given path, relative to the app public folder.
 */
const load = ({ isDev, devTools, path: appPath, window }) => {
  if (isDev) {
    // Development (server hosted by npm run start)
    window.loadURL(developmentServerBaseUrl + appPath);
    window.openDevTools();
  } else {
    // Production (with npm run build)
    window.loadURL(new URL(appPath, appPublicFolderBaseFileUrl).toString());
    if (devTools) window.openDevTools();
  }
};

/**
 * Register gdide:// scheme to load JavaScript files in Electron.
 * Useful in particular for HTML modules support (where file:// protocol is not supported).
 */
const registerGdideProtocol = ({ isDev }) => {
  if (isDev) {
    protocol.registerHttpProtocol('gdide', (request, callback) => {
      callback({
        method: request.method,
        referrer: request.referrer,
        url: request.url.replace('gdide://', developmentServerBaseUrl + '/'),
      });
    });
  } else {
    // Production (with npm run build)
    protocol.registerBufferProtocol('gdide', (request, callback) => {
      let resolvedPath = null;
      try {
        resolvedPath = getSafeLocalPathForRequest(request.url);
      } catch (error) {
        console.error('Rejected gdide request.', request.url, error);
        callback({ statusCode: 404, data: Buffer.from('') });
        return;
      }

      fs.readFile(resolvedPath, (error, buffer) => {
        if (error) {
          console.error('While loading ' + request.url, error);
          callback({ statusCode: 404, data: Buffer.from('') });
          return;
        }

        callback({
          mimeType: getMimeTypeForPath(resolvedPath),
          data: buffer,
        });
      });
    });
  }

  const isRegistered = protocol.isProtocolRegistered('gdide');
  if (!isRegistered) console.error('Error while registering gdide protocol.');
};

module.exports = {
  load,
  registerGdideProtocol,
};
