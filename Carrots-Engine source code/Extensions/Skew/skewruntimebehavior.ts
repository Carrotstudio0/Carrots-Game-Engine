namespace gdjs {
  const degToRad = Math.PI / 180;
  const defaultMaxAbsoluteSkewDegrees = 85;
  const hardMaxAbsoluteSkewDegrees = 89.5;
  const minDeltaTimeSeconds = 1 / 240;
  const maxDeltaTimeSeconds = 0.25;

  type SkewPoint = {
    x: number;
    y: number;
    set?: (x: number, y: number) => void;
  };

  type RuntimeObjectWithSkewRenderer = gdjs.RuntimeObject & {
    getRendererObject?: () =>
      | (gdjs.RendererObjectInterface & { skew?: SkewPoint })
      | null;
  };

  /**
   * @category Behaviors > 2D Skew
   */
  export class SkewRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _skewX: number;
    private _skewY: number;
    private _maxAbsoluteSkewDegrees: number;
    private _smoothingResponsiveness: number;
    private _windEnabled: boolean;
    private _windAmplitudeX: number;
    private _windAmplitudeY: number;
    private _windFrequency: number;
    private _windTurbulence: number;
    private _windTime: number;
    private _windPhaseSeed: number;
    private _smoothedSkewX: number;
    private _smoothedSkewY: number;
    private _smoothedStateInitialized: boolean;
    private _dirty: boolean;
    private _appliedRendererObject:
      | (gdjs.RendererObjectInterface & {
          skew?: SkewPoint;
        })
      | null;
    private _previousSkewX: number;
    private _previousSkewY: number;
    private _hasSavedPreviousSkew: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);

      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._maxAbsoluteSkewDegrees = this._sanitizeMaxAbsoluteSkewDegrees(
        Number.isFinite(behaviorData.maxAbsoluteSkewDegrees)
          ? behaviorData.maxAbsoluteSkewDegrees
          : defaultMaxAbsoluteSkewDegrees
      );
      this._skewX = Number.isFinite(behaviorData.skewX)
        ? this._sanitizeSkewDegrees(behaviorData.skewX)
        : 0;
      this._skewY = Number.isFinite(behaviorData.skewY)
        ? this._sanitizeSkewDegrees(behaviorData.skewY)
        : 0;
      this._smoothingResponsiveness = this._sanitizeResponsiveness(
        Number.isFinite(behaviorData.smoothingResponsiveness)
          ? behaviorData.smoothingResponsiveness
          : 0
      );
      this._windEnabled = !!behaviorData.windEnabled;
      this._windAmplitudeX = Number.isFinite(behaviorData.windAmplitudeX)
        ? behaviorData.windAmplitudeX
        : 0;
      this._windAmplitudeY = Number.isFinite(behaviorData.windAmplitudeY)
        ? behaviorData.windAmplitudeY
        : 0;
      this._windFrequency = this._sanitizeWindFrequency(
        Number.isFinite(behaviorData.windFrequency)
          ? behaviorData.windFrequency
          : 0.8
      );
      this._windTurbulence = this._clamp(
        Number.isFinite(behaviorData.windTurbulence)
          ? behaviorData.windTurbulence
          : 0.35,
        0,
        1
      );
      this._windTime = 0;
      this._windPhaseSeed = this._computeWindPhaseSeed();
      this._smoothedSkewX = this._skewX;
      this._smoothedSkewY = this._skewY;
      this._smoothedStateInitialized = true;
      this._dirty = true;
      this._appliedRendererObject = null;
      this._previousSkewX = 0;
      this._previousSkewY = 0;
      this._hasSavedPreviousSkew = false;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) {
        this.setEnabled(!!behaviorData.enabled);
      }
      if (
        behaviorData.skewX !== undefined &&
        Number.isFinite(behaviorData.skewX)
      ) {
        this.setSkewX(behaviorData.skewX);
      }
      if (
        behaviorData.skewY !== undefined &&
        Number.isFinite(behaviorData.skewY)
      ) {
        this.setSkewY(behaviorData.skewY);
      }
      if (
        behaviorData.maxAbsoluteSkewDegrees !== undefined &&
        Number.isFinite(behaviorData.maxAbsoluteSkewDegrees)
      ) {
        this.setMaxAbsoluteSkewDegrees(behaviorData.maxAbsoluteSkewDegrees);
      }
      if (
        behaviorData.smoothingResponsiveness !== undefined &&
        Number.isFinite(behaviorData.smoothingResponsiveness)
      ) {
        this.setSmoothingResponsiveness(behaviorData.smoothingResponsiveness);
      }
      if (behaviorData.windEnabled !== undefined) {
        this.setWindEnabled(!!behaviorData.windEnabled);
      }
      if (
        behaviorData.windAmplitudeX !== undefined &&
        Number.isFinite(behaviorData.windAmplitudeX)
      ) {
        this.setWindAmplitudeX(behaviorData.windAmplitudeX);
      }
      if (
        behaviorData.windAmplitudeY !== undefined &&
        Number.isFinite(behaviorData.windAmplitudeY)
      ) {
        this.setWindAmplitudeY(behaviorData.windAmplitudeY);
      }
      if (
        behaviorData.windFrequency !== undefined &&
        Number.isFinite(behaviorData.windFrequency)
      ) {
        this.setWindFrequency(behaviorData.windFrequency);
      }
      if (
        behaviorData.windTurbulence !== undefined &&
        Number.isFinite(behaviorData.windTurbulence)
      ) {
        this.setWindTurbulence(behaviorData.windTurbulence);
      }
      return true;
    }

    override onCreated(): void {
      this._dirty = true;
      this._smoothedStateInitialized = false;
      this._applyOrRestoreSkew();
    }

    override onActivate(): void {
      this._dirty = true;
      this._smoothedStateInitialized = false;
      this._applyOrRestoreSkew();
    }

    override onDeActivate(): void {
      this._restoreSkew();
    }

    override onDestroy(): void {
      this._restoreSkew();
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      const deltaTimeSeconds = this._getDeltaTimeSeconds();
      if (this._windEnabled) {
        this._windTime += deltaTimeSeconds;
      }
      this._applyOrRestoreSkew();
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalizedEnabled = !!enabled;
      if (this._enabled === normalizedEnabled) return;
      this._enabled = normalizedEnabled;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getSkewX(): number {
      return this._skewX;
    }

    setSkewX(skewXDegrees: number): void {
      if (!Number.isFinite(skewXDegrees)) return;
      const sanitizedSkewXDegrees = this._sanitizeSkewDegrees(skewXDegrees);
      if (this._skewX === sanitizedSkewXDegrees) return;
      this._skewX = sanitizedSkewXDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    addSkewX(deltaSkewXDegrees: number): void {
      if (!Number.isFinite(deltaSkewXDegrees)) return;
      this.setSkewX(this._skewX + deltaSkewXDegrees);
    }

    interpolateSkewX(
      targetSkewXDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      const sanitizedTargetSkewX = this._sanitizeSkewDegrees(targetSkewXDegrees);
      if (clampedInterpolationFactor === 1) {
        this.setSkewX(sanitizedTargetSkewX);
        return;
      }

      this.setSkewX(
        gdjs.evtTools.common.lerp(
          this._skewX,
          sanitizedTargetSkewX,
          clampedInterpolationFactor
        )
      );
    }

    getSkewY(): number {
      return this._skewY;
    }

    setSkewY(skewYDegrees: number): void {
      if (!Number.isFinite(skewYDegrees)) return;
      const sanitizedSkewYDegrees = this._sanitizeSkewDegrees(skewYDegrees);
      if (this._skewY === sanitizedSkewYDegrees) return;
      this._skewY = sanitizedSkewYDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    addSkewY(deltaSkewYDegrees: number): void {
      if (!Number.isFinite(deltaSkewYDegrees)) return;
      this.setSkewY(this._skewY + deltaSkewYDegrees);
    }

    interpolateSkewY(
      targetSkewYDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      const sanitizedTargetSkewY = this._sanitizeSkewDegrees(targetSkewYDegrees);
      if (clampedInterpolationFactor === 1) {
        this.setSkewY(sanitizedTargetSkewY);
        return;
      }

      this.setSkewY(
        gdjs.evtTools.common.lerp(
          this._skewY,
          sanitizedTargetSkewY,
          clampedInterpolationFactor
        )
      );
    }

    setSkew(skewXDegrees: number, skewYDegrees: number): void {
      if (!Number.isFinite(skewXDegrees) || !Number.isFinite(skewYDegrees)) {
        return;
      }
      const sanitizedSkewXDegrees = this._sanitizeSkewDegrees(skewXDegrees);
      const sanitizedSkewYDegrees = this._sanitizeSkewDegrees(skewYDegrees);
      if (
        this._skewX === sanitizedSkewXDegrees &&
        this._skewY === sanitizedSkewYDegrees
      ) {
        return;
      }
      this._skewX = sanitizedSkewXDegrees;
      this._skewY = sanitizedSkewYDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    interpolateSkew(
      targetSkewXDegrees: number,
      targetSkewYDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      const sanitizedTargetSkewX = this._sanitizeSkewDegrees(targetSkewXDegrees);
      const sanitizedTargetSkewY = this._sanitizeSkewDegrees(targetSkewYDegrees);
      if (clampedInterpolationFactor === 1) {
        this.setSkew(sanitizedTargetSkewX, sanitizedTargetSkewY);
        return;
      }

      this.setSkew(
        gdjs.evtTools.common.lerp(
          this._skewX,
          sanitizedTargetSkewX,
          clampedInterpolationFactor
        ),
        gdjs.evtTools.common.lerp(
          this._skewY,
          sanitizedTargetSkewY,
          clampedInterpolationFactor
        )
      );
    }

    interpolateSkewXBySpeed(
      targetSkewXDegrees: number,
      responsivenessPerSecond: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(responsivenessPerSecond)
      ) {
        return;
      }
      const sanitizedTargetSkewX = this._sanitizeSkewDegrees(targetSkewXDegrees);
      const blend = this._computeResponsivenessBlend(
        this._sanitizeResponsiveness(responsivenessPerSecond),
        this._getDeltaTimeSeconds()
      );
      if (blend === 0) return;
      this.setSkewX(gdjs.evtTools.common.lerp(this._skewX, sanitizedTargetSkewX, blend));
    }

    interpolateSkewYBySpeed(
      targetSkewYDegrees: number,
      responsivenessPerSecond: number
    ): void {
      if (
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(responsivenessPerSecond)
      ) {
        return;
      }
      const sanitizedTargetSkewY = this._sanitizeSkewDegrees(targetSkewYDegrees);
      const blend = this._computeResponsivenessBlend(
        this._sanitizeResponsiveness(responsivenessPerSecond),
        this._getDeltaTimeSeconds()
      );
      if (blend === 0) return;
      this.setSkewY(gdjs.evtTools.common.lerp(this._skewY, sanitizedTargetSkewY, blend));
    }

    interpolateSkewBySpeed(
      targetSkewXDegrees: number,
      targetSkewYDegrees: number,
      responsivenessPerSecond: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(responsivenessPerSecond)
      ) {
        return;
      }
      const sanitizedTargetSkewX = this._sanitizeSkewDegrees(targetSkewXDegrees);
      const sanitizedTargetSkewY = this._sanitizeSkewDegrees(targetSkewYDegrees);
      const blend = this._computeResponsivenessBlend(
        this._sanitizeResponsiveness(responsivenessPerSecond),
        this._getDeltaTimeSeconds()
      );
      if (blend === 0) return;
      this.setSkew(
        gdjs.evtTools.common.lerp(this._skewX, sanitizedTargetSkewX, blend),
        gdjs.evtTools.common.lerp(this._skewY, sanitizedTargetSkewY, blend)
      );
    }

    setSmoothingResponsiveness(responsivenessPerSecond: number): void {
      if (!Number.isFinite(responsivenessPerSecond)) return;
      const sanitizedResponsiveness =
        this._sanitizeResponsiveness(responsivenessPerSecond);
      if (this._smoothingResponsiveness === sanitizedResponsiveness) return;
      this._smoothingResponsiveness = sanitizedResponsiveness;
      if (this._smoothingResponsiveness <= 0) {
        this._smoothedStateInitialized = false;
      }
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getSmoothingResponsiveness(): number {
      return this._smoothingResponsiveness;
    }

    setMaxAbsoluteSkewDegrees(maxAbsoluteSkewDegrees: number): void {
      if (!Number.isFinite(maxAbsoluteSkewDegrees)) return;
      const sanitizedMax = this._sanitizeMaxAbsoluteSkewDegrees(
        maxAbsoluteSkewDegrees
      );
      if (this._maxAbsoluteSkewDegrees === sanitizedMax) return;

      this._maxAbsoluteSkewDegrees = sanitizedMax;
      this._skewX = this._sanitizeSkewDegrees(this._skewX);
      this._skewY = this._sanitizeSkewDegrees(this._skewY);
      if (this._smoothedStateInitialized) {
        this._smoothedSkewX = this._sanitizeSkewDegrees(this._smoothedSkewX);
        this._smoothedSkewY = this._sanitizeSkewDegrees(this._smoothedSkewY);
      }
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getMaxAbsoluteSkewDegrees(): number {
      return this._maxAbsoluteSkewDegrees;
    }

    setWindEnabled(windEnabled: boolean): void {
      const normalizedWindEnabled = !!windEnabled;
      if (this._windEnabled === normalizedWindEnabled) return;
      this._windEnabled = normalizedWindEnabled;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    isWindEnabled(): boolean {
      return this._windEnabled;
    }

    setWindAmplitudeX(windAmplitudeX: number): void {
      if (!Number.isFinite(windAmplitudeX)) return;
      if (this._windAmplitudeX === windAmplitudeX) return;
      this._windAmplitudeX = windAmplitudeX;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getWindAmplitudeX(): number {
      return this._windAmplitudeX;
    }

    setWindAmplitudeY(windAmplitudeY: number): void {
      if (!Number.isFinite(windAmplitudeY)) return;
      if (this._windAmplitudeY === windAmplitudeY) return;
      this._windAmplitudeY = windAmplitudeY;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getWindAmplitudeY(): number {
      return this._windAmplitudeY;
    }

    setWindFrequency(windFrequency: number): void {
      if (!Number.isFinite(windFrequency)) return;
      const sanitizedFrequency = this._sanitizeWindFrequency(windFrequency);
      if (this._windFrequency === sanitizedFrequency) return;
      this._windFrequency = sanitizedFrequency;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getWindFrequency(): number {
      return this._windFrequency;
    }

    setWindTurbulence(windTurbulence: number): void {
      if (!Number.isFinite(windTurbulence)) return;
      const clampedTurbulence = this._clamp(windTurbulence, 0, 1);
      if (this._windTurbulence === clampedTurbulence) return;
      this._windTurbulence = clampedTurbulence;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getWindTurbulence(): number {
      return this._windTurbulence;
    }

    resetWindTime(): void {
      this._windTime = 0;
      this._windPhaseSeed = this._computeWindPhaseSeed();
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    resetSkew(): void {
      this.setSkew(0, 0);
    }

    private _getOwnerRendererObject():
      | (gdjs.RendererObjectInterface & { skew?: SkewPoint })
      | null {
      const owner = this.owner as RuntimeObjectWithSkewRenderer;
      if (!owner || typeof owner.getRendererObject !== 'function') {
        return null;
      }
      return owner.getRendererObject() || null;
    }

    private _clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    private _sanitizeMaxAbsoluteSkewDegrees(maxAbsoluteSkewDegrees: number): number {
      if (!Number.isFinite(maxAbsoluteSkewDegrees)) {
        return defaultMaxAbsoluteSkewDegrees;
      }
      return this._clamp(
        Math.abs(maxAbsoluteSkewDegrees),
        0,
        hardMaxAbsoluteSkewDegrees
      );
    }

    private _sanitizeSkewDegrees(skewDegrees: number): number {
      if (!Number.isFinite(skewDegrees)) {
        return 0;
      }
      const maxAbsoluteSkew = this._clamp(
        this._maxAbsoluteSkewDegrees,
        0,
        hardMaxAbsoluteSkewDegrees
      );
      return this._clamp(skewDegrees, -maxAbsoluteSkew, maxAbsoluteSkew);
    }

    private _sanitizeResponsiveness(responsivenessPerSecond: number): number {
      if (!Number.isFinite(responsivenessPerSecond)) return 0;
      return this._clamp(responsivenessPerSecond, 0, 120);
    }

    private _sanitizeWindFrequency(windFrequency: number): number {
      if (!Number.isFinite(windFrequency)) return 0;
      return this._clamp(windFrequency, 0, 25);
    }

    private _computeResponsivenessBlend(
      responsivenessPerSecond: number,
      deltaTimeSeconds: number
    ): number {
      if (responsivenessPerSecond <= 0) return 0;
      if (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds <= 0) return 0;
      return 1 - Math.exp(-responsivenessPerSecond * deltaTimeSeconds);
    }

    private _getDeltaTimeSeconds(): number {
      const elapsedTimeInMilliseconds = this.owner.getElapsedTime();
      if (!Number.isFinite(elapsedTimeInMilliseconds)) {
        return minDeltaTimeSeconds;
      }
      return this._clamp(
        elapsedTimeInMilliseconds / 1000,
        minDeltaTimeSeconds,
        maxDeltaTimeSeconds
      );
    }

    private _computeWindPhaseSeed(): number {
      if (!this.owner || typeof this.owner.getUniqueId !== 'function') {
        return 0;
      }
      const uniqueId = this.owner.getUniqueId();
      const normalizedUniqueId = Number.isFinite(uniqueId)
        ? Math.abs(uniqueId % 9973) / 9973
        : 0;
      return normalizedUniqueId * Math.PI * 2;
    }

    private _computeWindSkewOffset(
      amplitude: number,
      axisOffset: number,
      deltaFrequencyMultiplier: number
    ): number {
      if (!Number.isFinite(amplitude) || amplitude === 0 || this._windFrequency <= 0) {
        return 0;
      }

      const basePhase =
        this._windTime * this._windFrequency * Math.PI * 2 +
        this._windPhaseSeed +
        axisOffset;
      const turbulence = this._windTurbulence;
      const mainSway = Math.sin(basePhase);
      const fineSway = Math.sin(basePhase * (1.65 + deltaFrequencyMultiplier));
      const gustSway = Math.sin(basePhase * 0.43 + 1.37);
      const layeredSway =
        mainSway * (1 - 0.45 * turbulence) +
        fineSway * (0.3 * turbulence) +
        gustSway * (0.15 * turbulence);

      return amplitude * layeredSway;
    }

    private _computeTargetSkewWithWind(): { skewX: number; skewY: number } {
      let skewX = this._skewX;
      let skewY = this._skewY;

      if (this._windEnabled) {
        skewX += this._computeWindSkewOffset(this._windAmplitudeX, 0, 0);
        skewY += this._computeWindSkewOffset(this._windAmplitudeY, 0.93, 0.47);
      }

      return {
        skewX: this._sanitizeSkewDegrees(skewX),
        skewY: this._sanitizeSkewDegrees(skewY),
      };
    }

    private _computeAppliedSkewDegrees(): { skewX: number; skewY: number } {
      const targetSkew = this._computeTargetSkewWithWind();
      if (!this._smoothedStateInitialized) {
        this._smoothedSkewX = targetSkew.skewX;
        this._smoothedSkewY = targetSkew.skewY;
        this._smoothedStateInitialized = true;
      } else if (this._smoothingResponsiveness > 0) {
        const blend = this._computeResponsivenessBlend(
          this._smoothingResponsiveness,
          this._getDeltaTimeSeconds()
        );
        if (blend > 0) {
          this._smoothedSkewX = gdjs.evtTools.common.lerp(
            this._smoothedSkewX,
            targetSkew.skewX,
            blend
          );
          this._smoothedSkewY = gdjs.evtTools.common.lerp(
            this._smoothedSkewY,
            targetSkew.skewY,
            blend
          );
        }
      } else {
        this._smoothedSkewX = targetSkew.skewX;
        this._smoothedSkewY = targetSkew.skewY;
      }

      return {
        skewX: this._sanitizeSkewDegrees(this._smoothedSkewX),
        skewY: this._sanitizeSkewDegrees(this._smoothedSkewY),
      };
    }

    private _canApplySkew(
      rendererObject: gdjs.RendererObjectInterface & {
        skew?: SkewPoint;
      }
    ): rendererObject is gdjs.RendererObjectInterface & { skew: SkewPoint } {
      if (!rendererObject || !rendererObject.skew) {
        return false;
      }
      const skew = rendererObject.skew;
      return (
        skew &&
        Number.isFinite(skew.x) &&
        Number.isFinite(skew.y) &&
        (typeof skew.set === 'function' ||
          (typeof skew.x === 'number' && typeof skew.y === 'number'))
      );
    }

    private _applyOrRestoreSkew(): void {
      if (!this.activated() || !this._enabled) {
        this._restoreSkew();
        return;
      }

      const rendererObject = this._getOwnerRendererObject();
      if (!rendererObject || !this._canApplySkew(rendererObject)) {
        return;
      }

      if (rendererObject !== this._appliedRendererObject) {
        this._restoreSkew();
        this._appliedRendererObject = rendererObject;
        this._previousSkewX = rendererObject.skew.x;
        this._previousSkewY = rendererObject.skew.y;
        this._hasSavedPreviousSkew = true;
        this._dirty = true;
      }

      if (!this._dirty) {
        return;
      }

      const appliedSkew = this._computeAppliedSkewDegrees();
      const skewXInRadians = appliedSkew.skewX * degToRad;
      const skewYInRadians = appliedSkew.skewY * degToRad;
      if (typeof rendererObject.skew.set === 'function') {
        rendererObject.skew.set(skewXInRadians, skewYInRadians);
      } else {
        rendererObject.skew.x = skewXInRadians;
        rendererObject.skew.y = skewYInRadians;
      }
      const targetSkew = this._computeTargetSkewWithWind();
      const hasSmoothingWorkLeft =
        this._smoothingResponsiveness > 0 &&
        (Math.abs(this._smoothedSkewX - targetSkew.skewX) > 0.0001 ||
          Math.abs(this._smoothedSkewY - targetSkew.skewY) > 0.0001);
      const hasWindMotion = this._windEnabled && this._windFrequency > 0;
      this._dirty = hasSmoothingWorkLeft || hasWindMotion;
    }

    private _restoreSkew(): void {
      if (
        !this._appliedRendererObject ||
        !this._canApplySkew(this._appliedRendererObject)
      ) {
        this._appliedRendererObject = null;
        this._hasSavedPreviousSkew = false;
        return;
      }

      if (this._hasSavedPreviousSkew) {
        if (typeof this._appliedRendererObject.skew.set === 'function') {
          this._appliedRendererObject.skew.set(
            this._previousSkewX,
            this._previousSkewY
          );
        } else {
          this._appliedRendererObject.skew.x = this._previousSkewX;
          this._appliedRendererObject.skew.y = this._previousSkewY;
        }
      }

      this._appliedRendererObject = null;
      this._hasSavedPreviousSkew = false;
      this._smoothedStateInitialized = false;
      this._dirty = true;
    }
  }

  gdjs.registerBehavior('Skew::SkewBehavior', gdjs.SkewRuntimeBehavior);
}
