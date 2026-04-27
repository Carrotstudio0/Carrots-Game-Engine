var gdjs;(function(s){const n=16,f=u=>{const r=[];for(let e=0;e<u;e++)r.push(new THREE.Vector3);return r},c=u=>{const r=[];for(let e=0;e<u;e++)r.push(0);return r},g={uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},fogColor:{value:new THREE.Vector3(1,1,1)},density:{value:.012},lightScatter:{value:1},maxDistance:{value:1200},stepCount:{value:36},frameJitter:{value:0},lightCount:{value:0},lightPositions:{value:f(n)},lightColors:{value:f(n)},lightRanges:{value:c(n)},cameraProjectionMatrixInverse:{value:new THREE.Matrix4}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      #define MAX_VOLUMETRIC_LIGHTS ${n}
      #define MAX_VOLUMETRIC_STEPS 64

      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform vec3 fogColor;
      uniform float density;
      uniform float lightScatter;
      uniform float maxDistance;
      uniform float stepCount;
      uniform float frameJitter;
      uniform int lightCount;
      uniform vec3 lightPositions[MAX_VOLUMETRIC_LIGHTS];
      uniform vec3 lightColors[MAX_VOLUMETRIC_LIGHTS];
      uniform float lightRanges[MAX_VOLUMETRIC_LIGHTS];
      uniform mat4 cameraProjectionMatrixInverse;
      varying vec2 vUv;

      vec3 viewPositionFromDepth(vec2 uv, float depth) {
        vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 view = cameraProjectionMatrixInverse * clip;
        return view.xyz / max(view.w, 0.00001);
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        if (density <= 0.0 || maxDistance <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        float depth = texture2D(tDepth, vUv).x;
        vec3 farViewPosition = viewPositionFromDepth(vUv, 1.0);
        vec3 rayDirection = normalize(farViewPosition);
        float rayLength = maxDistance;

        if (depth < 1.0) {
          vec3 surfaceViewPosition = viewPositionFromDepth(vUv, depth);
          float surfaceDistance = length(surfaceViewPosition);
          if (surfaceDistance > 0.00001) {
            rayDirection = normalize(surfaceViewPosition);
            rayLength = min(surfaceDistance, maxDistance);
          }
        }

        float clampedStepCount = clamp(stepCount, 8.0, float(MAX_VOLUMETRIC_STEPS));
        float densityStepFactor = clamp(density * 120.0, 0.45, 1.0);
        float adaptiveStepCount = max(
          8.0,
          floor(clampedStepCount * densityStepFactor + 0.5)
        );
        float stepLength = rayLength / adaptiveStepCount;

        if (lightCount == 0 || lightScatter <= 0.0001) {
          float opticalDepth = density * rayLength * 0.01;
          float transmittance = exp(-opticalDepth);
          vec3 fogContribution = fogColor * (1.0 - transmittance);
          vec3 finalNoLightColor = baseColor.rgb * transmittance + fogContribution;
          gl_FragColor = vec4(finalNoLightColor, baseColor.a);
          return;
        }

        float transmittance = 1.0;
        vec3 accumulatedFog = vec3(0.0);
        float pixelJitter = hash12(vUv * resolution + vec2(frameJitter * 91.7));

        for (int step = 0; step < MAX_VOLUMETRIC_STEPS; step++) {
          if (float(step) >= adaptiveStepCount) {
            break;
          }
          float sampleDistance = (float(step) + pixelJitter) * stepLength;
          vec3 samplePosition = rayDirection * sampleDistance;

          float localDensity = density;
          vec3 localLightColor = vec3(0.0);

          for (int i = 0; i < MAX_VOLUMETRIC_LIGHTS; i++) {
            if (i >= lightCount) break;

            float range = max(lightRanges[i], 1.0);
            float distanceToLight = length(samplePosition - lightPositions[i]);
            float attenuation = exp(
              -(distanceToLight * distanceToLight) / max(1.0, range * range * 0.5)
            );

            localLightColor += lightColors[i] * attenuation;
            localDensity += density * lightScatter * attenuation * 0.5;
          }

          float opticalDepth = localDensity * stepLength * 0.01;
          float stepTransmittance = exp(-opticalDepth);
          vec3 mediumColor = fogColor + localLightColor * lightScatter;

          accumulatedFog +=
            transmittance * (1.0 - stepTransmittance) * mediumColor;
          transmittance *= stepTransmittance;

          if (transmittance < 0.01) {
            break;
          }
        }

        vec3 finalColor = baseColor.rgb * transmittance + accumulatedFog;
        gl_FragColor = vec4(finalColor, baseColor.a);
      }
    `};s.PixiFiltersTools.registerFilterCreator("Scene3D::VolumetricFog",new class{makeFilter(u,r){return typeof THREE=="undefined"?new s.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(g),s.markScene3DPostProcessingPass(this.shaderPass,"FOG"),this._isEnabled=!1,this._effectEnabled=r.booleanParameters.enabled===void 0?!0:!!r.booleanParameters.enabled,this._fogColor=new THREE.Color(s.rgbOrHexStringToNumber(r.stringParameters.fogColor||"200;220;255")),this._density=r.doubleParameters.density!==void 0?Math.max(0,r.doubleParameters.density):.012,this._lightScatter=r.doubleParameters.lightScatter!==void 0?Math.max(0,r.doubleParameters.lightScatter):1,this._maxDistance=r.doubleParameters.maxDistance!==void 0?Math.max(0,r.doubleParameters.maxDistance):1200,this._qualityMode=r.stringParameters.qualityMode||"high",this._lightPositions=f(n),this._lightColors=f(n),this._lightRanges=c(n),this._tempWorldPosition=new THREE.Vector3,this._tempViewPosition=new THREE.Vector3,this._frameIndex=0,this._framesSinceLightRefresh=999,this._lightRefreshIntervalFrames=1,this.shaderPass.uniforms.fogColor.value.set(this._fogColor.r,this._fogColor.g,this._fogColor.b),this.shaderPass.uniforms.density.value=this._density,this.shaderPass.uniforms.lightScatter.value=this._lightScatter,this.shaderPass.uniforms.maxDistance.value=this._maxDistance,this.shaderPass.uniforms.lightPositions.value=this._lightPositions,this.shaderPass.uniforms.lightColors.value=this._lightColors,this.shaderPass.uniforms.lightRanges.value=this._lightRanges,this.shaderPass.uniforms.frameJitter.value=0,this.shaderPass.enabled=!0}isEnabled(e){return this._isEnabled}setEnabled(e,i){return this._isEnabled===i?!0:i?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof s.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),s.reorderScene3DPostProcessingPasses(e),this._framesSinceLightRefresh=this._lightRefreshIntervalFrames,this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof s.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),s.clearScene3DPostProcessingEffectQualityMode(e,"FOG"),this._isEnabled=!1,!0):!1}_updateLightsUniforms(e,i){let a=0;e.traverse(t=>{if(a>=n||!(t instanceof THREE.PointLight)&&!(t instanceof THREE.SpotLight)||!t.visible||t.intensity<=0)return;t.getWorldPosition(this._tempWorldPosition),this._tempViewPosition.copy(this._tempWorldPosition).applyMatrix4(i.matrixWorldInverse);const l=t.distance>0?Math.min(t.distance,this._maxDistance):this._maxDistance;this._lightPositions[a].copy(this._tempViewPosition),this._lightColors[a].set(t.color.r*t.intensity,t.color.g*t.intensity,t.color.b*t.intensity),this._lightRanges[a]=Math.max(l,1),a++});for(let t=a;t<n;t++)this._lightPositions[t].set(0,0,0),this._lightColors[t].set(0,0,0),this._lightRanges[t]=0;this.shaderPass.uniforms.lightCount.value=a,this.shaderPass.uniforms.lightPositions.value=this._lightPositions,this.shaderPass.uniforms.lightColors.value=this._lightColors,this.shaderPass.uniforms.lightRanges.value=this._lightRanges}_adaptQuality(e){const i=s.getScene3DPostProcessingQualityProfileForLayerMode(e,this._qualityMode);return i.fogSteps<=14?this._lightRefreshIntervalFrames=3:i.fogSteps<=22?this._lightRefreshIntervalFrames=2:this._lightRefreshIntervalFrames=1,i}updatePreRender(e){if(!this._isEnabled||!(e instanceof s.Layer))return;if(!this._effectEnabled){this.shaderPass.enabled=!1,s.clearScene3DPostProcessingEffectQualityMode(e,"FOG");return}const a=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),t=e.getRenderer(),l=t.getThreeScene(),o=t.getThreeCamera();if(!a||!l||!o)return;if(!s.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1,s.clearScene3DPostProcessingEffectQualityMode(e,"FOG");return}s.setScene3DPostProcessingEffectQualityMode(e,"FOG",this._qualityMode);const m=this._adaptQuality(e),h=s.captureScene3DSharedTextures(e,a,l,o);!h||!h.depthTexture||(o.updateMatrixWorld(),o.updateProjectionMatrix(),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.matrixWorldInverse.copy(o.matrixWorld).invert(),this.shaderPass.enabled=!0,this.shaderPass.uniforms.resolution.value.set(h.width,h.height),this.shaderPass.uniforms.tDepth.value=h.depthTexture,this.shaderPass.uniforms.cameraProjectionMatrixInverse.value.copy(o.projectionMatrixInverse),this.shaderPass.uniforms.fogColor.value.set(this._fogColor.r,this._fogColor.g,this._fogColor.b),this.shaderPass.uniforms.density.value=this._density,this.shaderPass.uniforms.lightScatter.value=this._lightScatter,this.shaderPass.uniforms.maxDistance.value=this._maxDistance,this.shaderPass.uniforms.stepCount.value=m.fogSteps,this._frameIndex=(this._frameIndex+1)%4096,this.shaderPass.uniforms.frameJitter.value=this._frameIndex*.61803398875%1,this._framesSinceLightRefresh++,this._framesSinceLightRefresh>=this._lightRefreshIntervalFrames&&(this._updateLightsUniforms(l,o),this._framesSinceLightRefresh=0))}updateDoubleParameter(e,i){e==="density"?this._density=Math.max(0,i):e==="lightScatter"?this._lightScatter=Math.max(0,i):e==="maxDistance"&&(this._maxDistance=Math.max(0,i))}getDoubleParameter(e){return e==="density"?this._density:e==="lightScatter"?this._lightScatter:e==="maxDistance"?this._maxDistance:0}updateStringParameter(e,i){e==="fogColor"?this._fogColor.setHex(s.rgbOrHexStringToNumber(i)):e==="qualityMode"&&(this._qualityMode=i||"high")}updateColorParameter(e,i){e==="fogColor"&&this._fogColor.setHex(i)}getColorParameter(e){return e==="fogColor"?this._fogColor.getHex():0}updateBooleanParameter(e,i){e==="enabled"&&(this._effectEnabled=i,this.shaderPass.enabled=i)}getNetworkSyncData(){return{c:this._fogColor.getHex(),d:this._density,ls:this._lightScatter,md:this._maxDistance,e:this._effectEnabled,q:this._qualityMode}}updateFromNetworkSyncData(e){this._fogColor.setHex(e.c),this._density=e.d,this._lightScatter=e.ls,this._maxDistance=e.md,this._effectEnabled=e.e,this._qualityMode=e.q||"high",this.shaderPass.uniforms.fogColor.value.set(this._fogColor.r,this._fogColor.g,this._fogColor.b),this.shaderPass.uniforms.density.value=this._density,this.shaderPass.uniforms.lightScatter.value=this._lightScatter,this.shaderPass.uniforms.maxDistance.value=this._maxDistance,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=VolumetricFogEffect.js.map
