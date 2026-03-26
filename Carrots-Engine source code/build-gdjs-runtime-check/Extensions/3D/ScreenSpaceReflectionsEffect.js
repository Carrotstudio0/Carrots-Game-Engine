var gdjs;(function(l){const E="__gdScene3dSsrExclude",S="__gdScene3dPbrMaterial",T="__gdScene3dPbrRoughness",_={uniforms:{tDiffuse:{value:null},tSceneColor:{value:null},tDepth:{value:null},tSSRExcludeMask:{value:null},tRoughness:{value:null},resolution:{value:new THREE.Vector2(1,1)},intensity:{value:.75},maxDistance:{value:420},thickness:{value:4},maxSteps:{value:24},cameraProjectionMatrix:{value:new THREE.Matrix4},cameraProjectionMatrixInverse:{value:new THREE.Matrix4}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform sampler2D tSceneColor;
      uniform sampler2D tDepth;
      uniform sampler2D tSSRExcludeMask;
      uniform sampler2D tRoughness;
      uniform vec2 resolution;
      uniform float intensity;
      uniform float maxDistance;
      uniform float thickness;
      uniform float maxSteps;
      uniform mat4 cameraProjectionMatrix;
      uniform mat4 cameraProjectionMatrixInverse;
      varying vec2 vUv;

      const int SSR_STEPS = 64;
      const int SSR_REFINEMENT_STEPS = 5;

      vec3 viewPositionFromDepth(vec2 uv, float depth) {
        vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 view = cameraProjectionMatrixInverse * clip;
        return view.xyz / max(view.w, 0.00001);
      }

      vec3 reconstructNormal(vec2 uv, float depth) {
        vec2 texel = 1.0 / resolution;
        vec2 uvLeft = clamp(uv - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0));
        vec2 uvRight = clamp(uv + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0));
        vec2 uvDown = clamp(uv - vec2(0.0, texel.y), vec2(0.0), vec2(1.0));
        vec2 uvUp = clamp(uv + vec2(0.0, texel.y), vec2(0.0), vec2(1.0));

        float depthLeft = texture2D(tDepth, uvLeft).x;
        float depthRight = texture2D(tDepth, uvRight).x;
        float depthDown = texture2D(tDepth, uvDown).x;
        float depthUp = texture2D(tDepth, uvUp).x;

        vec3 center = viewPositionFromDepth(uv, depth);
        vec3 left = viewPositionFromDepth(uvLeft, depthLeft);
        vec3 right = viewPositionFromDepth(uvRight, depthRight);
        vec3 down = viewPositionFromDepth(uvDown, depthDown);
        vec3 up = viewPositionFromDepth(uvUp, depthUp);

        // Select derivatives with the most consistent depth variation to reduce
        // noisy normals near depth discontinuities.
        vec3 dxForward = right - center;
        vec3 dxBackward = center - left;
        vec3 dyForward = up - center;
        vec3 dyBackward = center - down;
        vec3 dx = abs(dxForward.z) < abs(dxBackward.z) ? dxForward : dxBackward;
        vec3 dy = abs(dyForward.z) < abs(dyBackward.z) ? dyForward : dyBackward;

        vec3 normal = normalize(cross(dx, dy));
        if (length(normal) < 0.0001) {
          normal = normalize(cross(right - center, up - center));
        }
        if (dot(normal, -normalize(center)) < 0.0) {
          normal = -normal;
        }
        return normal;
      }

      vec2 projectToUv(vec3 viewPosition) {
        vec4 clip = cameraProjectionMatrix * vec4(viewPosition, 1.0);
        return clip.xy / max(clip.w, 0.00001) * 0.5 + 0.5;
      }

      float estimateRoughness(vec3 normal, vec3 viewPos) {
        float facing = clamp(dot(normal, -normalize(viewPos)), 0.0, 1.0);
        return clamp(1.0 - facing * facing, 0.08, 0.8);
      }

      float sampleSceneRoughness(vec2 uv, vec3 normal, vec3 viewPos) {
        vec4 roughnessSample = texture2D(tRoughness, uv);
        if (roughnessSample.a > 0.5) {
          return clamp(roughnessSample.r, 0.0, 1.0);
        }
        return estimateRoughness(normal, viewPos);
      }

      vec3 sampleReflectionColor(vec2 uv, float roughness) {
        vec2 texel = 1.0 / resolution;
        vec3 currentCenter = texture2D(tDiffuse, uv).rgb;
        vec3 currentXPos = texture2D(
          tDiffuse,
          clamp(uv + vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))
        ).rgb;
        vec3 currentXNeg = texture2D(
          tDiffuse,
          clamp(uv - vec2(texel.x, 0.0), vec2(0.0), vec2(1.0))
        ).rgb;
        vec3 currentYPos = texture2D(
          tDiffuse,
          clamp(uv + vec2(0.0, texel.y), vec2(0.0), vec2(1.0))
        ).rgb;
        vec3 currentYNeg = texture2D(
          tDiffuse,
          clamp(uv - vec2(0.0, texel.y), vec2(0.0), vec2(1.0))
        ).rgb;

        vec3 neighborhoodMin = min(
          min(currentCenter, currentXPos),
          min(min(currentXNeg, currentYPos), currentYNeg)
        );
        vec3 neighborhoodMax = max(
          max(currentCenter, currentXPos),
          max(max(currentXNeg, currentYPos), currentYNeg)
        );

        vec3 capturedCenter = texture2D(tSceneColor, uv).rgb;
        capturedCenter = clamp(
          capturedCenter,
          neighborhoodMin - vec3(0.08),
          neighborhoodMax + vec3(0.08)
        );

        vec2 blurOffset = texel * mix(0.5, 2.0, roughness);
        vec3 capturedBlurred =
          capturedCenter +
          texture2D(
            tSceneColor,
            clamp(uv + vec2(blurOffset.x, 0.0), vec2(0.0), vec2(1.0))
          ).rgb +
          texture2D(
            tSceneColor,
            clamp(uv - vec2(blurOffset.x, 0.0), vec2(0.0), vec2(1.0))
          ).rgb +
          texture2D(
            tSceneColor,
            clamp(uv + vec2(0.0, blurOffset.y), vec2(0.0), vec2(1.0))
          ).rgb +
          texture2D(
            tSceneColor,
            clamp(uv - vec2(0.0, blurOffset.y), vec2(0.0), vec2(1.0))
          ).rgb;
        capturedBlurred *= 0.2;

        float currentFrameWeight = 0.04 + 0.08 * (1.0 - roughness);
        vec3 reflectionColor = mix(capturedBlurred, currentCenter, currentFrameWeight);
        return min(reflectionColor, vec3(4.0));
      }

      vec4 refineHit(
        vec3 originVS,
        vec3 lowPos,
        vec3 highPos,
        float roughness,
        vec3 reflectedDirVS
      ) {
        vec3 a = lowPos;
        vec3 b = highPos;
        vec3 mid = highPos;

        for (int i = 0; i < SSR_REFINEMENT_STEPS; ++i) {
          mid = (a + b) * 0.5;
          vec2 midUv = projectToUv(mid);
          if (midUv.x <= 0.0 || midUv.x >= 1.0 || midUv.y <= 0.0 || midUv.y >= 1.0) {
            b = mid;
            continue;
          }
          float sampledDepth = texture2D(tDepth, midUv).x;
          if (sampledDepth >= 1.0) {
            a = mid;
            continue;
          }
          vec3 depthViewPos = viewPositionFromDepth(midUv, sampledDepth);
          float signedDepth = depthViewPos.z - mid.z;
          float hitThickness = max(thickness, maxDistance / max(maxSteps, 1.0));
          if (signedDepth > -hitThickness * (1.0 + roughness)) {
            b = mid;
          } else {
            a = mid;
          }
        }

        vec2 finalUv = projectToUv(mid);
        if (finalUv.x <= 0.0 || finalUv.x >= 1.0 || finalUv.y <= 0.0 || finalUv.y >= 1.0) {
          return vec4(0.0);
        }
        float finalDepth = texture2D(tDepth, finalUv).x;
        if (finalDepth >= 1.0) {
          return vec4(0.0);
        }

        vec3 hitNormal = reconstructNormal(finalUv, finalDepth);
        float normalAlignment = clamp(dot(hitNormal, -reflectedDirVS), 0.0, 1.0);
        if (normalAlignment <= 0.05) {
          return vec4(0.0);
        }

        vec3 finalDepthViewPos = viewPositionFromDepth(finalUv, finalDepth);
        float finalDepthError = abs(finalDepthViewPos.z - mid.z);
        float finalHitThickness =
          max(thickness, maxDistance / max(maxSteps, 1.0)) * (1.0 + roughness * 0.45);
        float depthConfidence = 1.0 - smoothstep(
          finalHitThickness * 0.5,
          finalHitThickness * 2.5,
          finalDepthError
        );
        float angleConfidence = smoothstep(0.08, 0.45, normalAlignment);
        float hitConfidence = clamp(depthConfidence * angleConfidence, 0.0, 1.0);
        if (hitConfidence <= 0.02) {
          return vec4(0.0);
        }

        vec3 hitColor = sampleReflectionColor(finalUv, roughness) * hitConfidence;
        float hitDistance = length(mid - originVS);
        return vec4(hitColor * normalAlignment, hitDistance);
      }

      vec4 traceReflection(
        vec3 originVS,
        vec3 reflectedDirVS,
        float roughness,
        float traceDistance
      ) {
        float roughnessStepScale = mix(1.0, 0.45, roughness);
        float clampedSteps = clamp(
          maxSteps * roughnessStepScale,
          6.0,
          float(SSR_STEPS)
        );
        float stepSize = traceDistance / clampedSteps;
        vec3 rayPos = originVS;
        vec3 previousRayPos = rayPos;
        vec4 hit = vec4(0.0);

        for (int i = 0; i < SSR_STEPS; ++i) {
          if (float(i) >= clampedSteps) {
            break;
          }

          previousRayPos = rayPos;
          rayPos += reflectedDirVS * stepSize;
          vec2 uv = projectToUv(rayPos);
          if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) {
            break;
          }

          float sampledDepth = texture2D(tDepth, uv).x;
          if (sampledDepth >= 1.0) {
            continue;
          }

          vec3 depthViewPos = viewPositionFromDepth(uv, sampledDepth);
          float signedDepth = depthViewPos.z - rayPos.z;
          float hitThickness =
            max(thickness, stepSize * 0.95) * (1.0 + roughness * 0.35);

          if (signedDepth >= -hitThickness && signedDepth <= hitThickness) {
            hit = refineHit(
              originVS,
              previousRayPos,
              rayPos,
              roughness,
              reflectedDirVS
            );
            break;
          }
        }

        return hit;
      }

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        if (intensity <= 0.0 || maxDistance <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        float depth = texture2D(tDepth, vUv).x;
        if (depth >= 1.0) {
          gl_FragColor = baseColor;
          return;
        }
        float excludeMask = texture2D(tSSRExcludeMask, vUv).r;
        if (excludeMask > 0.5) {
          gl_FragColor = baseColor;
          return;
        }

        vec3 viewPos = viewPositionFromDepth(vUv, depth);
        vec3 normal = reconstructNormal(vUv, depth);
        vec3 reflectedDir = normalize(reflect(normalize(viewPos), normal));

        float roughness = sampleSceneRoughness(vUv, normal, viewPos);
        float traceDistance = mix(maxDistance, maxDistance * 0.42, roughness);
        vec4 hit =
          roughness >= 0.94
            ? vec4(0.0)
            : traceReflection(viewPos, reflectedDir, roughness, traceDistance);
        vec3 reflectionColor = hit.rgb;
        float rayDistance = hit.a;

        if (rayDistance <= 0.0) {
          vec2 fallbackUv = clamp(
            vUv + reflectedDir.xy * (0.045 + 0.035 * (1.0 - roughness)),
            vec2(0.0),
            vec2(1.0)
          );
          reflectionColor = sampleReflectionColor(fallbackUv, roughness);
          rayDistance = traceDistance * 0.45;
        }

        float fresnel = pow(1.0 - max(dot(normal, -normalize(viewPos)), 0.0), 4.0);
        float viewFacing = clamp(dot(normal, -normalize(viewPos)), 0.0, 1.0);
        float distanceFade = clamp(
          1.0 - rayDistance / max(traceDistance, 0.0001),
          0.0,
          1.0
        );
        float edgeFade =
          smoothstep(0.02, 0.16, vUv.x) *
          smoothstep(0.02, 0.16, vUv.y) *
          smoothstep(0.02, 0.16, 1.0 - vUv.x) *
          smoothstep(0.02, 0.16, 1.0 - vUv.y);
        float stabilityFade = smoothstep(0.03, 0.22, viewFacing);
        float reflectionStrength =
          intensity *
          (0.25 + 0.75 * (1.0 - roughness)) *
          (0.25 + 0.75 * fresnel) *
          distanceFade *
          edgeFade *
          stabilityFade;

        // Clamp to reduce bright sparkles on disoccluded pixels.
        reflectionColor = min(
          reflectionColor,
          baseColor.rgb * 2.5 + vec3(0.35)
        );

        gl_FragColor = vec4(
          baseColor.rgb + reflectionColor * reflectionStrength,
          baseColor.a
        );
      }
    `};l.PixiFiltersTools.registerFilterCreator("Scene3D::ScreenSpaceReflections",new class{makeFilter(P,h){return typeof THREE=="undefined"?new l.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(_),l.markScene3DPostProcessingPass(this.shaderPass,"SSR"),this._isEnabled=!1,this._effectEnabled=h.booleanParameters.enabled===void 0?!0:!!h.booleanParameters.enabled,this._intensity=h.doubleParameters.intensity!==void 0?Math.max(0,h.doubleParameters.intensity):.75,this._maxDistance=h.doubleParameters.maxDistance!==void 0?Math.max(0,h.doubleParameters.maxDistance):420,this._thickness=h.doubleParameters.thickness!==void 0?Math.max(1e-4,h.doubleParameters.thickness):4,this._qualityMode=h.stringParameters.qualityMode||"medium",this.shaderPass.enabled=!0,this._raySteps=14,this._excludeMaskRenderTarget=null,this._excludeMaskMaterial=new THREE.MeshBasicMaterial({color:0,toneMapped:!1});const e=new Uint8Array([0,0,0,255]);this._excludeMaskFallbackTexture=new THREE.DataTexture(e,1,1),this._excludeMaskFallbackTexture.needsUpdate=!0,this._excludeMaskFallbackTexture.generateMipmaps=!1,this._excludeMaskFallbackTexture.minFilter=THREE.NearestFilter,this._excludeMaskFallbackTexture.magFilter=THREE.NearestFilter,this.shaderPass.uniforms.tSSRExcludeMask.value=this._excludeMaskFallbackTexture,this._excludeMaskPreviousViewport=new THREE.Vector4,this._excludeMaskPreviousScissor=new THREE.Vector4,this._roughnessRenderTarget=null;const s=new Uint8Array([0,0,0,0]);this._roughnessFallbackTexture=new THREE.DataTexture(s,1,1),this._roughnessFallbackTexture.needsUpdate=!0,this._roughnessFallbackTexture.generateMipmaps=!1,this._roughnessFallbackTexture.minFilter=THREE.NearestFilter,this._roughnessFallbackTexture.magFilter=THREE.NearestFilter,this.shaderPass.uniforms.tRoughness.value=this._roughnessFallbackTexture,this._roughnessMaterialCache=new Map,this._roughnessSkipMaterial=new THREE.MeshBasicMaterial({color:0,toneMapped:!1}),this._roughnessSkipMaterial.transparent=!0,this._roughnessSkipMaterial.opacity=0,this._roughnessSkipMaterial.depthTest=!1,this._roughnessSkipMaterial.depthWrite=!1,this._roughnessSkipMaterial.colorWrite=!1,this._roughnessPreviousViewport=new THREE.Vector4,this._roughnessPreviousScissor=new THREE.Vector4,this._roughnessPreviousClearColor=new THREE.Color(0,0,0),this._auxiliaryCaptureIntervalFrames=1,this._framesSinceAuxiliaryCapture=999}isEnabled(e){return this._isEnabled}setEnabled(e,s){return this._isEnabled===s?!0:s?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof l.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),l.reorderScene3DPostProcessingPasses(e),this._framesSinceAuxiliaryCapture=this._auxiliaryCaptureIntervalFrames,this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof l.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),l.clearScene3DPostProcessingEffectQualityMode(e,"SSR"),this.shaderPass.uniforms.tSSRExcludeMask.value=this._excludeMaskFallbackTexture,this.shaderPass.uniforms.tRoughness.value=this._roughnessFallbackTexture,this._disposeSSRExcludeMaskResources(),this._disposeSSRoughnessResources(),this._isEnabled=!1,!0):!1}_adaptQuality(e){if(!(e instanceof l.Layer))return;const s=l.getScene3DPostProcessingQualityProfileForLayerMode(e,this._qualityMode);this._raySteps=s.ssrSteps,s.ssrSteps<=10?this._auxiliaryCaptureIntervalFrames=3:s.ssrSteps<=16?this._auxiliaryCaptureIntervalFrames=2:this._auxiliaryCaptureIntervalFrames=1}_isSSRExcludedMesh(e){const s=e;if(!s||!s.isMesh||!s.visible)return!1;const t=s.userData;return!!(t&&t[E])}_sceneHasSSRExcludedMeshes(e){const s=[e];for(;s.length>0;){const t=s.pop();if(this._isSSRExcludedMesh(t))return!0;const a=t.children;for(let i=0;i<a.length;i++)s.push(a[i])}return!1}_ensureSSRExcludeMaskTarget(e,s,t){return this._excludeMaskRenderTarget||(this._excludeMaskRenderTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:!0,stencilBuffer:!1}),this._excludeMaskRenderTarget.texture.generateMipmaps=!1),(this._excludeMaskRenderTarget.width!==e||this._excludeMaskRenderTarget.height!==s)&&this._excludeMaskRenderTarget.setSize(e,s),this._excludeMaskRenderTarget.texture.colorSpace=t,this._excludeMaskRenderTarget}_captureSSRExcludeMask(e,s,t,a,i){const n=this._ensureSSRExcludeMaskTarget(a,i,e.outputColorSpace),r=e.getRenderTarget(),v=e.autoClear,m=e.getScissorTest(),f=e.xr.enabled;e.getViewport(this._excludeMaskPreviousViewport),e.getScissor(this._excludeMaskPreviousScissor);const p=s.overrideMaterial,d=[];try{this._excludeMaskMaterial.color.setRGB(0,0,0),this._excludeMaskMaterial.depthTest=!0,this._excludeMaskMaterial.depthWrite=!0,this._excludeMaskMaterial.transparent=!1,e.xr.enabled=!1,e.autoClear=!0,e.setRenderTarget(n),e.setViewport(0,0,a,i),e.setScissor(0,0,a,i),e.setScissorTest(!1),s.overrideMaterial=this._excludeMaskMaterial,e.clear(!0,!0,!0),e.render(s,t);let c=!1;s.traverse(u=>{const o=u;if(!(!o||!o.isMesh)){if(this._isSSRExcludedMesh(o)){c=!0;return}d.push({mesh:o,visible:o.visible}),o.visible=!1}}),c&&(this._excludeMaskMaterial.color.setRGB(1,1,1),this._excludeMaskMaterial.depthTest=!0,this._excludeMaskMaterial.depthWrite=!1,this._excludeMaskMaterial.transparent=!1,e.autoClear=!1,s.overrideMaterial=this._excludeMaskMaterial,e.render(s,t))}finally{for(let c=0;c<d.length;c++)d[c].mesh.visible=d[c].visible;s.overrideMaterial=p,e.setRenderTarget(r),e.setViewport(this._excludeMaskPreviousViewport),e.setScissor(this._excludeMaskPreviousScissor),e.setScissorTest(m),e.autoClear=v,e.xr.enabled=f}return n.texture}_disposeSSRExcludeMaskResources(){this._excludeMaskRenderTarget&&(this._excludeMaskRenderTarget.dispose(),this._excludeMaskRenderTarget=null)}_isPBRManagedMaterial(e){const s=e;if(!s.isMeshStandardMaterial&&!s.isMeshPhysicalMaterial)return!1;const t=s.userData;return!!(t&&t[S])}_getPBRMaterialRoughness(e){const s=e.userData,t=s?s[T]:void 0,a=typeof t=="number"?t:e.roughness;return Math.max(0,Math.min(1,Number.isFinite(a)?a:.5))}_sceneHasPBRManagedMeshes(e){let s=!1;return e.traverse(t=>{if(s)return;const a=t;if(!a||!a.isMesh||!a.visible||!a.material)return;const i=Array.isArray(a.material)?a.material:[a.material];for(let n=0;n<i.length;n++)if(this._isPBRManagedMaterial(i[n])){s=!0;return}}),s}_ensureSSRoughnessTarget(e,s,t){return this._roughnessRenderTarget||(this._roughnessRenderTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:!0,stencilBuffer:!1}),this._roughnessRenderTarget.texture.generateMipmaps=!1),(this._roughnessRenderTarget.width!==e||this._roughnessRenderTarget.height!==s)&&this._roughnessRenderTarget.setSize(e,s),this._roughnessRenderTarget.texture.colorSpace=t,this._roughnessRenderTarget}_getOrCreateRoughnessRenderMaterial(e){const s=Math.round(this._getPBRMaterialRoughness(e)*255),t=e,a=[s,e.side,t.skinning?1:0,t.morphTargets?1:0,t.morphNormals?1:0].join("|"),i=this._roughnessMaterialCache.get(a);if(i)return i;const n=s/255,r=new THREE.MeshBasicMaterial({color:new THREE.Color(n,n,n),toneMapped:!1,side:e.side});return r.depthTest=!0,r.depthWrite=!0,r.transparent=!1,r.skinning=!!t.skinning,r.morphTargets=!!t.morphTargets,r.morphNormals=!!t.morphNormals,r.needsUpdate=!0,this._roughnessMaterialCache.set(a,r),r}_captureSSRoughnessTexture(e,s,t,a,i){const n=this._ensureSSRoughnessTarget(a,i,e.outputColorSpace),r=e.getRenderTarget(),v=e.autoClear,m=e.getScissorTest(),f=e.xr.enabled,p=e.getClearAlpha();e.getViewport(this._roughnessPreviousViewport),e.getScissor(this._roughnessPreviousScissor),e.getClearColor(this._roughnessPreviousClearColor);const d=[],c=[];try{e.xr.enabled=!1,e.autoClear=!0,e.setRenderTarget(n),e.setViewport(0,0,a,i),e.setScissor(0,0,a,i),e.setScissorTest(!1),e.setClearColor(0,0),e.clear(!0,!0,!0),s.traverse(u=>{const o=u;if(!o||!o.isMesh||!o.material)return;const R=Array.isArray(o.material)?o.material:[o.material];let x=!1;const M=R.map(g=>g&&this._isPBRManagedMaterial(g)?(x=!0,this._getOrCreateRoughnessRenderMaterial(g)):this._roughnessSkipMaterial);if(!x){d.push({mesh:o,visible:o.visible}),o.visible=!1;return}c.push({mesh:o,material:o.material}),o.material=Array.isArray(o.material)?M:M[0]}),e.render(s,t)}finally{for(let u=0;u<c.length;u++){const o=c[u];o.mesh.material=o.material}for(let u=0;u<d.length;u++)d[u].mesh.visible=d[u].visible;e.setRenderTarget(r),e.setViewport(this._roughnessPreviousViewport),e.setScissor(this._roughnessPreviousScissor),e.setScissorTest(m),e.setClearColor(this._roughnessPreviousClearColor,p),e.autoClear=v,e.xr.enabled=f}return n.texture}_disposeSSRoughnessResources(){this._roughnessRenderTarget&&(this._roughnessRenderTarget.dispose(),this._roughnessRenderTarget=null);for(const e of this._roughnessMaterialCache.values())e.dispose();this._roughnessMaterialCache.clear()}updatePreRender(e){if(!this._isEnabled||!(e instanceof l.Layer))return;if(!this._effectEnabled){this.shaderPass.enabled=!1,l.clearScene3DPostProcessingEffectQualityMode(e,"SSR"),this._disposeSSRExcludeMaskResources(),this._disposeSSRoughnessResources();return}const t=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),a=e.getRenderer(),i=a.getThreeScene(),n=a.getThreeCamera();if(!t||!i||!n)return;if(this._adaptQuality(e),!l.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1,l.clearScene3DPostProcessingEffectQualityMode(e,"SSR"),this._disposeSSRExcludeMaskResources(),this._disposeSSRoughnessResources();return}l.setScene3DPostProcessingEffectQualityMode(e,"SSR",this._qualityMode);const r=l.captureScene3DSharedTextures(e,t,i,n);if(!r||!r.depthTexture)return;this._framesSinceAuxiliaryCapture++;const v=this._framesSinceAuxiliaryCapture>=this._auxiliaryCaptureIntervalFrames;v&&(this._framesSinceAuxiliaryCapture=0);let m=this._excludeMaskFallbackTexture;this._sceneHasSSRExcludedMeshes(i)?v||!this._excludeMaskRenderTarget||this._excludeMaskRenderTarget.width!==r.width||this._excludeMaskRenderTarget.height!==r.height?m=this._captureSSRExcludeMask(t,i,n,r.width,r.height):this._excludeMaskRenderTarget&&(m=this._excludeMaskRenderTarget.texture):this._disposeSSRExcludeMaskResources();let f=this._roughnessFallbackTexture;this._sceneHasPBRManagedMeshes(i)?v||!this._roughnessRenderTarget||this._roughnessRenderTarget.width!==r.width||this._roughnessRenderTarget.height!==r.height?f=this._captureSSRoughnessTexture(t,i,n,r.width,r.height):this._roughnessRenderTarget&&(f=this._roughnessRenderTarget.texture):this._disposeSSRoughnessResources(),n.updateMatrixWorld(),n.updateProjectionMatrix(),n.projectionMatrixInverse.copy(n.projectionMatrix).invert(),this.shaderPass.enabled=!0,this.shaderPass.uniforms.resolution.value.set(r.width,r.height),this.shaderPass.uniforms.tSceneColor.value=r.colorTexture,this.shaderPass.uniforms.tDepth.value=r.depthTexture,this.shaderPass.uniforms.tSSRExcludeMask.value=m,this.shaderPass.uniforms.tRoughness.value=f,this.shaderPass.uniforms.cameraProjectionMatrix.value.copy(n.projectionMatrix),this.shaderPass.uniforms.cameraProjectionMatrixInverse.value.copy(n.projectionMatrixInverse),this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.maxDistance.value=this._maxDistance,this.shaderPass.uniforms.thickness.value=this._thickness,this.shaderPass.uniforms.maxSteps.value=this._raySteps}updateDoubleParameter(e,s){e==="intensity"?(this._intensity=Math.max(0,s),this.shaderPass.uniforms.intensity.value=this._intensity):e==="maxDistance"?(this._maxDistance=Math.max(0,s),this.shaderPass.uniforms.maxDistance.value=this._maxDistance):e==="thickness"&&(this._thickness=Math.max(1e-4,s),this.shaderPass.uniforms.thickness.value=this._thickness)}getDoubleParameter(e){return e==="intensity"?this._intensity:e==="maxDistance"?this._maxDistance:e==="thickness"?this._thickness:0}updateStringParameter(e,s){e==="qualityMode"&&(this._qualityMode=s||"medium")}updateColorParameter(e,s){}getColorParameter(e){return 0}updateBooleanParameter(e,s){e==="enabled"&&(this._effectEnabled=s,this.shaderPass.enabled=s)}getNetworkSyncData(){return{i:this._intensity,md:this._maxDistance,t:this._thickness,e:this._effectEnabled,q:this._qualityMode}}updateFromNetworkSyncData(e){this._intensity=Math.max(0,e.i),this._maxDistance=Math.max(0,e.md),this._thickness=Math.max(1e-4,e.t),this._effectEnabled=e.e,this._qualityMode=e.q||"medium",this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.maxDistance.value=this._maxDistance,this.shaderPass.uniforms.thickness.value=this._thickness,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=ScreenSpaceReflectionsEffect.js.map
