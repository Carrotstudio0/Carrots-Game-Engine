namespace gdjs {
  const logger = new gdjs.Logger('PIXI game renderer');

  /**
   * Codes (as in `event.code`) of keys that should have their event `preventDefault`
   * called. This is used to avoid scrolling in a webpage when these keys are pressed
   * in the game.
   */
  const defaultPreventedKeyCodes = [
    37, // ArrowLeft
    38, // ArrowUp
    39, // ArrowRight
    40, // ArrowDown
  ];

  // Workaround for a macOS issue where "keyup" is not triggered when a key
  // is released while meta key is pressed.
  const keysPressedWithMetaPressedByCode = new Map<
    string,
    { keyCode: number; location: number }
  >();

  const isMacLike =
    typeof navigator !== 'undefined' &&
    navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)
      ? true
      : false;

  export type WebGLContextCompat =
    | WebGLRenderingContext
    | WebGL2RenderingContext;

  export type ThreeRendererCompat =
    | THREE.WebGLRenderer
    | (Record<string, any> & {
        isWebGPURenderer?: boolean;
        domElement?: HTMLCanvasElement;
        shadowMap?: {
          enabled?: boolean;
          type?: unknown;
        };
        xr?: {
          isPresenting?: boolean;
        };
        info?: {
          autoReset?: boolean;
          reset?: () => void;
        };
        setPixelRatio?: (pixelRatio: number) => void;
        getPixelRatio?: () => number;
        setSize?: (width: number, height: number) => void;
        setRenderTarget?: (...args: any[]) => void;
        clear?: () => void;
        clearDepth?: () => void;
        render?: (scene: THREE.Scene, camera: THREE.Camera) => void;
        setClearColor?: (color: number) => void;
        setScissorTest?: (enabled: boolean) => void;
        setViewport?: (
          x: number,
          y: number,
          width: number,
          height: number
        ) => void;
        dispose?: () => void;
        init?: () => Promise<void>;
        getContext?: () => unknown;
      })
    | null;

  export type Scene3DRenderContext = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  };

  type PixiRendererWithWebGLContext = PIXI.Renderer & {
    gl?: WebGLContextCompat | null;
    context?: {
      gl?: WebGLContextCompat | null;
    };
  };

  type PixiWebGLRendererCompat = PIXI.Renderer & {
    init: (options?: Record<string, unknown>) => Promise<void>;
  };

  type RenderingBackendType = 'webgl' | 'webgpu';
  type PixiRendererBackendType = RenderingBackendType | 'unknown';
  type PixiRendererTypeCompat = {
    WEBGL: number;
    WEBGPU: number;
  };
  type PixiAutoDetectCompat = typeof PIXI & {
    autoDetectRenderer?: (
      options?: Record<string, unknown>
    ) => Promise<PIXI.Renderer>;
    isWebGPUSupported?: (options?: Record<string, unknown>) => Promise<boolean>;
    RendererType?: PixiRendererTypeCompat;
  };

  type RuntimeGameWithThreeRenderer = {
    getRenderer?: () => {
      getThreeRenderer?: () => THREE.WebGLRenderer | null;
      getThreeRendererForRuntimeScene?: (
        runtimeScene?:
          | {
              getDedicatedThreeWebGPURequirementReason?: () => string | null;
              getLegacyCompositionRequirementReason?: () => string | null;
            }
          | null
      ) => THREE.WebGLRenderer | null;
    } | null;
  };

  type LayerRendererWithScene3DContext = {
    getThreeScene?: () => THREE.Scene | null;
    getThreeCamera?: () =>
      | THREE.PerspectiveCamera
      | THREE.OrthographicCamera
      | null;
  };

  const createPixiWebGLRenderer = (): PixiWebGLRendererCompat => {
    const pixiWithWebGLRenderer = PIXI as typeof PIXI & {
      WebGLRenderer: new () => PixiWebGLRendererCompat;
    };

    return new pixiWithWebGLRenderer.WebGLRenderer();
  };

  const getPixiRendererBackendType = (
    pixiRenderer: PIXI.Renderer | null
  ): PixiRendererBackendType => {
    if (!pixiRenderer) {
      return 'unknown';
    }

    const pixiWithRendererType = PIXI as PixiAutoDetectCompat;
    const rendererType = pixiWithRendererType.RendererType;
    if (!rendererType) {
      return 'unknown';
    }

    if (pixiRenderer.type === rendererType.WEBGPU) {
      return 'webgpu';
    }

    if (pixiRenderer.type === rendererType.WEBGL) {
      return 'webgl';
    }

    return 'unknown';
  };

  const isPixiWebGPUSupported = async (): Promise<boolean> => {
    const pixiWithWebGPU = PIXI as PixiAutoDetectCompat;
    if (typeof pixiWithWebGPU.isWebGPUSupported !== 'function') {
      return false;
    }

    try {
      return !!(await pixiWithWebGPU.isWebGPUSupported());
    } catch {
      return false;
    }
  };

  const createPixiRendererWithPreference = async (
    preference: RenderingBackendType,
    options: Record<string, unknown>
  ): Promise<PIXI.Renderer> => {
    const pixiWithAutoDetect = PIXI as PixiAutoDetectCompat;
    if (typeof pixiWithAutoDetect.autoDetectRenderer === 'function') {
      return await pixiWithAutoDetect.autoDetectRenderer({
        ...options,
        preference,
      });
    }

    const pixiRenderer = createPixiWebGLRenderer();
    await pixiRenderer.init(options);
    return pixiRenderer;
  };

  const disablePixiAccessibilitySupport = (
    pixiRenderer: PIXI.Renderer | null
  ): void => {
    if (!pixiRenderer) {
      return;
    }

    // Deactivating accessibility support in PixiJS renderer, as we want to be in control of this.
    // See https://github.com/pixijs/pixijs/issues/5111#issuecomment-420047824
    const pixiPlugins = (pixiRenderer as any).plugins;
    const accessibilityPlugin = pixiPlugins && pixiPlugins.accessibility;
    if (accessibilityPlugin && accessibilityPlugin.destroy) {
      accessibilityPlugin.destroy();
    }
    if (pixiPlugins && pixiPlugins.accessibility) {
      delete pixiPlugins.accessibility;
    }
  };

  export const getPixiRendererWebGLContext = (
    pixiRenderer: PIXI.Renderer | null
  ): WebGLContextCompat | null => {
    if (!pixiRenderer) {
      return null;
    }

    const rendererWithContext = pixiRenderer as PixiRendererWithWebGLContext;
    return rendererWithContext.gl || rendererWithContext.context?.gl || null;
  };

  export const areThreeAndPixiRenderersSharingWebGLContext = (
    threeRenderer: ThreeRendererCompat,
    pixiRenderer: PIXI.Renderer | null
  ): boolean => {
    if (!threeRenderer || !pixiRenderer) {
      return false;
    }

    const threeRendererWithContext = threeRenderer as Record<string, any>;
    const threeContext =
      typeof threeRendererWithContext.getContext === 'function'
        ? threeRendererWithContext.getContext()
        : null;
    const pixiContext = getPixiRendererWebGLContext(pixiRenderer);

    return !!threeContext && !!pixiContext && threeContext === pixiContext;
  };

  export const getThreeRendererFromRuntimeGame = (
    runtimeGame: gdjs.RuntimeGame | RuntimeGameWithThreeRenderer | null | undefined,
    runtimeScene?:
      | {
          getDedicatedThreeWebGPURequirementReason?: () => string | null;
          getLegacyCompositionRequirementReason?: () => string | null;
        }
      | null
  ): THREE.WebGLRenderer | null => {
    if (!runtimeGame || typeof runtimeGame.getRenderer !== 'function') {
      return null;
    }

    const gameRenderer = runtimeGame.getRenderer();
    if (!gameRenderer) {
      return null;
    }

    if (
      runtimeScene &&
      typeof gameRenderer.getThreeRendererForRuntimeScene === 'function'
    ) {
      return gameRenderer.getThreeRendererForRuntimeScene(runtimeScene);
    }

    if (typeof gameRenderer.getThreeRenderer !== 'function') {
      return null;
    }

    return gameRenderer.getThreeRenderer();
  };

  export const getThreeRendererFromEffectsTarget = (
    target: gdjs.EffectsTarget | null | undefined
  ): THREE.WebGLRenderer | null => {
    if (!target || typeof target.getRuntimeScene !== 'function') {
      return null;
    }

    const runtimeScene = target.getRuntimeScene();
    if (!runtimeScene || typeof runtimeScene.getGame !== 'function') {
      return null;
    }

    return gdjs.getThreeRendererFromRuntimeGame(
      runtimeScene.getGame(),
      runtimeScene as any
    );
  };

  export const getScene3DRenderContextForLayer = (
    layer: gdjs.Layer | null | undefined
  ): Scene3DRenderContext | null => {
    if (!layer) {
      return null;
    }

    const renderer = gdjs.getThreeRendererFromEffectsTarget(layer);
    if (!renderer) {
      return null;
    }

    const layerRenderer = layer.getRenderer() as LayerRendererWithScene3DContext;
    if (
      !layerRenderer ||
      typeof layerRenderer.getThreeScene !== 'function' ||
      typeof layerRenderer.getThreeCamera !== 'function'
    ) {
      return null;
    }

    const scene = layerRenderer.getThreeScene();
    const camera = layerRenderer.getThreeCamera();
    if (!scene || !camera) {
      return null;
    }

    return {
      renderer,
      scene,
      camera,
    };
  };

  export const setThreeRendererPhysicallyCorrectLights = (
    renderer: ThreeRendererCompat,
    enabled: boolean
  ): boolean => {
    if (!renderer) {
      return false;
    }

    const rendererWithLightingMode = renderer as Record<string, any> & {
      physicallyCorrectLights?: boolean;
    };
    if (typeof rendererWithLightingMode.physicallyCorrectLights !== 'boolean') {
      return false;
    }

    if (rendererWithLightingMode.physicallyCorrectLights !== enabled) {
      rendererWithLightingMode.physicallyCorrectLights = enabled;
    }

    return true;
  };

  export const ensureThreeRendererOutputColorSpace = (
    renderer: ThreeRendererCompat
  ): boolean => {
    if (!renderer) {
      return false;
    }

    const rendererWithColorSpace = renderer as Record<string, any> & {
      outputColorSpace?: unknown;
      outputEncoding?: unknown;
    };
    if ('outputColorSpace' in rendererWithColorSpace) {
      rendererWithColorSpace.outputColorSpace = (THREE as any).SRGBColorSpace;
      return true;
    }
    if (
      'outputEncoding' in rendererWithColorSpace &&
      (THREE as any).sRGBEncoding !== undefined
    ) {
      (rendererWithColorSpace as any).outputEncoding =
        (THREE as any).sRGBEncoding;
      return true;
    }

    return false;
  };

  export const applyThreeRendererToneMapping = (
    renderer: ThreeRendererCompat,
    toneMapping: THREE.ToneMapping,
    exposure: number
  ): boolean => {
    if (!renderer) {
      return false;
    }

    const rendererWithToneMapping = renderer as Record<string, any> & {
      toneMapping?: THREE.ToneMapping;
      toneMappingExposure?: number;
    };
    if (
      typeof rendererWithToneMapping.toneMapping !== 'number' ||
      typeof rendererWithToneMapping.toneMappingExposure !== 'number'
    ) {
      return false;
    }

    rendererWithToneMapping.toneMapping = toneMapping;
    rendererWithToneMapping.toneMappingExposure = Math.max(0, exposure);
    gdjs.ensureThreeRendererOutputColorSpace(renderer);
    return true;
  };

  export const disableThreeRendererToneMapping = (
    renderer: ThreeRendererCompat
  ): boolean => {
    if (!renderer) {
      return false;
    }

    const rendererWithToneMapping = renderer as Record<string, any> & {
      toneMapping?: THREE.ToneMapping;
    };
    if (typeof rendererWithToneMapping.toneMapping !== 'number') {
      return false;
    }

    rendererWithToneMapping.toneMapping = THREE.NoToneMapping;
    return true;
  };

  export const resetThreeRendererState = (
    renderer: ThreeRendererCompat
  ): void => {
    const rendererWithCompatReset = renderer as Record<string, any> | null;
    if (typeof rendererWithCompatReset?.resetState === 'function') {
      rendererWithCompatReset.resetState();
    }
  };

  export const getThreeRendererBackendType = (
    renderer: ThreeRendererCompat
  ): 'webgl' | 'webgpu' | 'unknown' => {
    if (!renderer) {
      return 'unknown';
    }

    return (renderer as Record<string, any>).isWebGPURenderer ? 'webgpu' : 'webgl';
  };

  /**
   * The renderer for a gdjs.RuntimeGame using Pixi.js.
   * @category Renderers > Game
   */
  export class RuntimeGamePixiRenderer {
    _game: gdjs.RuntimeGame;
    _isFullPage: boolean = true;

    //Used to track if the canvas is displayed on the full page.
    _isFullscreen: boolean = false;

    //Used to track if the window is displayed as fullscreen (see setFullscreen method).
    _forceFullscreen: any;

    private _pointerLockReasons: Set<string> = new Set();

    _pixiRenderer: PIXI.Renderer | null = null;
    private _threeRenderer: THREE.WebGLRenderer | null = null;
    private _dedicatedThreeWebGpuRenderer: ThreeRendererCompat = null;
    private _dedicatedThreeWebGpuCanvas: HTMLCanvasElement | null = null;
    private _dedicatedThreeWebGpuIssue: string | null = null;
    private _legacyPixiRenderer: PIXI.Renderer | null = null;
    private _legacyRenderingCanvas: HTMLCanvasElement | null = null;
    private _gameCanvas: HTMLCanvasElement | null = null;
    private _domElementsContainer: HTMLDivElement | null = null;
    private _requestedRenderingBackend: RenderingBackendType = 'webgl';
    private _activeRenderingBackend: RenderingBackendType = 'webgl';
    private _renderingBackendFallbackIssue: string | null = null;
    private _hybridRenderingIssue: string | null = null;

    // Current width of the canvas (might be scaled down/up compared to renderer)
    _canvasWidth: float = 0;
    // Current height of the canvas (might be scaled down/up compared to renderer)
    _canvasHeight: float = 0;

    _keepRatio: boolean = true;
    _marginLeft: any;
    _marginTop: any;
    _marginRight: any;
    _marginBottom: any;

    _nextFrameId: integer = 0;

    _wasDisposed: boolean = false;
    private _renderersInitializationPromise: Promise<void> | null = null;

    /**
     * @param game The game that is being rendered
     * @param forceFullscreen If fullscreen should be always activated
     */
    constructor(game: gdjs.RuntimeGame, forceFullscreen: boolean) {
      this._game = game;
      this._forceFullscreen = forceFullscreen;

      //If set to true, the canvas will always be displayed as fullscreen, even if _isFullscreen == false.
      this._marginLeft =
        this._marginTop =
        this._marginRight =
        this._marginBottom =
          0;
      this._setupOrientation();
    }

    /**
     * Create the canvas on which the game will be rendered, inside the specified DOM element, and
     * setup the rendering of the game.
     * If you want to use your own canvas, use `initializeRenderers` and `initializeCanvas` instead.
     *
     * @param parentElement The parent element to which the canvas will be added.
     */
    async createStandardCanvas(parentElement: HTMLElement): Promise<void> {
      this._throwIfDisposed();

      const gameCanvas = document.createElement('canvas');
      parentElement.appendChild(gameCanvas);

      this.initializeCanvas(gameCanvas);
      await this.initializeRenderers(gameCanvas);
      // Ensure proper sizing once renderers are ready.
      this._resizeCanvas();
    }

    /**
     * Set up the rendering of the game for the given canvas.
     *
     * In most cases, you can use `createStandardCanvas` instead to initialize the game.
     */
    async initializeRenderers(gameCanvas: HTMLCanvasElement): Promise<void> {
      this._throwIfDisposed();
      if (this._renderersInitializationPromise) {
        return this._renderersInitializationPromise;
      }

      this._renderersInitializationPromise = this._initializeRenderers(
        gameCanvas
      ).catch((error) => {
        this._renderersInitializationPromise = null;
        throw error;
      });
      return this._renderersInitializationPromise;
    }

    private _createPixiInitOptions(
      gameCanvas: HTMLCanvasElement
    ): Record<string, unknown> & {
      stencil: boolean;
    } {
      return {
        width: this._game.getGameResolutionWidth(),
        height: this._game.getGameResolutionHeight(),
        canvas: gameCanvas,
        preserveDrawingBuffer: true,
        antialias: false,
        stencil: true,
        backgroundAlpha: 0,
        manageImports: false,
      };
    }

    private async _initializeStandalonePixiRenderer(
      gameCanvas: HTMLCanvasElement,
      preference: RenderingBackendType
    ): Promise<void> {
      const pixiInitOptions = this._createPixiInitOptions(gameCanvas);
      const webGpuWasSupported =
        preference === 'webgpu' ? await isPixiWebGPUSupported() : false;
      const pixiRenderer = await createPixiRendererWithPreference(
        preference,
        pixiInitOptions
      );

      this._pixiRenderer = pixiRenderer;
      this._threeRenderer = null;

      const detectedBackend = getPixiRendererBackendType(pixiRenderer);
      if (detectedBackend === 'unknown') {
        this._pixiRenderer.destroy();
        this._pixiRenderer = null;
        throw new Error(
          'Only WebGL and WebGPU PixiJS renderer backends are supported by this runtime.'
        );
      }

      this._activeRenderingBackend = detectedBackend;
      if (preference === 'webgpu' && detectedBackend !== 'webgpu') {
        this._renderingBackendFallbackIssue =
          this._renderingBackendFallbackIssue ||
          (webGpuWasSupported
            ? 'PixiJS could not keep the WebGPU backend during initialization and fell back to WebGL.'
            : 'WebGPU is not available in this environment. Falling back to WebGL.');
      } else if (preference === 'webgl' && detectedBackend !== 'webgl') {
        this._renderingBackendFallbackIssue =
          this._renderingBackendFallbackIssue ||
          'PixiJS could not initialize the requested WebGL backend.';
      }
    }

    private async _createSharedWebGLRendererPair(
      rendererCanvas: HTMLCanvasElement
    ): Promise<{
      pixiRenderer: PIXI.Renderer;
      threeRenderer: THREE.WebGLRenderer;
    }> {
      const threeRenderer = new THREE.WebGLRenderer({
        canvas: rendererCanvas,
        antialias:
          this._game.getAntialiasingMode() !== 'none' &&
          (this._game.isAntialisingEnabledOnMobile() ||
            !gdjs.evtTools.common.isMobile()),
        stencil: true,
        preserveDrawingBuffer: true, // Keep to true to allow screenshots.
      });
      threeRenderer.shadowMap.enabled = true;
      threeRenderer.shadowMap.type = gdjs.getPreferredThreeShadowMapType(
        threeRenderer,
        'generic'
      ) as any;
      gdjs.ensureThreeRendererOutputColorSpace(threeRenderer);
      gdjs.applyThreeRendererToneMapping(
        threeRenderer,
        typeof (THREE as any).AgXToneMapping === 'number'
          ? (THREE as any).AgXToneMapping
          : THREE.ACESFilmicToneMapping,
        1
      );
      threeRenderer.autoClear = false;
      threeRenderer.setPixelRatio(window.devicePixelRatio);
      threeRenderer.setSize(
        this._game.getGameResolutionWidth(),
        this._game.getGameResolutionHeight()
      );

      // Create a PixiJS renderer that uses the same GL context as Three.js
      // so that both can render to the same canvas and share render textures when needed.
      const pixiRenderer = createPixiWebGLRenderer();
      const pixiInitOptions: Record<string, unknown> & {
        stencil: boolean;
      } = {
        ...this._createPixiInitOptions(rendererCanvas),
        context: threeRenderer.getContext() as unknown as WebGL2RenderingContext,
        clearBeforeRender: false,
        // TODO (3D): add a setting for pixel ratio (`resolution: window.devicePixelRatio`)
      };
      // @ts-ignore - Pixi v8 requires async init. Reuse Three.js context.
      await pixiRenderer.init(pixiInitOptions);

      return { pixiRenderer, threeRenderer };
    }

    private async _initializeSharedWebGLRenderers(
      gameCanvas: HTMLCanvasElement
    ): Promise<void> {
      const { pixiRenderer, threeRenderer } =
        await this._createSharedWebGLRendererPair(gameCanvas);
      this._pixiRenderer = pixiRenderer;
      this._threeRenderer = threeRenderer;
      this._activeRenderingBackend = 'webgl';
    }

    private async _initializeLegacyWebGLRenderers(): Promise<void> {
      const legacyCanvas = document.createElement('canvas');
      const { pixiRenderer, threeRenderer } =
        await this._createSharedWebGLRendererPair(legacyCanvas);
      this._legacyRenderingCanvas = legacyCanvas;
      this._legacyPixiRenderer = pixiRenderer;
      this._threeRenderer = threeRenderer;
    }

    private _disposeDedicatedThreeWebGpuRenderer(): void {
      const dedicatedRenderer = this._dedicatedThreeWebGpuRenderer as
        | (Record<string, any> & {
            dispose?: () => void;
          })
        | null;
      try {
        dedicatedRenderer?.dispose?.();
      } catch (error) {
        console.warn('Three.js WebGPU: disposing the dedicated renderer failed.', error);
      }

      if (this._dedicatedThreeWebGpuCanvas?.parentNode) {
        this._dedicatedThreeWebGpuCanvas.parentNode.removeChild(
          this._dedicatedThreeWebGpuCanvas
        );
      }

      this._dedicatedThreeWebGpuRenderer = null;
      this._dedicatedThreeWebGpuCanvas = null;
    }

    private _synchronizeDedicatedThreeWebGpuCanvas(): void {
      if (!this._dedicatedThreeWebGpuCanvas || !this._gameCanvas) {
        return;
      }

      this._dedicatedThreeWebGpuCanvas.style.position = 'absolute';
      this._dedicatedThreeWebGpuCanvas.style.pointerEvents = 'none';
      this._dedicatedThreeWebGpuCanvas.style.left = this._gameCanvas.style.left;
      this._dedicatedThreeWebGpuCanvas.style.top = this._gameCanvas.style.top;
      this._dedicatedThreeWebGpuCanvas.style.width = this._gameCanvas.style.width;
      this._dedicatedThreeWebGpuCanvas.style.height = this._gameCanvas.style.height;
    }

    setDedicatedThreeWebGPUCanvasVisible(visible: boolean): void {
      if (!this._dedicatedThreeWebGpuCanvas) {
        return;
      }

      this._dedicatedThreeWebGpuCanvas.style.display = visible ? 'block' : 'none';
    }

    private async _initializeDedicatedThreeWebGpuRenderer(
      gameCanvas: HTMLCanvasElement
    ): Promise<void> {
      this._disposeDedicatedThreeWebGpuRenderer();
      this._dedicatedThreeWebGpuIssue = null;

      const threeWebGpuApi = typeof THREE_WEBGPU !== 'undefined'
        ? (THREE_WEBGPU as any)
        : null;
      if (!threeWebGpuApi || typeof threeWebGpuApi.WebGPURenderer !== 'function') {
        this._dedicatedThreeWebGpuIssue =
          'Three.js WebGPU bundle is not available in this runtime.';
        return;
      }
      if (
        typeof navigator === 'undefined' ||
        !(navigator as Navigator & { gpu?: GPU }).gpu
      ) {
        this._dedicatedThreeWebGpuIssue =
          'WebGPU is not available in this environment for the dedicated Three.js runtime.';
        return;
      }

      const dedicatedCanvas = document.createElement('canvas');
      dedicatedCanvas.style.position = 'absolute';
      dedicatedCanvas.style.pointerEvents = 'none';
      dedicatedCanvas.style.display = 'none';
      dedicatedCanvas.style.background = 'transparent';
      gameCanvas.parentNode?.insertBefore(dedicatedCanvas, gameCanvas);

      try {
        const dedicatedRenderer = new threeWebGpuApi.WebGPURenderer({
          canvas: dedicatedCanvas,
          antialias:
            this._game.getAntialiasingMode() !== 'none' &&
            (this._game.isAntialisingEnabledOnMobile() ||
              !gdjs.evtTools.common.isMobile()),
          alpha: true,
          preserveDrawingBuffer: true,
        }) as ThreeRendererCompat;
        const dedicatedRendererWithCompat = dedicatedRenderer as Record<string, any>;

        if (typeof dedicatedRendererWithCompat.init === 'function') {
          await dedicatedRendererWithCompat.init();
        }
        if (dedicatedRendererWithCompat.shadowMap) {
          dedicatedRendererWithCompat.shadowMap.enabled = true;
          dedicatedRendererWithCompat.shadowMap.type =
            gdjs.getPreferredThreeShadowMapType(dedicatedRenderer, 'generic');
        }
        gdjs.ensureThreeRendererOutputColorSpace(dedicatedRenderer);
        gdjs.applyThreeRendererToneMapping(
          dedicatedRenderer,
          typeof (THREE as any).AgXToneMapping === 'number'
            ? (THREE as any).AgXToneMapping
            : THREE.ACESFilmicToneMapping,
          1
        );
        if (typeof dedicatedRendererWithCompat.setPixelRatio === 'function') {
          dedicatedRendererWithCompat.setPixelRatio(window.devicePixelRatio);
        }
        if (typeof dedicatedRendererWithCompat.setSize === 'function') {
          dedicatedRendererWithCompat.setSize(
            this._game.getGameResolutionWidth(),
            this._game.getGameResolutionHeight()
          );
        }
        if ('autoClear' in dedicatedRendererWithCompat) {
          dedicatedRendererWithCompat.autoClear = false;
        }

        this._dedicatedThreeWebGpuCanvas = dedicatedCanvas;
        this._dedicatedThreeWebGpuRenderer = dedicatedRenderer;
        this._synchronizeDedicatedThreeWebGpuCanvas();
      } catch (error) {
        this._dedicatedThreeWebGpuIssue =
          'Three.js WebGPU dedicated runtime failed to initialize.';
        this._disposeDedicatedThreeWebGpuRenderer();
        console.warn(
          'Three.js WebGPU: dedicated runtime initialization failed, falling back to the existing renderer paths.',
          error
        );
      }
    }

    private async _initializeRenderers(
      gameCanvas: HTMLCanvasElement
    ): Promise<void> {
      this._throwIfDisposed();

      this._requestedRenderingBackend = this._game.getRenderingBackend();
      this._activeRenderingBackend = 'webgl';
      this._renderingBackendFallbackIssue = null;
      this._hybridRenderingIssue = null;
      this._dedicatedThreeWebGpuIssue = null;
      this._legacyPixiRenderer = null;
      this._legacyRenderingCanvas = null;

      const sharedWebGLRendererRequirementReason =
        this._game.getSharedWebGLRendererRequirementReason();
      const canInitializeLegacyThreeWebGLPath =
        !!sharedWebGLRendererRequirementReason && typeof THREE !== 'undefined';
      const shouldTryHybridWebGPUComposition =
        this._requestedRenderingBackend === 'webgpu' &&
        canInitializeLegacyThreeWebGLPath;

      if (
        sharedWebGLRendererRequirementReason &&
        typeof THREE === 'undefined' &&
        !this._renderingBackendFallbackIssue
      ) {
        this._renderingBackendFallbackIssue = `${sharedWebGLRendererRequirementReason} Three.js is not available in this runtime, so only the standalone Pixi renderer can be initialized.`;
      }

      if (shouldTryHybridWebGPUComposition) {
        const webGpuWasSupported = await isPixiWebGPUSupported();
        if (webGpuWasSupported) {
          await this._initializeStandalonePixiRenderer(gameCanvas, 'webgpu');
          const activeBackendAfterStandaloneInitialization =
            this.getActiveRenderingBackend();
          if (activeBackendAfterStandaloneInitialization === 'webgpu') {
            await this._initializeLegacyWebGLRenderers();
            this._hybridRenderingIssue = `${sharedWebGLRendererRequirementReason} Rendering will use isolated legacy Three.js/WebGL composition for affected scenes while presenting through WebGPU.`;
          } else {
            this._pixiRenderer?.destroy();
            this._pixiRenderer = null;
            this._renderingBackendFallbackIssue =
              `${sharedWebGLRendererRequirementReason} PixiJS could not keep the WebGPU backend, so the runtime fell back to the shared WebGL renderer backend.`;
            await this._initializeSharedWebGLRenderers(gameCanvas);
          }
        } else {
          this._renderingBackendFallbackIssue =
            `${sharedWebGLRendererRequirementReason} WebGPU is not available in this environment, so the runtime fell back to the shared WebGL renderer backend.`;
          await this._initializeSharedWebGLRenderers(gameCanvas);
        }
      } else if (canInitializeLegacyThreeWebGLPath) {
        await this._initializeSharedWebGLRenderers(gameCanvas);
      } else {
        const preferredBackend: RenderingBackendType =
          this._requestedRenderingBackend === 'webgpu' &&
          !sharedWebGLRendererRequirementReason
            ? 'webgpu'
            : 'webgl';
        await this._initializeStandalonePixiRenderer(
          gameCanvas,
          preferredBackend
        );
      }

      if (!this._pixiRenderer) {
        return;
      }

      if (
        this._requestedRenderingBackend !== this._activeRenderingBackend &&
        this._renderingBackendFallbackIssue
      ) {
        console.warn(
          `Rendering backend: ${this._renderingBackendFallbackIssue}`
        );
      }
      if (this._hybridRenderingIssue) {
        console.info(`Rendering backend: ${this._hybridRenderingIssue}`);
      }

      if (this.usesWebGPUBackend()) {
        await this._initializeDedicatedThreeWebGpuRenderer(gameCanvas);
      } else {
        this._disposeDedicatedThreeWebGpuRenderer();
      }

      if (this._game.isFsrEnabled()) {
        const fsrSupportIssue = this.getFsrSupportIssue();
        if (fsrSupportIssue) {
          this._game.disableFsrForSession(fsrSupportIssue);
        }
      }

      disablePixiAccessibilitySupport(this._pixiRenderer);
      disablePixiAccessibilitySupport(this._legacyPixiRenderer);
    }

    /**
     * Set up the game canvas so that it covers the size required by the game
     * and has a container for DOM elements required by the game.
     */
    initializeCanvas(gameCanvas: HTMLCanvasElement): void {
      // Add the renderer view element to the DOM
      this._gameCanvas = gameCanvas;

      gameCanvas.style.position = 'absolute';

      // Ensure that the canvas has the focus.
      gameCanvas.tabIndex = 1;

      // Ensure long press can't create a selection
      gameCanvas.style.userSelect = 'none';
      gameCanvas.style.outline = 'none'; // No selection/focus ring on the canvas.

      // Set up the container for HTML elements on top of the game canvas.
      const domElementsContainer = document.createElement('div');
      domElementsContainer.style.position = 'absolute';
      domElementsContainer.style.overflow = 'hidden'; // Never show anything outside the container.
      domElementsContainer.style.outline = 'none'; // No selection/focus ring on this container.
      domElementsContainer.style.pointerEvents = 'none'; // Clicks go through the container.

      // The container should *never* scroll.
      // Elements are put inside with the same coordinates (with a scaling factor)
      // as on the game canvas.
      domElementsContainer.addEventListener('scroll', (event) => {
        domElementsContainer.scrollLeft = 0;
        domElementsContainer.scrollTop = 0;
        event.preventDefault();
      });

      // When clicking outside an input, (or other HTML element),
      // give back focus to the game canvas so that this element is blurred.
      gameCanvas.addEventListener('pointerdown', () => {
        gameCanvas.focus();
      });

      // Prevent magnifying glass on iOS with a long press.
      // Note that there are related bugs on iOS 15 (see https://bugs.webkit.org/show_bug.cgi?id=231161)
      // but it seems not to affect us as the `domElementsContainer` has `pointerEvents` set to `none`.
      domElementsContainer.style['-webkit-user-select'] = 'none';

      gameCanvas.parentNode?.appendChild(domElementsContainer);
      this._domElementsContainer = domElementsContainer;

      this._resizeCanvas();

      // Handle scale mode.
      if (this._game.getScaleMode() === 'nearest') {
        gameCanvas.style['image-rendering'] = '-moz-crisp-edges';
        gameCanvas.style['image-rendering'] = '-webkit-optimize-contrast';
        gameCanvas.style['image-rendering'] = '-webkit-crisp-edges';
        gameCanvas.style['image-rendering'] = 'pixelated';
      }

      // Handle pixels rounding.
      if (this._game.getPixelsRounding()) {
        const pixiWithCompat = PIXI as typeof PIXI & {
          AbstractRenderer?: {
            defaultOptions?: {
              roundPixels?: boolean;
            };
          };
          settings?: {
            ROUND_PIXELS?: boolean;
          };
        };
        if (pixiWithCompat.AbstractRenderer?.defaultOptions) {
          pixiWithCompat.AbstractRenderer.defaultOptions.roundPixels = true;
        } else if (pixiWithCompat.settings) {
          pixiWithCompat.settings.ROUND_PIXELS = true;
        }
      }

      // Handle resize: immediately adjust the game canvas (and dom element container)
      // and notify the game (that may want to adjust to the new size of the window).
      window.addEventListener('resize', () => {
        this._game.onWindowInnerSizeChanged();
        this._resizeCanvas();
      });

      // Focus the canvas when created.
      gameCanvas.focus();
    }

    static getWindowInnerWidth() {
      return typeof window !== 'undefined' ? window.innerWidth : 800;
    }

    static getWindowInnerHeight() {
      return typeof window !== 'undefined' ? window.innerHeight : 800;
    }

    /**
     * Update the game renderer size according to the "game resolution".
     * Called when game resolution changes.
     *
     * Note that if the canvas is fullscreen, it won't be resized, but when going back to
     * non fullscreen mode, the requested size will be used.
     */
    updateRendererSize(): void {
      this._resizeCanvas();
    }

    /**
     * Set the proper screen orientation from the project properties.
     */
    private _setupOrientation() {
      if (
        typeof window === 'undefined' ||
        !window.screen ||
        !window.screen.orientation
      ) {
        return;
      }
      const gameOrientation = this._game.getGameData().properties.orientation;
      try {
        // We ignore the error as some platforms may not supporting locking (i.e: desktop).
        if (gameOrientation === 'default') {
          const promise = window.screen.orientation.unlock();
          // @ts-ignore
          if (promise) {
            // @ts-ignore
            promise.catch(() => {});
          }
        } else {
          // @ts-ignore
          window.screen.orientation.lock(gameOrientation).catch(() => {});
        }
      } catch (error) {
        logger.error('Unexpected error while setting up orientation: ', error);
      }
    }

    /**
     * Resize the renderer (the "game resolution") and the canvas (which can be larger
     * or smaller to fill the page, with optional margins).
     *
     */
    private _resizeCanvas() {
      if (!this._pixiRenderer || !this._domElementsContainer) return;

      // Set the Pixi (and/or Three) renderer size to the game size.
      // There is no "smart" resizing to be done here: the rendering of the game
      // should be done with the size set on the game.
      if (
        this._pixiRenderer.width !== this._game.getGameResolutionWidth() ||
        this._pixiRenderer.height !== this._game.getGameResolutionHeight()
      ) {
        // TODO (3D): It might be useful to resize pixi view in 3D depending on FOV value
        // to enable a mode where pixi always fills the whole screen.
        this._pixiRenderer.resize(
          this._game.getGameResolutionWidth(),
          this._game.getGameResolutionHeight()
        );

        if (this._threeRenderer) {
          this._threeRenderer.setSize(
            this._game.getGameResolutionWidth(),
            this._game.getGameResolutionHeight()
          );
        }
        if (this._legacyPixiRenderer) {
          this._legacyPixiRenderer.resize(
            this._game.getGameResolutionWidth(),
            this._game.getGameResolutionHeight()
          );
        }
        if (
          this._dedicatedThreeWebGpuRenderer &&
          typeof (this._dedicatedThreeWebGpuRenderer as Record<string, any>)
            .setSize === 'function'
        ) {
          (this._dedicatedThreeWebGpuRenderer as Record<string, any>).setSize(
            this._game.getGameResolutionWidth(),
            this._game.getGameResolutionHeight()
          );
        }
      }

      // Set the canvas size.
      // Resizing is done according to the settings. This is a "CSS" resize
      // only, so won't create visual artifacts during the rendering.
      const isFullPage =
        this._forceFullscreen || this._isFullPage || this._isFullscreen;
      let canvasWidth = this._game.getGameResolutionWidth();
      let canvasHeight = this._game.getGameResolutionHeight();
      let maxWidth = window.innerWidth - this._marginLeft - this._marginRight;
      let maxHeight = window.innerHeight - this._marginTop - this._marginBottom;
      if (maxWidth < 0) {
        maxWidth = 0;
      }
      if (maxHeight < 0) {
        maxHeight = 0;
      }
      if (isFullPage && !this._keepRatio) {
        canvasWidth = maxWidth;
        canvasHeight = maxHeight;
      } else if (
        (isFullPage && this._keepRatio) ||
        canvasWidth > maxWidth ||
        canvasHeight > maxHeight
      ) {
        let factor = maxWidth / canvasWidth;
        if (canvasHeight * factor > maxHeight) {
          factor = maxHeight / canvasHeight;
        }
        canvasWidth *= factor;
        canvasHeight *= factor;
      }

      // Apply the calculations to the canvas element...
      if (this._gameCanvas) {
        this._gameCanvas.style.top =
          this._marginTop + (maxHeight - canvasHeight) / 2 + 'px';
        this._gameCanvas.style.left =
          this._marginLeft + (maxWidth - canvasWidth) / 2 + 'px';
        this._gameCanvas.style.width = canvasWidth + 'px';
        this._gameCanvas.style.height = canvasHeight + 'px';
      }

      // ...and to the div on top of it showing DOM elements (like inputs).
      this._domElementsContainer.style.top =
        this._marginTop + (maxHeight - canvasHeight) / 2 + 'px';
      this._domElementsContainer.style.left =
        this._marginLeft + (maxWidth - canvasWidth) / 2 + 'px';
      this._domElementsContainer.style.width = canvasWidth + 'px';
      this._domElementsContainer.style.height = canvasHeight + 'px';

      // Store the canvas size for fast access to it.
      this._canvasWidth = canvasWidth;
      this._canvasHeight = canvasHeight;
      this._synchronizeDedicatedThreeWebGpuCanvas();
    }

    /**
     * Set if the aspect ratio must be kept when the game canvas is resized to fill
     * the page.
     */
    keepAspectRatio(enable) {
      if (this._keepRatio === enable) {
        return;
      }
      this._keepRatio = enable;
      this._resizeCanvas();
    }

    /**
     * Change the margin that must be preserved around the game canvas.
     */
    setMargins(top, right, bottom, left): void {
      this._throwIfDisposed();
      if (
        this._marginTop === top &&
        this._marginRight === right &&
        this._marginBottom === bottom &&
        this._marginLeft === left
      ) {
        return;
      }
      this._marginTop = top;
      this._marginRight = right;
      this._marginBottom = bottom;
      this._marginLeft = left;
      this._resizeCanvas();
    }

    /**
     * Update the window size, if possible.
     * @param width The new width, in pixels.
     * @param height The new height, in pixels.
     */
    setWindowSize(width: float, height: float): void {
      this._throwIfDisposed();
      const remote = this.getElectronRemote();
      if (remote) {
        const browserWindow = remote.getCurrentWindow();
        try {
          if (browserWindow) {
            browserWindow.setContentSize(width, height);
          }
        } catch (error) {
          logger.error(
            `Window size setting to width ${width} and height ${height} failed. See error:`,
            error
          );
        }
      } else {
        logger.warn("Window size can't be changed on this platform.");
      }
    }

    /**
     * Center the window on screen.
     */
    centerWindow() {
      this._throwIfDisposed();
      const remote = this.getElectronRemote();
      if (remote) {
        const browserWindow = remote.getCurrentWindow();
        try {
          if (browserWindow) {
            browserWindow.center();
          }
        } catch (error) {
          logger.error('Window centering failed. See error:', error);
        }
      } else {
        logger.warn("Window can't be centered on this platform.");
      }
    }

    /**
     * De/activate fullscreen for the game.
     */
    setFullScreen(enable): void {
      this._throwIfDisposed();
      if (this._forceFullscreen) {
        return;
      }
      if (this._isFullscreen !== enable) {
        this._isFullscreen = !!enable;
        const remote = this.getElectronRemote();
        if (remote) {
          const browserWindow = remote.getCurrentWindow();
          try {
            if (browserWindow) {
              browserWindow.setFullScreen(this._isFullscreen);
            }
          } catch (error) {
            logger.error(
              `Full screen setting to ${this._isFullscreen} failed. See error:`,
              error
            );
          }
        } else {
          // Use HTML5 Fullscreen API
          //TODO: Do this on a user gesture, otherwise most browsers won't activate fullscreen
          if (this._isFullscreen) {
            // @ts-ignore
            if (document.documentElement.requestFullscreen) {
              // @ts-ignore
              document.documentElement.requestFullscreen();
            } else {
              // @ts-ignore
              if (document.documentElement.mozRequestFullScreen) {
                // @ts-ignore
                document.documentElement.mozRequestFullScreen();
              } else {
                // @ts-ignore
                if (document.documentElement.webkitRequestFullScreen) {
                  // @ts-ignore
                  document.documentElement.webkitRequestFullScreen();
                }
              }
            }
          } else {
            // @ts-ignore
            if (document.exitFullscreen) {
              // @ts-ignore
              document.exitFullscreen();
            } else {
              // @ts-ignore
              if (document.mozCancelFullScreen) {
                // @ts-ignore
                document.mozCancelFullScreen();
              } else {
                // @ts-ignore
                if (document.webkitCancelFullScreen) {
                  // @ts-ignore
                  document.webkitCancelFullScreen();
                }
              }
            }
          }
        }
        this._resizeCanvas();
      }
    }

    /**
     * Checks if the game is in full screen.
     */
    isFullScreen(): boolean {
      const remote = this.getElectronRemote();
      if (remote) {
        try {
          return remote.getCurrentWindow().isFullScreen();
        } catch (error) {
          logger.error(`Full screen detection failed. See error:`, error);
          return false;
        }
      }

      // Height check is used to detect user triggered full screen (for example F11 shortcut).
      return this._isFullscreen || window.screen.height === window.innerHeight;
    }

    /**
     * Request pointer lock for the game.
     * Mouse cursor will disappear and its movement will be captured by the game,
     * and can be read with the input manager of the game.
     *
     * @param reason The reason (arbitrary string) for the pointer lock request.
     * This allows multiple parts of the game to request pointer lock for different reasons.
     * @returns true if the request was initiated, false otherwise.
     */
    requestPointerLock(reason: string): boolean {
      if (!this._gameCanvas) {
        return false;
      }

      // Ensure we don't request pointer lock in a loop for the same reason.
      if (this._pointerLockReasons.has(reason)) {
        return false;
      }

      this._pointerLockReasons.add(reason);
      try {
        this._gameCanvas.requestPointerLock();
        return true;
      } catch (error) {
        logger.error('Failed to request pointer lock:', error);
        return false;
      }
    }

    /**
     * Exit pointer lock.
     * Pointer lock will be dismissed if no other part of the game is requesting it.
     *
     * @param reason The reason (arbitrary string) to dismiss.
     */
    exitPointerLock(reason: string): void {
      this._pointerLockReasons.delete(reason);
      if (document.pointerLockElement && this._pointerLockReasons.size === 0) {
        document.exitPointerLock();
      }
    }

    /**
     * Check if pointer is currently locked.
     *
     * @returns true if pointer is locked, false otherwise.
     */
    isPointerLocked(): boolean {
      return document.pointerLockElement === this._gameCanvas;
    }

    /**
     * Convert a point from the canvas coordinates to the dom element container coordinates.
     *
     * @param canvasCoords The point in the canvas coordinates.
     * @param result The point to return.
     * @returns The point in the dom element container coordinates.
     */
    convertCanvasToDomElementContainerCoords(
      canvasCoords: FloatPoint,
      result: FloatPoint
    ): FloatPoint {
      const pageCoords = result || [0, 0];

      // Handle the fact that the game is stretched to fill the canvas.
      pageCoords[0] =
        (canvasCoords[0] * this._canvasWidth) /
        this._game.getGameResolutionWidth();
      pageCoords[1] =
        (canvasCoords[1] * this._canvasHeight) /
        this._game.getGameResolutionHeight();

      return pageCoords;
    }

    /**
     * Return the scale factor between the renderer height and the actual canvas height,
     * which is also the height of the container for DOM elements to be superimposed on top of it.
     *
     * Useful to scale font sizes of DOM elements so that they follow the size of the game.
     */
    getCanvasToDomElementContainerHeightScale(): float {
      return (this._canvasHeight || 1) / this._game.getGameResolutionHeight();
    }

    /**
     * Translate an event position (mouse or touch) made on the canvas
     * on the page (or even outside the canvas) to game coordinates.
     */
    convertPageToGameCoords(pageX: float, pageY: float) {
      const canvas = this._gameCanvas;
      if (!canvas) return [0, 0];

      const pos = [pageX - canvas.offsetLeft, pageY - canvas.offsetTop];

      // Handle the fact that the game is stretched to fill the canvas.
      pos[0] *= this._game.getGameResolutionWidth() / (this._canvasWidth || 1);
      pos[1] *=
        this._game.getGameResolutionHeight() / (this._canvasHeight || 1);
      return pos;
    }

    /**
     * Add the standard events handler.
     *
     * The game canvas must have been initialized before calling this.
     */
    bindStandardEvents(
      manager: gdjs.InputManager,
      window: Window,
      document: Document
    ) {
      this._throwIfDisposed();
      const canvas = this._gameCanvas;
      if (!canvas) return;

      const isInsideCanvas = (e: MouseEvent | Touch) => {
        const x = e.pageX - canvas.offsetLeft;
        const y = e.pageY - canvas.offsetTop;

        return (
          0 <= x &&
          x < (this._canvasWidth || 1) &&
          0 <= y &&
          y < (this._canvasHeight || 1)
        );
      };

      // Some browsers lacks definition of some variables used to do calculations
      // in convertPageToGameCoords. They are defined to 0 as they are useless.

      (function ensureOffsetsExistence() {
        if (isNaN(canvas.offsetLeft)) {
          // @ts-ignore
          canvas.offsetLeft = 0;
          // @ts-ignore
          canvas.offsetTop = 0;
        }
        if (isNaN(document.body.scrollLeft)) {
          document.body.scrollLeft = 0;
          document.body.scrollTop = 0;
        }
        if (
          document.documentElement === undefined ||
          document.documentElement === null
        ) {
          // @ts-ignore
          document.documentElement = {};
        }
        if (isNaN(document.documentElement.scrollLeft)) {
          document.documentElement.scrollLeft = 0;
          document.documentElement.scrollTop = 0;
        }
        if (isNaN(canvas.offsetLeft)) {
          // @ts-ignore
          canvas.offsetLeft = 0;
          // @ts-ignore
          canvas.offsetTop = 0;
        }
      })();

      // Keyboard: listen at the document level to capture even when the canvas
      // is not focused.

      const isFocusingDomElement = () => {
        // Fast bailout when the game canvas should receive the inputs (i.e: almost always).
        // Also check the document body or null for activeElement, as all of these should go
        // to the game.
        if (
          document.activeElement === canvas ||
          document.activeElement === document.body ||
          document.activeElement === null
        )
          return false;

        return true;
      };
      const isTargetDomElement = (event: TouchEvent) => {
        // Fast bailout when the game canvas should receive the inputs (i.e: almost always).
        // Any event with a target that is not the body or the canvas should
        // not go to the game (<input> or <a> elements for instances).
        if (event.target === canvas || event.target === document.body)
          return false;
        return true;
      };
      document.onkeydown = (e) => {
        if (isFocusingDomElement()) {
          // Bail out if the game canvas is not focused. For example,
          // an `<input>` element can be focused, and needs to receive
          // arrow keys events.
          return;
        }

        // See reason for this workaround in the "keyup" event handler.
        if (isMacLike) {
          if (e.code !== 'MetaLeft' && e.code !== 'MetaRight') {
            if (e.metaKey) {
              keysPressedWithMetaPressedByCode.set(e.code, {
                keyCode: e.keyCode,
                location: e.location,
              });
            } else {
              keysPressedWithMetaPressedByCode.delete(e.code);
            }
          }
        }

        if (defaultPreventedKeyCodes.includes(e.keyCode)) {
          // Some keys are "default prevented" to avoid scrolling when the game
          // is integrated in a page as an iframe.
          e.preventDefault();
        }

        if (this._game.isInGameEdition()) {
          // When in in-game edition, prevent all the keys to have their default behavior
          // so that the shortcuts are all handled by the editor (apart from OS-level shortcuts).
          e.preventDefault();
        }

        if (e.repeat) {
          // If `repeat` is true, this is not the first press of the key.
          // We only communicate the changes of states ("first" key down, key up)
          // to the manager, which then tracks the state of the key:
          // pressed, just pressed or released.
          return;
        }

        manager.onKeyPressed(e.keyCode, e.location);
      };
      document.onkeyup = (e) => {
        if (isFocusingDomElement()) {
          // Bail out if the game canvas is not focused. For example,
          // an `<input>` element can be focused, and needs to receive
          // arrow keys events.
          return;
        }

        if (isMacLike) {
          if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
            // Meta key is released. On macOS, a key pressed in combination with meta key, and
            // which has been released while meta is pressed, will not trigger a "keyup" event.
            // This means the key would be considered as "stuck" from the game's perspective
            // it would never be released unless it's pressed and released again (without meta).
            // Out of caution, we simulate a release of the key that were pressed with meta key.
            for (const {
              location,
              keyCode,
            } of keysPressedWithMetaPressedByCode.values()) {
              manager.onKeyReleased(keyCode, location);
            }
            keysPressedWithMetaPressedByCode.clear();
          }
        }

        if (this._game.isInGameEdition()) {
          // When in in-game edition, prevent all the keys to have their default behavior
          // so that the shortcuts are all handled by the editor (apart from OS-level shortcuts).
          e.preventDefault();
        }

        if (defaultPreventedKeyCodes.includes(e.keyCode)) {
          // Some keys are "default prevented" to avoid scrolling when the game
          // is integrated in a page as an iframe.
          e.preventDefault();
        }

        manager.onKeyReleased(e.keyCode, e.location);
      };

      // Mouse:

      // Converts HTML mouse button to InputManager mouse button.
      // This function is used to align HTML button values with GDevelop 3 C++ SFML Mouse button enum values,
      // notably the middle and right buttons.
      function convertHtmlMouseButtonToInputManagerMouseButton(button: number) {
        switch (button) {
          case 1: // Middle button
            return gdjs.InputManager.MOUSE_MIDDLE_BUTTON;
          case 2: // Right button
            return gdjs.InputManager.MOUSE_RIGHT_BUTTON;
        }
        return button;
      }
      canvas.onmousemove = (e) => {
        const pos = this.convertPageToGameCoords(e.pageX, e.pageY);
        manager.onMouseMove(pos[0], pos[1], {
          movementX: e.movementX,
          movementY: e.movementY,
        });
      };
      canvas.onmousedown = (e) => {
        const pos = this.convertPageToGameCoords(e.pageX, e.pageY);
        manager.onMouseMove(pos[0], pos[1]);
        manager.onMouseButtonPressed(
          convertHtmlMouseButtonToInputManagerMouseButton(e.button)
        );
        if (window.focus !== undefined) {
          window.focus();
        }
        return false;
      };
      canvas.onmouseup = function (e) {
        manager.onMouseButtonReleased(
          convertHtmlMouseButtonToInputManagerMouseButton(e.button)
        );
        return false;
      };
      canvas.onmouseleave = function (e) {
        manager.onMouseLeave();
      };
      canvas.onmouseenter = function (e) {
        manager.onMouseEnter();
        // There is no mouse event when the cursor is outside of the canvas.
        // We catchup what happened.
        const buttons = [
          gdjs.InputManager.MOUSE_LEFT_BUTTON,
          gdjs.InputManager.MOUSE_RIGHT_BUTTON,
          gdjs.InputManager.MOUSE_MIDDLE_BUTTON,
          gdjs.InputManager.MOUSE_BACK_BUTTON,
          gdjs.InputManager.MOUSE_FORWARD_BUTTON,
        ];
        for (let i = 0, len = buttons.length; i < len; ++i) {
          const button = buttons[i];
          const buttonIsPressed = (e.buttons & (1 << i)) !== 0;
          const buttonWasPressed = manager.isMouseButtonPressed(button);
          if (buttonIsPressed && !buttonWasPressed) {
            manager.onMouseButtonPressed(button);
          } else if (!buttonIsPressed && buttonWasPressed) {
            manager.onMouseButtonReleased(button);
          }
        }
      };
      window.addEventListener(
        'click',
        function (e) {
          if (window.focus !== undefined) {
            window.focus();
          }
          return false;
        },
        false
      );
      canvas.oncontextmenu = function (event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      };
      // @ts-ignore
      canvas.onwheel = function (event) {
        manager.onMouseWheel(-event.deltaY, event.deltaX, event.deltaZ);
      };

      // Touches:
      window.addEventListener(
        'touchmove',
        (e) => {
          if (isTargetDomElement(e)) {
            // Bail out if the game canvas is not focused. For example,
            // an `<input>` element can be focused, and needs to receive
            // touch events to move the selection (and do other native gestures).
            return;
          }

          e.preventDefault();
          if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; ++i) {
              const touch = e.changedTouches[i];
              const pos = this.convertPageToGameCoords(
                touch.pageX,
                touch.pageY
              );
              manager.onTouchMove(touch.identifier, pos[0], pos[1]);
              manager.onTouchMove(touch.identifier, pos[0], pos[1]);
              // This works because touch events are sent
              // when they continue outside of the canvas.
              if (manager.isSimulatingMouseWithTouch()) {
                if (isInsideCanvas(touch)) {
                  manager.onMouseEnter();
                } else {
                  manager.onMouseLeave();
                }
              }
            }
          }
        },
        // This is important so that we can use e.preventDefault() and block possible following mouse events.
        { passive: false }
      );
      window.addEventListener(
        'touchstart',
        (e) => {
          if (isTargetDomElement(e)) {
            // Bail out if the game canvas is not focused. For example,
            // an `<input>` element can be focused, and needs to receive
            // touch events to move the selection (and do other native gestures).
            return;
          }

          e.preventDefault();
          if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; ++i) {
              const touch = e.changedTouches[i];
              const pos = this.convertPageToGameCoords(
                touch.pageX,
                touch.pageY
              );
              manager.onTouchStart(
                e.changedTouches[i].identifier,
                pos[0],
                pos[1]
              );
            }
          }
          return false;
        },
        // This is important so that we can use e.preventDefault() and block possible following mouse events.
        { passive: false }
      );
      window.addEventListener(
        'touchend',
        function (e) {
          if (isTargetDomElement(e)) {
            // Bail out if the game canvas is not focused. For example,
            // an `<input>` element can be focused, and needs to receive
            // touch events to move the selection (and do other native gestures).
            return;
          }

          e.preventDefault();
          if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; ++i) {
              manager.onTouchEnd(e.changedTouches[i].identifier);
            }
          }
          return false;
        },
        // This is important so that we can use e.preventDefault() and block possible following mouse events.
        { passive: false }
      );
      window.addEventListener(
        'touchcancel',
        function (e) {
          if (isTargetDomElement(e)) {
            // Bail out if the game canvas is not focused. For example,
            // an `<input>` element can be focused, and needs to receive
            // touch events to move the selection (and do other native gestures).
            return;
          }

          e.preventDefault();
          if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; ++i) {
              manager.onTouchCancel(e.changedTouches[i].identifier);
            }
          }
          return false;
        },
        // This is important so that we can use e.preventDefault() and block possible following mouse events.
        { passive: false }
      );
    }

    setWindowTitle(title): void {
      if (typeof document !== 'undefined') {
        document.title = title;
      }
    }

    getWindowTitle() {
      return typeof document !== 'undefined' ? document.title : '';
    }

    startGameLoop(fn) {
      this._throwIfDisposed();
      let oldTime = 0;
      const gameLoop = (time: float) => {
        // Schedule the next frame now to be sure it's called as soon
        // as possible after this one is finished.
        this._nextFrameId = requestAnimationFrame(gameLoop);

        const dt = oldTime ? time - oldTime : 0;
        oldTime = time;
        if (!fn(dt)) {
          // Stop the game loop if requested.
          cancelAnimationFrame(this._nextFrameId);
        }
      };

      requestAnimationFrame(gameLoop);
    }

    stopGameLoop(): void {
      cancelAnimationFrame(this._nextFrameId);
    }

    getPIXIRenderer() {
      return this._pixiRenderer;
    }

    getLegacyPIXIWebGLRenderer(): PIXI.Renderer | null {
      return this._legacyPixiRenderer;
    }

    getLegacyRenderingCanvas(): HTMLCanvasElement | null {
      return this._legacyRenderingCanvas;
    }

    /**
     * Get the Three.js renderer for the game - if any.
     */
    getThreeRenderer(): THREE.WebGLRenderer | null {
      return (this._dedicatedThreeWebGpuRenderer ||
        this._threeRenderer) as THREE.WebGLRenderer | null;
    }

    hasThreeRenderer(): boolean {
      return !!this._dedicatedThreeWebGpuRenderer || !!this._threeRenderer;
    }

    getRequestedRenderingBackend(): RenderingBackendType {
      return this._requestedRenderingBackend;
    }

    getActiveRenderingBackend(): RenderingBackendType {
      return this._activeRenderingBackend;
    }

    usesWebGPUBackend(): boolean {
      return this._activeRenderingBackend === 'webgpu';
    }

    getRenderingBackendFallbackIssue(): string | null {
      return this._renderingBackendFallbackIssue;
    }

    getHybridRenderingIssue(): string | null {
      return this._hybridRenderingIssue;
    }

    getDedicatedThreeWebGPUIssue(): string | null {
      return this._dedicatedThreeWebGpuIssue;
    }

    hasDedicatedThreeWebGPURenderer(): boolean {
      return !!this._dedicatedThreeWebGpuRenderer && !!this._dedicatedThreeWebGpuCanvas;
    }

    usesHybridWebGPUComposition(): boolean {
      return (
        this.usesWebGPUBackend() &&
        !!this._legacyPixiRenderer &&
        !!this._legacyRenderingCanvas &&
        !!this._threeRenderer
      );
    }

    shouldRenderRuntimeSceneWithDedicatedThreeWebGPU(
      runtimeScene:
        | {
            getDedicatedThreeWebGPURequirementReason?: () => string | null;
          }
        | null
        | undefined
    ): boolean {
      if (!this.usesWebGPUBackend() || !this.hasDedicatedThreeWebGPURenderer()) {
        return false;
      }

      if (this._game.isFsrEnabled()) {
        return false;
      }

      return !runtimeScene?.getDedicatedThreeWebGPURequirementReason?.();
    }

    shouldRenderRuntimeSceneWithLegacyComposition(
      runtimeScene:
        | {
            getLegacyCompositionRequirementReason?: () => string | null;
            getDedicatedThreeWebGPURequirementReason?: () => string | null;
          }
        | null
        | undefined
    ): boolean {
      if (this.shouldRenderRuntimeSceneWithDedicatedThreeWebGPU(runtimeScene)) {
        return false;
      }

      if (!this.usesHybridWebGPUComposition()) {
        return false;
      }

      if (this._game.isFsrEnabled()) {
        return true;
      }

      return !!runtimeScene?.getLegacyCompositionRequirementReason?.();
    }

    getPixiRendererForRuntimeScene(
      runtimeScene:
        | {
            getLegacyCompositionRequirementReason?: () => string | null;
            getDedicatedThreeWebGPURequirementReason?: () => string | null;
          }
        | null
        | undefined
    ): PIXI.Renderer | null {
      if (
        this.shouldRenderRuntimeSceneWithLegacyComposition(runtimeScene) &&
        this._legacyPixiRenderer
      ) {
        return this._legacyPixiRenderer;
      }

      return this._pixiRenderer;
    }

    getThreeRendererForRuntimeScene(
      runtimeScene:
        | {
            getLegacyCompositionRequirementReason?: () => string | null;
            getDedicatedThreeWebGPURequirementReason?: () => string | null;
          }
        | null
        | undefined
    ): THREE.WebGLRenderer | null {
      if (this.shouldRenderRuntimeSceneWithDedicatedThreeWebGPU(runtimeScene)) {
        return this._dedicatedThreeWebGpuRenderer as THREE.WebGLRenderer | null;
      }

      if (this._activeRenderingBackend === 'webgl') {
        return this._threeRenderer;
      }

      if (this.shouldRenderRuntimeSceneWithLegacyComposition(runtimeScene)) {
        return this._threeRenderer;
      }

      return null;
    }

    private _getThreePixiInteropRenderer(): PIXI.Renderer | null {
      return this._legacyPixiRenderer || this._pixiRenderer;
    }

    supportsThreePixiSharedContextInterop(): boolean {
      return gdjs.areThreeAndPixiRenderersSharingWebGLContext(
        this._threeRenderer,
        this._getThreePixiInteropRenderer()
      );
    }

    supportsThreeWebGL2(): boolean {
      return !!this._threeRenderer && this._threeRenderer.capabilities.isWebGL2;
    }

    getThreePixiInteropIssue(): string | null {
      if (this.usesWebGPUBackend() && !this.usesHybridWebGPUComposition()) {
        return 'Active renderer backend is WebGPU, so shared Three.js/Pixi WebGL interop is unavailable.';
      }
      if (!this._threeRenderer) {
        return 'Three.js renderer is not initialized';
      }
      const interopPixiRenderer = this._getThreePixiInteropRenderer();
      if (!interopPixiRenderer) {
        return 'PixiJS renderer is not initialized';
      }
      if (
        !gdjs.areThreeAndPixiRenderersSharingWebGLContext(
          this._threeRenderer,
          interopPixiRenderer
        )
      ) {
        return 'Shared Three.js/Pixi WebGL context not available';
      }
      return null;
    }

    getFsrSupportIssue(): string | null {
      const threePixiInteropIssue = this.getThreePixiInteropIssue();
      if (threePixiInteropIssue) {
        return threePixiInteropIssue;
      }
      if (!this.supportsThreeWebGL2()) {
        return 'WebGL2 not supported';
      }
      return null;
    }

    supportsFsrRendering(): boolean {
      return !this.getFsrSupportIssue();
    }

    /**
     * Get the pixel ratio used by the renderer (defaults to 1).
     */
    getPixelRatio(): float {
      if (
        this._dedicatedThreeWebGpuRenderer &&
        typeof (this._dedicatedThreeWebGpuRenderer as Record<string, any>)
          .getPixelRatio === 'function'
      ) {
        return (this._dedicatedThreeWebGpuRenderer as Record<string, any>).getPixelRatio();
      }
      if (this._threeRenderer) {
        return this._threeRenderer.getPixelRatio();
      }
      if (this._pixiRenderer) {
        return this._pixiRenderer.resolution;
      }
      return 1;
    }

    /**
     * Get the DOM element used as a container for HTML elements to display
     * on top of the game.
     */
    getDomElementContainer() {
      return this._domElementsContainer;
    }

    /**
     * Open the given URL in the system browser (or a new tab)
     */
    openURL(url: string) {
      // Try to detect the environment to use the most adapted
      // way of opening an URL.

      if (typeof window !== 'undefined') {
        const electron = this.getElectron();
        if (electron) {
          electron.shell.openExternal(url);
        } else if (
          // @ts-ignore
          typeof window.cordova !== 'undefined' &&
          // @ts-ignore
          typeof window.cordova.InAppBrowser !== 'undefined'
        ) {
          // @ts-ignore
          window.cordova.InAppBrowser.open(url, '_system', 'location=yes');
        } else {
          window.open(url, '_blank');
        }
      }
    }

    /**
     * Close the game, if applicable.
     */
    stopGame() {
      // Try to detect the environment to use the most adapted
      // way of closing the app
      const remote = this.getElectronRemote();
      if (remote) {
        const browserWindow = remote.getCurrentWindow();
        if (browserWindow) {
          try {
            browserWindow.close();
          } catch (error) {
            logger.error('Window closing failed. See error:', error);
          }
        }
      } else {
        if (
          typeof navigator !== 'undefined' &&
          // @ts-ignore
          navigator.app &&
          // @ts-ignore
          navigator.app.exitApp
        ) {
          // @ts-ignore
          navigator.app.exitApp();
        }
      }
      // HTML5 games on mobile/browsers don't have a way to close their window/page.
    }

    /**
     * Dispose the renderers (PixiJS and/or Three.js) as well as DOM elements
     * used for the game (the canvas, if specified, and the additional DOM container
     * created on top of it to allow display HTML elements, for example for text inputs).
     *
     * @param removeCanvas If true, the canvas will be removed from the DOM.
     */
    dispose(removeCanvas?: boolean) {
      this._pixiRenderer?.destroy();
      this._legacyPixiRenderer?.destroy();
      this._threeRenderer?.dispose();
      this._disposeDedicatedThreeWebGpuRenderer();
      this._pixiRenderer = null;
      this._legacyPixiRenderer = null;
      this._threeRenderer = null;
      this._dedicatedThreeWebGpuIssue = null;
      this._renderingBackendFallbackIssue = null;
      this._hybridRenderingIssue = null;
      this._legacyRenderingCanvas = null;

      if (removeCanvas && this._gameCanvas) {
        this._gameCanvas.parentNode?.removeChild(this._gameCanvas);
      }

      this._gameCanvas = null;
      this._domElementsContainer?.parentNode?.removeChild(
        this._domElementsContainer
      );
      this._domElementsContainer = null;
      this._wasDisposed = true;
    }

    /**
     * Get the canvas DOM element.
     */
    getCanvas(): HTMLCanvasElement | null {
      return this._gameCanvas;
    }

    /**
     * Check if the device supports WebGL.
     * @returns true if WebGL is supported
     */
    isWebGLSupported(): boolean {
      return (
        !!this._pixiRenderer &&
        this._pixiRenderer.type === PIXI.RendererType.WEBGL
      ) || !!this._legacyPixiRenderer;
    }

    /**
     * Get the electron module, if running as a electron renderer process.
     */
    getElectron() {
      if (typeof require === 'function') {
        return require('electron');
      }
      return null;
    }

    /**
     * Helper to get the electron remote module, if running on Electron.
     * Note that is not guaranteed to be supported in the future - avoid if possible.
     */
    getElectronRemote = () => {
      if (typeof require === 'function') {
        const runtimeGameOptions = this._game.getAdditionalOptions();
        const moduleId =
          runtimeGameOptions && runtimeGameOptions.electronRemoteRequirePath
            ? runtimeGameOptions.electronRemoteRequirePath
            : '@electron/remote';

        try {
          return require(moduleId);
        } catch (requireError) {
          console.error(
            `Could not load @electron/remote from "${moduleId}". Error is:`,
            requireError
          );
        }
      }

      return null;
    };

    getGame() {
      return this._game;
    }

    private _throwIfDisposed(): void {
      if (this._wasDisposed) {
        throw 'The RuntimeGameRenderer has been disposed and should not be used anymore.';
      }
    }
  }

  //Register the class to let the engine use it.
  /** @category Renderers > Game */
  export type RuntimeGameRenderer = RuntimeGamePixiRenderer;
  /** @category Renderers > Game */
  export const RuntimeGameRenderer = RuntimeGamePixiRenderer;
}
