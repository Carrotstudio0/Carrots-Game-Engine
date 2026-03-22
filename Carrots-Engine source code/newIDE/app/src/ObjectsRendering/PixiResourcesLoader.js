// @flow
import '@esotericsoftware/spine-pixi-v8';
import slugs from 'slugs';
import axios from 'axios';
import * as PIXI from 'pixi.js';
import * as PIXI_SPINE from '@esotericsoftware/spine-pixi-v8';
import { SkeletonData, TextureAtlas } from '@esotericsoftware/spine-pixi-v8';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import ResourcesLoader from '../ResourcesLoader';
import { loadFontFace } from '../Utils/FontFaceLoader';
import { checkIfCredentialsRequired } from '../Utils/CrossOrigin';
import {
  createTextureFromResource,
  ensureTextureReady,
  getTextureDomResource,
  getTextureSource,
  isTextureReady,
  setTextureScaleMode,
} from '../Utils/PixiCompat/EditorPixiAdapter';
import { type ResourceKind } from '../ResourcesList/ResourceSource';
const gd: libGDevelop = global.gd;

type SpineTextureAtlasOrLoadingError = {|
  // $FlowFixMe[value-as-type]
  textureAtlas: ?TextureAtlas,
  loadingError: ?Error,
  loadingErrorReason:
    | null
    | 'invalid-atlas-resource'
    | 'missing-texture-resources'
    | 'atlas-resource-loading-error',
|};

export type SpineDataOrLoadingError = {|
  // $FlowFixMe[value-as-type]
  skeleton: ?SkeletonData,
  loadingError: ?Error,
  loadingErrorReason:
    | null
    | 'invalid-spine-resource'
    | 'missing-texture-atlas-name'
    | 'spine-resource-loading-error'
    // Atlas loading error reasons:
    | 'invalid-atlas-resource'
    | 'missing-texture-resources'
    | 'atlas-resource-loading-error',
|};

type ResourcePromise<T> = { [resourceName: string]: Promise<T> };

let loadedBitmapFonts = {};
let loadedFontFamilies = {};
let loadedTextures = {};
const invalidTexture = createTextureFromResource('res/invalid_texture.png');
const loadingTexture = createTextureFromResource(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAAA1BMVEXX19f5cgrAAAAAAXRSTlMz/za5cAAAAApJREFUCNdjQAMAABAAAbSqgB8AAAAASUVORK5CYII='
);
// $FlowFixMe[value-as-type]
let loadedOrLoadingThreeTextures: ResourcePromise<THREE.Texture> = {};
// $FlowFixMe[value-as-type]
let loadedOrLoadingThreeMaterials: ResourcePromise<THREE.Material> = {};
// $FlowFixMe[value-as-type]
let loadedOrLoading3DModelPromises: ResourcePromise<THREE.THREE_ADDONS.GLTF> = {};
let spineAtlasPromises: ResourcePromise<SpineTextureAtlasOrLoadingError> = {};
let spineDataPromises: ResourcePromise<SpineDataOrLoadingError> = {};

const getFileExtension = (path: string): string => {
  if (!path) return '';
  const withoutHash = path.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const extensionSeparatorIndex = withoutQuery.lastIndexOf('.');
  if (extensionSeparatorIndex === -1) return '';
  return withoutQuery.substring(extensionSeparatorIndex + 1).toLowerCase();
};

const normalizeDependencyPath = (dependencyPath: string): string =>
  (dependencyPath || '')
    .replace(/\\/g, '/')
    .split('#')[0]
    .split('?')[0]
    .trim();

const decodeURIComponentSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getDependencyLookupKeys = (dependencyPath: string): Array<string> => {
  const normalizedPath = normalizeDependencyPath(dependencyPath);
  if (!normalizedPath) return [];

  const decodedPath = normalizeDependencyPath(
    decodeURIComponentSafe(normalizedPath)
  );
  const pathFileName = normalizedPath.includes('/')
    ? normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1)
    : normalizedPath;
  const decodedPathFileName = decodedPath.includes('/')
    ? decodedPath.substring(decodedPath.lastIndexOf('/') + 1)
    : decodedPath;

  return [...new Set([normalizedPath, decodedPath, pathFileName, decodedPathFileName])];
};

const toLoaded3DModel = (
  scene: THREE.Object3D,
  animations: Array<THREE.AnimationClip>
  // $FlowFixMe[value-as-type]
): GLTF => ({
  scene,
  animations,
  cameras: [],
  scenes: [],
  asset: {},
  userData: {},
  // $FlowFixMe[incompatible-return]
  parser: null,
});

// $FlowFixMe[value-as-type]
const createInvalidModel = (): GLTF => {
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
  return toLoaded3DModel(group, []);
};
// $FlowFixMe[value-as-type]
const invalidModel: GLTF = createInvalidModel();

let dracoLoader = null;
const getOrCreateDracoLoader = () => {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./external/draco/gltf/');
  }
  return dracoLoader;
};

