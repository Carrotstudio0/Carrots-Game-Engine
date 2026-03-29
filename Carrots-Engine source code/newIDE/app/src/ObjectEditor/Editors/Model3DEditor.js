// @flow

import * as React from 'react';
import { Trans } from '@lingui/macro';
import { t } from '@lingui/macro';
import { type EditorProps } from './EditorProps.flow';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../../UI/Layout';
import Text from '../../UI/Text';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import useForceUpdate from '../../Utils/UseForceUpdate';
import Checkbox from '../../UI/Checkbox';
import { Column, Line, Spacer } from '../../UI/Grid';
import SelectField from '../../UI/SelectField';
import SelectOption from '../../UI/SelectOption';
import AlertMessage from '../../UI/AlertMessage';
import IconButton from '../../UI/IconButton';
import RaisedButton from '../../UI/RaisedButton';
import FlatButton from '../../UI/FlatButton';
import { mapFor, mapVector } from '../../Utils/MapFor';
import ScrollView, { type ScrollViewInterface } from '../../UI/ScrollView';
import { EmptyPlaceholder } from '../../UI/EmptyPlaceholder';
import Add from '../../UI/CustomSvgIcons/Add';
import Trash from '../../UI/CustomSvgIcons/Trash';
import { makeDragSourceAndDropTarget } from '../../UI/DragAndDrop/DragSourceAndDropTarget';
import { DragHandleIcon } from '../../UI/DragHandle';
import DropIndicator from '../../UI/SortableVirtualizedItemList/DropIndicator';
import GDevelopThemeContext from '../../UI/Theme/GDevelopThemeContext';
import PixiResourcesLoader from '../../ObjectsRendering/PixiResourcesLoader';
import ResourcesLoader from '../../ResourcesLoader';
import useAlertDialog from '../../UI/Alert/useAlertDialog';
import ShaderGraphEditorDialog from '../../EffectsList/ShaderGraphEditor/ShaderGraphEditorDialog';
import {
  SHADER_GRAPH_DEFINITION_PARAMETER,
  SHADER_GRAPH_ENABLED_PARAMETER,
  SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER,
  SHADER_GRAPH_STRENGTH_PARAMETER,
  SHADER_GRAPH_VERSION_PARAMETER,
} from '../../EffectsList/ShaderGraphEditor/ShaderGraphModel';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import * as THREE from 'three';
import { PropertyCheckbox, PropertyField } from './PropertyFields';
import ResourceSelectorWithThumbnail from '../../ResourcesList/ResourceSelectorWithThumbnail';

const gd: libGDevelop = global.gd;

// $FlowFixMe[underconstrained-implicit-instantiation]
const DragSourceAndDropTarget = makeDragSourceAndDropTarget(
  'model3d-animations-list'
);

const styles = {
  organizerPanel: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    border: '1px solid rgba(72, 179, 126, 0.24)',
    background:
      'radial-gradient(circle at 14% 12%, rgba(35, 132, 84, 0.16), rgba(14, 24, 30, 0.96) 48%), linear-gradient(145deg, rgba(12, 18, 26, 0.95), rgba(14, 23, 19, 0.94))',
  },
  organizerSearchInput: {
    width: '100%',
    borderRadius: 8,
    border: '1px solid rgba(120, 210, 167, 0.35)',
    background: 'rgba(8, 13, 20, 0.84)',
    color: '#e9f4ff',
    padding: '8px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  quickNavRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  sectionCard: {
    borderRadius: 10,
    border: '1px solid rgba(93, 184, 139, 0.18)',
    padding: 10,
    marginBottom: 10,
    background: 'rgba(11, 17, 26, 0.36)',
  },
  rowContainer: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 5,
  },
  rowContent: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
  },
  materialPanel: {
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  materialSlotHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  materialSlotBadge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  materialDropZone: {
    minWidth: 220,
    borderRadius: 12,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'border-color 180ms ease, background-color 180ms ease',
  },
  materialDropHint: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
  materialSlotSubtitle: {
    fontSize: 12,
    opacity: 0.85,
  },
  materialSphere: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    backgroundPosition: 'center, center, center, center',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
    backgroundSize: 'cover, 100% 100%, 100% 100%, 100% 100%',
    boxShadow:
      '0 16px 30px rgba(0,0,0,0.36), inset 0 1px 2px rgba(255,255,255,0.55)',
  },
};

const epsilon = 1 / (1 << 16);

