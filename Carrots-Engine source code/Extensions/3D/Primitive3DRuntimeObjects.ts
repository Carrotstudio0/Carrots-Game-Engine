namespace gdjs {
  export interface Primitive3DObjectData extends Object3DData {
    content: Object3DDataContent & {
      color?: string;
      materialType?: 'Basic' | 'StandardWithoutMetalness';
      isCastingShadow?: boolean;
      isReceivingShadow?: boolean;
    };
  }

  type Primitive3DObjectNetworkSyncData = Object3DNetworkSyncData & {
    c: string;
    mt: number;
    cs: boolean;
    rs: boolean;
  };

  class Primitive3DRuntimeObjectRenderer extends gdjs.RuntimeObject3DRenderer {
    private _runtimeObject: Primitive3DRuntimeObject;
    private _mesh: THREE.Mesh;

    constructor(
      runtimeObject: Primitive3DRuntimeObject,
      instanceContainer: gdjs.RuntimeInstanceContainer,
      geometry: THREE.BufferGeometry
    ) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
      super(runtimeObject, instanceContainer, mesh);
      this._runtimeObject = runtimeObject;
      this._mesh = mesh;

      this.updateMaterialType();
      this.updateColor();
      this.updateShadowCasting();
      this.updateShadowReceiving();
      this.updateSize();
      this.updatePosition();
      this.updateRotation();
    }

    private _createMaterial():
      | THREE.MeshBasicMaterial
      | THREE.MeshStandardMaterial {
      const side = this._runtimeObject.shouldUseDoubleSidedMaterial()
        ? THREE.DoubleSide
        : THREE.FrontSide;
      const color = gdjs.rgbOrHexStringToNumber(this._runtimeObject.getColor());

      if (
        this._runtimeObject._materialType ===
        gdjs.Primitive3DRuntimeObject.MaterialType.Basic
      ) {
        return new THREE.MeshBasicMaterial({
          color,
          side,
        });
      }

      return new THREE.MeshStandardMaterial({
        color,
        side,
        roughness: 0.82,
        metalness: 0,
      });
    }

    updateMaterialType() {
      const oldMaterial = this._mesh.material;
      this._mesh.material = this._createMaterial();
      if (Array.isArray(oldMaterial)) {
        oldMaterial.forEach(material => material.dispose());
      } else {
        oldMaterial.dispose();
      }
      this.updateColor();
    }

    updateColor() {
      const color = gdjs.rgbOrHexStringToNumber(this._runtimeObject.getColor());
      const material = this._mesh.material as
        | THREE.MeshBasicMaterial
        | THREE.MeshStandardMaterial;
      if (material.color) {
        material.color.setHex(color);
      }
    }

    updateShadowCasting() {
      this._mesh.castShadow = this._runtimeObject._isCastingShadow;
    }

    updateShadowReceiving() {
      this._mesh.receiveShadow = this._runtimeObject._isReceivingShadow;
    }
  }

  export abstract class Primitive3DRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: Primitive3DRuntimeObjectRenderer;
    _materialType: gdjs.Primitive3DRuntimeObject.MaterialType =
      gdjs.Primitive3DRuntimeObject.MaterialType.StandardWithoutMetalness;
    _isCastingShadow: boolean = true;
    _isReceivingShadow: boolean = true;
    private _color: string = '255;255;255';
    private _doubleSidedMaterial: boolean = false;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Primitive3DObjectData,
      instanceData: InstanceData | undefined,
      geometry: THREE.BufferGeometry,
      doubleSidedMaterial: boolean
    ) {
      super(instanceContainer, objectData, instanceData);

      this._color = objectData.content.color || '255;255;255';
      this._materialType = this._convertMaterialType(
        objectData.content.materialType
      );
      this._isCastingShadow =
        objectData.content.isCastingShadow !== undefined
          ? objectData.content.isCastingShadow
          : true;
      this._isReceivingShadow =
        objectData.content.isReceivingShadow !== undefined
          ? objectData.content.isReceivingShadow
          : true;
      this._doubleSidedMaterial = doubleSidedMaterial;

      this._renderer = new Primitive3DRuntimeObjectRenderer(
        this,
        instanceContainer,
        geometry
      );

      this.onCreated();
    }

    getRenderer(): gdjs.RuntimeObject3DRenderer {
      return this._renderer;
    }

    updateFromObjectData(
      oldObjectData: Object3DData,
      newObjectData: Object3DData
    ): boolean {
      if (!super.updateFromObjectData(oldObjectData, newObjectData)) {
        return false;
      }

      const primitiveObjectData = newObjectData as Primitive3DObjectData;
      const newColor = primitiveObjectData.content.color || '255;255;255';
      if (newColor !== this._color) {
        this._color = newColor;
        this._renderer.updateColor();
      }

      const newMaterialType = this._convertMaterialType(
        primitiveObjectData.content.materialType
      );
      if (newMaterialType !== this._materialType) {
        this._materialType = newMaterialType;
        this._renderer.updateMaterialType();
      }

      const newCastShadow =
        primitiveObjectData.content.isCastingShadow !== undefined
          ? primitiveObjectData.content.isCastingShadow
          : true;
      if (newCastShadow !== this._isCastingShadow) {
        this._isCastingShadow = newCastShadow;
        this._renderer.updateShadowCasting();
      }

      const newReceiveShadow =
        primitiveObjectData.content.isReceivingShadow !== undefined
          ? primitiveObjectData.content.isReceivingShadow
          : true;
      if (newReceiveShadow !== this._isReceivingShadow) {
        this._isReceivingShadow = newReceiveShadow;
        this._renderer.updateShadowReceiving();
      }

      return true;
    }

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): Primitive3DObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        c: this._color,
        mt: this._materialType,
        cs: this._isCastingShadow,
        rs: this._isReceivingShadow,
      };
    }

    updateFromNetworkSyncData(
      networkSyncData: Primitive3DObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.c !== undefined && networkSyncData.c !== this._color) {
        this._color = networkSyncData.c;
        this._renderer.updateColor();
      }

      if (
        networkSyncData.mt !== undefined &&
        networkSyncData.mt !== this._materialType
      ) {
        this._materialType = networkSyncData.mt;
        this._renderer.updateMaterialType();
      }

      if (
        networkSyncData.cs !== undefined &&
        networkSyncData.cs !== this._isCastingShadow
      ) {
        this._isCastingShadow = networkSyncData.cs;
        this._renderer.updateShadowCasting();
      }

      if (
        networkSyncData.rs !== undefined &&
        networkSyncData.rs !== this._isReceivingShadow
      ) {
        this._isReceivingShadow = networkSyncData.rs;
        this._renderer.updateShadowReceiving();
      }
    }

    setColor(color: string) {
      if (this._color === color) return;
      this._color = color;
      this._renderer.updateColor();
    }

    getColor(): string {
      return this._color;
    }

    setMaterialType(materialTypeString: string) {
      const newMaterialType = this._convertMaterialType(materialTypeString);
      if (newMaterialType === this._materialType) return;
      this._materialType = newMaterialType;
      this._renderer.updateMaterialType();
    }

    updateShadowCasting(value: boolean) {
      if (this._isCastingShadow === value) return;
      this._isCastingShadow = value;
      this._renderer.updateShadowCasting();
    }

    updateShadowReceiving(value: boolean) {
      if (this._isReceivingShadow === value) return;
      this._isReceivingShadow = value;
      this._renderer.updateShadowReceiving();
    }

    shouldUseDoubleSidedMaterial(): boolean {
      return this._doubleSidedMaterial;
    }

    private _convertMaterialType(
      materialTypeString: string | undefined
    ): gdjs.Primitive3DRuntimeObject.MaterialType {
      if (materialTypeString === 'StandardWithoutMetalness') {
        return gdjs.Primitive3DRuntimeObject.MaterialType.StandardWithoutMetalness;
      }
      return gdjs.Primitive3DRuntimeObject.MaterialType.Basic;
    }
  }

  export namespace Primitive3DRuntimeObject {
    export enum MaterialType {
      Basic,
      StandardWithoutMetalness,
    }
  }

  export class Sphere3DRuntimeObject extends Primitive3DRuntimeObject {
    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Primitive3DObjectData,
      instanceData?: InstanceData
    ) {
      super(
        instanceContainer,
        objectData,
        instanceData,
        new THREE.SphereGeometry(0.5, 32, 24),
        false
      );
    }
  }

  export class Plane3DRuntimeObject extends Primitive3DRuntimeObject {
    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Primitive3DObjectData,
      instanceData?: InstanceData
    ) {
      super(
        instanceContainer,
        objectData,
        instanceData,
        new THREE.PlaneGeometry(1, 1, 1, 1),
        true
      );
    }
  }

  export class Capsule3DRuntimeObject extends Primitive3DRuntimeObject {
    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: Primitive3DObjectData,
      instanceData?: InstanceData
    ) {
      super(
        instanceContainer,
        objectData,
        instanceData,
        new THREE.CapsuleGeometry(0.5, 1, 8, 16),
        false
      );
    }
  }

  gdjs.registerObject('Scene3D::Sphere3DObject', gdjs.Sphere3DRuntimeObject);
  gdjs.registerObject('Scene3D::Plane3DObject', gdjs.Plane3DRuntimeObject);
  gdjs.registerObject('Scene3D::Capsule3DObject', gdjs.Capsule3DRuntimeObject);
}
