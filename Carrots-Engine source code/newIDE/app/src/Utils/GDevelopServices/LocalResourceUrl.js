// @flow

// $FlowFixMe[cannot-resolve-name]
const PUBLIC_URL: string = process.env.PUBLIC_URL || '';

const normalizePublicUrl = (publicUrl: string): string => {
  const trimmedPublicUrl = publicUrl.trim();
  if (!trimmedPublicUrl || trimmedPublicUrl === '/') {
    return '';
  }

  return trimmedPublicUrl.endsWith('/')
    ? trimmedPublicUrl.slice(0, -1)
    : trimmedPublicUrl;
};

/**
 * Build a URL to a bundled local resource.
 *
 * This must work in both:
 * - dev (`http://localhost:3000`)
 * - Electron packaged builds (`file://.../index.html`)
 */
export const getLocalResourceUrl = (relativePath: string): string => {
  const normalizedRelativePath = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;
  const normalizedPublicUrl = normalizePublicUrl(PUBLIC_URL);

  if (!normalizedPublicUrl || normalizedPublicUrl === '.') {
    return `.${normalizedRelativePath}`;
  }

  return `${normalizedPublicUrl}${normalizedRelativePath}`;
};

const HAS_PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Resolve a path that can be absolute ("/examples/foo.png") or already a full URL.
 */
export const resolveLocalResourcePath = (pathOrUrl: string): string => {
  if (!pathOrUrl) {
    return pathOrUrl;
  }

  if (HAS_PROTOCOL_REGEX.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return getLocalResourceUrl(pathOrUrl);
};
