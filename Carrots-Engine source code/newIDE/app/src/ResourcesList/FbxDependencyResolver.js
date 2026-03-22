// @flow
import path from 'path-browserify';

const FBX_TEXTURE_PATH_REGEX = /([^\0\r\n"']+\.(?:png|jpe?g|webp|bmp|tga|tiff?|ktx2?|dds))/gi;

const normalizeCandidate = (candidate: string): ?string => {
  if (!candidate) return null;

  const trimmed = candidate.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.includes('://')
  ) {
    return null;
  }

  // Keep relative paths as-is, but normalize separators so matching is stable.
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!normalized) return null;
  return normalized;
};

const decodeArrayBufferToText = (arrayBuffer: ArrayBuffer): string => {
  if (typeof TextDecoder !== 'undefined') {
    try {
      const decoder = new TextDecoder('latin1');
      return decoder.decode(arrayBuffer);
    } catch (error) {
      // Fallback below.
    }
  }

  const bytes = new Uint8Array(arrayBuffer);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

export const extractFbxEmbeddedResourcePathsFromText = (
  text: string
): Array<string> => {
  if (!text) return [];

  const uniquePaths = new Map<string, string>();
  let match;
  // Reset regex state for repeated calls.
  FBX_TEXTURE_PATH_REGEX.lastIndex = 0;
  while ((match = FBX_TEXTURE_PATH_REGEX.exec(text)) !== null) {
    const candidate = normalizeCandidate(match[1] || '');
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (!uniquePaths.has(key)) {
      uniquePaths.set(key, candidate);
    }
  }

  return [...uniquePaths.values()];
};

export const extractFbxEmbeddedResourcePathsFromArrayBuffer = (
  arrayBuffer: ArrayBuffer
): Array<string> => {
  return extractFbxEmbeddedResourcePathsFromText(
    decodeArrayBufferToText(arrayBuffer)
  );
};

export const getFbxDependencyLookupKeys = (dependencyPath: string): Array<string> => {
  const normalizedPath = (dependencyPath || '').replace(/\\/g, '/');
  if (!normalizedPath) return [];

  const keys = new Set<string>();
  const decoded = decodeURIComponent(normalizedPath);
  keys.add(normalizedPath);
  keys.add(decoded);
  keys.add(path.basename(normalizedPath));
  keys.add(path.basename(decoded));
  return [...keys];
};
