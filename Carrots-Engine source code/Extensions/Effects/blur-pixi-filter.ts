namespace gdjs {
  interface BlurFilterNetworkSyncData {
    b: number;
    q: number;
    ks: number;
    res: number | 'inherit';
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'Blur',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      makePIXIFilter(target: EffectsTarget, effectData) {
        const blur = new PIXI.BlurFilter();
        return blur;
      }
      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {}
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        const blurFilter = filter as PIXI.BlurFilter &
          Record<string, number | 'inherit'>;
        if (
          parameterName !== 'blur' &&
          parameterName !== 'quality' &&
          parameterName !== 'kernelSize' &&
          parameterName !== 'resolution'
        ) {
          return;
        }
        if (parameterName === 'kernelSize') {
          value = gdjs.PixiFiltersTools.clampKernelSize(value, 5, 15);
        }
        blurFilter[parameterName] = value;
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        const blurFilter = filter as PIXI.BlurFilter &
          Record<string, number | 'inherit'>;
        const value = blurFilter[parameterName];
        return typeof value === 'number' ? value : 0;
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
      getNetworkSyncData(filter: PIXI.Filter): BlurFilterNetworkSyncData {
        const blurFilter = filter as PIXI.BlurFilter &
          Record<string, number | 'inherit'>;
        return {
          b: blurFilter['blur'] as number,
          q: blurFilter['quality'] as number,
          ks: blurFilter['kernelSize'] as number,
          res: blurFilter['resolution'],
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: BlurFilterNetworkSyncData
      ) {
        const blurFilter = filter as PIXI.BlurFilter &
          Record<string, number | 'inherit'>;
        blurFilter['blur'] = data.b;
        blurFilter['quality'] = data.q;
        blurFilter['kernelSize'] = data.ks;
        blurFilter['resolution'] = data.res;
      }
    })()
  );
}
