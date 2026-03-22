/*
 * GDevelop JS Platform
 * Copyright 2021-present Aurélien Vivet (bouh.vivez@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('Bitmap text');

  const defaultBitmapFontKey = 'GDJS-DEFAULT-BITMAP-FONT';

  // When a font is unused, we put it in a cache of unused fonts. It's unloaded
  // from memory only when the cache is full and the font is at the last position
  // in the cache.
  // Set this to 0 to unload from memory ("uninstall") as soon as a font is unused.
  const uninstallCacheSize = 5;

  const getBitmapFontCacheKey = (bitmapFontInstallKey: string): string =>
    `${bitmapFontInstallKey}-bitmap`;

  const getPixiCache = (): {
    has: (key: string) => boolean;
    get: <T = any>(key: string) => T;
    set: (key: string, value: unknown) => void;
    remove: (key: string) => void;
  } =>
    (PIXI as any).Cache;

  const getInstalledBitmapFont = (
    bitmapFontInstallKey: string
  ): PIXI.BitmapFont | null => {
    const cache = getPixiCache();
    const cacheKey = getBitmapFontCacheKey(bitmapFontInstallKey);
    if (!cache || !cache.has(cacheKey)) {
      return null;
    }

    return cache.get<PIXI.BitmapFont>(cacheKey);
  };

  const parseBitmapFontData = (fontData: string): PIXI.BitmapFontData => {
    if (PIXI.bitmapFontTextParser.test(fontData)) {
      return PIXI.bitmapFontTextParser.parse(fontData);
    }
    if (PIXI.bitmapFontXMLStringParser.test(fontData)) {
      return PIXI.bitmapFontXMLStringParser.parse(fontData);
    }

    throw new Error('Unsupported bitmap font format.');
  };

  const installBitmapFont = (
    bitmapFontInstallKey: string,
    bitmapFontData: PIXI.BitmapFontData,
    textures: PIXI.Texture[]
  ): PIXI.BitmapFont => {
    const cache = getPixiCache();
    const cacheKey = getBitmapFontCacheKey(bitmapFontInstallKey);
    const bitmapFont = new PIXI.BitmapFont({
      data: {
        ...bitmapFontData,
        fontFamily: bitmapFontInstallKey,
      },
      textures,
    });

    cache.set(cacheKey, bitmapFont);
    bitmapFont.once('destroy', () => {
      if (cache.has(cacheKey)) {
        cache.remove(cacheKey);
      }
    });

    return bitmapFont;
  };

  const resourceKinds: Array<ResourceKind> = ['bitmapFont'];

  /**
   * PixiBitmapFontManager loads fnt/xml files (using `fetch`), from the "bitmapFont" resources of the game.
   *
   * It installs the "BitmapFont" with PixiJS to be used with PIXI.BitmapText.
   * @category Resources > Bitmap Fonts
   */
  export class PixiBitmapFontManager implements gdjs.ResourceManager {
    private _imageManager: gdjs.PixiImageManager;

    /** Pixi.BitmapFont used, indexed by their BitmapFont name. */
    private _pixiBitmapFontsInUse: Record<
      string,
      { objectsUsingTheFont: number }
    > = {};

    /** Pixi.BitmapFont not used anymore, but not yet uninstalled, indexed by their BitmapFont name. */
    private _pixiBitmapFontsToUninstall: string[] = [];

    /** Loaded fonts data, indexed by resource name. */
    private _loadedFontsData = new gdjs.ResourceCache<any>();

    private _defaultSlugFontName: string | null = null;

    _resourceLoader: gdjs.ResourceLoader;

    /**
     * @param resourceLoader The resources loader of the game.
     * @param imageManager The image manager to be used to get textures used by fonts.
     */
    constructor(
      resourceLoader: gdjs.ResourceLoader,
      imageManager: gdjs.PixiImageManager
    ) {
      this._imageManager = imageManager;
      this._resourceLoader = resourceLoader;
    }

    getResourceKinds(): ResourceKind[] {
      return resourceKinds;
    }

    getBitmapFontInstallKey(
      bitmapFontResourceName: string,
      textureAtlasResourceName: string
    ): string {
      return bitmapFontResourceName + '@' + textureAtlasResourceName;
    }

    /**
     * Get the instance of the default `Pixi.BitmapFont`, always available.
     */
    getDefaultBitmapFont() {
      if (this._defaultSlugFontName !== null) {
        const installedDefaultBitmapFont = getInstalledBitmapFont(
          this._defaultSlugFontName
        );
        if (installedDefaultBitmapFont) {
          return installedDefaultBitmapFont;
        }
      }

      // Default bitmap font style
      const fontFamily = 'Arial';
      const bitmapFontStyle = new PIXI.TextStyle({
        fontFamily: fontFamily,
        fontSize: 20,
        padding: 5,
        align: 'left',
        fill: '#ffffff',
        wordWrap: true,
        lineHeight: 20,
      });

      PIXI.BitmapFontManager.install({
        name: defaultBitmapFontKey,
        style: bitmapFontStyle,
        chars: [[' ', '~']],
      });

      this._defaultSlugFontName = defaultBitmapFontKey;
      const defaultBitmapFont = getInstalledBitmapFont(defaultBitmapFontKey);
      if (!defaultBitmapFont) {
        throw new Error('The default bitmap font could not be installed.');
      }

      return defaultBitmapFont;
    }

    /**
     * Called to specify that the bitmap font with the specified key is used by an object
     * (i.e: this is reference counting).
     * `releaseBitmapFont` *must* be called to mark the font as not used anymore when the
     * object is destroyed or its font changed.
     *
     * @param bitmapFontInstallKey Name of the font of the BitmapFont (`bitmapFont.font`)
     */
    private _markBitmapFontAsUsed(bitmapFontInstallKey: string): void {
      this._pixiBitmapFontsInUse[bitmapFontInstallKey] = this
        ._pixiBitmapFontsInUse[bitmapFontInstallKey] || {
        objectsUsingTheFont: 0,
      };
      this._pixiBitmapFontsInUse[bitmapFontInstallKey].objectsUsingTheFont++;

      for (let i = 0; i < this._pixiBitmapFontsToUninstall.length; ) {
        if (this._pixiBitmapFontsToUninstall[i] === bitmapFontInstallKey) {
          // The font is in the cache of fonts to uninstall, because it was previously used and then marked as not used anymore.
          // Remove it from the cache to avoid the font getting uninstalled.
          this._pixiBitmapFontsToUninstall.splice(i, 1);
        } else {
          i++;
        }
      }
    }

    /**
     * When a font is not used by an object anymore (object destroyed or font changed),
     * call this function to decrease the internal count of objects using the font.
     *
     * When a font is not unused anymore, it goes in a temporary cache. The cache holds up to 10 fonts.
     * If the cache reaches its maximum capacity, the oldest font is uninstalled from memory.
     *
     * @param bitmapFontInstallKey Name of the font of the BitmapFont (`bitmapFont.font`)
     */
    releaseBitmapFont(bitmapFontInstallKey: string) {
      if (bitmapFontInstallKey === defaultBitmapFontKey) {
        // Never uninstall the default font.
        return;
      }

      if (!this._pixiBitmapFontsInUse[bitmapFontInstallKey]) {
        logger.warn(
          'BitmapFont with name ' +
            bitmapFontInstallKey +
            ' was tried to be released but was never marked as used.'
        );
        return;
      }
      this._pixiBitmapFontsInUse[bitmapFontInstallKey].objectsUsingTheFont--;

      if (
        this._pixiBitmapFontsInUse[bitmapFontInstallKey].objectsUsingTheFont ===
        0
      ) {
        delete this._pixiBitmapFontsInUse[bitmapFontInstallKey];

        // Add the font name at the last position of the cache.
        if (!this._pixiBitmapFontsToUninstall.includes(bitmapFontInstallKey)) {
          this._pixiBitmapFontsToUninstall.push(bitmapFontInstallKey);
        }
        if (this._pixiBitmapFontsToUninstall.length > uninstallCacheSize) {
          // Remove the first font (i.e: the oldest one)
          const oldestUnloadedPixiBitmapFontName =
            this._pixiBitmapFontsToUninstall.shift() as string;

          PIXI.BitmapFont.uninstall(oldestUnloadedPixiBitmapFontName);
          logger.log(
            'Bitmap Text',
            'Uninstalled BitmapFont "' +
              oldestUnloadedPixiBitmapFontName +
              '" from memory.'
          );
        }
      }
    }

    /**
     * Given a bitmap font resource name and a texture atlas resource name, returns the PIXI.BitmapFont
     * for it.
     * The font is register and should be released with `releaseBitmapFont` - so that it can be removed
     * from memory when unused.
     */
    obtainBitmapFont(
      bitmapFontResourceName: string,
      textureAtlasResourceName: string
    ): PIXI.BitmapFont {
      const bitmapFontInstallKey = this.getBitmapFontInstallKey(
        bitmapFontResourceName,
        textureAtlasResourceName
      );

      const installedBitmapFont = getInstalledBitmapFont(bitmapFontInstallKey);
      if (installedBitmapFont) {
        // Return the existing BitmapFont that is already in memory and already installed.
        this._markBitmapFontAsUsed(bitmapFontInstallKey);
        return installedBitmapFont;
      }

      // The Bitmap Font is not loaded, load it in memory.

      // First get the font data:
      const fontData = this._loadedFontsData.getFromName(
        bitmapFontResourceName
      );
      if (!fontData) {
        logger.warn(
          'Could not find Bitmap Font for resource named "' +
            bitmapFontResourceName +
            '". The default font will be used.'
        );
        return this.getDefaultBitmapFont();
      }

      // Get the texture to be used in the font:
      const texture = this._imageManager.getPIXITexture(
        textureAtlasResourceName
      );

      try {
        // Create and install the Pixi.BitmapFont in memory:
        const bitmapFont = installBitmapFont(
          bitmapFontInstallKey,
          parseBitmapFontData(fontData),
          [texture]
        );
        this._markBitmapFontAsUsed(bitmapFontInstallKey);
        return bitmapFont;
      } catch (error) {
        logger.error(
          'Could not load the Bitmap Font for resource named "' +
            bitmapFontResourceName +
            '". The default font will be used. Error is: ' +
            error
        );
        return this.getDefaultBitmapFont();
      }
    }

    async processResource(resourceName: string): Promise<void> {
      // Do nothing because fonts are light enough to be parsed in background.
    }

    /**
     * Load the "bitmapFont" resources of the game, so that they are ready
     * to be used when `obtainBitmapFont` is called.
     */
    async loadResource(resourceName: string): Promise<void> {
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find bitmap font for resource "' + resourceName + '".'
        );
        return;
      }
      if (this._loadedFontsData.get(resource)) {
        return;
      }

      try {
        const response = await fetch(
          this._resourceLoader.getFullUrl(resource.file),
          {
            credentials: this._resourceLoader.checkIfCredentialsRequired(
              resource.file
            )
              ? // Any resource stored on the GDevelop Cloud buckets needs the "credentials" of the user,
                // i.e: its gdevelop.io cookie, to be passed.
                'include'
              : // For other resources, use "same-origin" as done by default by fetch.
                'same-origin',
          }
        );
        if (!response.ok) {
          throw new Error(
            `HTTP error while loading bitmap font. Status is ${response.status}.`
          );
        }

        const fontDataRaw = await response.text();

        // Sanitize: remove lines starting with # (acting as comments)
        const sanitizedFontData = fontDataRaw
          .split('\n')
          .filter((line) => !line.trim().startsWith('#'))
          .join('\n');

        this._loadedFontsData.set(resource, sanitizedFontData);
      } catch (error) {
        logger.error(
          "Can't fetch the bitmap font file " +
            resource.file +
            ', error: ' +
            error
        );
        this._loadedFontsData.delete(resource);
        throw error;
      }
    }

    /**
     * To be called when the game is disposed.
     * Uninstall all the fonts from memory and clear cache of loaded fonts.
     */
    dispose(): void {
      for (const bitmapFontInstallKey in this._pixiBitmapFontsInUse) {
        PIXI.BitmapFont.uninstall(bitmapFontInstallKey);
      }

      for (const bitmapFontInstallKey of this._pixiBitmapFontsToUninstall) {
        PIXI.BitmapFont.uninstall(bitmapFontInstallKey);
      }

      this._pixiBitmapFontsInUse = {};
      this._pixiBitmapFontsToUninstall.length = 0;
      this._loadedFontsData.clear();
    }

    unloadResource(resourceData: ResourceData): void {
      this._loadedFontsData.delete(resourceData);

      for (const bitmapFontInstallKey in this._pixiBitmapFontsInUse) {
        if (bitmapFontInstallKey.startsWith(resourceData.name + '@')) {
          PIXI.BitmapFont.uninstall(bitmapFontInstallKey);
          delete this._pixiBitmapFontsInUse[bitmapFontInstallKey];
        }
      }

      for (
        let index = 0;
        index < this._pixiBitmapFontsToUninstall.length;
        index++
      ) {
        const bitmapFontInstallKey = this._pixiBitmapFontsToUninstall[index];

        if (bitmapFontInstallKey.startsWith(resourceData.name + '@')) {
          PIXI.BitmapFont.uninstall(bitmapFontInstallKey);
          this._pixiBitmapFontsToUninstall.splice(index, 1);
          index--;
        }
      }
    }
  }

  // Register the class to let the engine use it.
  /** @category Resources > Bitmap Fonts */
  export const BitmapFontManager = gdjs.PixiBitmapFontManager;
  /** @category Resources > Bitmap Fonts */
  export type BitmapFontManager = gdjs.PixiBitmapFontManager;
}
