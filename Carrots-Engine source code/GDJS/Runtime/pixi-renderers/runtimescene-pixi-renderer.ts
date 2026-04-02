namespace gdjs {
  const resetPixiRendererState = (pixiRenderer: PIXI.Renderer): void => {
    const rendererWithCompatReset = pixiRenderer as PIXI.Renderer & {
      reset?: () => void;
      resetState?: () => void;
    };
    if (rendererWithCompatReset.reset) {
      rendererWithCompatReset.reset();
      return;
    }
    if (rendererWithCompatReset.resetState) {
      rendererWithCompatReset.resetState();
    }
  };

  const updatePixiTextureSource = (texture: PIXI.Texture | null): void => {
    if (!texture) {
      return;
    }

    const textureWithCompat = texture as PIXI.Texture & {
      source?: {
        update?: () => void;
      } | null;
      baseTexture?: {
        update?: () => void;
      } | null;
      update?: () => void;
    };

    textureWithCompat.source?.update?.();
    textureWithCompat.baseTexture?.update?.();
    textureWithCompat.update?.();
  };

  /**
   * The renderer for a gdjs.RuntimeScene using Pixi.js.
   * @category Renderers > Scene
   */
  export class RuntimeScenePixiRenderer
    implements gdjs.RuntimeInstanceContainerPixiRenderer
  {
    private _runtimeGameRenderer: gdjs.RuntimeGamePixiRenderer | null;
    private _runtimeScene: gdjs.RuntimeScene;
    private _pixiContainer: PIXI.Container;
    private _profilerText: PIXI.Text | null = null;
    private _showCursorAtNextRender: boolean = false;
    private _threeRenderer: THREE.WebGLRenderer | null = null;
    private _hybridPresentationContainer: PIXI.Container | null = null;
    private _hybridPresentationSprite: PIXI.Sprite | null = null;
    private _hybridPresentationTexture: PIXI.Texture | null = null;
    private _layerRenderingMetrics: {
      rendered2DLayersCount: number;
      rendered3DLayersCount: number;
    } = {
      rendered2DLayersCount: 0,
      rendered3DLayersCount: 0,
    };
    private _backgroundColor: THREE.Color | null = null;
    private _fsrPass: gdjs.Fsr1Pass | null = null;
    private _fsrLowResTarget: THREE.WebGLRenderTarget | null = null;
    private _fsrCopyScene: THREE.Scene | null = null;
    private _fsrCopyCamera: THREE.OrthographicCamera | null = null;
    private _fsrCopyMesh: THREE.Mesh | null = null;
    private _fsrCopyMaterial: THREE.MeshBasicMaterial | null = null;
    private _fsrLowResWidth: integer = 0;
    private _fsrLowResHeight: integer = 0;
    private _fsrOutputWidth: integer = 0;
    private _fsrOutputHeight: integer = 0;
    private _dedicatedThreeWebGpuRequirementOverride: string | null = null;

    constructor(
      runtimeScene: gdjs.RuntimeScene,
      runtimeGameRenderer: gdjs.RuntimeGamePixiRenderer | null
    ) {
      this._runtimeGameRenderer = runtimeGameRenderer;
      this._runtimeScene = runtimeScene;
      this._pixiContainer = new PIXI.Container();

      // Contains the layers of the scene (and, optionally, debug PIXI objects).
      this._pixiContainer.sortableChildren = true;

      this._threeRenderer = this._runtimeGameRenderer
        ? this._runtimeGameRenderer.getThreeRendererForRuntimeScene(
            this._runtimeScene
          )
        : null;
    }

    onGameResolutionResized() {
      const pixiRenderer = this._runtimeGameRenderer
        ? this._runtimeGameRenderer.getPixiRendererForRuntimeScene(
            this._runtimeScene
          )
        : null;
      if (!pixiRenderer) {
        return;
      }
      const runtimeGame = this._runtimeScene.getGame();

      // TODO (3D): should this be done for each individual layer?
      // Especially if we remove _pixiContainer entirely.
      this._pixiContainer.scale.x =
        pixiRenderer.width / runtimeGame.getGameResolutionWidth();
      this._pixiContainer.scale.y =
        pixiRenderer.height / runtimeGame.getGameResolutionHeight();

      for (const runtimeLayer of this._runtimeScene._orderedLayers) {
        runtimeLayer.getRenderer().onGameResolutionResized();
      }

      this._synchronizeHybridPresentationSize();
      this._updateFsrResources();
    }

    onSceneUnloaded() {
      // TODO (3D): call the method with the same name on RuntimeLayers so they can dispose?
      this._disposeFsrResources();
      this._disposeHybridPresentation();
      this._dedicatedThreeWebGpuRequirementOverride = null;
    }

    setDedicatedThreeWebGPURequirementOverride(reason: string | null): void {
      const normalizedReason =
        reason && reason.length > 0 ? reason : null;
      this._dedicatedThreeWebGpuRequirementOverride = normalizedReason;
    }

    private _getDedicatedThreeWebGpuRuntimeRequirementReason(): string | null {
      const hasAnyVisible3DContent = this._runtimeScene._orderedLayers.some(
        (runtimeLayer) =>
          runtimeLayer.isVisible() &&
          !!runtimeLayer.getRenderer().getThreeScene() &&
          !!runtimeLayer.getRenderer().getThreeCamera() &&
          runtimeLayer.getRenderer().has3DObjects()
      );
      let hasRendered3DContent = false;
      let saw2DOverlayContent = false;

      for (const runtimeLayer of this._runtimeScene._orderedLayers) {
        if (!runtimeLayer.isVisible()) {
          continue;
        }

        const runtimeLayerRenderer = runtimeLayer.getRenderer();
        const renderingType = runtimeLayer.getRenderingType();
        const has3DContent =
          !!runtimeLayerRenderer.getThreeScene() &&
          !!runtimeLayerRenderer.getThreeCamera() &&
          runtimeLayerRenderer.has3DObjects();
        const has2DContent =
          runtimeLayer.isLightingLayer() || runtimeLayerRenderer.has2DObjects();

        if (
          renderingType === gdjs.RuntimeLayerRenderingType.TWO_D_PLUS_THREE_D
        ) {
          return `Layer "${runtimeLayer.getName()}" actively mixes 2D and 3D rendering, which still requires the legacy layered composition path.`;
        }

        if (
          renderingType === gdjs.RuntimeLayerRenderingType.THREE_D &&
          runtimeLayerRenderer.hasPostProcessingPass()
        ) {
          return `Layer "${runtimeLayer.getName()}" uses 3D post-processing, which still requires the legacy Three.js/WebGL composition path.`;
        }

        if (
          renderingType === gdjs.RuntimeLayerRenderingType.THREE_D &&
          runtimeLayerRenderer.has2DObjects()
        ) {
          return `Layer "${runtimeLayer.getName()}" renders 2D display objects on a pure 3D layer, which still requires the legacy composition path.`;
        }

        if (has2DContent) {
          if (hasAnyVisible3DContent && !hasRendered3DContent) {
            return `Layer "${runtimeLayer.getName()}" renders 2D or lighting content before the scene's 3D content, which still requires a background composition path.`;
          }
          saw2DOverlayContent = true;
        }

        if (has3DContent) {
          if (saw2DOverlayContent) {
            return `Layer "${runtimeLayer.getName()}" renders 3D content after a 2D or lighting overlay layer, which still requires the legacy layered composition path.`;
          }
          hasRendered3DContent = true;
        }
      }

      return null;
    }

    getDedicatedThreeWebGPURequirementReason(): string | null {
      return (
        this._dedicatedThreeWebGpuRequirementOverride ||
        this._getDedicatedThreeWebGpuRuntimeRequirementReason()
      );
    }

    private _getFsrSupportIssue(): string | null {
      if (typeof THREE === 'undefined') {
        return 'Three.js is not available';
      }
      if (this._runtimeGameRenderer) {
        return this._runtimeGameRenderer.getFsrSupportIssue();
      }
      if (!this._threeRenderer) {
        return 'Three.js is not available';
      }
      if (!this._threeRenderer.capabilities.isWebGL2) {
        return 'WebGL2 not supported';
      }
      return null;
    }

    private _ensureFsrResources(runtimeGame?: gdjs.RuntimeGame): boolean {
      const game = runtimeGame || this._runtimeScene.getGame();
      const fsrSupportIssue = this._getFsrSupportIssue();
      if (fsrSupportIssue) {
        game.disableFsrForSession(fsrSupportIssue);
        return false;
      }
      try {
        if (!this._fsrPass) {
          this._fsrPass = new gdjs.Fsr1Pass();
        }
        if (!this._fsrLowResTarget) {
          this._fsrLowResTarget = new THREE.WebGLRenderTarget(1, 1, {
            depthBuffer: true,
            stencilBuffer: false,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
          });
          this._fsrLowResTarget.texture.generateMipmaps = false;
          this._fsrLowResTarget.texture.wrapS = THREE.ClampToEdgeWrapping;
          this._fsrLowResTarget.texture.wrapT = THREE.ClampToEdgeWrapping;
        }
        if (!this._fsrCopyScene || !this._fsrCopyCamera || !this._fsrCopyMesh) {
          this._fsrCopyScene = new THREE.Scene();
          this._fsrCopyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          this._fsrCopyMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });
          const geometry = new THREE.PlaneGeometry(2, 2);
          this._fsrCopyMesh = new THREE.Mesh(geometry, this._fsrCopyMaterial);
          this._fsrCopyScene.add(this._fsrCopyMesh);
        }
        return true;
      } catch (error) {
        console.warn(
          'FSR 1.0: Failed to create resources, falling back to standard rendering.',
          error
        );
        this._disposeFsrResources();
        game.disableFsrForSession('Failed to initialize FSR resources');
        return false;
      }
    }

    private _updateFsrResources(): void {
      if (!this._runtimeGameRenderer) return;
      const runtimeGame = this._runtimeScene.getGame();
      if (!runtimeGame.isFsrEnabled()) return;
      if (!this._ensureFsrResources(runtimeGame)) return;

      const pixelRatio = this._runtimeGameRenderer.getPixelRatio();
      const lowResWidth = Math.max(
        1,
        Math.round(runtimeGame.getRenderingWidth() * pixelRatio)
      );
      const lowResHeight = Math.max(
        1,
        Math.round(runtimeGame.getRenderingHeight() * pixelRatio)
      );
      const outputWidth = Math.max(
        1,
        Math.round(runtimeGame.getGameResolutionWidth() * pixelRatio)
      );
      const outputHeight = Math.max(
        1,
        Math.round(runtimeGame.getGameResolutionHeight() * pixelRatio)
      );

      if (
        this._fsrLowResTarget &&
        (this._fsrLowResWidth !== lowResWidth ||
          this._fsrLowResHeight !== lowResHeight)
      ) {
        this._fsrLowResTarget.setSize(lowResWidth, lowResHeight);
        this._fsrLowResWidth = lowResWidth;
        this._fsrLowResHeight = lowResHeight;
      }

      if (
        this._fsrOutputWidth !== outputWidth ||
        this._fsrOutputHeight !== outputHeight
      ) {
        this._fsrOutputWidth = outputWidth;
        this._fsrOutputHeight = outputHeight;
      }

      if (this._fsrPass) {
        this._fsrPass.setSize(
          new THREE.Vector2(lowResWidth, lowResHeight),
          new THREE.Vector2(outputWidth, outputHeight)
        );
        this._fsrPass.setSharpness(runtimeGame.getFsrSharpness());
      }
    }

    private _renderTextureToLowResTarget(
      threeRenderer: THREE.WebGLRenderer,
      texture: THREE.Texture
    ) {
      if (
        !this._fsrLowResTarget ||
        !this._fsrCopyScene ||
        !this._fsrCopyCamera ||
        !this._fsrCopyMesh ||
        !this._fsrCopyMaterial
      ) {
        return;
      }
      if (this._fsrCopyMaterial.map !== texture) {
        this._fsrCopyMaterial.map = texture;
        this._fsrCopyMaterial.needsUpdate = true;
      }
      // Post-processing passes may leave WebGL state altered (blending/depth/color masks),
      // so reset to a predictable state before blitting the composer output.
      threeRenderer.resetState();
      threeRenderer.setRenderTarget(this._fsrLowResTarget);
      threeRenderer.render(this._fsrCopyScene, this._fsrCopyCamera);
    }

    private _getComposerOutputTexture(
      threeEffectComposer: THREE_ADDONS.EffectComposer
    ): THREE.Texture | null {
      const anyComposer = threeEffectComposer as any;
      return (
        (anyComposer.readBuffer && anyComposer.readBuffer.texture) ||
        (anyComposer.writeBuffer && anyComposer.writeBuffer.texture) ||
        null
      );
    }

    private _isComposerTextureReady(texture: THREE.Texture): boolean {
      const image = (texture as any).image;
      return !!(
        image &&
        typeof image.width === 'number' &&
        typeof image.height === 'number' &&
        image.width > 0 &&
        image.height > 0
      );
    }

    private _disposeFsrResources(): void {
      if (this._fsrPass) {
        this._fsrPass.dispose();
        this._fsrPass = null;
      }
      if (this._fsrLowResTarget) {
        this._fsrLowResTarget.dispose();
        this._fsrLowResTarget = null;
      }
      if (this._fsrCopyMesh) {
        this._fsrCopyMesh.geometry.dispose();
        this._fsrCopyMesh = null;
      }
      if (this._fsrCopyMaterial) {
        this._fsrCopyMaterial.dispose();
        this._fsrCopyMaterial = null;
      }
      this._fsrCopyScene = null;
      this._fsrCopyCamera = null;
      this._fsrLowResWidth = 0;
      this._fsrLowResHeight = 0;
      this._fsrOutputWidth = 0;
      this._fsrOutputHeight = 0;
    }

    private _disposeHybridPresentation(): void {
      this._hybridPresentationContainer?.destroy({
        children: true,
      });
      this._hybridPresentationContainer = null;
      this._hybridPresentationSprite = null;
      this._hybridPresentationTexture = null;
    }

    private _isUsingHybridPresentation(): boolean {
      return (
        !!this._runtimeGameRenderer &&
        this._runtimeGameRenderer.shouldRenderRuntimeSceneWithLegacyComposition(
          this._runtimeScene
        )
      );
    }

    private _synchronizeHybridPresentationSize(): void {
      if (!this._hybridPresentationSprite) {
        return;
      }

      this._hybridPresentationSprite.width =
        this._runtimeScene.getGame().getGameResolutionWidth();
      this._hybridPresentationSprite.height =
        this._runtimeScene.getGame().getGameResolutionHeight();
    }

    private _ensureHybridPresentationContainer(): PIXI.Container | null {
      const runtimeGameRenderer = this._runtimeGameRenderer;
      const legacyCanvas = runtimeGameRenderer?.getLegacyRenderingCanvas();
      if (!runtimeGameRenderer || !legacyCanvas) {
        return null;
      }

      if (
        !this._hybridPresentationContainer ||
        !this._hybridPresentationTexture ||
        !this._hybridPresentationSprite
      ) {
        this._disposeHybridPresentation();

        this._hybridPresentationTexture = PIXI.Texture.from({
          resource: legacyCanvas,
        });
        this._hybridPresentationSprite = new PIXI.Sprite(
          this._hybridPresentationTexture
        );
        this._hybridPresentationContainer = new PIXI.Container();
        this._hybridPresentationContainer.addChild(this._hybridPresentationSprite);
        this._synchronizeHybridPresentationSize();
      }

      return this._hybridPresentationContainer;
    }

    private _renderHybridPresentation(
      pixiRenderer: PIXI.Renderer
    ): void {
      const hybridPresentationContainer =
        this._ensureHybridPresentationContainer();
      if (!hybridPresentationContainer || !this._hybridPresentationTexture) {
        return;
      }

      updatePixiTextureSource(this._hybridPresentationTexture);
      pixiRenderer.background.color = this._runtimeScene.getBackgroundColor();
      pixiRenderer.background.alpha = 1;
      pixiRenderer.render({
        container: hybridPresentationContainer,
        clear: this._runtimeScene.getClearCanvas(),
      });
    }

    private _renderDedicatedThreeWebGpuScene(
      presentationPixiRenderer: PIXI.Renderer,
      threeRenderer: gdjs.ThreeRendererCompat
    ): void {
      const threeRendererWithCompat = threeRenderer as Record<string, any>;
      const canRenderThreeScene =
        !!threeRendererWithCompat &&
        typeof threeRendererWithCompat.render === 'function';
      if (!canRenderThreeScene) {
        return;
      }

      this._layerRenderingMetrics.rendered2DLayersCount = 0;
      this._layerRenderingMetrics.rendered3DLayersCount = 0;

      if (
        threeRendererWithCompat.info &&
        typeof threeRendererWithCompat.info.reset === 'function'
      ) {
        threeRendererWithCompat.info.autoReset = false;
        threeRendererWithCompat.info.reset();
      }

      gdjs.resetThreeRendererState(threeRenderer);
      if (typeof threeRendererWithCompat.setRenderTarget === 'function') {
        threeRendererWithCompat.setRenderTarget(null);
      }
      if (typeof threeRendererWithCompat.setClearColor === 'function') {
        threeRendererWithCompat.setClearColor(this._runtimeScene.getBackgroundColor());
      }
      if (
        this._runtimeScene.getClearCanvas() &&
        typeof threeRendererWithCompat.clear === 'function'
      ) {
        threeRendererWithCompat.clear();
      }

      let hasRenderedThreeLayer = false;
      for (let i = 0; i < this._runtimeScene._orderedLayers.length; ++i) {
        const runtimeLayer = this._runtimeScene._orderedLayers[i];
        if (!runtimeLayer.isVisible()) continue;

        const runtimeLayerRenderer = runtimeLayer.getRenderer();
        runtimeLayerRenderer.show2DRenderingPlane(false);

        const threeScene = runtimeLayerRenderer.getThreeScene();
        const threeCamera = runtimeLayerRenderer.getThreeCamera();
        if (!threeScene || !threeCamera) {
          continue;
        }

        if (threeScene.background) {
          threeScene.background = null;
        }
        if (
          hasRenderedThreeLayer &&
          typeof threeRendererWithCompat.clearDepth === 'function'
        ) {
          threeRendererWithCompat.clearDepth();
        }
        threeRendererWithCompat.render(threeScene, threeCamera);
        this._layerRenderingMetrics.rendered3DLayersCount++;
        hasRenderedThreeLayer = true;
      }

      presentationPixiRenderer.background.alpha = 0;
      presentationPixiRenderer.background.color = 0;
      presentationPixiRenderer.render({
        container: this._pixiContainer,
        clear: this._runtimeScene.getClearCanvas(),
      });

      const debugContainer = this._runtimeScene
        .getDebuggerRenderer()
        .getRendererObject();
      if (debugContainer) {
        presentationPixiRenderer.render(debugContainer);
      }
    }

    render() {
      const runtimeGameRenderer = this._runtimeGameRenderer;
      if (!runtimeGameRenderer) return;

      const presentationPixiRenderer = runtimeGameRenderer.getPIXIRenderer();
      const pixiRenderer = runtimeGameRenderer.getPixiRendererForRuntimeScene(
        this._runtimeScene
      );
      if (!presentationPixiRenderer || !pixiRenderer) return;

      const runtimeGame = this._runtimeScene.getGame();
      const threeRenderer = runtimeGameRenderer.getThreeRendererForRuntimeScene(
        this._runtimeScene
      );
      this._threeRenderer = threeRenderer;
      const shouldUseDedicatedThreeWebGpuPath =
        runtimeGameRenderer.shouldRenderRuntimeSceneWithDedicatedThreeWebGPU(
          this._runtimeScene
        );
      runtimeGameRenderer.setDedicatedThreeWebGPUCanvasVisible(
        shouldUseDedicatedThreeWebGpuPath
      );
      if (shouldUseDedicatedThreeWebGpuPath && threeRenderer) {
        this._disposeHybridPresentation();
        this._disposeFsrResources();
        this._renderDedicatedThreeWebGpuScene(
          presentationPixiRenderer,
          threeRenderer
        );
        return;
      }

      const isUsingHybridPresentation =
        this._isUsingHybridPresentation() &&
        pixiRenderer !== presentationPixiRenderer;
      if (!isUsingHybridPresentation) {
        this._disposeHybridPresentation();
      }
      const fsrEnabled =
        runtimeGame.isFsrEnabled() && this._ensureFsrResources(runtimeGame);
      if (fsrEnabled) {
        for (const runtimeLayer of this._runtimeScene._orderedLayers) {
          runtimeLayer.getRenderer().ensureFsrRendering();
        }
      }

      // If we are in VR, we cannot render like this: we must use the special VR
      // rendering method to not display a black screen.
      //
      // We cannot call it here either - the headset will request a frame to be rendered
      // whenever it wants and we must oblige, however this will  be called whenever
      // we do a step - and we may step multiple times or none at all depending on the
      // min/max FPS and possibly other factors, and the headset will not allow that.
      //
      // It is therefore left to the VR extension to call the VR rendering method whenever
      // the headset require a new image, we'll just disable rendering when stepping to
      // not interfere with the headset's rendering.
      if (threeRenderer && threeRenderer.xr.isPresenting) return;

      this._layerRenderingMetrics.rendered2DLayersCount = 0;
      this._layerRenderingMetrics.rendered3DLayersCount = 0;

      if (threeRenderer) {
        let renderedWithFsr = false;
        if (fsrEnabled && this._fsrPass && this._fsrLowResTarget) {
          try {
            // FSR 1.0 layered rendering into a shared low-res target.
            this._updateFsrResources();

            threeRenderer.info.autoReset = false;
            threeRenderer.info.reset();

            /** Useful to render the background color. */
            let isFirstRender = true;

            /**
             * true if the last layer rendered 3D objects using Three.js, false otherwise.
             * Useful to avoid needlessly resetting the WebGL states between layers (which can be expensive).
             */
            let lastRenderWas3D = true;

            // Ensure a clean state for the first frame.
            threeRenderer.resetState();

            // Render each layer one by one into the shared low-res target.
            for (let i = 0; i < this._runtimeScene._orderedLayers.length; ++i) {
              const runtimeLayer = this._runtimeScene._orderedLayers[i];
              if (!runtimeLayer.isVisible()) continue;

              const runtimeLayerRenderer = runtimeLayer.getRenderer();
              const threeScene = runtimeLayerRenderer.getThreeScene();
              const threeCamera = runtimeLayerRenderer.getThreeCamera();
              const threeEffectComposer =
                runtimeLayerRenderer.getThreeEffectComposer();

              const layerHas2DObjectsToRender =
                runtimeLayerRenderer.has2DObjects();

              if (layerHas2DObjectsToRender) {
                if (lastRenderWas3D) {
                  threeRenderer.resetState();
                  resetPixiRendererState(pixiRenderer);
                }

                const hasRenderedOnPixiTexture =
                  runtimeLayerRenderer.renderOnPixiRenderTexture(pixiRenderer);
                const hasBoundPixiTextureToThreePlane =
                  !!hasRenderedOnPixiTexture &&
                  runtimeLayerRenderer.updateThreePlaneTextureFromPixiRenderTexture(
                    threeRenderer,
                    pixiRenderer
                  );
                runtimeLayerRenderer.show2DRenderingPlane(
                  !!hasBoundPixiTextureToThreePlane
                );
                if (hasRenderedOnPixiTexture) {
                  this._layerRenderingMetrics.rendered2DLayersCount++;
                  lastRenderWas3D = false;
                }
              } else {
                runtimeLayerRenderer.show2DRenderingPlane(false);
              }

              if (!threeScene || !threeCamera) {
                continue;
              }

              if (!lastRenderWas3D) {
                resetPixiRendererState(pixiRenderer);
                threeRenderer.resetState();
              }

              if (isFirstRender) {
                threeRenderer.setClearColor(
                  this._runtimeScene.getBackgroundColor()
                );
                threeRenderer.setRenderTarget(this._fsrLowResTarget);
                if (this._runtimeScene.getClearCanvas()) {
                  threeRenderer.clear();
                }
                isFirstRender = false;
              }

              // Avoid clearing background inside the layer scene.
              if (threeScene.background) {
                threeScene.background = null;
              }

              threeRenderer.setRenderTarget(this._fsrLowResTarget);
              threeRenderer.clearDepth();

              let renderedWithComposer = false;
              if (
                threeEffectComposer &&
                runtimeLayerRenderer.hasPostProcessingPass()
              ) {
                const anyComposer = threeEffectComposer as any;
                const previousRenderToScreen = !!anyComposer.renderToScreen;
                try {
                  // Force composer to render into its internal targets so we can
                  // blend the result into the shared FSR low-res target.
                  anyComposer.renderToScreen = false;
                  threeEffectComposer.render();
                } finally {
                  anyComposer.renderToScreen = previousRenderToScreen;
                }

                const composerTexture =
                  this._getComposerOutputTexture(threeEffectComposer);
                if (
                  composerTexture &&
                  this._isComposerTextureReady(composerTexture)
                ) {
                  this._renderTextureToLowResTarget(
                    threeRenderer,
                    composerTexture
                  );
                  renderedWithComposer = true;
                }
              }
              if (!renderedWithComposer) {
                // Fallback to direct scene rendering if composer output is not available,
                // to avoid a black frame for this layer.
                threeRenderer.setRenderTarget(this._fsrLowResTarget);
                threeRenderer.clearDepth();
                threeRenderer.render(threeScene, threeCamera);
              }

              this._layerRenderingMetrics.rendered3DLayersCount++;
              lastRenderWas3D = true;
            }

            // Upscale the composed low-res target to the screen.
            // Reset state/viewport to avoid inheriting stale post-processing state.
            threeRenderer.resetState();
            threeRenderer.setScissorTest(false);
            threeRenderer.setViewport(
              0,
              0,
              this._fsrOutputWidth,
              this._fsrOutputHeight
            );
            this._fsrPass.render(
              threeRenderer,
              this._fsrLowResTarget.texture
            );

            // Restore the screen framebuffer and clean up WebGL state after FSR
            // so subsequent PixiJS renders (loading screen, debug overlays) go
            // to the correct target.
            threeRenderer.setRenderTarget(null);
            threeRenderer.resetState();

            const debugContainer = this._runtimeScene
              .getDebuggerRenderer()
              .getRendererObject();

            if (debugContainer) {
              resetPixiRendererState(pixiRenderer);
              pixiRenderer.render(debugContainer);
              lastRenderWas3D = false;
            }

            if (!lastRenderWas3D) {
              resetPixiRendererState(pixiRenderer);
            }
            renderedWithFsr = true;
          } catch (error) {
            console.warn(
              'FSR 1.0: Rendering failed, falling back to standard rendering.',
              error
            );
            this._disposeFsrResources();
            runtimeGame.disableFsrForSession('FSR render failed');
            threeRenderer.setRenderTarget(null);
            threeRenderer.resetState();
            resetPixiRendererState(pixiRenderer);
          }
        }

        if (!renderedWithFsr) {
          // Layered 2D, 3D or 2D+3D rendering.
          threeRenderer.info.autoReset = false;
          threeRenderer.info.reset();

          /** Useful to render the background color. */
          let isFirstRender = true;

          /**
           * true if the last layer rendered 3D objects using Three.js, false otherwise.
           * Useful to avoid needlessly resetting the WebGL states between layers (which can be expensive).
           */
          let lastRenderWas3D = true;

          // Even if no rendering at all has been made already, setting up the Three.js/PixiJS renderers
          // might have changed some WebGL states already. Reset the state for the very first frame.
          // And, out of caution, keep doing it for every frame.
          // TODO (3D): optimization - check if this can be done only on the very first frame.
          threeRenderer.resetState();

          // Render each layer one by one.
          for (let i = 0; i < this._runtimeScene._orderedLayers.length; ++i) {
            const runtimeLayer = this._runtimeScene._orderedLayers[i];
            if (!runtimeLayer.isVisible()) continue;

            const runtimeLayerRenderer = runtimeLayer.getRenderer();
            const runtimeLayerRenderingType = runtimeLayer.getRenderingType();

            // Determine if this layer will actually render in 3D mode.
            // Keep in sync with: `shouldRenderLayerIn3D` in `layer-pixi-renderer.ts`.
            const shouldRenderLayerIn3D =
              runtimeGame.isInGameEdition() ||
              (runtimeLayerRenderingType !==
                gdjs.RuntimeLayerRenderingType.TWO_D &&
                runtimeLayerRenderer.has3DObjects());

            if (!shouldRenderLayerIn3D) {
              // Render a layer with 2D rendering (PixiJS).

              if (lastRenderWas3D) {
                // Ensure the state is clean for PixiJS to render.
                threeRenderer.resetState();
                resetPixiRendererState(pixiRenderer);
              }

              if (isFirstRender) {
                // Render the background color.
                pixiRenderer.background.color =
                  this._runtimeScene.getBackgroundColor();
                pixiRenderer.background.alpha = 1;
                if (this._runtimeScene.getClearCanvas()) pixiRenderer.clear();

                isFirstRender = false;
              }

              if (runtimeLayer.isLightingLayer()) {
                // Render the lights on the render texture used then by the lighting Sprite.
                runtimeLayerRenderer.renderOnPixiRenderTexture(pixiRenderer);
              }

              // TODO (2d lights): refactor to remove the need for `getLightingSprite`.
              const pixiContainer =
                (runtimeLayer.isLightingLayer() &&
                  runtimeLayerRenderer.getLightingSprite()) ||
                runtimeLayerRenderer.getRendererObject();

              pixiRenderer.render({
                container: pixiContainer,
                clear: false,
              });
              this._layerRenderingMetrics.rendered2DLayersCount++;

              lastRenderWas3D = false;
            } else {
              // Render a layer with 3D rendering, and possibly some 2D rendering too.
              const threeScene = runtimeLayerRenderer.getThreeScene();
              const threeCamera = runtimeLayerRenderer.getThreeCamera();
              const threeEffectComposer =
                runtimeLayerRenderer.getThreeEffectComposer();

              // Render the 3D objects of this layer.
              if (threeScene && threeCamera && threeEffectComposer) {
                // TODO (3D) - optimization: do this at the beginning for all layers that are 2d+3d?
                // So the second pass is clearer (just rendering 2d or 3d layers without doing PixiJS renders in between).
                if (
                  runtimeLayerRenderingType ===
                  gdjs.RuntimeLayerRenderingType.TWO_D_PLUS_THREE_D
                ) {
                  const layerHas2DObjectsToRender =
                    runtimeLayerRenderer.has2DObjects();

                  if (layerHas2DObjectsToRender) {
                    if (lastRenderWas3D) {
                      // Ensure the state is clean for PixiJS to render.
                      threeRenderer.resetState();
                      resetPixiRendererState(pixiRenderer);
                    }

                    // Do the rendering of the PixiJS objects of the layer on the render texture.
                    // Then, update the texture of the plane showing the PixiJS rendering,
                    // so that the 2D rendering made by PixiJS can be shown in the 3D world.
                    const hasRenderedOnPixiTexture =
                      runtimeLayerRenderer.renderOnPixiRenderTexture(
                        pixiRenderer
                      );
                    const hasBoundPixiTextureToThreePlane =
                      !!hasRenderedOnPixiTexture &&
                      runtimeLayerRenderer.updateThreePlaneTextureFromPixiRenderTexture(
                        // The renderers are needed to find the internal WebGL texture.
                        threeRenderer,
                        pixiRenderer
                      );
                    if (hasRenderedOnPixiTexture) {
                      this._layerRenderingMetrics.rendered2DLayersCount++;
                      lastRenderWas3D = false;
                    }
                    runtimeLayerRenderer.show2DRenderingPlane(
                      !!hasBoundPixiTextureToThreePlane
                    );
                  } else {
                    runtimeLayerRenderer.show2DRenderingPlane(false);
                  }
                }

                if (!lastRenderWas3D) {
                  // It's important to reset the internal WebGL state of PixiJS, then Three.js
                  // to ensure the 3D rendering is made properly by Three.js
                  resetPixiRendererState(pixiRenderer);
                  threeRenderer.resetState();
                }

                if (isFirstRender) {
                  // Render the background color.
                  threeRenderer.setClearColor(
                    this._runtimeScene.getBackgroundColor()
                  );
                  threeRenderer.resetState();
                  if (this._runtimeScene.getClearCanvas())
                    threeRenderer.clear();
                  if (!this._backgroundColor) {
                    this._backgroundColor = new THREE.Color();
                  }
                  this._backgroundColor.set(
                    this._runtimeScene.getBackgroundColor()
                  );
                  if (!threeScene.background) {
                    threeScene.background = this._backgroundColor;
                  }

                  isFirstRender = false;
                } else {
                  // It's important to set the background to null, as maybe the first rendered
                  // layer has changed and so the Three.js scene background must be reset.
                  if (threeScene.background === this._backgroundColor) {
                    threeScene.background = null;
                  }
                }

                // Clear the depth as each layer is independent and display on top of the previous one,
                // even 3D objects.
                threeRenderer.clearDepth();
                if (runtimeLayerRenderer.hasPostProcessingPass()) {
                  threeEffectComposer.render();
                } else {
                  threeRenderer.render(threeScene, threeCamera);
                }

                this._layerRenderingMetrics.rendered3DLayersCount++;

                lastRenderWas3D = true;
              }
            }
          }

          const debugContainer = this._runtimeScene
            .getDebuggerRenderer()
            .getRendererObject();

          if (debugContainer) {
            threeRenderer.resetState();
            resetPixiRendererState(pixiRenderer);
            pixiRenderer.render(debugContainer);
            lastRenderWas3D = false;
          }

          if (!lastRenderWas3D) {
            // Out of caution, reset the WebGL states from PixiJS to start again
            // with a 3D rendering on the next frame.
            resetPixiRendererState(pixiRenderer);
          }

          // Uncomment to display some debug metrics from Three.js.
          // console.log(threeRenderer.info);
        }
      } else {
        // 2D only rendering.

        // Render lights in render textures first.
        for (const runtimeLayer of this._runtimeScene._orderedLayers) {
          if (runtimeLayer.isLightingLayer()) {
            // Render the lights on the render texture used then by the lighting Sprite.
            const runtimeLayerRenderer = runtimeLayer.getRenderer();
            runtimeLayerRenderer.renderOnPixiRenderTexture(pixiRenderer);
          }
        }

        // this._renderProfileText(); //Uncomment to display profiling times

        // Render all the layers then.
        // TODO: replace by a loop like in 3D?
        pixiRenderer.background.color = this._runtimeScene.getBackgroundColor();
        pixiRenderer.render({
          container: this._pixiContainer,
          clear: this._runtimeScene.getClearCanvas(),
        });
        this._layerRenderingMetrics.rendered2DLayersCount++;
      }

      if (isUsingHybridPresentation) {
        this._renderHybridPresentation(presentationPixiRenderer);
      }

      // synchronize showing the cursor with rendering (useful to reduce
      // blinking while switching from in-game cursor)
      if (this._showCursorAtNextRender) {
        const canvas = runtimeGameRenderer.getCanvas();
        if (canvas) canvas.style.cursor = '';
        this._showCursorAtNextRender = false;
      }

      // Uncomment to check the number of 2D&3D rendering done
      // console.log(this._layerRenderingMetrics);
    }

    /**
     * Unless you know what you are doing, use the VR extension instead of this function directly.
     *
     * In VR, only 3D elements can be rendered, 2D cannot.
     * This rendering method skips over all 2D layers and elements, and simply renders the 3D content.
     * This method is to be called by the XRSession's `requestAnimationFrame` for rendering to
     * the headset whenever the headset requests the screen to be drawn. Note that while an XRSession
     * is in progress, the regular `requestAnimationFrame` will be disabled. Make sure that whenever you
     * enter an XRSession, you:
     * - Call this function first and foremost when the XRSession's requestAnimationFrame fires,
     *   as it is necessary to draw asap as the headset will eventually stop waiting and just draw the
     *   framebuffer as it is to maintain a constant screen refresh rate, which can be in the middle of
     *   or even before rendering if we aren't fast enough, leading to screen flashes and bugs.
     * - Call GDevelop's step function to give the scene a chance to step after having drawn to the screen
     *   to allow the game to actually progress, since GDevelop will no longer step by itself with
     *   `requestAnimationFrame` disabled.
     *
     * Note to engine developers: `threeRenderer.resetState()` may NOT be called in this function,
     * as WebXR modifies the WebGL state in a way that resetting it will cause an improper render
     * that will lead to a black screen being displayed in VR mode.
     */
    renderForVR() {
      const runtimeGameRenderer = this._runtimeGameRenderer;
      if (!runtimeGameRenderer) return;

      const threeRenderer = this._threeRenderer;
      // VR rendering relies on ThreeJS
      if (!threeRenderer)
        throw new Error('Cannot render a scene with no 3D elements in VR!');

      // Render each layer one by one.
      let isFirstRender = true;
      for (let i = 0; i < this._runtimeScene._orderedLayers.length; ++i) {
        const runtimeLayer = this._runtimeScene._orderedLayers[i];
        if (!runtimeLayer.isVisible()) continue;

        const runtimeLayerRenderer = runtimeLayer.getRenderer();
        const runtimeLayerRenderingType = runtimeLayer.getRenderingType();
        if (
          runtimeLayerRenderingType === gdjs.RuntimeLayerRenderingType.TWO_D ||
          !runtimeLayerRenderer.has3DObjects()
        )
          continue;

        // Render a layer with 3D rendering, and no 2D rendering at all for VR.
        const threeScene = runtimeLayerRenderer.getThreeScene();
        const threeCamera = runtimeLayerRenderer.getThreeCamera();
        if (!threeScene || !threeCamera) continue;

        if (isFirstRender) {
          // Render the background color.
          threeRenderer.setClearColor(this._runtimeScene.getBackgroundColor());
          if (this._runtimeScene.getClearCanvas()) threeRenderer.clear();
          threeScene.background = new THREE.Color(
            this._runtimeScene.getBackgroundColor()
          );

          isFirstRender = false;
        } else {
          // It's important to set the background to null, as maybe the first rendered
          // layer has changed and so the Three.js scene background must be reset.
          threeScene.background = null;
        }

        // Clear the depth as each layer is independent and display on top of the previous one,
        // even 3D objects.
        threeRenderer.clearDepth();
        threeRenderer.render(threeScene, threeCamera);
      }
    }

    _renderProfileText() {
      const profiler = this._runtimeScene.getProfiler();
      if (!profiler) {
        return;
      }
      if (!this._profilerText) {
        this._profilerText = new PIXI.Text(' ', {
          align: 'left',
          stroke: { color: '#FFF', width: 1 },
        });

        // Add on top of all layers:
        this._pixiContainer.addChild(this._profilerText);
      }
      const average = profiler.getFramesAverageMeasures();
      const outputs = [];
      gdjs.Profiler.getProfilerSectionTexts('All', average, outputs);
      this._profilerText.text = outputs.join('\n');
    }

    hideCursor(): void {
      this._showCursorAtNextRender = false;

      const canvas = this._runtimeGameRenderer
        ? this._runtimeGameRenderer.getCanvas()
        : null;
      if (canvas) canvas.style.cursor = 'none';
    }

    showCursor(): void {
      this._showCursorAtNextRender = true;
    }

    getPIXIContainer() {
      return this._pixiContainer;
    }

    getRendererObject() {
      return this._pixiContainer;
    }

    get3DRendererObject() {
      // There is no notion of a container for all 3D objects. Each 3D object is
      // added to their layer container.
      return null;
    }

    /** @deprecated use `runtimeGame.getRenderer().getPIXIRenderer()` instead */
    getPIXIRenderer() {
      return this._runtimeGameRenderer
        ? this._runtimeGameRenderer.getPixiRendererForRuntimeScene(
            this._runtimeScene
          )
        : null;
    }

    setLayerIndex(layer: gdjs.RuntimeLayer, index: float): void {
      const layerPixiRenderer: gdjs.LayerPixiRenderer = layer.getRenderer();
      let layerPixiObject: PIXI.Container | PIXI.Sprite | null =
        layerPixiRenderer.getRendererObject();
      if (layer.isLightingLayer()) {
        // TODO (2d lights): refactor to remove the need for `getLightingSprite`.
        layerPixiObject = layerPixiRenderer.getLightingSprite();
      }
      if (!layerPixiObject) {
        return;
      }
      if (this._pixiContainer.children.indexOf(layerPixiObject) === index) {
        return;
      }
      this._pixiContainer.removeChild(layerPixiObject);
      this._pixiContainer.addChildAt(layerPixiObject, index);
    }
  }

  // Register the class to let the engine use it.
  /** @category Renderers > Scene */
  export type RuntimeSceneRenderer = gdjs.RuntimeScenePixiRenderer;
  /** @category Renderers > Scene */
  export const RuntimeSceneRenderer = gdjs.RuntimeScenePixiRenderer;
}
