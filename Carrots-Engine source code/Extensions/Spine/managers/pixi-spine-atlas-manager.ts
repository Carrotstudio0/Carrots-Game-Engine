/*
 * GDevelop JS Platform
 * Copyright 2013-present Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  /**
   * The callback called when a text that was requested is loaded (or an error occurred).
   * @category Resources > Spine
   */
  export type SpineAtlasManagerRequestCallback = (
    error: Error | null,
    content?: pixi_spine.TextureAtlas
  ) => void;

  const atlasKinds: ResourceKind[] = ['atlas'];

  /**
   * AtlasManager loads atlas files with pixi loader, using the "atlas" resources
   * registered in the game resources and process them to Pixi TextureAtlas.
   *
   * Contrary to audio/fonts, text files are loaded asynchronously, when requested.
   * You should properly handle errors, and give the developer/player a way to know
   * that loading failed.
   * @category Resources > Spine
   */
  export class SpineAtlasManager implements gdjs.ResourceManager {
    private _imageManager: ImageManager;
    private _resourceLoader: ResourceLoader;
    private _loadedSpineAtlases =
      new gdjs.ResourceCache<pixi_spine.TextureAtlas>();
    private _loadingSpineAtlases = new gdjs.ResourceCache<
      Promise<pixi_spine.TextureAtlas>
    >();

    /**
     * @param resourceLoader The resources loader of the game.
     * @param imageManager The image manager of the game.
     */
    constructor(
      resourceLoader: gdjs.ResourceLoader,
      imageManager: ImageManager
    ) {
      this._resourceLoader = resourceLoader;
      this._imageManager = imageManager;
    }

    getResourceKinds(): ResourceKind[] {
      return atlasKinds;
    }

    async processResource(resourceName: string): Promise<void> {
      // Do nothing, resources are loaded on demand.
    }

    async loadResource(resourceName: string): Promise<void> {
      await this.getOrLoad(resourceName);
    }

    /**
     * Returns promisified loaded atlas resource if it is available, loads it otherwise.
     *
     * @param resourceName The name of resource to load.
     */
    getOrLoad(resourceName: string): Promise<pixi_spine.TextureAtlas> {
      const resource = this._getAtlasResource(resourceName);

      if (!resource) {
        return Promise.reject(
          `Unable to find atlas for resource '${resourceName}'.`
        );
      }

      let loadingPromise = this._loadingSpineAtlases.get(resource);

      if (!loadingPromise) {
        loadingPromise = new Promise<pixi_spine.TextureAtlas>(
          (resolve, reject) => {
            const onLoad: SpineAtlasManagerRequestCallback = (
              error,
              content
            ) => {
              if (error) {
                return reject(
                  `Error while preloading a spine atlas resource: ${error}`
                );
              }
              if (!content) {
                return reject(
                  `Cannot reach texture atlas for resource '${resourceName}'.`
                );
              }

              resolve(content);
            };

            this.load(resource, onLoad);
          }
        );

        this._loadingSpineAtlases.set(resource, loadingPromise);
      }

      return loadingPromise;
    }

    /**
     * Load specified atlas resource and pass it to callback once it is loaded.
     *
     * @param resource The data of resource to load.
     * @param callback The callback to pass atlas to it once it is loaded.
     */
    load(
      resource: ResourceData,
      callback: SpineAtlasManagerRequestCallback
    ): void {
      const game = this._resourceLoader.getRuntimeGame();
      const embeddedResourcesNames = game.getEmbeddedResourcesNames(
        resource.name
      );

      if (!embeddedResourcesNames.length)
        return callback(
          new Error(`${resource.name} do not have image metadata!`)
        );

      const images = embeddedResourcesNames.reduce<{
        [key: string]: PIXI.TextureSource;
      }>((imagesMap, embeddedResourceName) => {
        const mappedResourceName = game.resolveEmbeddedResource(
          resource.name,
          embeddedResourceName
        );
        const texture =
          this._imageManager.getOrLoadPIXITexture(mappedResourceName);
        imagesMap[embeddedResourceName] = texture.source || texture.baseTexture;

        return imagesMap;
      }, {});
      const onLoad = (atlas: pixi_spine.TextureAtlas) => {
        this._loadedSpineAtlases.set(resource, atlas);
        callback(null, atlas);
      };
      const url = this._resourceLoader.getFullUrl(resource.file);

      PIXI.Assets.setPreferences({
        preferWorkers: false,
        crossOrigin: this._resourceLoader.checkIfCredentialsRequired(url)
          ? 'use-credentials'
          : 'anonymous',
      });
      PIXI.Assets.add({ alias: resource.name, src: url, data: { images } });
      PIXI.Assets.load<pixi_spine.TextureAtlas>(resource.name).then(onLoad);
    }

    /**
     * Check if the given atlas resource was loaded (preloaded or loaded with `load`).
     * @param resourceName The name of the atlas resource.
     * @returns true if the content of the atlas resource is loaded, false otherwise.
     */
    isLoaded(resourceName: string): boolean {
      return !!this._loadedSpineAtlases.getFromName(resourceName);
    }

    /**
     * Get the Pixi TextureAtlas for the given resource that is already loaded (preloaded or loaded with `load`).
     * If the resource is not loaded, `null` will be returned.
     * @param resourceName The name of the atlas resource.
     * @returns the TextureAtlas of the atlas if loaded, `null` otherwise.
     */
    getAtlasTexture(resourceName: string): pixi_spine.TextureAtlas | null {
      return this._loadedSpineAtlases.getFromName(resourceName);
    }

    private _getAtlasResource(resourceName: string): ResourceData | null {
      const resource = this._resourceLoader.getResource(resourceName);
      return resource && this.getResourceKinds().includes(resource.kind)
        ? resource
        : null;
    }
    /**
     * To be called when the game is disposed.
     * Clear the Spine atlases loaded in this manager.
     */
    dispose(): void {
      this._loadedSpineAtlases.clear();
      this._loadingSpineAtlases.clear();
    }

    unloadResource(resourceData: ResourceData): void {
      const loadedSpineAtlas = this._loadedSpineAtlases.getFromName(
        resourceData.name
      );
      if (loadedSpineAtlas) {
        loadedSpineAtlas.dispose();
        this._loadedSpineAtlases.delete(resourceData);
      }

      const loadingSpineAtlas = this._loadingSpineAtlases.getFromName(
        resourceData.name
      );
      if (loadingSpineAtlas) {
        loadingSpineAtlas.then((atl) => atl.dispose());
        this._loadingSpineAtlases.delete(resourceData);
      }
    }
  }
}