const normalizeResourceFilePath = (filePath: string): string =>
  filePath
    .trim()
    .replace(/^file:\/\//i, '')
    .replace(/^\/([a-z]:)/i, '$1')
    .replace(/\\/g, '/')
    .toLowerCase();

const removeTrailingZeroes = (value: string) => {
  for (let index = value.length - 1; index > 0; index--) {
    if (value.charAt(index) === '.') {
      return value.substring(0, index);
    }
    if (value.charAt(index) !== '0') {
      return value;
    }
  }
  return value;
};

export const hasLight = (layout: ?gd.Layout): boolean => {
  if (!layout) {
    return true;
  }
  const objects = layout.getObjects();
  for (
    let objectIndex = 0;
    objectIndex < objects.getObjectsCount();
    objectIndex++
  ) {
    const object = objects.getObjectAt(objectIndex);
    if (object.getType() === 'Scene3D::SpotLightObject') {
      return true;
    }
  }
  for (let layerIndex = 0; layerIndex < layout.getLayersCount(); layerIndex++) {
    const layer = layout.getLayerAt(layerIndex);
    if (layer.getRenderingType() === '2d') {
      continue;
    }
    const effects = layer.getEffects();
    for (
      let effectIndex = 0;
      effectIndex < effects.getEffectsCount();
      effectIndex++
    ) {
      const effect = effects.getEffectAt(effectIndex);
      const type = effect.getEffectType();
      if (
        type === 'Scene3D::AmbientLight' ||
        type === 'Scene3D::DirectionalLight' ||
        type === 'Scene3D::HemisphereLight'
      ) {
        return true;
      }
    }
  }
  return false;
};

const Model3DEditor = ({
  objectConfiguration,
  project,
  layout,
  eventsFunctionsExtension,
  eventsBasedObject,
  object,
  onSizeUpdated,
  onObjectUpdated,
  resourceManagementProps,
  projectScopedContainersAccessor,
  renderObjectNameField,
}: EditorProps): React.Node => {
  const scrollView = React.useRef<?ScrollViewInterface>(null);

  const [
    justAddedAnimationName,
    setJustAddedAnimationName,
  ] = React.useState<?string>(null);
  const justAddedAnimationElement = React.useRef<?any>(null);

  React.useEffect(
    () => {
      if (
        scrollView.current &&
        justAddedAnimationElement.current &&
        justAddedAnimationName
      ) {
        scrollView.current.scrollTo(justAddedAnimationElement.current);
        setJustAddedAnimationName(null);
        justAddedAnimationElement.current = null;
      }
    },
    [justAddedAnimationName]
  );
  const { showAlert } = useAlertDialog();

  const draggedAnimationIndex = React.useRef<number | null>(null);

  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const forceUpdate = useForceUpdate();

  const model3DConfiguration = gd.asModel3DConfiguration(objectConfiguration);
  const properties = objectConfiguration.getProperties();

  const [nameErrors, setNameErrors] = React.useState<{ [number]: React.Node }>(
    {}
  );

  const getPropertyByName = React.useCallback(
    (propertyName: string) => {
      try {
        return properties.get(propertyName);
      } catch (error) {
        return null;
      }
    },
    [properties]
  );
  const getPropertyValue = React.useCallback(
    (propertyName: string, fallbackValue: string = ''): string => {
      const property = getPropertyByName(propertyName);
      return property ? property.getValue() : fallbackValue;
    },
    [getPropertyByName]
  );
  const hasMaterialBlueprintSupport = React.useMemo(
    () => !!getPropertyByName('materialGraphEnabled'),
    [getPropertyByName]
  );
  const hasMaterialTextureSupport = React.useMemo(
    () => !!getPropertyByName('materialTextureResourceName'),
    [getPropertyByName]
  );

  const onChangeProperty = React.useCallback(
    (property: string, value: string) => {
      objectConfiguration.updateProperty(property, value);
      forceUpdate();
    },
    [objectConfiguration, forceUpdate]
  );
  const [isMaterialSlotDragOver, setIsMaterialSlotDragOver] =
    React.useState<boolean>(false);
  const materialTextureResourceName = getPropertyValue(
    'materialTextureResourceName',
    ''
  );
  const materialTexturePreviewUrl = React.useMemo(
    () => {
      if (!materialTextureResourceName) {
        return '';
      }
      return ResourcesLoader.getResourceFullUrl(
        project,
        materialTextureResourceName,
        {}
      );
    },
    [project, materialTextureResourceName]
  );
  const applyMaterialTextureResource = React.useCallback(
    (resourceName: string) => {
      onChangeProperty('materialTextureResourceName', resourceName);
      if (onObjectUpdated) onObjectUpdated();
    },
    [onChangeProperty, onObjectUpdated]
  );
  const findImageResourceByName = React.useCallback(
    (resourceName: string): ?string => {
      if (!resourceName) {
        return null;
      }

      const resourcesManager = project.getResourcesManager();
      if (!resourcesManager.hasResource(resourceName)) {
        return null;
      }

      const resource = resourcesManager.getResource(resourceName);
      return resource && resource.getKind() === 'image' ? resourceName : null;
    },
    [project]
  );
  const findImageResourceByFilePath = React.useCallback(
    (filePath: string): ?string => {
      if (!filePath) {
        return null;
      }

      const normalizedDroppedPath = normalizeResourceFilePath(filePath);
      if (!normalizedDroppedPath) {
        return null;
      }
      const droppedBaseName = normalizedDroppedPath.split('/').pop() || '';
      const resourcesManager = project.getResourcesManager();
      const allResourceNames = mapVector(
        resourcesManager.getAllResourceNames(),
        resourceName => resourceName
      );

      for (const resourceName of allResourceNames) {
        if (!resourcesManager.hasResource(resourceName)) {
          continue;
        }
        const resource = resourcesManager.getResource(resourceName);
        if (!resource || resource.getKind() !== 'image') {
          continue;
        }

        const normalizedResourcePath = normalizeResourceFilePath(
          resource.getFile() || ''
        );
        if (!normalizedResourcePath) {
          continue;
        }

        if (
          normalizedResourcePath === normalizedDroppedPath ||
          (droppedBaseName &&
            normalizedResourcePath.endsWith('/' + droppedBaseName))
        ) {
          return resourceName;
        }
      }

      return null;
    },
    [project]
  );
  const findImageResourceFromDroppedValue = React.useCallback(
    (rawCandidate: string): ?string => {
      if (!rawCandidate) {
        return null;
      }

      const candidate = rawCandidate.trim().replace(/^"|"$/g, '');
      if (!candidate) {
        return null;
      }

      const directResource = findImageResourceByName(candidate);
      if (directResource) {
        return directResource;
      }

      const decodedCandidate = (() => {
        try {
          return decodeURIComponent(candidate);
        } catch (error) {
          return candidate;
        }
      })();
      const decodedResource = findImageResourceByName(decodedCandidate);
      if (decodedResource) {
        return decodedResource;
      }

      const candidateByPath =
        findImageResourceByFilePath(decodedCandidate) ||
        findImageResourceByFilePath(candidate);
      if (candidateByPath) {
        return candidateByPath;
      }

      const parsedJson = (() => {
        try {
          return JSON.parse(candidate);
        } catch (error) {
          return null;
        }
      })();
      if (parsedJson && typeof parsedJson === 'object') {
        const resourceNameFromJson =
          typeof parsedJson.resourceName === 'string'
            ? parsedJson.resourceName
            : typeof parsedJson.name === 'string'
            ? parsedJson.name
            : '';
        if (resourceNameFromJson) {
          const jsonResource = findImageResourceByName(resourceNameFromJson);
          if (jsonResource) {
            return jsonResource;
          }
        }

        const resourcePathFromJson =
          typeof parsedJson.file === 'string'
            ? parsedJson.file
            : typeof parsedJson.path === 'string'
            ? parsedJson.path
            : '';
        if (resourcePathFromJson) {
          const jsonPathResource =
            findImageResourceByFilePath(resourcePathFromJson);
          if (jsonPathResource) {
            return jsonPathResource;
          }
        }
      }

      if (candidate.includes('\n') || candidate.includes('\r')) {
        const lines = candidate
          .split(/\r?\n/g)
          .map(line => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          const lineResource =
            findImageResourceByName(line) || findImageResourceByFilePath(line);
          if (lineResource) {
            return lineResource;
          }
        }
      }

      return null;
    },
    [findImageResourceByFilePath, findImageResourceByName]
  );
  const extractMaterialTextureFromDrop = React.useCallback(
    (event: any): ?string => {
      const dataTransfer = event && event.dataTransfer;
      if (!dataTransfer) {
        return null;
      }

      const transferKeys = [
        'application/x-gdevelop-resource-name',
        'application/x-gdevelop-resource',
        'text/resource-name',
        'text/plain',
        'text/uri-list',
      ];
      for (const key of transferKeys) {
        let data = '';
        try {
          data = dataTransfer.getData(key) || '';
        } catch (error) {
          data = '';
        }
        const resourceFromData = findImageResourceFromDroppedValue(data);
        if (resourceFromData) {
          return resourceFromData;
        }
      }

      if (dataTransfer.files && dataTransfer.files.length > 0) {
        for (const file of dataTransfer.files) {
          const filePath = file.path || file.name || '';
          const resourceFromFile = findImageResourceByFilePath(filePath);
          if (resourceFromFile) {
            return resourceFromFile;
          }
        }
      }

      return null;
    },
    [findImageResourceByFilePath, findImageResourceFromDroppedValue]
  );
  const onMaterialSlotDrop = React.useCallback(
    (event: any) => {
      event.preventDefault();
      event.stopPropagation();
      setIsMaterialSlotDragOver(false);
      if (!hasMaterialTextureSupport) {
        return;
      }

      const droppedResourceName = extractMaterialTextureFromDrop(event);
      if (droppedResourceName) {
        applyMaterialTextureResource(droppedResourceName);
        return;
      }

      showAlert({
        title: t`No compatible texture found`,
        message: t`Drop an existing image resource from Assets (or a file already imported as an image resource).`,
      });
    },
    [
      applyMaterialTextureResource,
      extractMaterialTextureFromDrop,
      hasMaterialTextureSupport,
      showAlert,
    ]
  );
  const onMaterialSlotDragOver = React.useCallback(
    (event: any) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      if (!isMaterialSlotDragOver) {
        setIsMaterialSlotDragOver(true);
      }
    },
    [isMaterialSlotDragOver]
  );
  const onMaterialSlotDragLeave = React.useCallback((event: any) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMaterialSlotDragOver(false);
  }, []);
  const materialTypePresets = React.useMemo(
    () => [
      { value: 'Matte', label: 'Matte' },
      { value: 'Standard', label: 'Standard' },
      { value: 'Glossy', label: 'Glossy' },
      { value: 'Metallic', label: 'Metallic' },
    ],
    []
  );
  const applyMaterialTypePreset = React.useCallback(
    (materialType: string) => {
      onChangeProperty('materialType', materialType);
      if (onObjectUpdated) onObjectUpdated();
    },
    [onChangeProperty, onObjectUpdated]
  );
  const [isMaterialBlueprintEditorOpen, setIsMaterialBlueprintEditorOpen] =
    React.useState<boolean>(false);
  const materialSystemSectionRef = React.useRef<?HTMLDivElement>(null);
  const materialBlueprintSectionRef = React.useRef<?HTMLDivElement>(null);
  const scrollToSection = React.useCallback(
    (sectionRef: { current: any }) => {
      if (!sectionRef.current || !scrollView.current) {
        return;
      }
      scrollView.current.scrollTo(sectionRef.current);
    },
    []
  );

  const materialGraphEffectAdapter = React.useMemo(
    () => ({
      getName: () => 'Material Blueprint',
      getEffectType: () => 'Scene3D::ShaderGraph',
      hasStringParameter: (parameterName: string): boolean =>
        parameterName === SHADER_GRAPH_DEFINITION_PARAMETER ||
        parameterName === SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER ||
        parameterName === SHADER_GRAPH_VERSION_PARAMETER,
      hasDoubleParameter: (parameterName: string): boolean =>
        parameterName === SHADER_GRAPH_STRENGTH_PARAMETER,
      hasBooleanParameter: (parameterName: string): boolean =>
        parameterName === SHADER_GRAPH_ENABLED_PARAMETER,
      getStringParameter: (parameterName: string): string => {
        if (parameterName === SHADER_GRAPH_DEFINITION_PARAMETER) {
          return getPropertyValue('materialGraphDefinition', '');
        }
        if (parameterName === SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER) {
          return getPropertyValue('materialGraphFragmentShader', '');
        }
        if (parameterName === SHADER_GRAPH_VERSION_PARAMETER) {
          return getPropertyValue('materialGraphVersion', '1') || '1';
        }
        return '';
      },
      getDoubleParameter: (parameterName: string): number => {
        if (parameterName === SHADER_GRAPH_STRENGTH_PARAMETER) {
          return parseFloat(getPropertyValue('materialGraphBlend', '1')) || 1;
        }
        return 0;
      },
      setStringParameter: (parameterName: string, value: string): void => {
        if (parameterName === SHADER_GRAPH_DEFINITION_PARAMETER) {
          onChangeProperty('materialGraphDefinition', value);
        } else if (parameterName === SHADER_GRAPH_FRAGMENT_SHADER_PARAMETER) {
          onChangeProperty('materialGraphFragmentShader', value);
        } else if (parameterName === SHADER_GRAPH_VERSION_PARAMETER) {
          onChangeProperty('materialGraphVersion', value);
        }
      },
      setDoubleParameter: (parameterName: string, value: number): void => {
        if (parameterName === SHADER_GRAPH_STRENGTH_PARAMETER) {
          onChangeProperty('materialGraphBlend', value.toString(10));
        }
      },
      setBooleanParameter: (parameterName: string, value: boolean): void => {
        if (parameterName === SHADER_GRAPH_ENABLED_PARAMETER) {
          onChangeProperty('materialGraphEnabled', value ? 'true' : 'false');
        }
      },
    }),
    [getPropertyValue, onChangeProperty]
  );

  // $FlowFixMe[value-as-type]
  const [gltf, setGltf] = React.useState<GLTF | null>(null);
  const loadGltf = React.useCallback(
    async (modelResourceName: string) => {
      const newModel3d = await PixiResourcesLoader.get3DModel(
        project,
        modelResourceName
      );
      setGltf(newModel3d);
    },
    [project]
  );
  if (!gltf) {
    loadGltf(properties.get('modelResourceName').getValue());
  }

  // $FlowFixMe[value-as-type]
  const model3D = React.useMemo<THREE.Object3D | null>(
    () => {
      if (!gltf) {
        return null;
      }
      const clonedModel3D = SkeletonUtils.clone(gltf.scene);
      const threeObject = new THREE.Group();
      threeObject.rotation.order = 'ZYX';
      threeObject.add(clonedModel3D);
      return threeObject;
    },
    [gltf]
  );

  const [originLocation, setOriginLocation] = React.useState<string>(() =>
    properties.get('originLocation').getValue()
  );
  const onOriginLocationChange = React.useCallback(
    // $FlowFixMe[missing-local-annot]
    (event, index: number, newValue: string) => {
      onChangeProperty('originLocation', newValue);
      setOriginLocation(newValue);
    },
    [onChangeProperty]
  );

  const [rotationX, setRotationX] = React.useState<number>(
    () => parseFloat(properties.get('rotationX').getValue()) || 0
  );
  const [rotationY, setRotationY] = React.useState<number>(
    () => parseFloat(properties.get('rotationY').getValue()) || 0
  );
  const [rotationZ, setRotationZ] = React.useState<number>(
    () => parseFloat(properties.get('rotationZ').getValue()) || 0
  );
  const onRotationChange = React.useCallback(
    () => {
      setRotationX(parseFloat(properties.get('rotationX').getValue()));
      setRotationY(parseFloat(properties.get('rotationY').getValue()));
      setRotationZ(parseFloat(properties.get('rotationZ').getValue()));
    },
    [properties]
  );
  const modelSize = React.useMemo<{ x: number, y: number, z: number } | null>(
    () => {
      if (!model3D) {
        return null;
      }
      // These formulas are also used in:
      // - gdjs.Model3DRuntimeObject3DRenderer._updateDefaultTransformation
      // - Model3DRendered2DInstance
      model3D.rotation.set(
        (rotationX * Math.PI) / 180,
        (rotationY * Math.PI) / 180,
        (rotationZ * Math.PI) / 180
      );
      model3D.updateMatrixWorld(true);
      const boundingBox = new THREE.Box3().setFromObject(model3D);
      if (originLocation === 'ModelOrigin') {
        // Keep the origin as part of the model.
        // For instance, a model can be 1 face of a cube and we want to keep the
        // inside as part of the object even if it's just void.
        // It also avoids to have the origin outside of the object box.
        boundingBox.expandByPoint(new THREE.Vector3(0, 0, 0));
      }
      const sizeX = boundingBox.max.x - boundingBox.min.x;
      const sizeY = boundingBox.max.y - boundingBox.min.y;
      const sizeZ = boundingBox.max.z - boundingBox.min.z;
      return {
        x: sizeX < epsilon ? 0 : sizeX,
        y: sizeY < epsilon ? 0 : sizeY,
        z: sizeZ < epsilon ? 0 : sizeZ,
      };
    },
    [model3D, originLocation, rotationX, rotationY, rotationZ]
  );

  const [width, setWidth] = React.useState<number>(
    () => parseFloat(properties.get('width').getValue()) || 0
  );
  const [height, setHeight] = React.useState<number>(
    () => parseFloat(properties.get('height').getValue()) || 0
  );
  const [depth, setDepth] = React.useState<number>(
    () => parseFloat(properties.get('depth').getValue()) || 0
  );
  const onDimensionChange = React.useCallback(
    () => {
      setWidth(parseFloat(properties.get('width').getValue()));
      setHeight(parseFloat(properties.get('height').getValue()));
      setDepth(parseFloat(properties.get('depth').getValue()));
    },
    [properties]
  );
  const scale = React.useMemo<number | null>(
    () => {
      if (!modelSize) {
        return null;
      }
      return Math.min(
        modelSize.x < epsilon ? Number.POSITIVE_INFINITY : width / modelSize.x,
        modelSize.y < epsilon ? Number.POSITIVE_INFINITY : height / modelSize.y,
        modelSize.z < epsilon ? Number.POSITIVE_INFINITY : depth / modelSize.z
      );
    },
    [depth, height, modelSize, width]
  );

  const setScale = React.useCallback(
    (scale: number) => {
      if (!modelSize) {
        return;
      }
      const width = scale * modelSize.x;
      const height = scale * modelSize.y;
      const depth = scale * modelSize.z;
      objectConfiguration.updateProperty('width', width.toString(10));
      objectConfiguration.updateProperty('height', height.toString(10));
      objectConfiguration.updateProperty('depth', depth.toString(10));
      onDimensionChange();
      forceUpdate();
    },
    [forceUpdate, modelSize, objectConfiguration, onDimensionChange]
  );

  const scanNewAnimations = React.useCallback(
    () => {
      if (!gltf) {
        return;
      }
      setNameErrors({});

      const animationSources = mapFor(
        0,
        model3DConfiguration.getAnimationsCount(),
        animationIndex =>
          model3DConfiguration.getAnimation(animationIndex).getSource()
      );

      let hasAddedAnimation = false;
      for (const resourceAnimation of gltf.animations) {
        if (animationSources.includes(resourceAnimation.name)) {
          continue;
        }
        const newAnimationName = model3DConfiguration.hasAnimationNamed(
          resourceAnimation.name
        )
          ? ''
          : resourceAnimation.name;

        const newAnimation = new gd.Model3DAnimation();
        newAnimation.setName(newAnimationName);
        newAnimation.setSource(resourceAnimation.name);
        model3DConfiguration.addAnimation(newAnimation);
        newAnimation.delete();
        hasAddedAnimation = true;
      }
      if (hasAddedAnimation) {
        forceUpdate();
        onSizeUpdated();
        if (onObjectUpdated) onObjectUpdated();

        // Scroll to the bottom of the list.
        // Ideally, we'd wait for the list to be updated to scroll, but
        // to simplify the code, we just wait a few ms for a new render
        // to be done.
        setTimeout(() => {
          if (scrollView.current) {
            scrollView.current.scrollToBottom();
          }
        }, 100); // A few ms is enough for a new render to be done.
      } else {
        showAlert({
          title: t`No new animation`,
          message: t`Every animation from the GLB file is already in the list.`,
        });
      }
    },
    [
      forceUpdate,
      gltf,
      model3DConfiguration,
      onObjectUpdated,
      onSizeUpdated,
      showAlert,
    ]
  );

  const addAnimation = React.useCallback(
    () => {
      setNameErrors({});

      const emptyAnimation = new gd.Model3DAnimation();
      model3DConfiguration.addAnimation(emptyAnimation);
      emptyAnimation.delete();
      forceUpdate();
      onSizeUpdated();
      if (onObjectUpdated) onObjectUpdated();

      // Scroll to the bottom of the list.
      // Ideally, we'd wait for the list to be updated to scroll, but
      // to simplify the code, we just wait a few ms for a new render
      // to be done.
      setTimeout(() => {
        if (scrollView.current) {
          scrollView.current.scrollToBottom();
        }
      }, 100); // A few ms is enough for a new render to be done.
    },
    [forceUpdate, onObjectUpdated, onSizeUpdated, model3DConfiguration]
  );

  const removeAnimation = React.useCallback(
    // $FlowFixMe[missing-local-annot]
    animationIndex => {
      setNameErrors({});

      model3DConfiguration.removeAnimation(animationIndex);
      forceUpdate();
      onSizeUpdated();
      if (onObjectUpdated) onObjectUpdated();
    },
    [forceUpdate, onObjectUpdated, onSizeUpdated, model3DConfiguration]
  );

  const moveAnimation = React.useCallback(
    (targetIndex: number) => {
      const draggedIndex = draggedAnimationIndex.current;
      if (draggedIndex === null) return;

      setNameErrors({});

      model3DConfiguration.moveAnimation(
        draggedIndex,
        targetIndex > draggedIndex ? targetIndex - 1 : targetIndex
      );
      forceUpdate();
    },
    [model3DConfiguration, forceUpdate]
  );

  const changeAnimationName = React.useCallback(
    // $FlowFixMe[missing-local-annot]
    (animationIndex, newName) => {
      const currentName = model3DConfiguration
        .getAnimation(animationIndex)
        .getName();
      if (currentName === newName) return;
      const animation = model3DConfiguration.getAnimation(animationIndex);

      setNameErrors({});

      if (newName !== '' && model3DConfiguration.hasAnimationNamed(newName)) {
        // The indexes can be used as a key because errors are cleared when
        // animations are moved.
        setNameErrors({
          ...nameErrors,
          [animationIndex]: (
            <Trans>The animation name {newName} is already taken</Trans>
          ),
        });
        return;
      }

      animation.setName(newName);
      if (object) {
        if (layout) {
          gd.WholeProjectRefactorer.renameObjectAnimationInScene(
            project,
            layout,
            object,
            currentName,
            newName
          );
        } else if (eventsFunctionsExtension && eventsBasedObject) {
          gd.WholeProjectRefactorer.renameObjectAnimationInEventsBasedObject(
            project,
            eventsFunctionsExtension,
            eventsBasedObject,
            object,
            currentName,
            newName
          );
        }
      }
      forceUpdate();
      if (onObjectUpdated) onObjectUpdated();
    },
    [
      model3DConfiguration,
      layout,
      object,
      eventsFunctionsExtension,
      eventsBasedObject,
      forceUpdate,
      onObjectUpdated,
      nameErrors,
      project,
    ]
  );

  const sourceSelectOptions = gltf
    ? gltf.animations.map(animation => {
        return (
          <SelectOption
            key={animation.name}
            value={animation.name}
            label={animation.name}
            shouldNotTranslate
          />
        );
      })
    : [];
  const currentMaterialType = properties.get('materialType').getValue();
  const materialSphereTextureLayer = materialTexturePreviewUrl
    ? `url("${materialTexturePreviewUrl}")`
    : 'linear-gradient(150deg, #232a33 0%, #11151c 100%)';
  const themePrimaryColor =
    (gdevelopTheme &&
      gdevelopTheme.palette &&
      gdevelopTheme.palette.primary) ||
    '#16a45f';
  const themeSecondaryColor =
    (gdevelopTheme &&
      gdevelopTheme.palette &&
      gdevelopTheme.palette.secondary) ||
    '#f39c12';
  const themeBorderColor =
    (gdevelopTheme && gdevelopTheme.border && gdevelopTheme.border.color) ||
    themeSecondaryColor;

  return (
    <>
      <ScrollView ref={scrollView}>
        <ColumnStackLayout noMargin>
          {renderObjectNameField && renderObjectNameField()}
          <div style={styles.organizerPanel}>
            <Text size="block-title" noMargin>
              <Trans>Material Quick Access</Trans>
            </Text>
            <Text size="body2" noMargin>
              <Trans>
                Use these shortcuts to jump directly to Material sections in this
                object editor.
              </Trans>
            </Text>
            <div style={styles.quickNavRow}>
              <FlatButton
                label={<Trans>Material System</Trans>}
                onClick={() => scrollToSection(materialSystemSectionRef)}
              />
              <FlatButton
                label={<Trans>Material Blueprint</Trans>}
                onClick={() => scrollToSection(materialBlueprintSectionRef)}
                disabled={!hasMaterialBlueprintSupport}
              />
              {hasMaterialBlueprintSupport ? (
                <RaisedButton
                  label={<Trans>Open Blueprint Editor</Trans>}
                  primary
                  onClick={() => {
                    onChangeProperty('materialGraphEnabled', 'true');
                    setIsMaterialBlueprintEditorOpen(true);
                    if (onObjectUpdated) onObjectUpdated();
                  }}
                />
              ) : null}
            </div>
          </div>
          <ResourceSelectorWithThumbnail
            project={project}
            resourceKind="model3D"
            floatingLabelText={properties.get('modelResourceName').getLabel()}
            resourceManagementProps={resourceManagementProps}
            projectScopedContainersAccessor={projectScopedContainersAccessor}
            resourceName={properties.get('modelResourceName').getValue()}
            onChange={newValue => {
              onChangeProperty('modelResourceName', newValue);
              loadGltf(newValue);
              forceUpdate();
            }}
            id={`model3d-object-modelResourceName`}
          />
          <Text size="block-title" noMargin>
            <Trans>Default orientation</Trans>
          </Text>
          <ResponsiveLineStackLayout
            noResponsiveLandscape
            expand
            noColumnMargin
          >
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="rotationX"
              onChange={onRotationChange}
            />
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="rotationY"
              onChange={onRotationChange}
            />
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="rotationZ"
              onChange={onRotationChange}
            />
          </ResponsiveLineStackLayout>
          <Text size="block-title" noMargin>
            <Trans>Default size</Trans>
          </Text>
          <ResponsiveLineStackLayout
            noResponsiveLandscape
            expand
            noColumnMargin
          >
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="width"
              onChange={onDimensionChange}
            />
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="height"
              onChange={onDimensionChange}
            />
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="depth"
              onChange={onDimensionChange}
            />
          </ResponsiveLineStackLayout>
          <Column noMargin expand key={'ScalingRatio'}>
            <SemiControlledTextField
              floatingLabelFixed
              floatingLabelText={<Trans>Scaling factor</Trans>}
              onChange={value => setScale(parseFloat(value) || 0)}
              value={
                scale === null ? '' : removeTrailingZeroes(scale.toPrecision(5))
              }
            />
          </Column>
          <PropertyCheckbox
            objectConfiguration={objectConfiguration}
            propertyName="keepAspectRatio"
          />
          <Text size="block-title" noMargin>
            <Trans>Points</Trans>
          </Text>
          <ResponsiveLineStackLayout
            noResponsiveLandscape
            expand
            noColumnMargin
          >
            <SelectField
              value={originLocation}
              floatingLabelText={properties.get('originLocation').getLabel()}
              helperMarkdownText={properties
                .get('originLocation')
                .getDescription()}
              onChange={onOriginLocationChange}
              fullWidth
            >
              <SelectOption
                label={t`Model origin`}
                value="ModelOrigin"
                key="ModelOrigin"
              />
              <SelectOption
                label={t`Top-left corner`}
                value="TopLeft"
                key="TopLeftCorner"
              />
              <SelectOption
                label={t`Object center`}
                value="ObjectCenter"
                key="ObjectCenter"
              />
              <SelectOption
                label={t`Bottom center (on Z axis)`}
                value="BottomCenterZ"
                key="BottomCenterZ"
              />
              <SelectOption
                label={t`Bottom center (on Y axis)`}
                value="BottomCenterY"
                key="BottomCenterY"
              />
            </SelectField>
            <SelectField
              value={properties.get('centerLocation').getValue()}
              floatingLabelText={properties.get('centerLocation').getLabel()}
              helperMarkdownText={properties
                .get('centerLocation')
                .getDescription()}
              onChange={(event, index, newValue) => {
                onChangeProperty('centerLocation', newValue);
              }}
              fullWidth
            >
              <SelectOption
                label={t`Model origin`}
                value="ModelOrigin"
                key="ModelOrigin"
              />
              <SelectOption
                label={t`Object center`}
                value="ObjectCenter"
                key="ObjectCenter"
              />
              <SelectOption
                label={t`Bottom center (on Z axis)`}
                value="BottomCenterZ"
                key="BottomCenterZ"
              />
              <SelectOption
                label={t`Bottom center (on Y axis)`}
                value="BottomCenterY"
                key="BottomCenterY"
              />
            </SelectField>
          </ResponsiveLineStackLayout>
          <Text size="block-title">Lighting</Text>
          <SelectField
            value={properties.get('materialType').getValue()}
            floatingLabelText={properties.get('materialType').getLabel()}
            helperMarkdownText={properties.get('materialType').getDescription()}
            onChange={(event, index, newValue) => {
              onChangeProperty('materialType', newValue);
            }}
          >
            <SelectOption
              label={t`No lighting effect`}
              value="Basic"
              key="Basic"
            />
            <SelectOption
              label={t`Emit all ambient light`}
              value="StandardWithoutMetalness"
              key="StandardWithoutMetalness"
            />
            <SelectOption
              label={t`Keep model material`}
              value="KeepOriginal"
              key="KeepOriginal"
            />
          </SelectField>
          {properties.get('materialType').getValue() !== 'Basic' &&
            !hasLight(layout) && (
              <AlertMessage kind="error">
                <Trans>
                  Make sure to set up a light in the effects of the layer or
                  choose "No lighting effect" - otherwise the object will appear
                  black.
                </Trans>
              </AlertMessage>
            )}
          <PropertyCheckbox
            objectConfiguration={objectConfiguration}
            propertyName="isCastingShadow"
          />
          <PropertyCheckbox
            objectConfiguration={objectConfiguration}
            propertyName="isReceivingShadow"
          />
          <div ref={materialSystemSectionRef}>
            <Text size="block-title">
              <Trans>Material System</Trans>
            </Text>
          </div>
          {hasMaterialTextureSupport ? (
            <React.Fragment>
              <AlertMessage kind="info">
                <Trans>
                  Material slots now support direct drag and drop from Assets.
                  Drop a texture on the slot and it is applied instantly in
                  runtime.
                </Trans>
              </AlertMessage>
              <div
                style={{
                  ...styles.materialPanel,
                  border: `1px solid ${
                    isMaterialSlotDragOver
                      ? themeSecondaryColor
                      : themeBorderColor
                  }`,
                  background: `linear-gradient(145deg, ${themePrimaryColor}18 0%, ${themeSecondaryColor}18 100%)`,
                  boxShadow: isMaterialSlotDragOver
                    ? `0 0 0 1px ${themeSecondaryColor} inset`
                    : undefined,
                }}
              >
                <div style={styles.materialSlotHeader}>
                  <div>
                    <Text noMargin>
                      <Trans>Surface Material Override</Trans>
                    </Text>
                    <Text noMargin style={styles.materialSlotSubtitle}>
                      {materialTextureResourceName ? (
                        materialTextureResourceName
                      ) : (
                        <Trans>Empty material slot</Trans>
                      )}
                    </Text>
                  </div>
                  <div
                    style={{
                      ...styles.materialSlotBadge,
                      background: themeSecondaryColor + '28',
                      color: themeSecondaryColor,
                    }}
                  >
                    <Trans>Slot 0</Trans>
                  </div>
                </div>
                <ResponsiveLineStackLayout
                  noResponsiveLandscape
                  noColumnMargin
                  alignItems="stretch"
                >
                  <div
                    style={{
                      ...styles.materialDropZone,
                      border: `1px dashed ${
                        isMaterialSlotDragOver
                          ? themeSecondaryColor
                          : themePrimaryColor
                      }`,
                      background: isMaterialSlotDragOver
                        ? themeSecondaryColor + '18'
                        : themePrimaryColor + '10',
                    }}
                    onDragEnter={onMaterialSlotDragOver}
                    onDragOver={onMaterialSlotDragOver}
                    onDragLeave={onMaterialSlotDragLeave}
                    onDrop={onMaterialSlotDrop}
                  >
                    <div
                      style={{
                        ...styles.materialSphere,
                        backgroundImage: `${materialSphereTextureLayer}, radial-gradient(circle at 28% 25%, rgba(255,255,255,0.78), rgba(255,255,255,0.12) 36%, rgba(255,255,255,0) 55%), radial-gradient(circle at 74% 80%, rgba(0,0,0,0.6), rgba(0,0,0,0.05) 48%, rgba(0,0,0,0) 64%), linear-gradient(145deg, #f39c12 0%, #16a45f 100%)`,
                      }}
                    />
                    <Text noMargin style={styles.materialDropHint}>
                      <Trans>Drag a texture from Assets and drop it here.</Trans>
                    </Text>
                  </div>
                  <Column noMargin expand>
                    <ResourceSelectorWithThumbnail
                      project={project}
                      resourceKind="image"
                      floatingLabelText={
                        getPropertyByName('materialTextureResourceName')
                          ? getPropertyByName(
                              'materialTextureResourceName'
                            ).getLabel()
                          : t`Material texture asset`
                      }
                      resourceManagementProps={resourceManagementProps}
                      projectScopedContainersAccessor={
                        projectScopedContainersAccessor
                      }
                      resourceName={materialTextureResourceName}
                      onChange={newValue => {
                        applyMaterialTextureResource(newValue);
                      }}
                      id={`model3d-object-materialTextureResourceName`}
                    />
                    <ResponsiveLineStackLayout
                      noResponsiveLandscape
                      justifyContent="space-between"
                      noColumnMargin
                    >
                      <FlatButton
                        label={<Trans>Clear</Trans>}
                        onClick={() => {
                          applyMaterialTextureResource('');
                        }}
                        disabled={!materialTextureResourceName}
                      />
                    </ResponsiveLineStackLayout>
                  </Column>
                </ResponsiveLineStackLayout>
                <ResponsiveLineStackLayout
                  noResponsiveLandscape
                  noColumnMargin
                  alignItems="center"
                >
                  {materialTypePresets.map(preset => (
                    <FlatButton
                      key={preset.value}
                      label={preset.label}
                      onClick={() => applyMaterialTypePreset(preset.value)}
                      primary={currentMaterialType === preset.value}
                    />
                  ))}
                </ResponsiveLineStackLayout>
              </div>
            </React.Fragment>
          ) : (
            <AlertMessage kind="warning">
              <Trans>
                Material texture asset support requires rebuilding libGD and
                reloading editor resources.
              </Trans>
            </AlertMessage>
          )}
          <div ref={materialBlueprintSectionRef}>
            <Text size="block-title">
              <Trans>Material Blueprint</Trans>
            </Text>
          </div>
          {hasMaterialBlueprintSupport ? (
            <React.Fragment>
              <PropertyCheckbox
                objectConfiguration={objectConfiguration}
                propertyName="materialGraphEnabled"
              />
              {getPropertyValue('materialGraphEnabled', 'false') === 'true' && (
                <React.Fragment>
                  <SelectField
                    value={getPropertyValue('materialProjectionMode', 'UV')}
                    floatingLabelText={<Trans>Projection mode</Trans>}
                    helperMarkdownText={t`Use UV for normal maps, or triplanar projection for seamless world-space projection.`}
                    onChange={(event, index, newValue) => {
                      onChangeProperty('materialProjectionMode', newValue);
                      if (onObjectUpdated) onObjectUpdated();
                    }}
                    fullWidth
                  >
                    <SelectOption label={t`UV`} value="UV" key="UV" />
                    <SelectOption
                      label={t`Triplanar projection`}
                      value="Triplanar"
                      key="Triplanar"
                    />
                  </SelectField>
                  <Column noMargin expand>
                    <PropertyField
                      objectConfiguration={objectConfiguration}
                      propertyName="materialGraphBlend"
                      onChange={() => {
                        if (onObjectUpdated) onObjectUpdated();
                      }}
                    />
                  </Column>
                  <ResponsiveLineStackLayout
                    noResponsiveLandscape
                    justifyContent="space-between"
                    noColumnMargin
                  >
                    <FlatButton
                      label={<Trans>Disable Blueprint</Trans>}
                      onClick={() => {
                        onChangeProperty('materialGraphEnabled', 'false');
                        if (onObjectUpdated) onObjectUpdated();
                      }}
                    />
                    <RaisedButton
                      primary
                      label={<Trans>Open Material Blueprint</Trans>}
                      onClick={() => setIsMaterialBlueprintEditorOpen(true)}
                    />
                  </ResponsiveLineStackLayout>
                </React.Fragment>
              )}
            </React.Fragment>
          ) : (
            <AlertMessage kind="warning">
              <Trans>
                Material Blueprint needs the updated 3D runtime. Rebuild libGD
                and reload editor resources to enable it.
              </Trans>
            </AlertMessage>
          )}
          <Text size="block-title">Animations</Text>
          <Column noMargin expand>
            <PropertyField
              objectConfiguration={objectConfiguration}
              propertyName="crossfadeDuration"
            />
          </Column>
          <Column noMargin expand useFullHeight>
            {model3DConfiguration.getAnimationsCount() === 0 ? (
              <Column noMargin expand justifyContent="center">
                <EmptyPlaceholder
                  title={<Trans>Add your first animation</Trans>}
                  description={
                    <Trans>Animations are a sequence of images.</Trans>
                  }
                  actionLabel={<Trans>Add an animation</Trans>}
                  helpPagePath="/objects/sprite"
                  tutorialId="intermediate-changing-animations"
                  onAction={addAnimation}
                />
              </Column>
            ) : (
              <React.Fragment>
                {mapFor(
                  0,
                  model3DConfiguration.getAnimationsCount(),
                  animationIndex => {
                    const animation = model3DConfiguration.getAnimation(
                      animationIndex
                    );

                    const animationRef =
                      justAddedAnimationName === animation.getName()
                        ? justAddedAnimationElement
                        : null;

                    return (
                      <DragSourceAndDropTarget
                        key={animationIndex}
                        beginDrag={() => {
                          draggedAnimationIndex.current = animationIndex;
                          return {};
                        }}
                        canDrag={() => true}
                        canDrop={() => true}
                        drop={() => {
                          moveAnimation(animationIndex);
                        }}
                      >
                        {({
                          connectDragSource,
                          connectDropTarget,
                          isOver,
                          canDrop,
                        }) =>
                          connectDropTarget(
                            <div
                              key={animationIndex}
                              style={styles.rowContainer}
                            >
                              {isOver && <DropIndicator canDrop={canDrop} />}
                              <div
                                ref={animationRef}
                                style={{
                                  ...styles.rowContent,
                                  backgroundColor:
                                    gdevelopTheme.list.itemsBackgroundColor,
                                }}
                              >
                                <Line noMargin expand alignItems="center">
                                  {connectDragSource(
                                    <span>
                                      <Column>
                                        <DragHandleIcon />
                                      </Column>
                                    </span>
                                  )}
                                  <Text noMargin noShrink>
                                    <Trans>Animation #{animationIndex}</Trans>
                                  </Text>
                                  <Spacer />
                                  <SemiControlledTextField
                                    margin="none"
                                    commitOnBlur
                                    errorText={nameErrors[animationIndex]}
                                    translatableHintText={t`Optional animation name`}
                                    value={animation.getName()}
                                    onChange={text =>
                                      changeAnimationName(animationIndex, text)
                                    }
                                    fullWidth
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      removeAnimation(animationIndex)
                                    }
                                  >
                                    <Trash />
                                  </IconButton>
                                </Line>
                                <Spacer />
                              </div>
                              <Spacer />
                              <ColumnStackLayout expand>
                                <SelectField
                                  id="animation-source-field"
                                  value={animation.getSource()}
                                  onChange={(event, value) => {
                                    animation.setSource(event.target.value);
                                    forceUpdate();
                                  }}
                                  margin="dense"
                                  fullWidth
                                  floatingLabelText={
                                    <Trans>GLB animation name</Trans>
                                  }
                                  translatableHintText={t`Choose an animation`}
                                >
                                  {sourceSelectOptions}
                                </SelectField>
                                <Checkbox
                                  label={<Trans>Loop</Trans>}
                                  checked={animation.shouldLoop()}
                                  onCheck={(e, checked) => {
                                    animation.setShouldLoop(checked);
                                    forceUpdate();
                                  }}
                                />
                              </ColumnStackLayout>
                            </div>
                          )
                        }
                      </DragSourceAndDropTarget>
                    );
                  }
                )}
              </React.Fragment>
            )}
          </Column>
        </ColumnStackLayout>
      </ScrollView>
      <Column noMargin>
        <ResponsiveLineStackLayout
          justifyContent="space-between"
          noColumnMargin
          noResponsiveLandscape
        >
          <FlatButton
            label={<Trans>Scan missing animations</Trans>}
            onClick={scanNewAnimations}
          />
          <RaisedButton
            label={<Trans>Add an animation</Trans>}
            primary
            onClick={addAnimation}
            icon={<Add />}
          />
        </ResponsiveLineStackLayout>
      </Column>
      {isMaterialBlueprintEditorOpen && (
        <ShaderGraphEditorDialog
          // $FlowFixMe[incompatible-type]
          effect={materialGraphEffectAdapter}
          previewMode="material"
          onApply={() => {
            forceUpdate();
            if (onObjectUpdated) onObjectUpdated();
          }}
          onClose={() => setIsMaterialBlueprintEditorOpen(false)}
        />
      )}
    </>
  );
};

export default Model3DEditor;
