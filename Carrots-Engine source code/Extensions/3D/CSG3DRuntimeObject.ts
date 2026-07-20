namespace gdjs {
  /**
   * Material type string for CSG objects
   */
  type CSGMaterialTypeString =
    | 'Basic'
    | 'StandardWithoutMetalness'
    | 'Matte'
    | 'Standard'
    | 'Glossy'
    | 'Metallic';

  /**
   * Shape type for CSG primitives
   */
  type CSGShapeType = 'Box' | 'Sphere' | 'Cylinder' | 'Cone' | 'Torus' | 'Capsule';

  /**
   * Operation type for CSG
   */
  type CSGOperationType = 'Union' | 'Subtract' | 'Intersect';

  /**
   * Role type for CSG objects
   */
  type CSGRoleType = 'Solid' | 'Room' | 'Cutter';

  /**
   * Face orientation mode
   */
  type FaceOrientationType = 'Outward' | 'Inward' | 'DoubleSided';

  /**
   * Base parameters for {@link gdjs.CSG3DRuntimeObject}
   * @category Objects > 3D CSG
   */
  export interface CSG3DObjectData extends Object3DData {
    /** The base parameters of the CSG3D object */
    content: Object3DDataContent & {
      // === Shape Properties ===
      shape: CSGShapeType;
      radius: number | undefined;
      radialSegments: number | undefined;
      heightSegments: number | undefined;
      tube: number | undefined;
      tubularSegments: number | undefined;
      arc: number | undefined;
      capSegments: number | undefined;
      thetaStart: number | undefined;
      thetaLength: number | undefined;
      phiStart: number | undefined;
      phiLength: number | undefined;
      openEnded: boolean | undefined;

      // === CSG Properties ===
      csgRole: CSGRoleType | undefined;
      csgOperation: CSGOperationType | undefined;
      csgMode: 'Single' | 'Combined' | undefined;
      targetObjectName: string | undefined;

      // === Face Orientation (FlipFace) ===
      faceOrientation: FaceOrientationType | undefined;
      roomMode: boolean | undefined;
      wallThickness: number | undefined;
      facesInward: boolean | undefined;

      // === Material & Appearance ===
      materialType: CSGMaterialTypeString | undefined;
      tint: string | undefined;
      enableTextureTransparency: boolean | undefined;
      resourceName: string | undefined;
      resourceRepeat: boolean | undefined;
      isCastingShadow: boolean;
      isReceivingShadow: boolean;

      // === Collision & Physics ===
      generateCollision: boolean | undefined;
      collisionLayer: number | undefined;
      collisionMask: number | undefined;
      collisionPriority: number | undefined;
      collisionShape: 'Box' | 'Mesh' | 'ConvexHull' | undefined;

      // === Geometry Optimization ===
      calculateTangents: boolean | undefined;
      autoSmooth: boolean | undefined;
      smoothingAngle: number | undefined;
      mergeVertices: boolean | undefined;

      // === Baking ===
      bakeOnStart: boolean | undefined;
    };
  }

  /**
   * Network sync data for CSG3D objects
   */
  type CSG3DObjectNetworkSyncDataType = {
    sh: CSGShapeType;
    ra: float;
    rs: integer;
    hs: integer;
    tb: float;
    ts: integer;
    ar: float;
    cs: integer;
    tsr: float;
    tl: float;
    ps: float;
    pl: float;
    oe: boolean;
    cr: CSGRoleType;
    co: CSGOperationType;
    cm: 'Single' | 'Combined';
    ton: string;
    fo: FaceOrientationType;
    rm: boolean;
    wt: float;
    fi: boolean;
    mt: number;
    tn: string;
    et: boolean;
    rn: string;
    rr: boolean;
    ic: boolean;
    ir: boolean;
    gc: boolean;
    cl: number;
    ck: number;
    cp: number;
    csh: 'Box' | 'Mesh' | 'ConvexHull';
    ct: boolean;
    as: boolean;
    sa: number;
    mv: boolean;
    bs: boolean;
  };

  type CSG3DObjectNetworkSyncData = Object3DNetworkSyncData &
    CSG3DObjectNetworkSyncDataType;

  /**
   * CSG Collision Surface definition
   */
  interface CSGCollisionSurface {
    name: string;
    x: float;
    y: float;
    z: float;
    width: float;
    height: float;
    depth: float;
    rotationX: float;
    rotationY: float;
    rotationZ: float;
    collisionLayer: float;
    collisionMask: float;
    collisionPriority: float;
  }

  /**
   * Shows a 3D CSG (Constructive Solid Geometry) object.
   * Supports Union, Subtract, Intersect operations, FlipFace (Room mode),
   * and dynamic collision generation.
   * @category Objects > 3D CSG
   */
  export class CSG3DRuntimeObject extends gdjs.RuntimeObject3D {
    private _renderer: CSG3DRuntimeObjectRenderer;

    // === Shape Properties ===
    private _shape: CSGShapeType;
    private _radius: number;
    private _radialSegments: number;
    private _heightSegments: number;
    private _tube: number;
    private _tubularSegments: number;
    private _arc: number;
    private _capSegments: number;
    private _thetaStart: number;
    private _thetaLength: number;
    private _phiStart: number;
    private _phiLength: number;
    private _openEnded: boolean;

    // === CSG Properties ===
    private _csgRole: CSGRoleType;
    private _csgOperation: CSGOperationType;
    private _csgMode: 'Single' | 'Combined';
    private _targetObjectName: string;

    // === Face Orientation (FlipFace) ===
    private _faceOrientation: FaceOrientationType;
    private _roomMode: boolean;
    private _wallThickness: number;
    private _facesInward: boolean;

    // === Material & Appearance ===
    _materialType: gdjs.CSG3DRuntimeObject.MaterialType =
      gdjs.CSG3DRuntimeObject.MaterialType.Standard;
    private _tint: string;
    private _shouldUseTransparentTexture: boolean;
    private _resourceName: string;
    private _resourceRepeat: boolean;
    _isCastingShadow: boolean = true;
    _isReceivingShadow: boolean = true;

    // === Collision & Physics ===
    private _generateCollision: boolean;
    private _collisionLayer: number;
    private _collisionMask: number;
    private _collisionPriority: number;
    private _collisionShape: 'Box' | 'Mesh' | 'ConvexHull';

    // === Geometry Optimization ===
    private _calculateTangents: boolean;
    private _autoSmooth: boolean;
    private _smoothingAngle: number;
    private _mergeVertices: boolean;

    // === Baking ===
    private _bakeOnStart: boolean;

    // === Internal State ===
    private _isBaked: boolean = false;
    private _bakedGeometry: any = null; // THREE.BufferGeometry
    private _dirty: boolean = true;
    private _lastWorldMatrix: any = null; // THREE.Matrix4

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: CSG3DObjectData,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);

      const content = objectData.content;

      // === Shape Properties ===
      this._shape = content.shape || 'Box';
      this._radius = content.radius || 1;
      this._radialSegments = Math.max(3, content.radialSegments || 32);
      this._heightSegments = Math.max(1, content.heightSegments || 1);
      this._tube = content.tube || 0.4;
      this._tubularSegments = Math.max(3, content.tubularSegments || 8);
      this._arc = content.arc !== undefined ? content.arc : Math.PI * 2;
      this._capSegments = Math.max(1, content.capSegments || 4);
      this._thetaStart = content.thetaStart || 0;
      this._thetaLength = content.thetaLength || Math.PI * 2;
      this._phiStart = content.phiStart || 0;
      this._phiLength = content.phiLength || Math.PI;
      this._openEnded = !!content.openEnded;

      // === CSG Properties ===
      this._csgRole = content.csgRole || 'Solid';
      this._csgOperation = content.csgOperation || 'Union';
      this._csgMode = content.csgMode || 'Single';
      this._targetObjectName = content.targetObjectName || '';

      // === Face Orientation ===
      this._faceOrientation = content.faceOrientation || 'Outward';
      this._roomMode = !!content.roomMode;
      this._wallThickness = Math.max(0.001, content.wallThickness || 8);
      this._facesInward = content.facesInward !== undefined
        ? !!content.facesInward
        : this._roomMode;

      // === Material & Appearance ===
      this._materialType = this._convertMaterialType(content.materialType);
      this._tint = content.tint || '255;255;255';
      this._shouldUseTransparentTexture = !!content.enableTextureTransparency;
      this._resourceName = content.resourceName || '';
      this._resourceRepeat = !!content.resourceRepeat;
      this._isCastingShadow = content.isCastingShadow !== undefined
        ? !!content.isCastingShadow
        : true;
      this._isReceivingShadow = content.isReceivingShadow !== undefined
        ? !!content.isReceivingShadow
        : true;

      // === Collision & Physics ===
      this._generateCollision = !!content.generateCollision;
      this._collisionLayer = Math.max(0, content.collisionLayer || 0);
      this._collisionMask = content.collisionMask !== undefined
        ? Math.max(0, content.collisionMask)
        : 1;
      this._collisionPriority = content.collisionPriority || 0;
      this._collisionShape = content.collisionShape || 'Box';

      // === Geometry Optimization ===
      this._calculateTangents = !!content.calculateTangents;
      this._autoSmooth = content.autoSmooth !== false;
      this._smoothingAngle = content.smoothingAngle !== undefined
        ? Math.max(0, Math.min(180, content.smoothingAngle))
        : 30;
      this._mergeVertices = content.mergeVertices !== false;

      // === Baking ===
      this._bakeOnStart = !!content.bakeOnStart;

      // Create renderer
      this._renderer = new gdjs.CSG3DRuntimeObjectRenderer(
        this,
        instanceContainer
      );

      // *ALWAYS* call `this.onCreated()` at the very end of your object constructor.
      this.onCreated();

      // Auto-bake if enabled
      if (this._bakeOnStart) {
        this.bakeGeometry();
      }
    }

    // ============================================================
    // GETTERS / SETTERS — Shape Properties
    // ============================================================

    setShape(shape: CSGShapeType): void {
      if (this._shape === shape) return;
      this._shape = shape;
      this._markDirty();
      this._renderer.updateShape();
    }

    getShape(): CSGShapeType {
      return this._shape;
    }

    setRadius(radius: float): void {
      const val = Math.max(0.001, radius || 1);
      if (this._radius === val) return;
      this._radius = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getRadius(): float {
      return this._radius;
    }

    setRadialSegments(segments: integer): void {
      const val = Math.max(3, segments || 32);
      if (this._radialSegments === val) return;
      this._radialSegments = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getRadialSegments(): integer {
      return this._radialSegments;
    }

    setHeightSegments(segments: integer): void {
      const val = Math.max(1, segments || 1);
      if (this._heightSegments === val) return;
      this._heightSegments = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getHeightSegments(): integer {
      return this._heightSegments;
    }

    setTube(tube: float): void {
      const val = Math.max(0.001, tube || 0.4);
      if (this._tube === val) return;
      this._tube = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getTube(): float {
      return this._tube;
    }

    setTubularSegments(segments: integer): void {
      const val = Math.max(3, segments || 8);
      if (this._tubularSegments === val) return;
      this._tubularSegments = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getTubularSegments(): integer {
      return this._tubularSegments;
    }

    setArc(arc: float): void {
      const val = Math.max(0.001, arc || Math.PI * 2);
      if (this._arc === val) return;
      this._arc = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getArc(): float {
      return this._arc;
    }

    setCapSegments(segments: integer): void {
      const val = Math.max(1, segments || 4);
      if (this._capSegments === val) return;
      this._capSegments = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getCapSegments(): integer {
      return this._capSegments;
    }

    setThetaStart(thetaStart: float): void {
      const val = thetaStart || 0;
      if (this._thetaStart === val) return;
      this._thetaStart = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getThetaStart(): float {
      return this._thetaStart;
    }

    setThetaLength(thetaLength: float): void {
      const val = thetaLength || Math.PI * 2;
      if (this._thetaLength === val) return;
      this._thetaLength = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getThetaLength(): float {
      return this._thetaLength;
    }

    setPhiStart(phiStart: float): void {
      const val = phiStart || 0;
      if (this._phiStart === val) return;
      this._phiStart = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getPhiStart(): float {
      return this._phiStart;
    }

    setPhiLength(phiLength: float): void {
      const val = phiLength || Math.PI;
      if (this._phiLength === val) return;
      this._phiLength = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getPhiLength(): float {
      return this._phiLength;
    }

    setOpenEnded(openEnded: boolean): void {
      const val = !!openEnded;
      if (this._openEnded === val) return;
      this._openEnded = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    isOpenEnded(): boolean {
      return this._openEnded;
    }

    // ============================================================
    // GETTERS / SETTERS — CSG Properties
    // ============================================================

    setCSGRole(role: CSGRoleType): void {
      const normalizedRole =
        role === 'Room' || role === 'Cutter' ? role : 'Solid';
      if (this._csgRole === normalizedRole) return;

      this._csgRole = normalizedRole;

      // Auto-configure based on role
      if (normalizedRole === 'Room') {
        this._roomMode = true;
        this._facesInward = true;
        this._generateCollision = true;
        this._csgOperation = 'Union';
        this._faceOrientation = 'Inward';
      } else if (normalizedRole === 'Cutter') {
        this._roomMode = false;
        this._facesInward = false;
        this._csgOperation = 'Subtract';
        this._faceOrientation = 'Outward';
      } else {
        this._roomMode = false;
        this._csgOperation = 'Union';
        this._faceOrientation = 'Outward';
      }

      this._markDirty();
      this._renderer.updateCSG();
    }

    getCSGRole(): CSGRoleType {
      return this._csgRole;
    }

    setCSGOperation(operation: CSGOperationType): void {
      if (
        operation !== 'Union' &&
        operation !== 'Subtract' &&
        operation !== 'Intersect'
      ) {
        operation = 'Union';
      }
      if (this._csgOperation === operation) return;

      this._csgOperation = operation;

      if (operation === 'Subtract') {
        this._csgRole = 'Cutter';
        this._roomMode = false;
      } else if (this._csgRole === 'Cutter') {
        this._csgRole = 'Solid';
      }

      this._markDirty();
      this._renderer.updateCSG();
    }

    getCSGOperation(): CSGOperationType {
      return this._csgOperation;
    }

    setCSGMode(mode: 'Single' | 'Combined'): void {
      const nextMode = mode === 'Combined' ? 'Combined' : 'Single';
      if (this._csgMode === nextMode) return;
      this._csgMode = nextMode;
      this._markDirty();
      this._renderer.updateCSG();
    }

    getCSGMode(): 'Single' | 'Combined' {
      return this._csgMode;
    }

    setTargetObjectName(name: string): void {
      if (this._targetObjectName === name) return;
      this._targetObjectName = name || '';
      this._markDirty();
      this._renderer.updateCSG();
    }

    getTargetObjectName(): string {
      return this._targetObjectName;
    }

    // ============================================================
    // GETTERS / SETTERS — Face Orientation (FlipFace)
    // ============================================================

    setFaceOrientation(orientation: FaceOrientationType): void {
      const validOrientations: FaceOrientationType[] = [
        'Outward',
        'Inward',
        'DoubleSided',
      ];
      const nextOrientation = validOrientations.includes(orientation)
        ? orientation
        : 'Outward';
      if (this._faceOrientation === nextOrientation) return;

      this._faceOrientation = nextOrientation;
      this._facesInward = nextOrientation === 'Inward';
      this._roomMode = nextOrientation === 'Inward';
      if (nextOrientation === 'Inward') {
        this._csgRole = 'Room';
      } else if (this._csgRole === 'Room') {
        this._csgRole = 'Solid';
      }

      this._markDirty();
      this._renderer.updateFaceOrientation();
    }

    getFaceOrientation(): FaceOrientationType {
      return this._faceOrientation;
    }

    setRoomMode(enable: boolean): void {
      if (this._roomMode === enable) return;
      this._roomMode = enable;
      this._csgRole = enable ? 'Room' : 'Solid';
      this._faceOrientation = enable ? 'Inward' : 'Outward';
      this._facesInward = enable;
      this._generateCollision = true;
      this._markDirty();
      this._renderer.updateFaceOrientation();
    }

    isRoomModeEnabled(): boolean {
      return this._roomMode;
    }

    setFacesInward(enable: boolean): void {
      if (this._facesInward === enable) return;
      this._facesInward = enable;
      this._roomMode = enable;
      this._faceOrientation = enable ? 'Inward' : 'Outward';
      this._csgRole = enable ? 'Room' : 'Solid';
      this._markDirty();
      this._renderer.updateFaceOrientation();
    }

    areFacesInward(): boolean {
      return this._facesInward || this._roomMode;
    }

    flipFaces(): void {
      this.setFacesInward(!this.areFacesInward());
    }

    setWallThickness(wallThickness: float): void {
      const val = Math.max(0.001, wallThickness || 8);
      if (this._wallThickness === val) return;
      this._wallThickness = val;
      this._markDirty();
      this._renderer.updateShape();
    }

    getWallThickness(): float {
      return this._wallThickness;
    }

    // ============================================================
    // GETTERS / SETTERS — Material & Appearance
    // ============================================================

    setMaterialType(materialTypeString: string): void {
      const newMaterialType = this._convertMaterialType(materialTypeString);
      if (this._materialType === newMaterialType) return;
      this._materialType = newMaterialType;
      this._renderer.updateMaterials();
    }

    getMaterialType(): gdjs.CSG3DRuntimeObject.MaterialType {
      return this._materialType;
    }

    setColor(tint: string): void {
      if (this._tint === tint) return;
      this._tint = tint || '255;255;255';
      this._renderer.updateTint();
    }

    getColor(): string {
      return this._tint;
    }

    setResourceName(resourceName: string): void {
      if (this._resourceName === resourceName) return;
      this._resourceName = resourceName || '';
      this._renderer.updateTexture();
    }

    getResourceName(): string {
      return this._resourceName;
    }

    setResourceRepeat(repeat: boolean): void {
      if (this._resourceRepeat === repeat) return;
      this._resourceRepeat = repeat;
      this._renderer.updateTexture();
    }

    isResourceRepeatEnabled(): boolean {
      return this._resourceRepeat;
    }

    shouldUseTransparentTexture(): boolean {
      return this._shouldUseTransparentTexture;
    }

    updateShadowCasting(value: boolean | undefined): void {
      const normalizedValue = value !== false;
      if (this._isCastingShadow === normalizedValue) return;
      this._isCastingShadow = normalizedValue;
      this._renderer.updateShadowCasting();
    }

    updateShadowReceiving(value: boolean | undefined): void {
      const normalizedValue = value !== false;
      if (this._isReceivingShadow === normalizedValue) return;
      this._isReceivingShadow = normalizedValue;
      this._renderer.updateShadowReceiving();
    }

    // ============================================================
    // GETTERS / SETTERS — Collision & Physics
    // ============================================================

    setCollisionGenerationEnabled(enable: boolean): void {
      if (this._generateCollision === enable) return;
      this._generateCollision = enable;
    }

    isCollisionGenerationEnabled(): boolean {
      return this._generateCollision;
    }

    setCollisionLayer(collisionLayer: float): void {
      this._collisionLayer = Math.max(0, Math.floor(collisionLayer || 0));
    }

    getCollisionLayer(): float {
      return this._collisionLayer;
    }

    setCollisionMask(collisionMask: float): void {
      this._collisionMask = Math.max(0, Math.floor(collisionMask || 0));
    }

    getCollisionMask(): float {
      return this._collisionMask;
    }

    setCollisionPriority(collisionPriority: float): void {
      this._collisionPriority = collisionPriority || 0;
    }

    getCollisionPriority(): float {
      return this._collisionPriority;
    }

    setCollisionShape(shape: 'Box' | 'Mesh' | 'ConvexHull'): void {
      const validShapes: ('Box' | 'Mesh' | 'ConvexHull')[] = [
        'Box',
        'Mesh',
        'ConvexHull',
      ];
      const nextShape = validShapes.includes(shape) ? shape : 'Box';
      if (this._collisionShape === nextShape) return;
      this._collisionShape = nextShape;
    }

    getCollisionShape(): 'Box' | 'Mesh' | 'ConvexHull' {
      return this._collisionShape;
    }

    // ============================================================
    // GETTERS / SETTERS — Geometry Optimization
    // ============================================================

    setCalculateTangentsEnabled(enable: boolean): void {
      if (this._calculateTangents === enable) return;
      this._calculateTangents = enable;
      this._markDirty();
      this._renderer.updateGeometry();
    }

    isCalculateTangentsEnabled(): boolean {
      return this._calculateTangents;
    }

    setAutoSmoothEnabled(enable: boolean): void {
      if (this._autoSmooth === enable) return;
      this._autoSmooth = enable;
      this._markDirty();
      this._renderer.updateGeometry();
    }

    isAutoSmoothEnabled(): boolean {
      return this._autoSmooth;
    }

    setSmoothingAngle(smoothingAngle: float): void {
      const normalizedAngle = Math.max(0, Math.min(180, smoothingAngle || 0));
      if (this._smoothingAngle === normalizedAngle) return;
      this._smoothingAngle = normalizedAngle;
      this._markDirty();
      this._renderer.updateGeometry();
    }

    getSmoothingAngle(): float {
      return this._smoothingAngle;
    }

    setMergeVerticesEnabled(enable: boolean): void {
      if (this._mergeVertices === enable) return;
      this._mergeVertices = enable;
      this._markDirty();
      this._renderer.updateGeometry();
    }

    isMergeVerticesEnabled(): boolean {
      return this._mergeVertices;
    }

    // ============================================================
    // GETTERS / SETTERS — Baking
    // ============================================================

    setBakeOnStart(enable: boolean): void {
      this._bakeOnStart = enable;
    }

    isBakeOnStartEnabled(): boolean {
      return this._bakeOnStart;
    }

    // ============================================================
    // INTERNAL HELPERS
    // ============================================================

    private _markDirty(): void {
      this._dirty = true;
      this._isBaked = false;
    }

    isDirty(): boolean {
      return this._dirty;
    }

    clearDirty(): void {
      this._dirty = false;
    }

    isBaked(): boolean {
      return this._isBaked;
    }

    getBakedGeometry(): any {
      return this._bakedGeometry;
    }

    setBakedGeometry(geometry: any): void {
      this._bakedGeometry = geometry;
      this._isBaked = true;
      this._dirty = false;
    }

    _convertMaterialType(
      materialTypeString: string | undefined
    ): gdjs.CSG3DRuntimeObject.MaterialType {
      switch (materialTypeString) {
        case 'Basic':
          return gdjs.CSG3DRuntimeObject.MaterialType.Basic;
        case 'StandardWithoutMetalness':
          return gdjs.CSG3DRuntimeObject.MaterialType.StandardWithoutMetalness;
        case 'Matte':
          return gdjs.CSG3DRuntimeObject.MaterialType.Matte;
        case 'Glossy':
          return gdjs.CSG3DRuntimeObject.MaterialType.Glossy;
        case 'Metallic':
          return gdjs.CSG3DRuntimeObject.MaterialType.Metallic;
        case 'Standard':
        default:
          return gdjs.CSG3DRuntimeObject.MaterialType.Standard;
      }
    }

    getRenderer(): gdjs.RuntimeObject3DRenderer {
      return this._renderer;
    }

    // ============================================================
    // COLLISION SURFACES
    // ============================================================

    /**
     * Returns collision surfaces for this CSG object.
     * For Room mode, returns 6 wall surfaces.
     * For Solid mode, returns a single bounding box surface.
     * For Cutter mode, returns no collision (it's a subtractive shape).
     */
    getCSGCollisionSurfaces(): CSGCollisionSurface[] {
      if (!this._generateCollision) return [];
      if (this._csgRole === 'Cutter') return [];

      const width = this.getWidth();
      const height = this.getHeight();
      const depth = this.getDepth();
      const x = this.getX();
      const y = this.getY();
      const z = this.getZ();
      const rotX = this.getRotationX();
      const rotY = this.getRotationY();
      const rotZ = this.getRotationZ();

      // Non-room mode: single bounding box
      if (!this._roomMode) {
        return [
          {
            name: 'solid',
            x,
            y,
            z,
            width,
            height,
            depth,
            rotationX: rotX,
            rotationY: rotY,
            rotationZ: rotZ,
            collisionLayer: this._collisionLayer,
            collisionMask: this._collisionMask,
            collisionPriority: this._collisionPriority,
          },
        ];
      }

      // Room mode: 6 wall surfaces with thickness
      const thickness = Math.max(this._wallThickness, 0.001);

      return [
        {
          name: 'floor',
          x,
          y,
          z,
          width,
          height: thickness,
          depth,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
        {
          name: 'ceiling',
          x,
          y: y + height - thickness,
          z,
          width,
          height: thickness,
          depth,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
        {
          name: 'frontWall',
          x,
          y,
          z,
          width,
          height,
          depth: thickness,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
        {
          name: 'backWall',
          x,
          y,
          z: z + depth - thickness,
          width,
          height,
          depth: thickness,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
        {
          name: 'leftWall',
          x,
          y,
          z,
          width: thickness,
          height,
          depth,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
        {
          name: 'rightWall',
          x: x + width - thickness,
          y,
          z,
          width: thickness,
          height,
          depth,
          rotationX: rotX,
          rotationY: rotY,
          rotationZ: rotZ,
          collisionLayer: this._collisionLayer,
          collisionMask: this._collisionMask,
          collisionPriority: this._collisionPriority,
        },
      ];
    }

    // ============================================================
    // BAKING & EXPORT
    // ============================================================

    /**
     * Bakes the current CSG geometry into a static mesh.
     * This freezes the geometry and improves performance.
     */
    bakeGeometry(): void {
      this._renderer.bakeGeometry();
      this._isBaked = true;
      this._dirty = false;
    }

    /**
     * Unbakes the geometry, restoring dynamic CSG operations.
     */
    unbakeGeometry(): void {
      this._isBaked = false;
      this._markDirty();
      this._renderer.unbakeGeometry();
    }

    /**
     * Exports baked geometry data to a GDevelop variable.
     */
    bakeStaticMesh(resultVariable: gdjs.Variable): void {
      resultVariable.clearChildren();
      resultVariable.getChild('type').setString('CSG');
      resultVariable.getChild('shape').setString(this._shape);
      resultVariable.getChild('x').setNumber(this.getX());
      resultVariable.getChild('y').setNumber(this.getY());
      resultVariable.getChild('z').setNumber(this.getZ());
      resultVariable.getChild('width').setNumber(this.getWidth());
      resultVariable.getChild('height').setNumber(this.getHeight());
      resultVariable.getChild('depth').setNumber(this.getDepth());
      resultVariable.getChild('rotationX').setNumber(this.getRotationX());
      resultVariable.getChild('rotationY').setNumber(this.getRotationY());
      resultVariable.getChild('rotationZ').setNumber(this.getRotationZ());
      resultVariable.getChild('facesInward').setBoolean(this.areFacesInward());
      resultVariable
        .getChild('calculateTangents')
        .setBoolean(this._calculateTangents);
      resultVariable.getChild('autoSmooth').setBoolean(this._autoSmooth);
      resultVariable.getChild('smoothingAngle').setNumber(this._smoothingAngle);
      resultVariable.getChild('materialType').setNumber(this._materialType);
      resultVariable.getChild('csgRole').setString(this._csgRole);
      resultVariable.getChild('csgOperation').setString(this._csgOperation);
      resultVariable.getChild('isBaked').setBoolean(this._isBaked);
    }

    /**
     * Exports collision surfaces to a GDevelop variable.
     */
    bakeCollisionShape(resultVariable: gdjs.Variable): void {
      this.writeCollisionSurfaces(resultVariable);
      resultVariable.getChild('collisionLayer').setNumber(this._collisionLayer);
      resultVariable.getChild('collisionMask').setNumber(this._collisionMask);
      resultVariable
        .getChild('collisionPriority')
        .setNumber(this._collisionPriority);
      resultVariable.getChild('collisionShape').setString(this._collisionShape);
    }

    writeCollisionSurfaces(resultVariable: gdjs.Variable): void {
      resultVariable.clearChildren();
      const surfaces = this.getCSGCollisionSurfaces();
      resultVariable.getChild('surfaceCount').setNumber(surfaces.length);
      const surfacesVariable = resultVariable.getChild('surfaces');

      for (let index = 0; index < surfaces.length; index++) {
        const surface = surfaces[index];
        const surfaceVariable = surfacesVariable.getChild(String(index));
        surfaceVariable.getChild('type').setString(surface.name);
        surfaceVariable.getChild('x').setNumber(surface.x);
        surfaceVariable.getChild('y').setNumber(surface.y);
        surfaceVariable.getChild('z').setNumber(surface.z);
        surfaceVariable.getChild('width').setNumber(surface.width);
        surfaceVariable.getChild('height').setNumber(surface.height);
        surfaceVariable.getChild('depth').setNumber(surface.depth);
        surfaceVariable.getChild('rotationX').setNumber(surface.rotationX);
        surfaceVariable.getChild('rotationY').setNumber(surface.rotationY);
        surfaceVariable.getChild('rotationZ').setNumber(surface.rotationZ);
        surfaceVariable
          .getChild('collisionLayer')
          .setNumber(surface.collisionLayer);
        surfaceVariable
          .getChild('collisionMask')
          .setNumber(surface.collisionMask);
        surfaceVariable
          .getChild('collisionPriority')
          .setNumber(surface.collisionPriority);
      }
    }

    // ============================================================
    // UPDATE FROM OBJECT DATA (Editor changes)
    // ============================================================

    updateFromObjectData(
      oldObjectData: CSG3DObjectData,
      newObjectData: CSG3DObjectData
    ): boolean {
      super.updateFromObjectData(oldObjectData, newObjectData);
      const oldContent = oldObjectData.content;
      const newContent = newObjectData.content;

      // Shape properties
      if (oldContent.shape !== newContent.shape) {
        this.setShape(newContent.shape || 'Box');
      }
      if (oldContent.radius !== newContent.radius) {
        this.setRadius(newContent.radius || 1);
      }
      if (oldContent.radialSegments !== newContent.radialSegments) {
        this.setRadialSegments(newContent.radialSegments || 32);
      }
      if (oldContent.heightSegments !== newContent.heightSegments) {
        this.setHeightSegments(newContent.heightSegments || 1);
      }
      if (oldContent.tube !== newContent.tube) {
        this.setTube(newContent.tube || 0.4);
      }
      if (oldContent.tubularSegments !== newContent.tubularSegments) {
        this.setTubularSegments(newContent.tubularSegments || 8);
      }
      if (oldContent.arc !== newContent.arc) {
        this.setArc(newContent.arc !== undefined ? newContent.arc : Math.PI * 2);
      }
      if (oldContent.capSegments !== newContent.capSegments) {
        this.setCapSegments(newContent.capSegments || 4);
      }
      if (oldContent.thetaStart !== newContent.thetaStart) {
        this.setThetaStart(newContent.thetaStart || 0);
      }
      if (oldContent.thetaLength !== newContent.thetaLength) {
        this.setThetaLength(newContent.thetaLength || Math.PI * 2);
      }
      if (oldContent.phiStart !== newContent.phiStart) {
        this.setPhiStart(newContent.phiStart || 0);
      }
      if (oldContent.phiLength !== newContent.phiLength) {
        this.setPhiLength(newContent.phiLength || Math.PI);
      }
      if (oldContent.openEnded !== newContent.openEnded) {
        this.setOpenEnded(!!newContent.openEnded);
      }

      // CSG properties
      if (oldContent.csgRole !== newContent.csgRole) {
        this.setCSGRole(newContent.csgRole || 'Solid');
      }
      if (oldContent.csgOperation !== newContent.csgOperation) {
        this.setCSGOperation(newContent.csgOperation || 'Union');
      }
      if (oldContent.csgMode !== newContent.csgMode) {
        this.setCSGMode(newContent.csgMode || 'Single');
      }
      if (oldContent.targetObjectName !== newContent.targetObjectName) {
        this.setTargetObjectName(newContent.targetObjectName || '');
      }

      // Face orientation
      if (oldContent.faceOrientation !== newContent.faceOrientation) {
        this.setFaceOrientation(newContent.faceOrientation || 'Outward');
      }
      if (oldContent.roomMode !== newContent.roomMode) {
        this.setRoomMode(!!newContent.roomMode);
      }
      if (oldContent.facesInward !== newContent.facesInward) {
        this.setFacesInward(!!newContent.facesInward);
      }
      if (oldContent.wallThickness !== newContent.wallThickness) {
        this.setWallThickness(newContent.wallThickness || 8);
      }

      // Material
      if (oldContent.materialType !== newContent.materialType) {
        this.setMaterialType(newContent.materialType || 'Standard');
      }
      if (oldContent.tint !== newContent.tint) {
        this.setColor(newContent.tint || '255;255;255');
      }
      if (oldContent.resourceName !== newContent.resourceName) {
        this.setResourceName(newContent.resourceName || '');
      }
      if (oldContent.resourceRepeat !== newContent.resourceRepeat) {
        this.setResourceRepeat(!!newContent.resourceRepeat);
      }
      if (oldContent.isCastingShadow !== newContent.isCastingShadow) {
        this.updateShadowCasting(newContent.isCastingShadow);
      }
      if (oldContent.isReceivingShadow !== newContent.isReceivingShadow) {
        this.updateShadowReceiving(newContent.isReceivingShadow);
      }

      // Collision
      if (oldContent.generateCollision !== newContent.generateCollision) {
        this.setCollisionGenerationEnabled(!!newContent.generateCollision);
      }
      if (oldContent.collisionLayer !== newContent.collisionLayer) {
        this.setCollisionLayer(newContent.collisionLayer || 0);
      }
      if (oldContent.collisionMask !== newContent.collisionMask) {
        this.setCollisionMask(
          newContent.collisionMask !== undefined ? newContent.collisionMask : 1
        );
      }
      if (oldContent.collisionPriority !== newContent.collisionPriority) {
        this.setCollisionPriority(newContent.collisionPriority || 0);
      }
      if (oldContent.collisionShape !== newContent.collisionShape) {
        this.setCollisionShape(newContent.collisionShape || 'Box');
      }

      // Geometry optimization
      if (oldContent.calculateTangents !== newContent.calculateTangents) {
        this.setCalculateTangentsEnabled(!!newContent.calculateTangents);
      }
      if (oldContent.autoSmooth !== newContent.autoSmooth) {
        this.setAutoSmoothEnabled(newContent.autoSmooth !== false);
      }
      if (oldContent.smoothingAngle !== newContent.smoothingAngle) {
        this.setSmoothingAngle(newContent.smoothingAngle || 30);
      }
      if (oldContent.mergeVertices !== newContent.mergeVertices) {
        this.setMergeVerticesEnabled(newContent.mergeVertices !== false);
      }

      // Baking
      if (oldContent.bakeOnStart !== newContent.bakeOnStart) {
        this.setBakeOnStart(!!newContent.bakeOnStart);
      }

      return true;
    }

    // ============================================================
    // NETWORK SYNC
    // ============================================================

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): CSG3DObjectNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        sh: this._shape,
        ra: this._radius,
        rs: this._radialSegments,
        hs: this._heightSegments,
        tb: this._tube,
        ts: this._tubularSegments,
        ar: this._arc,
        cs: this._capSegments,
        tsr: this._thetaStart,
        tl: this._thetaLength,
        ps: this._phiStart,
        pl: this._phiLength,
        oe: this._openEnded,
        cr: this._csgRole,
        co: this._csgOperation,
        cm: this._csgMode,
        ton: this._targetObjectName,
        fo: this._faceOrientation,
        rm: this._roomMode,
        wt: this._wallThickness,
        fi: this._facesInward,
        mt: this._materialType,
        tn: this._tint,
        et: this._shouldUseTransparentTexture,
        rn: this._resourceName,
        rr: this._resourceRepeat,
        ic: this._isCastingShadow,
        ir: this._isReceivingShadow,
        gc: this._generateCollision,
        cl: this._collisionLayer,
        ck: this._collisionMask,
        cp: this._collisionPriority,
        csh: this._collisionShape,
        ct: this._calculateTangents,
        as: this._autoSmooth,
        sa: this._smoothingAngle,
        mv: this._mergeVertices,
        bs: this._bakeOnStart,
      };
    }

    updateFromNetworkSyncData(
      networkSyncData: CSG3DObjectNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      // Shape
      if (networkSyncData.sh !== undefined) this.setShape(networkSyncData.sh);
      if (networkSyncData.ra !== undefined) this.setRadius(networkSyncData.ra);
      if (networkSyncData.rs !== undefined)
        this.setRadialSegments(networkSyncData.rs);
      if (networkSyncData.hs !== undefined)
        this.setHeightSegments(networkSyncData.hs);
      if (networkSyncData.tb !== undefined) this.setTube(networkSyncData.tb);
      if (networkSyncData.ts !== undefined)
        this.setTubularSegments(networkSyncData.ts);
      if (networkSyncData.ar !== undefined) this.setArc(networkSyncData.ar);
      if (networkSyncData.cs !== undefined)
        this.setCapSegments(networkSyncData.cs);
      if (networkSyncData.tsr !== undefined)
        this.setThetaStart(networkSyncData.tsr);
      if (networkSyncData.tl !== undefined)
        this.setThetaLength(networkSyncData.tl);
      if (networkSyncData.ps !== undefined)
        this.setPhiStart(networkSyncData.ps);
      if (networkSyncData.pl !== undefined)
        this.setPhiLength(networkSyncData.pl);
      if (networkSyncData.oe !== undefined)
        this.setOpenEnded(networkSyncData.oe);

      // CSG
      if (networkSyncData.cr !== undefined)
        this.setCSGRole(networkSyncData.cr);
      if (networkSyncData.co !== undefined)
        this.setCSGOperation(networkSyncData.co);
      if (networkSyncData.cm !== undefined)
        this.setCSGMode(networkSyncData.cm);
      if (networkSyncData.ton !== undefined)
        this.setTargetObjectName(networkSyncData.ton);

      // Face orientation
      if (networkSyncData.fo !== undefined)
        this.setFaceOrientation(networkSyncData.fo);
      if (networkSyncData.rm !== undefined)
        this.setRoomMode(networkSyncData.rm);
      if (networkSyncData.fi !== undefined)
        this.setFacesInward(networkSyncData.fi);
      if (networkSyncData.wt !== undefined)
        this.setWallThickness(networkSyncData.wt);

      // Material
      if (networkSyncData.mt !== undefined) this._materialType = networkSyncData.mt;
      if (networkSyncData.tn !== undefined) this.setColor(networkSyncData.tn);
      if (networkSyncData.rn !== undefined)
        this.setResourceName(networkSyncData.rn);
      if (networkSyncData.rr !== undefined)
        this.setResourceRepeat(networkSyncData.rr);
      if (networkSyncData.ic !== undefined)
        this.updateShadowCasting(networkSyncData.ic);
      if (networkSyncData.ir !== undefined)
        this.updateShadowReceiving(networkSyncData.ir);

      // Collision
      if (networkSyncData.gc !== undefined)
        this.setCollisionGenerationEnabled(networkSyncData.gc);
      if (networkSyncData.cl !== undefined)
        this.setCollisionLayer(networkSyncData.cl);
      if (networkSyncData.ck !== undefined)
        this.setCollisionMask(networkSyncData.ck);
      if (networkSyncData.cp !== undefined)
        this.setCollisionPriority(networkSyncData.cp);
      if (networkSyncData.csh !== undefined)
        this.setCollisionShape(networkSyncData.csh);

      // Geometry
      if (networkSyncData.ct !== undefined)
        this.setCalculateTangentsEnabled(networkSyncData.ct);
      if (networkSyncData.as !== undefined)
        this.setAutoSmoothEnabled(networkSyncData.as);
      if (networkSyncData.sa !== undefined)
        this.setSmoothingAngle(networkSyncData.sa);
      if (networkSyncData.mv !== undefined)
        this.setMergeVerticesEnabled(networkSyncData.mv);

      // Baking
      if (networkSyncData.bs !== undefined)
        this.setBakeOnStart(networkSyncData.bs);
    }

    // ============================================================
    // EXTRA RUNTIME ACTIONS
    // ============================================================

    /**
     * Performs a CSG Union with another CSG object.
     */
    unionWith(otherObjectName: string): void {
      this._csgOperation = 'Union';
      this._targetObjectName = otherObjectName;
      this._csgMode = 'Combined';
      this._markDirty();
      this._renderer.updateCSG();
    }

    /**
     * Performs a CSG Subtract with another CSG object.
     */
    subtractWith(otherObjectName: string): void {
      this._csgOperation = 'Subtract';
      this._targetObjectName = otherObjectName;
      this._csgMode = 'Combined';
      this._markDirty();
      this._renderer.updateCSG();
    }

    /**
     * Performs a CSG Intersect with another CSG object.
     */
    intersectWith(otherObjectName: string): void {
      this._csgOperation = 'Intersect';
      this._targetObjectName = otherObjectName;
      this._csgMode = 'Combined';
      this._markDirty();
      this._renderer.updateCSG();
    }

    /**
     * Clears the CSG combination and reverts to single mode.
     */
    clearCSGCombination(): void {
      this._csgMode = 'Single';
      this._targetObjectName = '';
      this._csgOperation = 'Union';
      this._markDirty();
      this._renderer.updateCSG();
    }

    /**
     * Converts this object to a room (enables inward faces + collision).
     */
    convertToRoom(): void {
      this.setCSGRole('Room');
    }

    /**
     * Converts this object to a cutter (enables subtractive mode).
     */
    convertToCutter(): void {
      this.setCSGRole('Cutter');
    }

    /**
     * Converts this object to a solid (default mode).
     */
    convertToSolid(): void {
      this.setCSGRole('Solid');
    }
  }

  /** @category Objects > 3D CSG */
  export namespace CSG3DRuntimeObject {
    export enum MaterialType {
      Basic,
      StandardWithoutMetalness,
      Matte,
      Standard,
      Glossy,
      Metallic,
    }
  }

  gdjs.registerObject(
    'Scene3D::CSG3DObject',
    gdjs.CSG3DRuntimeObject
  );
}
