// @flow
import Window from '../Window';

const isDev = Window.isDev();
const getScopePathPrefix = (): string => {
  if (typeof window === 'undefined' || !window.location) {
    return '';
  }

  const pathname = window.location.pathname || '/';
  const pathnameWithoutTrailingSlash = pathname.replace(/\/+$/, '') || '/';
  const lastSlashIndex = pathnameWithoutTrailingSlash.lastIndexOf('/');
  const lastSegment =
    lastSlashIndex >= 0
      ? pathnameWithoutTrailingSlash.slice(lastSlashIndex + 1)
      : pathnameWithoutTrailingSlash;
  const hasFileLikeEnding = lastSegment.includes('.');
  const basePath = hasFileLikeEnding
    ? pathnameWithoutTrailingSlash.slice(0, lastSlashIndex)
    : pathnameWithoutTrailingSlash;

  if (!basePath || basePath === '/') {
    return '';
  }

  return basePath.startsWith('/') ? basePath : `/${basePath}`;
};

const webOrigin =
  typeof window !== 'undefined' && window.location
    ? window.location.origin
    : '';
const scopePathPrefix = getScopePathPrefix();
const selfHostedBaseUrl = webOrigin ? `${webOrigin}${scopePathPrefix}` : '';
const selfHostedApiBaseUrl = selfHostedBaseUrl ? `${selfHostedBaseUrl}/api` : '';
const selfHostedWebSocketBaseUrl = webOrigin
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${scopePathPrefix}/api`
  : '';

const getApiBaseUrl = (
  serviceName: string,
  devBaseUrl: string,
  prodBaseUrl: string
): string => {
  if (selfHostedApiBaseUrl) {
    return `${selfHostedApiBaseUrl}/${serviceName}`;
  }
  return isDev ? devBaseUrl : prodBaseUrl;
};

export const GDevelopGamePreviews = {
  baseUrl: selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/game-previews/`
    : `https://game-previews.gdevelop.io/`,
};

export const GDevelopGamesPlatform = {
  getInstantBuildUrl: (buildId: string): string =>
    isDev
      ? `https://gd.games/instant-builds/${buildId}?dev=true`
      : `https://gd.games/instant-builds/${buildId}`,
  getGameUrl: (gameId: string): string =>
    isDev
      ? `https://gd.games/games/${gameId}?dev=true`
      : `https://gd.games/games/${gameId}`,
  getGameUrlWithSlug: (userSlug: string, gameSlug: string): string =>
    isDev
      ? `https://gd.games/${userSlug.toLowerCase()}/${gameSlug.toLowerCase()}?dev=true`
      : `https://gd.games/${userSlug.toLowerCase()}/${gameSlug.toLowerCase()}`,
  getUserPublicProfileUrl: (userId: string, username: ?string): string =>
    username
      ? `https://gd.games/${username}${isDev ? '?dev=true' : ''}`
      : `https://gd.games/user/${userId}${isDev ? '?dev=true' : ''}`,
};

export const GDevelopFirebaseConfig = {
  apiKey: 'AIzaSyAnX9QMacrIl3yo4zkVFEVhDppGVDDewBc',
  authDomain: 'gdevelop-services.firebaseapp.com',
  databaseURL: 'https://gdevelop-services.firebaseio.com',
  projectId: 'gdevelop-services',
  storageBucket: 'gdevelop-services.appspot.com',
  messagingSenderId: '44882707384',
};

export const GDevelopAuthorizationWebSocketApi = {
  baseUrl: ((selfHostedWebSocketBaseUrl
    ? `${selfHostedWebSocketBaseUrl}/authorization`
    : isDev
      ? 'wss://api-ws-dev.gdevelop.io/authorization'
      : 'wss://api-ws.gdevelop.io/authorization'): string),
};

export const GDevelopBuildApi = {
  baseUrl: (getApiBaseUrl(
    'build',
    'https://api-dev.gdevelop.io/build',
    'https://api.gdevelop.io/build'
  ): string),
};

