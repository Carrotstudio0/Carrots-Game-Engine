namespace gdjs {
  export type LightType = 'point' | 'directional';
  export type LightFalloffModel = 'quadratic' | 'sdf';
  export type LightAntialiasing = 'none' | 'low' | 'medium' | 'high';

  /**
   * @category Objects > Light
   */
  export type LightObjectDataType = {
    /** The base parameters of light object. */
    content: {
      /** The radius of light object. */
      radius: number;
      /** A string representing color in hexadecimal format. */
      color: string;
      /** A string representing the name of texture used for light object. */
      texture: string;
      /** A string representing the name of normal map texture used for light object. */
      normalMap?: string;
      /** The light type: point or directional. */
      lightType?: string;
      /** The light intensity multiplier. */
      intensity?: number;
      /** The directional light angle in degrees. */
      directionAngle?: number;
      /** Strength of specular highlights. */
      specularStrength?: number;
      /** Shininess of specular highlights. */
      specularShininess?: number;
      /** Softness for shadows. 0 means hard shadows. */
      shadowSoftness?: number;
      /** The falloff model used by the light shader. */
      falloffModel?: string;
      /** Antialiasing quality used to smooth light edges. */
      antialiasing?: string;
      /** Edge smoothing width for the light shape in pixels. */
      edgeSmoothing?: number;
      /** true if the light objects shows debug graphics, false otherwise. */
      debugMode: boolean;
    };
  };

  /**
   * @category Objects > Light
   */
  export type LightObjectData = ObjectData & LightObjectDataType;

  /**
   * @category Objects > Light
   */
  export type LightNetworkSyncDataType = {
    rad: number;
    col: string;
    ltp: LightType;
    int: number;
    dir: number;
    sps: number;
    spsh: number;
    shs: number;
    flf: LightFalloffModel;
    aa: LightAntialiasing;
    esm: number;
    tex: string;
    nrm: string;
  };

  /**
   * @category Objects > Light
   */
  export type LightNetworkSyncData = ObjectNetworkSyncData &
    LightNetworkSyncDataType;

  /**
   * Displays a Light object.
   * @category Objects > Light
   */
  export class LightRuntimeObject extends gdjs.RuntimeObject {
    _radius: number;

    /** color in format [r, g, b], where each component is in the range [0, 255] */
    _color: integer[];
    _lightType: LightType;
    _intensity: number;
    _directionAngle: number;
    _specularStrength: number;
    _specularShininess: number;
    _shadowSoftness: number;
    _falloffModel: LightFalloffModel;
    _antialiasing: LightAntialiasing;
    _edgeSmoothing: number;
    _debugMode: boolean;
    _texture: string;
    _normalMap: string;
    _obstaclesManager: gdjs.LightObstaclesManager;
    _renderer: gdjs.LightRuntimeObjectRenderer;
    _instanceContainer: gdjs.RuntimeScene;

    constructor(
      runtimeScene: gdjs.RuntimeScene,
      lightObjectData: LightObjectData,
      instanceData?: InstanceData
    ) {
      super(runtimeScene, lightObjectData, instanceData);
      this._radius =
        lightObjectData.content.radius > 0 ? lightObjectData.content.radius : 1;
      this._color = gdjs.rgbOrHexToRGBColor(lightObjectData.content.color);
      this._lightType = LightRuntimeObject._sanitizeLightType(
        lightObjectData.content.lightType
      );
      this._intensity = LightRuntimeObject._clampMin(
        lightObjectData.content.intensity,
        0,
        1
      );
      this._directionAngle = LightRuntimeObject._safeNumber(
        lightObjectData.content.directionAngle,
        0
      );
      this._specularStrength = LightRuntimeObject._clampMin(
        lightObjectData.content.specularStrength,
        0,
        0
      );
      this._specularShininess = LightRuntimeObject._clampMin(
        lightObjectData.content.specularShininess,
        1,
        32
      );
      this._shadowSoftness = LightRuntimeObject._clampMin(
        lightObjectData.content.shadowSoftness,
        0,
        0
      );
      this._falloffModel = LightRuntimeObject._sanitizeFalloffModel(
        lightObjectData.content.falloffModel
      );
      this._antialiasing = LightRuntimeObject._sanitizeAntialiasing(
        lightObjectData.content.antialiasing
      );
      this._edgeSmoothing = LightRuntimeObject._clampMin(
        lightObjectData.content.edgeSmoothing,
        0,
        1
      );
      this._debugMode = lightObjectData.content.debugMode;
      this._texture = lightObjectData.content.texture || '';
      this._normalMap = lightObjectData.content.normalMap || '';
      this._obstaclesManager =
        gdjs.LightObstaclesManager.getManager(runtimeScene);
      this._renderer = new gdjs.LightRuntimeObjectRenderer(this, runtimeScene);
      this._instanceContainer = runtimeScene;

      // *ALWAYS* call `this.onCreated()` at the very end of your object constructor.
      this.onCreated();
    }

    static hexToRGBColor(hex) {
      const hexNumber = parseInt(hex.replace('#', ''), 16);
      return [(hexNumber >> 16) & 255, (hexNumber >> 8) & 255, hexNumber & 255];
    }

    private static _sanitizeLightType(lightType?: string): LightType {
      return lightType === 'directional' ? 'directional' : 'point';
    }

    private static _sanitizeFalloffModel(
      falloffModel?: string
    ): LightFalloffModel {
      return falloffModel === 'sdf' ? 'sdf' : 'quadratic';
    }

    private static _sanitizeAntialiasing(
      antialiasing?: string
    ): LightAntialiasing {
      if (antialiasing === undefined) return 'high';
      if (antialiasing === 'low') return 'low';
      if (antialiasing === 'medium') return 'medium';
      if (antialiasing === 'high') return 'high';
      return 'none';
    }

    private static _safeNumber(
      value: number | undefined,
      fallback: number
    ): number {
      return typeof value === 'number' && isFinite(value) ? value : fallback;
    }

    private static _clampMin(
      value: number | undefined,
      minValue: number,
      fallback: number
    ): number {
      const safeValue = LightRuntimeObject._safeNumber(value, fallback);
      return Math.max(minValue, safeValue);
    }

    override getRendererObject() {
      return this._renderer.getRendererObject();
    }

    override updateFromObjectData(
      oldObjectData: LightObjectData,
      newObjectData: LightObjectData
    ): boolean {
      if (oldObjectData.content.radius !== newObjectData.content.radius) {
        this.setRadius(newObjectData.content.radius);
      }
      if (oldObjectData.content.color !== newObjectData.content.color) {
        this.setColor(newObjectData.content.color);
      }
      if (oldObjectData.content.texture !== newObjectData.content.texture) {
        this.setTexture(newObjectData.content.texture);
      }
      if (oldObjectData.content.normalMap !== newObjectData.content.normalMap) {
        this.setNormalMap(newObjectData.content.normalMap);
      }
      if (oldObjectData.content.lightType !== newObjectData.content.lightType) {
        this.setLightType(newObjectData.content.lightType);
      }
      if (oldObjectData.content.intensity !== newObjectData.content.intensity) {
        this.setIntensity(newObjectData.content.intensity);
      }
      if (
        oldObjectData.content.directionAngle !== newObjectData.content.directionAngle
      ) {
        this.setDirectionAngle(newObjectData.content.directionAngle);
      }
      if (
        oldObjectData.content.specularStrength !==
        newObjectData.content.specularStrength
      ) {
        this.setSpecularStrength(newObjectData.content.specularStrength);
      }
      if (
        oldObjectData.content.specularShininess !==
        newObjectData.content.specularShininess
      ) {
        this.setSpecularShininess(newObjectData.content.specularShininess);
      }
      if (
        oldObjectData.content.shadowSoftness !==
        newObjectData.content.shadowSoftness
      ) {
        this.setShadowSoftness(newObjectData.content.shadowSoftness);
      }
      if (
        oldObjectData.content.falloffModel !== newObjectData.content.falloffModel
      ) {
        this.setFalloffModel(newObjectData.content.falloffModel);
      }
      if (
        oldObjectData.content.antialiasing !== newObjectData.content.antialiasing
      ) {
        this.setAntialiasing(newObjectData.content.antialiasing);
      }
      if (
        oldObjectData.content.edgeSmoothing !== newObjectData.content.edgeSmoothing
      ) {
        this.setEdgeSmoothing(newObjectData.content.edgeSmoothing);
      }
      if (oldObjectData.content.debugMode !== newObjectData.content.debugMode) {
        this._debugMode = newObjectData.content.debugMode;
        this._renderer.updateDebugMode();
      }
      return true;
    }

    override getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): LightNetworkSyncData {
      return {
        ...super.getNetworkSyncData(syncOptions),
        rad: this.getRadius(),
        col: this.getColor(),
        ltp: this.getLightType(),
        int: this.getIntensity(),
        dir: this.getDirectionAngle(),
        sps: this.getSpecularStrength(),
        spsh: this.getSpecularShininess(),
        shs: this.getShadowSoftness(),
        flf: this.getFalloffModel(),
        aa: this.getAntialiasing(),
        esm: this.getEdgeSmoothing(),
        tex: this.getTexture(),
        nrm: this.getNormalMap(),
      };
    }

    override updateFromNetworkSyncData(
      networkSyncData: LightNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.rad !== undefined) {
        this.setRadius(networkSyncData.rad);
      }
      if (networkSyncData.col !== undefined) {
        this.setColor(networkSyncData.col);
      }
      if (networkSyncData.ltp !== undefined) {
        this.setLightType(networkSyncData.ltp);
      }
      if (networkSyncData.int !== undefined) {
        this.setIntensity(networkSyncData.int);
      }
      if (networkSyncData.dir !== undefined) {
        this.setDirectionAngle(networkSyncData.dir);
      }
      if (networkSyncData.sps !== undefined) {
        this.setSpecularStrength(networkSyncData.sps);
      }
      if (networkSyncData.spsh !== undefined) {
        this.setSpecularShininess(networkSyncData.spsh);
      }
      if (networkSyncData.shs !== undefined) {
        this.setShadowSoftness(networkSyncData.shs);
      }
      if (networkSyncData.flf !== undefined) {
        this.setFalloffModel(networkSyncData.flf);
      }
      if (networkSyncData.aa !== undefined) {
        this.setAntialiasing(networkSyncData.aa);
      }
      if (networkSyncData.esm !== undefined) {
        this.setEdgeSmoothing(networkSyncData.esm);
      }
      if (networkSyncData.tex !== undefined) {
        this.setTexture(networkSyncData.tex);
      }
      if (networkSyncData.nrm !== undefined) {
        this.setNormalMap(networkSyncData.nrm);
      }
    }

    override updatePreRender(): void {
      this._renderer.ensureUpToDate();
    }

    override onDestroyed(): void {
      super.onDestroyed();
      this._renderer.destroy();
    }

    /**
     * Get the radius of the light object.
     * @returns radius of the light object.
     */
    getRadius(): number {
      return this._radius;
    }

    /**
     * Set the radius of the light object.
     */
    setRadius(radius: number): void {
      this._radius = radius > 0 ? radius : 1;
      this._renderer.updateRadius();
    }

    override getHeight(): float {
      return 2 * this._radius;
    }

    override getWidth(): float {
      return 2 * this._radius;
    }

    /**
     * Get the x co-ordinate of the top-left vertex/point of light object.
     * @returns x co-ordinate of the top-left vertex/point.
     */
    getDrawableX(): float {
      return this.x - this._radius;
    }

    /**
     * Get the y co-ordinate of the top-left vertex/point of light object.
     * @returns y co-ordinate of the top-left vertex/point.
     */
    getDrawableY(): float {
      return this.y - this._radius;
    }

    /**
     * Get the color of the light object as a "R;G;B" string.
     * @returns the color of light object in "R;G;B" format.
     */
    getColor(): string {
      return this._color[0] + ';' + this._color[1] + ';' + this._color[2];
    }

    /**
     * Set the color of the light object in format "R;G;B" string, with components in the range of [0-255].
     */
    setColor(color: string): void {
      this._color = gdjs.rgbOrHexToRGBColor(color);
      this._renderer.updateColor();
    }

    /**
     * Returns the type of the light.
     */
    getLightType(): LightType {
      return this._lightType;
    }

    /**
     * Sets the type of the light.
     */
    setLightType(lightType: string | undefined): void {
      this._lightType = LightRuntimeObject._sanitizeLightType(lightType);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns the intensity multiplier of the light.
     */
    getIntensity(): number {
      return this._intensity;
    }

    /**
     * Sets the intensity multiplier of the light.
     */
    setIntensity(intensity: number | undefined): void {
      this._intensity = LightRuntimeObject._clampMin(intensity, 0, 1);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns the directional angle of the light in degrees.
     */
    getDirectionAngle(): number {
      return this._directionAngle;
    }

    /**
     * Sets the directional angle of the light in degrees.
     */
    setDirectionAngle(directionAngle: number | undefined): void {
      this._directionAngle = LightRuntimeObject._safeNumber(directionAngle, 0);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns specular strength.
     */
    getSpecularStrength(): number {
      return this._specularStrength;
    }

    /**
     * Sets specular strength.
     */
    setSpecularStrength(specularStrength: number | undefined): void {
      this._specularStrength = LightRuntimeObject._clampMin(
        specularStrength,
        0,
        0
      );
      this._renderer.updateLightParameters();
    }

    /**
     * Returns specular shininess.
     */
    getSpecularShininess(): number {
      return this._specularShininess;
    }

    /**
     * Sets specular shininess.
     */
    setSpecularShininess(specularShininess: number | undefined): void {
      this._specularShininess = LightRuntimeObject._clampMin(
        specularShininess,
        1,
        32
      );
      this._renderer.updateLightParameters();
    }

    /**
     * Returns shadow softness.
     */
    getShadowSoftness(): number {
      return this._shadowSoftness;
    }

    /**
     * Sets shadow softness.
     */
    setShadowSoftness(shadowSoftness: number | undefined): void {
      this._shadowSoftness = LightRuntimeObject._clampMin(shadowSoftness, 0, 0);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns the falloff model used for the light.
     */
    getFalloffModel(): LightFalloffModel {
      return this._falloffModel;
    }

    /**
     * Sets the falloff model used for the light.
     */
    setFalloffModel(falloffModel: string | undefined): void {
      this._falloffModel = LightRuntimeObject._sanitizeFalloffModel(falloffModel);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns antialiasing quality used by this light.
     */
    getAntialiasing(): LightAntialiasing {
      return this._antialiasing;
    }

    /**
     * Sets antialiasing quality used by this light.
     */
    setAntialiasing(antialiasing: string | undefined): void {
      this._antialiasing =
        LightRuntimeObject._sanitizeAntialiasing(antialiasing);
      this._renderer.updateLightParameters();
    }

    /**
     * Returns edge smoothing width used by this light.
     */
    getEdgeSmoothing(): number {
      return this._edgeSmoothing;
    }

    /**
     * Sets edge smoothing width used by this light.
     */
    setEdgeSmoothing(edgeSmoothing: number | undefined): void {
      this._edgeSmoothing = LightRuntimeObject._clampMin(edgeSmoothing, 0, 1);
      this._renderer.updateLightParameters();
    }

    /**
     * Get the light obstacles manager.
     * @returns the light obstacles manager.
     */
    getObstaclesManager(): gdjs.LightObstaclesManager {
      return this._obstaclesManager;
    }

    /**
     * Returns true if the light shows debug graphics, false otherwise.
     * @returns true if debug mode is activated.
     */
    getDebugMode(): boolean {
      return this._debugMode;
    }

    /**
     * Returns the path of texture resource.
     * @returns the path of texture.
     */
    getTexture(): string {
      return this._texture;
    }

    /**
     * Sets the path of the light texture.
     */
    setTexture(texture: string | undefined): void {
      this._texture = texture || '';
      this._renderer.updateMesh();
    }

    /**
     * Returns the path of normal map resource.
     */
    getNormalMap(): string {
      return this._normalMap;
    }

    /**
     * Sets the path of normal map resource.
     */
    setNormalMap(normalMap: string | undefined): void {
      this._normalMap = normalMap || '';
      this._renderer.updateMesh();
    }
  }
  gdjs.registerObject('Lighting::LightObject', gdjs.LightRuntimeObject);
}
