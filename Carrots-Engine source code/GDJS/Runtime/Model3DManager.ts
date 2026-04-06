/*
 * GDevelop JS Platform
 * Copyright 2013-present Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('Model3DManager');

  const resourceKinds: Array<ResourceKind> = ['model3D'];
  const model3DLoaderWorkerHandlerName =
    'GDJS::Model3D::fetchAndPreprocess::v1';
  let hasRegisteredModel3DLoaderWorkerHandler = false;

  type PreparedModel3DData = {
    arrayBuffer: ArrayBuffer;
    byteLength: integer;
    contentHash: string;
    format: 'glb' | 'unknown';
    sourceUrl: string;
    protocolVersion: integer;
  };

  const isPreparedModel3DData = (
    value: unknown
  ): value is PreparedModel3DData => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const preparedModelData = value as {
      arrayBuffer?: unknown;
      byteLength?: unknown;
      contentHash?: unknown;
      format?: unknown;
      sourceUrl?: unknown;
      protocolVersion?: unknown;
    };

    return (
      preparedModelData.arrayBuffer instanceof ArrayBuffer &&
      typeof preparedModelData.byteLength === 'number' &&
      typeof preparedModelData.contentHash === 'string' &&
      (preparedModelData.format === 'glb' ||
        preparedModelData.format === 'unknown') &&
      typeof preparedModelData.sourceUrl === 'string' &&
      typeof preparedModelData.protocolVersion === 'number'
    );
  };

  const ensureModel3DLoaderWorkerHandlerRegistered = (): void => {
    if (hasRegisteredModel3DLoaderWorkerHandler) {
      return;
    }
    if (
      typeof gdjs.registerWorkerTaskHandler !== 'function' ||
      typeof gdjs.hasWorkerTaskHandler !== 'function'
    ) {
      logger.warn(
        'Multithreading APIs are unavailable while initializing Model3D worker handlers.'
      );
      return;
    }

    if (!gdjs.hasWorkerTaskHandler(model3DLoaderWorkerHandlerName)) {
      gdjs.registerWorkerTaskHandler(
        model3DLoaderWorkerHandlerName,
        async function (payload) {
          const requestPayload =
            payload && typeof payload === 'object'
              ? (payload as {
                  url?: unknown;
                  credentials?: unknown;
                })
              : null;
          if (!requestPayload || typeof requestPayload.url !== 'string') {
            throw new Error('Invalid model preprocessing payload.');
          }

          const credentials =
            requestPayload.credentials === 'include' ? 'include' : 'omit';
          const response = await fetch(requestPayload.url, {
            credentials,
          });
          if (!response.ok) {
            throw new Error(
              'Unable to fetch model resource. HTTP status: ' + response.status
            );
          }

          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const byteLength = bytes.byteLength;
          const sampleCount = Math.min(4096, byteLength);
          const sampleStep = Math.max(
            1,
            sampleCount > 0 ? Math.floor(byteLength / sampleCount) : 1
          );

          let hash = 2166136261;
          for (let index = 0; index < byteLength; index += sampleStep) {
            hash ^= bytes[index];
            hash = Math.imul(hash, 16777619);
          }

          const isGlb =
            byteLength >= 4 &&
            bytes[0] === 0x67 &&
            bytes[1] === 0x6c &&
            bytes[2] === 0x54 &&
            bytes[3] === 0x46;

          return {
            __gdjsTransferableWorkerTaskResult: true,
            value: {
              arrayBuffer,
              byteLength,
              contentHash: (hash >>> 0).toString(16),
              format: isGlb ? 'glb' : 'unknown',
              sourceUrl: requestPayload.url,
              protocolVersion: 1,
            },
            transferables: [arrayBuffer],
          };
        }
      );
    }

    hasRegisteredModel3DLoaderWorkerHandler = true;
  };

  /**
   * Load GLB files (using `Three.js`), using the "model3D" resources
   * registered in the game resources.
   * @category Resources > 3D Models
   */
  export class Model3DManager implements gdjs.ResourceManager {
    /**
     * Map associating a resource name to the loaded Three.js model.
     */
    private _loadedThreeModels = new gdjs.ResourceCache<THREE_ADDONS.GLTF>();
    private _preparedModelDataByResource =
      new gdjs.ResourceCache<PreparedModel3DData>();
    private _preparedModelDataByUrl = new Map<string, PreparedModel3DData>();
    private _inFlightPreparationByResourceName = new Map<
      string,
      Promise<PreparedModel3DData>
    >();

    _resourceLoader: gdjs.ResourceLoader;

    _loader: THREE_ADDONS.GLTFLoader | null = null;
    _dracoLoader: THREE_ADDONS.DRACOLoader | null = null;

    //@ts-ignore Can only be null if THREE is not loaded.
    _invalidModel: THREE_ADDONS.GLTF;

    /**
     * @param resourceLoader The resources loader of the game.
     */
    constructor(resourceLoader: gdjs.ResourceLoader) {
      this._resourceLoader = resourceLoader;
      ensureModel3DLoaderWorkerHandlerRegistered();

      if (typeof THREE !== 'undefined') {
        this._loader = new THREE_ADDONS.GLTFLoader();

        this._dracoLoader = new THREE_ADDONS.DRACOLoader();
        this._dracoLoader.setDecoderPath('./pixi-renderers/draco/gltf/');
        this._loader.setDRACOLoader(this._dracoLoader);

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
        this._invalidModel = {
          scene: group,
          animations: [],
          cameras: [],
          scenes: [],
          asset: {},
          userData: {},
          //@ts-ignore
          parser: null,
        };
      }
    }

    private _getMaxModelTextureAnisotropy(): integer {
      const runtimeGame = this._resourceLoader.getRuntimeGame();
      if (!runtimeGame || !runtimeGame.getRenderer) {
        return 1;
      }
      const gameRenderer = runtimeGame.getRenderer();
      if (!gameRenderer || !gameRenderer.getThreeRenderer) {
        return 1;
      }
      const threeRenderer = gameRenderer.getThreeRenderer();
      if (
        !threeRenderer ||
        !threeRenderer.capabilities ||
        typeof threeRenderer.capabilities.getMaxAnisotropy !== 'function'
      ) {
        return 1;
      }

      const maxAnisotropy = threeRenderer.capabilities.getMaxAnisotropy();
      if (!Number.isFinite(maxAnisotropy) || maxAnisotropy <= 0) {
        return 1;
      }
      return Math.max(1, Math.floor(maxAnisotropy));
    }

    private _configureModelTextureQuality(
      texture: THREE.Texture,
      maxAnisotropy: integer
    ): void {
      if (texture.magFilter !== THREE.NearestFilter) {
        texture.magFilter = THREE.LinearFilter;
      }
      if (texture.minFilter !== THREE.NearestFilter) {
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
      } else {
        texture.generateMipmaps = false;
      }
      texture.anisotropy = Math.max(1, maxAnisotropy);
      texture.needsUpdate = true;
    }

    private _applyModelTextureQuality(gltf: THREE_ADDONS.GLTF): void {
      if (!gltf || !gltf.scene) {
        return;
      }

      const maxAnisotropy = this._getMaxModelTextureAnisotropy();
      const texturePropertyNames = [
        'map',
        'alphaMap',
        'aoMap',
        'bumpMap',
        'displacementMap',
        'emissiveMap',
        'envMap',
        'lightMap',
        'metalnessMap',
        'normalMap',
        'roughnessMap',
        'specularMap',
        'clearcoatMap',
        'clearcoatNormalMap',
        'clearcoatRoughnessMap',
        'iridescenceMap',
        'iridescenceThicknessMap',
        'sheenColorMap',
        'sheenRoughnessMap',
        'thicknessMap',
        'transmissionMap',
        'anisotropyMap',
      ];
      const processedTextures = new Set<THREE.Texture>();

      gltf.scene.traverse((object: THREE.Object3D) => {
        const renderableObject = object as THREE.Object3D & {
          material?: THREE.Material | THREE.Material[] | null;
        };
        if (!renderableObject.material) {
          return;
        }
        const materials = Array.isArray(renderableObject.material)
          ? renderableObject.material
          : [renderableObject.material];

        for (const material of materials) {
          if (!material) {
            continue;
          }
          const materialWithTextures = material as THREE.Material & {
            [key: string]: unknown;
          };

          for (let index = 0; index < texturePropertyNames.length; index++) {
            const propertyName = texturePropertyNames[index];
            const texture = materialWithTextures[propertyName];
            if (!(texture instanceof THREE.Texture)) {
              continue;
            }
            if (processedTextures.has(texture)) {
              continue;
            }
            processedTextures.add(texture);
            this._configureModelTextureQuality(texture, maxAnisotropy);
          }
        }
      });
    }

    getResourceKinds(): ResourceKind[] {
      return resourceKinds;
    }

    private _retainPreparedModelDataForResource(
      resource: ResourceData,
      preparedModelData: PreparedModel3DData
    ): void {
      this._preparedModelDataByResource.set(resource, preparedModelData);
      this._preparedModelDataByUrl.set(
        preparedModelData.sourceUrl,
        preparedModelData
      );
    }

    private _releasePreparedModelDataForResource(resource: ResourceData): void {
      this._preparedModelDataByResource.delete(resource);
    }

    private _preprocessModelArrayBuffer(
      url: string,
      arrayBuffer: ArrayBuffer
    ): PreparedModel3DData {
      const bytes = new Uint8Array(arrayBuffer);
      const byteLength = bytes.byteLength;
      const sampleCount = Math.min(4096, byteLength);
      const sampleStep = Math.max(
        1,
        sampleCount > 0 ? Math.floor(byteLength / sampleCount) : 1
      );

      let hash = 2166136261;
      for (let index = 0; index < byteLength; index += sampleStep) {
        hash ^= bytes[index];
        hash = Math.imul(hash, 16777619);
      }

      const isGlb =
        byteLength >= 4 &&
        bytes[0] === 0x67 &&
        bytes[1] === 0x6c &&
        bytes[2] === 0x54 &&
        bytes[3] === 0x46;

      return {
        arrayBuffer,
        byteLength,
        contentHash: (hash >>> 0).toString(16),
        format: isGlb ? 'glb' : 'unknown',
        sourceUrl: url,
        protocolVersion: 1,
      };
    }

    private async _fetchAndPrepareModelResource(
      url: string
    ): Promise<PreparedModel3DData> {
      const runtimeGame = this._resourceLoader.getRuntimeGame();
      const multithreadManager = runtimeGame.getMultithreadManager();
      const credentials = this._resourceLoader.checkIfCredentialsRequired(url)
        ? 'include'
        : 'omit';

      if (
        typeof gdjs.hasWorkerTaskHandler !== 'function' ||
        !gdjs.hasWorkerTaskHandler(model3DLoaderWorkerHandlerName)
      ) {
        const response = await fetch(url, {
          credentials,
        });
        if (!response.ok) {
          throw new Error(
            'Unable to fetch model resource. HTTP status: ' + response.status
          );
        }
        return this._preprocessModelArrayBuffer(url, await response.arrayBuffer());
      }

      try {
        const workerTaskHandle =
          multithreadManager.runTask<PreparedModel3DData>(
            model3DLoaderWorkerHandlerName,
            {
              url,
              credentials,
            },
            {
              workerRole: 'loader',
              priority: 'high',
            }
          );
        const preparedModelData = await workerTaskHandle.promise;
        if (!isPreparedModel3DData(preparedModelData)) {
          throw new Error(
            'Model preprocessing worker returned an invalid payload.'
          );
        }
        return preparedModelData;
      } catch (error) {
        logger.warn(
          'Falling back to main-thread model preprocessing after worker failure:',
          error
        );
        const response = await fetch(url, {
          credentials,
        });
        if (!response.ok) {
          throw new Error(
            'Unable to fetch model resource. HTTP status: ' + response.status
          );
        }
        return this._preprocessModelArrayBuffer(url, await response.arrayBuffer());
      }
    }

    async processResource(resourceName: string): Promise<void> {
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find texture for resource "' + resourceName + '".'
        );
        return;
      }
      const loader = this._loader;
      if (!loader) {
        return;
      }
      const preparedModelData = this._preparedModelDataByResource.get(resource);
      if (!preparedModelData) {
        return;
      }
      try {
        const gltf: THREE_ADDONS.GLTF = await loader.parseAsync(
          preparedModelData.arrayBuffer,
          ''
        );
        this._applyModelTextureQuality(gltf);
        this._loadedThreeModels.set(resource, gltf);
        this._releasePreparedModelDataForResource(resource);
      } catch (error) {
        logger.error(
          "Can't parse the 3D model file " + resource.file + ', error: ' + error
        );
        throw error;
      }
    }

    async loadResource(resourceName: string): Promise<void> {
      const resource = this._resourceLoader.getResource(resourceName);
      if (!resource) {
        logger.warn(
          'Unable to find texture for resource "' + resourceName + '".'
        );
        return;
      }
      const loader = this._loader;
      if (!loader) {
        return;
      }
      if (this._loadedThreeModels.get(resource)) {
        return;
      }
      if (this._preparedModelDataByResource.get(resource)) {
        return;
      }

      const url = this._resourceLoader.getFullUrl(resource.file);
      const cachedPreparedModelData = this._preparedModelDataByUrl.get(url);
      if (cachedPreparedModelData) {
        this._retainPreparedModelDataForResource(resource, cachedPreparedModelData);
        return;
      }

      const inFlightPreparation = this._inFlightPreparationByResourceName.get(
        resource.name
      );
      if (inFlightPreparation) {
        await inFlightPreparation;
        return;
      }

      const preparationPromise = this._fetchAndPrepareModelResource(url)
        .then((preparedModelData) => {
          this._retainPreparedModelDataForResource(resource, preparedModelData);
          return preparedModelData;
        })
        .finally(() => {
          this._inFlightPreparationByResourceName.delete(resource.name);
        });

      this._inFlightPreparationByResourceName.set(
        resource.name,
        preparationPromise
      );

      try {
        await preparationPromise;
      } catch (error) {
        logger.error(
          "Can't load the 3D model file " + resource.file + ', error: ' + error
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
    getModel(resourceName: string): THREE_ADDONS.GLTF {
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
      this._preparedModelDataByResource.clear();
      this._preparedModelDataByUrl.clear();
      this._inFlightPreparationByResourceName.clear();
      this._loader = null;
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

      this._releasePreparedModelDataForResource(resourceData);
      this._inFlightPreparationByResourceName.delete(resourceData.name);
    }
  }
}
