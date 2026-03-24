// @flow
import path from 'path-browserify';
import {
  deleteFilesWithPrefix,
  putFile,
} from './BrowserSWPreviewLauncher/BrowserSWPreviewIndexedDB';
const gd: libGDevelop = global.gd;

export type TextFileDescriptor = {|
  filePath: string,
  text: string,
|};

type ConstructorArgs = {|
  filesContent: Array<TextFileDescriptor>,
  rootUrl: string,
|};

const isURL = (filename: string) => {
  return (
    filename.startsWith('http://') ||
    filename.startsWith('https://') ||
    filename.startsWith('ftp://') ||
    filename.startsWith('blob:') ||
    filename.startsWith('data:')
  );
};

/**
 * Determines the content type based on file extension.
 */
const getContentType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

const stripSearchAndHash = (value: string): string => {
  const hashSeparatorIndex = value.indexOf('#');
  const valueWithoutHash =
    hashSeparatorIndex === -1 ? value : value.substring(0, hashSeparatorIndex);
  const querySeparatorIndex = valueWithoutHash.indexOf('?');
  return querySeparatorIndex === -1
    ? valueWithoutHash
    : valueWithoutHash.substring(0, querySeparatorIndex);
};

const normalizeSlashes = (value: string): string =>
  value.replace(/\\/g, '/').replace(/\/{2,}/g, '/');

const getPathnameFromUrl = (value: string): string => {
  try {
    return new URL(value).pathname;
  } catch (error) {
    return value;
  }
};

const toBrowserSWRelativePath = (
  fullPathOrUrl: string,
  rootUrl: string
): string => {
  const input = normalizeSlashes(stripSearchAndHash(fullPathOrUrl));
  const root = normalizeSlashes(stripSearchAndHash(rootUrl));
  const rootPathname = normalizeSlashes(getPathnameFromUrl(root));

  let relativePath = input;
  if (relativePath.startsWith(root)) {
    relativePath = relativePath.substring(root.length);
  } else if (relativePath.startsWith(rootPathname)) {
    relativePath = relativePath.substring(rootPathname.length);
  } else {
    const inputPathname = normalizeSlashes(getPathnameFromUrl(relativePath));
    if (inputPathname.startsWith(rootPathname)) {
      relativePath = inputPathname.substring(rootPathname.length);
    } else {
      relativePath = inputPathname;
    }
  }

  return normalizeSlashes(relativePath).replace(/^\/+/, '');
};

const isJavaScriptFileUrl = (fileUrl: string): boolean => {
  const pathWithoutSearchParams = fileUrl.split('?')[0].toLowerCase();
  return (
    pathWithoutSearchParams.endsWith('.js') ||
    pathWithoutSearchParams.endsWith('.mjs')
  );
};

const removeNonJavaScriptScriptTags = (htmlContent: string): string =>
  htmlContent.replace(
    /<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>\s*/gi,
    (scriptTag, _quote, scriptSrc) =>
      isJavaScriptFileUrl(scriptSrc) ? scriptTag : ''
  );

const addSearchParameterToUrl = (
  url: string,
  parameterName: string,
  parameterValue: string
): string => {
  const hashSeparatorIndex = url.indexOf('#');
  const urlWithoutHash =
    hashSeparatorIndex === -1 ? url : url.substring(0, hashSeparatorIndex);
  const hash = hashSeparatorIndex === -1 ? '' : url.substring(hashSeparatorIndex);

  const querySeparatorIndex = urlWithoutHash.indexOf('?');
  const baseUrl =
    querySeparatorIndex === -1
      ? urlWithoutHash
      : urlWithoutHash.substring(0, querySeparatorIndex);
  const rawSearchParams =
    querySeparatorIndex === -1
      ? ''
      : urlWithoutHash.substring(querySeparatorIndex + 1);

  const searchParams = new URLSearchParams(rawSearchParams);
  searchParams.set(parameterName, parameterValue);
  const serializedSearchParams = searchParams.toString();

  return (
    baseUrl +
    (serializedSearchParams ? `?${serializedSearchParams}` : '') +
    hash
  );
};

