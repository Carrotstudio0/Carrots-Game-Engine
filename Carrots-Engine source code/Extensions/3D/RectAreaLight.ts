namespace gdjs {
  interface RectAreaLightFilterNetworkSyncData {
    i: number;
    c: number;
    px: number;
    py: number;
    pz: number;
    tx: number;
    ty: number;
    tz: number;
    w: number;
    h: number;
    t?: string;
  }

  interface LightingPipelineState {
    mode?: string;
    realtimeWeight?: number;
    physicallyCorrectLights?: boolean;
  }

  const lightingPipelineStateKey = '__gdScene3dLightingPipelineState';

  const getLightingPipelineState = (
    scene: THREE.Scene | null | undefined
  ): LightingPipelineState | null => {
    if (!scene) {
      return null;
    }
    const state = (scene as THREE.Scene & {
      userData?: { [key: string]: any };
    }).userData?.[lightingPipelineStateKey] as LightingPipelineState | undefined;
    return state || null;
  };

  const getRealtimeLightingMultiplier = (
    state: LightingPipelineState | null
  ): number => {
    if (!state || !state.mode) {
      return 1;
    }
    if (state.mode === 'realtime') {
      return 1;
    }
    if (state.mode === 'baked') {
      return 0;
    }
    return gdjs.evtTools.common.clamp(
      0,
      1,
      state.realtimeWeight !== undefined ? state.realtimeWeight : 1
    );
  };

  const initializeRectAreaLightSupport = (() => {
    let hasAttemptedInit = false;
    return (): void => {
      if (hasAttemptedInit) {
        return;
      }
      hasAttemptedInit = true;
      const threeAny = THREE as typeof THREE & {
        RectAreaLightUniformsLib?: {
          init?: () => void;
        };
      };
      if (
        threeAny.RectAreaLightUniformsLib &&
        typeof threeAny.RectAreaLightUniformsLib.init === 'function'
      ) {
        threeAny.RectAreaLightUniformsLib.init();
      }
    };
  })();

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::RectAreaLight',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          private _top: string = 'Z+';
          private _positionX: float = 0;
          private _positionY: float = 0;
          private _positionZ: float = 500;
          private _targetX: float = 0;
          private _targetY: float = 0;
          private _targetZ: float = 0;
          private _intensity: float = 40;
          private _width: float = 220;
          private _height: float = 120;
          private _isEnabled: boolean = false;
          private _light: THREE.RectAreaLight;
          private _targetVector: THREE.Vector3 = new THREE.Vector3();
          private _pipelineRealtimeMultiplier: float = 1;

          constructor() {
            initializeRectAreaLightSupport();
            this._light = new THREE.RectAreaLight();
            this._top = effectData.stringParameters.top || this._top;
            this._positionX =
              effectData.doubleParameters.positionX !== undefined
                ? effectData.doubleParameters.positionX
                : this._positionX;
            this._positionY =
              effectData.doubleParameters.positionY !== undefined
                ? effectData.doubleParameters.positionY
                : this._positionY;
            this._positionZ =
              effectData.doubleParameters.positionZ !== undefined
                ? effectData.doubleParameters.positionZ
                : this._positionZ;
            this._targetX =
              effectData.doubleParameters.targetX !== undefined
                ? effectData.doubleParameters.targetX
                : this._targetX;
            this._targetY =
              effectData.doubleParameters.targetY !== undefined
                ? effectData.doubleParameters.targetY
                : this._targetY;
            this._targetZ =
              effectData.doubleParameters.targetZ !== undefined
                ? effectData.doubleParameters.targetZ
                : this._targetZ;
            this._intensity = Math.max(
              0,
              effectData.doubleParameters.intensity !== undefined
                ? effectData.doubleParameters.intensity
                : this._intensity
            );
            this._width = Math.max(
              1,
              effectData.doubleParameters.width !== undefined
                ? effectData.doubleParameters.width
                : this._width
            );
            this._height = Math.max(
              1,
              effectData.doubleParameters.height !== undefined
                ? effectData.doubleParameters.height
                : this._height
            );
            this._light.color.setHex(
              gdjs.rgbOrHexStringToNumber(
                effectData.stringParameters.color || '255;255;255'
              )
            );
            this._light.intensity = this._intensity;
            this._light.width = this._width;
            this._light.height = this._height;
            this._updatePosition();
            this._updateTarget();
          }

          private _applyPipelineState(target: EffectsTarget): void {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            const pipelineState = getLightingPipelineState(scene);
            this._pipelineRealtimeMultiplier =
              getRealtimeLightingMultiplier(pipelineState);
            this._light.intensity =
              this._intensity * this._pipelineRealtimeMultiplier;

            if (!pipelineState || pipelineState.physicallyCorrectLights === undefined) {
              return;
            }
            const runtimeScene = target.getRuntimeScene
              ? target.getRuntimeScene()
              : null;
            if (!runtimeScene || !runtimeScene.getGame) {
              return;
            }
            const gameRenderer = runtimeScene.getGame().getRenderer();
            if (!gameRenderer || !(gameRenderer as any).getThreeRenderer) {
              return;
            }
            const threeRenderer = (gameRenderer as any).getThreeRenderer() as
              | THREE.WebGLRenderer
              | null;
            if (!threeRenderer) {
              return;
            }
            const rendererWithLightingMode = threeRenderer as
              | (THREE.WebGLRenderer & {
                  physicallyCorrectLights?: boolean;
                  useLegacyLights?: boolean;
                })
              | null;
            if (
              rendererWithLightingMode &&
              pipelineState.physicallyCorrectLights !== undefined
            ) {
              const shouldUsePhysicalLights =
                !!pipelineState.physicallyCorrectLights;
              if (
                typeof rendererWithLightingMode.physicallyCorrectLights ===
                'boolean'
              ) {
                rendererWithLightingMode.physicallyCorrectLights =
                  shouldUsePhysicalLights;
              }
              if (
                typeof rendererWithLightingMode.useLegacyLights === 'boolean'
              ) {
                rendererWithLightingMode.useLegacyLights =
                  !shouldUsePhysicalLights;
              }
            }
          }

          private _setAnyPosition(
            object3D: THREE.Object3D,
            x: float,
            y: float,
            z: float
          ): void {
            if (this._top === 'Y-') {
              object3D.position.set(x, -z, y);
            } else {
              object3D.position.set(x, y, z);
            }
          }

          private _setVectorPosition(
            vector3: THREE.Vector3,
            x: float,
            y: float,
            z: float
          ): void {
            if (this._top === 'Y-') {
              vector3.set(x, -z, y);
            } else {
              vector3.set(x, y, z);
            }
          }

          private _updatePosition(): void {
            this._setAnyPosition(
              this._light,
              this._positionX,
              this._positionY,
              this._positionZ
            );
          }

          private _updateTarget(): void {
            this._setVectorPosition(
              this._targetVector,
              this._targetX,
              this._targetY,
              this._targetZ
            );
            this._light.lookAt(this._targetVector);
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
            } else {
              return this.removeEffect(target);
            }
          }

          applyEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene) {
              return false;
            }
            scene.add(this._light);
            this._isEnabled = true;
            this._applyPipelineState(target);
            return true;
          }

          removeEffect(target: EffectsTarget): boolean {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            if (!scene) {
              return false;
            }
            scene.remove(this._light);
            this._isEnabled = false;
            return true;
          }

          updatePreRender(target: gdjs.EffectsTarget): any {
            if (!this._isEnabled) {
              return;
            }
            this._applyPipelineState(target);
          }

          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'intensity') {
              this._intensity = Math.max(0, value);
              this._light.intensity =
                this._intensity * this._pipelineRealtimeMultiplier;
            } else if (parameterName === 'positionX') {
              this._positionX = value;
              this._updatePosition();
            } else if (parameterName === 'positionY') {
              this._positionY = value;
              this._updatePosition();
            } else if (parameterName === 'positionZ') {
              this._positionZ = value;
              this._updatePosition();
            } else if (parameterName === 'targetX') {
              this._targetX = value;
              this._updateTarget();
            } else if (parameterName === 'targetY') {
              this._targetY = value;
              this._updateTarget();
            } else if (parameterName === 'targetZ') {
              this._targetZ = value;
              this._updateTarget();
            } else if (parameterName === 'width') {
              this._width = Math.max(1, value);
              this._light.width = this._width;
            } else if (parameterName === 'height') {
              this._height = Math.max(1, value);
              this._light.height = this._height;
            }
          }

          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'intensity') {
              return this._intensity;
            } else if (parameterName === 'positionX') {
              return this._positionX;
            } else if (parameterName === 'positionY') {
              return this._positionY;
            } else if (parameterName === 'positionZ') {
              return this._positionZ;
            } else if (parameterName === 'targetX') {
              return this._targetX;
            } else if (parameterName === 'targetY') {
              return this._targetY;
            } else if (parameterName === 'targetZ') {
              return this._targetZ;
            } else if (parameterName === 'width') {
              return this._width;
            } else if (parameterName === 'height') {
              return this._height;
            }
            return 0;
          }

          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'color') {
              this._light.color.setHex(gdjs.rgbOrHexStringToNumber(value));
            } else if (parameterName === 'top') {
              this._top = value;
              this._updatePosition();
              this._updateTarget();
            }
          }

          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'color') {
              this._light.color.setHex(value);
            }
          }

          getColorParameter(parameterName: string): number {
            if (parameterName === 'color') {
              return this._light.color.getHex();
            }
            return 0;
          }

          updateBooleanParameter(parameterName: string, value: boolean): void {}

          getNetworkSyncData(): RectAreaLightFilterNetworkSyncData {
            return {
              i: this._intensity,
              c: this._light.color.getHex(),
              px: this._positionX,
              py: this._positionY,
              pz: this._positionZ,
              tx: this._targetX,
              ty: this._targetY,
              tz: this._targetZ,
              w: this._width,
              h: this._height,
              t: this._top,
            };
          }

          updateFromNetworkSyncData(
            syncData: RectAreaLightFilterNetworkSyncData
          ): void {
            this._intensity = Math.max(0, syncData.i);
            this._light.intensity =
              this._intensity * this._pipelineRealtimeMultiplier;
            this._light.color.setHex(syncData.c);
            this._positionX = syncData.px;
            this._positionY = syncData.py;
            this._positionZ = syncData.pz;
            this._targetX = syncData.tx;
            this._targetY = syncData.ty;
            this._targetZ = syncData.tz;
            this._width = Math.max(1, syncData.w);
            this._height = Math.max(1, syncData.h);
            this._top = syncData.t || this._top;
            this._light.width = this._width;
            this._light.height = this._height;
            this._updatePosition();
            this._updateTarget();
          }
        })();
      }
    })()
  );
}

