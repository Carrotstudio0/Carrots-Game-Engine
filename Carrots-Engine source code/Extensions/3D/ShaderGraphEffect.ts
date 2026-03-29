namespace gdjs {
  interface ShaderGraphNetworkSyncData {
    e: boolean;
    s: number;
    f: string;
  }

  const SHADER_GRAPH_VERTEX_SHADER = `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER = `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uMixStrength;
    varying vec2 vUv;

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);
      gl_FragColor = sceneColor;
    }
  `;

  const clampMixStrength = (value: number): number =>
    gdjs.evtTools.common.clamp(0, 1, value);

  const getTimeFromStartSeconds = (target: gdjs.Layer): number => {
    const runtimeScene: any = target.getRuntimeScene();
    if (!runtimeScene) {
      return 0;
    }
    const scene =
      typeof runtimeScene.getScene === 'function'
        ? runtimeScene.getScene()
        : runtimeScene;
    if (!scene || typeof scene.getTimeManager !== 'function') {
      return 0;
    }
    return scene.getTimeManager().getTimeFromStart() / 1000;
  };

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::ShaderGraph',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }

        return new (class implements gdjs.PixiFiltersTools.Filter {
          shaderPass: THREE_ADDONS.ShaderPass;
          _effectEnabled: boolean;
          _isEnabled: boolean;
          _fragmentShader: string;
          _mixStrength: number;
          _renderSize: THREE.Vector2;
          _targetLayer: gdjs.Layer | null;

          constructor() {
            this._effectEnabled =
              effectData.booleanParameters.enabled === undefined
                ? true
                : !!effectData.booleanParameters.enabled;
            this._mixStrength = clampMixStrength(
              effectData.doubleParameters.strength !== undefined
                ? effectData.doubleParameters.strength
                : 1
            );
            this._fragmentShader =
              effectData.stringParameters.fragmentShader ||
              DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER;
            this._isEnabled = false;
            this._targetLayer = null;
            this._renderSize = new THREE.Vector2(1, 1);
            this.shaderPass = this._createShaderPass(this._fragmentShader);
            this.shaderPass.enabled = this._effectEnabled;
            void target;
          }

          private _createShaderPass(
            fragmentShader: string
          ): THREE_ADDONS.ShaderPass {
            return new THREE_ADDONS.ShaderPass({
              uniforms: {
                tDiffuse: { value: null },
                uResolution: { value: new THREE.Vector2(1, 1) },
                uTime: { value: 0 },
                uMixStrength: { value: this._mixStrength },
              },
              vertexShader: SHADER_GRAPH_VERTEX_SHADER,
              fragmentShader:
                fragmentShader || DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER,
            });
          }

          private _disposeShaderPass(shaderPass: THREE_ADDONS.ShaderPass): void {
            const material: any = (shaderPass as any).material;
            if (material && material.dispose) {
              material.dispose();
            }
            const fsQuad: any = (shaderPass as any).fsQuad;
            if (fsQuad && fsQuad.dispose) {
              fsQuad.dispose();
            }
          }

          private _rebuildShaderPass(fragmentShader: string): void {
            const previousPass = this.shaderPass;
            const wasEnabled = this._isEnabled;
            const currentLayer = this._targetLayer;

            if (wasEnabled && currentLayer) {
              currentLayer.getRenderer().removePostProcessingPass(previousPass);
            }

            this.shaderPass = this._createShaderPass(fragmentShader);
            this.shaderPass.enabled = this._effectEnabled;
            this.shaderPass.uniforms.uMixStrength.value = this._mixStrength;

            if (wasEnabled && currentLayer) {
              currentLayer.getRenderer().addPostProcessingPass(this.shaderPass);
            }

            this._disposeShaderPass(previousPass);
          }

          isEnabled(target: EffectsTarget): boolean {
            return this._isEnabled;
          }

          setEnabled(target: EffectsTarget, enabled: boolean): boolean {
            if (this._isEnabled === enabled) {
              return true;
            }
            if (enabled) {
              return this.applyEffect(target);
            }
            return this.removeEffect(target);
          }

          applyEffect(target: EffectsTarget): boolean {
            if (!(target instanceof gdjs.Layer)) {
              return false;
            }
            target.getRenderer().addPostProcessingPass(this.shaderPass);
            this._targetLayer = target;
            this._isEnabled = true;
            return true;
          }

          removeEffect(target: EffectsTarget): boolean {
            if (!(target instanceof gdjs.Layer)) {
              return false;
            }
            target.getRenderer().removePostProcessingPass(this.shaderPass);
            this._targetLayer = null;
            this._isEnabled = false;
            return true;
          }

          updatePreRender(target: gdjs.EffectsTarget): any {
            if (!this._isEnabled || !this._effectEnabled) {
              return;
            }
            if (!(target instanceof gdjs.Layer)) {
              return;
            }

            const threeRenderer = target
              .getRuntimeScene()
              .getGame()
              .getRenderer()
              .getThreeRenderer();
            if (!threeRenderer) {
              return;
            }

            threeRenderer.getDrawingBufferSize(this._renderSize);
            this.shaderPass.uniforms.uResolution.value.set(
              Math.max(1, this._renderSize.x || target.getWidth()),
              Math.max(1, this._renderSize.y || target.getHeight())
            );
            this.shaderPass.uniforms.uTime.value = getTimeFromStartSeconds(target);
            this.shaderPass.uniforms.uMixStrength.value = this._mixStrength;
            this.shaderPass.enabled = this._effectEnabled;
          }

          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'strength') {
              this._mixStrength = clampMixStrength(value);
              this.shaderPass.uniforms.uMixStrength.value = this._mixStrength;
            }
          }

          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'strength') {
              return this._mixStrength;
            }
            return 0;
          }

          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName !== 'fragmentShader') {
              return;
            }

            this._fragmentShader = value || DEFAULT_SHADER_GRAPH_FRAGMENT_SHADER;
            this._rebuildShaderPass(this._fragmentShader);
          }

          updateColorParameter(parameterName: string, value: number): void {}

          getColorParameter(parameterName: string): number {
            return 0;
          }

          updateBooleanParameter(parameterName: string, value: boolean): void {
            if (parameterName === 'enabled') {
              this._effectEnabled = value;
              this.shaderPass.enabled = value;
            }
          }

          getNetworkSyncData(): ShaderGraphNetworkSyncData {
            return {
              e: this._effectEnabled,
              s: this._mixStrength,
              f: this._fragmentShader,
            };
          }

          updateFromNetworkSyncData(syncData: ShaderGraphNetworkSyncData): void {
            this._effectEnabled = syncData.e;
            this._mixStrength = clampMixStrength(syncData.s);
            this.shaderPass.uniforms.uMixStrength.value = this._mixStrength;
            if (syncData.f && syncData.f !== this._fragmentShader) {
              this._fragmentShader = syncData.f;
              this._rebuildShaderPass(this._fragmentShader);
            }
            this.shaderPass.enabled = this._effectEnabled;
          }
        })();
      }
    })()
  );
}
