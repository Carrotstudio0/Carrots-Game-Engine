namespace gdjs {
  const blendModes = ['normal', 'add', 'multiply', 'screen'] as const;

  const toPixiBlendMode = (value: number): PIXI.BLEND_MODES =>
    blendModes[Math.max(0, Math.min(blendModes.length - 1, Math.round(value)))] ||
    'normal';

  const fromPixiBlendMode = (value: PIXI.BLEND_MODES | number): number => {
    if (typeof value === 'number') {
      return value;
    }

    const index = blendModes.indexOf(value as (typeof blendModes)[number]);
    return index === -1 ? 0 : index;
  };

  interface BlendingModeFilterNetworkSyncData {
    a: number;
    bm: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'BlendingMode',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      makePIXIFilter(target: EffectsTarget, effectData) {
        const blendingModeFilter = new PIXI.AlphaFilter();
        return blendingModeFilter;
      }
      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {}
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        const blendingModeFilter = filter as unknown as PIXI.AlphaFilter;
        if (parameterName === 'alpha') {
          blendingModeFilter.alpha = value;
        } else if (parameterName === 'blendmode') {
          blendingModeFilter.blendMode = toPixiBlendMode(value);
        }
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        const blendingModeFilter = filter as unknown as PIXI.AlphaFilter;
        if (parameterName === 'alpha') {
          return blendingModeFilter.alpha;
        }
        if (parameterName === 'blendmode') {
          return fromPixiBlendMode(blendingModeFilter.blendMode);
        }
        return 0;
      }
      updateStringParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: string
      ) {}
      updateColorParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ): void {}
      getColorParameter(filter: PIXI.Filter, parameterName: string): number {
        return 0;
      }
      updateBooleanParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: boolean
      ) {}
      getNetworkSyncData(
        filter: PIXI.Filter
      ): BlendingModeFilterNetworkSyncData {
        const blendingModeFilter = filter as unknown as PIXI.AlphaFilter;
        return {
          a: blendingModeFilter.alpha,
          bm: fromPixiBlendMode(blendingModeFilter.blendMode),
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: BlendingModeFilterNetworkSyncData
      ) {
        const blendingModeFilter = filter as unknown as PIXI.AlphaFilter;
        blendingModeFilter.alpha = data.a;
        blendingModeFilter.blendMode = toPixiBlendMode(data.bm);
      }
    })()
  );
}
