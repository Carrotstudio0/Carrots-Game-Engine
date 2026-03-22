namespace gdjs {
  const getNightUniforms = (
    filter: PIXI.Filter
  ): { intensity: number; opacity: number } =>
    (
      filter.resources.nightUniforms as PIXI.UniformGroup & {
        uniforms: { intensity: number; opacity: number };
      }
    ).uniforms;

  interface NightFilterNetworkSyncData {
    i: number;
    o: number;
  }
  gdjs.PixiFiltersTools.registerFilterCreator(
    'Night',
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
              'uniform float intensity;',
              'uniform float opacity;',
              '',
              'void main(void)',
              '{',
              '   mat3 nightMatrix = mat3(-2.0 * intensity, -1.0 * intensity, 0, -1.0 * intensity, 0, 1.0 * intensity, 0, 1.0 * intensity, 2.0 * intensity);',
              '   gl_FragColor = texture2D(uTexture, vTextureCoord);',
              '   gl_FragColor.rgb = mix(gl_FragColor.rgb, nightMatrix * gl_FragColor.rgb, opacity);',
              '}',
            ].join('\n'),
            name: 'gdjs-night-filter',
          },
          resources: {
            nightUniforms: new PIXI.UniformGroup({
              intensity: { value: 1, type: 'f32' },
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
        if (parameterName !== 'intensity' && parameterName !== 'opacity') {
          return;
        }
        getNightUniforms(filter)[parameterName] =
          gdjs.PixiFiltersTools.clampValue(value, 0, 1);
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        return getNightUniforms(filter)[parameterName] || 0;
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
      getNetworkSyncData(filter: PIXI.Filter): NightFilterNetworkSyncData {
        const uniforms = getNightUniforms(filter);
        return {
          i: uniforms.intensity,
          o: uniforms.opacity,
        };
      }
      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: NightFilterNetworkSyncData
      ) {
        const uniforms = getNightUniforms(filter);
        uniforms.intensity = data.i;
        uniforms.opacity = data.o;
      }
    })()
  );
}