const load3DModel = (
  project: gdProject,
  resourceName: string
  // $FlowFixMe[value-as-type]
): Promise<THREE.THREE_ADDONS.GLTF> => {
  if (
    resourceName.length === 0 ||
    !project.getResourcesManager().hasResource(resourceName)
  )
    return Promise.resolve(invalidModel);

  const resource = project.getResourcesManager().getResource(resourceName);
  if (resource.getKind() !== 'model3D') return Promise.resolve(invalidModel);

  const readEmbeddedResourcesMappingFromResource = (): { [string]: string } | null => {
    const metadataString = resource.getMetadata();
    try {
      const metadata = JSON.parse(metadataString);
      if (
        !metadata.embeddedResourcesMapping ||
        typeof metadata.embeddedResourcesMapping !== 'object'
      ) {
        return null;
      }
      return metadata.embeddedResourcesMapping;
    } catch {
      return null;
    }
  };
  const embeddedResourcesMapping = readEmbeddedResourcesMappingFromResource();

  const resolveEmbeddedDependencyUrl = (dependencyPath: string): string | null => {
    if (!embeddedResourcesMapping) {
      return null;
    }

    const dependencyLookupKeys = getDependencyLookupKeys(dependencyPath);
    if (!dependencyLookupKeys.length) {
      return null;
    }
    const lowerCaseDependencyLookupKeys = dependencyLookupKeys.map((key) =>
      key.toLowerCase()
    );

    let mappedResourceName: ?string = null;
    for (const [embeddedPath, mappedResource] of Object.entries(
      embeddedResourcesMapping
    )) {
      if (typeof mappedResource !== 'string') {
        continue;
      }
      const embeddedLookupKeys = getDependencyLookupKeys(embeddedPath).map((key) =>
        key.toLowerCase()
      );
      if (
        embeddedLookupKeys.some((key) =>
          lowerCaseDependencyLookupKeys.includes(key)
        )
      ) {
        mappedResourceName = mappedResource;
        break;
      }
    }

    if (!mappedResourceName) {
      for (const key of dependencyLookupKeys) {
        const directMappedResource = embeddedResourcesMapping[key];
        if (typeof directMappedResource === 'string') {
          mappedResourceName = directMappedResource;
          break;
        }

        const metadataKey = Object.keys(embeddedResourcesMapping).find(
          mappedDependency => mappedDependency.toLowerCase() === key.toLowerCase()
        );
        if (!metadataKey) {
          continue;
        }
        const caseInsensitiveMappedResource = embeddedResourcesMapping[metadataKey];
        if (typeof caseInsensitiveMappedResource === 'string') {
          mappedResourceName = caseInsensitiveMappedResource;
          break;
        }
      }
    }

    if (!mappedResourceName) {
      return null;
    }

    const resourcesManager = project.getResourcesManager();
    if (!resourcesManager.hasResource(mappedResourceName)) {
      return null;
    }

    return ResourcesLoader.getResourceFullUrl(project, mappedResourceName, {
      isResourceForPixi: true,
    });
  };

  const url = ResourcesLoader.getResourceFullUrl(project, resourceName, {
    isResourceForPixi: true,
  });
  const loadingManager = new THREE.LoadingManager();
  loadingManager.setURLModifier(assetUrl => {
    const resolvedUrl = resolveEmbeddedDependencyUrl(assetUrl);
    return resolvedUrl || assetUrl;
  });

  if (getFileExtension(resource.getFile()) === 'fbx') {
    const fbxLoader = new FBXLoader(loadingManager);
    fbxLoader.withCredentials = checkIfCredentialsRequired(url);
    return new Promise((resolve, reject) => {
      fbxLoader.load(
        url,
        fbxScene => {
          traverseToRemoveMetalnessFromMeshes(fbxScene);
          const animations = Array.isArray(fbxScene.animations)
            ? fbxScene.animations
            : [];
          resolve(toLoaded3DModel(fbxScene, animations));
        },
        undefined,
        error => {
          reject(error);
        }
      );
    });
  }

  const gltfLoader = new GLTFLoader(loadingManager);
  gltfLoader.setDRACOLoader(getOrCreateDracoLoader());
  gltfLoader.withCredentials = checkIfCredentialsRequired(url);
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      gltf => {
        traverseToRemoveMetalnessFromMeshes(gltf.scene);
        resolve(gltf);
      },
      undefined,
      error => {
        reject(error);
      }
    );
  });
};

const determineCrossOrigin = (url: string) => {
  // Any resource stored on the GDevelop Cloud buckets needs the "credentials" of the user,
  // i.e: its gdevelop.io cookie, to be passed.
  if (checkIfCredentialsRequired(url)) return 'use-credentials';

  // For other resources, use "anonymous" as done by default by PixiJS. Note that using `false`
  // to not having `crossorigin` at all would NOT work because the browser would taint the
  // loaded resource so that it can't be read/used in a canvas (it's only working for display `<img>` on screen).
  return 'anonymous';
};

