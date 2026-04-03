namespace gdjs {
  type ThreeRendererLike =
    | gdjs.ThreeRendererCompat
    | (Record<string, any> & {
        isWebGPURenderer?: boolean;
      });

  export const hasThreeWebGpuBundleSupport = (): boolean => {
    return (
      typeof THREE_WEBGPU !== 'undefined' &&
      !!(THREE_WEBGPU as any).WebGPURenderer
    );
  };

  export const hasThreeTslBundleSupport = (): boolean => {
    return typeof THREE_TSL !== 'undefined' && typeof THREE_TSL.Fn === 'function';
  };

  export const canUseThreeTslNodeMaterials = (
    renderer: ThreeRendererLike
  ): boolean => {
    const rendererWithNodeState = renderer as Record<string, any> | null;
    return (
      !!renderer &&
      rendererWithNodeState?.isWebGPURenderer === true &&
      gdjs.hasThreeWebGpuBundleSupport() &&
      gdjs.hasThreeTslBundleSupport()
    );
  };

  export const getThreeShadingSupportState = (
    renderer: ThreeRendererLike
  ): {
    webGpuBundleAvailable: boolean;
    tslBundleAvailable: boolean;
    nodeMaterialsEnabled: boolean;
  } => {
    const rendererWithNodeState = renderer as Record<string, any> | null;
    const webGpuBundleAvailable = gdjs.hasThreeWebGpuBundleSupport();
    const tslBundleAvailable = gdjs.hasThreeTslBundleSupport();

    return {
      webGpuBundleAvailable,
      tslBundleAvailable,
      nodeMaterialsEnabled:
        webGpuBundleAvailable &&
        tslBundleAvailable &&
        !!renderer &&
        rendererWithNodeState?.isWebGPURenderer === true,
    };
  };
}
