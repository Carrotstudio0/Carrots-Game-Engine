var gdjs;(function(s){const u={uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},radius:{value:60},intensity:{value:.9},bias:{value:.6},sampleCount:{value:4},cameraProjectionMatrix:{value:new THREE.Matrix4},cameraProjectionMatrixInverse:{value:new THREE.Matrix4}},vertexShader:`
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
      uniform float radius;
      uniform float intensity;
      uniform float bias;
      uniform float sampleCount;
      uniform mat4 cameraProjectionMatrix;
      uniform mat4 cameraProjectionMatrixInverse;
      varying vec2 vUv;

      const int MAX_SSAO_SAMPLES = 32;

      vec3 viewPositionFromDepth(vec2 uv, float depth) {
        vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 view = cameraProjectionMatrixInverse * clip;
        return view.xyz / max(view.w, 0.00001);
      }

      vec2 projectToUv(vec3 viewPosition) {
        vec4 clip = cameraProjectionMatrix * vec4(viewPosition, 1.0);
        return clip.xy / max(clip.w, 0.00001) * 0.5 + 0.5;
      }

      vec3 reconstructNormal(vec2 uv, float depth) {
        vec2 texel = 1.0 / resolution;
        float depthRight = texture2D(tDepth, uv + vec2(texel.x, 0.0)).x;
        float depthUp = texture2D(tDepth, uv + vec2(0.0, texel.y)).x;

        vec3 center = viewPositionFromDepth(uv, depth);
        vec3 right = viewPositionFromDepth(uv + vec2(texel.x, 0.0), depthRight);
        vec3 up = viewPositionFromDepth(uv + vec2(0.0, texel.y), depthUp);

        vec3 normal = normalize(cross(right - center, up - center));
        if (dot(normal, -normalize(center)) < 0.0) {
          normal = -normal;
        }
        return normal;
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec3 randomHemisphereDirection(
        vec2 uv,
        vec3 normal,
        float index,
        float rotationOffset
      ) {
        float u = hash12(uv * vec2(173.3, 157.7) + vec2(index, index * 1.37));
        float v = hash12(uv.yx * vec2(149.1, 181.9) + vec2(index * 2.11, index * 0.73));

        float phi = 6.28318530718 * u + rotationOffset;
        float cosTheta = 1.0 - v;
        float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));

        vec3 randomVec = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);

        vec3 tangent = normalize(abs(normal.z) < 0.999
          ? cross(normal, vec3(0.0, 0.0, 1.0))
          : cross(normal, vec3(0.0, 1.0, 0.0)));
        vec3 bitangent = cross(normal, tangent);

        return normalize(
          tangent * randomVec.x +
          bitangent * randomVec.y +
          normal * randomVec.z
        );
      }

      float computeAdaptiveSampleCount(vec3 originVS, float requestedCount) {
        float viewDepth = abs(originVS.z);
        float depthFactor = clamp(radius / (radius + viewDepth), 0.45, 1.0);
        float adaptiveCount = floor(requestedCount * depthFactor + 0.5);
        return clamp(adaptiveCount, 4.0, requestedCount);
      }

      float computeAO(vec3 originVS, vec3 normal, vec2 uv) {
        float requestedCount = clamp(sampleCount, 4.0, float(MAX_SSAO_SAMPLES));
        float count = computeAdaptiveSampleCount(originVS, requestedCount);
        float occlusion = 0.0;
        float kernelRotation =
          hash12(uv * resolution + originVS.xy * 0.01) * 6.28318530718;

        for (int i = 0; i < MAX_SSAO_SAMPLES; i++) {
          if (float(i) >= count) {
            break;
          }

          float scale = (float(i) + 0.5) / count;
          scale = mix(0.1, 1.0, scale * scale);
          vec3 sampleDir = randomHemisphereDirection(
            uv,
            normal,
            float(i),
            kernelRotation
          );
          vec3 samplePos = originVS + sampleDir * radius * scale;
          vec2 sampleUv = projectToUv(samplePos);

          if (
            sampleUv.x <= 0.0 || sampleUv.x >= 1.0 ||
            sampleUv.y <= 0.0 || sampleUv.y >= 1.0
          ) {
            continue;
          }

          float sampleDepth = texture2D(tDepth, sampleUv).x;
          if (sampleDepth >= 1.0) {
            continue;
          }

          vec3 geometryPos = viewPositionFromDepth(sampleUv, sampleDepth);
          float signedDepth = geometryPos.z - samplePos.z;
          float rangeWeight = smoothstep(
            0.0,
            1.0,
            radius / (abs(originVS.z - geometryPos.z) + 0.0001)
          );
          float distanceWeight = 1.0 - smoothstep(
            radius * 0.2,
            radius * 1.5,
            length(samplePos - originVS)
          );
          float isOccluded = signedDepth > bias ? 1.0 : 0.0;
          occlusion += isOccluded * rangeWeight * distanceWeight;
        }

        float ao = 1.0 - (occlusion / count) * intensity;
        return clamp(ao, 0.0, 1.0);
      }

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        float depth = texture2D(tDepth, vUv).x;
        if (depth >= 1.0 || intensity <= 0.0 || radius <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        vec3 viewPos = viewPositionFromDepth(vUv, depth);
        vec3 normal = reconstructNormal(vUv, depth);
        float ao = computeAO(viewPos, normal, vUv);
        float aoBlend = 0.75;
        vec3 aoColor = mix(baseColor.rgb, baseColor.rgb * ao, aoBlend);
        gl_FragColor = vec4(aoColor, baseColor.a);
      }
    `};s.PixiFiltersTools.registerFilterCreator("Scene3D::SSAO",new class{makeFilter(h,i){return typeof THREE=="undefined"?new s.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(u),s.markScene3DPostProcessingPass(this.shaderPass,"SSAO"),this._isEnabled=!1,this._effectEnabled=i.booleanParameters.enabled===void 0?!0:!!i.booleanParameters.enabled,this._radius=i.doubleParameters.radius!==void 0?Math.max(.1,i.doubleParameters.radius):60,this._intensity=i.doubleParameters.intensity!==void 0?Math.max(0,i.doubleParameters.intensity):.9,this._bias=i.doubleParameters.bias!==void 0?Math.max(0,i.doubleParameters.bias):.6,this._samples=i.doubleParameters.samples!==void 0?Math.max(4,Math.min(32,Math.round(i.doubleParameters.samples))):4,this._effectiveSamples=this._samples,this._qualityMode=i.stringParameters.qualityMode||"high",this.shaderPass.enabled=!0}isEnabled(e){return this._isEnabled}setEnabled(e,t){return this._isEnabled===t?!0:t?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof s.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),s.reorderScene3DPostProcessingPasses(e),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof s.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),s.clearScene3DPostProcessingEffectQualityMode(e,"SSAO"),this._isEnabled=!1,!0):!1}_adaptQuality(e){if(!(e instanceof s.Layer))return;const t=s.getScene3DPostProcessingQualityProfileForLayerMode(e,this._qualityMode);this._effectiveSamples=Math.max(4,Math.min(t.ssaoSamples,this._samples))}updatePreRender(e){if(!this._isEnabled||!(e instanceof s.Layer))return;if(!this._effectEnabled){this.shaderPass.enabled=!1,s.clearScene3DPostProcessingEffectQualityMode(e,"SSAO");return}const o=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),n=e.getRenderer(),l=n.getThreeScene(),a=n.getThreeCamera();if(!o||!l||!a)return;if(this._adaptQuality(e),!s.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1,s.clearScene3DPostProcessingEffectQualityMode(e,"SSAO");return}s.setScene3DPostProcessingEffectQualityMode(e,"SSAO",this._qualityMode);const r=s.captureScene3DSharedTextures(e,o,l,a);!r||!r.depthTexture||(a.updateMatrixWorld(),a.updateProjectionMatrix(),a.projectionMatrixInverse.copy(a.projectionMatrix).invert(),this.shaderPass.enabled=!0,this.shaderPass.uniforms.resolution.value.set(r.width,r.height),this.shaderPass.uniforms.tDepth.value=r.depthTexture,this.shaderPass.uniforms.cameraProjectionMatrix.value.copy(a.projectionMatrix),this.shaderPass.uniforms.cameraProjectionMatrixInverse.value.copy(a.projectionMatrixInverse),this.shaderPass.uniforms.radius.value=this._radius,this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.bias.value=this._bias,this.shaderPass.uniforms.sampleCount.value=this._effectiveSamples)}updateDoubleParameter(e,t){e==="radius"?this._radius=Math.max(.1,t):e==="intensity"?this._intensity=Math.max(0,t):e==="bias"?this._bias=Math.max(0,t):e==="samples"&&(this._samples=Math.max(4,Math.min(32,Math.round(t))))}getDoubleParameter(e){return e==="radius"?this._radius:e==="intensity"?this._intensity:e==="bias"?this._bias:e==="samples"?this._samples:0}updateStringParameter(e,t){e==="qualityMode"&&(this._qualityMode=t||"high")}updateColorParameter(e,t){}getColorParameter(e){return 0}updateBooleanParameter(e,t){e==="enabled"&&(this._effectEnabled=t,this.shaderPass.enabled=t)}getNetworkSyncData(){return{r:this._radius,i:this._intensity,b:this._bias,s:this._samples,e:this._effectEnabled,q:this._qualityMode}}updateFromNetworkSyncData(e){this._radius=Math.max(.1,e.r),this._intensity=Math.max(0,e.i),this._bias=Math.max(0,e.b),this._samples=Math.max(4,Math.min(32,Math.round(e.s))),this._effectiveSamples=Math.max(4,Math.min(24,this._samples)),this._effectEnabled=e.e,this._qualityMode=e.q||"high",this.shaderPass.uniforms.radius.value=this._radius,this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.bias.value=this._bias,this.shaderPass.uniforms.sampleCount.value=this._effectiveSamples,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=SSAOEffect.js.map
