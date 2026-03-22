namespace gdjs {
  interface OutlineFilterNetworkSyncData {
    t: number;
    p: number;
    c: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'Outline',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      makePIXIFilter(target: EffectsTarget, effectData) {
        const OutlineFilter = (PIXI.filters as any).OutlineFilter;
        if (OutlineFilter) {
          try {
            return new OutlineFilter();
          } catch (error) {
            console.warn(
              'Failed to initialize OutlineFilter, falling back to AlphaFilter.',
              error
            );
          }
        }
        const fallbackFilter = new PIXI.AlphaFilter({
          alpha: 1,
        }) as unknown as PIXI.Filter & {
          thickness: number;
          padding: number;
          color: number;
        };
        fallbackFilter.thickness = 1;
        fallbackFilter.padding = 1;
        fallbackFilter.color = 0xffffff;
        return fallbackFilter;
      }
      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {}
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        if (parameterName === 'thickness') {
          outlineFilter.thickness = value;
        } else if (parameterName === 'padding') {
          outlineFilter.padding = value;
        }
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        if (parameterName === 'thickness') {
          return outlineFilter.thickness;
        }
        if (parameterName === 'padding') {
          return outlineFilter.padding;
        }
        return 0;
      }
      updateStringParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: string
      ) {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        if (parameterName === 'color') {
          outlineFilter.color = gdjs.rgbOrHexStringToNumber(value);
        }
      }
      updateColorParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ): void {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        if (parameterName === 'color') {
          outlineFilter.color = value;
        }
      }
      getColorParameter(filter: PIXI.Filter, parameterName: string): number {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        if (parameterName === 'color') {
          return outlineFilter.color;
        }
        return 0;
      }
      updateBooleanParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: boolean
      ) {}
      getNetworkSyncData(filter: PIXI.Filter): OutlineFilterNetworkSyncData {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        return {
          t: outlineFilter.thickness,
          p: outlineFilter.padding,
          c: outlineFilter.color,
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: OutlineFilterNetworkSyncData
      ) {
        const outlineFilter = filter as unknown as PIXI.filters.OutlineFilter;
        outlineFilter.thickness = data.t;
        outlineFilter.padding = data.p;
        outlineFilter.color = data.c;
      }
    })()
  );
}