const applyPixiTextureSettings = (resource: gdResource, texture: any) => {
  if (resource.getKind() !== 'image') return;

  const imageResource = gd.asImageResource(resource);
  if (!imageResource.isSmooth()) {
    setTextureScaleMode(texture, 'nearest');
  }
};

const ensureTextureReadyWithFallback = (
  resourceName: string,
  texture: any,
  errorPrefix: string
) => {
  ensureTextureReady(texture).catch(error => {
    console.error(errorPrefix, error);
    // $FlowFixMe[prop-missing]
    loadedTextures[resourceName] = invalidTexture;
  });
};

const applyThreeTextureSettings = (
  resource: gdResource,
  // $FlowFixMe[value-as-type]
  threeTexture: THREE.Texture
) => {
  if (resource.getKind() !== 'image') return;

  const imageResource = gd.asImageResource(resource);
  if (!imageResource.isSmooth()) {
    threeTexture.magFilter = THREE.NearestFilter;
    threeTexture.minFilter = THREE.NearestFilter;
  }
};

// If modifying this function, make sure to update Resource3DPreview.worker.js copy.
// $FlowFixMe[value-as-type]
const removeMetalness = (material: THREE.Material): void => {
  if (material.metalness) {
    material.metalness = 0;
  }
};

// If modifying this function, make sure to update Resource3DPreview.worker.js copy.
// $FlowFixMe[value-as-type]
const removeMetalnessFromMesh = (node: THREE.Object3D): void => {
  // $FlowFixMe[value-as-type]
  const mesh = (node: THREE.Mesh);
  if (!mesh.material) {
    return;
  }
  if (Array.isArray(mesh.material)) {
    for (let index = 0; index < mesh.material.length; index++) {
      removeMetalness(mesh.material[index]);
    }
  } else {
    removeMetalness(mesh.material);
  }
};

// $FlowFixMe[value-as-type]
const traverseToRemoveMetalnessFromMeshes = (node: THREE.Object3D) =>
  node.traverse(removeMetalnessFromMesh);

export const readEmbeddedResourcesMapping = (
  resource: gdResource
): {} | null => {
  const metadataString = resource.getMetadata();
  try {
    const metadata = JSON.parse(metadataString);
    if (
      !metadata.embeddedResourcesMapping ||
      typeof metadata.embeddedResourcesMapping !== 'object'
    ) {
      return null;
    }

    return metadata.embeddedResourcesMapping;
  } catch (err) {
    return null;
  }
};

const getEmbedderResources = (
  project: gdProject,
  embeddedResourceName: string,
  embedderResourceKind: ResourceKind
): Array<gdResource> => {
  const resourcesManager = project.getResourcesManager();
  const embedderResources: Array<gdResource> = [];

  for (const resourceName of resourcesManager
    .getAllResourceNames()
    .toJSArray()) {
    if (embeddedResourceName === resourceName) {
      continue;
    }

    const possibleEmbedderResource = resourcesManager.getResource(resourceName);
    if (possibleEmbedderResource.getKind() !== embedderResourceKind) {
      continue;
    }

    const embeddedResourcesMapping = readEmbeddedResourcesMapping(
      possibleEmbedderResource
    );
    if (!embeddedResourcesMapping) {
      continue;
    }

    const mappedResources = Object.values(embeddedResourcesMapping);
    if (mappedResources.includes(embeddedResourceName)) {
      embedderResources.push(possibleEmbedderResource);
    }
  }

  return embedderResources;
};

/**
 * Expose functions to load PIXI textures or fonts, given the names of
 * resources and a gd.Project.
 *
 * This internally uses ResourcesLoader to get the URL of the resources.
 */
export default class PixiResourcesLoader {
  static burstCache() {
    loadedBitmapFonts = {};
    loadedFontFamilies = {};
    loadedTextures = {};
    loadedOrLoadingThreeTextures = {};
    loadedOrLoadingThreeMaterials = {};
    loadedOrLoading3DModelPromises = {};
    spineAtlasPromises = {};
    spineDataPromises = {};
  }

  static async _reloadEmbedderResources(
    project: gdProject,
    embeddedResourceName: string,
    embedderResourceKind: ResourceKind
  ) {
    const embeddedResources = getEmbedderResources(
      project,
      embeddedResourceName,
      embedderResourceKind
    );
    await Promise.all(
      embeddedResources.map(embeddedResource =>
        this.reloadResource(project, embeddedResource.getName())
      )
    );
  }

