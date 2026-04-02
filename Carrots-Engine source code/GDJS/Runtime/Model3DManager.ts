/*
 * GDevelop JS Platform
 * Copyright 2013-present Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('Model3DManager');

  const resourceKinds: Array<ResourceKind> = ['model3D'];
  type LoadedModel3D = THREE_ADDONS.GLTF;

  const getFileExtension = (fileName: string): string => {
    if (!fileName) return '';
    const withoutHash = fileName.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const extensionSeparatorIndex = withoutQuery.lastIndexOf('.');
    if (extensionSeparatorIndex === -1) return '';
    return withoutQuery.substring(extensionSeparatorIndex + 1).toLowerCase();
  };

  const getDirectoryPath = (path: string): string => {
    if (!path) return '';
    const withoutHash = path.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const lastPathSeparatorIndex = withoutQuery.lastIndexOf('/');
    if (lastPathSeparatorIndex === -1) return '';
    return withoutQuery.substring(0, lastPathSeparatorIndex + 1);
  };

  const getDracoDecoderPath = (): string => {
    return './pixi-renderers/draco/gltf/';
  };

  const toLoadedModel3D = (
    scene: THREE.Object3D,
    animations: THREE.AnimationClip[] = []
  ): LoadedModel3D => {
    return {
      scene,
      animations,
      cameras: [],
      scenes: [],
      asset: {},
      userData: {},
      // @ts-ignore
      parser: null,
    };
  };

  /**
   * Load 3D model files (using `Three.js`), using the "model3D" resources
   * registered in the game resources.
   * @category Resources > 3D Models
   */
  export class Model3DManager implements gdjs.ResourceManager {
    /**
     * Map associating a resource name to the loaded Three.js model.
     */
    private _loadedThreeModels = new gdjs.ResourceCache<LoadedModel3D>();
    private _downloadedArrayBuffers = new gdjs.ResourceCache<ArrayBuffer>();

    _resourceLoader: gdjs.ResourceLoader;

    _dracoLoader: THREE_ADDONS.DRACOLoader | null = null;

    //@ts-ignore Can only be null if THREE is not loaded.
    _invalidModel: LoadedModel3D;

    /**
     * @param resourceLoader The resources loader of the game.
     */
    constructor(resourceLoader: gdjs.ResourceLoader) {
      this._resourceLoader = resourceLoader;

      if (typeof THREE !== 'undefined') {
        this._dracoLoader = new THREE_ADDONS.DRACOLoader();
        this._dracoLoader.setDecoderPath(getDracoDecoderPath());

        /**
         * The invalid model is a box with magenta (#ff00ff) faces, to be
         * easily spotted if rendered on screen.
         */
        const group = new THREE.Group();
        group.add(
          new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: '#ff00ff' })
          )
        );
        this._invalidModel = toLoadedModel3D(group);
      }
    }

    getResourceKinds(): ResourceKind[] {
      return resourceKinds;
    }

    async processResource(resourceName: string): Promise<void> {
      if (typeof THREE === 'undefined') {
        return;
      }
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find 3D model resource "' + resourceName + '".'
        );
        return;
      }
      const data = this._downloadedArrayBuffers.get(resource);
      if (!data) {
        return;
      }
      this._downloadedArrayBuffers.delete(resource);

      const resourceUrl = this._resourceLoader.getFullUrl(resource.file);
      const resourceBasePath = getDirectoryPath(resourceUrl);
      const extension = getFileExtension(resource.file);
      try {
        const loadingManager = this._createLoadingManager(resource.name);
        if (extension === 'fbx') {
          const fbxLoader = new THREE_ADDONS.FBXLoader(loadingManager);
          const scene = fbxLoader.parse(data, resourceBasePath);
          const animations = Array.isArray((scene as any).animations)
            ? ((scene as any).animations as THREE.AnimationClip[])
            : [];
          this._loadedThreeModels.set(
            resource,
            toLoadedModel3D(scene, animations)
          );
        } else {
          const gltfLoader = new THREE_ADDONS.GLTFLoader(loadingManager);
          if (this._dracoLoader) {
            gltfLoader.setDRACOLoader(this._dracoLoader);
          }
          const gltf = (await gltfLoader.parseAsync(
            data,
            resourceBasePath
          )) as LoadedModel3D;
          this._loadedThreeModels.set(resource, gltf);
        }
      } catch (error) {
        logger.error(
          "Can't fetch the 3D model file " + resource.file + ', error: ' + error
        );
      }
    }

    async loadResource(resourceName: string): Promise<void> {
      if (typeof THREE === 'undefined') {
        return;
      }
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find 3D model resource "' + resourceName + '".'
        );
        return;
      }
      if (this._loadedThreeModels.get(resource)) {
        return;
      }
      const url = this._resourceLoader.getFullUrl(resource.file);
      try {
        const response = await fetch(url, {
          credentials: this._resourceLoader.checkIfCredentialsRequired(url)
            ? 'include'
            : 'omit',
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.arrayBuffer();
        this._downloadedArrayBuffers.set(resource, data);
      } catch (error) {
        logger.error(
          "Can't fetch the 3D model file " + resource.file + ', error: ' + error
        );
        throw error;
      }
    }

    /**
     * Return a 3D model.
     *
     * Caller should not modify the object but clone it.
     *
     * @param resourceName The name of the json resource.
     * @returns a 3D model if it exists.
     */
    getModel(resourceName: string): LoadedModel3D {
      return (
        this._loadedThreeModels.getFromName(resourceName) || this._invalidModel
      );
    }

    /**
     * To be called when the game is disposed.
     * Clear the models, resources loaded and destroy 3D models loaders in this manager.
     */
    dispose(): void {
      this._loadedThreeModels.clear();
      this._downloadedArrayBuffers.clear();
      this._dracoLoader = null;

      if (this._invalidModel) {
        this._invalidModel.cameras = [];
        this._invalidModel.animations = [];
        this._invalidModel.scenes = [];
        this._invalidModel.userData = {};
        this._invalidModel.asset = {};
        this._invalidModel.scene.clear();
      }
    }

    unloadResource(resourceData: ResourceData): void {
      const loadedThreeModel = this._loadedThreeModels.getFromName(
        resourceData.name
      );
      if (loadedThreeModel) {
        loadedThreeModel.scene.clear();
        this._loadedThreeModels.delete(resourceData);
      }

      const downloadedArrayBuffer = this._downloadedArrayBuffers.getFromName(
        resourceData.name
      );
      if (downloadedArrayBuffer) {
        this._downloadedArrayBuffers.delete(resourceData);
      }
    }

    private _decodeUriComponentSafe(value: string): string {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }

    private _normalizeDependencyPath(value: string): string {
      return (value || '')
        .replace(/\\/g, '/')
        .split('#')[0]
        .split('?')[0]
        .trim();
    }

    private _getDependencyLookupKeys(value: string): string[] {
      const normalizedPath = this._normalizeDependencyPath(value);
      if (!normalizedPath) return [];

      const decodedPath = this._normalizeDependencyPath(
        this._decodeUriComponentSafe(normalizedPath)
      );
      const pathFileName = normalizedPath.includes('/')
        ? normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1)
        : normalizedPath;
      const decodedPathFileName = decodedPath.includes('/')
        ? decodedPath.substring(decodedPath.lastIndexOf('/') + 1)
        : decodedPath;

      const keys = new Set<string>();
      keys.add(normalizedPath);
      keys.add(decodedPath);
      keys.add(pathFileName);
      keys.add(decodedPathFileName);

      return [...keys].filter((key) => !!key);
    }

    private _resolveEmbeddedDependencyUrl(
      mainResourceName: string,
      embeddedDependencyPath: string
    ): string | null {
      const game = this._resourceLoader.getRuntimeGame();
      const dependencyLookupKeys = this._getDependencyLookupKeys(
        embeddedDependencyPath
      );
      if (!dependencyLookupKeys.length) {
        return null;
      }

      const embeddedResourcesNames = game.getEmbeddedResourcesNames(
        mainResourceName
      );
      const lowerCaseDependencyLookupKeys = dependencyLookupKeys.map((key) =>
        key.toLowerCase()
      );

      for (const embeddedResourceName of embeddedResourcesNames) {
        const embeddedLookupKeys = this._getDependencyLookupKeys(
          embeddedResourceName
        );
        const isMatchingEmbeddedResource = embeddedLookupKeys.some((key) =>
          lowerCaseDependencyLookupKeys.includes(key.toLowerCase())
        );
        if (!isMatchingEmbeddedResource) {
          continue;
        }

        const mappedResourceName = game.resolveEmbeddedResource(
          mainResourceName,
          embeddedResourceName
        );
        const mappedResource = this._resourceLoader.getResource(
          mappedResourceName
        );
        if (mappedResource) {
          return this._resourceLoader.getFullUrl(mappedResource.file);
        }
      }

      for (const dependencyLookupKey of dependencyLookupKeys) {
        const mappedResourceName = game.resolveEmbeddedResource(
          mainResourceName,
          dependencyLookupKey
        );
        const mappedResource = this._resourceLoader.getResource(
          mappedResourceName
        );
        if (mappedResource) {
          return this._resourceLoader.getFullUrl(mappedResource.file);
        }
      }

      return null;
    }

    private _createLoadingManager(resourceName: string): THREE.LoadingManager {
      const loadingManager = new THREE.LoadingManager();
      loadingManager.setURLModifier((url) => {
        const resolvedUrl = this._resolveEmbeddedDependencyUrl(
          resourceName,
          url
        );
        return resolvedUrl || url;
      });
      return loadingManager;
    }
  }
}