export const GDevelopUsageApi = {
  baseUrl: (getApiBaseUrl(
    'usage',
    'https://api-dev.gdevelop.io/usage',
    'https://api.gdevelop.io/usage'
  ): string),
};

export const GDevelopReleaseApi = {
  baseUrl: (getApiBaseUrl(
    'release',
    'https://api-dev.gdevelop.io/release',
    'https://api.gdevelop.io/release'
  ): string),
};

export const GDevelopAssetApi = {
  baseUrl: (getApiBaseUrl(
    'asset',
    'https://api-dev.gdevelop.io/asset',
    'https://api.gdevelop.io/asset'
  ): string),
};

export const GDevelopAssetCdn = {
  baseUrl: {
    staging: selfHostedBaseUrl
      ? `${selfHostedBaseUrl}/staging/assets-database`
      : 'https://resources.gdevelop-app.com/staging/assets-database',
    live: selfHostedBaseUrl
      ? `${selfHostedBaseUrl}/assets-database`
      : 'https://resources.gdevelop-app.com/assets-database',
  },
};

export const GDevelopAnalyticsApi = {
  baseUrl: (getApiBaseUrl(
    'analytics',
    'https://api-dev.gdevelop.io/analytics',
    'https://api.gdevelop.io/analytics'
  ): string),
};

export const GDevelopGameApi = {
  baseUrl: (getApiBaseUrl(
    'game',
    'https://api-dev.gdevelop.io/game',
    'https://api.gdevelop.io/game'
  ): string),
};

export const GDevelopUserApi = {
  baseUrl: (getApiBaseUrl(
    'user',
    'https://api-dev.gdevelop.io/user',
    'https://api.gdevelop.io/user'
  ): string),
};

export const GDevelopPlayApi = {
  baseUrl: (getApiBaseUrl(
    'play',
    'https://api-dev.gdevelop.io/play',
    'https://api.gdevelop.io/play'
  ): string),
};

export const GDevelopShopApi = {
  baseUrl: (getApiBaseUrl(
    'shop',
    'https://api-dev.gdevelop.io/shop',
    'https://api.gdevelop.io/shop'
  ): string),
};

export const GDevelopProjectApi = {
  baseUrl: (getApiBaseUrl(
    'project',
    'https://api-dev.gdevelop.io/project',
    'https://api.gdevelop.io/project'
  ): string),
};

export const GDevelopGenerationApi = {
  baseUrl: (getApiBaseUrl(
    'generation',
    'https://api-dev.gdevelop.io/generation',
    'https://api.gdevelop.io/generation'
  ): string),
};

export const GDevelopAiCdn = {
  baseUrl: {
    staging: selfHostedBaseUrl
      ? `${selfHostedBaseUrl}/staging/ai`
      : 'https://public-resources.gdevelop.io/staging/ai',
    live: selfHostedBaseUrl
      ? `${selfHostedBaseUrl}/ai`
      : 'https://public-resources.gdevelop.io/ai',
  },
};

export const GDevelopProjectResourcesStorage = {
  baseUrl: ((selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/project-resources`
    : isDev
      ? 'https://project-resources-dev.gdevelop.io'
      : 'https://project-resources.gdevelop.io'): string),
};

export const GDevelopPrivateAssetsStorage = {
  baseUrl: ((selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/private-assets`
    : isDev
      ? 'https://private-assets-dev.gdevelop.io'
      : 'https://private-assets.gdevelop.io'): string),
};

export const GDevelopPrivateGameTemplatesStorage = {
  baseUrl: ((selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/private-game-templates`
    : isDev
      ? 'https://private-game-templates-dev.gdevelop.io'
      : 'https://private-game-templates.gdevelop.io'): string),
};

export const GDevelopPublicAssetResourcesStorageBaseUrl =
  selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/asset-resources`
    : 'https://asset-resources.gdevelop.io';
export const GDevelopPublicAssetResourcesStorageStagingBaseUrl =
  selfHostedBaseUrl
    ? `${selfHostedBaseUrl}/asset-resources/staging`
    : 'https://asset-resources.gdevelop.io/staging';
