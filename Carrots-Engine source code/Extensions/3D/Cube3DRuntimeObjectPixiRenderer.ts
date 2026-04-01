namespace gdjs {
  // Three.js materials for a cube and the order of faces in the object is different,
  // so we keep the mapping from one to the other.
  const faceIndexToMaterialIndex = {
    3: 0, // right
    2: 1, // left
    5: 2, // bottom
    4: 3, // top
    0: 4, // front
    1: 5, // back
  };
  const materialIndexToFaceIndex = {
    0: 3,
    1: 2,
    2: 5,
    3: 4,
    4: 0,
    5: 1,
  };

  const noRepeatTextureVertexIndexToUvMapping = {
    0: [0, 0],
    1: [1, 0],
    2: [0, 1],
    3: [1, 1],
  };

  const noRepeatTextureVertexIndexToUvMappingForLeftAndRightFacesTowardsZ = {
    0: [0, 1],
    1: [0, 0],
    2: [1, 1],
    3: [1, 0],
  };

  let transparentMaterial: THREE.MeshBasicMaterial;
  const getTransparentMaterial = () => {
    if (!transparentMaterial)
      transparentMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        // Set the alpha test to to ensure the faces behind are rendered
        // (no "back face culling" that would still be done if alphaTest is not set).
        alphaTest: 1,
      });

    return transparentMaterial;
  };

  type Cube3DMaterialProfile = {
    roughness: number;
    metalness: number;
    envMapIntensity: number;
  };

  const getCube3DMaterialProfile = (
    materialType: gdjs.Cube3DRuntimeObject.MaterialType
  ): Cube3DMaterialProfile => {
    switch (materialType) {
      case gdjs.Cube3DRuntimeObject.MaterialType.Matte:
        return { roughness: 0.94, metalness: 0.01, envMapIntensity: 0.85 };
      case gdjs.Cube3DRuntimeObject.MaterialType.Standard:
        return { roughness: 0.56, metalness: 0.08, envMapIntensity: 1.05 };
      case gdjs.Cube3DRuntimeObject.MaterialType.Glossy:
        return { roughness: 0.2, metalness: 0.16, envMapIntensity: 1.25 };
      case gdjs.Cube3DRuntimeObject.MaterialType.Metallic:
        return { roughness: 0.24, metalness: 0.9, envMapIntensity: 1.35 };
      case gdjs.Cube3DRuntimeObject.MaterialType.StandardWithoutMetalness:
      default:
        return { roughness: 0.78, metalness: 0, envMapIntensity: 1 };
    }
  };

  const applyCube3DMaterialProfile = (
    material: THREE.Material,
    materialType: gdjs.Cube3DRuntimeObject.MaterialType
  ) => {
    if (materialType === gdjs.Cube3DRuntimeObject.MaterialType.Basic) {
      return;
    }

    const standardMaterial = material as THREE.MeshStandardMaterial;
    if (!('roughness' in standardMaterial) || !('metalness' in standardMaterial)) {
      return;
    }

    const profile = getCube3DMaterialProfile(materialType);
    standardMaterial.roughness = profile.roughness;
    standardMaterial.metalness = profile.metalness;
    standardMaterial.envMapIntensity = profile.envMapIntensity;
    standardMaterial.needsUpdate = true;
  };

  const getFaceMaterial = (
    runtimeObject: gdjs.Cube3DRuntimeObject,
    faceIndex: integer
  ) => {
    if (!runtimeObject.isFaceAtIndexVisible(faceIndex))
      return getTransparentMaterial();

    const resourceName = runtimeObject.getFaceAtIndexResourceName(faceIndex);
    if (!resourceName) {
      if (
        runtimeObject._materialType === gdjs.Cube3DRuntimeObject.MaterialType.Basic
      ) {
        return new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: true,
        });
      }
      const profile = getCube3DMaterialProfile(runtimeObject._materialType);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: profile.roughness,
        metalness: profile.metalness,
        envMapIntensity: profile.envMapIntensity,
        vertexColors: true,
      });
    }

    const sharedMaterial = runtimeObject
      .getInstanceContainer()
      .getGame()
      .getImageManager()
      .getThreeMaterial(resourceName, {
        useTransparentTexture: runtimeObject.shouldUseTransparentTexture(),
        forceBasicMaterial:
          runtimeObject._materialType ===
          gdjs.Cube3DRuntimeObject.MaterialType.Basic,
        vertexColors: true,
      });
    if (runtimeObject._materialType === gdjs.Cube3DRuntimeObject.MaterialType.Basic) {
      return sharedMaterial;
    }
    const material = sharedMaterial.clone();
    applyCube3DMaterialProfile(material, runtimeObject._materialType);
    return material;
  };

  class Cube3DRuntimeObjectPixiRenderer extends gdjs.RuntimeObject3DRenderer {
    private _cube3DRuntimeObject: gdjs.Cube3DRuntimeObject;
    private _boxMesh: THREE.Mesh;

    constructor(
      runtimeObject: gdjs.Cube3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer
    ) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);

      const materials: THREE.Material[] = new Array(6)
        .fill(0)
        .map((_, index) =>
          getFaceMaterial(runtimeObject, materialIndexToFaceIndex[index])
        );
      const boxMesh = new THREE.Mesh(geometry, materials);

      super(runtimeObject, instanceContainer, boxMesh);
      this._boxMesh = boxMesh;
      this._cube3DRuntimeObject = runtimeObject;

      boxMesh.receiveShadow = this._cube3DRuntimeObject._isReceivingShadow;
      boxMesh.castShadow = this._cube3DRuntimeObject._isCastingShadow;
      this.updateSize();
      this.updatePosition();
      this.updateRotation();
      this.updateTint();
    }

    updateTint() {
      const tints: number[] = [];

      const normalizedTint = gdjs
        .rgbOrHexToRGBColor(this._cube3DRuntimeObject.getColor())
        .map((component) => component / 255);

      for (
        let i = 0;
        i < this._boxMesh.geometry.attributes.position.count;
        i++
      ) {
        tints.push(...normalizedTint);
      }

      this._boxMesh.geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(tints), 3)
      );
    }
    updateShadowCasting() {
      this._boxMesh.castShadow = this._cube3DRuntimeObject._isCastingShadow;
    }
    updateShadowReceiving() {
      this._boxMesh.receiveShadow =
        this._cube3DRuntimeObject._isReceivingShadow;
    }

    updateFace(faceIndex: integer) {
      const materialIndex = faceIndexToMaterialIndex[faceIndex];
      if (materialIndex === undefined) return;

      this._boxMesh.material[materialIndex] = getFaceMaterial(
        this._cube3DRuntimeObject,
        faceIndex
      );
      if (this._cube3DRuntimeObject.isFaceAtIndexVisible(faceIndex)) {
        this.updateTextureUvMapping(faceIndex);
      }
    }

    updateSize(): void {
      super.updateSize();
      this.updateTextureUvMapping();
    }

    /**
     * Updates the UV mapping of the geometry in order to repeat a material
     * over the different faces of the cube.
     * The mesh must be configured with a list of materials in order
     * for the method to work.
     * @param faceIndex The face index to update. If undefined, updates all the faces.
     */
    updateTextureUvMapping(faceIndex?: number) {
      // @ts-ignore - position is stored as a Float32BufferAttribute
      const pos: THREE.BufferAttribute =
        this._boxMesh.geometry.getAttribute('position');
      // @ts-ignore - uv is stored as a Float32BufferAttribute
      const uvMapping: THREE.BufferAttribute =
        this._boxMesh.geometry.getAttribute('uv');
      const startIndex =
        faceIndex === undefined ? 0 : faceIndexToMaterialIndex[faceIndex] * 4;
      const endIndex =
        faceIndex === undefined
          ? 23
          : faceIndexToMaterialIndex[faceIndex] * 4 + 3;
      for (
        let vertexIndex = startIndex;
        vertexIndex <= endIndex;
        vertexIndex++
      ) {
        const materialIndex = Math.floor(
          vertexIndex /
            // Each face of the cube has 4 points
            4
        );
        const material = this._boxMesh.material[materialIndex];
        if (!material || !material.map) {
          continue;
        }

        const shouldRepeatTexture =
          this._cube3DRuntimeObject.shouldRepeatTextureOnFaceAtIndex(
            materialIndexToFaceIndex[materialIndex]
          );

        const shouldOrientateFacesTowardsY =
          this._cube3DRuntimeObject.getFacesOrientation() === 'Y';

        let x: float, y: float;
        switch (materialIndex) {
          case 0:
            // Right face
            if (shouldRepeatTexture) {
              if (shouldOrientateFacesTowardsY) {
                x =
                  -(this._boxMesh.scale.z / material.map.source.data.width) *
                  (pos.getZ(vertexIndex) - 0.5);
                y =
                  -(this._boxMesh.scale.y / material.map.source.data.height) *
                  (pos.getY(vertexIndex) + 0.5);
              } else {
                x =
                  -(this._boxMesh.scale.y / material.map.source.data.width) *
                  (pos.getY(vertexIndex) - 0.5);
                y =
                  (this._boxMesh.scale.z / material.map.source.data.height) *
                  (pos.getZ(vertexIndex) - 0.5);
              }
            } else {
              if (shouldOrientateFacesTowardsY) {
                [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
              } else {
                [x, y] =
                  noRepeatTextureVertexIndexToUvMappingForLeftAndRightFacesTowardsZ[
                    vertexIndex % 4
                  ];
              }
            }
            break;
          case 1:
            // Left face
            if (shouldRepeatTexture) {
              if (shouldOrientateFacesTowardsY) {
                x =
                  (this._boxMesh.scale.z / material.map.source.data.width) *
                  (pos.getZ(vertexIndex) + 0.5);
                y =
                  -(this._boxMesh.scale.y / material.map.source.data.height) *
                  (pos.getY(vertexIndex) + 0.5);
              } else {
                x =
                  (this._boxMesh.scale.y / material.map.source.data.width) *
                  (pos.getY(vertexIndex) + 0.5);
                y =
                  (this._boxMesh.scale.z / material.map.source.data.height) *
                  (pos.getZ(vertexIndex) - 0.5);
              }
            } else {
              if (shouldOrientateFacesTowardsY) {
                [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
              } else {
                [x, y] =
                  noRepeatTextureVertexIndexToUvMappingForLeftAndRightFacesTowardsZ[
                    vertexIndex % 4
                  ];
                x = -x;
                y = -y;
              }
            }
            break;
          case 2:
            // Bottom face
            if (shouldRepeatTexture) {
              x =
                (this._boxMesh.scale.x / material.map.source.data.width) *
                (pos.getX(vertexIndex) + 0.5);
              y =
                (this._boxMesh.scale.z / material.map.source.data.height) *
                (pos.getZ(vertexIndex) - 0.5);
            } else {
              [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
            }
            break;
          case 3:
            // Top face
            if (shouldRepeatTexture) {
              if (shouldOrientateFacesTowardsY) {
                x =
                  (this._boxMesh.scale.x / material.map.source.data.width) *
                  (pos.getX(vertexIndex) + 0.5);
                y =
                  -(this._boxMesh.scale.z / material.map.source.data.height) *
                  (pos.getZ(vertexIndex) + 0.5);
              } else {
                x =
                  -(this._boxMesh.scale.x / material.map.source.data.width) *
                  (pos.getX(vertexIndex) - 0.5);
                y =
                  (this._boxMesh.scale.z / material.map.source.data.height) *
                  (pos.getZ(vertexIndex) - 0.5);
              }
            } else {
              [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
              if (!shouldOrientateFacesTowardsY) {
                x = -x;
                y = -y;
              }
            }
            break;
          case 4:
            // Front face
            if (shouldRepeatTexture) {
              x =
                (this._boxMesh.scale.x / material.map.source.data.width) *
                (pos.getX(vertexIndex) + 0.5);
              y =
                -(this._boxMesh.scale.y / material.map.source.data.height) *
                (pos.getY(vertexIndex) + 0.5);
            } else {
              [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
            }
            break;
          case 5:
            // Back face
            const shouldBackFaceBeUpThroughXAxisRotation =
              this._cube3DRuntimeObject.getBackFaceUpThroughWhichAxisRotation() ===
              'X';

            if (shouldRepeatTexture) {
              x =
                (shouldBackFaceBeUpThroughXAxisRotation ? 1 : -1) *
                (this._boxMesh.scale.x / material.map.source.data.width) *
                (pos.getX(vertexIndex) +
                  (shouldBackFaceBeUpThroughXAxisRotation ? 1 : -1) * 0.5);
              y =
                (shouldBackFaceBeUpThroughXAxisRotation ? 1 : -1) *
                (this._boxMesh.scale.y / material.map.source.data.height) *
                (pos.getY(vertexIndex) +
                  (shouldBackFaceBeUpThroughXAxisRotation ? -1 : 1) * 0.5);
            } else {
              [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
              if (shouldBackFaceBeUpThroughXAxisRotation) {
                x = -x;
                y = -y;
              }
            }
            break;
          default:
            [x, y] = noRepeatTextureVertexIndexToUvMapping[vertexIndex % 4];
        }
        uvMapping.setXY(vertexIndex, x, y);
      }
      uvMapping.needsUpdate = true;
    }

    _updateMaterials() {
      for (let index = 0; index < 6; index++) {
        this.updateFace(index);
      }
    }
  }

  /** @category Renderers > 3D Box */
  export const Cube3DRuntimeObjectRenderer = Cube3DRuntimeObjectPixiRenderer;
  /** @category Renderers > 3D Box */
  export type Cube3DRuntimeObjectRenderer = Cube3DRuntimeObjectPixiRenderer;
}
