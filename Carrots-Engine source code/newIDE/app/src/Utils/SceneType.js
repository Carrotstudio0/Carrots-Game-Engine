// @flow

export type SceneType = '2d' | '3d' | '2.5d';

export const SCENE_TYPE_2D: SceneType = '2d';
export const SCENE_TYPE_3D: SceneType = '3d';
export const SCENE_TYPE_2_5D: SceneType = '2.5d';

const SCENE_TYPES_EXTENSION_NAME = 'CarrotsEngine';
const SCENE_TYPES_PROPERTY_NAME = 'sceneTypesV1';
const PROJECT_SCENE_TYPE_PROPERTY_NAME = 'projectSceneTypeV1';
const DEFAULT_PROJECT_SCENE_TYPE: SceneType = SCENE_TYPE_2_5D;
const validSceneTypes = new Set([
  SCENE_TYPE_2D,
  SCENE_TYPE_3D,
  SCENE_TYPE_2_5D,
]);

type SceneTypesByName = { [sceneName: string]: SceneType };

const asSceneType = (value: any): ?SceneType => {
  // Legacy compatibility for previous in-progress values.
  if (value === 'ui') return SCENE_TYPE_2D;
  return typeof value === 'string' && validSceneTypes.has(value) ? value : null;
};

const loadSceneTypes = (project: gdProject): SceneTypesByName => {
  try {
    const rawValue = project
      .getExtensionProperties()
      .getValue(SCENE_TYPES_EXTENSION_NAME, SCENE_TYPES_PROPERTY_NAME);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const sceneTypes = {};
    Object.keys(parsed).forEach(sceneName => {
      const sceneType = asSceneType(parsed[sceneName]);
      if (sceneType) {
        sceneTypes[sceneName] = sceneType;
      }
    });
    return sceneTypes;
  } catch (error) {
    return {};
  }
};

const saveSceneTypes = (project: gdProject, sceneTypes: SceneTypesByName) => {
  const hasSomeSceneTypes = Object.keys(sceneTypes).length > 0;
  project
    .getExtensionProperties()
    .setValue(
      SCENE_TYPES_EXTENSION_NAME,
      SCENE_TYPES_PROPERTY_NAME,
      hasSomeSceneTypes ? JSON.stringify(sceneTypes) : ''
    );
};

const loadProjectSceneType = (project: gdProject): SceneType => {
  const rawProjectSceneType = project
    .getExtensionProperties()
    .getValue(SCENE_TYPES_EXTENSION_NAME, PROJECT_SCENE_TYPE_PROPERTY_NAME);
  return asSceneType(rawProjectSceneType) || DEFAULT_PROJECT_SCENE_TYPE;
};

export const getProjectSceneType = (project: gdProject): SceneType =>
  loadProjectSceneType(project);

export const setProjectSceneType = (
  project: gdProject,
  sceneType: SceneType
): boolean => {
  if (getProjectSceneType(project) === sceneType) return false;
  project
    .getExtensionProperties()
    .setValue(
      SCENE_TYPES_EXTENSION_NAME,
      PROJECT_SCENE_TYPE_PROPERTY_NAME,
      sceneType
    );
  return true;
};

export const getSceneType = (project: gdProject, sceneName: string): SceneType => {
  const sceneTypes = loadSceneTypes(project);
  return sceneTypes[sceneName] || getProjectSceneType(project);
};

export const ensureSceneTypeExists = (
  project: gdProject,
  sceneName: string,
  defaultSceneType: SceneType = getProjectSceneType(project)
): boolean => {
  const sceneTypes = loadSceneTypes(project);
  if (sceneTypes[sceneName]) return false;
  sceneTypes[sceneName] = defaultSceneType;
  saveSceneTypes(project, sceneTypes);
  return true;
};

export const setSceneType = (
  project: gdProject,
  sceneName: string,
  sceneType: SceneType
): boolean => {
  const sceneTypes = loadSceneTypes(project);
  if (sceneTypes[sceneName] === sceneType) return false;
  sceneTypes[sceneName] = sceneType;
  saveSceneTypes(project, sceneTypes);
  return true;
};

export const copySceneType = (
  project: gdProject,
  sourceSceneName: string,
  targetSceneName: string
): boolean => {
  const sceneTypes = loadSceneTypes(project);
  const sourceSceneType = sceneTypes[sourceSceneName];

  if (sourceSceneType) {
    if (sceneTypes[targetSceneName] === sourceSceneType) return false;
    sceneTypes[targetSceneName] = sourceSceneType;
    saveSceneTypes(project, sceneTypes);
    return true;
  }

  if (!sceneTypes[targetSceneName]) return false;
  delete sceneTypes[targetSceneName];
  saveSceneTypes(project, sceneTypes);
  return true;
};

export const renameSceneType = (
  project: gdProject,
  oldSceneName: string,
  newSceneName: string
): boolean => {
  if (oldSceneName === newSceneName) return false;
  const sceneTypes = loadSceneTypes(project);
  const sceneType = sceneTypes[oldSceneName];
  if (!sceneType) return false;
  delete sceneTypes[oldSceneName];
  sceneTypes[newSceneName] = sceneType;
  saveSceneTypes(project, sceneTypes);
  return true;
};

export const removeSceneType = (
  project: gdProject,
  sceneName: string
): boolean => {
  const sceneTypes = loadSceneTypes(project);
  if (!sceneTypes[sceneName]) return false;
  delete sceneTypes[sceneName];
  saveSceneTypes(project, sceneTypes);
  return true;
};

export const canSceneContain2DObjects = (sceneType: SceneType): boolean =>
  sceneType !== SCENE_TYPE_3D;

export const canSceneContain3DObjects = (sceneType: SceneType): boolean =>
  sceneType !== SCENE_TYPE_2D;

export const is3DObjectCompatibleWithSceneType = (
  sceneType: SceneType,
  is3DObject: boolean
): boolean =>
  is3DObject
    ? canSceneContain3DObjects(sceneType)
    : canSceneContain2DObjects(sceneType);

export const getRequiredGameEditorModeForSceneType = (
  sceneType: SceneType
): ?('embedded-game' | 'instances-editor') => {
  if (sceneType === SCENE_TYPE_2D) return 'instances-editor';
  if (sceneType === SCENE_TYPE_3D) return 'embedded-game';
  return null;
};
