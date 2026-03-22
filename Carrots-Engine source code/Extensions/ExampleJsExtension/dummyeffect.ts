//A simple PIXI filter doing some color changes
namespace gdjs {
  const logger = new gdjs.Logger('Dummy effect');

  const getDummyUniforms = (filter: PIXI.Filter): { opacity: number } =>
    (
      filter.resources.dummyUniforms as PIXI.UniformGroup & {
        uniforms: { opacity: number };
      }
    ).uniforms;

  // Register the effect type and associate it with a "filter creator" object, containing
  // functions to create and manipulate the filter.
  // Don't forget your extension name in the effect type!
  gdjs.PixiFiltersTools.registerFilterCreator(
    'MyDummyExtension::DummyEffect',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      // MakePIXIFilter should return a PIXI.Filter, that will be applied on the PIXI.Container (for layers)
      // or the PIXI.DisplayObject (for objects).
      makePIXIFilter(layer, effectData) {
        const filter = PIXI.Filter.from({
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
            name: 'gdjs-dummy-filter',
          },
          resources: {
            dummyUniforms: new PIXI.UniformGroup({
              opacity: { value: 1, type: 'f32' },
            }),
          },
        });

        // If you need to store the time or some state, you can set it up now:
        // filter._time = 0;
        // But be careful about the existing member of the filter (consider
        // updating the filter uniforms directly).

        // You can also access to the effect properties, classified by type:
        // `effectData.doubleParameters.opacity`
        // `effectData.stringParameters.someImage`
        // `effectData.stringParameters.someColor`
        // `effectData.booleanParameters.someBoolean`
        logger.info(
          'The PIXI texture found for the Dummy Effect (not actually used):',
          (
            layer
              .getRuntimeScene()
              .getGame()
              .getImageManager() as gdjs.PixiImageManager
          ).getPIXITexture(effectData.stringParameters.someImage)
        );
        return filter;
      }
      // Function called at every frame, after events and before the frame is rendered.
      updatePreRender(filter, layer) {
        // If your filter depends on the time, you can get the elapsed time
        // with `layer.getElapsedTime()`.
        // You can update the uniforms or other state of the filter.
      }
      // Function that will be called to update a (number) parameter of the PIXI filter with a new value
      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        if (parameterName === 'opacity') {
          getDummyUniforms(filter).opacity = gdjs.PixiFiltersTools.clampValue(
            value,
            0,
            1
          );
        }
      }
      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        if (parameterName === 'opacity') {
          return getDummyUniforms(filter).opacity;
        }
        return 0;
      }
      // Function that will be called to update a (string) parameter of the PIXI filter with a new value
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
      // Function that will be called to update a (boolean) parameter of the PIXI filter with a new value
      updateBooleanParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: boolean
      ) {}
      getNetworkSyncData(filter: PIXI.Filter): any {
        return { opacity: getDummyUniforms(filter).opacity };
      }
      updateFromNetworkSyncData(filter: PIXI.Filter, data: any) {
        getDummyUniforms(filter).opacity = data.opacity;
      }
    })()
  );
}
