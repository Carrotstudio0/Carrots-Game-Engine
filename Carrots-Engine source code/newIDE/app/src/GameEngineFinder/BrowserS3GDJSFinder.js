// @flow
import Window from '../Utils/Window';
import { getIDEVersionWithHash } from '../Version';

type FileSet =
  | 'preview'
  | 'cordova'
  | 'electron'
  | 'web'
  | 'cocos2d-js'
  | 'facebook-instant-games';

const filesToDownload: { [FileSet]: Array<string> } = {
  preview: ['/Runtime/index.html'],
  web: ['/Runtime/index.html', '/Runtime/Electron/LICENSE.GDevelop.txt'],
  'cocos2d-js': [
    '/Runtime/Cocos2d/cocos2d-js-v3.10.js',
    '/Runtime/Cocos2d/index.html',
    '/Runtime/Cocos2d/main.js',
    '/Runtime/Cocos2d/project.json',
  ],
  'facebook-instant-games': [
    '/Runtime/FacebookInstantGames/fbapp-config.json',
    '/Runtime/FacebookInstantGames/index.html',
  ],
  cordova: [
    '/Runtime/Cordova/www/index.html',
    '/Runtime/Cordova/www/LICENSE.GDevelop.txt',
    '/Runtime/Cordova/config.xml',
    '/Runtime/Cordova/package.json',
  ],
  electron: [
    '/Runtime/index.html',
    '/Runtime/Electron/main.js',
    '/Runtime/Electron/package.json',
    '/Runtime/Electron/LICENSE.GDevelop.txt',
  ],
};

export type TextFileDescriptor = {| text: string, filePath: string |};

const normalizePathPrefix = (pathPrefix: string): string => {
  if (!pathPrefix || pathPrefix === '/') return '';
  const normalized = pathPrefix.replace(/\/{2,}/g, '/');
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
};

const getLikelyAppBasePath = (): string => {
  const pathname = window.location.pathname || '/';
  const normalizedPathname = pathname.replace(/\/{2,}/g, '/');
  if (normalizedPathname === '/') return '';

  const trimmedPathname = normalizedPathname.endsWith('/')
    ? normalizedPathname.slice(0, -1)
    : normalizedPathname;
  if (!trimmedPathname) return '';

  const lastSlashIndex = trimmedPathname.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return /\.[^/]+$/.test(trimmedPathname) ? '' : trimmedPathname;
  }

  const lastSegment = trimmedPathname.slice(lastSlashIndex + 1);
  return lastSegment.includes('.')
    ? trimmedPathname.slice(0, lastSlashIndex)
    : trimmedPathname;
};

const getSelfHostedGdjsRoots = (): Array<string> => {
  const origin = window.location.origin;
  const appBasePath = normalizePathPrefix(getLikelyAppBasePath());
  const roots = [
    `${origin}${appBasePath}/GDJS`,
    `${origin}/GDJS`,
  ];
  const normalizeRoot = (root: string): string =>
    root.endsWith('/') ? root.slice(0, -1) : root;

  return Array.from(new Set(roots.map(root => normalizeRoot(root))));
};

const fetchFilesFromRoot = (
  gdjsRoot: string,
  fileSet: FileSet
): Promise<Array<TextFileDescriptor>> =>
  Promise.all(
    filesToDownload[fileSet].map(relativeFilePath => {
      const url = gdjsRoot + relativeFilePath;

      // Don't do any caching, rely on the browser cache only.
      return fetch(url).then(response => {
        if (!response.ok) {
          console.error(`Error while downloading "${url}"`, response);
          throw new Error(
            `Error while downloading "${url}" (status: ${response.status})`
          );
        }
        return response.text().then(text => ({
          filePath: url,
          text,
        }));
      });
    })
  );

const tryFindGDJS = (
  roots: Array<string>,
  fileSet: FileSet,
  previousError?: Error
): Promise<{|
  gdjsRoot: string,
  filesContent: Array<TextFileDescriptor>,
|}> => {
  const gdjsRoot = roots[0];
  if (!gdjsRoot) {
    throw previousError || new Error('No GDJS root available.');
  }

  return fetchFilesFromRoot(gdjsRoot, fileSet)
    .then(filesContent => ({
      gdjsRoot,
      filesContent,
    }))
    .catch(error => {
      if (roots.length === 1) {
        throw error;
      }

      console.warn(
        `[BrowserS3GDJSFinder] Unable to use GDJS from "${gdjsRoot}". Falling back to "${roots[1]}".`,
        error
      );
      return tryFindGDJS(roots.slice(1), fileSet, error);
    });
};

export const findGDJS = (
  fileSet: FileSet
): Promise<{|
  gdjsRoot: string,
  filesContent: Array<TextFileDescriptor>,
|}> => {
  // Get GDJS for this version. If you updated the version,
  // run `newIDE/web-app/scripts/deploy-GDJS-Runtime` script.
  const remoteGdjsRoot = `https://resources.gdevelop-app.com/GDJS-${getIDEVersionWithHash()}`;
  const selfHostedGdjsRoots = getSelfHostedGdjsRoots();
  const shouldAllowRemoteFallback =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('force-remote-gdjs');
  const candidateRoots = Window.isDev()
    ? ['http://localhost:5002', ...selfHostedGdjsRoots]
    : [...selfHostedGdjsRoots];
  if (shouldAllowRemoteFallback) {
    candidateRoots.push(remoteGdjsRoot);
  }

  return tryFindGDJS(candidateRoots, fileSet);
};
