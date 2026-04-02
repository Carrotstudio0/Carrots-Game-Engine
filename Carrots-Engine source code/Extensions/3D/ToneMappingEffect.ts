namespace gdjs {
  interface ToneMappingNetworkSyncData {
    m: string;
    x: number;
    e: boolean;
  }

  const normalizeToneMappingMode = (mode: string): string => {
    const normalized = (mode || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '');
    if (normalized === 'reinhard') {
      return 'Reinhard';
    }
    if (normalized === 'cineon') {
      return 'Cineon';
    }
    if (normalized === 'linear') {
      return 'Linear';
    }
    if (normalized === 'agx') {
      return 'AgX';
    }
    if (normalized === 'neutral') {
      return 'Neutral';
    }
    return 'AgX';
  };

  const getToneMappingConstant = (mode: string): THREE.ToneMapping => {
    if (mode === 'AgX' && typeof (THREE as any).AgXToneMapping === 'number') {
      return (THREE as any).AgXToneMapping;
    }
    if (
      mode === 'Neutral' &&
      typeof (THREE as any).NeutralToneMapping === 'number'
    ) {
      return (THREE as any).NeutralToneMapping;
    }
    if (mode === 'Reinhard') {
      return THREE.ReinhardToneMapping;
    }
    if (mode === 'Cineon') {
      return THREE.CineonToneMapping;
    }
    if (mode === 'Linear') {
      // Requested behavior: "Linear" acts as no tone mapping.
      return THREE.NoToneMapping;
    }
    return THREE.ACESFilmicToneMapping;
  };

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::ToneMapping',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }
        return new (class implements gdjs.PixiFiltersTools.Filter {
          _isEnabled: boolean;
          _effectEnabled: boolean;
          _mode: string;
          _exposure: number;

          constructor() {
            this._isEnabled = false;
            this._effectEnabled = true;
            this._mode = 'AgX';
            this._exposure = 1.0;
            void effectData;
          }

          private _getRenderer(
            target: EffectsTarget
          ): THREE.WebGLRenderer | null {
            return gdjs.getThreeRendererFromEffectsTarget(target);
          }

          private _applyToneMapping(target: EffectsTarget): boolean {
            const renderer = this._getRenderer(target);
            const mode = normalizeToneMappingMode(this._mode);
            return gdjs.applyThreeRendererToneMapping(
              renderer,
              getToneMappingConstant(mode),
              this._exposure
            );
          }

          private _disableToneMapping(target: EffectsTarget): boolean {
            return gdjs.disableThreeRendererToneMapping(
              this._getRenderer(target)
            );
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
            this._isEnabled = true;
            if (!this._effectEnabled) {
              return this._disableToneMapping(target);
            }
            return this._applyToneMapping(target);
          }

          removeEffect(target: EffectsTarget): boolean {
            if (!(target instanceof gdjs.Layer)) {
              return false;
            }
            this._isEnabled = false;
            return this._disableToneMapping(target);
          }

          updatePreRender(target: gdjs.EffectsTarget): any {
            if (!this._isEnabled) {
              return;
            }

            if (this._effectEnabled) {
              this._applyToneMapping(target);
            } else {
              this._disableToneMapping(target);
            }
          }

          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'exposure') {
              this._exposure = Math.max(0, value);
            }
          }

          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'exposure') {
              return this._exposure;
            }
            return 0;
          }

          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'mode') {
              this._mode = normalizeToneMappingMode(value);
            }
          }

          updateColorParameter(parameterName: string, value: number): void {}

          getColorParameter(parameterName: string): number {
            return 0;
          }

          updateBooleanParameter(parameterName: string, value: boolean): void {
            if (parameterName === 'enabled') {
              this._effectEnabled = value;
            }
          }

          getNetworkSyncData(): ToneMappingNetworkSyncData {
            return {
              m: this._mode,
              x: this._exposure,
              e: this._effectEnabled,
            };
          }

          updateFromNetworkSyncData(
            syncData: ToneMappingNetworkSyncData
          ): void {
            this._mode = normalizeToneMappingMode(syncData.m);
            this._exposure = Math.max(0, syncData.x);
            this._effectEnabled = !!syncData.e;
          }
        })();
      }
    })()
  );
}
