var gdjs;(function(t){const h=48,c=64,_={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1,1)},time:{value:0},intensity:{value:1},dropCount:{value:24},streakCount:{value:32},streakIntensity:{value:.6},refractionStrength:{value:1},windAngle:{value:0},wetness:{value:1}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      #define MAX_DROPS ${h}
      #define MAX_STREAKS ${c}

      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float time;
      uniform float intensity;
      uniform float dropCount;
      uniform float streakCount;
      uniform float streakIntensity;
      uniform float refractionStrength;
      uniform float windAngle;
      uniform float wetness;
      varying vec2 vUv;

      float drop(vec2 uv, float seed, float currentTime) {
        vec2 center = vec2(
          fract(sin(seed * 127.1) * 43758.5),
          fract(cos(seed * 311.7) * 13758.5)
        );

        float lifetime = fract(seed * 0.317 + currentTime * 0.15);
        center.y = mix(
          0.1,
          0.9,
          fract(center.y + currentTime * 0.08 * (0.5 + fract(seed * 0.77)))
        );

        float size = mix(0.008, 0.022, fract(seed * 0.541));
        float swell =
          mix(0.75, 1.35, smoothstep(0.08, 0.45, lifetime)) *
          mix(1.0, 0.65, smoothstep(0.6, 1.0, lifetime));
        size *= swell;

        float dist = length(uv - center);
        float blob = smoothstep(size, size * 0.3, dist);
        float shimmer = 0.5 + 0.5 * sin(currentTime * 3.0 + seed * 6.28);
        float alive =
          smoothstep(0.0, 0.12, lifetime) *
          (1.0 - smoothstep(0.72, 1.0, lifetime));
        return blob * shimmer * alive;
      }

      float streak(vec2 uv, float seed, float currentTime) {
        float x = fract(sin(seed * 93.9) * 78197.5);
        float speed = 0.3 + fract(seed * 0.413) * 0.7;
        float width = 0.001 + fract(seed * 0.271) * 0.002;
        float len = 0.04 + fract(seed * 0.631) * 0.08;
        float y = fract(seed * 0.5 + currentTime * speed);

        vec2 windDir = vec2(sin(windAngle), cos(windAngle));
        float yDelta = uv.y - y;
        float xDrift = yDelta * windDir.x * 0.35;

        float onX = smoothstep(width, 0.0, abs((uv.x - x) - xDrift));
        float onY =
          smoothstep(0.0, len * 0.3, yDelta) *
          smoothstep(len, len * 0.5, yDelta);
        return onX * onY;
      }

      vec2 refractionOffset(vec2 uv, float dropMask, vec2 texel) {
        vec2 normal = vec2(dFdx(dropMask), dFdy(dropMask)) * 8.0;
        return uv + normal * texel * refractionStrength * dropMask;
      }

      void main() {
        float totalDrop = 0.0;
        float totalStreak = 0.0;

        float activeDrops = clamp(dropCount, 1.0, float(MAX_DROPS));
        float activeStreaks = clamp(streakCount, 1.0, float(MAX_STREAKS));

        for (int i = 0; i < MAX_DROPS; i++) {
          if (float(i) >= activeDrops) break;
          totalDrop += drop(vUv, float(i), time);
        }
        for (int i = 0; i < MAX_STREAKS; i++) {
          if (float(i) >= activeStreaks) break;
          totalStreak += streak(vUv, float(i) + 100.0, time);
        }

        totalDrop = clamp(totalDrop * clamp(intensity, 0.0, 2.0), 0.0, 1.0);
        totalStreak = clamp(
          totalStreak * streakIntensity * clamp(intensity, 0.0, 2.0),
          0.0,
          0.6
        );

        vec2 refractedUV = refractionOffset(vUv, totalDrop, 1.0 / resolution);
        vec4 refractedColor =
          texture2D(tDiffuse, clamp(refractedUV, vec2(0.0), vec2(1.0)));
        vec4 baseColor = texture2D(tDiffuse, vUv);

        vec3 dropColor = refractedColor.rgb * (1.0 + totalDrop * 0.15);
        vec3 streakColor = baseColor.rgb + vec3(totalStreak * 0.12);

        vec3 finalColor = mix(baseColor.rgb, dropColor, totalDrop);
        finalColor = mix(finalColor, streakColor, totalStreak);
        finalColor *= mix(1.0, 0.82, wetness * (1.0 - totalDrop));

        gl_FragColor = vec4(finalColor, baseColor.a);
      }
    `,extensions:{derivatives:!0}},n=i=>{const s=(i||"").toLowerCase();return s==="custom"?"custom":s==="low"||s==="high"?s:"medium"},o=i=>t.evtTools.common.clamp(0,2,i),a=i=>t.evtTools.common.clamp(1,h,i),l=i=>t.evtTools.common.clamp(1,c,i),u=i=>t.evtTools.common.clamp(0,1,i),d=i=>t.evtTools.common.clamp(0,2,i),f=i=>t.evtTools.common.clamp(0,1,i);t.PixiFiltersTools.registerFilterCreator("Scene3D::RainDrops",new class{makeFilter(i,s){return typeof THREE=="undefined"?new t.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(_),t.markScene3DPostProcessingPass(this.shaderPass,"RAIN"),this._isEnabled=!1,this._effectEnabled=s.booleanParameters.enabled===void 0?!0:!!s.booleanParameters.enabled,this._intensity=o(s.doubleParameters.intensity!==void 0?s.doubleParameters.intensity:1),this._dropCount=a(s.doubleParameters.dropCount!==void 0?s.doubleParameters.dropCount:24),this._streakCount=l(s.doubleParameters.streakCount!==void 0?s.doubleParameters.streakCount:32),this._streakIntensity=u(s.doubleParameters.streakIntensity!==void 0?s.doubleParameters.streakIntensity:.6),this._refractionStrength=d(s.doubleParameters.refractionStrength!==void 0?s.doubleParameters.refractionStrength:1),this._windAngleRad=t.toRad(s.doubleParameters.windAngle!==void 0?s.doubleParameters.windAngle:0),this._wetness=f(s.doubleParameters.wetness!==void 0?s.doubleParameters.wetness:1),this._qualityMode=n(s.stringParameters.qualityMode||"medium"),this._time=0,this._renderSize=new THREE.Vector2(1,1),this._applyQualityPreset(),this._updateShaderUniforms(),this.shaderPass.enabled=this._effectEnabled}_applyQualityPreset(e){if(this._qualityMode==="custom")return;const r=e||this._qualityMode;r==="low"?(this._dropCount=8,this._streakCount=12):r==="high"?(this._dropCount=48,this._streakCount=64):(this._dropCount=24,this._streakCount=32)}_applyQualityPresetFromProfile(e){this._qualityMode!=="custom"&&(e.ssrSteps<=10?(this._dropCount=8,this._streakCount=12):e.ssrSteps<=16?(this._dropCount=24,this._streakCount=32):(this._dropCount=48,this._streakCount=64))}_updateShaderUniforms(){this.shaderPass.uniforms.time.value=this._time,this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.dropCount.value=this._dropCount,this.shaderPass.uniforms.streakCount.value=this._streakCount,this.shaderPass.uniforms.streakIntensity.value=this._streakIntensity,this.shaderPass.uniforms.refractionStrength.value=this._refractionStrength,this.shaderPass.uniforms.windAngle.value=this._windAngleRad,this.shaderPass.uniforms.wetness.value=this._wetness}isEnabled(e){return this._isEnabled}setEnabled(e,r){return this._isEnabled===r?!0:r?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof t.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),t.reorderScene3DPostProcessingPasses(e),this._qualityMode!=="custom"?t.setScene3DPostProcessingEffectQualityMode(e,"RAIN",this._qualityMode):t.clearScene3DPostProcessingEffectQualityMode(e,"RAIN"),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof t.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),t.clearScene3DPostProcessingEffectQualityMode(e,"RAIN"),this._isEnabled=!1,!0):!1}updatePreRender(e){if(!this._isEnabled||!(e instanceof t.Layer))return;if(!this._effectEnabled){this.shaderPass.enabled=!1,t.clearScene3DPostProcessingEffectQualityMode(e,"RAIN");return}const r=e.getRuntimeScene(),m=r.getGame().getRenderer().getThreeRenderer();if(!m)return;if(!t.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1,t.clearScene3DPostProcessingEffectQualityMode(e,"RAIN");return}if(this._intensity<=1e-4){this.shaderPass.enabled=!1;return}if(this._qualityMode==="custom")t.clearScene3DPostProcessingEffectQualityMode(e,"RAIN");else{t.setScene3DPostProcessingEffectQualityMode(e,"RAIN",this._qualityMode);const P=t.getScene3DPostProcessingQualityProfileForLayerMode(e,this._qualityMode);this._applyQualityPresetFromProfile(P)}const p=Math.max(0,r.getElapsedTime()/1e3);this._time+=p,m.getDrawingBufferSize(this._renderSize),this.shaderPass.uniforms.resolution.value.set(Math.max(1,this._renderSize.x||e.getWidth()),Math.max(1,this._renderSize.y||e.getHeight())),this._updateShaderUniforms(),this.shaderPass.enabled=!0}updateDoubleParameter(e,r){e==="intensity"?this._intensity=o(r):e==="dropCount"?(this._dropCount=a(r),this._qualityMode="custom"):e==="streakCount"?(this._streakCount=l(r),this._qualityMode="custom"):e==="streakIntensity"?this._streakIntensity=u(r):e==="refractionStrength"?this._refractionStrength=d(r):e==="windAngle"?this._windAngleRad=t.toRad(r):e==="wetness"&&(this._wetness=f(r)),this._updateShaderUniforms()}getDoubleParameter(e){return e==="intensity"?this._intensity:e==="dropCount"?this._dropCount:e==="streakCount"?this._streakCount:e==="streakIntensity"?this._streakIntensity:e==="refractionStrength"?this._refractionStrength:e==="windAngle"?t.toDegrees(this._windAngleRad):e==="wetness"?this._wetness:0}updateStringParameter(e,r){e==="qualityMode"&&(this._qualityMode=n(r),this._applyQualityPreset(),this._updateShaderUniforms())}updateColorParameter(e,r){}getColorParameter(e){return 0}updateBooleanParameter(e,r){e==="enabled"&&(this._effectEnabled=r,this.shaderPass.enabled=r)}getNetworkSyncData(){return{i:this._intensity,d:this._dropCount,s:this._streakCount,si:this._streakIntensity,rs:this._refractionStrength,wa:t.toDegrees(this._windAngleRad),w:this._wetness,q:this._qualityMode,e:this._effectEnabled,t:this._time}}updateFromNetworkSyncData(e){this._intensity=o(e.i),this._dropCount=a(e.d),this._streakCount=l(e.s),this._streakIntensity=u(e.si),this._refractionStrength=d(e.rs),this._windAngleRad=t.toRad(e.wa),this._wetness=f(e.w),this._qualityMode=n(e.q),this._effectEnabled=!!e.e,this._time=Math.max(0,e.t??this._time),this._applyQualityPreset(),this._updateShaderUniforms(),this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=RainDropsEffect.js.map
