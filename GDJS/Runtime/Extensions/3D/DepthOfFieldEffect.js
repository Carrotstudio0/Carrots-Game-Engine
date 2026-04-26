var gdjs;(function(a){const u={uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},focusDistance:{value:400},focusRange:{value:250},maxBlur:{value:6},sampleCount:{value:4},cameraProjectionMatrixInverse:{value:new THREE.Matrix4}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float focusDistance;
      uniform float focusRange;
      uniform float maxBlur;
      uniform float sampleCount;
      uniform mat4 cameraProjectionMatrixInverse;
      varying vec2 vUv;

      const int MAX_DOF_SAMPLES = 8;

      vec3 viewPositionFromDepth(vec2 uv, float depth) {
        vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 view = cameraProjectionMatrixInverse * clip;
        return view.xyz / max(view.w, 0.00001);
      }

      float getPixelDistance(float depth, vec2 uv) {
        if (depth >= 1.0) {
          return focusDistance + focusRange + maxBlur * 100.0;
        }
        return length(viewPositionFromDepth(uv, depth));
      }

      float getPixelDistanceFromUv(vec2 uv) {
        float sampleDepth = texture2D(tDepth, uv).x;
        return getPixelDistance(sampleDepth, uv);
      }

      float getBlurFactor(float distanceToCamera) {
        float safeRange = max(focusRange, 0.0001);
        float distanceFromFocus = abs(distanceToCamera - focusDistance);
        float raw = clamp(distanceFromFocus / safeRange, 0.0, 1.0);
        return raw * raw * (3.0 - 2.0 * raw);
      }

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        if (maxBlur <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        float depth = texture2D(tDepth, vUv).x;
        float distanceToCamera = getPixelDistance(depth, vUv);
        float blurFactor = getBlurFactor(distanceToCamera);
        if (blurFactor <= 0.001) {
          gl_FragColor = baseColor;
          return;
        }

        float blurRadius = maxBlur * blurFactor;
        vec2 texel = 1.0 / resolution;
        float count = clamp(sampleCount, 2.0, float(MAX_DOF_SAMPLES));
        float adaptiveCount = max(
          2.0,
          floor(mix(2.0, count, blurFactor) + 0.5)
        );
        float bokehRotation = 2.39996322973;

        vec3 accumColor = baseColor.rgb;
        float accumWeight = 1.0;

        for (int i = 0; i < MAX_DOF_SAMPLES; i++) {
          if (float(i) >= adaptiveCount) {
            break;
          }
          float t = (float(i) + 0.5) / adaptiveCount;
          float angle = bokehRotation * float(i);
          float ring = mix(0.45, 1.0, sqrt(t));
          vec2 direction = vec2(cos(angle), sin(angle));
          vec2 sampleUv = clamp(
            vUv + direction * texel * blurRadius * ring,
            vec2(0.0),
            vec2(1.0)
          );
          vec3 sampleColor = texture2D(tDiffuse, sampleUv).rgb;
          float sampleDistance = getPixelDistanceFromUv(sampleUv);
          float sampleBlur = getBlurFactor(sampleDistance);
          float cocDifference = abs(sampleBlur - blurFactor);
          float depthWeight = 1.0 - smoothstep(0.15, 0.9, cocDifference);
          float sampleWeight = max(depthWeight, 0.05);
          accumColor += sampleColor * sampleWeight;
          accumWeight += sampleWeight;
        }

        vec3 blurredColor = accumColor / max(accumWeight, 0.00001);
        vec3 finalColor = mix(baseColor.rgb, blurredColor, blurFactor);
        gl_FragColor = vec4(finalColor, baseColor.a);
      }
    `};a.PixiFiltersTools.registerFilterCreator("Scene3D::DepthOfField",new class{makeFilter(c,t){return typeof THREE=="undefined"?new a.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(u),a.markScene3DPostProcessingPass(this.shaderPass,"DOF"),this._isEnabled=!1,this._effectEnabled=t.booleanParameters.enabled===void 0?!0:!!t.booleanParameters.enabled,this._focusDistance=t.doubleParameters.focusDistance!==void 0?Math.max(0,t.doubleParameters.focusDistance):400,this._focusRange=t.doubleParameters.focusRange!==void 0?Math.max(1e-4,t.doubleParameters.focusRange):250,this._maxBlur=t.doubleParameters.maxBlur!==void 0?Math.max(0,t.doubleParameters.maxBlur):6,this._samples=t.doubleParameters.samples!==void 0?Math.max(2,Math.min(8,Math.round(t.doubleParameters.samples))):4,this._effectiveSamples=this._samples,this._effectiveBlurScale=1,this._qualityMode=t.stringParameters.qualityMode||"high",this.shaderPass.uniforms.focusDistance.value=this._focusDistance,this.shaderPass.uniforms.focusRange.value=this._focusRange,this.shaderPass.uniforms.maxBlur.value=this._maxBlur,this.shaderPass.uniforms.sampleCount.value=this._samples,this.shaderPass.enabled=!0}isEnabled(e){return this._isEnabled}setEnabled(e,s){return this._isEnabled===s?!0:s?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof a.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),a.reorderScene3DPostProcessingPasses(e),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof a.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),a.clearScene3DPostProcessingEffectQualityMode(e,"DOF"),this._isEnabled=!1,!0):!1}_adaptQuality(e){if(!(e instanceof a.Layer))return;const s=a.getScene3DPostProcessingQualityProfileForLayerMode(e,this._qualityMode);this._effectiveSamples=Math.max(2,Math.min(s.dofSamples,this._samples)),this._effectiveBlurScale=s.dofBlurScale}updatePreRender(e){if(!this._isEnabled||!(e instanceof a.Layer))return;if(!this._effectEnabled){this.shaderPass.enabled=!1,a.clearScene3DPostProcessingEffectQualityMode(e,"DOF");return}const o=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),n=e.getRenderer(),l=n.getThreeScene(),r=n.getThreeCamera();if(!o||!l||!r)return;if(!a.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1,a.clearScene3DPostProcessingEffectQualityMode(e,"DOF");return}a.setScene3DPostProcessingEffectQualityMode(e,"DOF",this._qualityMode),this._adaptQuality(e);const i=a.captureScene3DSharedTextures(e,o,l,r);!i||!i.depthTexture||(r.updateMatrixWorld(),r.updateProjectionMatrix(),r.projectionMatrixInverse.copy(r.projectionMatrix).invert(),this.shaderPass.enabled=!0,this.shaderPass.uniforms.resolution.value.set(i.width,i.height),this.shaderPass.uniforms.tDepth.value=i.depthTexture,this.shaderPass.uniforms.cameraProjectionMatrixInverse.value.copy(r.projectionMatrixInverse),this.shaderPass.uniforms.focusDistance.value=this._focusDistance,this.shaderPass.uniforms.focusRange.value=this._focusRange,this.shaderPass.uniforms.maxBlur.value=this._maxBlur*this._effectiveBlurScale,this.shaderPass.uniforms.sampleCount.value=this._effectiveSamples)}updateDoubleParameter(e,s){e==="focusDistance"?(this._focusDistance=Math.max(0,s),this.shaderPass.uniforms.focusDistance.value=this._focusDistance):e==="focusRange"?(this._focusRange=Math.max(1e-4,s),this.shaderPass.uniforms.focusRange.value=this._focusRange):e==="maxBlur"?(this._maxBlur=Math.max(0,s),this.shaderPass.uniforms.maxBlur.value=this._maxBlur):e==="samples"&&(this._samples=Math.max(2,Math.min(8,Math.round(s))),this.shaderPass.uniforms.sampleCount.value=this._samples)}getDoubleParameter(e){return e==="focusDistance"?this._focusDistance:e==="focusRange"?this._focusRange:e==="maxBlur"?this._maxBlur:e==="samples"?this._samples:0}updateStringParameter(e,s){e==="qualityMode"&&(this._qualityMode=s||"high")}updateColorParameter(e,s){}getColorParameter(e){return 0}updateBooleanParameter(e,s){e==="enabled"&&(this._effectEnabled=s,this.shaderPass.enabled=s)}getNetworkSyncData(){return{fd:this._focusDistance,fr:this._focusRange,mb:this._maxBlur,s:this._samples,e:this._effectEnabled,q:this._qualityMode}}updateFromNetworkSyncData(e){this._focusDistance=e.fd,this._focusRange=e.fr,this._maxBlur=e.mb,this._samples=Math.max(2,Math.min(8,Math.round(e.s))),this._effectEnabled=e.e,this._qualityMode=e.q||"high",this.shaderPass.uniforms.focusDistance.value=this._focusDistance,this.shaderPass.uniforms.focusRange.value=this._focusRange,this.shaderPass.uniforms.maxBlur.value=this._maxBlur,this.shaderPass.uniforms.sampleCount.value=this._samples,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=DepthOfFieldEffect.js.map