const addJavaScriptScriptsCacheBurst = (
  htmlContent: string,
  cacheBurstValue: string
): string =>
  htmlContent.replace(
    /<script\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi,
    (match, beforeSrc, quote, scriptSrc, afterSrc) => {
      if (!isJavaScriptFileUrl(scriptSrc)) return match;
      if (/[?&]gdRuntimeCacheBurst=/i.test(scriptSrc)) return match;

      const srcWithCacheBurst = addSearchParameterToUrl(
        scriptSrc,
        'gdRuntimeCacheBurst',
        cacheBurstValue
      );
      return `<script${beforeSrc}src=${quote}${srcWithCacheBurst}${quote}${afterSrc}></script>`;
    }
  );

const ensureMultithreadingManagerScriptTag = (
  htmlContent: string
): string => {
  if (/multithreadingmanager\.js/i.test(htmlContent)) return htmlContent;

  const runtimeGameScriptTagRegex =
    /<script\b[^>]*\bsrc=(["'])([^"']*runtimegame\.js[^"']*)\1[^>]*>\s*<\/script>/i;
  const runtimeGameScriptTagMatch = htmlContent.match(runtimeGameScriptTagRegex);
  if (!runtimeGameScriptTagMatch) return htmlContent;

  const runtimeGameScriptSrc = runtimeGameScriptTagMatch[2];
  const multithreadingManagerScriptSrc = runtimeGameScriptSrc.replace(
    /runtimegame\.js/i,
    'multithreadingmanager.js'
  );
  const multithreadingManagerScriptTag = `<script src="${multithreadingManagerScriptSrc}" crossorigin="anonymous"></script>\n`;

  return htmlContent.replace(
    runtimeGameScriptTagRegex,
    `${multithreadingManagerScriptTag}${runtimeGameScriptTagMatch[0]}`
  );
};

/**
 * An in-memory "file system" that stores files in IndexedDB
 * and serves them via a service worker for GDevelop previews.
 */
export default class BrowserSWFileSystem {
  rootUrl: string;

  _runtimeScriptsCacheBurst: string;

  // Store the content of some files.
  _indexedFilesContent: { [string]: TextFileDescriptor };

  // Store all the files that should be written to IndexedDB.
  _pendingFiles: Array<{|
    path: string,
    content: string,
    contentType: string,
  |}> = [];

  _pendingDeleteOperations: Array<Promise<any>> = [];

  // Store a set of all external URLs copied so that we can simulate
  // readDir result.
  // $FlowFixMe[missing-local-annot]
  _allCopiedExternalUrls = (new Set<string>(): Set<string>);

  constructor({ filesContent, rootUrl }: ConstructorArgs) {
    this.rootUrl = rootUrl;
    this._runtimeScriptsCacheBurst = `${Date.now()}`;

    this._indexedFilesContent = {};
    filesContent.forEach(textFileDescriptor => {
      this._indexedFilesContent[
        textFileDescriptor.filePath
      ] = textFileDescriptor;
    });
  }

  /**
   * Uploads all pending files to IndexedDB.
   */
  // $FlowFixMe[missing-local-annot]
  applyPendingOperations = async () => {
    try {
      await Promise.all(this._pendingDeleteOperations);
    } catch (error) {
      console.error(
        '[BrowserSWFileSystem] Error while deleting files in IndexedDB. Ignoring.',
        error
      );
    }

    try {
      console.log(
        `[BrowserSWFileSystem] Storing ${
          this._pendingFiles.length
        } files in IndexedDB for preview...`
      );

      let totalBytes = 0;
      const uploadPromises = this._pendingFiles.map(async file => {
        const fullPath = normalizeSlashes(
          file.path.startsWith('/') ? file.path : `/${file.path}`
        );
        const encoder = new TextEncoder();
        const bytes = encoder.encode(file.content).buffer;

        totalBytes += bytes.byteLength;

        await putFile(fullPath, bytes, file.contentType);
      });

      await Promise.all(uploadPromises);

      console.log(
        `[BrowserSWFileSystem] Successfully stored all ${
          this._pendingFiles.length
        } preview files in IndexedDB (${Math.ceil(totalBytes / 1000)} kB).`
      );
    } catch (error) {
      console.error(
        "[BrowserSWFileSystem] Can't store all files in IndexedDB:",
        error
      );
      throw error;
    }
  };

