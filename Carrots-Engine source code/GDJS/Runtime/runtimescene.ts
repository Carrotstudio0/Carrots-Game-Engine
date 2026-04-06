/*
 * GDevelop JS Platform
 * Copyright 2013-2016 Florian Rival (Florian.Rival@gmail.com). All rights reserved.
 * This project is released under the MIT License.
 */
namespace gdjs {
  const logger = new gdjs.Logger('RuntimeScene');
  const setupWarningLogger = new gdjs.Logger('RuntimeScene (setup warnings)');
  const renderSnapshotWorkerHandlerName = 'GDJS::Render::cullSnapshot::v1';
  const renderSnapshotNumericStride = 7;
  const renderSnapshotXOffset = 0;
  const renderSnapshotYOffset = 1;
  const renderSnapshotAABBMinXOffset = 2;
  const renderSnapshotAABBMinYOffset = 3;
  const renderSnapshotAABBMaxXOffset = 4;
  const renderSnapshotAABBMaxYOffset = 5;
  const renderSnapshotLayerIndexOffset = 6;
  const renderSnapshotLayerBoundsStride = 4;
  const renderSnapshotLayerMinXOffset = 0;
  const renderSnapshotLayerMinYOffset = 1;
  const renderSnapshotLayerMaxXOffset = 2;
  const renderSnapshotLayerMaxYOffset = 3;
  const renderSnapshotSphereStride = 4;
  const renderSnapshotSphereCenterXOffset = 0;
  const renderSnapshotSphereCenterYOffset = 1;
  const renderSnapshotSphereCenterZOffset = 2;
  const renderSnapshotSphereRadiusOffset = 3;
  const renderSnapshotFlagHasRendererObject = 1 << 0;
  const renderSnapshotFlagHidden = 1 << 1;
  const renderSnapshotFlagHasAABB = 1 << 2;
  const renderSnapshotFlagHas3DRendererObject = 1 << 3;
  const renderSnapshotFlagHasSphere = 1 << 4;
  const renderSnapshotMinWorkerObjectCount = 128;
  const renderSnapshotMinBvhObjectCount = 96;
  const renderSnapshotBvhLeafSize = 16;
  const renderSnapshotOcclusionMinObjectCount = 24;
  const renderSnapshotOcclusionGridColumns = 24;
  const renderSnapshotOcclusionGridRows = 14;
  const renderSnapshotOcclusionDepthEpsilon = 0.001;
  const renderSnapshotOcclusionMinCoverageRatio = 0.08;
  const renderSnapshotOcclusionConservativeMinObjectCount = 48;
  const renderSnapshotOcclusionConservativeMinCoverageRatio = 0.12;
  const renderSnapshotOcclusionConservativeRequiredOccludedCellsRatio = 0.96;
  const renderSnapshotOcclusionConservativeMinCoveredCells = 6;
  const renderSnapshotOcclusionConservativeDepthMarginRatio = 0.01;
  const renderSnapshotOcclusionExtensionName = 'CarrotsEngine';
  const renderSnapshotOcclusionPropertyName = 'renderOcclusionCullingMode';
  const renderSnapshotIsolationEnabled = true;
  const renderSnapshotEnableWorkerCulling = false;
  let hasRegisteredRenderSnapshotWorkerHandler = false;

  type RenderSnapshotOcclusionCullingMode =
    | 'conservative'
    | 'aggressive'
    | 'disabled';

  const sanitizeRenderSnapshotOcclusionCullingMode = (
    value: string | null | undefined
  ): RenderSnapshotOcclusionCullingMode => {
    if (value === 'aggressive') return 'aggressive';
    if (value === 'disabled') return 'disabled';
    return 'conservative';
  };

  type RuntimeRenderSnapshot = {
    version: integer;
    objectCount: integer;
    layerCount: integer;
    numericData: Float32Array;
    flags: Uint8Array;
    objects: Array<gdjs.RuntimeObject | null>;
    layerNames: string[];
    layerBounds: Float32Array;
    sphereData: Float32Array;
    depthData: Float32Array;
    visibilityMask: Uint8Array;
    layerVisibilityMask: Uint8Array;
  };

  type RenderSnapshotLayerMetadata = {
    layer: gdjs.RuntimeLayer;
    layerIndex: integer;
    boundsMinX: float;
    boundsMinY: float;
    boundsMaxX: float;
    boundsMaxY: float;
    layerVisible: boolean;
    camera:
      | THREE.PerspectiveCamera
      | THREE.OrthographicCamera
      | null;
    cameraRotatedIn3D: boolean;
  };

  type RenderSnapshotBvhNode = {
    minX: float;
    minY: float;
    maxX: float;
    maxY: float;
    leftNodeIndex: integer;
    rightNodeIndex: integer;
    rangeStart: integer;
    rangeEnd: integer;
  };

  type RenderSnapshotWorkerCullingPayload = {
    snapshotVersion: integer;
    objectCount: integer;
    layerCount: integer;
    numericStride: integer;
    numericDataBuffer: ArrayBuffer;
    flagsBuffer: ArrayBuffer;
    layerBoundsBuffer: ArrayBuffer;
  };

  type RenderSnapshotWorkerCullingResult = {
    snapshotVersion: integer;
    objectCount: integer;
    visibilityBuffer: ArrayBuffer;
  };

