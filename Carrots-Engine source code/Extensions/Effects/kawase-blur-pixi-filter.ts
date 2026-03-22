namespace gdjs {
  interface KawaseBlurFilterNetworkSyncData {
    px: number;
    py: number;
    b: number;
    q: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'KawaseBlur',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      private _asKawaseBlurFilter(
        filter: PIXI.Filter
      ): PIXI.filters.KawaseBlurFilter | null {
        const potentialKawaseFilter = filter as unknown as {
          pixelSize?: [number, number];
          blur?: number;
          quality?: number;
        };
        return potentialKawaseFilter &&
          potentialKawaseFilter.pixelSize &&
          typeof potentialKawaseFilter.blur === 'number' &&
          typeof potentialKawaseFilter.quality === 'number'
          ? (filter as unknown as PIXI.filters.KawaseBlurFilter)
          : null;
      }

      makePIXIFilter(target: EffectsTarget, effectData) {
        try {
          return new PIXI.filters.KawaseBlurFilter();
        } catch (error) {
          console.warn(
            'Failed to create KawaseBlurFilter, falling back to AlphaFilter.',
            error
          );
          return new PIXI.AlphaFilter();
        }
      }
      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {}
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        const kawaseBlurFilter = this._asKawaseBlurFilter(filter);
        if (!kawaseBlurFilter) return;
        if (parameterName === 'pixelizeX') {
          kawaseBlurFilter.pixelSize[0] = value;
        } else if (parameterName === 'pixelizeY') {
          kawaseBlurFilter.pixelSize[1] = value;
        } else if (parameterName === 'blur') {
          kawaseBlurFilter.blur = value;
        } else if (parameterName === 'quality') {
          kawaseBlurFilter.quality = value;
        }
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        const kawaseBlurFilter = this._asKawaseBlurFilter(filter);
        if (!kawaseBlurFilter) return 0;
        if (parameterName === 'pixelizeX') {
          return kawaseBlurFilter.pixelSize[0];
        }
        if (parameterName === 'pixelizeY') {
          return kawaseBlurFilter.pixelSize[1];
        }
        if (parameterName === 'blur') {
          return kawaseBlurFilter.blur;
        }
        if (parameterName === 'quality') {
          return kawaseBlurFilter.quality;
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
      getNetworkSyncData(filter: PIXI.Filter): KawaseBlurFilterNetworkSyncData {
        const kawaseBlurFilter = this._asKawaseBlurFilter(filter);
        if (!kawaseBlurFilter) {
          return {
            px: 0,
            py: 0,
            b: 0,
            q: 0,
          };
        }
        return {
          px: kawaseBlurFilter.pixelSize[0],
          py: kawaseBlurFilter.pixelSize[1],
          b: kawaseBlurFilter.blur,
          q: kawaseBlurFilter.quality,
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: KawaseBlurFilterNetworkSyncData
      ) {
        const kawaseBlurFilter = this._asKawaseBlurFilter(filter);
        if (!kawaseBlurFilter) return;
        kawaseBlurFilter.pixelSize[0] = data.px;
        kawaseBlurFilter.pixelSize[1] = data.py;
        kawaseBlurFilter.blur = data.b;
        kawaseBlurFilter.quality = data.q;
      }
    })()
  );
}