  static async reloadResource(project: gdProject, resourceName: string) {
    // $FlowFixMe[invalid-computed-prop]
    const loadedTexture = loadedTextures[resourceName];
    if (loadedTexture && loadedTexture.textureCacheIds) {
      // The property textureCacheIds indicates that the PIXI.Texture object has some
      // items cached in PIXI caches (PIXI.utils.BaseTextureCache and PIXI.utils.TextureCache).
      // PIXI.Assets.unload will handle the clearing of those caches.
      await PIXI.Assets.unload(loadedTexture.textureCacheIds);
      // The cached texture is also removed. This is to handle cases where an empty texture
      // has been cached (if file was not found for instance), and a corresponding file has
      // been added and detected by file watcher. When reloading the texture, the cache must
      // be cleaned too.
      // $FlowFixMe[prop-missing]
      delete loadedTextures[resourceName];

      // Also reload any resource embedding this resource:
      await this._reloadEmbedderResources(project, resourceName, 'atlas');
    }

    await PixiResourcesLoader.loadTextures(project, [resourceName]);

    if (loadedOrLoading3DModelPromises[resourceName]) {
      delete loadedOrLoading3DModelPromises[resourceName];
    }
    // $FlowFixMe[invalid-computed-prop]
    if (loadedFontFamilies[resourceName]) {
      // $FlowFixMe[prop-missing]
      delete loadedFontFamilies[resourceName];
    }
    // $FlowFixMe[invalid-computed-prop]
    if (loadedBitmapFonts[resourceName]) {
      // $FlowFixMe[prop-missing]
      delete loadedBitmapFonts[resourceName];
    }
    if (loadedOrLoadingThreeTextures[resourceName]) {
      const threeTexture = await loadedOrLoadingThreeTextures[resourceName];
      threeTexture.dispose();
      delete loadedOrLoadingThreeTextures[resourceName];
    }
    if (spineAtlasPromises[resourceName]) {
      await PIXI.Assets.unload(resourceName);
      delete spineAtlasPromises[resourceName];

      // Also reload any resource embedding this resource:
      await this._reloadEmbedderResources(project, resourceName, 'spine');
    }
    if (spineDataPromises[resourceName]) {
      await PIXI.Assets.unload(resourceName);
      delete spineDataPromises[resourceName];

      // This line allows us to avoid issue https://github.com/pixijs/pixijs/issues/10069.
      // PIXI.Assets.resolver caches data that was passed to `PIXI.Assets.add`, even if resource was unloaded.
      // So every time we unload spine resources, we need to call it to clean the resolver cache
      // and pick up fresh data next time we call `getSpineData`.
      PIXI.Assets.resolver.prefer();
    }

    const matchingMaterialCacheKeys = Object.keys(
      loadedOrLoadingThreeMaterials
    ).filter(key => key.startsWith(resourceName));
    if (matchingMaterialCacheKeys.length > 0) {
      await Promise.all(
        matchingMaterialCacheKeys.map(async key => {
          const material = await loadedOrLoadingThreeMaterials[key];
          material.dispose();
          delete loadedOrLoadingThreeMaterials[key];
        })
      );
    }
  }
  /**
   * (Re)load the PIXI texture represented by the given resources.
   */
  static async loadTextures(
    project: gdProject,
    resourceNames: Array<string>
  ): Promise<void> {
    const resourcesManager = project.getResourcesManager();

    const imageResources = resourceNames
      .map(resourceName => {
        if (!resourcesManager.hasResource(resourceName)) {
          return null;
        }
        const resource = resourcesManager.getResource(resourceName);
        if (resource.getKind() !== 'image') {
          return null;
        }
        return resource;
      })
      .filter(Boolean);
    const videoResources = resourceNames
      .map(resourceName => {
        if (!resourcesManager.hasResource(resourceName)) {
          return null;
        }
        const resource = resourcesManager.getResource(resourceName);
        if (resource.getKind() !== 'video') {
          return null;
        }
        return resource;
      })
      .filter(Boolean);

    // TODO use a PromisePool to be able to abort the previous reload of resources.
    await Promise.all([
      ...imageResources.map(async resource => {
        const resourceName = resource.getName();
        try {
          const url = ResourcesLoader.getResourceFullUrl(
            project,
            resourceName,
            {
              isResourceForPixi: true,
            }
          );
          PIXI.Assets.setPreferences({
            preferWorkers: false,
            preferCreateImageBitmap: false,
            crossOrigin: determineCrossOrigin(url),
          });
          const loadedTexture = await PIXI.Assets.load(url);
          // $FlowFixMe[prop-missing]
          loadedTextures[resourceName] = loadedTexture;
          // TODO What if 2 assets share the same file with different settings?
          applyPixiTextureSettings(resource, loadedTexture);
        } catch (error) {
          console.error(
            `Unable to load file ${resource.getFile()} for image resource ${resourceName}:`,
            error ? error : '(unknown error)'
          );
        }
      }),
      ...videoResources.map(async resource => {
        const resourceName = resource.getName();
        try {
          const url = ResourcesLoader.getResourceFullUrl(
            project,
            resourceName,
            {
              isResourceForPixi: true,
            }
          );

          // $FlowFixMe[prop-missing]
          loadedTextures[resourceName] = createTextureFromResource(url, {
            scaleMode: 'linear',
            autoPlay: false,
            // If autoLoad is set to false (instinctive choice given that the code
            // calls the load method on the base texture), the video is displayed
            // as a black rectangle.
            autoLoad: true,
            // crossorigin does not have a typo (with regards to PIXI.Assets.setPreferences that
            // uses a crossOrigin parameter). See https://pixijs.download/dev/docs/PIXI.html#autoDetectResource.
            crossorigin: determineCrossOrigin(url),
          });
          // $FlowFixMe[invalid-computed-prop]
          if (!loadedTextures[resourceName]) {
            console.error(`Texture loading for ${url} returned nothing`);
            // $FlowFixMe[prop-missing]
            loadedTextures[resourceName] = invalidTexture;
          }

          // $FlowFixMe[invalid-computed-prop]
          ensureTextureReadyWithFallback(
            resourceName,
            loadedTextures[resourceName],
            `Unable to load video texture from url ${url}:`
          );
        } catch (error) {
          console.error(
            `Unable to load file ${resource.getFile()} for video resource ${resourceName}:`,
            error ? error : '(unknown error)'
          );
        }
      }),
    ]);
  }

