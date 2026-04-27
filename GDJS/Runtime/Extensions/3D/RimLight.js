var gdjs;(function(n){const h="Scene3D_RimLight_Patch_v4",m="SCENE3D_RIM_LIGHT_PATCH",l=15;n.PixiFiltersTools.registerFilterCreator("Scene3D::RimLight",new class{makeFilter(d,a){return typeof THREE=="undefined"?new n.PixiFiltersTools.EmptyFilter:new class{constructor(){this._isEnabled=!1,this._effectEnabled=a.booleanParameters.enabled===void 0?!0:!!a.booleanParameters.enabled,this._intensity=Math.max(0,a.doubleParameters.intensity!==void 0?a.doubleParameters.intensity:.8),this._outerWrap=Math.max(0,Math.min(1,a.doubleParameters.outerWrap!==void 0?a.doubleParameters.outerWrap:.18)),this._power=Math.max(.05,a.doubleParameters.power!==void 0?a.doubleParameters.power:2.2),this._fresnel0=Math.max(0,Math.min(1,a.doubleParameters.fresnel0!==void 0?a.doubleParameters.fresnel0:.04)),this._shadowStrength=1,this._colorHex=n.rgbOrHexStringToNumber(a.stringParameters.color||"255;255;255"),this._debugForceMaxRim=a.booleanParameters.debugForceMaxRim===void 0?!1:!!a.booleanParameters.debugForceMaxRim,this._patchedMaterials=new Map,this._cameraPosition=new THREE.Vector3,this._cameraMatrixWorld=new THREE.Matrix4,this._materialScanCounter=l,this._warnedNoMaterials=!1,this._warnedNoShaderInjection=!1}_isMaterialPatchable(e){if(!e)return!1;const r=e;return r.isShaderMaterial?!1:!!(r.isMeshBasicMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial||r.isMeshStandardMaterial||r.isMeshPhysicalMaterial||r.isMeshToonMaterial||r.isMeshMatcapMaterial)}_injectShader(e){return e.fragmentShader.indexOf(m)!==-1?!0:e.vertexShader.indexOf("#include <common>")===-1||e.vertexShader.indexOf("#include <defaultnormal_vertex>")===-1||e.vertexShader.indexOf("#include <project_vertex>")===-1||e.fragmentShader.indexOf("#include <common>")===-1||e.fragmentShader.indexOf("#include <output_fragment>")===-1?!1:(e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
uniform mat4 rimCameraMatrixWorld;
varying vec3 vScene3DRimWorldPosition;
varying vec3 vScene3DRimWorldNormal;`),e.vertexShader=e.vertexShader.replace("#include <defaultnormal_vertex>",`#include <defaultnormal_vertex>
vScene3DRimWorldNormal = normalize(mat3(rimCameraMatrixWorld) * transformedNormal);`),e.vertexShader=e.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
vScene3DRimWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 rimColor;
uniform float rimIntensity;
uniform float rimOuterWrap;
uniform float rimPower;
uniform float rimFresnel0;
uniform vec3 rimCameraPosition;
uniform float rimDebugForceMax;
varying vec3 vScene3DRimWorldPosition;
varying vec3 vScene3DRimWorldNormal;

float scene3dPow5(float x) {
  float x2 = x * x;
  return x2 * x2 * x;
}

float scene3dSchlickFresnel(float ndv, float f0) {
  float clampedNdv = clamp(ndv, 0.0, 1.0);
  return f0 + (1.0 - f0) * scene3dPow5(1.0 - clampedNdv);
}

float scene3dComputeRimStrength(
  vec3 worldNormal,
  vec3 viewDirWorld,
  float outerWrap,
  float rimPower,
  float fresnel0
) {
  vec3 resolvedNormal = normalize(worldNormal);
  #ifdef DOUBLE_SIDED
    resolvedNormal = gl_FrontFacing ? resolvedNormal : -resolvedNormal;
  #endif

  float ndv = clamp(dot(resolvedNormal, normalize(viewDirWorld)), 0.0, 1.0);
  float oneMinusNdv = 1.0 - ndv;

  // Artistic shaping term used in most realtime rim-light implementations.
  float rimCore = pow(max(oneMinusNdv, 0.0), max(rimPower, 0.05));

  // "Outer wrap" broadens the highlighted zone away from the strict silhouette.
  float wrapped = clamp(oneMinusNdv + clamp(outerWrap, 0.0, 1.0) * 0.5, 0.0, 1.0);
  float rimEnvelope = smoothstep(0.0, 1.0, wrapped);

  // Physically-inspired angular response (Schlick Fresnel).
  float fresnel = scene3dSchlickFresnel(ndv, clamp(fresnel0, 0.0, 1.0));

  return clamp(rimCore * rimEnvelope * fresnel, 0.0, 1.0);
}`),e.fragmentShader=e.fragmentShader.replace("#include <output_fragment>",`float scene3dRimStrength = 0.0;
if (rimDebugForceMax > 0.5) {
  // Debug mode: force full-rim contribution everywhere to verify shader reach.
  scene3dRimStrength = 1.0;
} else if (rimIntensity > 0.0) {
  vec3 scene3dViewDir = normalize(rimCameraPosition - vScene3DRimWorldPosition);
  scene3dRimStrength = scene3dComputeRimStrength(
    vScene3DRimWorldNormal,
    scene3dViewDir,
    rimOuterWrap,
    rimPower,
    rimFresnel0
  );
}
outgoingLight += rimColor * (rimIntensity * scene3dRimStrength);
// ${m}
#include <output_fragment>`),!0)}_updateUniformState(e){const r=e.uniforms;!r||(r.rimColor.value.setHex(this._colorHex),r.rimIntensity.value=this._effectEnabled?this._debugForceMaxRim?1:this._intensity*Math.max(0,Math.min(1,this._shadowStrength)):0,r.rimOuterWrap.value=this._outerWrap,r.rimPower.value=this._power,r.rimFresnel0.value=this._fresnel0,r.rimCameraPosition.value.copy(this._cameraPosition),r.rimCameraMatrixWorld.value.copy(this._cameraMatrixWorld),r.rimDebugForceMax.value=this._debugForceMaxRim?1:0)}_patchMaterial(e){if(this._patchedMaterials.has(e)||!this._isMaterialPatchable(e))return;const r=e.onBeforeCompile?e.onBeforeCompile:()=>{},o=e.customProgramCacheKey,t={originalOnBeforeCompile:r,originalCustomProgramCacheKey:o,uniforms:null,shaderInjected:!1};e.onBeforeCompile=(i,s)=>{t.originalOnBeforeCompile.call(e,i,s),!!this._injectShader(i)&&(i.uniforms.rimColor={value:new THREE.Color(this._colorHex)},i.uniforms.rimIntensity={value:0},i.uniforms.rimOuterWrap={value:this._outerWrap},i.uniforms.rimPower={value:this._power},i.uniforms.rimFresnel0={value:this._fresnel0},i.uniforms.rimCameraPosition={value:new THREE.Vector3},i.uniforms.rimCameraMatrixWorld={value:new THREE.Matrix4},i.uniforms.rimDebugForceMax={value:this._debugForceMaxRim?1:0},t.uniforms=i.uniforms,t.shaderInjected=!0,this._updateUniformState(t))},e.customProgramCacheKey=()=>`${t.originalCustomProgramCacheKey?t.originalCustomProgramCacheKey.call(e):""}|${h}`,e.needsUpdate=!0,this._patchedMaterials.set(e,t)}_unpatchMaterial(e){const r=this._patchedMaterials.get(e);!r||(e.onBeforeCompile=r.originalOnBeforeCompile,r.originalCustomProgramCacheKey?e.customProgramCacheKey=r.originalCustomProgramCacheKey:e.customProgramCacheKey=()=>"",e.needsUpdate=!0,this._patchedMaterials.delete(e))}_unpatchAllMaterials(){for(const e of Array.from(this._patchedMaterials.keys()))this._unpatchMaterial(e);this._patchedMaterials.clear()}_applyToSceneMaterials(e){let r=0;e.traverse(o=>{const t=o;if(!t||!t.isMesh||!t.material)return;const i=Array.isArray(t.material)?t.material:[t.material];for(const s of i)!s||(r++,this._patchMaterial(s))}),r===0&&!this._warnedNoMaterials&&(this._warnedNoMaterials=!0,console.warn("[Scene3D::RimLight] No mesh materials found on the target scene layer. Rim light was not applied."))}_updatePatchedMaterialsUniforms(){let e=0;for(const r of this._patchedMaterials.values())r.shaderInjected&&e++,this._updateUniformState(r);this._patchedMaterials.size>0&&e===0&&!this._warnedNoShaderInjection&&(this._warnedNoShaderInjection=!0,console.warn("[Scene3D::RimLight] Materials were found, but shader injection has not compiled yet. Enable debugForceMaxRim to validate when compilation occurs."))}isEnabled(e){return this._isEnabled}setEnabled(e,r){return this._isEnabled===r?!0:r?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){const r=e.get3DRendererObject();return r?(this._materialScanCounter=l,this._warnedNoMaterials=!1,this._warnedNoShaderInjection=!1,this._applyToSceneMaterials(r),this._isEnabled=!0,!0):!1}removeEffect(e){return this._unpatchAllMaterials(),this._isEnabled=!1,!0}updatePreRender(e){if(!this._isEnabled||!(e instanceof n.Layer))return;const r=e.getRenderer(),o=r.getThreeScene(),t=r.getThreeCamera();!o||!t||(t.updateMatrixWorld(),this._cameraMatrixWorld.copy(t.matrixWorld),this._cameraPosition.setFromMatrixPosition(t.matrixWorld),this._materialScanCounter>=l?(this._applyToSceneMaterials(o),this._materialScanCounter=0):this._materialScanCounter++,this._updatePatchedMaterialsUniforms())}updateDoubleParameter(e,r){e==="intensity"?this._intensity=Math.max(0,r):e==="outerWrap"?this._outerWrap=Math.max(0,Math.min(1,r)):e==="power"?this._power=Math.max(.05,r):e==="fresnel0"?this._fresnel0=Math.max(0,Math.min(1,r)):e==="shadowStrength"&&(this._shadowStrength=Math.max(0,Math.min(1,r)))}getDoubleParameter(e){return e==="intensity"?this._intensity:e==="outerWrap"?this._outerWrap:e==="power"?this._power:e==="fresnel0"?this._fresnel0:e==="shadowStrength"?this._shadowStrength:0}updateStringParameter(e,r){e==="color"&&(this._colorHex=n.rgbOrHexStringToNumber(r))}updateColorParameter(e,r){e==="color"&&(this._colorHex=r)}getColorParameter(e){return e==="color"?this._colorHex:0}updateBooleanParameter(e,r){e==="enabled"?this._effectEnabled=r:e==="debugForceMaxRim"&&(this._debugForceMaxRim=r)}getNetworkSyncData(){return{i:this._intensity,c:this._colorHex,o:this._outerWrap,s:this._shadowStrength,p:this._power,f:this._fresnel0,e:this._effectEnabled,d:this._debugForceMaxRim}}updateFromNetworkSyncData(e){this._intensity=Math.max(0,e.i),this._colorHex=e.c,this._outerWrap=Math.max(0,Math.min(1,e.o)),this._shadowStrength=Math.max(0,Math.min(1,e.s)),e.p!==void 0&&(this._power=Math.max(.05,e.p)),e.f!==void 0&&(this._fresnel0=Math.max(0,Math.min(1,e.f))),this._effectEnabled=!!e.e,this._debugForceMaxRim=!!e.d}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=RimLight.js.map
