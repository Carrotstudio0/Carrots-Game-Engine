// @flow

import * as React from 'react';
import { Trans } from '@lingui/macro';
import { t } from '@lingui/macro';
import { type EditorProps } from './EditorProps.flow';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../../UI/Layout';
import Text from '../../UI/Text';
import SemiControlledTextField from '../../UI/SemiControlledTextField';
import useForceUpdate from '../../Utils/UseForceUpdate';
import { Column } from '../../UI/Grid';
import SelectField from '../../UI/SelectField';
import SelectOption from '../../UI/SelectOption';
import AlertMessage from '../../UI/AlertMessage';
import ScrollView from '../../UI/ScrollView';
import PixiResourcesLoader from '../../ObjectsRendering/PixiResourcesLoader';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import * as THREE from 'three';
import { PropertyCheckbox, PropertyField } from './PropertyFields';
import ResourceSelectorWithThumbnail from '../../ResourcesList/ResourceSelectorWithThumbnail';

const epsilon = 1 / (1 << 16);

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
  resourceManagementProps,
  projectScopedContainersAccessor,
  renderObjectNameField,
}: EditorProps): React.Node => {
  const forceUpdate = useForceUpdate();
  const properties = objectConfiguration.getProperties();
  const modelResourceName = properties.get('modelResourceName').getValue();

  const onChangeProperty = React.useCallback(
    (property: string, value: string) => {
      objectConfiguration.updateProperty(property, value);
      forceUpdate();
    },
    [objectConfiguration, forceUpdate]
  );

  // $FlowFixMe[value-as-type]
  const [gltf, setGltf] = React.useState<GLTF | null>(null);
  React.useEffect(
    () => {
      let isUnmounted = false;

      (async () => {
        if (!modelResourceName) {
          if (!isUnmounted) setGltf(null);
          return;
        }

        try {
          const newModel3d = await PixiResourcesLoader.get3DModel(
            project,
            modelResourceName
          );
          if (isUnmounted) return;
          setGltf(newModel3d);
        } catch (error) {
          if (isUnmounted) return;
          setGltf(null);
        }
      })();

      return () => {
        isUnmounted = true;
      };
    },
    [modelResourceName, project]
  );

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

  return (
    <ScrollView>
        <ColumnStackLayout noMargin>
          {renderObjectNameField && renderObjectNameField()}
          <ResourceSelectorWithThumbnail
            project={project}
            resourceKind="model3D"
            floatingLabelText={properties.get('modelResourceName').getLabel()}
            resourceManagementProps={resourceManagementProps}
            projectScopedContainersAccessor={projectScopedContainersAccessor}
            resourceName={modelResourceName}
            onChange={newValue => {
              onChangeProperty('modelResourceName', newValue);
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
        </ColumnStackLayout>
    </ScrollView>
  );
};

export default Model3DEditor;
