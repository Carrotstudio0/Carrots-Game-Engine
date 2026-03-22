/*
 * GDevelop JS Platform
 * Copyright 2013-2016 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('PIXI Image manager');

  const unloadCachedTexture = (cacheKey: string): void => {
    const assets = PIXI.Assets as PIXI.AssetsClass & {
      unload?: (key: string) => Promise<void>;
    };
    if (!assets.unload) {
      return;
    }

    assets.unload(cacheKey).catch(() => {});
  };

  const logFileLoadingError = (file: string, error: Error | undefined) => {
    logger.error(
      'Unable to load file ' + file + ' with error:',
      error ? error : '(unknown error)'
    );
  };

  const applyTextureSettings = (
    texture: PIXI.Texture | undefined,
    resourceData: ResourceData
  ) => {
    if (!texture) return;

    if (!resourceData.smoothed) {
      texture.source.scaleMode = 'nearest';
    }
  };

  const isTextureUsable = (texture: PIXI.Texture): boolean => {
    if (!texture || texture.destroyed) {
      return false;
    }

    const textureWithCompat = texture as PIXI.Texture & {
      valid?: boolean;
      source?: {
        width?: number;
        height?: number;
        pixelWidth?: number;
        pixelHeight?: number;
        destroyed?: boolean;
      };
      baseTexture?: {
        width?: number;
        height?: number;
        destroyed?: boolean;
      };
    };

    if (typeof textureWithCompat.valid === 'boolean') {
      return textureWithCompat.valid;
    }

    const source = textureWithCompat.source || textureWithCompat.baseTexture;
    if (!source || source.destroyed) {
      return false;
    }

    const width =
      typeof source.width === 'number' ? source.width : source.pixelWidth;
    const height =
      typeof source.height === 'number' ? source.height : source.pixelHeight;
    if (typeof width === 'number' && typeof height === 'number') {
      return width > 0 && height > 0;
    }

    return true;
  };

  const applyThreeTextureSettings = (
    threeTexture: THREE.Texture,
    resourceData: ResourceData | null
  ) => {
    if (resourceData && !resourceData.smoothed) {
      threeTexture.magFilter = THREE.NearestFilter;
      threeTexture.minFilter = THREE.NearestFilter;
    }
  };

  const resourceKinds: Array<ResourceKind> = ['image', 'video'];

  /**
   * PixiImageManager loads and stores textures that can be used by the Pixi.js renderers.
   * @category Resources > Images/Textures
   */
  export class PixiImageManager implements gdjs.ResourceManager {
    /**
     * The invalid texture is a 8x8 PNG file filled with magenta (#ff00ff), to be
     * easily spotted if rendered on screen.
     */
    private _invalidTexture: PIXI.Texture;

    /**
     * Map associating a resource name to the loaded PixiJS texture.
     */
    private _loadedTextures = new gdjs.ResourceCache<PIXI.Texture>();

    /**
     * Map associating a resource name to the loaded Three.js texture.
     */
    private _loadedThreeTextures: Hashtable<THREE.Texture>;
    private _loadedThreeMaterials = new ThreeMaterialCache();
    private _loadedThreeCubeTextures = new Map<string, THREE.CubeTexture>();
    private _loadedThreeCubeTextureKeysByResourceName = new ArrayMap<
      string,
      string
    >();

    private _diskTextures = new Map<float, PIXI.Texture>();
    private _rectangleTextures = new Map<string, PIXI.Texture>();
    private _scaledTextures = new Map<string, PIXI.Texture>();

    private _resourceLoader: gdjs.ResourceLoader;

    /**
     * @param resourceLoader The resources loader of the game.
     */
    constructor(resourceLoader: gdjs.ResourceLoader) {
      this._resourceLoader = resourceLoader;
      const invalidCanvas = document.createElement('canvas');
      invalidCanvas.width = 8;
      invalidCanvas.height = 8;
      const invalidContext = invalidCanvas.getContext('2d');
      if (invalidContext) {
        invalidContext.fillStyle = '#ff00ff';
        invalidContext.fillRect(0, 0, invalidCanvas.width, invalidCanvas.height);
      }
      this._invalidTexture = PIXI.Texture.from(invalidCanvas);
      this._loadedThreeTextures = new Hashtable();
    }

    getResourceKinds(): ResourceKind[] {
      return resourceKinds;
    }

    /**
     * Return the PIXI texture associated to the specified resource name.
     * Returns a placeholder texture if not found.
     * @param resourceName The name of the resource
     * @returns The requested texture, or a placeholder if not found.
     */
    getPIXITexture(resourceName: string): PIXI.Texture {
      if (!resourceName) {
        return this._invalidTexture;
      }
      const resource = this._getImageResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find texture for resource "' + resourceName + '".'
        );
        return this._invalidTexture;
      }

      const existingTexture = this._loadedTextures.get(resource);
      if (!existingTexture) {
        return this._invalidTexture;
      }
      if (existingTexture.destroyed) {
        logger.error('Texture for ' + resourceName + ' is not valid anymore.');
        return this._invalidTexture;
      }
      if (!isTextureUsable(existingTexture)) {
        logger.error(
          'Texture for ' +
            resourceName +
            ' is not valid anymore (or never was).'
        );
        return this._invalidTexture;
      }

      return existingTexture;
    }

    /**
     * Return the PIXI texture associated to the specified resource name.
     * If not found in the loaded textures, this method will try to load it.
     * Warning: this method should only be used in specific cases that cannot rely on
     * the initial resources loading of the game, such as the splashscreen.
     * @param resourceName The name of the resource
     * @returns The requested texture, or a placeholder if not valid.
     */
    getOrLoadPIXITexture(resourceName: string): PIXI.Texture {
      if (!resourceName) {
        return this._invalidTexture;
      }
      const resource = this._getImageResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find texture for resource "' + resourceName + '".'
        );
        return this._invalidTexture;
      }

      const existingTexture = this._loadedTextures.get(resource);
      if (existingTexture) {
        if (isTextureUsable(existingTexture)) {
          return existingTexture;
        } else {
          logger.error(
            'Texture for ' +
              resourceName +
              ' is not valid anymore (or never was).'
          );
          return this._invalidTexture;
        }
      }

      logger.log('Loading texture for resource "' + resourceName + '"...');
      const file = resource.file;
      const url = this._resourceLoader.getFullUrl(file);
      const cachedTexture = PIXI.Assets.get(url) as PIXI.Texture | undefined;
      if (cachedTexture) {
        applyTextureSettings(cachedTexture, resource);
        this._loadedTextures.set(resource, cachedTexture);
        return cachedTexture;
      }

      PIXI.Assets.load(url)
        .then((asset) => {
          const loadedTexture =
            asset instanceof PIXI.Texture
              ? asset
              : ((asset && (asset as any).texture) as PIXI.Texture | undefined);
          if (!loadedTexture) {
            return;
          }
          applyTextureSettings(loadedTexture, resource);
          this._loadedTextures.set(resource, loadedTexture);
        })
        .catch((error) => {
          logFileLoadingError(file, error);
          unloadCachedTexture(url);
        });

      return this._invalidTexture;
    }

    /**
     * Return the three.js texture associated to the specified resource name.
     * Returns a placeholder texture if not found.
     * @param resourceName The name of the resource
     * @returns The requested texture, or a placeholder if not found.
     */
    getThreeTexture(resourceName: string): THREE.Texture {
      const loadedThreeTexture = this._loadedThreeTextures.get(resourceName);
      if (loadedThreeTexture) {
        return loadedThreeTexture;
      }
      const image = this._getImageSource(resourceName);

      const threeTexture = new THREE.Texture(image);
      threeTexture.magFilter = THREE.LinearFilter;
      threeTexture.minFilter = THREE.LinearFilter;
      threeTexture.wrapS = THREE.RepeatWrapping;
      threeTexture.wrapT = THREE.RepeatWrapping;
      threeTexture.colorSpace = THREE.SRGBColorSpace;
      threeTexture.needsUpdate = true;

      const resource = this._getImageResource(resourceName);

      applyThreeTextureSettings(threeTexture, resource);
      this._loadedThreeTextures.put(resourceName, threeTexture);

      return threeTexture;
    }

    private _getImageSource(resourceName: string): TexImageSource {
      // Texture is not loaded, load it now from the PixiJS texture.
      // TODO (3D) - optimization: don't load the PixiJS Texture if not used by PixiJS.
      // TODO (3D) - optimization: Ideally we could even share the same WebGL texture.
      const pixiTexture = this.getPIXITexture(resourceName);
      const pixiRenderer = this._resourceLoader._runtimeGame
        .getRenderer()
        .getPIXIRenderer();
      if (!pixiRenderer) throw new Error('No PIXI renderer was found.');

      const pixiTextureWithCompat = pixiTexture as PIXI.Texture & {
        source?: { resource?: unknown };
        baseTexture?: { resource?: unknown };
      };
      const source =
        pixiTextureWithCompat.source || pixiTextureWithCompat.baseTexture;
      const textureResource = source && (source as any).resource;
      const image =
        textureResource instanceof HTMLImageElement ||
        textureResource instanceof HTMLCanvasElement ||
        textureResource instanceof HTMLVideoElement ||
        (typeof ImageBitmap !== 'undefined' &&
          textureResource instanceof ImageBitmap)
          ? textureResource
          : textureResource && textureResource.source;
      const validImage =
        image instanceof HTMLImageElement ||
        image instanceof HTMLCanvasElement ||
        image instanceof HTMLVideoElement ||
        (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap);
      if (!validImage) {
        throw new Error(
          `Can't load texture for resource "${resourceName}" as it's not an image source.`
        );
      }
      return image as TexImageSource;
    }

    /**
     * Return the three.js texture associated to the specified resource name.
     * Returns a placeholder texture if not found.
     * @param xPositiveResourceName The name of the resource
     * @returns The requested cube texture, or a placeholder if not found.
     */
    getThreeCubeTexture(
      xPositiveResourceName: string,
      xNegativeResourceName: string,
      yPositiveResourceName: string,
      yNegativeResourceName: string,
      zPositiveResourceName: string,
      zNegativeResourceName: string
    ): THREE.CubeTexture {
      const key =
        xPositiveResourceName +
        '|' +
        xNegativeResourceName +
        '|' +
        yPositiveResourceName +
        '|' +
        yNegativeResourceName +
        '|' +
        zPositiveResourceName +
        '|' +
        zNegativeResourceName;
      const loadedThreeTexture = this._loadedThreeCubeTextures.get(key);
      if (loadedThreeTexture) {
        return loadedThreeTexture;
      }

      const cubeTexture = new THREE.CubeTexture();
      // Faces on X axis need to be swapped.
      cubeTexture.images[0] = this._getImageSource(xNegativeResourceName);
      cubeTexture.images[1] = this._getImageSource(xPositiveResourceName);
      // Faces on Y keep the same order.
      cubeTexture.images[2] = this._getImageSource(yPositiveResourceName);
      cubeTexture.images[3] = this._getImageSource(yNegativeResourceName);
      // Faces on Z keep the same order.
      cubeTexture.images[4] = this._getImageSource(zPositiveResourceName);
      cubeTexture.images[5] = this._getImageSource(zNegativeResourceName);
      // The images also need to be mirrored horizontally by users.

      cubeTexture.magFilter = THREE.LinearFilter;
      cubeTexture.minFilter = THREE.LinearFilter;
      cubeTexture.colorSpace = THREE.SRGBColorSpace;
      cubeTexture.needsUpdate = true;

      const resource = this._getImageResource(xPositiveResourceName);
      applyThreeTextureSettings(cubeTexture, resource);
      this._loadedThreeCubeTextures.set(key, cubeTexture);
      this._loadedThreeCubeTextureKeysByResourceName.add(
        xPositiveResourceName,
        key
      );
      this._loadedThreeCubeTextureKeysByResourceName.add(
        xNegativeResourceName,
        key
      );
      this._loadedThreeCubeTextureKeysByResourceName.add(
        yPositiveResourceName,
        key
      );
      this._loadedThreeCubeTextureKeysByResourceName.add(
        yNegativeResourceName,
        key
      );
      this._loadedThreeCubeTextureKeysByResourceName.add(
        zPositiveResourceName,
        key
      );
      this._loadedThreeCubeTextureKeysByResourceName.add(
        zNegativeResourceName,
        key
      );

      return cubeTexture;
    }

    /**
     * Return the three.js material associated to the specified resource name.
     * @param resourceName The name of the resource
     * @param options
     * @returns The requested material.
     */
    getThreeMaterial(
      resourceName: string,
      options: {
        useTransparentTexture: boolean;
        forceBasicMaterial: boolean;
        vertexColors: boolean;
      }
    ): THREE.Material {
      const loadedThreeMaterial = this._loadedThreeMaterials.get(
        resourceName,
        options
      );
      if (loadedThreeMaterial) return loadedThreeMaterial;

      const material = options.forceBasicMaterial
        ? new THREE.MeshBasicMaterial({
            map: this.getThreeTexture(resourceName),
            side: options.useTransparentTexture
              ? THREE.DoubleSide
              : THREE.FrontSide,
            transparent: options.useTransparentTexture,
            vertexColors: options.vertexColors,
          })
        : new THREE.MeshStandardMaterial({
            map: this.getThreeTexture(resourceName),
            side: options.useTransparentTexture
              ? THREE.DoubleSide
              : THREE.FrontSide,
            transparent: options.useTransparentTexture,
            metalness: 0,
            vertexColors: options.vertexColors,
          });
      this._loadedThreeMaterials.set(resourceName, options, material);
      return material;
    }

    /**
     * Return the PIXI video texture associated to the specified resource name.
     * Returns a placeholder texture if not found.
     * @param resourceName The name of the resource to get.
     */
    getPIXIVideoTexture(resourceName: string) {
      if (resourceName === '') {
        return this._invalidTexture;
      }
      const resource = this._getImageResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find video texture for resource "' + resourceName + '".'
        );
        return this._invalidTexture;
      }

      const texture = this._loadedTextures.get(resource);
      if (!texture) {
        return this._invalidTexture;
      }
      return texture;
    }

    private _getImageResource = (resourceName: string): ResourceData | null => {
      const resource = this._resourceLoader.getResource(resourceName);
      return resource && this.getResourceKinds().includes(resource.kind)
        ? resource
        : null;
    };

    /**
     * Return a PIXI texture which can be used as a placeholder when no
     * suitable texture can be found.
     */
    getInvalidPIXITexture() {
      return this._invalidTexture;
    }

    /**
     * Load the specified resources, so that textures are loaded and can then be
     * used by calling `getPIXITexture`.
     */
    async loadResource(resourceName: string): Promise<void> {
      if (!resourceName) {
        return;
      }
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find texture for resource "' + resourceName + '".'
        );
        return;
      }
      await this._loadTexture(resource);
    }

    async processResource(resourceName: string): Promise<void> {
      // Do nothing because images are light enough to be parsed in background.
    }

    /**
     * Load the specified resources, so that textures are loaded and can then be
     * used by calling `getPIXITexture`.
     * @param onProgress Callback called each time a new file is loaded.
     */
    async _loadTexture(resource: ResourceData): Promise<void> {
      if (this._loadedTextures.get(resource)) {
        return;
      }
      const resourceUrl = this._resourceLoader.getFullUrl(resource.file);
      try {
        const loadedAsset = await PIXI.Assets.load(resourceUrl);
        const loadedTexture =
          loadedAsset instanceof PIXI.Texture
            ? loadedAsset
            : ((loadedAsset &&
                (loadedAsset as any).texture) as PIXI.Texture | undefined);
        if (!loadedTexture) {
          throw new Error(
            'Texture loading by PIXI returned nothing for file ' +
              resource.file +
              ' behind url ' +
              resourceUrl
          );
        }

        this._loadedTextures.set(resource, loadedTexture);
        applyTextureSettings(loadedTexture, resource);
      } catch (error) {
        logFileLoadingError(resource.file, error);
        unloadCachedTexture(resourceUrl);
        throw error;
      }
    }

    /**
     * Return a texture containing a circle filled with white.
     * @param radius The circle radius
     * @param pixiRenderer The renderer used to generate the texture
     */
    getOrCreateDiskTexture(
      radius: float,
      pixiRenderer: PIXI.Renderer
    ): PIXI.Texture {
      let particleTexture = this._diskTextures.get(radius);
      if (!particleTexture) {
        const graphics = new PIXI.Graphics();
        graphics.circle(0, 0, radius).fill({
          color: gdjs.rgbToHexNumber(255, 255, 255),
          alpha: 1,
        });
        particleTexture = pixiRenderer.generateTexture(graphics);
        graphics.destroy();

        this._diskTextures.set(radius, particleTexture);
      }
      return particleTexture;
    }

    /**
     * Return a texture filled with white.
     * @param width The texture width
     * @param height The texture height
     * @param pixiRenderer The renderer used to generate the texture
     */
    getOrCreateRectangleTexture(
      width: float,
      height: float,
      pixiRenderer: PIXI.Renderer
    ): PIXI.Texture {
      const key = `${width}_${height}`;
      let particleTexture = this._rectangleTextures.get(key);
      if (!particleTexture) {
        const graphics = new PIXI.Graphics();
        graphics.rect(0, 0, width, height).fill({
          color: gdjs.rgbToHexNumber(255, 255, 255),
          alpha: 1,
        });
        particleTexture = pixiRenderer.generateTexture(graphics);
        graphics.destroy();

        this._rectangleTextures.set(key, particleTexture);
      }
      return particleTexture;
    }

    /**
     * Return a texture rescaled according to given dimensions.
     * @param width The texture width
     * @param height The texture height
     * @param pixiRenderer The renderer used to generate the texture
     */
    getOrCreateScaledTexture(
      imageResourceName: string,
      width: float,
      height: float,
      pixiRenderer: PIXI.Renderer
    ): PIXI.Texture {
      const key = `${imageResourceName}_${width}_${height}`;
      let particleTexture = this._scaledTextures.get(key);
      if (!particleTexture) {
        const graphics = new PIXI.Graphics();
        const sprite = new PIXI.Sprite(this.getPIXITexture(imageResourceName));
        sprite.width = width;
        sprite.height = height;
        graphics.addChild(sprite);
        particleTexture = pixiRenderer.generateTexture(graphics);
        graphics.destroy();

        this._scaledTextures.set(key, particleTexture);
      }
      return particleTexture;
    }

    /**
     * To be called when the game is disposed.
     * Clear caches of loaded textures and materials.
     */
    dispose(): void {
      this._loadedTextures.clear();

      const threeTextures: THREE.Texture[] = [];
      this._loadedThreeTextures.values(threeTextures);
      this._loadedThreeTextures.clear();
      for (const threeTexture of threeTextures) {
        threeTexture.dispose();
      }
      for (const cubeTexture of this._loadedThreeCubeTextures.values()) {
        cubeTexture.dispose();
      }
      this._loadedThreeCubeTextures.clear();
      this._loadedThreeCubeTextureKeysByResourceName.clear();

      this._loadedThreeMaterials.disposeAll();

      for (const pixiTexture of this._diskTextures.values()) {
        if (pixiTexture.destroyed) {
          continue;
        }

        pixiTexture.destroy();
      }
      this._diskTextures.clear();

      for (const pixiTexture of this._rectangleTextures.values()) {
        if (pixiTexture.destroyed) {
          continue;
        }

        pixiTexture.destroy();
      }
      this._rectangleTextures.clear();

      for (const pixiTexture of this._scaledTextures.values()) {
        if (pixiTexture.destroyed) {
          continue;
        }

        pixiTexture.destroy();
      }
      this._scaledTextures.clear();
    }

    unloadResource(resourceData: ResourceData): void {
      const resourceName = resourceData.name;
      const texture = this._loadedTextures.getFromName(resourceName);
      if (texture) {
        texture.destroy(true);
        this._loadedTextures.delete(resourceData);
      }

      const threeTexture = this._loadedThreeTextures.get(resourceName);
      if (threeTexture) {
        threeTexture.dispose();
        this._loadedThreeTextures.remove(resourceName);
      }

      this._loadedThreeMaterials.dispose(resourceName);

      const cubeTextureKeys =
        this._loadedThreeCubeTextureKeysByResourceName.getValuesFor(
          resourceName
        );
      if (cubeTextureKeys) {
        for (const cubeTextureKey of cubeTextureKeys) {
          const cubeTexture = this._loadedThreeCubeTextures.get(cubeTextureKey);
          if (cubeTexture) {
            cubeTexture.dispose();
            this._loadedThreeCubeTextures.delete(cubeTextureKey);
          }
        }
      }
    }
  }

  class ArrayMap<K, V> {
    map = new Map<K, Array<V>>();

    getValuesFor(key: K): Array<V> | undefined {
      return this.map.get(key);
    }

    add(key: K, value: V): void {
      let values = this.map.get(key);
      if (!values) {
        values = [];
        this.map.set(key, values);
      }
      values.push(value);
    }

    deleteValuesFor(key: K): void {
      this.map.delete(key);
    }

    clear(): void {
      this.map.clear();
    }
  }

  class ThreeMaterialCache {
    private _flaggedMaterials = new Map<string, THREE.Material>();
    private _materialFlaggedKeys = new ArrayMap<string, string>();

    /**
     * Return the three.js material associated to the specified resource name
     * and options.
     * @param resourceName The name of the resource
     * @param options
     * @returns The requested material.
     */
    get(
      resourceName: string,
      {
        useTransparentTexture,
        forceBasicMaterial,
        vertexColors,
      }: {
        useTransparentTexture: boolean;
        forceBasicMaterial: boolean;
        vertexColors: boolean;
      }
    ): THREE.Material | null {
      const flaggedKey = `${resourceName}|${useTransparentTexture ? 1 : 0}|${
        forceBasicMaterial ? 1 : 0
      }|${vertexColors ? 1 : 0}`;
      return this._flaggedMaterials.get(flaggedKey) || null;
    }

    /**
     * Set the three.js material associated to the specified resource name
     * and options.
     * @param resourceName The name of the resource
     * @param options
     * @param material The material to add to the cache
     */
    set(
      resourceName: string,
      {
        useTransparentTexture,
        forceBasicMaterial,
        vertexColors,
      }: {
        useTransparentTexture: boolean;
        forceBasicMaterial: boolean;
        vertexColors: boolean;
      },
      material: THREE.Material
    ): void {
      const cacheKey = `${resourceName}|${useTransparentTexture ? 1 : 0}|${
        forceBasicMaterial ? 1 : 0
      }|${vertexColors ? 1 : 0}`;
      this._flaggedMaterials.set(cacheKey, material);
      this._materialFlaggedKeys.add(resourceName, cacheKey);
    }

    /**
     * Delete and dispose all the three.js material associated to the specified
     * resource name.
     * @param resourceName The name of the resource
     */
    dispose(resourceName: string): void {
      const flaggedKeys = this._materialFlaggedKeys.getValuesFor(resourceName);
      if (flaggedKeys) {
        for (const flaggedKey of flaggedKeys) {
          const threeMaterial = this._flaggedMaterials.get(flaggedKey);
          if (threeMaterial) {
            threeMaterial.dispose();
          }
          this._flaggedMaterials.delete(flaggedKey);
        }
      }
      this._materialFlaggedKeys.deleteValuesFor(resourceName);
    }

    /**
     * Delete and dispose all the three.js material in the cache.
     */
    disposeAll(): void {
      for (const material of this._flaggedMaterials.values()) {
        material.dispose();
      }
      this._flaggedMaterials.clear();
      this._materialFlaggedKeys.clear();
    }
  }

  //Register the class to let the engine use it.
  /** @category Resources > Images/Textures */
  export const ImageManager = gdjs.PixiImageManager;
  /** @category Resources > Images/Textures */
  export type ImageManager = gdjs.PixiImageManager;
}
