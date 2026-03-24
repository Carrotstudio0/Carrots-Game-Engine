// @flow
import md5 from 'blueimp-md5';

const toHexColorFromHash = (hash: string): string => `#${hash.slice(0, 6)}`;

const getAvatarInitial = (normalizedEmail: string): string => {
  const firstToken = normalizedEmail.split('@')[0] || '';
  const firstAlphanumericChar = firstToken.match(/[a-z0-9]/i);
  return firstAlphanumericChar ? firstAlphanumericChar[0].toUpperCase() : '?';
};

const generateLocalAvatarDataUrl = ({
  label,
  size,
  backgroundColor,
}: {|
  label: string,
  size: number,
  backgroundColor: string,
|}): string => {
  const safeLabel = label.replace(/[<>&"']/g, '');
  const fontSize = Math.max(Math.round(size * 0.42), 12);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${Math.round(size / 2)}" fill="${backgroundColor}"/>
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600">${safeLabel}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const getGravatarUrl = (
  email: string,
  { size }: {| size: number |} = { size: 40 }
): string => {
  const normalizedEmail = email.trim().toLowerCase();
  const hash = md5(normalizedEmail);

  // Keep the legacy function name for compatibility, but avoid third-party
  // avatar requests that can be blocked by browser tracking prevention.
  return generateLocalAvatarDataUrl({
    label: getAvatarInitial(normalizedEmail),
    size,
    backgroundColor: toHexColorFromHash(hash),
  });
};
