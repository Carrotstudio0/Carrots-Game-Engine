// @flow

export type RenderOcclusionCullingMode =
  | 'conservative'
  | 'aggressive'
  | 'disabled';

export const RENDER_CULLING_EXTENSION_NAME = 'CarrotsEngine';
export const RENDER_OCCLUSION_CULLING_PROPERTY_NAME =
  'renderOcclusionCullingMode';

const sanitizeRenderOcclusionCullingMode = (
  value: string
): RenderOcclusionCullingMode => {
  if (value === 'aggressive') return 'aggressive';
  if (value === 'disabled') return 'disabled';
  return 'disabled';
};

export const getProjectRenderOcclusionCullingMode = (
  project: gdProject
): RenderOcclusionCullingMode => {
  try {
    const value = project
      .getExtensionProperties()
      .getValue(
        RENDER_CULLING_EXTENSION_NAME,
        RENDER_OCCLUSION_CULLING_PROPERTY_NAME
      );
    return sanitizeRenderOcclusionCullingMode(value);
  } catch (error) {
    return 'disabled';
  }
};

export const setProjectRenderOcclusionCullingMode = (
  project: gdProject,
  mode: RenderOcclusionCullingMode
): void => {
  project
    .getExtensionProperties()
    .setValue(
      RENDER_CULLING_EXTENSION_NAME,
      RENDER_OCCLUSION_CULLING_PROPERTY_NAME,
      mode
    );
};
