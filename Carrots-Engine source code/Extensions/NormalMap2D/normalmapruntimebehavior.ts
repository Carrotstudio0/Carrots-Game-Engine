namespace gdjs {
  type RuntimeObjectWithDisplayRenderer = gdjs.RuntimeObject & {
    getRendererObject?: () => gdjs.RendererObjectInterface | null | undefined;
  };

  class NormalMap2DPixiFilter extends PIXI.Filter {
    constructor() {
      const vertexShader = undefined;
      const fragmentShader = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform sampler2D uNormalMap;
        uniform vec3 lightDir;
        uniform float lightIntensity;
        uniform float ambientIntensity;
        uniform float normalStrength;
        uniform float specularStrength;
        uniform float shininess;
        uniform float normalMapValid;
        uniform vec2 uvScale;
        uniform vec2 uvOffset;
        uniform float invertY;

        void main(void) {
          vec4 baseColor = texture2D(uSampler, vTextureCoord);

          vec2 normalUv = vTextureCoord * uvScale + uvOffset;
          vec3 sampledNormal = texture2D(uNormalMap, normalUv).rgb * 2.0 - 1.0;
          sampledNormal.y *= mix(1.0, -1.0, invertY);
          sampledNormal.xy *= normalStrength;
          sampledNormal = normalize(sampledNormal);

          vec3 flatNormal = vec3(0.0, 0.0, 1.0);
          vec3 normal = normalize(mix(flatNormal, sampledNormal, normalMapValid));

          vec3 L = normalize(lightDir);
          float lambert = max(dot(normal, L), 0.0);
          float diffuseFactor = ambientIntensity + lambert * lightIntensity;
          vec3 litColor = baseColor.rgb * diffuseFactor;

          vec3 viewDir = vec3(0.0, 0.0, 1.0);
          vec3 halfDir = normalize(L + viewDir);
          float specular = pow(max(dot(normal, halfDir), 0.0), max(1.0, shininess));
          litColor += vec3(specular * specularStrength * lightIntensity);

          gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), baseColor.a);
        }
      `;

      super(vertexShader, fragmentShader, {
        uNormalMap: PIXI.Texture.WHITE,
        lightDir: new Float32Array([0, 0, 1]),
        lightIntensity: 1,
        ambientIntensity: 0.35,
        normalStrength: 1,
        specularStrength: 0.35,
        shininess: 24,
        normalMapValid: 0,
        uvScale: new Float32Array([1, 1]),
        uvOffset: new Float32Array([0, 0]),
        invertY: 0,
      });
    }
  }

  /**
   * @category Behaviors > 2D Normal Map
   */
  export class NormalMap2DRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _normalMapResource: string;
    private _lightAngle: number;
    private _lightElevation: number;
    private _lightIntensity: number;
    private _ambientIntensity: number;
    private _normalStrength: number;
    private _specularStrength: number;
    private _shininess: number;
    private _invertY: boolean;
    private _uvScaleX: number;
    private _uvScaleY: number;
    private _uvOffsetX: number;
    private _uvOffsetY: number;

    private _filter: NormalMap2DPixiFilter | null;
    private _appliedRendererObject: PIXI.DisplayObject | null;
    private _uniformsDirty: boolean;
    private _normalMapDirty: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);

      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._normalMapResource =
        typeof behaviorData.normalMapResource === 'string'
          ? behaviorData.normalMapResource
          : '';
      this._lightAngle = this._sanitizeFiniteNumber(behaviorData.lightAngle, 315);
      this._lightElevation = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.lightElevation, 45),
        -90,
        90
      );
      this._lightIntensity = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.lightIntensity, 1),
        0,
        8
      );
      this._ambientIntensity = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.ambientIntensity, 0.35),
        0,
        4
      );
      this._normalStrength = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.normalStrength, 1),
        0,
        8
      );
      this._specularStrength = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.specularStrength, 0.35),
        0,
        4
      );
      this._shininess = this._clamp(
        this._sanitizeFiniteNumber(behaviorData.shininess, 24),
        1,
        256
      );
      this._invertY = !!behaviorData.invertY;
      this._uvScaleX = Math.max(
        0.0001,
        this._sanitizeFiniteNumber(behaviorData.uvScaleX, 1)
      );
      this._uvScaleY = Math.max(
        0.0001,
        this._sanitizeFiniteNumber(behaviorData.uvScaleY, 1)
      );
      this._uvOffsetX = this._sanitizeFiniteNumber(behaviorData.uvOffsetX, 0);
      this._uvOffsetY = this._sanitizeFiniteNumber(behaviorData.uvOffsetY, 0);

      this._filter = null;
      this._appliedRendererObject = null;
      this._uniformsDirty = true;
      this._normalMapDirty = true;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) {
        this.setEnabled(!!behaviorData.enabled);
      }
      if (behaviorData.normalMapResource !== undefined) {
        this.setNormalMapResource(behaviorData.normalMapResource);
      }
      if (behaviorData.lightAngle !== undefined) {
        this.setLightAngle(behaviorData.lightAngle);
      }
      if (behaviorData.lightElevation !== undefined) {
        this.setLightElevation(behaviorData.lightElevation);
      }
      if (behaviorData.lightIntensity !== undefined) {
        this.setLightIntensity(behaviorData.lightIntensity);
      }
      if (behaviorData.ambientIntensity !== undefined) {
        this.setAmbientIntensity(behaviorData.ambientIntensity);
      }
      if (behaviorData.normalStrength !== undefined) {
        this.setNormalStrength(behaviorData.normalStrength);
      }
      if (behaviorData.specularStrength !== undefined) {
        this.setSpecularStrength(behaviorData.specularStrength);
      }
      if (behaviorData.shininess !== undefined) {
        this.setShininess(behaviorData.shininess);
      }
      if (behaviorData.invertY !== undefined) {
        this.setInvertY(!!behaviorData.invertY);
      }
      if (behaviorData.uvScaleX !== undefined) {
        this.setUVScaleX(behaviorData.uvScaleX);
      }
      if (behaviorData.uvScaleY !== undefined) {
        this.setUVScaleY(behaviorData.uvScaleY);
      }
      if (behaviorData.uvOffsetX !== undefined) {
        this.setUVOffsetX(behaviorData.uvOffsetX);
      }
      if (behaviorData.uvOffsetY !== undefined) {
        this.setUVOffsetY(behaviorData.uvOffsetY);
      }

      return true;
    }

    override onCreated(): void {
      this._uniformsDirty = true;
      this._normalMapDirty = true;
      this._ensureFilterState();
      this._applySettingsIfNeeded();
    }

    override onActivate(): void {
      this._uniformsDirty = true;
      this._normalMapDirty = true;
      this._ensureFilterState();
      this._applySettingsIfNeeded();
    }

    override onDeActivate(): void {
      this._detachFilter();
    }

    override onDestroy(): void {
      this._detachFilter();
      if (this._filter) {
        this._filter.destroy();
        this._filter = null;
      }
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      this._ensureFilterState();
      this._applySettingsIfNeeded();
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalizedEnabled = !!enabled;
      if (this._enabled === normalizedEnabled) return;
      this._enabled = normalizedEnabled;
      this._uniformsDirty = true;
      this._ensureFilterState();
      this._applySettingsIfNeeded();
    }

    disableNormalMap(): void {
      this.setEnabled(false);
    }

    getNormalMapResource(): string {
      return this._normalMapResource;
    }

    setNormalMapResource(resourceName: string): void {
      const normalizedResourceName = (resourceName || '').toString();
      if (this._normalMapResource === normalizedResourceName) return;
      this._normalMapResource = normalizedResourceName;
      this._normalMapDirty = true;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    hasValidNormalMap(): boolean {
      const { valid } = this._resolveNormalMapTexture();
      return valid;
    }

    getLightAngle(): number {
      return this._lightAngle;
    }

    setLightAngle(lightAngle: number): void {
      if (!Number.isFinite(lightAngle)) return;
      if (this._lightAngle === lightAngle) return;
      this._lightAngle = lightAngle;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getLightElevation(): number {
      return this._lightElevation;
    }

    setLightElevation(lightElevation: number): void {
      if (!Number.isFinite(lightElevation)) return;
      const clampedElevation = this._clamp(lightElevation, -90, 90);
      if (this._lightElevation === clampedElevation) return;
      this._lightElevation = clampedElevation;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getLightIntensity(): number {
      return this._lightIntensity;
    }

    setLightIntensity(lightIntensity: number): void {
      if (!Number.isFinite(lightIntensity)) return;
      const clampedIntensity = this._clamp(lightIntensity, 0, 8);
      if (this._lightIntensity === clampedIntensity) return;
      this._lightIntensity = clampedIntensity;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getAmbientIntensity(): number {
      return this._ambientIntensity;
    }

    setAmbientIntensity(ambientIntensity: number): void {
      if (!Number.isFinite(ambientIntensity)) return;
      const clampedIntensity = this._clamp(ambientIntensity, 0, 4);
      if (this._ambientIntensity === clampedIntensity) return;
      this._ambientIntensity = clampedIntensity;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getNormalStrength(): number {
      return this._normalStrength;
    }

    setNormalStrength(normalStrength: number): void {
      if (!Number.isFinite(normalStrength)) return;
      const clampedStrength = this._clamp(normalStrength, 0, 8);
      if (this._normalStrength === clampedStrength) return;
      this._normalStrength = clampedStrength;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getSpecularStrength(): number {
      return this._specularStrength;
    }

    setSpecularStrength(specularStrength: number): void {
      if (!Number.isFinite(specularStrength)) return;
      const clampedStrength = this._clamp(specularStrength, 0, 4);
      if (this._specularStrength === clampedStrength) return;
      this._specularStrength = clampedStrength;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getShininess(): number {
      return this._shininess;
    }

    setShininess(shininess: number): void {
      if (!Number.isFinite(shininess)) return;
      const clampedShininess = this._clamp(shininess, 1, 256);
      if (this._shininess === clampedShininess) return;
      this._shininess = clampedShininess;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    isInvertY(): boolean {
      return this._invertY;
    }

    setInvertY(invertY: boolean): void {
      const normalizedInvertY = !!invertY;
      if (this._invertY === normalizedInvertY) return;
      this._invertY = normalizedInvertY;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getUVScaleX(): number {
      return this._uvScaleX;
    }

    setUVScaleX(uvScaleX: number): void {
      if (!Number.isFinite(uvScaleX)) return;
      const safeScaleX = Math.max(0.0001, uvScaleX);
      if (this._uvScaleX === safeScaleX) return;
      this._uvScaleX = safeScaleX;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getUVScaleY(): number {
      return this._uvScaleY;
    }

    setUVScaleY(uvScaleY: number): void {
      if (!Number.isFinite(uvScaleY)) return;
      const safeScaleY = Math.max(0.0001, uvScaleY);
      if (this._uvScaleY === safeScaleY) return;
      this._uvScaleY = safeScaleY;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getUVOffsetX(): number {
      return this._uvOffsetX;
    }

    setUVOffsetX(uvOffsetX: number): void {
      if (!Number.isFinite(uvOffsetX)) return;
      if (this._uvOffsetX === uvOffsetX) return;
      this._uvOffsetX = uvOffsetX;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    getUVOffsetY(): number {
      return this._uvOffsetY;
    }

    setUVOffsetY(uvOffsetY: number): void {
      if (!Number.isFinite(uvOffsetY)) return;
      if (this._uvOffsetY === uvOffsetY) return;
      this._uvOffsetY = uvOffsetY;
      this._uniformsDirty = true;
      this._applySettingsIfNeeded();
    }

    private _sanitizeFiniteNumber(value: unknown, fallback: number): number {
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
    }

    private _clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    private _getOwnerDisplayObject(): PIXI.DisplayObject | null {
      const owner = this.owner as RuntimeObjectWithDisplayRenderer;
      if (!owner || typeof owner.getRendererObject !== 'function') {
        return null;
      }

      const rendererObject = owner.getRendererObject();
      if (!rendererObject) {
        return null;
      }

      const pixiObject = rendererObject as unknown as PIXI.DisplayObject;
      if (!pixiObject) {
        return null;
      }
      if (typeof (pixiObject as any).filters === 'undefined') {
        return null;
      }
      return pixiObject;
    }

    private _ensureFilterState(): void {
      if (!this.activated() || !this._enabled) {
        this._detachFilter();
        return;
      }

      const displayObject = this._getOwnerDisplayObject();
      if (!displayObject) {
        this._detachFilter();
        return;
      }

      if (!this._filter) {
        this._filter = new NormalMap2DPixiFilter();
        this._uniformsDirty = true;
        this._normalMapDirty = true;
      }

      if (displayObject === this._appliedRendererObject) {
        return;
      }

      this._detachFilter();
      const currentFilters = displayObject.filters || [];
      if (currentFilters.indexOf(this._filter) === -1) {
        displayObject.filters = currentFilters.concat(this._filter);
      }
      this._appliedRendererObject = displayObject;
      this._uniformsDirty = true;
      this._normalMapDirty = true;
    }

    private _detachFilter(): void {
      if (!this._appliedRendererObject || !this._filter) {
        this._appliedRendererObject = null;
        return;
      }

      const currentFilters = this._appliedRendererObject.filters || [];
      if (currentFilters.length) {
        this._appliedRendererObject.filters = currentFilters.filter(
          (filter) => filter !== this._filter
        );
      }
      this._appliedRendererObject = null;
    }

    private _resolveNormalMapTexture(): {
      texture: PIXI.Texture;
      valid: boolean;
    } {
      if (!this._normalMapResource) {
        this._normalMapDirty = false;
        return { texture: PIXI.Texture.WHITE, valid: false };
      }

      const instanceContainer = this.owner.getInstanceContainer();
      if (!instanceContainer) {
        this._normalMapDirty = false;
        return { texture: PIXI.Texture.WHITE, valid: false };
      }

      const imageManager = instanceContainer
        .getGame()
        .getImageManager() as gdjs.PixiImageManager;
      const resourceLoader = instanceContainer.getGame().getResourceLoader();
      if (!resourceLoader.getResource(this._normalMapResource)) {
        this._normalMapDirty = false;
        return { texture: PIXI.Texture.WHITE, valid: false };
      }
      const invalidTexture = imageManager.getInvalidPIXITexture();
      const normalTexture = imageManager.getPIXITexture(this._normalMapResource);

      if (
        !normalTexture ||
        normalTexture.destroyed ||
        !normalTexture.valid ||
        normalTexture === invalidTexture
      ) {
        this._normalMapDirty = true;
        return { texture: PIXI.Texture.WHITE, valid: false };
      }

      normalTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
      this._normalMapDirty = false;
      return { texture: normalTexture, valid: true };
    }

    private _applySettingsIfNeeded(): void {
      if (!this._filter || !this._appliedRendererObject) {
        return;
      }
      if (!this._uniformsDirty && !this._normalMapDirty) {
        return;
      }

      const filterUniforms = this._filter.uniforms as any;
      const { texture, valid } = this._resolveNormalMapTexture();

      const lightAngleInRad = this._lightAngle * (Math.PI / 180);
      const lightElevationInRad = this._lightElevation * (Math.PI / 180);
      const cosElevation = Math.cos(lightElevationInRad);
      const lightDirectionX = Math.cos(lightAngleInRad) * cosElevation;
      const lightDirectionY = Math.sin(lightAngleInRad) * cosElevation;
      const lightDirectionZ = Math.sin(lightElevationInRad);

      filterUniforms.uNormalMap = texture;
      filterUniforms.normalMapValid = valid ? 1 : 0;
      filterUniforms.lightIntensity = this._lightIntensity;
      filterUniforms.ambientIntensity = this._ambientIntensity;
      filterUniforms.normalStrength = this._normalStrength;
      filterUniforms.specularStrength = this._specularStrength;
      filterUniforms.shininess = this._shininess;
      filterUniforms.invertY = this._invertY ? 1 : 0;

      const lightDirection = filterUniforms.lightDir as Float32Array;
      lightDirection[0] = lightDirectionX;
      lightDirection[1] = lightDirectionY;
      lightDirection[2] = lightDirectionZ;

      const uvScale = filterUniforms.uvScale as Float32Array;
      uvScale[0] = this._uvScaleX;
      uvScale[1] = this._uvScaleY;

      const uvOffset = filterUniforms.uvOffset as Float32Array;
      uvOffset[0] = this._uvOffsetX;
      uvOffset[1] = this._uvOffsetY;

      this._uniformsDirty = false;
    }
  }

  gdjs.registerBehavior(
    'NormalMap2D::NormalMapBehavior',
    gdjs.NormalMap2DRuntimeBehavior
  );
}
