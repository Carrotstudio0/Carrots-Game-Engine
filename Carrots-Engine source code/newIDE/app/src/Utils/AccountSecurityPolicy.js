// @flow

const BLOCKED_EXTERNAL_HOSTS = ['gdevelop.io', 'gd.games'];

const isBlockedHostname = (hostname: string): boolean =>
  BLOCKED_EXTERNAL_HOSTS.some(
    blockedHost =>
      hostname === blockedHost || hostname.endsWith(`.${blockedHost}`)
  );

export const isGDevelopAccountSystemDisabled = (): boolean => true;

export const shouldBlockExternalNavigation = (url: string): boolean => {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return isBlockedHostname(parsedUrl.hostname.toLowerCase());
  } catch (error) {
    const lowerCaseUrl = url.toLowerCase();
    return (
      lowerCaseUrl.includes('gdevelop.io') ||
      lowerCaseUrl.includes('gd.games')
    );
  }
};