  /**
   * Return the PIXI texture represented by the given resource.
   * If not loaded, it will load it.
   * @returns The PIXI.Texture to be used. It can be loading, so you
   * should listen to PIXI.Texture `update` event, and refresh your object
   * if this event is triggered.
   */
  static getPIXITexture(project: gdProject, resourceName: string): any {
    // $FlowFixMe[invalid-computed-prop]
    if (loadedTextures[resourceName]) {
      // TODO: we never consider textures as not valid anymore. When we
      // update the IDE to unload textures, we should handle loading them again
      // here (and also be careful to return the same texture if it's not valid
      // but still loading, when multiple objects are rapidly asking for the same texture).
      return loadedTextures[resourceName];
    }

    if (
      resourceName.length === 0 ||
      !project.getResourcesManager().hasResource(resourceName)
    )
      return invalidTexture;

    const resource = project.getResourcesManager().getResource(resourceName);
    if (resource.getKind() !== 'image') return invalidTexture;

    const url = ResourcesLoader.getResourceFullUrl(project, resourceName, {
      isResourceForPixi: true,
    });
    // $FlowFixMe[prop-missing]
    loadedTextures[resourceName] = createTextureFromResource(url, {
      crossorigin: determineCrossOrigin(url),
      autoLoad: false,
    });
    // $FlowFixMe[invalid-computed-prop]
    if (!loadedTextures[resourceName]) {
      console.error(`Texture loading for ${url} returned nothing`);
      // $FlowFixMe[prop-missing]
      loadedTextures[resourceName] = invalidTexture;
      // $FlowFixMe[invalid-computed-prop]
      return loadedTextures[resourceName];
    }
    ensureTextureReadyWithFallback(
      resourceName,
      loadedTextures[resourceName],
      `Unable to load texture from url ${url}:`
    );

    // $FlowFixMe[invalid-computed-prop]
    applyPixiTextureSettings(resource, loadedTextures[resourceName]);
    // $FlowFixMe[invalid-computed-prop]
    return loadedTextures[resourceName];
  }

  /**
   * Return the three.js texture associated to the specified resource name.
   * Returns a placeholder texture if not found.
   * @param project The project
   * @param resourceName The name of the resource
   * @returns The requested texture, or a placeholder if not found.
   */
  static async getThreeTexture(
    project: gdProject,
    resourceName: string
    // $FlowFixMe[value-as-type]
  ): Promise<THREE.Texture> {
    const loadedOrLoadingPromise = loadedOrLoadingThreeTextures[resourceName];
    // $FlowFixMe[constant-condition]
    if (loadedOrLoadingPromise) return loadedOrLoadingPromise;

    // Texture is not loaded, load it now from the PixiJS texture.
    // TODO (3D) - optimization: don't load the PixiJS Texture if not used by PixiJS.
    // TODO (3D) - optimization: Ideally we could even share the same WebGL texture.
    const pixiTexture = PixiResourcesLoader.getPIXITexture(
      project,
      resourceName
    );

    if (!isTextureReady(pixiTexture)) {
      // Post pone texture update if texture is not loaded.
      return new Promise(resolve => {
        pixiTexture.once('update', () =>
          resolve(this.getThreeTexture(project, resourceName))
        );
      });
    }

    const image = getTextureDomResource(pixiTexture);
    if (
      typeof HTMLImageElement === 'undefined' ||
      !(image instanceof HTMLImageElement)
    ) {
      throw new Error(
        `Can't load texture for resource "${resourceName}" as it's not an image.`
      );
    }

    const threeTexture = new THREE.Texture(image);
    threeTexture.magFilter = THREE.LinearFilter;
    threeTexture.minFilter = THREE.LinearFilter;
    threeTexture.wrapS = THREE.RepeatWrapping;
    threeTexture.wrapT = THREE.RepeatWrapping;
    threeTexture.colorSpace = THREE.SRGBColorSpace;
    threeTexture.needsUpdate = true;

    const resource = project.getResourcesManager().getResource(resourceName);
    applyThreeTextureSettings(resource, threeTexture);

    return (loadedOrLoadingThreeTextures[resourceName] = Promise.resolve(
      threeTexture
    ));
  }