  const isRenderSnapshotWorkerCullingResult = (
    value: unknown
  ): value is RenderSnapshotWorkerCullingResult => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const result = value as {
      snapshotVersion?: unknown;
      objectCount?: unknown;
      visibilityBuffer?: unknown;
    };
    return (
      typeof result.snapshotVersion === 'number' &&
      typeof result.objectCount === 'number' &&
      result.visibilityBuffer instanceof ArrayBuffer
    );
  };

  const ensureRenderSnapshotWorkerHandlerRegistered = (): void => {
    if (hasRegisteredRenderSnapshotWorkerHandler) {
      return;
    }
    if (
      typeof gdjs.registerWorkerTaskHandler !== 'function' ||
      typeof gdjs.hasWorkerTaskHandler !== 'function'
    ) {
      return;
    }
    if (!gdjs.hasWorkerTaskHandler(renderSnapshotWorkerHandlerName)) {
      gdjs.registerWorkerTaskHandler(
        renderSnapshotWorkerHandlerName,
        function (payload: unknown) {
          const renderSnapshotNumericStride = 7;
          const renderSnapshotAABBMinXOffset = 2;
          const renderSnapshotAABBMinYOffset = 3;
          const renderSnapshotAABBMaxXOffset = 4;
          const renderSnapshotAABBMaxYOffset = 5;
          const renderSnapshotLayerIndexOffset = 6;
          const renderSnapshotLayerBoundsStride = 4;
          const renderSnapshotLayerMinXOffset = 0;
          const renderSnapshotLayerMinYOffset = 1;
          const renderSnapshotLayerMaxXOffset = 2;
          const renderSnapshotLayerMaxYOffset = 3;
          const renderSnapshotFlagHasRendererObject = 1 << 0;
          const renderSnapshotFlagHidden = 1 << 1;
          const renderSnapshotFlagHasAABB = 1 << 2;
          const renderSnapshotFlagHas3DRendererObject = 1 << 3;

          const cullingPayload =
            payload && typeof payload === 'object'
              ? (payload as {
                  snapshotVersion?: unknown;
                  objectCount?: unknown;
                  layerCount?: unknown;
                  numericStride?: unknown;
                  numericDataBuffer?: unknown;
                  flagsBuffer?: unknown;
                  layerBoundsBuffer?: unknown;
                })
              : null;
          if (!cullingPayload) {
            throw new Error('Invalid render snapshot culling payload.');
          }

          const snapshotVersion =
            typeof cullingPayload.snapshotVersion === 'number'
              ? Math.floor(cullingPayload.snapshotVersion)
              : 0;
          const objectCount =
            typeof cullingPayload.objectCount === 'number'
              ? Math.max(0, Math.floor(cullingPayload.objectCount))
              : 0;
          const layerCount =
            typeof cullingPayload.layerCount === 'number'
              ? Math.max(0, Math.floor(cullingPayload.layerCount))
              : 0;
          const numericStride =
            typeof cullingPayload.numericStride === 'number'
              ? Math.floor(cullingPayload.numericStride)
              : renderSnapshotNumericStride;
          if (
            numericStride !== renderSnapshotNumericStride ||
            !(cullingPayload.numericDataBuffer instanceof ArrayBuffer) ||
            !(cullingPayload.flagsBuffer instanceof ArrayBuffer) ||
            !(cullingPayload.layerBoundsBuffer instanceof ArrayBuffer)
          ) {
            throw new Error('Malformed render snapshot culling buffers.');
          }

          const numericData = new Float32Array(cullingPayload.numericDataBuffer);
          const flags = new Uint8Array(cullingPayload.flagsBuffer);
          const layerBounds = new Float32Array(cullingPayload.layerBoundsBuffer);
          const requiredNumericLength = objectCount * numericStride;
          const requiredLayerBoundsLength =
            layerCount * renderSnapshotLayerBoundsStride;
          if (
            numericData.length < requiredNumericLength ||
            flags.length < objectCount ||
            layerBounds.length < requiredLayerBoundsLength
          ) {
            throw new Error('Render snapshot culling buffers are truncated.');
          }

          const visibilityMask = new Uint8Array(objectCount);
          for (let objectIndex = 0; objectIndex < objectCount; objectIndex++) {
            const flagsValue = flags[objectIndex];
            const hasRendererObject =
              (flagsValue & renderSnapshotFlagHasRendererObject) !== 0;
            const isHidden = (flagsValue & renderSnapshotFlagHidden) !== 0;
            const hasAABB = (flagsValue & renderSnapshotFlagHasAABB) !== 0;
            const has3DRendererObject =
              (flagsValue & renderSnapshotFlagHas3DRendererObject) !== 0;
            if (!hasRendererObject || isHidden) {
              visibilityMask[objectIndex] = 0;
              continue;
            }
            // 3D objects must be culled by the authoritative main-thread frustum logic.
            // Worker culling only applies to 2D AABB checks.
            if (!hasAABB || has3DRendererObject) {
              visibilityMask[objectIndex] = 1;
              continue;
            }

            const numericOffset = objectIndex * numericStride;
            const layerIndex = Math.floor(
              numericData[numericOffset + renderSnapshotLayerIndexOffset]
            );
            if (layerIndex < 0 || layerIndex >= layerCount) {
              visibilityMask[objectIndex] = 1;
              continue;
            }

            const layerOffset = layerIndex * renderSnapshotLayerBoundsStride;
            const minX = numericData[numericOffset + renderSnapshotAABBMinXOffset];
            const minY = numericData[numericOffset + renderSnapshotAABBMinYOffset];
            const maxX = numericData[numericOffset + renderSnapshotAABBMaxXOffset];
            const maxY = numericData[numericOffset + renderSnapshotAABBMaxYOffset];
            const layerMinX = layerBounds[layerOffset + renderSnapshotLayerMinXOffset];
            const layerMinY = layerBounds[layerOffset + renderSnapshotLayerMinYOffset];
            const layerMaxX = layerBounds[layerOffset + renderSnapshotLayerMaxXOffset];
            const layerMaxY = layerBounds[layerOffset + renderSnapshotLayerMaxYOffset];

            visibilityMask[objectIndex] =
              minX > layerMaxX ||
              minY > layerMaxY ||
              maxX < layerMinX ||
              maxY < layerMinY
                ? 0
                : 1;
          }

          return {
            __gdjsTransferableWorkerTaskResult: true,
            value: {
              snapshotVersion,
              objectCount,
              visibilityBuffer: visibilityMask.buffer,
            },
            transferables: [visibilityMask.buffer],
          };
        }
      );
    }

    hasRegisteredRenderSnapshotWorkerHandler = true;
  };

  /**
   * A scene being played, containing instances of objects rendered on screen.
   * @category Core Engine > Scene
   */
  export class RuntimeScene extends gdjs.RuntimeInstanceContainer {
    _eventsFunction: null | ((runtimeScene: RuntimeScene) => void) = null;
    _idToCallbackMap: null | Map<
      string,
      (
        runtimeScene: gdjs.RuntimeScene,
        asyncObjectsList: gdjs.LongLivedObjectsList
      ) => void
    > = null;
    _renderer: RuntimeSceneRenderer;
    _debuggerRenderer: gdjs.DebuggerRenderer;
    _variables: gdjs.VariablesContainer;
    _variablesByExtensionName: Map<string, gdjs.VariablesContainer>;
    _runtimeGame: gdjs.RuntimeGame;
    _lastId: integer = 0;
    _name: string = '';
    _timeManager: TimeManager;
    _gameStopRequested: boolean = false;
    _requestedScene: string = '';
    _resourcesUnloading: 'at-scene-exit' | 'never' | 'inherit' = 'inherit';
    private _asyncTasksManager = new gdjs.AsyncTasksManager();

    /** True if loadFromScene was called and the scene is being played. */
    _isLoaded: boolean = false;
    /** True in the first frame after resuming the paused scene */
    _isJustResumed: boolean = false;

    _requestedChange: SceneChangeRequest;
    /** Black background by default. */
    _backgroundColor: integer = 0;

    /** Should the canvas be cleared before this scene rendering. */
    _clearCanvas: boolean = true;

    _onceTriggers: OnceTriggers;
    _profiler: gdjs.Profiler | null = null;

    // Set to `new gdjs.Profiler()` to have profiling done on the scene.
    _onProfilerStopped: null | ((oldProfiler: gdjs.Profiler) => void) = null;

    _cachedGameResolutionWidth: integer;
    _cachedGameResolutionHeight: integer;
    private _renderSnapshotRead: RuntimeRenderSnapshot;
    private _renderSnapshotWrite: RuntimeRenderSnapshot;
    private _renderSnapshotVersion: integer = 0;
    private _renderSnapshotVisibilityByVersion = new Map<integer, Uint8Array>();
    private _renderSnapshotCullingQueue: gdjs.WorkerTaskQueue | null = null;
    private _renderSnapshotCullingInFlightVersion: integer = 0;
    private _renderSnapshotFrustum:
      | THREE.Frustum
      | null = typeof THREE !== 'undefined' ? new THREE.Frustum() : null;
    private _renderSnapshotProjectionMatrix:
      | THREE.Matrix4
      | null = typeof THREE !== 'undefined' ? new THREE.Matrix4() : null;
    private _renderSnapshotTempVector3A:
      | THREE.Vector3
      | null = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
    private _renderSnapshotTempVector3B:
      | THREE.Vector3
      | null = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
    private _renderSnapshotTempSphere:
      | THREE.Sphere
      | null = typeof THREE !== 'undefined' ? new THREE.Sphere() : null;
    private _renderSnapshotOcclusionCullingMode: RenderSnapshotOcclusionCullingMode =
      'conservative';

    /**
     * A network ID associated to the scene to be used
     * for multiplayer, to identify the scene across peers.
     * A scene can have its networkId re-generated during the game, meaning
     * that the scene is re-created on every peer.
     */
    networkId: string | null = null;

    /**
     * @param runtimeGame The game associated to this scene.
     */
    constructor(runtimeGame: gdjs.RuntimeGame) {
      super(runtimeGame);
      this._runtimeGame = runtimeGame;
      this._variables = new gdjs.VariablesContainer();
      this._variablesByExtensionName = new Map<
        string,
        gdjs.VariablesContainer
      >();
      this._timeManager = new gdjs.TimeManager();
      this._onceTriggers = new gdjs.OnceTriggers();
      this._requestedChange = SceneChangeRequest.CONTINUE;
      this._cachedGameResolutionWidth = runtimeGame
        ? runtimeGame.getGameResolutionWidth()
        : 0;
      this._cachedGameResolutionHeight = runtimeGame
        ? runtimeGame.getGameResolutionHeight()
        : 0;
      this._renderSnapshotRead = this._createEmptyRenderSnapshot();
      this._renderSnapshotWrite = this._createEmptyRenderSnapshot();
      this._refreshRenderSnapshotOptimizationSettings();
      if (renderSnapshotIsolationEnabled && renderSnapshotEnableWorkerCulling) {
        ensureRenderSnapshotWorkerHandlerRegistered();
        this._initializeRenderSnapshotCullingQueue();
      }

      this._renderer = new gdjs.RuntimeSceneRenderer(
        this,
        // @ts-ignore This is needed because of test. They should mock RuntimeGame instead.
        runtimeGame ? runtimeGame.getRenderer() : null
      );
      this._debuggerRenderer = new gdjs.DebuggerRenderer(this);

      // What to do after the frame is rendered.

      // The callback function to call when the profiler is stopped.
      this.onGameResolutionResized();
    }

    private _refreshRenderSnapshotOptimizationSettings(): void {
      const extensionPropertyValue =
        this._runtimeGame &&
        typeof this._runtimeGame.getExtensionProperty === 'function'
          ? this._runtimeGame.getExtensionProperty(
              renderSnapshotOcclusionExtensionName,
              renderSnapshotOcclusionPropertyName
            )
          : null;

      this._renderSnapshotOcclusionCullingMode =
        sanitizeRenderSnapshotOcclusionCullingMode(extensionPropertyValue);
    }

    private _isRenderSnapshotCullingDisabled(): boolean {
      return this._renderSnapshotOcclusionCullingMode === 'disabled';
    }

    private _invalidateRenderSnapshotState(): void {
      this._renderSnapshotCullingInFlightVersion = 0;
      this._renderSnapshotVisibilityByVersion.clear();
      this._renderSnapshotVersion = 0;
      this._renderSnapshotRead.version = 0;
      this._renderSnapshotRead.objectCount = 0;
      this._renderSnapshotWrite.version = 0;
      this._renderSnapshotWrite.objectCount = 0;
    }

    private _refreshRenderSnapshotOptimizationSettingsAndInvalidateIfNeeded(): void {
      const previousMode = this._renderSnapshotOcclusionCullingMode;
      this._refreshRenderSnapshotOptimizationSettings();
      if (previousMode !== this._renderSnapshotOcclusionCullingMode) {
        this._invalidateRenderSnapshotState();
      }
    }

    private _createEmptyRenderSnapshot(initialCapacity = 0): RuntimeRenderSnapshot {
      const objectCapacity = Math.max(0, initialCapacity);
      return {
        version: 0,
        objectCount: 0,
        layerCount: 0,
        numericData: new Float32Array(objectCapacity * renderSnapshotNumericStride),
        flags: new Uint8Array(objectCapacity),
        objects: new Array<gdjs.RuntimeObject | null>(objectCapacity),
        layerNames: [],
        layerBounds: new Float32Array(0),
        sphereData: new Float32Array(objectCapacity * renderSnapshotSphereStride),
        depthData: new Float32Array(objectCapacity),
        visibilityMask: new Uint8Array(objectCapacity),
        layerVisibilityMask: new Uint8Array(0),
      };
    }

    private _initializeRenderSnapshotCullingQueue(): void {
      if (
        !renderSnapshotIsolationEnabled ||
        !renderSnapshotEnableWorkerCulling ||
        !this._runtimeGame ||
        this._renderSnapshotCullingQueue ||
        typeof gdjs.hasWorkerTaskHandler !== 'function' ||
        !gdjs.hasWorkerTaskHandler(renderSnapshotWorkerHandlerName)
      ) {
        return;
      }

      this._renderSnapshotCullingQueue = this.createWorkerTaskQueue({
        name: 'scene-render-culling',
        maxConcurrentTasks: 1,
        autoStart: true,
        workerRole: 'generic',
        priority: 'high',
        allowMainThreadFallback: true,
      });
    }

    private _ensureRenderSnapshotObjectCapacity(
      snapshot: RuntimeRenderSnapshot,
      requiredObjectCount: integer
    ): void {
      if (requiredObjectCount <= snapshot.flags.length) {
        return;
      }

      const previousCapacity = snapshot.flags.length;
      const nextCapacity = Math.max(
        requiredObjectCount,
        Math.max(32, previousCapacity * 2)
      );
      const nextNumericData = new Float32Array(
        nextCapacity * renderSnapshotNumericStride
      );
      nextNumericData.set(
        snapshot.numericData.subarray(
          0,
          previousCapacity * renderSnapshotNumericStride
        )
      );
      snapshot.numericData = nextNumericData;

      const nextFlags = new Uint8Array(nextCapacity);
      nextFlags.set(snapshot.flags.subarray(0, previousCapacity));
      snapshot.flags = nextFlags;

      const nextSphereData = new Float32Array(
        nextCapacity * renderSnapshotSphereStride
      );
      nextSphereData.set(
        snapshot.sphereData.subarray(0, previousCapacity * renderSnapshotSphereStride)
      );
      snapshot.sphereData = nextSphereData;

      const nextDepthData = new Float32Array(nextCapacity);
      nextDepthData.set(snapshot.depthData.subarray(0, previousCapacity));
      snapshot.depthData = nextDepthData;

      const nextVisibilityMask = new Uint8Array(nextCapacity);
      nextVisibilityMask.set(snapshot.visibilityMask.subarray(0, previousCapacity));
      snapshot.visibilityMask = nextVisibilityMask;

      const nextObjects = new Array<gdjs.RuntimeObject | null>(nextCapacity);
      for (let i = 0; i < previousCapacity; i++) {
        nextObjects[i] = snapshot.objects[i] || null;
      }
      snapshot.objects = nextObjects;
    }

    private _ensureRenderSnapshotLayerCapacity(
      snapshot: RuntimeRenderSnapshot,
      requiredLayerCount: integer
    ): void {
      if (requiredLayerCount * renderSnapshotLayerBoundsStride > snapshot.layerBounds.length) {
        snapshot.layerBounds = new Float32Array(
          requiredLayerCount * renderSnapshotLayerBoundsStride
        );
      }
      if (requiredLayerCount > snapshot.layerVisibilityMask.length) {
        snapshot.layerVisibilityMask = new Uint8Array(requiredLayerCount);
      }
    }

    private _swapRenderSnapshots(): void {
      const previousReadSnapshot = this._renderSnapshotRead;
      this._renderSnapshotRead = this._renderSnapshotWrite;
      this._renderSnapshotWrite = previousReadSnapshot;
      this._renderSnapshotVersion++;
      this._renderSnapshotRead.version = this._renderSnapshotVersion;
    }

    private _collectRenderSnapshotLayerMetadata(
      snapshot: RuntimeRenderSnapshot
    ): {
      layerMetadataByIndex: RenderSnapshotLayerMetadata[];
      layerNameToIndex: Map<string, integer>;
    } {
      const layerCount = this._orderedLayers.length;
      snapshot.layerCount = layerCount;
      this._ensureRenderSnapshotLayerCapacity(snapshot, layerCount);
      snapshot.layerNames.length = layerCount;

      const layerMetadataByIndex: RenderSnapshotLayerMetadata[] = [];
      const layerNameToIndex = new Map<string, integer>();

      for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
        const layer = this._orderedLayers[layerIndex];
        const layerName = layer.getName();
        layerNameToIndex.set(layerName, layerIndex);
        snapshot.layerNames[layerIndex] = layerName;

        const halfWidth = layer.getCameraWidth() / 2;
        const halfHeight = layer.getCameraHeight() / 2;
        const boundsMinX = layer.getCameraX() - halfWidth;
        const boundsMinY = layer.getCameraY() - halfHeight;
        const boundsMaxX = layer.getCameraX() + halfWidth;
        const boundsMaxY = layer.getCameraY() + halfHeight;
        const layerBoundsOffset = layerIndex * renderSnapshotLayerBoundsStride;
        snapshot.layerBounds[layerBoundsOffset + renderSnapshotLayerMinXOffset] =
          boundsMinX;
        snapshot.layerBounds[layerBoundsOffset + renderSnapshotLayerMinYOffset] =
          boundsMinY;
        snapshot.layerBounds[layerBoundsOffset + renderSnapshotLayerMaxXOffset] =
          boundsMaxX;
        snapshot.layerBounds[layerBoundsOffset + renderSnapshotLayerMaxYOffset] =
          boundsMaxY;

        const layerVisible = layer.isVisible();
        snapshot.layerVisibilityMask[layerIndex] = layerVisible ? 1 : 0;

        const layerRenderer = layer.getRenderer();
        let camera:
          | THREE.PerspectiveCamera
          | THREE.OrthographicCamera
          | null = null;
        let cameraRotatedIn3D = false;
        if (layerRenderer && typeof layerRenderer.getThreeCamera === 'function') {
          const threeCamera = layerRenderer.getThreeCamera();
          if (threeCamera) {
            threeCamera.updateMatrixWorld();
            threeCamera.updateProjectionMatrix();
            camera = threeCamera;
          }
          if (typeof layerRenderer.isCameraRotatedIn3D === 'function') {
            cameraRotatedIn3D = !!layerRenderer.isCameraRotatedIn3D();
          }
          if (typeof layerRenderer.getThreeGroup === 'function') {
            const threeGroup = layerRenderer.getThreeGroup();
            if (threeGroup) {
              threeGroup.updateWorldMatrix(true, true);
            }
          }
        }

        layerMetadataByIndex[layerIndex] = {
          layer,
          layerIndex,
          boundsMinX,
          boundsMinY,
          boundsMaxX,
          boundsMaxY,
          layerVisible,
          camera,
          cameraRotatedIn3D,
        };
      }

      return { layerMetadataByIndex, layerNameToIndex };
    }

    private _isFiniteRenderSnapshotAABB(
      minX: number,
      minY: number,
      maxX: number,
      maxY: number
    ): boolean {
      return (
        Number.isFinite(minX) &&
        Number.isFinite(minY) &&
        Number.isFinite(maxX) &&
        Number.isFinite(maxY) &&
        minX <= maxX &&
        minY <= maxY
      );
    }

    private _computeRenderSnapshot3DSphere(
      object: gdjs.RuntimeObject,
      rendererObject3D: THREE.Object3D,
      snapshot: RuntimeRenderSnapshot,
      objectIndex: integer
    ): boolean {
      const center = this._renderSnapshotTempVector3A;
      if (!center) {
        return false;
      }

      rendererObject3D.getWorldPosition(center);

      const objectAsAny = object as any;
      let width = Math.abs(Number(object.getWidth()));
      let height = Math.abs(Number(object.getHeight()));
      let depth =
        typeof objectAsAny.getDepth === 'function'
          ? Math.abs(Number(objectAsAny.getDepth()))
          : Math.max(width, height, 1);

      if (!Number.isFinite(width) || width <= 0) width = 1;
      if (!Number.isFinite(height) || height <= 0) height = 1;
      if (!Number.isFinite(depth) || depth <= 0) depth = Math.max(width, height, 1);

      const radius = Math.max(
        0.5,
        Math.sqrt(width * width + height * height + depth * depth) / 2
      );

      const sphereOffset = objectIndex * renderSnapshotSphereStride;
      snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterXOffset] =
        center.x;
      snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterYOffset] =
        center.y;
      snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterZOffset] =
        center.z;
      snapshot.sphereData[sphereOffset + renderSnapshotSphereRadiusOffset] =
        radius;
      return true;
    }

    private _isRenderSnapshotObjectInsideLayerBounds(
      snapshot: RuntimeRenderSnapshot,
      objectIndex: integer,
      layerMetadata: RenderSnapshotLayerMetadata
    ): boolean {
      const numericOffset = objectIndex * renderSnapshotNumericStride;
      const minX =
        snapshot.numericData[numericOffset + renderSnapshotAABBMinXOffset];
      const minY =
        snapshot.numericData[numericOffset + renderSnapshotAABBMinYOffset];
      const maxX =
        snapshot.numericData[numericOffset + renderSnapshotAABBMaxXOffset];
      const maxY =
        snapshot.numericData[numericOffset + renderSnapshotAABBMaxYOffset];

      return !(
        minX > layerMetadata.boundsMaxX ||
        minY > layerMetadata.boundsMaxY ||
        maxX < layerMetadata.boundsMinX ||
        maxY < layerMetadata.boundsMinY
      );
    }

    private _buildRenderSnapshotBVH(
      snapshot: RuntimeRenderSnapshot,
      objectIndexes: integer[],
      rangeStart: integer,
      rangeEnd: integer,
      nodes: RenderSnapshotBvhNode[]
    ): integer {
      let boundsMinX = Number.POSITIVE_INFINITY;
      let boundsMinY = Number.POSITIVE_INFINITY;
      let boundsMaxX = Number.NEGATIVE_INFINITY;
      let boundsMaxY = Number.NEGATIVE_INFINITY;
      let centerMinX = Number.POSITIVE_INFINITY;
      let centerMinY = Number.POSITIVE_INFINITY;
      let centerMaxX = Number.NEGATIVE_INFINITY;
      let centerMaxY = Number.NEGATIVE_INFINITY;

      for (
        let objectRangeIndex = rangeStart;
        objectRangeIndex < rangeEnd;
        objectRangeIndex++
      ) {
        const objectIndex = objectIndexes[objectRangeIndex];
        const numericOffset = objectIndex * renderSnapshotNumericStride;
        const minX =
          snapshot.numericData[numericOffset + renderSnapshotAABBMinXOffset];
        const minY =
          snapshot.numericData[numericOffset + renderSnapshotAABBMinYOffset];
        const maxX =
          snapshot.numericData[numericOffset + renderSnapshotAABBMaxXOffset];
        const maxY =
          snapshot.numericData[numericOffset + renderSnapshotAABBMaxYOffset];
        boundsMinX = Math.min(boundsMinX, minX);
        boundsMinY = Math.min(boundsMinY, minY);
        boundsMaxX = Math.max(boundsMaxX, maxX);
        boundsMaxY = Math.max(boundsMaxY, maxY);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        centerMinX = Math.min(centerMinX, centerX);
        centerMinY = Math.min(centerMinY, centerY);
        centerMaxX = Math.max(centerMaxX, centerX);
        centerMaxY = Math.max(centerMaxY, centerY);
      }

      const nodeIndex = nodes.length;
      nodes.push({
        minX: boundsMinX,
        minY: boundsMinY,
        maxX: boundsMaxX,
        maxY: boundsMaxY,
        leftNodeIndex: -1,
        rightNodeIndex: -1,
        rangeStart,
        rangeEnd,
      });

      const rangeLength = rangeEnd - rangeStart;
      if (rangeLength <= renderSnapshotBvhLeafSize) {
        return nodeIndex;
      }

      const centerExtentX = centerMaxX - centerMinX;
      const centerExtentY = centerMaxY - centerMinY;
      const useXAxis = centerExtentX >= centerExtentY;
      if (
        (!Number.isFinite(centerExtentX) || centerExtentX <= 0) &&
        (!Number.isFinite(centerExtentY) || centerExtentY <= 0)
      ) {
        return nodeIndex;
      }

      const sortedSubRange = objectIndexes.slice(rangeStart, rangeEnd);
      sortedSubRange.sort((firstObjectIndex, secondObjectIndex) => {
        const firstOffset = firstObjectIndex * renderSnapshotNumericStride;
        const secondOffset = secondObjectIndex * renderSnapshotNumericStride;
        const firstCenter = useXAxis
          ? (snapshot.numericData[firstOffset + renderSnapshotAABBMinXOffset] +
              snapshot.numericData[firstOffset + renderSnapshotAABBMaxXOffset]) /
            2
          : (snapshot.numericData[firstOffset + renderSnapshotAABBMinYOffset] +
              snapshot.numericData[firstOffset + renderSnapshotAABBMaxYOffset]) /
            2;
        const secondCenter = useXAxis
          ? (snapshot.numericData[secondOffset + renderSnapshotAABBMinXOffset] +
              snapshot.numericData[secondOffset + renderSnapshotAABBMaxXOffset]) /
            2
          : (snapshot.numericData[secondOffset + renderSnapshotAABBMinYOffset] +
              snapshot.numericData[secondOffset + renderSnapshotAABBMaxYOffset]) /
            2;
        return firstCenter - secondCenter;
      });
      for (let i = 0; i < sortedSubRange.length; i++) {
        objectIndexes[rangeStart + i] = sortedSubRange[i];
      }

      const middleRangeIndex = rangeStart + Math.floor(rangeLength / 2);
      if (middleRangeIndex <= rangeStart || middleRangeIndex >= rangeEnd) {
        return nodeIndex;
      }

      const leftNodeIndex = this._buildRenderSnapshotBVH(
        snapshot,
        objectIndexes,
        rangeStart,
        middleRangeIndex,
        nodes
      );
      const rightNodeIndex = this._buildRenderSnapshotBVH(
        snapshot,
        objectIndexes,
        middleRangeIndex,
        rangeEnd,
        nodes
      );
      nodes[nodeIndex].leftNodeIndex = leftNodeIndex;
      nodes[nodeIndex].rightNodeIndex = rightNodeIndex;
      nodes[nodeIndex].rangeStart = -1;
      nodes[nodeIndex].rangeEnd = -1;

      return nodeIndex;
    }

    private _queryRenderSnapshotBVH(
      nodes: RenderSnapshotBvhNode[],
      nodeIndex: integer,
      objectIndexes: integer[],
      queryMinX: number,
      queryMinY: number,
      queryMaxX: number,
      queryMaxY: number,
      candidateMask: Uint8Array
    ): void {
      if (nodeIndex < 0 || nodeIndex >= nodes.length) {
        return;
      }

      const node = nodes[nodeIndex];
      const intersectsNode =
        node.minX <= queryMaxX &&
        node.minY <= queryMaxY &&
        node.maxX >= queryMinX &&
        node.maxY >= queryMinY;
      if (!intersectsNode) {
        return;
      }

      if (node.leftNodeIndex === -1 && node.rightNodeIndex === -1) {
        for (
          let objectRangeIndex = node.rangeStart;
          objectRangeIndex < node.rangeEnd;
          objectRangeIndex++
        ) {
          const objectIndex = objectIndexes[objectRangeIndex];
          candidateMask[objectIndex] = 1;
        }
        return;
      }

      if (node.leftNodeIndex !== -1) {
        this._queryRenderSnapshotBVH(
          nodes,
          node.leftNodeIndex,
          objectIndexes,
          queryMinX,
          queryMinY,
          queryMaxX,
          queryMaxY,
          candidateMask
        );
      }
      if (node.rightNodeIndex !== -1) {
        this._queryRenderSnapshotBVH(
          nodes,
          node.rightNodeIndex,
          objectIndexes,
          queryMinX,
          queryMinY,
          queryMaxX,
          queryMaxY,
          candidateMask
        );
      }
    }

    private _computeRenderSnapshotObjectDepthFromCamera(
      snapshot: RuntimeRenderSnapshot,
      objectIndex: integer,
      camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    ): number {
      const position = this._renderSnapshotTempVector3A;
      if (!position) {
        return Number.POSITIVE_INFINITY;
      }
      const sphereOffset = objectIndex * renderSnapshotSphereStride;
      position.set(
        snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterXOffset],
        snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterYOffset],
        snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterZOffset]
      );
      position.applyMatrix4(camera.matrixWorldInverse);
      return -position.z;
    }

    private _isPerspectiveThreeCamera(
      camera: unknown
    ): camera is THREE.PerspectiveCamera {
      return (
        typeof THREE !== 'undefined' &&
        !!camera &&
        camera instanceof THREE.PerspectiveCamera
      );
    }

    private _shouldApplyRenderSnapshotOcclusionCulling(
      layerMetadata: RenderSnapshotLayerMetadata,
      layer3DObjectCount: integer
    ): boolean {
      if (this._renderSnapshotOcclusionCullingMode === 'disabled') {
        return false;
      }
      if (!this._isPerspectiveThreeCamera(layerMetadata.camera)) {
        return false;
      }
      if (layerMetadata.cameraRotatedIn3D) {
        return false;
      }
      const minObjectCount =
        this._renderSnapshotOcclusionCullingMode === 'aggressive'
          ? renderSnapshotOcclusionMinObjectCount
          : renderSnapshotOcclusionConservativeMinObjectCount;
      return layer3DObjectCount >= minObjectCount;
    }

    private _applyRenderSnapshotOcclusionCullingForLayer(
      snapshot: RuntimeRenderSnapshot,
      layerMetadata: RenderSnapshotLayerMetadata,
      layer3DObjectIndexes: integer[]
    ): void {
      const camera = layerMetadata.camera;
      if (!this._isPerspectiveThreeCamera(camera)) {
        return;
      }
      const projectedCenter = this._renderSnapshotTempVector3A;
      if (!projectedCenter) {
        return;
      }
      const isAggressiveCullingMode =
        this._renderSnapshotOcclusionCullingMode === 'aggressive';
      const coverageThresholdForDepthMapUpdate = isAggressiveCullingMode
        ? renderSnapshotOcclusionMinCoverageRatio
        : renderSnapshotOcclusionConservativeMinCoverageRatio;
      const occludedCellsRatioThreshold = isAggressiveCullingMode
        ? 1
        : renderSnapshotOcclusionConservativeRequiredOccludedCellsRatio;
      const minimumCoveredCellsForOcclusion = isAggressiveCullingMode
        ? 1
        : renderSnapshotOcclusionConservativeMinCoveredCells;

      type OcclusionCandidate = {
        objectIndex: integer;
        depth: number;
        minCellX: integer;
        minCellY: integer;
        maxCellX: integer;
        maxCellY: integer;
      };

      const gridCellCount =
        renderSnapshotOcclusionGridColumns * renderSnapshotOcclusionGridRows;
      const nearestDepthByCell = new Float32Array(gridCellCount);
      nearestDepthByCell.fill(Number.POSITIVE_INFINITY);
      const candidates: OcclusionCandidate[] = [];

      const safeCameraAspect = Math.max(0.0001, camera.aspect || 1);
      const perspectiveHalfTan = Math.max(
        0.0001,
        Math.tan(gdjs.toRad(camera.fov) / 2)
      );

      for (
        let layerObjectIndex = 0;
        layerObjectIndex < layer3DObjectIndexes.length;
        layerObjectIndex++
      ) {
        const objectIndex = layer3DObjectIndexes[layerObjectIndex];
        if (snapshot.visibilityMask[objectIndex] !== 1) {
          continue;
        }

        const sphereOffset = objectIndex * renderSnapshotSphereStride;
        const radius =
          snapshot.sphereData[sphereOffset + renderSnapshotSphereRadiusOffset];
        if (!Number.isFinite(radius) || radius <= 0) {
          continue;
        }

        const depth = snapshot.depthData[objectIndex];
        if (!Number.isFinite(depth) || depth <= renderSnapshotOcclusionDepthEpsilon) {
          continue;
        }

        projectedCenter.set(
          snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterXOffset],
          snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterYOffset],
          snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterZOffset]
        );
        projectedCenter.project(camera);

        let radiusNdcX = 0;
        let radiusNdcY = 0;
        radiusNdcY = radius / (depth * perspectiveHalfTan);
        radiusNdcX = radiusNdcY / safeCameraAspect;

        if (
          !Number.isFinite(radiusNdcX) ||
          !Number.isFinite(radiusNdcY) ||
          radiusNdcX <= 0 ||
          radiusNdcY <= 0
        ) {
          continue;
        }

        const minNdcX = projectedCenter.x - radiusNdcX;
        const maxNdcX = projectedCenter.x + radiusNdcX;
        const minNdcY = projectedCenter.y - radiusNdcY;
        const maxNdcY = projectedCenter.y + radiusNdcY;
        if (maxNdcX < -1 || minNdcX > 1 || maxNdcY < -1 || minNdcY > 1) {
          continue;
        }

        const clampedMinNdcX = Math.max(-1, minNdcX);
        const clampedMaxNdcX = Math.min(1, maxNdcX);
        const clampedMinNdcY = Math.max(-1, minNdcY);
        const clampedMaxNdcY = Math.min(1, maxNdcY);

        const minCellX = Math.max(
          0,
          Math.min(
            renderSnapshotOcclusionGridColumns - 1,
            Math.floor(
              ((clampedMinNdcX + 1) * 0.5) * renderSnapshotOcclusionGridColumns
            )
          )
        );
        const maxCellX = Math.max(
          0,
          Math.min(
            renderSnapshotOcclusionGridColumns - 1,
            Math.floor(
              ((clampedMaxNdcX + 1) * 0.5) * renderSnapshotOcclusionGridColumns
            )
          )
        );
        const minCellY = Math.max(
          0,
          Math.min(
            renderSnapshotOcclusionGridRows - 1,
            Math.floor(
              (1 - (clampedMaxNdcY + 1) * 0.5) * renderSnapshotOcclusionGridRows
            )
          )
        );
        const maxCellY = Math.max(
          0,
          Math.min(
            renderSnapshotOcclusionGridRows - 1,
            Math.floor(
              (1 - (clampedMinNdcY + 1) * 0.5) * renderSnapshotOcclusionGridRows
            )
          )
        );
        if (maxCellX < minCellX || maxCellY < minCellY) {
          continue;
        }

        candidates.push({
          objectIndex,
          depth,
          minCellX,
          minCellY,
          maxCellX,
          maxCellY,
        });
      }

      candidates.sort((firstCandidate, secondCandidate) => {
        if (firstCandidate.depth === secondCandidate.depth) {
          return firstCandidate.objectIndex - secondCandidate.objectIndex;
        }
        return firstCandidate.depth - secondCandidate.depth;
      });

      for (
        let candidateIndex = 0;
        candidateIndex < candidates.length;
        candidateIndex++
      ) {
        const candidate = candidates[candidateIndex];
        const candidateWidth = candidate.maxCellX - candidate.minCellX + 1;
        const candidateHeight = candidate.maxCellY - candidate.minCellY + 1;
        const coveredCellCount = candidateWidth * candidateHeight;
        const coverageRatio = coveredCellCount / gridCellCount;
        const depthMargin = isAggressiveCullingMode
          ? renderSnapshotOcclusionDepthEpsilon
          : Math.max(
              renderSnapshotOcclusionDepthEpsilon * 2,
              candidate.depth * renderSnapshotOcclusionConservativeDepthMarginRatio
            );
        let occludedCellCount = 0;
        for (let cellY = candidate.minCellY; cellY <= candidate.maxCellY; cellY++) {
          for (let cellX = candidate.minCellX; cellX <= candidate.maxCellX; cellX++) {
            const cellIndex =
              cellY * renderSnapshotOcclusionGridColumns + cellX;
            const nearestDepth = nearestDepthByCell[cellIndex];
            if (
              Number.isFinite(nearestDepth) &&
              nearestDepth + depthMargin < candidate.depth
            ) {
              occludedCellCount++;
            }
          }
        }
        const occludedCellsRatio = occludedCellCount / coveredCellCount;
        const occlusionStrongEnough =
          coveredCellCount >= minimumCoveredCellsForOcclusion &&
          occludedCellsRatio >= occludedCellsRatioThreshold;

        if (occlusionStrongEnough) {
          snapshot.visibilityMask[candidate.objectIndex] = 0;
          continue;
        }

        if (coverageRatio < coverageThresholdForDepthMapUpdate) {
          continue;
        }

        for (let cellY = candidate.minCellY; cellY <= candidate.maxCellY; cellY++) {
          for (let cellX = candidate.minCellX; cellX <= candidate.maxCellX; cellX++) {
            const cellIndex = cellY * renderSnapshotOcclusionGridColumns + cellX;
            nearestDepthByCell[cellIndex] = Math.min(
              nearestDepthByCell[cellIndex],
              candidate.depth
            );
          }
        }
      }
    }

    private _computeRenderSnapshotVisibility(
      snapshot: RuntimeRenderSnapshot,
      layerMetadataByIndex: RenderSnapshotLayerMetadata[]
    ): void {
      const visibilityMask = snapshot.visibilityMask;
      const objectCount = snapshot.objectCount;
      const layerCount = snapshot.layerCount;
      visibilityMask.fill(0, 0, objectCount);

      const layerObjectIndexesForBvh: integer[][] = [];
      const layer3DObjectIndexes: integer[][] = [];
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
        layerObjectIndexesForBvh[layerIndex] = [];
        layer3DObjectIndexes[layerIndex] = [];
      }

      for (let objectIndex = 0; objectIndex < objectCount; objectIndex++) {
        snapshot.depthData[objectIndex] = 0;
        const flagsValue = snapshot.flags[objectIndex];
        const hasRendererObject =
          (flagsValue & renderSnapshotFlagHasRendererObject) !== 0;
        const isHidden = (flagsValue & renderSnapshotFlagHidden) !== 0;
        if (!hasRendererObject || isHidden) {
          visibilityMask[objectIndex] = 0;
          continue;
        }
        visibilityMask[objectIndex] = 1;

        const numericOffset = objectIndex * renderSnapshotNumericStride;
        const layerIndex = Math.floor(
          snapshot.numericData[numericOffset + renderSnapshotLayerIndexOffset]
        );
        if (layerIndex < 0 || layerIndex >= layerCount) {
          continue;
        }

        const hasAABB = (flagsValue & renderSnapshotFlagHasAABB) !== 0;
        const has3DRendererObject =
          (flagsValue & renderSnapshotFlagHas3DRendererObject) !== 0;
        if (hasAABB && !has3DRendererObject) {
          layerObjectIndexesForBvh[layerIndex].push(objectIndex);
        }
        if (has3DRendererObject) {
          layer3DObjectIndexes[layerIndex].push(objectIndex);
        }
      }

      const bvhCandidateMask = new Uint8Array(objectCount);
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
        const layerMetadata = layerMetadataByIndex[layerIndex];
        const aabbObjectIndexes = layerObjectIndexesForBvh[layerIndex];
        if (aabbObjectIndexes.length > 0) {
          if (aabbObjectIndexes.length >= renderSnapshotMinBvhObjectCount) {
            for (
              let objectRangeIndex = 0;
              objectRangeIndex < aabbObjectIndexes.length;
              objectRangeIndex++
            ) {
              bvhCandidateMask[aabbObjectIndexes[objectRangeIndex]] = 0;
            }

            const bvhObjectIndexes = aabbObjectIndexes.slice();
            const bvhNodes: RenderSnapshotBvhNode[] = [];
            const bvhRootNodeIndex = this._buildRenderSnapshotBVH(
              snapshot,
              bvhObjectIndexes,
              0,
              bvhObjectIndexes.length,
              bvhNodes
            );
            this._queryRenderSnapshotBVH(
              bvhNodes,
              bvhRootNodeIndex,
              bvhObjectIndexes,
              layerMetadata.boundsMinX,
              layerMetadata.boundsMinY,
              layerMetadata.boundsMaxX,
              layerMetadata.boundsMaxY,
              bvhCandidateMask
            );

            for (
              let objectRangeIndex = 0;
              objectRangeIndex < aabbObjectIndexes.length;
              objectRangeIndex++
            ) {
              const objectIndex = aabbObjectIndexes[objectRangeIndex];
              if (bvhCandidateMask[objectIndex] === 0) {
                visibilityMask[objectIndex] = 0;
              }
            }
          } else {
            for (
              let objectRangeIndex = 0;
              objectRangeIndex < aabbObjectIndexes.length;
              objectRangeIndex++
            ) {
              const objectIndex = aabbObjectIndexes[objectRangeIndex];
              if (
                !this._isRenderSnapshotObjectInsideLayerBounds(
                  snapshot,
                  objectIndex,
                  layerMetadata
                )
              ) {
                visibilityMask[objectIndex] = 0;
              }
            }
          }
        }

        const camera = layerMetadata.camera;
        const canComputeFrustum =
          !!camera && !!this._renderSnapshotFrustum && !!this._renderSnapshotProjectionMatrix;
        if (
          canComputeFrustum &&
          camera &&
          this._renderSnapshotFrustum &&
          this._renderSnapshotProjectionMatrix
        ) {
          this._renderSnapshotProjectionMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
          );
          this._renderSnapshotFrustum.setFromProjectionMatrix(
            this._renderSnapshotProjectionMatrix
          );
        }

        const threeDObjectIndexes = layer3DObjectIndexes[layerIndex];
        for (
          let objectRangeIndex = 0;
          objectRangeIndex < threeDObjectIndexes.length;
          objectRangeIndex++
        ) {
          const objectIndex = threeDObjectIndexes[objectRangeIndex];
          if (visibilityMask[objectIndex] !== 1) continue;

          if (camera) {
            snapshot.depthData[objectIndex] =
              this._computeRenderSnapshotObjectDepthFromCamera(
                snapshot,
                objectIndex,
                camera
              );
          }

          if (
            !canComputeFrustum ||
            !this._renderSnapshotFrustum ||
            !this._renderSnapshotTempVector3B ||
            !this._renderSnapshotTempSphere
          ) {
            continue;
          }

          const flagsValue = snapshot.flags[objectIndex];
          const hasSphere = (flagsValue & renderSnapshotFlagHasSphere) !== 0;
          if (!hasSphere) continue;

          const sphereOffset = objectIndex * renderSnapshotSphereStride;
          const sphereRadius =
            snapshot.sphereData[sphereOffset + renderSnapshotSphereRadiusOffset];
          if (!Number.isFinite(sphereRadius) || sphereRadius <= 0) {
            continue;
          }

          this._renderSnapshotTempVector3B.set(
            snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterXOffset],
            snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterYOffset],
            snapshot.sphereData[sphereOffset + renderSnapshotSphereCenterZOffset]
          );
          this._renderSnapshotTempSphere.center.copy(
            this._renderSnapshotTempVector3B
          );
          this._renderSnapshotTempSphere.radius = sphereRadius;
          const intersectsFrustum = this._renderSnapshotFrustum.intersectsSphere(
            this._renderSnapshotTempSphere
          );
          if (!intersectsFrustum) {
            visibilityMask[objectIndex] = 0;
          }
        }

        if (
          this._shouldApplyRenderSnapshotOcclusionCulling(
            layerMetadata,
            threeDObjectIndexes.length
          )
        ) {
          this._applyRenderSnapshotOcclusionCullingForLayer(
            snapshot,
            layerMetadata,
            threeDObjectIndexes
          );
        }
      }
    }

    private _buildRenderSnapshot(): void {
      const allInstancesList = this.getAdhocListOfAllInstances();
      const objectCount = allInstancesList.length;
      const writeSnapshot = this._renderSnapshotWrite;
      this._ensureRenderSnapshotObjectCapacity(writeSnapshot, objectCount);

      writeSnapshot.objectCount = objectCount;
      const { layerMetadataByIndex, layerNameToIndex } =
        this._collectRenderSnapshotLayerMetadata(writeSnapshot);

      for (let objectIndex = 0; objectIndex < objectCount; objectIndex++) {
        const object = allInstancesList[objectIndex];
        const numericOffset = objectIndex * renderSnapshotNumericStride;
        writeSnapshot.objects[objectIndex] = object;

        writeSnapshot.numericData[numericOffset + renderSnapshotXOffset] =
          object.getX();
        writeSnapshot.numericData[numericOffset + renderSnapshotYOffset] =
          object.getY();

        const layerName = object.getLayer();
        const layerIndex = layerNameToIndex.has(layerName)
          ? (layerNameToIndex.get(layerName) as integer)
          : -1;
        const layerMetadata =
          layerIndex >= 0 && layerIndex < layerMetadataByIndex.length
            ? layerMetadataByIndex[layerIndex]
            : null;
        const isLayerVisible = layerMetadata ? layerMetadata.layerVisible : true;

        const rendererObject = object.getRendererObject();
        const rendererObject3D = object.get3DRendererObject();
        const has2DRendererObject = !!rendererObject;
        const has3DRendererObject = !!rendererObject3D;
        let objectFlags = 0;
        if (has2DRendererObject || has3DRendererObject) {
          objectFlags |= renderSnapshotFlagHasRendererObject;
        }
        if (has3DRendererObject) {
          objectFlags |= renderSnapshotFlagHas3DRendererObject;
        }
        if (object.isHidden() || !isLayerVisible) {
          objectFlags |= renderSnapshotFlagHidden;
        }
        writeSnapshot.numericData[
          numericOffset + renderSnapshotLayerIndexOffset
        ] = layerIndex;

        let hasVisibilityAABB = false;
        let visibilityMinX = 0;
        let visibilityMinY = 0;
        let visibilityMaxX = 0;
        let visibilityMaxY = 0;
        const visibilityAABB = object.getVisibilityAABB();
        if (visibilityAABB) {
          const minX = Number(visibilityAABB.min[0]);
          const minY = Number(visibilityAABB.min[1]);
          const maxX = Number(visibilityAABB.max[0]);
          const maxY = Number(visibilityAABB.max[1]);
          if (this._isFiniteRenderSnapshotAABB(minX, minY, maxX, maxY)) {
            hasVisibilityAABB = true;
            visibilityMinX = minX;
            visibilityMinY = minY;
            visibilityMaxX = maxX;
            visibilityMaxY = maxY;
          }
        }
        if (!hasVisibilityAABB) {
          const objectAsAny = object as any;
          const drawableX =
            typeof objectAsAny.getDrawableX === 'function'
              ? Number(objectAsAny.getDrawableX())
              : Number(object.getX());
          const drawableY =
            typeof objectAsAny.getDrawableY === 'function'
              ? Number(objectAsAny.getDrawableY())
              : Number(object.getY());
          const width = Math.abs(Number(object.getWidth()));
          const height = Math.abs(Number(object.getHeight()));
          const minX = drawableX;
          const minY = drawableY;
          const maxX = drawableX + (Number.isFinite(width) && width > 0 ? width : 1);
          const maxY = drawableY + (Number.isFinite(height) && height > 0 ? height : 1);
          if (this._isFiniteRenderSnapshotAABB(minX, minY, maxX, maxY)) {
            hasVisibilityAABB = true;
            visibilityMinX = minX;
            visibilityMinY = minY;
            visibilityMaxX = maxX;
            visibilityMaxY = maxY;
          }
        }

        if (hasVisibilityAABB) {
          objectFlags |= renderSnapshotFlagHasAABB;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMinXOffset
          ] = visibilityMinX;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMinYOffset
          ] = visibilityMinY;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMaxXOffset
          ] = visibilityMaxX;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMaxYOffset
          ] = visibilityMaxY;
        } else {
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMinXOffset
          ] = 0;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMinYOffset
          ] = 0;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMaxXOffset
          ] = 0;
          writeSnapshot.numericData[
            numericOffset + renderSnapshotAABBMaxYOffset
          ] = 0;
        }

        const sphereOffset = objectIndex * renderSnapshotSphereStride;
        writeSnapshot.sphereData[sphereOffset + renderSnapshotSphereCenterXOffset] = 0;
        writeSnapshot.sphereData[sphereOffset + renderSnapshotSphereCenterYOffset] = 0;
        writeSnapshot.sphereData[sphereOffset + renderSnapshotSphereCenterZOffset] = 0;
        writeSnapshot.sphereData[sphereOffset + renderSnapshotSphereRadiusOffset] = 0;
        if (rendererObject3D) {
          const hasSphere = this._computeRenderSnapshot3DSphere(
            object,
            rendererObject3D,
            writeSnapshot,
            objectIndex
          );
          if (hasSphere) {
            objectFlags |= renderSnapshotFlagHasSphere;
          }
        }

        writeSnapshot.flags[objectIndex] = objectFlags;
      }

      for (
        let objectIndex = objectCount;
        objectIndex < writeSnapshot.objects.length;
        objectIndex++
      ) {
        writeSnapshot.objects[objectIndex] = null;
      }

      this._computeRenderSnapshotVisibility(writeSnapshot, layerMetadataByIndex);
      this._swapRenderSnapshots();
      this._scheduleRenderSnapshotCulling(this._renderSnapshotRead);
    }

    private _scheduleRenderSnapshotCulling(snapshot: RuntimeRenderSnapshot): void {
      if (!renderSnapshotEnableWorkerCulling) {
        return;
      }
      if (
        snapshot.objectCount < renderSnapshotMinWorkerObjectCount ||
        this._renderSnapshotCullingInFlightVersion !== 0
      ) {
        return;
      }
      this._initializeRenderSnapshotCullingQueue();
      if (!this._renderSnapshotCullingQueue) {
        return;
      }

      const numericLength = snapshot.objectCount * renderSnapshotNumericStride;
      const numericDataCopy = new Float32Array(numericLength);
      numericDataCopy.set(snapshot.numericData.subarray(0, numericLength));

      const flagsCopy = new Uint8Array(snapshot.objectCount);
      flagsCopy.set(snapshot.flags.subarray(0, snapshot.objectCount));

      const layerBoundsLength =
        snapshot.layerCount * renderSnapshotLayerBoundsStride;
      const layerBoundsCopy = new Float32Array(layerBoundsLength);
      layerBoundsCopy.set(snapshot.layerBounds.subarray(0, layerBoundsLength));

      this._renderSnapshotCullingInFlightVersion = snapshot.version;
      const queuedTask = this._renderSnapshotCullingQueue.enqueue<RenderSnapshotWorkerCullingResult>(
        renderSnapshotWorkerHandlerName,
        {
          snapshotVersion: snapshot.version,
          objectCount: snapshot.objectCount,
          layerCount: snapshot.layerCount,
          numericStride: renderSnapshotNumericStride,
          numericDataBuffer: numericDataCopy.buffer,
          flagsBuffer: flagsCopy.buffer,
          layerBoundsBuffer: layerBoundsCopy.buffer,
        } as RenderSnapshotWorkerCullingPayload,
        {
          transferables: [
            numericDataCopy.buffer,
            flagsCopy.buffer,
            layerBoundsCopy.buffer,
          ],
          workerRole: 'generic',
          priority: 'high',
        }
      );

      queuedTask.promise.then(
        (result) => {
          this._renderSnapshotCullingInFlightVersion = 0;
          if (!isRenderSnapshotWorkerCullingResult(result)) {
            return;
          }

          const visibilityMask = new Uint8Array(result.visibilityBuffer);
          if (visibilityMask.length !== result.objectCount) {
            return;
          }

          this._renderSnapshotVisibilityByVersion.set(
            result.snapshotVersion,
            visibilityMask
          );
          if (this._renderSnapshotVisibilityByVersion.size > 4) {
            const oldestSnapshotVersion = this._renderSnapshotVisibilityByVersion
              .keys()
              .next().value;
            if (typeof oldestSnapshotVersion === 'number') {
              this._renderSnapshotVisibilityByVersion.delete(
                oldestSnapshotVersion
              );
            }
          }
        },
        (error) => {
          this._renderSnapshotCullingInFlightVersion = 0;
          logger.warn('Render snapshot worker culling failed.', error);
        }
      );
    }

    private _isObjectVisibleFromRenderSnapshot(
      snapshot: RuntimeRenderSnapshot,
      objectIndex: integer
    ): boolean {
      if (objectIndex >= 0 && objectIndex < snapshot.objectCount) {
        return snapshot.visibilityMask[objectIndex] === 1;
      }

      const flagsValue = snapshot.flags[objectIndex];
      const hasRendererObject =
        (flagsValue & renderSnapshotFlagHasRendererObject) !== 0;
      if (!hasRendererObject) {
        return false;
      }
      if ((flagsValue & renderSnapshotFlagHidden) !== 0) {
        return false;
      }
      if ((flagsValue & renderSnapshotFlagHasAABB) === 0) {
        return true;
      }

      const numericOffset = objectIndex * renderSnapshotNumericStride;
      const layerIndex = Math.floor(
        snapshot.numericData[numericOffset + renderSnapshotLayerIndexOffset]
      );
      if (layerIndex < 0 || layerIndex >= snapshot.layerCount) {
        return true;
      }

      const layerOffset = layerIndex * renderSnapshotLayerBoundsStride;
      const minX =
        snapshot.numericData[numericOffset + renderSnapshotAABBMinXOffset];
      const minY =
        snapshot.numericData[numericOffset + renderSnapshotAABBMinYOffset];
      const maxX =
        snapshot.numericData[numericOffset + renderSnapshotAABBMaxXOffset];
      const maxY =
        snapshot.numericData[numericOffset + renderSnapshotAABBMaxYOffset];
      const layerMinX =
        snapshot.layerBounds[layerOffset + renderSnapshotLayerMinXOffset];
      const layerMinY =
        snapshot.layerBounds[layerOffset + renderSnapshotLayerMinYOffset];
      const layerMaxX =
        snapshot.layerBounds[layerOffset + renderSnapshotLayerMaxXOffset];
      const layerMaxY =
        snapshot.layerBounds[layerOffset + renderSnapshotLayerMaxYOffset];

      return !(
        minX > layerMaxX ||
        minY > layerMaxY ||
        maxX < layerMinX ||
        maxY < layerMinY
      );
    }

    addLayer(layerData: LayerData) {
      const layer = new gdjs.Layer(layerData, this);
      this._layers.put(layerData.name, layer);
      this._orderedLayers.push(layer);
    }

    /**
     * Should be called when the canvas where the scene is rendered has been resized.
     * See gdjs.RuntimeGame.startGameLoop in particular.
     */
    onGameResolutionResized() {
      const oldGameResolutionOriginX = this.getViewportOriginX();
      const oldGameResolutionOriginY = this.getViewportOriginY();
      this._cachedGameResolutionWidth = this._runtimeGame
        ? this._runtimeGame.getGameResolutionWidth()
        : 0;
      this._cachedGameResolutionHeight = this._runtimeGame
        ? this._runtimeGame.getGameResolutionHeight()
        : 0;
      for (const name in this._layers.items) {
        if (this._layers.items.hasOwnProperty(name)) {
          const theLayer: gdjs.RuntimeLayer = this._layers.items[name];
          theLayer.onGameResolutionResized(
            oldGameResolutionOriginX,
            oldGameResolutionOriginY
          );
        }
      }
      this._renderer.onGameResolutionResized();
    }

    /**
     * Load the runtime scene from the given scene.
     * @param sceneAndExtensionsData The data of the scene and extension variables to be loaded.
     * @param options Options to change what is loaded.
     * @see gdjs.RuntimeGame#getSceneAndExtensionsData
     */
    loadFromScene(
      sceneAndExtensionsData: SceneAndExtensionsData | null,
      options?: {
        excludedObjectNames?: Set<string>;
        skipStoppingSoundsOnStartup?: boolean;
        skipCreatingInstances?: boolean;
      }
    ) {
      if (!sceneAndExtensionsData) {
        logger.error('loadFromScene was called without a scene');
        return;
      }
      this._refreshRenderSnapshotOptimizationSettings();
      const { sceneData, usedExtensionsWithVariablesData } =
        sceneAndExtensionsData;

      if (this._isLoaded) {
        this.unloadScene();
      }

      //Setup main properties
      if (this._runtimeGame) {
        this._runtimeGame.getRenderer().setWindowTitle(sceneData.title);
      }
      this._name = sceneData.name;
      this._resourcesUnloading = sceneData.resourcesUnloading || 'inherit';
      this.setBackgroundColor(sceneData.r, sceneData.v, sceneData.b);

      //Load layers
      for (let i = 0, len = sceneData.layers.length; i < len; ++i) {
        this.addLayer(sceneData.layers[i]);
      }

      // Load variables
      this._variables = new gdjs.VariablesContainer(sceneData.variables);
      for (const extensionData of usedExtensionsWithVariablesData) {
        this._variablesByExtensionName.set(
          extensionData.name,
          new gdjs.VariablesContainer(extensionData.sceneVariables)
        );
      }

      //Cache the initial shared data of the behaviors
      for (
        let i = 0, len = sceneData.behaviorsSharedData.length;
        i < len;
        ++i
      ) {
        const behaviorSharedData = sceneData.behaviorsSharedData[i];
        this.setInitialSharedDataForBehavior(
          behaviorSharedData.name,
          behaviorSharedData
        );
      }

      //Registering objects: Global objects first...
      const initialGlobalObjectsData = this.getGame().getInitialObjectsData();
      for (let i = 0, len = initialGlobalObjectsData.length; i < len; ++i) {
        this.registerObject(initialGlobalObjectsData[i]);
      }

      //...then the scene objects
      for (let i = 0, len = sceneData.objects.length; i < len; ++i) {
        this.registerObject(sceneData.objects[i]);
      }

      // Create initial instances of objects.
      if (!options || !options.skipCreatingInstances) {
        this.createObjectsFrom(
          sceneData.instances,
          0,
          0,
          0,
          /*trackByPersistentUuid=*/
          true,
          {
            excludedObjectNames: options?.excludedObjectNames,
          }
        );
      }

      // Set up the default z order (for objects created from events)
      this._setLayerDefaultZOrders();

      //Set up the function to be executed at each tick
      this.setEventsGeneratedCodeFunction(sceneData);
      this._onceTriggers = new gdjs.OnceTriggers();

      // Notify the global callbacks
      if (this._runtimeGame && !this._runtimeGame.wasFirstSceneLoaded()) {
        for (let i = 0; i < gdjs.callbacksFirstRuntimeSceneLoaded.length; ++i) {
          gdjs.callbacksFirstRuntimeSceneLoaded[i](this);
        }
      }
      for (let i = 0; i < gdjs.callbacksRuntimeSceneLoaded.length; ++i) {
        gdjs.callbacksRuntimeSceneLoaded[i](this);
      }
      if (
        sceneData.stopSoundsOnStartup &&
        (!options || !options.skipStoppingSoundsOnStartup) &&
        this._runtimeGame
      ) {
        this._runtimeGame.getSoundManager().clearAll();
      }
      this._isLoaded = true;
      this._timeManager.reset();
    }

    getInitialSharedDataForBehavior(name: string): BehaviorSharedData | null {
      // TODO Move this error in RuntimeInstanceContainer after deciding
      // what to do with shared data in custom object.
      const behaviorSharedData = super.getInitialSharedDataForBehavior(name);
      if (!behaviorSharedData) {
        logger.error("Can't find shared data for behavior with name: " + name);
      }
      return behaviorSharedData;
    }

    /**
     * Called when a scene is "paused", i.e it will be not be rendered again
     * for some time, until it's resumed or unloaded.
     */
    onPause() {
      // Notify the objects that the scene is being paused. Objects should not
      // do anything special, but some object renderers might want to know about this.
      const allInstancesList = this.getAdhocListOfAllInstances();
      for (let i = 0, len = allInstancesList.length; i < len; ++i) {
        const object = allInstancesList[i];
        object.onScenePaused(this);
      }

      for (let i = 0; i < gdjs.callbacksRuntimeScenePaused.length; ++i) {
        gdjs.callbacksRuntimeScenePaused[i](this);
      }
    }

    /**
     * Called when a scene is "resumed", i.e it will be rendered again
     * on screen after having being paused.
     */
    onResume() {
      this._isJustResumed = true;

      // Notify the objects that the scene is being resumed. Objects should not
      // do anything special, but some object renderers might want to know about this.
      const allInstancesList = this.getAdhocListOfAllInstances();
      for (let i = 0, len = allInstancesList.length; i < len; ++i) {
        const object = allInstancesList[i];
        object.onSceneResumed(this);
      }

      for (let i = 0; i < gdjs.callbacksRuntimeSceneResumed.length; ++i) {
        gdjs.callbacksRuntimeSceneResumed[i](this);
      }
    }

    /**
     * Called before a scene is removed from the stack of scenes
     * rendered on the screen.
     */
    unloadScene() {
      if (!this._isLoaded) {
        return;
      }
      if (this._profiler) {
        this.stopProfiler();
      }

      // Notify the global callbacks (which should not release resources yet,
      // as other callbacks might still refer to the objects/scene).
      for (let i = 0; i < gdjs.callbacksRuntimeSceneUnloading.length; ++i) {
        gdjs.callbacksRuntimeSceneUnloading[i](this);
      }

      // Notify the objects they are being destroyed
      const allInstancesList = this.getAdhocListOfAllInstances();
      for (let i = 0, len = allInstancesList.length; i < len; ++i) {
        const object = allInstancesList[i];
        object.onDeletedFromScene();
        object.onDestroyed();
      }

      // Notify the renderer
      if (this._renderer) {
        this._renderer.onSceneUnloaded();
      }

      // Notify the global callbacks (after notifying objects and renderer, because
      // callbacks from extensions might want to free resources - which can't be done
      // safely before destroying objects and the renderer).
      for (let i = 0; i < gdjs.callbacksRuntimeSceneUnloaded.length; ++i) {
        gdjs.callbacksRuntimeSceneUnloaded[i](this);
      }

      this._destroy();

      this._isLoaded = false;
      this.onGameResolutionResized();
    }

    override _destroy() {
      // It should not be necessary to reset these variables, but this help
      // ensuring that all memory related to the RuntimeScene is released immediately.
      super._destroy();
      if (this._renderSnapshotCullingQueue) {
        this._renderSnapshotCullingQueue.dispose();
        this._renderSnapshotCullingQueue = null;
      }
      this._renderSnapshotCullingInFlightVersion = 0;
      this._renderSnapshotVisibilityByVersion.clear();
      this._renderSnapshotVersion = 0;
      this._renderSnapshotRead = this._createEmptyRenderSnapshot();
      this._renderSnapshotWrite = this._createEmptyRenderSnapshot();
      this._variables = new gdjs.VariablesContainer();
      this._variablesByExtensionName = new Map<
        string,
        gdjs.VariablesContainer
      >();
      this._initialBehaviorSharedData = new Hashtable();
      this._eventsFunction = null;
      this._lastId = 0;
      this.networkId = null;
      // @ts-ignore We are deleting the object
      this._onceTriggers = null;
    }

    /**
     * Set the function called each time the scene is stepped to be the events generated code,
     * which is by convention assumed to be a function in `gdjs` with a name based on the scene
     * mangled name.
     *
     * @param sceneData The scene data, used to find where the code was generated.
     */
    setEventsGeneratedCodeFunction(sceneData: LayoutData): void {
      const module = gdjs[sceneData.mangledName + 'Code'];
      if (module && module.func) {
        this._eventsFunction = module.func;
        this._idToCallbackMap =
          gdjs[sceneData.mangledName + 'Code'].idToCallbackMap;
      } else {
        setupWarningLogger.warn(
          'No function found for running logic of scene ' + this._name
        );
        this._eventsFunction = function () {};
      }
    }

    /**
     * Set the function called each time the scene is stepped.
     * The function will be passed the `runtimeScene` as argument.
     *
     * Note that this is already set up by the gdjs.RuntimeScene constructor and that you should
     * not need to use this method.
     *
     * @param func The function to be called.
     */
    setEventsFunction(func: () => void): void {
      this._eventsFunction = func;
    }

    /**
     * Step (execute the game logic) and render the scene.
     * @param elapsedTime In milliseconds
     * @return true if the game loop should continue, false if a scene change/push/pop
     * or a game stop was requested.
     */
    renderAndStep(elapsedTime: float): boolean {
      this._refreshRenderSnapshotOptimizationSettingsAndInvalidateIfNeeded();
      if (this._profiler) {
        this._profiler.beginFrame();
      }
      this._requestedChange = SceneChangeRequest.CONTINUE;
      this._timeManager.update(
        elapsedTime,
        this._runtimeGame.getMinimalFramerate()
      );
      if (this._profiler) {
        this._profiler.begin('asynchronous actions (wait action, etc...)');
      }
      this._asyncTasksManager.processTasks(this);
      if (this._profiler) {
        this._profiler.end('asynchronous actions (wait action, etc...)');
      }
      if (this._profiler) {
        this._profiler.begin('objects (pre-events)');
      }
      this._updateObjectsPreEvents();
      if (this._profiler) {
        this._profiler.end('objects (pre-events)');
      }
      if (this._profiler) {
        this._profiler.begin('callbacks and extensions (pre-events)');
      }
      for (let i = 0; i < gdjs.callbacksRuntimeScenePreEvents.length; ++i) {
        gdjs.callbacksRuntimeScenePreEvents[i](this);
      }
      if (this._profiler) {
        this._profiler.end('callbacks and extensions (pre-events)');
      }
      if (this._profiler) {
        this._profiler.begin('events');
      }
      if (this._eventsFunction !== null) this._eventsFunction(this);
      if (this._profiler) {
        this._profiler.end('events');
      }
      if (this._profiler) {
        this._profiler.begin('objects (post-events)');
      }
      this._stepBehaviorsPostEvents();
      if (this._profiler) {
        this._profiler.end('objects (post-events)');
      }
      if (this._profiler) {
        this._profiler.begin('callbacks and extensions (post-events)');
      }
      for (let i = 0; i < gdjs.callbacksRuntimeScenePostEvents.length; ++i) {
        gdjs.callbacksRuntimeScenePostEvents[i](this);
      }
      if (this._profiler) {
        this._profiler.end('callbacks and extensions (post-events)');
      }
      if (
        renderSnapshotIsolationEnabled &&
        !this._isRenderSnapshotCullingDisabled()
      ) {
        if (this._profiler) {
          this._profiler.begin('render snapshot');
        }
        this._buildRenderSnapshot();
        if (this._profiler) {
          this._profiler.end('render snapshot');
        }
      }

      this.render();
      if (this._profiler) {
        this._profiler.recordRenderStats(this._collectProfilerRenderStats());
      }
      this._isJustResumed = false;
      if (this._profiler) {
        this._profiler.end('render');
      }
      if (this._profiler) {
        this._profiler.endFrame();
      }
      return !!this.getRequestedChange();
    }
    /**
     * Render the scene (but do not execute the game logic).
     */
    render() {
      this._refreshRenderSnapshotOptimizationSettingsAndInvalidateIfNeeded();
      if (
        renderSnapshotIsolationEnabled &&
        !this._isRenderSnapshotCullingDisabled() &&
        this._renderSnapshotRead.version === 0
      ) {
        this._buildRenderSnapshot();
      }
      if (this._profiler) {
        this._profiler.begin('objects (pre-render, effects update)');
      }
      this._updateObjectsPreRender();
      if (this._profiler) {
        this._profiler.end('objects (pre-render, effects update)');
      }
      if (this._profiler) {
        this._profiler.begin('layers (effects update)');
      }
      this._updateLayersPreRender();
      if (this._profiler) {
        this._profiler.end('layers (effects update)');
      }
      if (this._profiler) {
        this._profiler.begin('render');
      }

      // Set to true to enable debug rendering (look for the implementation in the renderer
      // to see what is rendered).
      if (this._debugDrawEnabled) {
        this._debuggerRenderer.renderDebugDraw(
          this.getAdhocListOfAllInstances(),
          this._debugDrawShowHiddenInstances,
          this._debugDrawShowPointsNames,
          this._debugDrawShowCustomPoints
        );
      }

      this._renderer.render();
    }

    private _collectProfilerRenderStats():
      | gdjs.ProfilerRenderStatsSample
      | null {
      const gameRenderer = this._runtimeGame
        ? (this._runtimeGame.getRenderer() as any)
        : null;
      if (!gameRenderer || typeof gameRenderer.getThreeRenderer !== 'function') {
        return null;
      }
      const threeRenderer = gameRenderer.getThreeRenderer() as
        | THREE.WebGLRenderer
        | null;
      if (!threeRenderer || !threeRenderer.info) {
        return null;
      }

      const toNonNegativeFiniteNumber = (value: any): number | undefined =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0
          ? value
          : undefined;

      const rendererInfo = threeRenderer.info as THREE.WebGLInfo & {
        programs?: Array<any>;
      };
      const renderInfo = rendererInfo.render as {
        calls?: number;
        triangles?: number;
        lines?: number;
        points?: number;
      };
      const memoryInfo = rendererInfo.memory as {
        textures?: number;
        geometries?: number;
      };
      const shaderPrograms = Array.isArray(rendererInfo.programs)
        ? rendererInfo.programs.length
        : undefined;

      return {
        drawCalls: toNonNegativeFiniteNumber(renderInfo.calls),
        triangles: toNonNegativeFiniteNumber(renderInfo.triangles),
        lines: toNonNegativeFiniteNumber(renderInfo.lines),
        points: toNonNegativeFiniteNumber(renderInfo.points),
        textures: toNonNegativeFiniteNumber(memoryInfo.textures),
        geometries: toNonNegativeFiniteNumber(memoryInfo.geometries),
        shaderPrograms: toNonNegativeFiniteNumber(shaderPrograms),
      };
    }

    /**
     * Called to update visibility of the renderers of objects
     * rendered on the scene ("culling"), update effects (of visible objects)
     * and give a last chance for objects to update before rendering.
     *
     * Visibility is set to false if object is hidden, or if
     * object is too far from the camera of its layer ("culling").
     */
    _updateObjectsPreRender() {
      if (
        !renderSnapshotIsolationEnabled ||
        this._isRenderSnapshotCullingDisabled()
      ) {
        super._updateObjectsPreRender();
        return;
      }
      const snapshot = this._renderSnapshotRead;
      if (snapshot.version === 0 || snapshot.objectCount === 0) {
        super._updateObjectsPreRender();
        return;
      }

      const visibilityFromWorker =
        this._renderSnapshotVisibilityByVersion.get(snapshot.version) || null;

      for (let objectIndex = 0; objectIndex < snapshot.objectCount; objectIndex++) {
        const object = snapshot.objects[objectIndex];
        if (!object) {
          continue;
        }

        const rendererObject = object.getRendererObject();
        const rendererObject3D = object.get3DRendererObject();
        if (!rendererObject && !rendererObject3D) {
          // Objects without renderer object own their visibility/update flow.
          object.updatePreRender(this);
          continue;
        }

        const isVisibleFromMainThread = this._isObjectVisibleFromRenderSnapshot(
          snapshot,
          objectIndex
        );
        const isVisibleFromWorker =
          visibilityFromWorker && objectIndex < visibilityFromWorker.length
            ? visibilityFromWorker[objectIndex] === 1
            : true;
        // Worker culling is a 2D fast-path and should never override 3D visibility.
        const isVisible = rendererObject3D
          ? isVisibleFromMainThread
          : isVisibleFromMainThread && isVisibleFromWorker;
        if (rendererObject) {
          rendererObject.visible = isVisible;
        }
        if (rendererObject3D) {
          rendererObject3D.visible = isVisible;
        }

        if (!isVisible) {
          object.updatePreRender(this);
          continue;
        }

        if (rendererObject) {
          this._runtimeGame
            .getEffectsManager()
            .updatePreRender(object.getRendererEffects(), object);
        }
        object.updatePreRender(this);
      }
    }

    /**
     * Change the background color, by setting the RGB components.
     * Internally, the color is stored as an hexadecimal number.
     *
     * @param r The color red component (0-255).
     * @param g The color green component (0-255).
     * @param b The color blue component (0-255).
     */
    setBackgroundColor(r: integer, g: integer, b: integer): void {
      this._backgroundColor = parseInt(gdjs.rgbToHex(r, g, b), 16);
    }

    /**
     * Get the background color, as an hexadecimal number.
     * @returns The current background color.
     */
    getBackgroundColor(): number {
      return this._backgroundColor;
    }

    /**
     * Set whether the canvas should be cleared before this scene rendering.
     * This is experimental: if possible, try to avoid relying on this and use
     * custom objects to build complex scenes.
     */
    setClearCanvas(shouldClearCanvas: boolean): void {
      this._clearCanvas = shouldClearCanvas;
    }

    /**
     * Get whether the canvas should be cleared before this scene rendering.
     */
    getClearCanvas(): boolean {
      return this._clearCanvas;
    }

    /**
     * Get the name of the scene.
     */
    getName(): string {
      return this._name;
    }

    /**
     * Get the strategy to unload resources of this scene.
     */
    getResourcesUnloading(): 'at-scene-exit' | 'never' | 'inherit' {
      return this._resourcesUnloading;
    }

    /**
     * Create an identifier for a new object of the scene.
     */
    createNewUniqueId(): integer {
      this._lastId++;
      return this._lastId;
    }

    getRenderer(): gdjs.RuntimeScenePixiRenderer {
      return this._renderer;
    }

    getDebuggerRenderer() {
      return this._debuggerRenderer;
    }

    getGame() {
      return this._runtimeGame;
    }

    getScene() {
      return this;
    }

    getUnrotatedViewportMinX(): float {
      return 0;
    }

    getUnrotatedViewportMinY(): float {
      return 0;
    }

    getUnrotatedViewportMaxX(): float {
      return this._cachedGameResolutionWidth;
    }

    getUnrotatedViewportMaxY(): float {
      return this._cachedGameResolutionHeight;
    }

    getInitialUnrotatedViewportMinX(): float {
      return 0;
    }

    getInitialUnrotatedViewportMinY(): float {
      return 0;
    }

    getInitialUnrotatedViewportMaxX(): float {
      return this.getGame().getOriginalWidth();
    }

    getInitialUnrotatedViewportMaxY(): float {
      return this.getGame().getOriginalHeight();
    }

    getViewportWidth(): float {
      return this._cachedGameResolutionWidth;
    }

    getViewportHeight(): float {
      return this._cachedGameResolutionHeight;
    }

    getViewportOriginX(): float {
      return this._cachedGameResolutionWidth / 2;
    }

    getViewportOriginY(): float {
      return this._cachedGameResolutionHeight / 2;
    }

    convertCoords(x: float, y: float, result: FloatPoint): FloatPoint {
      // The result parameter used to be optional.
      const point = result || [0, 0];
      point[0] = x;
      point[1] = y;
      return point;
    }

    convertInverseCoords(
      sceneX: float,
      sceneY: float,
      result: FloatPoint
    ): FloatPoint {
      const point = result || [0, 0];
      point[0] = sceneX;
      point[1] = sceneY;
      return point;
    }

    onChildrenLocationChanged(): void {
      // Scenes don't maintain bounds.
    }

    /**
     * Get the variables of the runtimeScene.
     * @return The container holding the variables of the scene.
     */
    getVariables() {
      return this._variables;
    }

    /**
     * Get the extension's variables for this scene.
     * @param extensionName The extension name.
     * @returns The extension's variables for this scene.
     */
    getVariablesForExtension(extensionName: string) {
      return this._variablesByExtensionName.get(extensionName) || null;
    }

    /**
     * Get the TimeManager of the scene.
     * @return The gdjs.TimeManager of the scene.
     */
    getTimeManager(): gdjs.TimeManager {
      return this._timeManager;
    }

    /**
     * Return the time elapsed since the last frame,
     * in milliseconds, for objects on the layer.
     */
    getElapsedTime(): float {
      return this._timeManager.getElapsedTime();
    }

    /**
     * Shortcut to get the SoundManager of the game.
     * @return The gdjs.SoundManager of the game.
     */
    getSoundManager(): gdjs.SoundManager {
      return this._runtimeGame.getSoundManager();
    }

    /**
     * @returns The scene's async tasks manager.
     */
    getAsyncTasksManager() {
      return this._asyncTasksManager;
    }

    /**
     * Submit a serializable computation to the multithreading worker pool.
     */
    runInWorker<T = unknown>(
      handlerName: string,
      payload: unknown,
      options?: gdjs.WorkerTaskOptions
    ): gdjs.WorkerTaskHandle<T> {
      return this._runtimeGame
        .getMultithreadManager()
        .runTask<T>(handlerName, payload, options);
    }

    /**
     * Create a lightweight queue to dispatch many small worker tasks.
     */
    createWorkerTaskQueue(
      options?: gdjs.WorkerTaskQueueOptions
    ): gdjs.WorkerTaskQueue {
      return this._runtimeGame.getMultithreadManager().createTaskQueue(options);
    }

    /**
     * Create an async task backed by a multithreaded worker job.
     */
    createWorkerTask<T = unknown>(
      handlerName: string,
      payload: unknown,
      options?: gdjs.WorkerTaskOptions
    ): gdjs.WorkerTask<T> {
      return new gdjs.WorkerTask<T>(
        this.runInWorker<T>(handlerName, payload, options)
      );
    }

    /**
     * Submit a multithreaded task and invoke the callback on the next frame once it settles.
     */
    addWorkerTask<T = unknown>(
      handlerName: string,
      payload: unknown,
      callback: (
        runtimeScene: gdjs.RuntimeScene,
        result: T | null,
        workerTask: gdjs.WorkerTask<T>,
        longLivedObjectsList: gdjs.LongLivedObjectsList
      ) => void,
      callbackId = '',
      longLivedObjectsList = new gdjs.LongLivedObjectsList(),
      options?: gdjs.WorkerTaskOptions
    ): gdjs.WorkerTask<T> {
      const workerTask = this.createWorkerTask<T>(handlerName, payload, options);
      this._asyncTasksManager.addTask(
        workerTask,
        (runtimeScene, asyncObjectsList) => {
          callback(
            runtimeScene,
            workerTask.getResult(),
            workerTask,
            asyncObjectsList
          );
        },
        callbackId,
        longLivedObjectsList
      );
      return workerTask;
    }

    /**
     * Return the value of the scene change that is requested.
     */
    getRequestedChange(): SceneChangeRequest {
      return this._requestedChange;
    }

    /**
     * Return the name of the new scene to be launched.
     *
     * See requestChange.
     */
    getRequestedScene(): string {
      return this._requestedScene;
    }

    /**
     * Request a scene change to be made. The change is handled externally (see gdjs.SceneStack)
     * thanks to getRequestedChange and getRequestedScene methods.
     * @param change One of RuntimeScene.CONTINUE|PUSH_SCENE|POP_SCENE|REPLACE_SCENE|CLEAR_SCENES|STOP_GAME.
     * @param sceneName The name of the new scene to launch, if applicable.
     */
    requestChange(change: SceneChangeRequest, sceneName?: string) {
      this._requestedChange = change;
      if (sceneName) this._requestedScene = sceneName;
    }

    /**
     * Get the profiler associated with the scene, or null if none.
     */
    getProfiler(): gdjs.Profiler | null {
      return this._profiler;
    }

    /**
     * Start a new profiler to measures the time passed in sections of the engine
     * in the scene.
     * @param onProfilerStopped Function to be called when the profiler is stopped. Will be passed the profiler as argument.
     */
    startProfiler(onProfilerStopped: (oldProfiler: gdjs.Profiler) => void) {
      if (this._profiler) {
        return;
      }
      this._profiler = new gdjs.Profiler();
      this._onProfilerStopped = onProfilerStopped;
    }

    /**
     * Stop the profiler being run on the scene.
     */
    stopProfiler() {
      if (!this._profiler) {
        return;
      }
      const oldProfiler = this._profiler;
      const onProfilerStopped = this._onProfilerStopped;
      this._profiler = null;
      this._onProfilerStopped = null;
      if (onProfilerStopped) {
        onProfilerStopped(oldProfiler);
      }
    }

    /**
     * Get the structure containing the triggers for "Trigger once" conditions.
     */
    getOnceTriggers() {
      return this._onceTriggers;
    }

    /**
     * Check if the scene was just resumed.
     * This is true during the first frame after the scene has been unpaused.
     *
     * @returns true if the scene was just resumed
     */
    sceneJustResumed(): boolean {
      return this._isJustResumed;
    }

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): LayoutNetworkSyncData | null {
      const syncedPlayerNumber = syncOptions.playerNumber;
      const variablesNetworkSyncData =
        this._variables.getNetworkSyncData(syncOptions);
      const extensionsVariablesSyncData = {};
      this._variablesByExtensionName.forEach((variables, extensionName) => {
        const extensionVariablesSyncData =
          variables.getNetworkSyncData(syncOptions);
        // If there is no variables to sync, don't include the extension in the sync data.
        if (extensionVariablesSyncData) {
          extensionsVariablesSyncData[extensionName] =
            extensionVariablesSyncData;
        }
      });

      if (
        syncedPlayerNumber !== undefined &&
        syncedPlayerNumber !== 1 &&
        !this.networkId
      ) {
        // If we are getting sync data for a specific player,
        // and they are not the host, there is no sync data to send if
        // the scene has no networkId (it's either not a multiplayer scene or the scene is not yet networked).
        return null;
      }

      const networkSyncData: LayoutNetworkSyncData = {
        var: variablesNetworkSyncData,
        extVar: extensionsVariablesSyncData,
        id: this.getOrCreateNetworkId(),
      };
      if (syncOptions.syncSceneVisualProps) {
        networkSyncData.color = this._backgroundColor;
      }
      if (syncOptions.syncLayers) {
        const layersSyncData = {};
        for (const layerName in this._layers.items) {
          layersSyncData[layerName] =
            this._layers.items[layerName].getNetworkSyncData();
        }
        networkSyncData.layers = layersSyncData;
      }
      if (syncOptions.syncSceneTimers) {
        networkSyncData.time = this._timeManager.getNetworkSyncData();
      }
      if (syncOptions.syncOnceTriggers) {
        networkSyncData.once = this._onceTriggers.getNetworkSyncData();
      }

      gdjs.callbacksRuntimeSceneGetSyncData.forEach((callback) => {
        callback(this, networkSyncData, syncOptions);
      });

      if (syncOptions.syncAsyncTasks) {
        networkSyncData.async =
          this._asyncTasksManager.getNetworkSyncData(syncOptions);
      }

      return networkSyncData;
    }

    updateFromNetworkSyncData(
      syncData: LayoutNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ) {
      if (syncData.color !== undefined) {
        this._backgroundColor = syncData.color;
      }
      if (syncData.layers) {
        for (const layerName in syncData.layers) {
          const layerData = syncData.layers[layerName];
          if (this.hasLayer(layerName)) {
            const layer = this.getLayer(layerName);
            layer.updateFromNetworkSyncData(layerData);
          }
        }
      }
      // Update variables before anything else, as they might be used
      // in other sync data (for instance in tweens).
      if (syncData.var) {
        this._variables.updateFromNetworkSyncData(syncData.var, options);
      }
      if (syncData.extVar) {
        for (const extensionName in syncData.extVar) {
          if (!syncData.extVar.hasOwnProperty(extensionName)) {
            continue;
          }
          const extensionVariablesData = syncData.extVar[extensionName];
          const extensionVariables =
            this._variablesByExtensionName.get(extensionName);
          if (extensionVariables) {
            extensionVariables.updateFromNetworkSyncData(
              extensionVariablesData,
              options
            );
          }
        }
      }
      if (syncData.time) {
        this._timeManager.updateFromNetworkSyncData(syncData.time);
      }
      if (syncData.once) {
        this._onceTriggers.updateNetworkSyncData(syncData.once);
      }

      gdjs.callbacksRuntimeSceneUpdateFromSyncData.forEach((callback) => {
        callback(this, syncData, options);
      });

      // Sync Async last, as it might depend on other data.
      if (syncData.async && this._idToCallbackMap) {
        this._asyncTasksManager.updateFromNetworkSyncData(
          syncData.async,
          this._idToCallbackMap,
          this,
          options
        );
      }
    }

    getOrCreateNetworkId(): string {
      if (!this.networkId) {
        const newNetworkId = gdjs.makeUuid().substring(0, 8);
        this.networkId = newNetworkId;
      }
      return this.networkId;
    }
  }

  /**
   * The flags to describe the change request by a scene.
   * @category Core Engine > Scene
   */
  export enum SceneChangeRequest {
    CONTINUE,
    PUSH_SCENE,
    POP_SCENE,
    REPLACE_SCENE,
    CLEAR_SCENES,
    STOP_GAME,
  }
}
