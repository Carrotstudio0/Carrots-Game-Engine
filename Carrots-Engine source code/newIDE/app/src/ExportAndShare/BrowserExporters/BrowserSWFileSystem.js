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

type PendingFileDescriptor = {|
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
|};

type PendingExternalCopyDescriptor = {|
  source: string,
  dest: string,
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

// For some reason, `path.posix` is undefined when packaged
// with webpack, so we're using `path` directly. As it's for the web-app,
// it should always be the posix version. In tests on Windows,
// it's necessary to use path.posix.
const pathPosix = path.posix || path;

const encodeText = (content: string): ArrayBuffer => {
  const encoder = new TextEncoder();
  return encoder.encode(content).buffer;
};

const isOptionalExternalPreviewFile = (filePath: string): boolean => {
  return /\.map($|\?)/i.test(filePath);
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
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.xml': 'application/xml; charset=utf-8',
    '.fnt': 'application/xml; charset=utf-8',
    '.atlas': 'text/plain; charset=utf-8',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.txt': 'text/plain; charset=utf-8',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * An in-memory "file system" that stores files in IndexedDB
 * and serves them via a service worker for GDevelop previews.
 */
export default class BrowserSWFileSystem {
  rootUrl: string;

  // Store the content of some files.
  _indexedFilesContent: { [string]: TextFileDescriptor };

  // Store all the files that should be written to IndexedDB.
  _pendingFiles: Array<PendingFileDescriptor> = [];

  _pendingDeleteOperations: Array<Promise<any>> = [];

  _pendingExternalCopies: Array<PendingExternalCopyDescriptor> = [];

  // Store text files that are available from this virtual file system,
  // including files written during export. This is used to support copyFile
  // for generated files.
  _virtualTextFiles: { [string]: string } = {};

  // Store a mapping between copied destination files and the external URL
  // they were fetched from. This allows chained copy operations.
  _externalUrlsByDestination: { [string]: string } = {};

  // Store a set of all external URLs copied so that we can simulate
  // readDir result.
  // $FlowFixMe[missing-local-annot]
  _allCopiedExternalUrls = (new Set<string>(): Set<string>);

  constructor({ filesContent, rootUrl }: ConstructorArgs) {
    this.rootUrl = rootUrl;

    this._indexedFilesContent = {};
    filesContent.forEach(textFileDescriptor => {
      this._indexedFilesContent[
        textFileDescriptor.filePath
      ] = textFileDescriptor;
      this._virtualTextFiles[textFileDescriptor.filePath] =
        textFileDescriptor.text;
    });
  }

  _normalizeFilePath = (fullPath: string): string => {
    return isURL(fullPath) ? fullPath : pathPosix.normalize(fullPath);
  };

  _getRelativePath = (fullPath: string): string => {
    const relativePath = fullPath.replace(this.rootUrl, '');
    const normalizedPath = pathPosix.normalize(relativePath);
    return normalizedPath.startsWith('/')
      ? normalizedPath.substring(1)
      : normalizedPath;
  };

  _queuePendingFile = (
    fullPath: string,
    bytes: ArrayBuffer,
    contentType: string
  ) => {
    this._pendingFiles.push({
      path: this._getRelativePath(fullPath),
      bytes,
      contentType,
    });
  };

  _queuePendingTextFile = (fullPath: string, contents: string) => {
    const normalizedPath = this._normalizeFilePath(fullPath);
    this._virtualTextFiles[normalizedPath] = contents;
    this._queuePendingFile(
      fullPath,
      encodeText(contents),
      getContentType(fullPath)
    );
  };

  _queueExternalCopy = (source: string, dest: string) => {
    this._pendingExternalCopies.push({ source, dest });
  };

  _copyExternalFileIntoPendingFiles = async (
    source: string,
    dest: string
  ): Promise<void> => {
    if (isOptionalExternalPreviewFile(source)) {
      return;
    }

    const response = await fetch(source);
    if (!response.ok) {
      if (response.status === 404 && isOptionalExternalPreviewFile(source)) {
        return;
      }

      throw new Error(
        `[BrowserSWFileSystem] Error while copying "${source}" to "${dest}" (status: ${response.status})`
      );
    }

    const bytes = await response.arrayBuffer();
    const responseContentType =
      response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('content-type')
        : null;
    this._queuePendingFile(dest, bytes, responseContentType || getContentType(dest));
  };

  _resolvePendingExternalCopies = async () => {
    if (this._pendingExternalCopies.length === 0) {
      return;
    }

    const copies = this._pendingExternalCopies;
    const concurrency = Math.min(8, copies.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < copies.length) {
        const copyIndex = currentIndex;
        currentIndex += 1;
        const copyDescriptor = copies[copyIndex];
        await this._copyExternalFileIntoPendingFiles(
          copyDescriptor.source,
          copyDescriptor.dest
        );
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
  };

  _getStoredTextContent = (filePath: string): ?string => {
    const normalizedPath = this._normalizeFilePath(filePath);
    const normalizedIndexedFile = this._indexedFilesContent[normalizedPath];
    const rawIndexedFile = this._indexedFilesContent[filePath];

    if (typeof this._virtualTextFiles[normalizedPath] === 'string') {
      return this._virtualTextFiles[normalizedPath];
    }

    if (
      normalizedIndexedFile &&
      typeof normalizedIndexedFile.text === 'string'
    ) {
      return normalizedIndexedFile.text;
    }

    if (rawIndexedFile && typeof rawIndexedFile.text === 'string') {
      return rawIndexedFile.text;
    }

    return null;
  };

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
      await this._resolvePendingExternalCopies();

      console.log(
        `[BrowserSWFileSystem] Storing ${
          this._pendingFiles.length
        } files in IndexedDB for preview...`
      );

      let totalBytes = 0;
      const uploadPromises = this._pendingFiles.map(async file => {
        const fullPath = `/${file.path}`;
        totalBytes += file.bytes.byteLength;

        await putFile(fullPath, file.bytes, file.contentType);
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
    } finally {
      this._pendingDeleteOperations = [];
      this._pendingExternalCopies = [];
      this._pendingFiles = [];
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
    const relativePath = path.replace(this.rootUrl, '');
    const normalizedPrefix = relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;
    const prefixWithTrailingSlash = normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : `${normalizedPrefix}/`;
    const normalizedFullPrefix = this._normalizeFilePath(path);

    Object.keys(this._virtualTextFiles).forEach(filePath => {
      if (filePath.indexOf(normalizedFullPrefix) === 0) {
        delete this._virtualTextFiles[filePath];
      }
    });

    Object.keys(this._externalUrlsByDestination).forEach(filePath => {
      if (filePath.indexOf(normalizedFullPrefix) === 0) {
        delete this._externalUrlsByDestination[filePath];
      }
    });

    this._pendingFiles = this._pendingFiles.filter(
      file =>
        file.path.indexOf(this._getRelativePath(prefixWithTrailingSlash)) !== 0
    );
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
    const normalizedSource = this._normalizeFilePath(source);
    const normalizedDest = this._normalizeFilePath(dest);

    const existingTextContent = this._getStoredTextContent(normalizedSource);
    if (typeof existingTextContent === 'string') {
      this._virtualTextFiles[normalizedDest] = existingTextContent;
      this._queuePendingFile(
        dest,
        encodeText(existingTextContent),
        getContentType(dest)
      );
      return true;
    }

    const existingExternalUrl =
      this._externalUrlsByDestination[normalizedSource] ||
      this._externalUrlsByDestination[source];
    if (existingExternalUrl) {
      return this.copyFile(existingExternalUrl, dest);
    }

    if (isURL(source)) {
      this._allCopiedExternalUrls.add(source);
      this._externalUrlsByDestination[normalizedDest] = source;
      this._queueExternalCopy(source, dest);
      return true;
    }

    console.error(
      '[BrowserSWFileSystem] File not found in copyFile (from',
      source,
      'to',
      dest,
      ').'
    );
    return false;
  };

  writeToFile = (fullPath: string, contents: string): any => {
    this._queuePendingTextFile(fullPath, contents);
    return true;
  };

  readFile = (file: string): any => {
    const storedTextContent = this._getStoredTextContent(file);
    if (typeof storedTextContent === 'string') {
      return storedTextContent;
    }

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
