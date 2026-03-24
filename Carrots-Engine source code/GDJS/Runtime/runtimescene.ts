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
  const renderSnapshotFlagHasRendererObject = 1 << 0;
  const renderSnapshotFlagHidden = 1 << 1;
  const renderSnapshotFlagHasAABB = 1 << 2;
  const renderSnapshotMinWorkerObjectCount = 128;
  const renderSnapshotIsolationEnabled = false;
  const renderSnapshotEnableWorkerCulling = false;
  let hasRegisteredRenderSnapshotWorkerHandler = false;

  type RuntimeRenderSnapshot = {
    version: integer;
    objectCount: integer;
    layerCount: integer;
    numericData: Float32Array;
    flags: Uint8Array;
    objects: Array<gdjs.RuntimeObject | null>;
    layerNames: string[];
    layerBounds: Float32Array;
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
            if (!hasRendererObject || isHidden) {
              visibilityMask[objectIndex] = 0;
              continue;
            }
            if (!hasAABB) {
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

      const nextObjects = new Array<gdjs.RuntimeObject | null>(nextCapacity);
      for (let i = 0; i < previousCapacity; i++) {
        nextObjects[i] = snapshot.objects[i] || null;
      }
      snapshot.objects = nextObjects;
    }

    private _swapRenderSnapshots(): void {
      const previousReadSnapshot = this._renderSnapshotRead;
      this._renderSnapshotRead = this._renderSnapshotWrite;
      this._renderSnapshotWrite = previousReadSnapshot;
      this._renderSnapshotVersion++;
      this._renderSnapshotRead.version = this._renderSnapshotVersion;
    }

    private _buildRenderSnapshot(): void {
      const allInstancesList = this.getAdhocListOfAllInstances();
      const objectCount = allInstancesList.length;
      const writeSnapshot = this._renderSnapshotWrite;
      this._ensureRenderSnapshotObjectCapacity(writeSnapshot, objectCount);

      writeSnapshot.objectCount = objectCount;
      writeSnapshot.layerCount = 0;
      writeSnapshot.layerNames.length = 0;
      for (let objectIndex = 0; objectIndex < objectCount; objectIndex++) {
        const object = allInstancesList[objectIndex];
        const numericOffset = objectIndex * renderSnapshotNumericStride;
        writeSnapshot.objects[objectIndex] = object;

        writeSnapshot.numericData[numericOffset + renderSnapshotXOffset] =
          object.getX();
        writeSnapshot.numericData[numericOffset + renderSnapshotYOffset] =
          object.getY();

        const rendererObject = object.getRendererObject();
        let objectFlags = 0;
        if (rendererObject) {
          objectFlags |= renderSnapshotFlagHasRendererObject;
        }
        if (object.isHidden()) {
          objectFlags |= renderSnapshotFlagHidden;
        }
        writeSnapshot.numericData[
          numericOffset + renderSnapshotLayerIndexOffset
        ] = 0;
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

        writeSnapshot.flags[objectIndex] = objectFlags;
      }

      for (
        let objectIndex = objectCount;
        objectIndex < writeSnapshot.objects.length;
        objectIndex++
      ) {
        writeSnapshot.objects[objectIndex] = null;
      }

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
      if (renderSnapshotIsolationEnabled) {
        if (this._profiler) {
          this._profiler.begin('render snapshot');
        }
        this._buildRenderSnapshot();
        if (this._profiler) {
          this._profiler.end('render snapshot');
        }
      }

      this.render();
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
      if (
        renderSnapshotIsolationEnabled &&
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

    /**
     * Called to update visibility of the renderers of objects
     * rendered on the scene ("culling"), update effects (of visible objects)
     * and give a last chance for objects to update before rendering.
     *
     * Visibility is set to false if object is hidden, or if
     * object is too far from the camera of its layer ("culling").
     */
    _updateObjectsPreRender() {
      if (!renderSnapshotIsolationEnabled) {
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
        if (!rendererObject) {
          // Objects without renderer object own their visibility/update flow.
          object.updatePreRender(this);
          continue;
        }

        const isVisible =
          visibilityFromWorker && objectIndex < visibilityFromWorker.length
            ? visibilityFromWorker[objectIndex] === 1
            : this._isObjectVisibleFromRenderSnapshot(snapshot, objectIndex);
        rendererObject.visible = isVisible;

        if (!isVisible) {
          object.updatePreRender(this);
          continue;
        }

        this._runtimeGame
          .getEffectsManager()
          .updatePreRender(object.getRendererEffects(), object);
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
