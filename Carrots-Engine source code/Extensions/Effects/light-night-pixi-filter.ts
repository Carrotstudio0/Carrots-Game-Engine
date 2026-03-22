namespace gdjs {
  const getLightNightUniforms = (
    filter: PIXI.Filter
  ): { opacity: number } =>
    (
      filter.resources.lightNightUniforms as PIXI.UniformGroup & {
        uniforms: { opacity: number };
      }
    ).uniforms;

  /** @internal - should not have been exported? */
  export interface LightNightFilterExtra {
    o: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'LightNight',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      makePIXIFilter(target: EffectsTarget, effectData) {
        return PIXI.Filter.from({
          gl: {
            vertex: PIXI.defaultFilterVert,
            fragment: [
              'precision mediump float;',
              '',
              'varying vec2 vTextureCoord;',
              'uniform sampler2D uTexture;',
              'uniform float opacity;',
              '',
              'void main(void)',
              '{',
              '   mat3 nightMatrix = mat3(0.6, 0, 0, 0, 0.7, 0, 0, 0, 1.3);',
              '   gl_FragColor = texture2D(uTexture, vTextureCoord);',
              '   gl_FragColor.rgb = mix(gl_FragColor.rgb, nightMatrix * gl_FragColor.rgb, opacity);',
              '}',
            ].join('\n'),
            name: 'gdjs-light-night-filter',
          },
          resources: {
            lightNightUniforms: new PIXI.UniformGroup({
              opacity: { value: 1, type: 'f32' },
            }),
          },
        });
      }
      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {}
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        if (parameterName === 'opacity') {
          getLightNightUniforms(filter).opacity =
            gdjs.PixiFiltersTools.clampValue(value, 0, 1);
        }
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        if (parameterName === 'opacity') {
          return getLightNightUniforms(filter).opacity;
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
      getNetworkSyncData(filter: PIXI.Filter): LightNightFilterExtra {
        return {
          o: getLightNightUniforms(filter).opacity,
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: LightNightFilterExtra
      ) {
        getLightNightUniforms(filter).opacity = data.o;
      }
    })()
  );
}
