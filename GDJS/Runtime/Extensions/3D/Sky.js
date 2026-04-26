var gdjs;(function(s){const t=(r,o,e)=>Math.min(e,Math.max(o,r));s.PixiFiltersTools.registerFilterCreator("Scene3D::Sky",new class{makeFilter(r,o){return typeof THREE=="undefined"?new s.PixiFiltersTools.EmptyFilter:new class{constructor(){this._isEnabled=!1;this._skyMesh=null;this._oldBackground=null;this._turbidity=4.2;this._rayleigh=1.35;this._mieCoefficient=.009;this._mieDirectionalG=.92;this._sunIntensity=1.35;this._sunElevation=70;this._sunAzimuth=82;this._exposure=.68;this._skyTintColorHex=16776954;this._sunColorHex=16775915;this._cloudCoverage=.44;this._cloudOpacity=.46;this._cloudScale=1.35;this._cloudSoftness=.2;this._cloudSpeed=0;this._cloudColorHex=16054010;this._cloudTime=0;this._turbidity=t(o.doubleParameters.turbidity!==void 0?o.doubleParameters.turbidity:this._turbidity,0,20),this._rayleigh=t(o.doubleParameters.rayleigh!==void 0?o.doubleParameters.rayleigh:this._rayleigh,0,6),this._mieCoefficient=t(o.doubleParameters.mieCoefficient!==void 0?o.doubleParameters.mieCoefficient:this._mieCoefficient,0,.1),this._mieDirectionalG=t(o.doubleParameters.mieDirectionalG!==void 0?o.doubleParameters.mieDirectionalG:this._mieDirectionalG,0,.999),this._sunIntensity=Math.max(0,o.doubleParameters.sunIntensity!==void 0?o.doubleParameters.sunIntensity:this._sunIntensity),this._sunElevation=t(o.doubleParameters.sunElevation!==void 0?o.doubleParameters.sunElevation:this._sunElevation,-10,90),this._sunAzimuth=o.doubleParameters.sunAzimuth!==void 0?o.doubleParameters.sunAzimuth:this._sunAzimuth,this._exposure=t(o.doubleParameters.exposure!==void 0?o.doubleParameters.exposure:this._exposure,0,2),this._cloudCoverage=t(o.doubleParameters.cloudCoverage!==void 0?o.doubleParameters.cloudCoverage:this._cloudCoverage,0,1),this._cloudOpacity=t(o.doubleParameters.cloudOpacity!==void 0?o.doubleParameters.cloudOpacity:this._cloudOpacity,0,1),this._cloudScale=t(o.doubleParameters.cloudScale!==void 0?o.doubleParameters.cloudScale:this._cloudScale,.1,8),this._cloudSoftness=t(o.doubleParameters.cloudSoftness!==void 0?o.doubleParameters.cloudSoftness:this._cloudSoftness,0,1),this._cloudSpeed=t(o.doubleParameters.cloudSpeed!==void 0?o.doubleParameters.cloudSpeed:this._cloudSpeed,0,10),this._skyTintColorHex=s.rgbOrHexStringToNumber(o.stringParameters.skyTintColor||o.stringParameters.topColor||o.stringParameters.horizonColor||o.stringParameters.bottomColor||"255;254;250"),this._sunColorHex=s.rgbOrHexStringToNumber(o.stringParameters.sunColor||"255;250;235"),this._cloudColorHex=s.rgbOrHexStringToNumber(o.stringParameters.cloudColor||"244;246;250")}_getScene(e){return e.get3DRendererObject()||null}_getThreeCamera(e){if(!e.getRuntimeLayer)return null;const i=e.getRuntimeLayer();if(!i)return null;const n=i.getRenderer();return!n||!n.getThreeCamera?null:n.getThreeCamera()}_createSkyMesh(){if(this._skyMesh)return;const e={turbidity:{value:this._turbidity},rayleigh:{value:this._rayleigh},mieCoefficient:{value:this._mieCoefficient},mieDirectionalG:{value:this._mieDirectionalG},sunPosition:{value:new THREE.Vector3(0,0,1)},up:{value:new THREE.Vector3(0,0,1)},exposure:{value:this._exposure},sunIntensity:{value:this._sunIntensity},skyTintColor:{value:new THREE.Color(this._skyTintColorHex)},sunColor:{value:new THREE.Color(this._sunColorHex)},cloudCoverage:{value:this._cloudCoverage},cloudOpacity:{value:this._cloudOpacity},cloudScale:{value:this._cloudScale},cloudSoftness:{value:this._cloudSoftness},cloudTime:{value:0},cloudColor:{value:new THREE.Color(this._cloudColorHex)}},i=new THREE.ShaderMaterial({uniforms:e,vertexShader:`
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
              `,fragmentShader:`
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

                  vec2 cloudUv = direction.xy / max(direction.z + 0.22, 0.04);
                  cloudUv *= max(0.1, cloudScale);
                  cloudUv += vec2(cloudTime * 0.045, cloudTime * 0.006);

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

                  float cloudSkyVisibility = smoothstep(-0.08, 0.35, direction.z);
                  float cloudBlend = clamp(
                    cloudMask * cloudOpacity * cloudSkyVisibility,
                    0.0,
                    1.0
                  );

                  float sunScatter = pow(max(dot(direction, vSunDirection), 0.0), 18.0);
                  vec3 cloudBaseColor =
                    cloudColor *
                    (0.78 + 0.22 * clamp(direction.z * 0.8 + 0.2, 0.0, 1.0));
                  vec3 cloudLitColor =
                    cloudBaseColor +
                    sunColor * (0.18 * sunScatter * (0.4 + sunIntensity));

                  texColor = mix(texColor, cloudLitColor, cloudBlend);

                  vec3 mapped = ACESFilm(texColor * max(0.0, exposure));
                  vec3 retColor = pow(mapped, vec3(1.0 / 2.2));
                  gl_FragColor = vec4(retColor, 1.0);
                }
              `,side:THREE.BackSide,depthWrite:!1,depthTest:!0,toneMapped:!1,fog:!1});this._skyMesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),i),this._skyMesh.frustumCulled=!1,this._skyMesh.renderOrder=-1e6,this._updateUniforms()}_updateUniforms(){if(!this._skyMesh)return;const e=this._skyMesh.material;e.uniforms.turbidity.value=this._turbidity,e.uniforms.rayleigh.value=this._rayleigh,e.uniforms.mieCoefficient.value=this._mieCoefficient,e.uniforms.mieDirectionalG.value=this._mieDirectionalG,e.uniforms.exposure.value=this._exposure,e.uniforms.sunIntensity.value=this._sunIntensity,e.uniforms.skyTintColor.value.setHex(this._skyTintColorHex),e.uniforms.sunColor.value.setHex(this._sunColorHex),e.uniforms.cloudCoverage.value=this._cloudCoverage,e.uniforms.cloudOpacity.value=this._cloudOpacity,e.uniforms.cloudScale.value=this._cloudScale,e.uniforms.cloudSoftness.value=this._cloudSoftness,e.uniforms.cloudTime.value=this._cloudTime,e.uniforms.cloudColor.value.setHex(this._cloudColorHex);const i=THREE.MathUtils.degToRad(90-this._sunElevation),n=THREE.MathUtils.degToRad(this._sunAzimuth),l=Math.cos(n)*Math.sin(i),u=Math.sin(n)*Math.sin(i),c=Math.cos(i);e.uniforms.sunPosition.value.set(l,u,c).multiplyScalar(45e4)}_disposeSkyMesh(){if(!this._skyMesh)return;this._skyMesh.removeFromParent(),this._skyMesh.geometry.dispose();const e=this._skyMesh.material;Array.isArray(e)?e.forEach(i=>i.dispose()):e.dispose(),this._skyMesh=null}isEnabled(e){return this._isEnabled}setEnabled(e,i){return this._isEnabled===i?!0:i?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){const i=this._getScene(e);return!i||(this._createSkyMesh(),!this._skyMesh)?!1:(this._oldBackground=i.background,i.background=null,i.add(this._skyMesh),this._isEnabled=!0,this.updatePreRender(e),!0)}removeEffect(e){const i=this._getScene(e);return i?(i.background=this._oldBackground,this._disposeSkyMesh(),this._isEnabled=!1,!0):!1}updatePreRender(e){if(!this._isEnabled||!this._skyMesh)return;this._cloudTime+=e.getElapsedTime()/1e3*this._cloudSpeed,this._updateUniforms();const i=this._getThreeCamera(e);if(!i||!i.position)return;this._skyMesh.position.copy(i.position);const n=Math.max(100,(i.far||2e3)*.95);this._skyMesh.scale.setScalar(n)}updateDoubleParameter(e,i){e==="turbidity"?this._turbidity=t(i,0,20):e==="rayleigh"?this._rayleigh=t(i,0,6):e==="mieCoefficient"?this._mieCoefficient=t(i,0,.1):e==="mieDirectionalG"?this._mieDirectionalG=t(i,0,.999):e==="sunIntensity"?this._sunIntensity=Math.max(0,i):e==="sunElevation"?this._sunElevation=t(i,-10,90):e==="sunAzimuth"?this._sunAzimuth=i:e==="exposure"?this._exposure=t(i,0,2):e==="cloudCoverage"?this._cloudCoverage=t(i,0,1):e==="cloudOpacity"?this._cloudOpacity=t(i,0,1):e==="cloudScale"?this._cloudScale=t(i,.1,8):e==="cloudSoftness"?this._cloudSoftness=t(i,0,1):e==="cloudSpeed"&&(this._cloudSpeed=t(i,0,10)),this._updateUniforms()}getDoubleParameter(e){return e==="turbidity"?this._turbidity:e==="rayleigh"?this._rayleigh:e==="mieCoefficient"?this._mieCoefficient:e==="mieDirectionalG"?this._mieDirectionalG:e==="sunIntensity"?this._sunIntensity:e==="sunElevation"?this._sunElevation:e==="sunAzimuth"?this._sunAzimuth:e==="exposure"?this._exposure:e==="cloudCoverage"?this._cloudCoverage:e==="cloudOpacity"?this._cloudOpacity:e==="cloudScale"?this._cloudScale:e==="cloudSoftness"?this._cloudSoftness:e==="cloudSpeed"?this._cloudSpeed:0}updateStringParameter(e,i){e==="skyTintColor"?this._skyTintColorHex=s.rgbOrHexStringToNumber(i):e==="sunColor"?this._sunColorHex=s.rgbOrHexStringToNumber(i):e==="cloudColor"?this._cloudColorHex=s.rgbOrHexStringToNumber(i):(e==="topColor"||e==="horizonColor"||e==="bottomColor")&&(this._skyTintColorHex=s.rgbOrHexStringToNumber(i)),this._updateUniforms()}updateColorParameter(e,i){e==="skyTintColor"?this._skyTintColorHex=i:e==="sunColor"?this._sunColorHex=i:e==="cloudColor"?this._cloudColorHex=i:(e==="topColor"||e==="horizonColor"||e==="bottomColor")&&(this._skyTintColorHex=i),this._updateUniforms()}getColorParameter(e){return e==="skyTintColor"||e==="topColor"||e==="horizonColor"||e==="bottomColor"?this._skyTintColorHex:e==="sunColor"?this._sunColorHex:e==="cloudColor"?this._cloudColorHex:0}updateBooleanParameter(e,i){}getNetworkSyncData(){return{tb:this._turbidity,ry:this._rayleigh,mc:this._mieCoefficient,mg:this._mieDirectionalG,si:this._sunIntensity,se:this._sunElevation,sa:this._sunAzimuth,ex:this._exposure,st:this._skyTintColorHex,sc:this._sunColorHex,cv:this._cloudCoverage,co:this._cloudOpacity,ck:this._cloudScale,cs:this._cloudSoftness,cp:this._cloudSpeed,cc:this._cloudColorHex}}updateFromNetworkSyncData(e){this._turbidity=t(e.tb,0,20),this._rayleigh=t(e.ry,0,6),this._mieCoefficient=t(e.mc,0,.1),this._mieDirectionalG=t(e.mg,0,.999),this._sunIntensity=Math.max(0,e.si),this._sunElevation=t(e.se,-10,90),this._sunAzimuth=e.sa,this._exposure=t(e.ex,0,2),this._skyTintColorHex=e.st,this._sunColorHex=e.sc,e.cv!==void 0&&(this._cloudCoverage=t(e.cv,0,1)),e.co!==void 0&&(this._cloudOpacity=t(e.co,0,1)),e.ck!==void 0&&(this._cloudScale=t(e.ck,.1,8)),e.cs!==void 0&&(this._cloudSoftness=t(e.cs,0,1)),e.cp!==void 0&&(this._cloudSpeed=t(e.cp,0,10)),e.cc!==void 0&&(this._cloudColorHex=e.cc),this._updateUniforms()}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=Sky.js.map