  mkDir = (path: string) => {
    // Assume required directories always exist in a virtual file system.
  };

  dirExists = (path: string): any => {
    // Assume required directories always exist.
    return true;
  };

  clearDir = (path: string) => {
    console.info(`[BrowserSWFileSystem] Clearing directory: ${path}...`);
    const relativePath = toBrowserSWRelativePath(path, this.rootUrl);
    const normalizedPrefix = relativePath ? `/${relativePath}` : '/';
    const prefixWithTrailingSlash = normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : `${normalizedPrefix}/`;
    this._pendingDeleteOperations.push(
      deleteFilesWithPrefix(prefixWithTrailingSlash)
    );
  };

  getTempDir = (): any => {
    return '/virtual-unused-tmp-dir';
  };

  fileNameFrom = (fullpath: string): any => {
    if (isURL(fullpath)) return fullpath;
    return path.basename(fullpath);
  };

  dirNameFrom = (fullpath: string): any => {
    if (isURL(fullpath)) return '';
    return path.dirname(fullpath);
  };

  makeAbsolute = (filename: string, baseDirectory: string): any => {
    if (isURL(filename)) return filename;

    if (!this.isAbsolute(baseDirectory))
      baseDirectory = path.resolve(baseDirectory);

    if (isURL(baseDirectory)) {
      return baseDirectory + '/' + filename;
    }

    return path.resolve(baseDirectory, path.normalize(filename));
  };

  makeRelative = (filename: string, baseDirectory: string): any => {
    if (isURL(filename)) return filename;
    return path.relative(baseDirectory, path.normalize(filename));
  };

  isAbsolute = (fullpath: string): any => {
    if (isURL(fullpath)) return true;
    if (fullpath.length === 0) return true;
    return (
      (fullpath.length > 0 && fullpath.charAt(0) === '/') ||
      (fullpath.length > 1 && fullpath.charAt(1) === ':')
    );
  };

  copyFile = (source: string, dest: string): any => {
    // URLs are not copied, just tracked.
    if (isURL(source)) {
      this._allCopiedExternalUrls.add(source);
      return true;
    }

    console.warn(
      '[BrowserSWFileSystem] Copy not done from',
      source,
      'to',
      dest
    );
    return true;
  };

  writeToFile = (fullPath: string, contents: string): any => {
    // Remove the base URL to get the relative path
    const relativePath = toBrowserSWRelativePath(fullPath, this.rootUrl);
    const contentType = getContentType(relativePath || fullPath);
    const normalizedRelativePath = relativePath.toLowerCase();
    const sanitizedContents =
      normalizedRelativePath.endsWith('/index.html') ||
      normalizedRelativePath === 'index.html'
        ? addJavaScriptScriptsCacheBurst(
            ensureMultithreadingManagerScriptTag(
              removeNonJavaScriptScriptTags(contents)
            ),
            this._runtimeScriptsCacheBurst
          )
        : contents;

    // Queue the file to be written to IndexedDB
    this._pendingFiles.push({
      path: relativePath,
      content: sanitizedContents,
      contentType,
    });

    return true;
  };

  readFile = (file: string): any => {
    if (!!this._indexedFilesContent[file])
      return this._indexedFilesContent[file].text;

    console.error(
      `[BrowserSWFileSystem] Unknown file ${file}, returning an empty string`
    );
    return '';
  };

  readDir = (path: string, ext: string): any => {
    ext = ext.toUpperCase();
    var output = new gd.VectorString();

    // Simulate ReadDir by returning all external URLs
    // with the filename matching the extension.
    this._allCopiedExternalUrls.forEach(url => {
      const upperCaseUrl = url.toUpperCase();
      if (upperCaseUrl.indexOf(ext) === upperCaseUrl.length - ext.length) {
        output.push_back(url);
      }
    });

    return output;
  };

  fileExists = (filename: string): any => {
    if (isURL(filename)) return true;

    // Assume all files asked for exist.
    return true;
  };
}
