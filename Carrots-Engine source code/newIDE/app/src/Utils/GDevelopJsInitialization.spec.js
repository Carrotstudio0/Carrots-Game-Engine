// @flow
import { ensureGDevelopJsPlatformsInitialized } from './GDevelopJsInitialization';

describe('ensureGDevelopJsPlatformsInitialized', () => {
  it('initializes platforms only once for the same libGD module', () => {
    const gd = {
      initializePlatforms: jest.fn(),
    };

    ensureGDevelopJsPlatformsInitialized(gd);
    ensureGDevelopJsPlatformsInitialized(gd);

    expect(gd.initializePlatforms).toHaveBeenCalledTimes(1);
  });

  it('initializes platforms independently for different libGD modules', () => {
    const firstGd = {
      initializePlatforms: jest.fn(),
    };
    const secondGd = {
      initializePlatforms: jest.fn(),
    };

    ensureGDevelopJsPlatformsInitialized(firstGd);
    ensureGDevelopJsPlatformsInitialized(secondGd);

    expect(firstGd.initializePlatforms).toHaveBeenCalledTimes(1);
    expect(secondGd.initializePlatforms).toHaveBeenCalledTimes(1);
  });

  it('does nothing when initializePlatforms is not available', () => {
    expect(() => ensureGDevelopJsPlatformsInitialized({})).not.toThrow();
  });
});
