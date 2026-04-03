// @flow
let isWebGPUAvailable = null;

export const isWebGPUSupported = (): boolean => {
  if (isWebGPUAvailable !== null) return isWebGPUAvailable;
  try {
    const hasWebGPU =
      typeof navigator !== 'undefined' &&
      !!((navigator: any).gpu);
    isWebGPUAvailable = hasWebGPU;
    return hasWebGPU;
  } catch (e) {
    isWebGPUAvailable = false;
    return false;
  }
};