  /**
   * Return the three.js material associated to the specified resource name.
   * @param project The project
   * @param resourceName The name of the resource
   * @param options Set if the material should be transparent or not.
   * @returns The requested material.
   */
  static async getThreeMaterial(
    project: gdProject,
    resourceName: string,
    {
      useTransparentTexture,
    }: {|
      useTransparentTexture: boolean,
    |}
  ): // $FlowFixMe[value-as-type]
  Promise<THREE.Material> {
    const cacheKey = `${resourceName}|transparent:${useTransparentTexture.toString()}`;
    const loadedOrLoadingPromise = loadedOrLoadingThreeMaterials[cacheKey];
    // $FlowFixMe[constant-condition]
    if (loadedOrLoadingPromise) return loadedOrLoadingPromise;

    return (loadedOrLoadingThreeMaterials[cacheKey] = this.getThreeTexture(
      project,
      resourceName
    ).then(texture => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: useTransparentTexture ? THREE.DoubleSide : THREE.FrontSide,
        transparent: useTransparentTexture,
        vertexColors: true,
      });

      return material;
    }));
  }

  /**
   * Return the three.js material associated to the specified resource name.
   * @param project The project
   * @param resourceName The name of the resource
   * @param options
   * @returns The requested material.
   */
  static get3DModel(
    project: gdProject,
    resourceName: string
    // $FlowFixMe[value-as-type]
  ): Promise<THREE.THREE_ADDONS.GLTF> {
    const promise = loadedOrLoading3DModelPromises[resourceName];
    // $FlowFixMe[constant-condition]
    if (promise) return promise;

    const loadingPromise = load3DModel(project, resourceName);
    loadedOrLoading3DModelPromises[resourceName] = loadingPromise;
    return loadingPromise;
  }

  /**
   * Return the Pixi spine texture atlas of the specified resource names.
   * @param project The project
   * @param spineTextureAtlasName The name of the atlas texture resource.
   * @returns The requested texture atlas, or null if it could not be loaded.
   */
  static async _getSpineTextureAtlas(
    project: gdProject,
    spineTextureAtlasName: string
  ): Promise<SpineTextureAtlasOrLoadingError> {
    const promise = spineAtlasPromises[spineTextureAtlasName];
    // $FlowFixMe[constant-condition]
    if (promise) return promise;

    if (!spineTextureAtlasName) {
      return {
        textureAtlas: null,
        loadingError: null,
        loadingErrorReason: 'invalid-atlas-resource',
      };
    }

    const resourceManager = project.getResourcesManager();
    if (
      spineTextureAtlasName.length === 0 ||
      !resourceManager.hasResource(spineTextureAtlasName)
    ) {
      return {
        textureAtlas: null,
        loadingError: null,
        loadingErrorReason: 'invalid-atlas-resource',
      };
    }

    const resource = resourceManager.getResource(spineTextureAtlasName);
    if (resource.getKind() !== 'atlas') {
      return {
        textureAtlas: null,
        loadingError: null,
        loadingErrorReason: 'invalid-atlas-resource',
      };
    }

    const embeddedResourcesMapping = readEmbeddedResourcesMapping(resource);
    const textureAtlasMappingEntries = embeddedResourcesMapping
      ? Object.entries(embeddedResourcesMapping)
      : [];
    if (!textureAtlasMappingEntries.length) {
      return {
        textureAtlas: null,
        loadingError: null,
        loadingErrorReason: 'missing-texture-resources',
      };
    }

    const images = textureAtlasMappingEntries.reduce(
      (imagesMapping, [relatedPath, resourceName]) => {
        // flow check
        if (typeof resourceName === 'string') {
          const texture = this.getPIXITexture(project, resourceName);
          imagesMapping[relatedPath] = getTextureSource(texture);
        }

        return imagesMapping;
      },
      {}
    );

    return (spineAtlasPromises[spineTextureAtlasName] = new Promise(resolve => {
      const atlasUrl = ResourcesLoader.getResourceFullUrl(
        project,
        spineTextureAtlasName,
        {
          isResourceForPixi: true,
        }
      );
      PIXI.Assets.setPreferences({
        preferWorkers: false,
        crossOrigin: checkIfCredentialsRequired(atlasUrl)
          ? 'use-credentials'
          : 'anonymous',
      });
      PIXI.Assets.add({
        alias: spineTextureAtlasName,
        src: atlasUrl,
        data: { images },
      });
      PIXI.Assets.load(spineTextureAtlasName).then(
        atlas => {
          resolve({
            textureAtlas: atlas,
            loadingError: null,
            loadingErrorReason: null,
          });
        },
        err => {
          console.error(
            `Error while loading Spine atlas "${spineTextureAtlasName}": ${err}.\nCheck if you selected the correct pair of atlas and image files.`
          );
          resolve({
            textureAtlas: null,
            loadingError: err,
            loadingErrorReason: 'atlas-resource-loading-error',
          });
        }
      );
    }));
  }

  /**
   * Return the Pixi spine data for the specified resource name.
   * @param project The project
   * @param spineName The name of the spine json resource
   * @returns The requested spine skeleton.
   */
  static async getSpineData(
    project: gdProject,
    spineName: string
  ): Promise<SpineDataOrLoadingError> {
    const promise = spineDataPromises[spineName];
    // $FlowFixMe[constant-condition]
    if (promise) return promise;

    const resourceManager = project.getResourcesManager();
    if (!spineName || !resourceManager.hasResource(spineName)) {
      return {
        skeleton: null,
        loadingError: null,
        loadingErrorReason: 'invalid-spine-resource',
      };
    }

    const resource = resourceManager.getResource(spineName);
    if (resource.getKind() !== 'spine') {
      return {
        skeleton: null,
        loadingError: null,
        loadingErrorReason: 'invalid-spine-resource',
      };
    }

    const embeddedResourcesMapping = readEmbeddedResourcesMapping(resource);
    const spineTextureAtlasName = embeddedResourcesMapping
      ? Object.values(embeddedResourcesMapping)[0]
      : null;
    if (typeof spineTextureAtlasName !== 'string') {
      return {
        skeleton: null,
        loadingError: null,
        loadingErrorReason: 'missing-texture-atlas-name',
      };
    }

    return (spineDataPromises[spineName] = new Promise(resolve => {
      this._getSpineTextureAtlas(project, spineTextureAtlasName).then(
        textureAtlasOrLoadingError => {
          if (!textureAtlasOrLoadingError.textureAtlas) {
            return resolve({
              skeleton: null,
              loadingError: textureAtlasOrLoadingError.loadingError,
              loadingErrorReason: textureAtlasOrLoadingError.loadingErrorReason,
            });
          }

          const spineUrl = ResourcesLoader.getResourceFullUrl(
            project,
            spineName,
            {
              isResourceForPixi: true,
            }
          );
          PIXI.Assets.setPreferences({
            preferWorkers: false,
            crossOrigin: checkIfCredentialsRequired(spineUrl)
              ? 'use-credentials'
              : 'anonymous',
          });
          PIXI.Assets.add({
            alias: spineName,
            src: spineUrl,
          });
          PIXI.Assets.load(spineName).then(
            loadedSkeletonAsset => {
              const atlasAttachmentLoader = new PIXI_SPINE.AtlasAttachmentLoader(
                textureAtlasOrLoadingError.textureAtlas
              );
              const parser =
                loadedSkeletonAsset instanceof Uint8Array
                  ? new PIXI_SPINE.SkeletonBinary(atlasAttachmentLoader)
                  : new PIXI_SPINE.SkeletonJson(atlasAttachmentLoader);
              parser.scale = 1;
              const skeletonData = parser.readSkeletonData(
                loadedSkeletonAsset
              );
              resolve({
                skeleton: skeletonData,
                loadingError: null,
                loadingErrorReason: null,
              });
            },
            err => {
              console.error(
                `Error while loading Spine data "${spineName}": ${err}.\nCheck if you selected correct files.`
              );
              resolve({
                skeleton: null,
                loadingError: err,
                loadingErrorReason: 'spine-resource-loading-error',
              });
            }
          );
        }
      );
    }));
  }

  /**
   * Return the PIXI video texture represented by the given resource.
   * If not loaded, it will load it.
   * @returns The PIXI.Texture to be used. It can be loading, so you
   * should listen to PIXI.Texture `update` event, and refresh your object
   * if this event is triggered.
   */
  static getPIXIVideoTexture(project: gdProject, resourceName: string): any {
    // $FlowFixMe[invalid-computed-prop]
    if (loadedTextures[resourceName]) {
      // TODO: we never consider textures as not valid anymore. When we
      // update the IDE to unload textures, we should handle loading them again
      // here (and also be careful to return the same texture if it's not valid
      // but still loading, when multiple objects are rapidly asking for the same texture).
      return loadedTextures[resourceName];
    }

    if (
      resourceName.length === 0 ||
      !project.getResourcesManager().hasResource(resourceName)
    )
      return invalidTexture;

    const resource = project.getResourcesManager().getResource(resourceName);
    if (resource.getKind() !== 'video') return invalidTexture;

    const url = ResourcesLoader.getResourceFullUrl(project, resourceName, {
      isResourceForPixi: true,
    });

    // $FlowFixMe[prop-missing]
    loadedTextures[resourceName] = createTextureFromResource(url, {
      scaleMode: 'linear',
      autoPlay: false,
      // If autoLoad is set to false (instinctive choice given that the code
      // calls the load method on the base texture), the video is displayed
      // as a black rectangle.
      autoLoad: true,
      crossorigin: determineCrossOrigin(url),
    });
    // $FlowFixMe[invalid-computed-prop]
    if (!loadedTextures[resourceName]) {
      console.error(`Texture loading for ${url} returned nothing`);
      // $FlowFixMe[prop-missing]
      loadedTextures[resourceName] = invalidTexture;
      // $FlowFixMe[invalid-computed-prop]
      return loadedTextures[resourceName];
    }

    ensureTextureReadyWithFallback(
      resourceName,
      loadedTextures[resourceName],
      `Unable to load video texture from url ${url}:`
    );

    // $FlowFixMe[invalid-computed-prop]
    return loadedTextures[resourceName];
  }

  /**
   * Load the given font from its url/filename.
   * @returns a Promise that resolves with the font-family to be used
   * to render a text with the font.
   */
  static loadFontFamily(
    project: gdProject,
    resourceName: string
  ): Promise<string> {
    // Avoid reloading a font if it's already cached
    // $FlowFixMe[invalid-computed-prop]
    if (loadedFontFamilies[resourceName]) {
      return Promise.resolve(loadedFontFamilies[resourceName]);
    }

    const fontFamily = slugs(resourceName);
    let fullFilename = null;
    if (
      resourceName.length > 0 &&
      project.getResourcesManager().hasResource(resourceName)
    ) {
      const resource = project.getResourcesManager().getResource(resourceName);
      if (resource.getKind() === 'font') {
        fullFilename = ResourcesLoader.getResourceFullUrl(
          project,
          resourceName,
          {
            isResourceForPixi: true,
          }
        );
      }
    } else {
      // Compatibility with GD <= 5.0-beta56
      // Assume resourceName is just the filename to the font
      fullFilename = ResourcesLoader.getFullUrl(project, resourceName, {
        isResourceForPixi: true,
      });
      // end of compatibility code
    }

    if (!fullFilename) {
      // If no resource is found/resource is not a font, default to Arial,
      // as done by the game engine too.
      return Promise.resolve('Arial');
    }

    return loadFontFace(fontFamily, fullFilename).then(loadedFace => {
      // $FlowFixMe[prop-missing]
      loadedFontFamilies[resourceName] = fontFamily;

      return fontFamily;
    });
  }

  /**
   * Get the font family name for the given font resource.
   * The font won't be loaded.
   * @returns The font-family to be used to render a text with the font.
   */
  static getFontFamily(project: gdProject, resourceName: string): any {
    // $FlowFixMe[invalid-computed-prop]
    if (loadedFontFamilies[resourceName]) {
      return loadedFontFamilies[resourceName];
    }

    const fontFamily = slugs(resourceName);
    return fontFamily;
  }

  /**
   * Get the data from a bitmap font file (fnt/xml) resource in the IDE.
   */
  static getBitmapFontData(
    project: gdProject,
    resourceName: string
  ): Promise<any> {
    // $FlowFixMe[invalid-computed-prop]
    if (loadedBitmapFonts[resourceName]) {
      return Promise.resolve(loadedBitmapFonts[resourceName].data);
    }

    if (
      resourceName.length === 0 ||
      !project.getResourcesManager().hasResource(resourceName)
    )
      return Promise.reject(
        new Error(`Can't find resource called ${resourceName}.`)
      );

    const resource = project.getResourcesManager().getResource(resourceName);
    // $FlowFixMe[invalid-compare]
    if (resource.getKind() !== 'bitmapFont')
      return Promise.reject(
        new Error(
          `The resource called ${resourceName} is not a bitmap font file. Require .fnt or .xml format.`
        )
      );

    const fullUrl = ResourcesLoader.getResourceFullUrl(project, resourceName, {
      isResourceForPixi: true,
    });
    if (!fullUrl) {
      return Promise.reject(
        new Error(
          `The resource called ${resourceName} was no found.\nThe default bitmap font will be used.`
        )
      );
    }

    return (
      axios
        // $FlowFixMe[underconstrained-implicit-instantiation]
        .get(fullUrl, {
          withCredentials: checkIfCredentialsRequired(fullUrl),
        })
        .then(response => {
          // $FlowFixMe[prop-missing]
          loadedBitmapFonts[resourceName] = response;
          return response.data;
        })
    );
  }

  static getInvalidPIXITexture(): any {
    return invalidTexture;
  }

  static getLoadingPIXITexture(): any {
    return loadingTexture;
  }

  /**
   * Get the data from a json resource in the IDE.
   */
  static getResourceJsonData(
    project: gdProject,
    resourceName: string
  ): Promise<any> {
    if (
      resourceName.length === 0 ||
      !project.getResourcesManager().hasResource(resourceName)
    )
      return Promise.reject(
        new Error(`Can't find resource called ${resourceName}.`)
      );

    const resource = project.getResourcesManager().getResource(resourceName);
    if (
      resource.getKind() !== 'json' &&
      resource.getKind() !== 'tilemap' &&
      resource.getKind() !== 'tileset'
    )
      return Promise.reject(
        new Error(`The resource called ${resourceName} is not a json file.`)
      );

    const fullUrl = ResourcesLoader.getResourceFullUrl(project, resourceName, {
      isResourceForPixi: true,
    });
    return (
      axios
        // $FlowFixMe[underconstrained-implicit-instantiation]
        .get(fullUrl, {
          withCredentials: checkIfCredentialsRequired(fullUrl),
        })
        .then(response => response.data)
    );
  }
}
