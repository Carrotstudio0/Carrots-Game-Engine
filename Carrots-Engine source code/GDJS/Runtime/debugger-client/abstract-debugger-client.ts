namespace gdjs {
  const logger = new gdjs.Logger('Debugger client');

  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };

  /**
   * A function used to replace circular references with a new value.
   * @param key - The key corresponding to the value.
   * @param value - The value.
   * @returns The new value.
   */
  type DebuggerClientCycleReplacer = (key: string, value: any) => any;

  /**
   * Generates a JSON serializer that prevent circular references and stop if maxDepth is reached.
   * @param [replacer] - A function called for each property on the object or array being stringified, with the property key and its value, and that returns the new value. If not specified, values are not altered.
   * @param [cycleReplacer] - Function used to replace circular references with a new value.
   * @param [maxDepth] - The maximum depth, after which values are replaced by a string ("[Max depth reached]"). If not specified, there is no maximum depth.
   */
  const depthLimitedSerializer = (
    replacer?: DebuggerClientCycleReplacer,
    cycleReplacer?: DebuggerClientCycleReplacer,
    maxDepth?: number
  ): DebuggerClientCycleReplacer => {
    const stack: Array<string> = [],
      keys: Array<string> = [];
    if (cycleReplacer === undefined || cycleReplacer === null) {
      cycleReplacer = function (key, value) {
        if (stack[0] === value) {
          return '[Circular ~]';
        }
        return (
          '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']'
        );
      };
    }

    return function (key: string, value: any): any {
      if (stack.length > 0) {
        const thisPos = stack.indexOf(this);
        ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
        ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
        if (maxDepth != null && thisPos > maxDepth) {
          return '[Max depth reached]';
        } else {
          if (~stack.indexOf(value)) {
            value = (cycleReplacer as DebuggerClientCycleReplacer).call(
              this,
              key,
              value
            );
          }
        }
      } else {
        stack.push(value);
      }
      return replacer == null ? value : replacer.call(this, key, value);
    };
  };

  /**
   * This is an alternative to JSON.stringify that ensure that circular references
   * are replaced by a placeholder.
   *
   * @param obj - The object to serialize.
   * @param [replacer] - A function called for each property on the object or array being stringified, with the property key and its value, and that returns the new value. If not specified, values are not altered.
   * @param [maxDepth] - The maximum depth, after which values are replaced by a string ("[Max depth reached]"). If not specified, there is no maximum depth.
   * @param [spaces] - The number of spaces for indentation.
   * @param [cycleReplacer] - Function used to replace circular references with a new value.
   */
  const circularSafeStringify = (
    obj: any,
    replacer?: DebuggerClientCycleReplacer,
    maxDepth?: number,
    spaces?: number,
    cycleReplacer?: DebuggerClientCycleReplacer
  ) => {
    return JSON.stringify(
      obj,
      depthLimitedSerializer(replacer, cycleReplacer, maxDepth),
      spaces
    );
  };

  /** Replacer function for JSON.stringify to convert Error objects into plain objects that can be logged. */
  const errorReplacer = (_, value: any) => {
    if (value instanceof Error) {
      // See https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
      const errorObject = {};
      Object.getOwnPropertyNames(value).forEach((prop) => {
        errorObject[prop] = value[prop];
      });

      return errorObject;
    }
    // Return the value unchanged if it's not an Error object.
    return value;
  };

  const buildGameCrashReport = (
    exception: Error,
    runtimeGame: gdjs.RuntimeGame
  ) => {
    const currentScene = runtimeGame.isInGameEdition()
      ? runtimeGame.getInGameEditor()?.getCurrentScene()
      : runtimeGame.getSceneStack().getCurrentScene();
    const sceneNames = runtimeGame.isInGameEdition()
      ? [currentScene?.getName()]
      : runtimeGame.getSceneStack().getAllSceneNames();
    return {
      type: 'javascript-uncaught-exception',
      exception,
      platformInfo: runtimeGame.getPlatformInfo(),
      playerId: runtimeGame.getPlayerId(),
      sessionId: runtimeGame.getSessionId(),
      isPreview: runtimeGame.isPreview(),
      isInGameEdition: runtimeGame.isInGameEdition(),
      gdevelop: {
        previewContext: runtimeGame.getAdditionalOptions().previewContext,
        isNativeMobileApp: runtimeGame.getAdditionalOptions().nativeMobileApp,
        versionWithHash:
          runtimeGame.getAdditionalOptions().gdevelopVersionWithHash,
        environment: runtimeGame.getAdditionalOptions().environment,
      },
      game: {
        gameId: gdjs.projectData.properties.projectUuid,
        name: runtimeGame.getGameData().properties.name || '',
        packageName: runtimeGame.getGameData().properties.packageName || '',
        version: runtimeGame.getGameData().properties.version || '',
        location: window.location.href,
        projectTemplateSlug:
          runtimeGame.getAdditionalOptions().projectTemplateSlug,
        sourceGameId: runtimeGame.getAdditionalOptions().sourceGameId,
      },
      gameState: {
        sceneNames,
        isWebGPUSupported:
          typeof runtimeGame.getRenderer().usesWebGPUBackend === 'function'
            ? runtimeGame.getRenderer().usesWebGPUBackend()
            : typeof navigator !== 'undefined' &&
              !!(navigator as Navigator & { gpu?: GPU }).gpu,
        hasPixiRenderer: !!runtimeGame.getRenderer().getPIXIRenderer(),
        hasThreeRenderer: !!runtimeGame.getRenderer().getThreeRenderer(),
        requestedRenderingBackend: runtimeGame.getRenderingBackend(),
        activeRenderingBackend:
          typeof runtimeGame.getRenderer().getActiveRenderingBackend ===
          'function'
            ? runtimeGame.getRenderer().getActiveRenderingBackend()
            : 'webgpu',
        renderingBackendFallbackIssue:
          typeof runtimeGame.getRenderer().getRenderingBackendFallbackIssue ===
          'function'
            ? runtimeGame.getRenderer().getRenderingBackendFallbackIssue()
            : null,
        hybridRenderingIssue:
          typeof runtimeGame.getRenderer().getHybridRenderingIssue ===
          'function'
            ? runtimeGame.getRenderer().getHybridRenderingIssue()
            : null,
        dedicatedThreeWebGpuIssue:
          typeof runtimeGame.getRenderer().getDedicatedThreeWebGPUIssue ===
          'function'
            ? runtimeGame.getRenderer().getDedicatedThreeWebGPUIssue()
            : null,
        dedicatedThreeWebGpuAvailable:
          typeof runtimeGame.getRenderer().hasDedicatedThreeWebGPURenderer ===
          'function'
            ? runtimeGame.getRenderer().hasDedicatedThreeWebGPURenderer()
            : false,
        dedicatedThreeWebGpuSceneActive:
          typeof runtimeGame.getRenderer()
            .shouldRenderRuntimeSceneWithDedicatedThreeWebGPU === 'function'
            ? runtimeGame
                .getRenderer()
                .shouldRenderRuntimeSceneWithDedicatedThreeWebGPU(currentScene)
            : false,
        dedicatedThreeWebGpuSceneRequirementReason:
          currentScene &&
          typeof currentScene.getDedicatedThreeWebGPURequirementReason ===
            'function'
            ? currentScene.getDedicatedThreeWebGPURequirementReason()
            : null,
        threeWebGpuBundleAvailable:
          typeof gdjs.hasThreeWebGpuBundleSupport === 'function'
            ? gdjs.hasThreeWebGpuBundleSupport()
            : false,
        threeTslBundleAvailable:
          typeof gdjs.hasThreeTslBundleSupport === 'function'
            ? gdjs.hasThreeTslBundleSupport()
            : false,
        threeNodeMaterialsEnabled:
          typeof gdjs.canUseThreeTslNodeMaterials === 'function'
            ? gdjs.canUseThreeTslNodeMaterials(
                runtimeGame.getRenderer().getThreeRenderer()
              )
            : false,
        adaptiveGpuUpscalingEnabled:
          typeof runtimeGame.isAdaptiveGpuUpscalingEnabled === 'function'
            ? runtimeGame.isAdaptiveGpuUpscalingEnabled()
            : false,
        adaptiveGpuRenderingScale:
          typeof runtimeGame.getAdaptiveGpuRenderingScale === 'function'
            ? runtimeGame.getAdaptiveGpuRenderingScale()
            : 1,
        resourcesTotalCount:
          runtimeGame.getGameData().resources.resources.length,
        antialiasingMode: runtimeGame.getAntialiasingMode(),
        isAntialisingEnabledOnMobile:
          runtimeGame.isAntialisingEnabledOnMobile(),
        scriptFiles: runtimeGame.getAdditionalOptions().scriptFiles,
        currentSceneTimeFromStart: currentScene
          ? currentScene.getTimeManager().getTimeFromStart()
          : null,
        gdjsKeys: Object.keys(gdjs).slice(0, 1000),
      },
    };
  };

  type CinematicTimelineEasing =
    | 'linear'
    | 'step'
    | 'none'
    | 'quadEaseIn'
    | 'quadEaseOut'
    | 'quadEaseInOut';

  type CinematicTimelineVec3 = {
    x: number;
    y: number;
    z: number;
  };

  type CinematicTimelineTransformValue = {
    position: CinematicTimelineVec3;
    rotation: CinematicTimelineVec3;
    scale: CinematicTimelineVec3;
  };

  type CinematicTimelineIKValue = {
    target: CinematicTimelineVec3;
    pole: CinematicTimelineVec3;
    weight: number;
  };

  type CinematicTimelineKeyframe<T> = {
    frame: number;
    easing: CinematicTimelineEasing;
    value: T;
  };

  type CinematicTimelineTransformTrack = {
    id: string;
    type: 'transform';
    targetId: string;
    keyframes: Array<CinematicTimelineKeyframe<CinematicTimelineTransformValue>>;
  };

  type CinematicTimelineIKTrack = {
    id: string;
    type: 'ik';
    name: string;
    targetId: string;
    chainRoot: string;
    endEffector: string;
    keyframes: Array<CinematicTimelineKeyframe<CinematicTimelineIKValue>>;
  };

  type CinematicTimelineTrack =
    | CinematicTimelineTransformTrack
    | CinematicTimelineIKTrack;

  type CinematicTimelineLoopRange = {
    enabled: boolean;
    inFrame: number;
    outFrame: number;
  };

  type CinematicTimelineShot = {
    id: string;
    name: string;
    startFrame: number;
    endFrame: number;
  };

  type CinematicTimelineEventMarker = {
    id: string;
    name: string;
    action: string;
    condition: string;
    frame: number;
    payload: string;
  };

  type CinematicTimelinePlaybackRange = {
    inFrame: number;
    outFrame: number;
  };

  type CinematicTimelineScene = {
    fps: number;
    duration: number;
    tracks: Array<CinematicTimelineTrack>;
    loopRange: CinematicTimelineLoopRange;
    shots: Array<CinematicTimelineShot>;
    events: Array<CinematicTimelineEventMarker>;
  };

  type CinematicTimelinePayload = {
    scene?: unknown;
    frame?: unknown;
    fps?: unknown;
    duration?: unknown;
    loopPlayback?: unknown;
    shotId?: unknown;
    shotName?: unknown;
    startFrame?: unknown;
    endFrame?: unknown;
  };

  type IKTimelineRuntimeObject = gdjs.RuntimeObject & {
    configureIKChain: (
      chainName: string,
      effectorBoneName: string,
      targetBoneName: string,
      linkBoneNames: string,
      iterationCount: number,
      blendFactor: number,
      minAngle: number,
      maxAngle: number
    ) => void;
    setIKTargetPosition: (
      chainName: string,
      x: number,
      y: number,
      z: number
    ) => void;
    setIKEnabled: (chainName: string, enabled: boolean) => void;
    setIKBlendFactor: (chainName: string, blendFactor: number) => void;
    setIKIterationCount: (chainName: string, iterationCount: number) => void;
    setIKAngleLimits: (
      chainName: string,
      minAngleDegrees: number,
      maxAngleDegrees: number
    ) => void;
    setIKTargetTolerance: (chainName: string, tolerance: number) => void;
  };

  const isIKTimelineRuntimeObject = (
    object: gdjs.RuntimeObject
  ): object is IKTimelineRuntimeObject => {
    const candidate = object as any;
    return (
      typeof candidate.configureIKChain === 'function' &&
      typeof candidate.setIKTargetPosition === 'function' &&
      typeof candidate.setIKEnabled === 'function'
    );
  };

  type CinematicTimelineRuntimeState = {
    scene: CinematicTimelineScene;
    currentFrame: number;
    timerId: number | null;
    startedAtMs: number;
    startedFromFrame: number;
    loopPlayback: boolean;
    playbackRange: CinematicTimelinePlaybackRange;
    activeShotId: string;
    configuredIKChains: Set<string>;
    warnedMissingTargets: Set<string>;
  };

  /**
   * The base class describing a debugger client, that can be used to inspect
   * a runtime game (dump its state) or alter it.
   * @category Debugging > Debugger Client
   */
  export abstract class AbstractDebuggerClient {
    _runtimegame: gdjs.RuntimeGame;
    _hotReloader: gdjs.HotReloader;
    _originalConsole = originalConsole;
    _inGameDebugger: gdjs.InGameDebugger;

    _hasLoggedUncaughtException = false;
    _cinematicTimelineState: CinematicTimelineRuntimeState | null = null;

    constructor(runtimeGame: RuntimeGame) {
      this._runtimegame = runtimeGame;
      this._hotReloader = new gdjs.HotReloader(runtimeGame);
      this._inGameDebugger = new gdjs.InGameDebugger(runtimeGame);

      const redirectJsLog = (
        type: 'info' | 'warning' | 'error',
        ...messages: any[]
      ) => {
        this.log(
          'JavaScript',
          messages.reduce((accumulator, value) => accumulator + value, ''),
          type,
          false
        );
      };

      // Hook the console logging functions to log to the Debugger as well
      console.log = (...messages: any[]) => {
        originalConsole.log(...messages);
        redirectJsLog('info', ...messages);
      };

      console.debug = (...messages: any[]) => {
        originalConsole.debug(...messages);
        redirectJsLog('info', ...messages);
      };

      console.info = (...messages: any[]) => {
        originalConsole.info(...messages);
        redirectJsLog('info', ...messages);
      };

      console.warn = (...messages: any[]) => {
        originalConsole.warn(...messages);
        redirectJsLog('warning', ...messages);
      };

      console.error = (...messages: any[]) => {
        originalConsole.error(...messages);
        redirectJsLog('error', ...messages);
      };

      // Overwrite the default GDJS log outputs so that they
      // both go to the console (or wherever they were configured to go)
      // and sent to the remote debugger.
      const existingLoggerOutput = gdjs.Logger.getLoggerOutput();
      gdjs.Logger.setLoggerOutput({
        log: (
          group: string,
          message: string,
          type: 'info' | 'warning' | 'error' = 'info',
          internal = true
        ) => {
          existingLoggerOutput.log(group, message, type, internal);
          this.log(group, message, type, internal);
        },
      });
    }

    /**
     * Should be called by derived class to handle a command
     * received from the debugger server.
     *
     * @param data An object containing the command to do.
     */
    protected handleCommand(data: any) {
      const that = this;
      const runtimeGame = this._runtimegame;
      const inGameEditor = runtimeGame.getInGameEditor();
      if (!data || !data.command) {
        // Not a command that's meant to be handled by the debugger, return silently to
        // avoid polluting the console.
        return;
      }

      try {
        if (data.command === 'play') {
          runtimeGame.pause(false);
        } else if (data.command === 'pause') {
          runtimeGame.pause(true);
          that.sendRuntimeGameDump();
        } else if (data.command === 'refresh') {
          that.sendRuntimeGameDump();
        } else if (data.command === 'getStatus') {
          that.sendRuntimeGameStatus();
        } else if (data.command === 'set') {
          that.set(data.path, data.newValue);
        } else if (data.command === 'call') {
          that.call(data.path, data.args);
        } else if (data.command === 'profiler.start') {
          runtimeGame.startCurrentSceneProfiler(function (stoppedProfiler) {
            that.sendProfilerOutput(
              stoppedProfiler.getFramesAverageMeasures(),
              stoppedProfiler.getStats()
            );
            that.sendProfilerStopped();
          });
          that.sendProfilerStarted();
        } else if (data.command === 'profiler.stop') {
          runtimeGame.stopCurrentSceneProfiler();
        } else if (data.command === 'hotReload') {
          const runtimeGameOptions: RuntimeGameOptions =
            data.payload.runtimeGameOptions;
          if (
            (runtimeGameOptions.initialRuntimeGameStatus?.isInGameEdition ||
              false) === runtimeGame.isInGameEdition()
          ) {
            this._hasLoggedUncaughtException = false;
            that._hotReloader
              .hotReload({
                projectData: data.payload.projectData,
                runtimeGameOptions,
                shouldReloadResources:
                  data.payload.shouldReloadResources || false,
              })
              .then((logs) => {
                that.sendHotReloaderLogs(logs);
              });
          }
        } else if (data.command === 'hotReloadObjects') {
          if (inGameEditor) {
            const editedInstanceContainer =
              inGameEditor.getEditedInstanceContainer();
            if (editedInstanceContainer) {
              that._hotReloader.hotReloadRuntimeSceneObjects(
                data.payload.updatedObjects,
                editedInstanceContainer
              );
            }
          }
        } else if (data.command === 'hotReloadLayers') {
          if (inGameEditor) {
            const editedInstanceContainer =
              inGameEditor.getEditedInstanceContainer();
            const editedLayerDataList = inGameEditor.getEditedLayerDataList();
            if (editedInstanceContainer) {
              inGameEditor.onLayersDataChange(
                data.payload.layers,
                data.payload.areEffectsHidden
              );
              that._hotReloader.hotReloadRuntimeSceneLayers(
                data.payload.layers,
                editedLayerDataList,
                editedInstanceContainer
              );
              // Apply `areEffectsHidden` to all the layers of the project data.
              // It avoids inconsistency when switching scene later on.
              // We do it after `hotReloadRuntimeSceneLayers` because it relies
              // on the differences with old project data.
              inGameEditor.setEffectsHiddenInEditor(
                data.payload.areEffectsHidden
              );
            }
          }
        } else if (data.command === 'setBackgroundColor') {
          if (inGameEditor) {
            const editedInstanceContainer =
              inGameEditor.getEditedInstanceContainer();
            if (editedInstanceContainer) {
              const backgroundColor = data.payload.backgroundColor;
              if (
                backgroundColor &&
                editedInstanceContainer instanceof gdjs.RuntimeScene
              ) {
                const sceneData = runtimeGame.getSceneData(
                  editedInstanceContainer.getScene().getName()
                );
                if (sceneData) {
                  editedInstanceContainer._backgroundColor =
                    gdjs.rgbToHexNumber(
                      backgroundColor[0],
                      backgroundColor[1],
                      backgroundColor[2]
                    );
                  sceneData.r = backgroundColor[0];
                  sceneData.v = backgroundColor[1];
                  sceneData.b = backgroundColor[2];
                }
              }
            }
          }
        } else if (data.command === 'hotReloadAllInstances') {
          if (inGameEditor) {
            const editedInstanceContainer =
              inGameEditor.getEditedInstanceContainer();
            if (editedInstanceContainer) {
              that._hotReloader.hotReloadRuntimeInstances(
                inGameEditor.getEditedInstanceDataList(),
                data.payload.instances,
                editedInstanceContainer
              );
            }
          }
        } else if (data.command === 'switchForInGameEdition') {
          if (!this._runtimegame.isInGameEdition()) return;

          const sceneName = data.sceneName || null;
          const eventsBasedObjectType = data.eventsBasedObjectType || null;
          if (!sceneName && !eventsBasedObjectType) {
            logger.warn(
              'No scene name specified, switchForInGameEdition aborted'
            );
            return;
          }
          if (inGameEditor) {
            const wasPaused = this._runtimegame.isPaused();
            this._runtimegame.pause(true);
            inGameEditor.switchToSceneOrVariant(
              data.editorId || null,
              sceneName,
              data.externalLayoutName || null,
              eventsBasedObjectType,
              data.eventsBasedObjectVariantName || null,
              data.editorCamera3D || null
            );
            this._runtimegame.pause(wasPaused);
          }
        } else if (data.command === 'setVisibleStatus') {
          if (inGameEditor) {
            inGameEditor.setVisibleStatus(data.visible);
          }
        } else if (data.command === 'updateInstances') {
          if (inGameEditor) {
            inGameEditor.reloadInstances(data.payload.instances);
          }
        } else if (data.command === 'addInstances') {
          if (inGameEditor) {
            inGameEditor.addInstances(data.payload.instances);
            inGameEditor.setSelectedObjects(
              data.payload.instances.map((instance) => instance.persistentUuid)
            );
            if (data.payload.moveUnderCursor) {
              inGameEditor.moveSelectionUnderCursor();
            }
          }
        } else if (data.command === 'deleteSelection') {
          if (inGameEditor) {
            inGameEditor.deleteSelection();
          }
        } else if (data.command === 'dragNewInstance') {
          const gameCoords = runtimeGame
            .getRenderer()
            .convertPageToGameCoords(data.x, data.y);
          runtimeGame
            .getInputManager()
            .onMouseMove(gameCoords[0], gameCoords[1]);

          if (inGameEditor)
            inGameEditor.dragNewInstance({
              name: data.name,
              dropped: data.dropped,
              isAltPressed: data.isAltPressed,
            });
        } else if (data.command === 'cancelDragNewInstance') {
          if (inGameEditor) inGameEditor.cancelDragNewInstance();
        } else if (data.command === 'setInGameEditorSettings') {
          if (inGameEditor && data.payload?.inGameEditorSettings) {
            inGameEditor.setInGameEditorSettings(
              data.payload.inGameEditorSettings
            );
          }
        } else if (data.command === 'setInstancesEditorSettings') {
          if (inGameEditor)
            inGameEditor.updateInstancesEditorSettings(
              data.payload.instancesEditorSettings
            );
        } else if (data.command === 'zoomToInitialPosition') {
          if (inGameEditor) {
            inGameEditor.zoomToInitialPosition(data.payload.visibleScreenArea);
          }
        } else if (data.command === 'zoomToFitContent') {
          if (inGameEditor) {
            inGameEditor.zoomToFitContent(data.payload.visibleScreenArea);
          }
        } else if (data.command === 'setSelectedLayer') {
          if (inGameEditor) {
            inGameEditor.setSelectedLayerName(data.payload.layerName);
          }
        } else if (data.command === 'zoomToFitSelection') {
          if (inGameEditor) {
            inGameEditor.zoomToFitSelection(data.payload.visibleScreenArea);
          }
        } else if (data.command === 'zoomBy') {
          if (inGameEditor) {
            inGameEditor.zoomBy(data.payload.zoomFactor);
          }
        } else if (data.command === 'setZoom') {
          if (inGameEditor) {
            inGameEditor.setZoom(data.payload.zoom);
          }
        } else if (data.command === 'setSelectedInstances') {
          if (inGameEditor) {
            inGameEditor.setSelectedObjects(data.payload.instanceUuids);
          }
        } else if (data.command === 'centerViewOnLastSelectedInstance') {
          if (inGameEditor) {
            // TODO: use data.payload.visibleScreenArea
            inGameEditor.centerViewOnLastSelectedInstance();
          }
        } else if (data.command === 'updateInnerArea') {
          if (inGameEditor) {
            inGameEditor.updateInnerArea(
              data.payload.areaMinX,
              data.payload.areaMinY,
              data.payload.areaMinZ,
              data.payload.areaMaxX,
              data.payload.areaMaxY,
              data.payload.areaMaxZ
            );
          }
        } else if (data.command === 'getSelectionAABB') {
          if (inGameEditor) {
            this.sendSelectionAABB(data.messageId);
          }
        } else if (data.command === 'cinematicTimeline.play') {
          this._playCinematicTimeline(data.payload || {});
        } else if (data.command === 'cinematicTimeline.playShot') {
          this._playCinematicTimelineShot(data.payload || {});
        } else if (data.command === 'cinematicTimeline.pause') {
          this._pauseCinematicTimeline(data.payload || {});
        } else if (data.command === 'cinematicTimeline.setFrame') {
          this._setCinematicTimelineFrame(data.payload || {});
        } else if (data.command === 'cinematicTimeline.stop') {
          this._stopCinematicTimeline(data.payload || {});
        } else if (data.command === 'hardReload') {
          // This usually means that the preview was modified so much that an entire reload
          // is needed, or that the runtime itself could have been modified.
          this._clearCinematicTimelineTimer();
          this.launchHardReload();
        } else {
          logger.info(
            'Unknown command "' + data.command + '" received by the debugger.'
          );
        }
      } catch (error) {
        this.onUncaughtException(error);
      }
    }

    private _parseFiniteNumber(value: unknown, fallbackValue: number): number {
      const parsedValue =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
          ? Number.parseFloat(value)
          : NaN;
      return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
    }

    private _clampNumber(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    private _clampInteger(value: number, min: number, max: number): number {
      return Math.round(this._clampNumber(value, min, max));
    }

    private _lerpNumber(from: number, to: number, alpha: number): number {
      return from + (to - from) * alpha;
    }

    private _normalizeCinematicVec3(
      value: unknown,
      fallbackValue: CinematicTimelineVec3
    ): CinematicTimelineVec3 {
      if (!value || typeof value !== 'object') return fallbackValue;
      const vec3Value = value as any;
      return {
        x: this._parseFiniteNumber(vec3Value.x, fallbackValue.x),
        y: this._parseFiniteNumber(vec3Value.y, fallbackValue.y),
        z: this._parseFiniteNumber(vec3Value.z, fallbackValue.z),
      };
    }

    private _normalizeCinematicTransformValue(
      value: unknown
    ): CinematicTimelineTransformValue {
      const fallbackValue: CinematicTimelineTransformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };

      if (!value || typeof value !== 'object') return fallbackValue;
      const transformValue = value as any;
      return {
        position: this._normalizeCinematicVec3(
          transformValue.position,
          fallbackValue.position
        ),
        rotation: this._normalizeCinematicVec3(
          transformValue.rotation,
          fallbackValue.rotation
        ),
        scale: this._normalizeCinematicVec3(
          transformValue.scale,
          fallbackValue.scale
        ),
      };
    }

    private _normalizeCinematicIKValue(value: unknown): CinematicTimelineIKValue {
      const fallbackValue: CinematicTimelineIKValue = {
        target: { x: 0, y: 0, z: 0 },
        pole: { x: 0, y: 0, z: 0 },
        weight: 1,
      };

      if (!value || typeof value !== 'object') return fallbackValue;
      const ikValue = value as any;
      return {
        target: this._normalizeCinematicVec3(ikValue.target, fallbackValue.target),
        pole: this._normalizeCinematicVec3(ikValue.pole, fallbackValue.pole),
        weight: this._clampNumber(
          this._parseFiniteNumber(ikValue.weight, fallbackValue.weight),
          0,
          1
        ),
      };
    }

    private _normalizeCinematicKeyframes<T>(
      keyframes: unknown,
      duration: number,
      normalizeValue: (value: unknown) => T
    ): Array<CinematicTimelineKeyframe<T>> {
      if (!Array.isArray(keyframes)) return [];

      const keyframesByFrame = new Map<number, CinematicTimelineKeyframe<T>>();
      for (const rawKeyframe of keyframes) {
        if (!rawKeyframe || typeof rawKeyframe !== 'object') continue;
        const keyframeValue = rawKeyframe as any;
        const frame = this._clampInteger(
          this._parseFiniteNumber(keyframeValue.frame, 0),
          0,
          duration
        );
        keyframesByFrame.set(frame, {
          frame,
          easing:
            keyframeValue.easing === 'step' ||
            keyframeValue.easing === 'none' ||
            keyframeValue.easing === 'quadEaseIn' ||
            keyframeValue.easing === 'quadEaseOut' ||
            keyframeValue.easing === 'quadEaseInOut'
              ? keyframeValue.easing
              : 'linear',
          value: normalizeValue(keyframeValue.value),
        });
      }

      return Array.from(keyframesByFrame.values()).sort(
        (a, b) => a.frame - b.frame
      );
    }

    private _normalizeCinematicLoopRange(
      value: unknown,
      duration: number
    ): CinematicTimelineLoopRange {
      const fallbackLoopRange: CinematicTimelineLoopRange = {
        enabled: false,
        inFrame: 0,
        outFrame: duration,
      };
      if (!value || typeof value !== 'object') return fallbackLoopRange;
      const loopRange = value as any;
      const inFrame = this._clampInteger(
        this._parseFiniteNumber(loopRange.inFrame, fallbackLoopRange.inFrame),
        0,
        duration
      );
      const outFrame = this._clampInteger(
        this._parseFiniteNumber(loopRange.outFrame, fallbackLoopRange.outFrame),
        0,
        duration
      );
      return {
        enabled: loopRange.enabled === true,
        inFrame: Math.min(inFrame, outFrame),
        outFrame: Math.max(inFrame, outFrame),
      };
    }

    private _normalizeCinematicShots(
      value: unknown,
      duration: number
    ): Array<CinematicTimelineShot> {
      if (!Array.isArray(value)) return [];
      return value
        .map((rawShot, index) => {
          if (!rawShot || typeof rawShot !== 'object') return null;
          const shot = rawShot as any;
          const startFrame = this._clampInteger(
            this._parseFiniteNumber(shot.startFrame, 0),
            0,
            duration
          );
          const endFrame = this._clampInteger(
            this._parseFiniteNumber(shot.endFrame, startFrame),
            0,
            duration
          );
          return {
            id:
              typeof shot.id === 'string' && shot.id
                ? shot.id
                : `shot-${index + 1}`,
            name:
              typeof shot.name === 'string' && shot.name
                ? shot.name
                : `Shot ${index + 1}`,
            startFrame: Math.min(startFrame, endFrame),
            endFrame: Math.max(startFrame, endFrame),
          };
        })
        .filter((shot): shot is CinematicTimelineShot => !!shot)
        .sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
    }

    private _normalizeCinematicEvents(
      value: unknown,
      duration: number
    ): Array<CinematicTimelineEventMarker> {
      if (!Array.isArray(value)) return [];
      return value
        .map((rawEvent, index) => {
          if (!rawEvent || typeof rawEvent !== 'object') return null;
          const eventMarker = rawEvent as any;
          return {
            id:
              typeof eventMarker.id === 'string' && eventMarker.id
                ? eventMarker.id
                : `event-${index + 1}`,
            name:
              typeof eventMarker.name === 'string' && eventMarker.name
                ? eventMarker.name
                : `Event ${index + 1}`,
            action:
              typeof eventMarker.action === 'string' && eventMarker.action
                ? eventMarker.action
                : 'Trigger',
            condition:
              typeof eventMarker.condition === 'string' && eventMarker.condition
                ? eventMarker.condition
                : 'Always',
            frame: this._clampInteger(
              this._parseFiniteNumber(eventMarker.frame, 0),
              0,
              duration
            ),
            payload:
              typeof eventMarker.payload === 'string' ? eventMarker.payload : '',
          };
        })
        .filter((eventMarker): eventMarker is CinematicTimelineEventMarker => !!eventMarker)
        .sort((a, b) => a.frame - b.frame);
    }

    private _normalizeCinematicScene(payload: CinematicTimelinePayload): CinematicTimelineScene {
      const sceneValue =
        payload.scene && typeof payload.scene === 'object' ? payload.scene : {};
      const sceneData = sceneValue as any;

      const fps = this._clampInteger(
        this._parseFiniteNumber(sceneData.fps ?? payload.fps, 30),
        1,
        240
      );
      const duration = this._clampInteger(
        this._parseFiniteNumber(sceneData.duration ?? payload.duration, 240),
        1,
        20000
      );

      const rawTracks = Array.isArray(sceneData.tracks) ? sceneData.tracks : [];
      const tracks: Array<CinematicTimelineTrack> = rawTracks.map(
        (rawTrack, index) => {
          const trackValue = rawTrack && typeof rawTrack === 'object' ? rawTrack : {};
          const track = trackValue as any;
          const trackId =
            typeof track.id === 'string' && track.id
              ? track.id
              : `track-${index + 1}`;
          const targetId =
            typeof track.targetId === 'string' ? track.targetId.trim() : '';

          if (track.type === 'ik') {
            return {
              id: trackId,
              type: 'ik',
              name:
                typeof track.name === 'string' && track.name
                  ? track.name
                  : `IK Track ${index + 1}`,
              targetId,
              chainRoot:
                typeof track.chainRoot === 'string' ? track.chainRoot : 'Hips',
              endEffector:
                typeof track.endEffector === 'string'
                  ? track.endEffector
                  : 'Hand.R',
              keyframes: this._normalizeCinematicKeyframes(
                track.keyframes,
                duration,
                value => this._normalizeCinematicIKValue(value)
              ),
            };
          }

          return {
            id: trackId,
            type: 'transform',
            targetId,
            keyframes: this._normalizeCinematicKeyframes(
              track.keyframes,
              duration,
              value => this._normalizeCinematicTransformValue(value)
            ),
          };
        }
      );

      const loopRange = this._normalizeCinematicLoopRange(
        sceneData.loopRange,
        duration
      );
      const shots = this._normalizeCinematicShots(sceneData.shots, duration);
      const events = this._normalizeCinematicEvents(sceneData.events, duration);

      return {
        fps,
        duration,
        tracks,
        loopRange,
        shots,
        events,
      };
    }

    private _normalizeCinematicFrame(
      rawFrame: unknown,
      sceneDuration: number
    ): number {
      return this._clampInteger(
        this._parseFiniteNumber(rawFrame, 0),
        0,
        Math.max(1, sceneDuration)
      );
    }

    private _getDefaultPlaybackRange(
      scene: CinematicTimelineScene
    ): CinematicTimelinePlaybackRange {
      if (scene.loopRange.enabled) {
        return {
          inFrame: scene.loopRange.inFrame,
          outFrame: scene.loopRange.outFrame,
        };
      }
      return {
        inFrame: 0,
        outFrame: scene.duration,
      };
    }

    private _resolveCinematicPlaybackRange(
      scene: CinematicTimelineScene,
      payload: CinematicTimelinePayload,
      fallbackRange?: CinematicTimelinePlaybackRange
    ): CinematicTimelinePlaybackRange {
      const baseRange = fallbackRange || this._getDefaultPlaybackRange(scene);
      const hasCustomStart = payload.startFrame !== undefined;
      const hasCustomEnd = payload.endFrame !== undefined;
      if (!hasCustomStart && !hasCustomEnd) {
        return {
          inFrame: this._clampInteger(baseRange.inFrame, 0, scene.duration),
          outFrame: this._clampInteger(baseRange.outFrame, 0, scene.duration),
        };
      }
      const inFrame = this._clampInteger(
        this._parseFiniteNumber(
          payload.startFrame,
          hasCustomEnd ? this._parseFiniteNumber(payload.endFrame, 0) : 0
        ),
        0,
        scene.duration
      );
      const outFrame = this._clampInteger(
        this._parseFiniteNumber(
          payload.endFrame,
          hasCustomStart ? this._parseFiniteNumber(payload.startFrame, scene.duration) : scene.duration
        ),
        0,
        scene.duration
      );
      return {
        inFrame: Math.min(inFrame, outFrame),
        outFrame: Math.max(inFrame, outFrame),
      };
    }

    private _resolveCinematicShot(
      scene: CinematicTimelineScene,
      payload: CinematicTimelinePayload
    ): CinematicTimelineShot | null {
      const shotId =
        typeof payload.shotId === 'string' ? payload.shotId.trim() : '';
      const shotName =
        typeof payload.shotName === 'string' ? payload.shotName.trim() : '';
      if (shotId) {
        const shot = scene.shots.find(candidate => candidate.id === shotId);
        if (shot) return shot;
      }
      if (shotName) {
        const normalizedShotName = shotName.toLowerCase();
        const shot = scene.shots.find(
          candidate => candidate.name.toLowerCase() === normalizedShotName
        );
        if (shot) return shot;
      }
      return null;
    }

    private _easeCinematicProgress(
      alpha: number,
      easing: CinematicTimelineEasing
    ): number {
      const clampedAlpha = this._clampNumber(alpha, 0, 1);
      if (easing === 'step' || easing === 'none') return 0;
      if (easing === 'quadEaseIn') return clampedAlpha * clampedAlpha;
      if (easing === 'quadEaseOut')
        return -clampedAlpha * (clampedAlpha - 2);
      if (easing === 'quadEaseInOut') {
        const doubleAlpha = clampedAlpha * 2;
        if (doubleAlpha < 1) return 0.5 * doubleAlpha * doubleAlpha;
        const normalized = doubleAlpha - 1;
        return -0.5 * (normalized * (normalized - 2) - 1);
      }
      return clampedAlpha;
    }

    private _evaluateCinematicKeyframes<T>(
      keyframes: Array<CinematicTimelineKeyframe<T>>,
      frame: number,
      lerpValues: (from: T, to: T, alpha: number) => T
    ): T | null {
      if (!keyframes.length) return null;

      const keyframesCount = keyframes.length;
      if (frame <= keyframes[0].frame) return keyframes[0].value;
      if (frame >= keyframes[keyframesCount - 1].frame)
        return keyframes[keyframesCount - 1].value;

      for (let index = 0; index < keyframesCount - 1; index++) {
        const fromKeyframe = keyframes[index];
        const toKeyframe = keyframes[index + 1];
        if (frame === fromKeyframe.frame) return fromKeyframe.value;
        if (frame === toKeyframe.frame) return toKeyframe.value;
        if (frame < fromKeyframe.frame || frame > toKeyframe.frame) continue;

        if (
          fromKeyframe.easing === 'step' ||
          fromKeyframe.easing === 'none'
        ) {
          return fromKeyframe.value;
        }
        const alpha =
          (frame - fromKeyframe.frame) / (toKeyframe.frame - fromKeyframe.frame);
        return lerpValues(
          fromKeyframe.value,
          toKeyframe.value,
          this._easeCinematicProgress(alpha, fromKeyframe.easing)
        );
      }

      return keyframes[keyframesCount - 1].value;
    }

    private _evaluateTransformTrackAtFrame(
      track: CinematicTimelineTransformTrack,
      frame: number
    ): CinematicTimelineTransformValue {
      const defaultTransformValue: CinematicTimelineTransformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };
      const value = this._evaluateCinematicKeyframes(
        track.keyframes,
        frame,
        (from, to, alpha) => ({
          position: {
            x: this._lerpNumber(from.position.x, to.position.x, alpha),
            y: this._lerpNumber(from.position.y, to.position.y, alpha),
            z: this._lerpNumber(from.position.z, to.position.z, alpha),
          },
          rotation: {
            x: this._lerpNumber(from.rotation.x, to.rotation.x, alpha),
            y: this._lerpNumber(from.rotation.y, to.rotation.y, alpha),
            z: this._lerpNumber(from.rotation.z, to.rotation.z, alpha),
          },
          scale: {
            x: this._lerpNumber(from.scale.x, to.scale.x, alpha),
            y: this._lerpNumber(from.scale.y, to.scale.y, alpha),
            z: this._lerpNumber(from.scale.z, to.scale.z, alpha),
          },
        })
      );
      return value || defaultTransformValue;
    }

    private _evaluateIKTrackAtFrame(
      track: CinematicTimelineIKTrack,
      frame: number
    ): CinematicTimelineIKValue {
      const defaultIKValue: CinematicTimelineIKValue = {
        target: { x: 0, y: 0, z: 0 },
        pole: { x: 0, y: 0, z: 0 },
        weight: 1,
      };
      const value = this._evaluateCinematicKeyframes(
        track.keyframes,
        frame,
        (from, to, alpha) => ({
          target: {
            x: this._lerpNumber(from.target.x, to.target.x, alpha),
            y: this._lerpNumber(from.target.y, to.target.y, alpha),
            z: this._lerpNumber(from.target.z, to.target.z, alpha),
          },
          pole: {
            x: this._lerpNumber(from.pole.x, to.pole.x, alpha),
            y: this._lerpNumber(from.pole.y, to.pole.y, alpha),
            z: this._lerpNumber(from.pole.z, to.pole.z, alpha),
          },
          weight: this._lerpNumber(from.weight, to.weight, alpha),
        })
      );
      return value || defaultIKValue;
    }

    private _getCinematicTimelineTargetContainer(): gdjs.RuntimeInstanceContainer | null {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (inGameEditor) {
        const editedInstanceContainer = inGameEditor.getEditedInstanceContainer();
        if (editedInstanceContainer) {
          return editedInstanceContainer;
        }
      }

      const currentScene = this._runtimegame.getSceneStack().getCurrentScene();
      return currentScene || null;
    }

    private _resolveCinematicTrackTargetObject(
      targetId: string,
      objectsByName: Map<string, gdjs.RuntimeObject>,
      objectsById: Map<number, gdjs.RuntimeObject>,
      objectsByPersistentUuid: Map<string, gdjs.RuntimeObject>
    ): gdjs.RuntimeObject | null {
      const trimmedTargetId = targetId.trim();
      if (!trimmedTargetId) return null;

      let resolverMode: 'auto' | 'name' | 'id' | 'uuid' = 'auto';
      let resolverValue = trimmedTargetId;
      const separatorIndex = trimmedTargetId.indexOf(':');
      if (separatorIndex > 0) {
        const prefix = trimmedTargetId.slice(0, separatorIndex).toLowerCase();
        const value = trimmedTargetId.slice(separatorIndex + 1).trim();
        if (value) {
          if (prefix === 'name' || prefix === 'id' || prefix === 'uuid') {
            resolverMode = prefix;
            resolverValue = value;
          }
        }
      }

      if (resolverMode === 'uuid') {
        return objectsByPersistentUuid.get(resolverValue) || null;
      }
      if (resolverMode === 'id') {
        const objectId = Number.parseInt(resolverValue, 10);
        return Number.isFinite(objectId) ? objectsById.get(objectId) || null : null;
      }
      if (resolverMode === 'name') {
        return objectsByName.get(resolverValue) || null;
      }

      return (
        objectsByPersistentUuid.get(resolverValue) ||
        (() => {
          const objectId = Number.parseInt(resolverValue, 10);
          return Number.isFinite(objectId) ? objectsById.get(objectId) : null;
        })() ||
        objectsByName.get(resolverValue) ||
        null
      );
    }

    private _applyCinematicTransformToObject(
      object: gdjs.RuntimeObject,
      value: CinematicTimelineTransformValue
    ): void {
      object.setX(value.position.x);
      object.setY(value.position.y);
      object.setAngle(value.rotation.z);

      const scalableObject = object as any;
      const hasScaleXSetter = typeof scalableObject.setScaleX === 'function';
      const hasScaleYSetter = typeof scalableObject.setScaleY === 'function';
      if (hasScaleXSetter) {
        scalableObject.setScaleX(value.scale.x);
      }
      if (hasScaleYSetter) {
        scalableObject.setScaleY(value.scale.y);
      }
      if (
        !hasScaleXSetter &&
        !hasScaleYSetter &&
        typeof scalableObject.setScale === 'function'
      ) {
        scalableObject.setScale((value.scale.x + value.scale.y) / 2);
      }

      if (gdjs.Base3DHandler && gdjs.Base3DHandler.is3D(object)) {
        object.setZ(value.position.z);
        object.setRotationX(value.rotation.x);
        object.setRotationY(value.rotation.y);
        object.setScaleZ(value.scale.z);
      }
    }

    private _ensureCinematicIKChain(
      state: CinematicTimelineRuntimeState,
      object: IKTimelineRuntimeObject,
      track: CinematicTimelineIKTrack,
      value: CinematicTimelineIKValue
    ): string {
      const chainName = (track.name || track.id || 'IKChain').trim() || 'IKChain';
      const cacheKey = `${object.id}:${chainName}`;
      if (state.configuredIKChains.has(cacheKey)) {
        return chainName;
      }

      const links = (track.chainRoot || '').trim();
      const effectorBoneName = (track.endEffector || '').trim() || 'Hand.R';
      object.configureIKChain(
        chainName,
        effectorBoneName,
        '',
        links,
        12,
        value.weight,
        -180,
        180
      );
      object.setIKEnabled(chainName, true);
      object.setIKIterationCount(chainName, 12);
      object.setIKBlendFactor(chainName, value.weight);
      object.setIKAngleLimits(chainName, -180, 180);
      object.setIKTargetTolerance(chainName, 0.002);
      state.configuredIKChains.add(cacheKey);
      return chainName;
    }

    private _applyCinematicIKToObject(
      state: CinematicTimelineRuntimeState,
      object: gdjs.RuntimeObject,
      track: CinematicTimelineIKTrack,
      value: CinematicTimelineIKValue
    ): void {
      if (!isIKTimelineRuntimeObject(object)) {
        return;
      }

      const chainName = this._ensureCinematicIKChain(state, object, track, value);
      object.setIKTargetPosition(
        chainName,
        value.target.x,
        value.target.y,
        value.target.z
      );
      object.setIKBlendFactor(chainName, value.weight);
      object.setIKEnabled(chainName, value.weight > 0.0001);
    }

    private _applyCinematicFrame(
      scene: CinematicTimelineScene,
      frame: number
    ): void {
      const state = this._cinematicTimelineState;
      if (!state) return;

      const targetContainer = this._getCinematicTimelineTargetContainer();
      if (!targetContainer) return;

      const allInstances = targetContainer.getAdhocListOfAllInstances();
      if (!allInstances.length) return;

      const objectsByName = new Map<string, gdjs.RuntimeObject>();
      const objectsById = new Map<number, gdjs.RuntimeObject>();
      const objectsByPersistentUuid = new Map<string, gdjs.RuntimeObject>();
      for (const object of allInstances) {
        if (!objectsByName.has(object.getName())) {
          objectsByName.set(object.getName(), object);
        }
        objectsById.set(object.id, object);
        if (object.persistentUuid) {
          objectsByPersistentUuid.set(object.persistentUuid, object);
        }
      }

      for (const track of scene.tracks) {
        if (!track.targetId) continue;
        const targetObject = this._resolveCinematicTrackTargetObject(
          track.targetId,
          objectsByName,
          objectsById,
          objectsByPersistentUuid
        );
        if (!targetObject) {
          if (!state.warnedMissingTargets.has(track.targetId)) {
            state.warnedMissingTargets.add(track.targetId);
            logger.warn(
              `CinematicTimeline: target "${track.targetId}" was not found in the active scene.`
            );
          }
          continue;
        }

        if (track.type === 'ik') {
          this._applyCinematicIKToObject(
            state,
            targetObject,
            track,
            this._evaluateIKTrackAtFrame(track, frame)
          );
        } else {
          this._applyCinematicTransformToObject(
            targetObject,
            this._evaluateTransformTrackAtFrame(track, frame)
          );
        }
      }
    }

    private _clearCinematicTimelineTimer(): void {
      if (!this._cinematicTimelineState || this._cinematicTimelineState.timerId === null)
        return;
      clearInterval(this._cinematicTimelineState.timerId);
      this._cinematicTimelineState.timerId = null;
    }

    private _tickCinematicTimeline(): void {
      const state = this._cinematicTimelineState;
      if (!state) return;

      const rangeInFrame = this._clampInteger(
        state.playbackRange.inFrame,
        0,
        state.scene.duration
      );
      const rangeOutFrame = this._clampInteger(
        state.playbackRange.outFrame,
        rangeInFrame,
        state.scene.duration
      );
      const elapsedSeconds = (performance.now() - state.startedAtMs) / 1000;
      const elapsedFrames = elapsedSeconds * state.scene.fps;
      const rawFrame = state.startedFromFrame + elapsedFrames;

      let nextFrame = rangeInFrame;
      if (state.loopPlayback) {
        const frameRange = Math.max(1, rangeOutFrame - rangeInFrame + 1);
        const wrappedFrame =
          ((rawFrame - rangeInFrame) % frameRange + frameRange) % frameRange;
        nextFrame = this._clampInteger(
          rangeInFrame + wrappedFrame,
          rangeInFrame,
          rangeOutFrame
        );
      } else {
        nextFrame = this._clampInteger(rawFrame, rangeInFrame, rangeOutFrame);
      }

      if (nextFrame === state.currentFrame) {
        if (!state.loopPlayback && nextFrame >= rangeOutFrame) {
          this._clearCinematicTimelineTimer();
        }
        return;
      }
      state.currentFrame = nextFrame;
      this._applyCinematicFrame(state.scene, nextFrame);

      if (!state.loopPlayback && nextFrame >= rangeOutFrame) {
        this._clearCinematicTimelineTimer();
      }
    }

    private _playCinematicTimeline(payload: CinematicTimelinePayload): void {
      const currentState = this._cinematicTimelineState;
      const scene =
        payload.scene || !currentState
          ? this._normalizeCinematicScene(payload)
          : currentState.scene;
      const fallbackRange =
        currentState && currentState.scene === scene
          ? currentState.playbackRange
          : this._getDefaultPlaybackRange(scene);
      const playbackRange = this._resolveCinematicPlaybackRange(
        scene,
        payload,
        fallbackRange
      );
      const requestedFrame =
        payload.frame === undefined
          ? currentState && currentState.scene === scene
            ? currentState.currentFrame
            : playbackRange.inFrame
          : this._normalizeCinematicFrame(payload.frame, scene.duration);
      const frame = this._clampInteger(
        requestedFrame,
        playbackRange.inFrame,
        playbackRange.outFrame
      );
      const loopPlayback =
        typeof payload.loopPlayback === 'boolean'
          ? payload.loopPlayback
          : scene.loopRange.enabled;

      this._clearCinematicTimelineTimer();
      this._cinematicTimelineState = {
        scene,
        currentFrame: frame,
        timerId: null,
        startedAtMs: performance.now(),
        startedFromFrame: frame,
        loopPlayback,
        playbackRange,
        activeShotId: '',
        configuredIKChains:
          currentState && currentState.scene === scene
            ? currentState.configuredIKChains
            : new Set<string>(),
        warnedMissingTargets:
          currentState && currentState.scene === scene
            ? currentState.warnedMissingTargets
            : new Set<string>(),
      };
      this._applyCinematicFrame(scene, frame);

      this._cinematicTimelineState.timerId = setInterval(() => {
        try {
          this._tickCinematicTimeline();
        } catch (error) {
          this._clearCinematicTimelineTimer();
          this.onUncaughtException(error as Error);
        }
      }, 16) as unknown as number;
    }

    private _playCinematicTimelineShot(payload: CinematicTimelinePayload): void {
      const currentState = this._cinematicTimelineState;
      const scene =
        payload.scene || !currentState
          ? this._normalizeCinematicScene(payload)
          : currentState.scene;
      const shot = this._resolveCinematicShot(scene, payload);
      if (!shot) {
        logger.warn('CinematicTimeline: requested shot was not found.');
        this._playCinematicTimeline(payload);
        return;
      }

      const playbackRange: CinematicTimelinePlaybackRange = {
        inFrame: shot.startFrame,
        outFrame: shot.endFrame,
      };
      const requestedFrame =
        payload.frame === undefined
          ? shot.startFrame
          : this._normalizeCinematicFrame(payload.frame, scene.duration);
      const frame = this._clampInteger(
        requestedFrame,
        playbackRange.inFrame,
        playbackRange.outFrame
      );
      const loopPlayback =
        typeof payload.loopPlayback === 'boolean' ? payload.loopPlayback : false;

      this._clearCinematicTimelineTimer();
      this._cinematicTimelineState = {
        scene,
        currentFrame: frame,
        timerId: null,
        startedAtMs: performance.now(),
        startedFromFrame: frame,
        loopPlayback,
        playbackRange,
        activeShotId: shot.id,
        configuredIKChains:
          currentState && currentState.scene === scene
            ? currentState.configuredIKChains
            : new Set<string>(),
        warnedMissingTargets:
          currentState && currentState.scene === scene
            ? currentState.warnedMissingTargets
            : new Set<string>(),
      };
      this._applyCinematicFrame(scene, frame);

      this._cinematicTimelineState.timerId = setInterval(() => {
        try {
          this._tickCinematicTimeline();
        } catch (error) {
          this._clearCinematicTimelineTimer();
          this.onUncaughtException(error as Error);
        }
      }, 16) as unknown as number;
    }

    private _pauseCinematicTimeline(payload: CinematicTimelinePayload): void {
      const currentState = this._cinematicTimelineState;
      if (!currentState) {
        if (payload.scene && typeof payload.scene === 'object') {
          this._setCinematicTimelineFrame(payload);
        }
        return;
      }

      const scene =
        payload.scene && typeof payload.scene === 'object'
          ? this._normalizeCinematicScene(payload)
          : currentState.scene;
      const fallbackRange =
        currentState.scene === scene
          ? currentState.playbackRange
          : this._getDefaultPlaybackRange(scene);
      const playbackRange = this._resolveCinematicPlaybackRange(
        scene,
        payload,
        fallbackRange
      );
      const requestedFrame =
        payload.frame === undefined
          ? currentState.currentFrame
          : this._normalizeCinematicFrame(payload.frame, scene.duration);
      const frame = this._clampInteger(
        requestedFrame,
        playbackRange.inFrame,
        playbackRange.outFrame
      );

      this._clearCinematicTimelineTimer();
      this._cinematicTimelineState = {
        scene,
        currentFrame: frame,
        timerId: null,
        startedAtMs: performance.now(),
        startedFromFrame: frame,
        loopPlayback:
          typeof payload.loopPlayback === 'boolean'
            ? payload.loopPlayback
            : currentState.loopPlayback,
        playbackRange,
        activeShotId:
          scene === currentState.scene ? currentState.activeShotId : '',
        configuredIKChains:
          scene === currentState.scene
            ? currentState.configuredIKChains
            : new Set<string>(),
        warnedMissingTargets:
          scene === currentState.scene
            ? currentState.warnedMissingTargets
            : new Set<string>(),
      };
      this._applyCinematicFrame(scene, frame);
    }

    private _setCinematicTimelineFrame(payload: CinematicTimelinePayload): void {
      const currentState = this._cinematicTimelineState;
      const scene =
        payload.scene || !currentState
          ? this._normalizeCinematicScene(payload)
          : currentState.scene;
      const playbackRange = this._resolveCinematicPlaybackRange(
        scene,
        payload,
        currentState && currentState.scene === scene
          ? currentState.playbackRange
          : this._getDefaultPlaybackRange(scene)
      );
      const requestedFrame =
        payload.frame === undefined
          ? currentState && currentState.scene === scene
            ? currentState.currentFrame
            : playbackRange.inFrame
          : this._normalizeCinematicFrame(payload.frame, scene.duration);
      const frame = this._clampInteger(
        requestedFrame,
        playbackRange.inFrame,
        playbackRange.outFrame
      );
      const selectedShot = this._resolveCinematicShot(scene, payload);

      this._clearCinematicTimelineTimer();
      this._cinematicTimelineState = {
        scene,
        currentFrame: frame,
        timerId: null,
        startedAtMs: performance.now(),
        startedFromFrame: frame,
        loopPlayback:
          typeof payload.loopPlayback === 'boolean'
            ? payload.loopPlayback
            : currentState
            ? currentState.loopPlayback
            : scene.loopRange.enabled,
        playbackRange,
        activeShotId:
          selectedShot?.id ||
          (currentState && currentState.scene === scene
            ? currentState.activeShotId
            : ''),
        configuredIKChains:
          currentState && currentState.scene === scene
            ? currentState.configuredIKChains
            : new Set<string>(),
        warnedMissingTargets:
          currentState && currentState.scene === scene
            ? currentState.warnedMissingTargets
            : new Set<string>(),
      };
      this._applyCinematicFrame(scene, frame);
    }

    private _stopCinematicTimeline(payload: CinematicTimelinePayload): void {
      const currentState = this._cinematicTimelineState;
      if (!currentState) return;

      this._clearCinematicTimelineTimer();
      if (payload && Object.keys(payload).length > 0) {
        const scene =
          payload.scene && typeof payload.scene === 'object'
            ? this._normalizeCinematicScene(payload)
            : currentState.scene;
        const playbackRange = this._resolveCinematicPlaybackRange(
          scene,
          payload,
          scene === currentState.scene
            ? currentState.playbackRange
            : this._getDefaultPlaybackRange(scene)
        );
        const requestedFrame =
          payload.frame === undefined
            ? playbackRange.inFrame
            : this._normalizeCinematicFrame(payload.frame, scene.duration);
        const frame = this._clampInteger(
          requestedFrame,
          playbackRange.inFrame,
          playbackRange.outFrame
        );
        this._cinematicTimelineState = {
          scene,
          currentFrame: frame,
          timerId: null,
          startedAtMs: performance.now(),
          startedFromFrame: frame,
          loopPlayback:
            typeof payload.loopPlayback === 'boolean'
              ? payload.loopPlayback
              : currentState.loopPlayback,
          playbackRange,
          activeShotId: '',
          configuredIKChains:
            scene === currentState.scene
              ? currentState.configuredIKChains
              : new Set<string>(),
          warnedMissingTargets:
            scene === currentState.scene
              ? currentState.warnedMissingTargets
              : new Set<string>(),
        };
        this._applyCinematicFrame(scene, frame);
      }
    }

    /**
     * Should be re-implemented by derived class to send a stringified message object
     * to the debugger server.
     * @param message
     */
    protected abstract _sendMessage(message: string): void;

    static isErrorComingFromJavaScriptCode(exception: Error | null): boolean {
      if (!exception || !exception.stack) return false;

      return exception.stack.includes('GDJSInlineCode');
    }

    async _reportCrash(exception: Error) {
      const gameCrashReport = buildGameCrashReport(
        exception,
        this._runtimegame
      );

      // Let a debugger server know about the crash.
      this._sendMessage(
        circularSafeStringify(
          {
            command: 'game.crashed',
            payload: gameCrashReport,
          },
          errorReplacer
        )
      );

      // Send the report to the APIs, if allowed.
      if (
        !this._runtimegame.getAdditionalOptions().crashReportUploadLevel ||
        this._runtimegame.getAdditionalOptions().crashReportUploadLevel ===
          'none' ||
        (this._runtimegame.getAdditionalOptions().crashReportUploadLevel ===
          'exclude-javascript-code-events' &&
          AbstractDebuggerClient.isErrorComingFromJavaScriptCode(exception))
      ) {
        return;
      }

      const rootApi = this._runtimegame.isUsingGDevelopDevelopmentEnvironment()
        ? 'https://api-dev.gdevelop.io'
        : 'https://api.gdevelop.io';
      const baseUrl = `${rootApi}/analytics`;

      try {
        await fetch(`${baseUrl}/game-crash-report`, {
          body: circularSafeStringify(gameCrashReport, errorReplacer),
          method: 'POST',
        });
      } catch (error) {
        logger.error('Error while sending the crash report:', error);
      }
    }

    onUncaughtException(exception: Error): void {
      logger.error('Uncaught exception: ', exception, exception.stack);

      const runtimeGame = this._runtimegame;
      if (!runtimeGame.isInGameEdition()) {
        this._inGameDebugger.setUncaughtException(exception);
      }

      if (!this._hasLoggedUncaughtException) {
        // Only log an uncaught exception once, to avoid spamming the debugger server
        // in case of an exception at each frame.
        this._hasLoggedUncaughtException = true;

        this._reportCrash(exception);
      }
    }

    /**
     * Send a message (a log) to debugger server.
     */
    log(
      group: string,
      message: string,
      type: 'info' | 'warning' | 'error',
      internal: boolean
    ) {
      this._sendMessage(
        JSON.stringify({
          command: 'console.log',
          payload: {
            message,
            type,
            group,
            internal,
            timestamp: performance.now(),
          },
        })
      );
    }

    /**
     * Update a value, specified by a path starting from the {@link RuntimeGame} instance.
     * @param path - The path to the variable, starting from {@link RuntimeGame}.
     * @param newValue - The new value.
     * @return Was the operation successful?
     */
    set(path: string[], newValue: any): boolean {
      if (!path || !path.length) {
        logger.warn('No path specified, set operation from debugger aborted');
        return false;
      }
      let object = this._runtimegame;
      let currentIndex = 0;
      while (currentIndex < path.length - 1) {
        const key = path[currentIndex];
        if (!object || !object[key]) {
          logger.error('Incorrect path specified. No ' + key + ' in ', object);
          return false;
        }
        object = object[key];
        currentIndex++;
      }

      // Ensure the newValue is properly typed to avoid breaking anything in
      // the game engine.
      const currentValue = object[path[currentIndex]];
      if (typeof currentValue === 'number') {
        newValue = parseFloat(newValue);
      } else {
        if (typeof currentValue === 'string') {
          newValue = '' + newValue;
        }
      }
      logger.log('Updating', path, 'to', newValue);
      object[path[currentIndex]] = newValue;
      return true;
    }

    /**
     * Call a method, specified by a path starting from the {@link RuntimeGame} instance.
     * @param path - The path to the method, starting from {@link RuntimeGame}.
     * @param args - The arguments to pass the method.
     * @return Was the operation successful?
     */
    call(path: string[], args: any[]): boolean {
      if (!path || !path.length) {
        logger.warn('No path specified, call operation from debugger aborted');
        return false;
      }
      let object = this._runtimegame;
      let currentIndex = 0;
      while (currentIndex < path.length - 1) {
        const key = path[currentIndex];
        if (!object || !object[key]) {
          logger.error('Incorrect path specified. No ' + key + ' in ', object);
          return false;
        }
        object = object[key];
        currentIndex++;
      }
      if (!object[path[currentIndex]]) {
        logger.error('Unable to call', path);
        return false;
      }
      logger.log('Calling', path, 'with', args);
      object[path[currentIndex]].apply(object, args);
      return true;
    }

    sendRuntimeGameStatus(): void {
      const currentScene = this._runtimegame.getSceneStack().getCurrentScene();
      this._sendMessage(
        circularSafeStringify({
          command: 'status',
          payload: {
            isPaused: this._runtimegame.isPaused(),
            isInGameEdition: this._runtimegame.isInGameEdition(),
            sceneName: currentScene ? currentScene.getName() : null,
          },
        })
      );
    }

    /**
     * Dump all the relevant data from the {@link RuntimeGame} instance and send it to the server.
     */
    sendRuntimeGameDump(): void {
      const that = this;
      const message = { command: 'dump', payload: this._runtimegame };
      const serializationStartTime = Date.now();

      // Stringify the message, excluding some known data that are big and/or not
      // useful for the debugger.
      const excludedValues = [that._runtimegame.getGameData()];
      const excludedKeys = [
        // Exclude reference to the debugger
        '_debuggerClient',
        // Exclude some RuntimeScene fields:
        '_allInstancesList',
        // Exclude circular references to parent runtimeGame or runtimeScene:
        '_runtimeGame',
        '_runtimeScene',
        // Exclude some runtimeObject duplicated data:
        '_behaviorsTable',
        // Exclude some objects data:
        '_animations',
        '_animationFrame',
        // Exclude linked objects to avoid too much repetitions:
        'linkedObjectsManager',
        // Could be improved by using private fields and excluding these (_)
        // Exclude some behaviors data:
        '_platformRBush',
        // PlatformBehavior
        'HSHG',
        // Pathfinding
        '_obstaclesHSHG',
        // Pathfinding
        'owner',
        // Avoid circular reference from behavior to parent runtimeObject
        // Exclude rendering related objects:
        '_renderer',
        '_gameRenderer',
        '_imageManager',
        '_rendererEffects',
        // Exclude PIXI textures:
        'baseTexture',
        '_baseTexture',
        '_invalidTexture',
      ];
      const stringifiedMessage = circularSafeStringify(
        message,
        function (key, value) {
          if (
            excludedValues.indexOf(value) !== -1 ||
            excludedKeys.indexOf(key) !== -1
          ) {
            return '[Removed from the debugger]';
          }
          return value;
        },
        /* Limit maximum depth to prevent any crashes */
        18
      );
      const serializationDuration = Date.now() - serializationStartTime;
      logger.log(
        'RuntimeGame serialization took ' + serializationDuration + 'ms'
      );
      if (serializationDuration > 500) {
        logger.warn(
          'Serialization took a long time: please check if there is a need to remove some objects from serialization'
        );
      }
      this._sendMessage(stringifiedMessage);
    }

    /**
     * Send logs from the hot reloader to the server.
     * @param logs The hot reloader logs.
     */
    sendHotReloaderLogs(logs: HotReloaderLog[]): void {
      this._sendMessage(
        circularSafeStringify({
          command: 'hotReloader.logs',
          payload: {
            isInGameEdition: this._runtimegame.isInGameEdition(),
            logs,
          },
        })
      );
    }

    /**
     * Callback called when profiling is starting.
     */
    sendProfilerStarted(): void {
      this._sendMessage(
        circularSafeStringify({
          command: 'profiler.started',
          payload: null,
        })
      );
    }

    /**
     * Callback called when profiling is ending.
     */
    sendProfilerStopped(): void {
      this._sendMessage(
        circularSafeStringify({
          command: 'profiler.stopped',
          payload: null,
        })
      );
    }

    sendInstanceChanges(changes: {
      isSendingBackSelectionForDefaultSize: boolean;
      updatedInstances: Array<InstanceData>;
      addedInstances: Array<InstanceData>;
      selectedInstances: Array<InstancePersistentUuidData>;
      removedInstances: Array<InstancePersistentUuidData>;
      objectNameToEdit: string | null;
    }): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'updateInstances',
          editorId: inGameEditor.getEditorId(),
          payload: changes,
        })
      );
    }

    sendObjectConfigurationChanges(changes: {
      objectName: string;
      updatedProperties: { [propertyName: string]: string };
    }): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'updateObjectConfiguration',
          editorId: inGameEditor.getEditorId(),
          payload: changes,
        })
      );
    }

    sendOpenContextMenu(cursorX: float, cursorY: float): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'openContextMenu',
          editorId: inGameEditor.getEditorId(),
          payload: { cursorX, cursorY },
        })
      );
    }

    sendCameraState(cameraState: EditorCameraState): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'setCameraState',
          editorId: inGameEditor.getEditorId(),
          payload: cameraState,
        })
      );
    }

    sendUndo(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'undo',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    sendRedo(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'redo',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    sendCopy(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'copy',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    sendPaste(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'paste',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    sendCut(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'cut',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    sendKeyboardShortcut(keyEventLike: {
      keyCode: number;
      metaKey: boolean;
      ctrlKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
    }): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'handleKeyboardShortcutFromInGameEditor',
          editorId: inGameEditor.getEditorId(),
          payload: keyEventLike,
        })
      );
    }

    sendSelectionAABB(messageId: number): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      const selectionAABB = inGameEditor.getSelectionAABB();
      this._sendMessage(
        circularSafeStringify({
          command: 'selectionAABB',
          editorId: inGameEditor.getEditorId(),
          messageId,
          payload: selectionAABB
            ? {
                minX: selectionAABB.min[0],
                minY: selectionAABB.min[1],
                minZ: selectionAABB.min[2],
                maxX: selectionAABB.max[0],
                maxY: selectionAABB.max[1],
                maxZ: selectionAABB.max[2],
              }
            : {
                minX: 0,
                minY: 0,
                minZ: 0,
                maxX: 0,
                maxY: 0,
                maxZ: 0,
              },
        })
      );
    }

    sendGraphicsContextLost(): void {
      const inGameEditor = this._runtimegame.getInGameEditor();
      if (!inGameEditor) {
        return;
      }
      this._sendMessage(
        circularSafeStringify({
          command: 'notifyGraphicsContextLost',
          editorId: inGameEditor.getEditorId(),
          payload: {},
        })
      );
    }

    /**
     * Send profiling results.
     * @param framesAverageMeasures The measures made for each frames.
     * @param stats Other measures done during the profiler run.
     */
    sendProfilerOutput(
      framesAverageMeasures: FrameMeasure,
      stats: ProfilerStats
    ): void {
      this._sendMessage(
        circularSafeStringify({
          command: 'profiler.output',
          payload: {
            framesAverageMeasures: framesAverageMeasures,
            stats: stats,
          },
        })
      );
    }

    launchHardReload(): void {
      try {
        const reloadUrl = new URL(location.href);

        // Construct the initial status to be restored.
        const initialRuntimeGameStatus =
          this._runtimegame.getAdditionalOptions().initialRuntimeGameStatus;
        // We use empty strings to avoid `null` to become `"null"`.
        const runtimeGameStatus: RuntimeGameStatus = {
          editorId: initialRuntimeGameStatus?.editorId || '',
          isPaused: this._runtimegame.isPaused(),
          isInGameEdition: this._runtimegame.isInGameEdition(),
          sceneName: initialRuntimeGameStatus?.sceneName || '',
          injectedExternalLayoutName:
            initialRuntimeGameStatus?.injectedExternalLayoutName || '',
          skipCreatingInstancesFromScene:
            initialRuntimeGameStatus?.skipCreatingInstancesFromScene || false,
          eventsBasedObjectType:
            initialRuntimeGameStatus?.eventsBasedObjectType || '',
          eventsBasedObjectVariantName:
            initialRuntimeGameStatus?.eventsBasedObjectVariantName || '',
          editorCamera3D: this._runtimegame.getInGameEditor()?.getCameraState(),
        };

        reloadUrl.searchParams.set(
          'runtimeGameStatus',
          JSON.stringify(runtimeGameStatus)
        );
        location.replace(reloadUrl);
      } catch (error) {
        logger.error(
          'Could not reload the game with the new initial status',
          error
        );
        location.reload();
      }
    }
  }
}
