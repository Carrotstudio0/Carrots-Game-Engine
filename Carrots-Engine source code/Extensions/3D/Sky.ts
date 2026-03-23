namespace gdjs {
  interface SkyFilterNetworkSyncData {
    tb: number;
    ry: number;
    mc: number;
    mg: number;
    si: number;
    se: number;
    sa: number;
    ex: number;
    st: number;
    sc: number;
    cv?: number;
    co?: number;
    ck?: number;
    cs?: number;
    cp?: number;
    cc?: number;
  }

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  gdjs.PixiFiltersTools.registerFilterCreator(
    'Scene3D::Sky',
    new (class implements gdjs.PixiFiltersTools.FilterCreator {
      makeFilter(
        target: EffectsTarget,
        effectData: EffectData
      ): gdjs.PixiFiltersTools.Filter {
        if (typeof THREE === 'undefined') {
          return new gdjs.PixiFiltersTools.EmptyFilter();
        }

        return new (class implements gdjs.PixiFiltersTools.Filter {
          private _isEnabled = false;
          private _skyMesh: THREE.Mesh | null = null;
          private _oldBackground: THREE.Texture | THREE.Color | null = null;

          private _turbidity = 4.2;
          private _rayleigh = 1.35;
          private _mieCoefficient = 0.009;
          private _mieDirectionalG = 0.92;
          private _sunIntensity = 1.35;
          private _sunElevation = 70;
          private _sunAzimuth = 82;
          private _exposure = 0.68;
          private _skyTintColorHex = 0xfffefa;
          private _sunColorHex = 0xfffaeb;

          private _cloudCoverage = 0.44;
          private _cloudOpacity = 0.46;
          private _cloudScale = 1.35;
          private _cloudSoftness = 0.2;
          private _cloudSpeed = 0;
          private _cloudColorHex = 0xf4f6fa;
          private _cloudTime = 0;

          constructor() {
            this._turbidity = clamp(
              effectData.doubleParameters.turbidity !== undefined
                ? effectData.doubleParameters.turbidity
                : this._turbidity,
              0,
              20
            );
            this._rayleigh = clamp(
              effectData.doubleParameters.rayleigh !== undefined
                ? effectData.doubleParameters.rayleigh
                : this._rayleigh,
              0,
              6
            );
            this._mieCoefficient = clamp(
              effectData.doubleParameters.mieCoefficient !== undefined
                ? effectData.doubleParameters.mieCoefficient
                : this._mieCoefficient,
              0,
              0.1
            );
            this._mieDirectionalG = clamp(
              effectData.doubleParameters.mieDirectionalG !== undefined
                ? effectData.doubleParameters.mieDirectionalG
                : this._mieDirectionalG,
              0,
              0.999
            );
            this._sunIntensity = Math.max(
              0,
              effectData.doubleParameters.sunIntensity !== undefined
                ? effectData.doubleParameters.sunIntensity
                : this._sunIntensity
            );
            this._sunElevation = clamp(
              effectData.doubleParameters.sunElevation !== undefined
                ? effectData.doubleParameters.sunElevation
                : this._sunElevation,
              -10,
              90
            );
            this._sunAzimuth =
              effectData.doubleParameters.sunAzimuth !== undefined
                ? effectData.doubleParameters.sunAzimuth
                : this._sunAzimuth;
            this._exposure = clamp(
              effectData.doubleParameters.exposure !== undefined
                ? effectData.doubleParameters.exposure
                : this._exposure,
              0,
              2
            );
            this._cloudCoverage = clamp(
              effectData.doubleParameters.cloudCoverage !== undefined
                ? effectData.doubleParameters.cloudCoverage
                : this._cloudCoverage,
              0,
              1
            );
            this._cloudOpacity = clamp(
              effectData.doubleParameters.cloudOpacity !== undefined
                ? effectData.doubleParameters.cloudOpacity
                : this._cloudOpacity,
              0,
              1
            );
            this._cloudScale = clamp(
              effectData.doubleParameters.cloudScale !== undefined
                ? effectData.doubleParameters.cloudScale
                : this._cloudScale,
              0.1,
              8
            );
            this._cloudSoftness = clamp(
              effectData.doubleParameters.cloudSoftness !== undefined
                ? effectData.doubleParameters.cloudSoftness
                : this._cloudSoftness,
              0,
              1
            );
            this._cloudSpeed = clamp(
              effectData.doubleParameters.cloudSpeed !== undefined
                ? effectData.doubleParameters.cloudSpeed
                : this._cloudSpeed,
              0,
              10
            );

            this._skyTintColorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.skyTintColor ||
                effectData.stringParameters.topColor ||
                effectData.stringParameters.horizonColor ||
                effectData.stringParameters.bottomColor ||
                '255;254;250'
            );
            this._sunColorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.sunColor || '255;250;235'
            );
            this._cloudColorHex = gdjs.rgbOrHexStringToNumber(
              effectData.stringParameters.cloudColor || '244;246;250'
            );
          }

          private _getScene(target: EffectsTarget): THREE.Scene | null {
            const scene = target.get3DRendererObject() as
              | THREE.Scene
              | null
              | undefined;
            return scene || null;
          }

          private _getThreeCamera(target: EffectsTarget): THREE.Camera | null {
            if (!target.getRuntimeLayer) return null;

            const runtimeLayer = target.getRuntimeLayer();
            if (!runtimeLayer) return null;

            const renderer = runtimeLayer.getRenderer() as {
              getThreeCamera?: () => THREE.Camera | null;
            };
            if (!renderer || !renderer.getThreeCamera) return null;

            return renderer.getThreeCamera();
          }

          private _createSkyMesh(): void {
            if (this._skyMesh) return;

            const uniforms = {
              turbidity: { value: this._turbidity },
              rayleigh: { value: this._rayleigh },
              mieCoefficient: { value: this._mieCoefficient },
              mieDirectionalG: { value: this._mieDirectionalG },
              sunPosition: { value: new THREE.Vector3(0, 0, 1) },
              up: { value: new THREE.Vector3(0, 0, 1) },
              exposure: { value: this._exposure },
              sunIntensity: { value: this._sunIntensity },
              skyTintColor: { value: new THREE.Color(this._skyTintColorHex) },
              sunColor: { value: new THREE.Color(this._sunColorHex) },
              cloudCoverage: { value: this._cloudCoverage },
              cloudOpacity: { value: this._cloudOpacity },
              cloudScale: { value: this._cloudScale },
              cloudSoftness: { value: this._cloudSoftness },
              cloudTime: { value: 0 },
              cloudColor: { value: new THREE.Color(this._cloudColorHex) },
            };

            const skyMaterial = new THREE.ShaderMaterial({
              uniforms,
              vertexShader: `
                uniform vec3 sunPosition;
                uniform float rayleigh;
                uniform float turbidity;
                uniform float mieCoefficient;
                uniform vec3 up;

                varying vec3 vWorldPosition;
                varying vec3 vSunDirection;
                varying float vSunfade;
                varying vec3 vBetaR;
                varying vec3 vBetaM;
                varying float vSunE;

                const float e = 2.71828182845904523536;
                const float pi = 3.14159265358979323846;
                const vec3 totalRayleigh = vec3(
                  5.804542996261093E-6,
                  1.3562911419845635E-5,
                  3.0265902468824876E-5
                );
                const vec3 MieConst = vec3(
                  1.8399918514433978E14,
                  2.7798023919660528E14,
                  4.0790479543861094E14
                );
                const float cutoffAngle = 1.6110731556870734;
                const float steepness = 1.5;
                const float EE = 1000.0;

                float sunIntensity(float zenithAngleCos) {
                  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
                  return EE * max(
                    0.0,
                    1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness))
                  );
                }

                vec3 totalMie(float T) {
                  float c = (0.2 * T) * 10E-18;
                  return 0.434 * c * MieConst;
                }

                void main() {
                  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                  vWorldPosition = worldPosition.xyz;

                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                  gl_Position.z = gl_Position.w;

                  vSunDirection = normalize(sunPosition);
                  vSunE = sunIntensity(dot(vSunDirection, up));

                  float sunUp = dot(sunPosition, up) / 450000.0;
                  vSunfade = 1.0 - clamp(1.0 - exp(sunUp), 0.0, 1.0);

                  float rayleighCoefficient = max(0.0, rayleigh - (1.0 * (1.0 - vSunfade)));
                  vBetaR = totalRayleigh * rayleighCoefficient;
                  vBetaM = totalMie(turbidity) * max(0.0, mieCoefficient);
                }
              `,
              fragmentShader: `
                varying vec3 vWorldPosition;
                varying vec3 vSunDirection;
                varying float vSunfade;
                varying vec3 vBetaR;
                varying vec3 vBetaM;
                varying float vSunE;

                uniform float mieDirectionalG;
                uniform vec3 up;
                uniform float exposure;
                uniform float sunIntensity;
                uniform vec3 skyTintColor;
                uniform vec3 sunColor;
                uniform float cloudCoverage;
                uniform float cloudOpacity;
                uniform float cloudScale;
                uniform float cloudSoftness;
                uniform float cloudTime;
                uniform vec3 cloudColor;

                const float pi = 3.14159265358979323846;
                const float rayleighZenithLength = 8.4E3;
                const float mieZenithLength = 1.25E3;
                const float sunAngularDiameterCos = 0.9999566769464484;
                const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
                const float ONE_OVER_FOURPI = 0.07957747154594767;

                float rayleighPhase(float cosTheta) {
                  return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
                }

                float hgPhase(float cosTheta, float g) {
                  float g2 = pow(g, 2.0);
                  float inverse = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
                  return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
                }

                float hash(vec2 p) {
                  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                float noise(vec2 p) {
                  vec2 i = floor(p);
                  vec2 f = fract(p);
                  vec2 u = f * f * (3.0 - 2.0 * f);

                  float a = hash(i + vec2(0.0, 0.0));
                  float b = hash(i + vec2(1.0, 0.0));
                  float c = hash(i + vec2(0.0, 1.0));
                  float d = hash(i + vec2(1.0, 1.0));

                  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
                }

                float fbm(vec2 p) {
                  float sum = 0.0;
                  float amp = 0.5;
                  for (int i = 0; i < 5; i++) {
                    sum += amp * noise(p);
                    p = p * 2.02 + vec2(11.5, 17.3);
                    amp *= 0.5;
                  }
                  return sum;
                }

                vec3 ACESFilm(vec3 x) {
                  float a = 2.51;
                  float b = 0.03;
                  float c = 2.43;
                  float d = 0.59;
                  float e = 0.14;
                  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
                }

                void main() {
                  vec3 direction = normalize(vWorldPosition - cameraPosition);

                  float zenithAngle = acos(max(0.0, dot(up, direction)));
                  float inverse = 1.0 / (
                    cos(zenithAngle) +
                    0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253)
                  );
                  float sR = rayleighZenithLength * inverse;
                  float sM = mieZenithLength * inverse;

                  vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));

                  float cosTheta = dot(direction, vSunDirection);
                  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
                  vec3 betaRTheta = vBetaR * rPhase;

                  float mPhase = hgPhase(cosTheta, mieDirectionalG);
                  vec3 betaMTheta = vBetaM * mPhase;

                  vec3 scattering =
                    (betaRTheta + betaMTheta) /
                    max(vBetaR + vBetaM, vec3(0.0001));

                  vec3 Lin = pow(vSunE * scattering * (1.0 - Fex), vec3(1.5));
                  Lin *= mix(
                    vec3(1.0),
                    pow(vSunE * scattering * Fex, vec3(0.5)),
                    clamp(pow(1.0 - dot(up, vSunDirection), 5.0), 0.0, 1.0)
                  );

                  vec3 skyBase = Lin * 0.04 + vec3(0.00002, 0.00028, 0.00055);
                  skyBase *= skyTintColor;

                  vec3 nightBase = vec3(0.1) * Fex;
                  float sundisk = smoothstep(
                    sunAngularDiameterCos,
                    sunAngularDiameterCos + 0.00002,
                    cosTheta
                  );
                  vec3 sunDiskColor =
                    sunColor *
                    ((vSunE * 18000.0 * Fex) * sundisk * max(0.0, 0.35 + sunIntensity));

                  vec3 texColor = skyBase + nightBase + sunDiskColor;

                  vec2 cloudUv = direction.xz / max(direction.y + 0.22, 0.04);
                  cloudUv *= max(0.1, cloudScale);
                  cloudUv += vec2(cloudTime * 0.045, 0.0);

                  float noisePrimary = fbm(cloudUv * 0.65);
                  float noiseDetail = fbm(cloudUv * 1.9 + vec2(17.0, 5.0));
                  float cloudNoise = mix(noisePrimary, noiseDetail, 0.35);

                  float threshold = mix(0.92, 0.34, clamp(cloudCoverage, 0.0, 1.0));
                  float softness = max(0.02, cloudSoftness * 0.25 + 0.02);
                  float cloudMask = smoothstep(
                    threshold - softness,
                    threshold + softness,
                    cloudNoise
                  );

                  float cloudSkyVisibility = smoothstep(-0.08, 0.35, direction.y);
                  float cloudBlend = clamp(
                    cloudMask * cloudOpacity * cloudSkyVisibility,
                    0.0,
                    1.0
                  );

                  float sunScatter = pow(max(dot(direction, vSunDirection), 0.0), 18.0);
                  vec3 cloudBaseColor =
                    cloudColor *
                    (0.78 + 0.22 * clamp(direction.y * 0.8 + 0.2, 0.0, 1.0));
                  vec3 cloudLitColor =
                    cloudBaseColor +
                    sunColor * (0.18 * sunScatter * (0.4 + sunIntensity));

                  texColor = mix(texColor, cloudLitColor, cloudBlend);

                  vec3 mapped = ACESFilm(texColor * max(0.0, exposure));
                  vec3 retColor = pow(mapped, vec3(1.0 / 2.2));
                  gl_FragColor = vec4(retColor, 1.0);
                }
              `,
              side: THREE.BackSide,
              depthWrite: false,
              depthTest: true,
              toneMapped: false,
              fog: false,
            });

            this._skyMesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 32, 16),
              skyMaterial
            );
            this._skyMesh.frustumCulled = false;
            this._skyMesh.renderOrder = -1000000;
            this._updateUniforms();
          }

          private _updateUniforms(): void {
            if (!this._skyMesh) return;

            const material = this._skyMesh.material as THREE.ShaderMaterial;
            material.uniforms.turbidity.value = this._turbidity;
            material.uniforms.rayleigh.value = this._rayleigh;
            material.uniforms.mieCoefficient.value = this._mieCoefficient;
            material.uniforms.mieDirectionalG.value = this._mieDirectionalG;
            material.uniforms.exposure.value = this._exposure;
            material.uniforms.sunIntensity.value = this._sunIntensity;
            material.uniforms.skyTintColor.value.setHex(this._skyTintColorHex);
            material.uniforms.sunColor.value.setHex(this._sunColorHex);

            material.uniforms.cloudCoverage.value = this._cloudCoverage;
            material.uniforms.cloudOpacity.value = this._cloudOpacity;
            material.uniforms.cloudScale.value = this._cloudScale;
            material.uniforms.cloudSoftness.value = this._cloudSoftness;
            material.uniforms.cloudTime.value = this._cloudTime;
            material.uniforms.cloudColor.value.setHex(this._cloudColorHex);

            const phi = THREE.MathUtils.degToRad(90 - this._sunElevation);
            const theta = THREE.MathUtils.degToRad(this._sunAzimuth);
            const x = Math.cos(theta) * Math.sin(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(phi);
            material.uniforms.sunPosition.value
              .set(x, y, z)
              .multiplyScalar(450000);
          }

          private _disposeSkyMesh(): void {
            if (!this._skyMesh) return;

            this._skyMesh.removeFromParent();
            this._skyMesh.geometry.dispose();

            const material = this._skyMesh.material;
            if (Array.isArray(material)) {
              material.forEach(singleMaterial => singleMaterial.dispose());
            } else {
              material.dispose();
            }

            this._skyMesh = null;
          }

          isEnabled(target: EffectsTarget): boolean {
            return this._isEnabled;
          }

          setEnabled(target: EffectsTarget, enabled: boolean): boolean {
            if (this._isEnabled === enabled) {
              return true;
            }
            if (enabled) {
              return this.applyEffect(target);
            } else {
              return this.removeEffect(target);
            }
          }

          applyEffect(target: EffectsTarget): boolean {
            const scene = this._getScene(target);
            if (!scene) {
              return false;
            }

            this._createSkyMesh();
            if (!this._skyMesh) {
              return false;
            }

            this._oldBackground = scene.background;
            scene.background = null;
            scene.add(this._skyMesh);

            this._isEnabled = true;
            this.updatePreRender(target);
            return true;
          }

          removeEffect(target: EffectsTarget): boolean {
            const scene = this._getScene(target);
            if (!scene) {
              return false;
            }

            scene.background = this._oldBackground;
            this._disposeSkyMesh();
            this._isEnabled = false;
            return true;
          }

          updatePreRender(target: EffectsTarget): void {
            if (!this._isEnabled || !this._skyMesh) {
              return;
            }

            this._cloudTime += (target.getElapsedTime() / 1000) * this._cloudSpeed;
            this._updateUniforms();

            const camera = this._getThreeCamera(target) as
              | (THREE.Camera & {
                  far?: number;
                  position?: THREE.Vector3;
                })
              | null;
            if (!camera || !camera.position) {
              return;
            }

            this._skyMesh.position.copy(camera.position);
            const farDistance = Math.max(100, (camera.far || 2000) * 0.95);
            this._skyMesh.scale.setScalar(farDistance);
          }

          updateDoubleParameter(parameterName: string, value: number): void {
            if (parameterName === 'turbidity') {
              this._turbidity = clamp(value, 0, 20);
            } else if (parameterName === 'rayleigh') {
              this._rayleigh = clamp(value, 0, 6);
            } else if (parameterName === 'mieCoefficient') {
              this._mieCoefficient = clamp(value, 0, 0.1);
            } else if (parameterName === 'mieDirectionalG') {
              this._mieDirectionalG = clamp(value, 0, 0.999);
            } else if (parameterName === 'sunIntensity') {
              this._sunIntensity = Math.max(0, value);
            } else if (parameterName === 'sunElevation') {
              this._sunElevation = clamp(value, -10, 90);
            } else if (parameterName === 'sunAzimuth') {
              this._sunAzimuth = value;
            } else if (parameterName === 'exposure') {
              this._exposure = clamp(value, 0, 2);
            } else if (parameterName === 'cloudCoverage') {
              this._cloudCoverage = clamp(value, 0, 1);
            } else if (parameterName === 'cloudOpacity') {
              this._cloudOpacity = clamp(value, 0, 1);
            } else if (parameterName === 'cloudScale') {
              this._cloudScale = clamp(value, 0.1, 8);
            } else if (parameterName === 'cloudSoftness') {
              this._cloudSoftness = clamp(value, 0, 1);
            } else if (parameterName === 'cloudSpeed') {
              this._cloudSpeed = clamp(value, 0, 10);
            }
            this._updateUniforms();
          }

          getDoubleParameter(parameterName: string): number {
            if (parameterName === 'turbidity') return this._turbidity;
            if (parameterName === 'rayleigh') return this._rayleigh;
            if (parameterName === 'mieCoefficient') return this._mieCoefficient;
            if (parameterName === 'mieDirectionalG') return this._mieDirectionalG;
            if (parameterName === 'sunIntensity') return this._sunIntensity;
            if (parameterName === 'sunElevation') return this._sunElevation;
            if (parameterName === 'sunAzimuth') return this._sunAzimuth;
            if (parameterName === 'exposure') return this._exposure;
            if (parameterName === 'cloudCoverage') return this._cloudCoverage;
            if (parameterName === 'cloudOpacity') return this._cloudOpacity;
            if (parameterName === 'cloudScale') return this._cloudScale;
            if (parameterName === 'cloudSoftness') return this._cloudSoftness;
            if (parameterName === 'cloudSpeed') return this._cloudSpeed;
            return 0;
          }

          updateStringParameter(parameterName: string, value: string): void {
            if (parameterName === 'skyTintColor') {
              this._skyTintColorHex = gdjs.rgbOrHexStringToNumber(value);
            } else if (parameterName === 'sunColor') {
              this._sunColorHex = gdjs.rgbOrHexStringToNumber(value);
            } else if (parameterName === 'cloudColor') {
              this._cloudColorHex = gdjs.rgbOrHexStringToNumber(value);
            } else if (
              parameterName === 'topColor' ||
              parameterName === 'horizonColor' ||
              parameterName === 'bottomColor'
            ) {
              // Legacy aliases for compatibility with previous Sky effect versions.
              this._skyTintColorHex = gdjs.rgbOrHexStringToNumber(value);
            }
            this._updateUniforms();
          }

          updateColorParameter(parameterName: string, value: number): void {
            if (parameterName === 'skyTintColor') {
              this._skyTintColorHex = value;
            } else if (parameterName === 'sunColor') {
              this._sunColorHex = value;
            } else if (parameterName === 'cloudColor') {
              this._cloudColorHex = value;
            } else if (
              parameterName === 'topColor' ||
              parameterName === 'horizonColor' ||
              parameterName === 'bottomColor'
            ) {
              // Legacy aliases for compatibility with previous Sky effect versions.
              this._skyTintColorHex = value;
            }
            this._updateUniforms();
          }

          getColorParameter(parameterName: string): number {
            if (
              parameterName === 'skyTintColor' ||
              parameterName === 'topColor' ||
              parameterName === 'horizonColor' ||
              parameterName === 'bottomColor'
            ) {
              return this._skyTintColorHex;
            }
            if (parameterName === 'sunColor') return this._sunColorHex;
            if (parameterName === 'cloudColor') return this._cloudColorHex;
            return 0;
          }

          updateBooleanParameter(parameterName: string, value: boolean): void {}

          getNetworkSyncData(): SkyFilterNetworkSyncData {
            return {
              tb: this._turbidity,
              ry: this._rayleigh,
              mc: this._mieCoefficient,
              mg: this._mieDirectionalG,
              si: this._sunIntensity,
              se: this._sunElevation,
              sa: this._sunAzimuth,
              ex: this._exposure,
              st: this._skyTintColorHex,
              sc: this._sunColorHex,
              cv: this._cloudCoverage,
              co: this._cloudOpacity,
              ck: this._cloudScale,
              cs: this._cloudSoftness,
              cp: this._cloudSpeed,
              cc: this._cloudColorHex,
            };
          }

          updateFromNetworkSyncData(syncData: SkyFilterNetworkSyncData): void {
            this._turbidity = clamp(syncData.tb, 0, 20);
            this._rayleigh = clamp(syncData.ry, 0, 6);
            this._mieCoefficient = clamp(syncData.mc, 0, 0.1);
            this._mieDirectionalG = clamp(syncData.mg, 0, 0.999);
            this._sunIntensity = Math.max(0, syncData.si);
            this._sunElevation = clamp(syncData.se, -10, 90);
            this._sunAzimuth = syncData.sa;
            this._exposure = clamp(syncData.ex, 0, 2);
            this._skyTintColorHex = syncData.st;
            this._sunColorHex = syncData.sc;

            if (syncData.cv !== undefined) {
              this._cloudCoverage = clamp(syncData.cv, 0, 1);
            }
            if (syncData.co !== undefined) {
              this._cloudOpacity = clamp(syncData.co, 0, 1);
            }
            if (syncData.ck !== undefined) {
              this._cloudScale = clamp(syncData.ck, 0.1, 8);
            }
            if (syncData.cs !== undefined) {
              this._cloudSoftness = clamp(syncData.cs, 0, 1);
            }
            if (syncData.cp !== undefined) {
              this._cloudSpeed = clamp(syncData.cp, 0, 10);
            }
            if (syncData.cc !== undefined) {
              this._cloudColorHex = syncData.cc;
            }

            this._updateUniforms();
          }
        })();
      }
    })()
  );
}
