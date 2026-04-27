var gdjs;(function(n){const l={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1,1)},intensity:{value:.35},softness:{value:.45},roundness:{value:1},vignetteColor:{value:new THREE.Vector3(0,0,0)}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float intensity;
      uniform float softness;
      uniform float roundness;
      uniform vec3 vignetteColor;
      varying vec2 vUv;

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        if (intensity <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        vec2 centered = (vUv - vec2(0.5)) * 2.0;
        float safeHeight = max(resolution.y, 1.0);
        float aspect = resolution.x / safeHeight;
        centered.x *= aspect;

        float shapeScale = mix(1.6, 0.7, clamp(roundness, 0.0, 1.0));
        centered.x *= shapeScale;

        float distanceFromCenter = length(centered);
        float edgeStart = clamp(1.0 - clamp(softness, 0.01, 1.0), 0.0, 0.99);
        float edgeMask = smoothstep(edgeStart, 1.0, distanceFromCenter);
        float blendFactor = clamp(intensity, 0.0, 1.0) * edgeMask;

        vec3 finalColor = mix(
          baseColor.rgb,
          baseColor.rgb * vignetteColor,
          blendFactor
        );
        gl_FragColor = vec4(finalColor, baseColor.a);
      }
    `},i=r=>n.evtTools.common.clamp(0,1,r),o=r=>n.evtTools.common.clamp(.01,1,r),a=r=>n.evtTools.common.clamp(0,1,r),d=(r,t)=>{const e=n.markScene3DPostProcessingPass;typeof e=="function"&&e(r,t)},u=r=>{const t=n.isScene3DPostProcessingEnabled;return typeof t=="function"?t(r):!0};n.PixiFiltersTools.registerFilterCreator("Scene3D::Vignette",new class{makeFilter(r,t){return typeof THREE=="undefined"?new n.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(l),d(this.shaderPass,"VIGNETTE"),this._isEnabled=!1,this._effectEnabled=t.booleanParameters.enabled===void 0?!0:!!t.booleanParameters.enabled,this._intensity=i(t.doubleParameters.intensity!==void 0?t.doubleParameters.intensity:.35),this._softness=o(t.doubleParameters.softness!==void 0?t.doubleParameters.softness:.45),this._roundness=a(t.doubleParameters.roundness!==void 0?t.doubleParameters.roundness:1),this._vignetteColor=new THREE.Color(n.rgbOrHexStringToNumber(t.stringParameters.color||"0;0;0")),this._renderSize=new THREE.Vector2(1,1),this._updateShaderUniforms(),this.shaderPass.enabled=this._effectEnabled}_updateShaderUniforms(){this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.softness.value=this._softness,this.shaderPass.uniforms.roundness.value=this._roundness,this.shaderPass.uniforms.vignetteColor.value.set(this._vignetteColor.r,this._vignetteColor.g,this._vignetteColor.b)}isEnabled(e){return this._isEnabled}setEnabled(e,s){return this._isEnabled===s?!0:s?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof n.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof n.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),this._isEnabled=!1,!0):!1}updatePreRender(e){if(!this._isEnabled||!this._effectEnabled||!(e instanceof n.Layer))return;const s=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer();if(!!s){if(!u(e)){this.shaderPass.enabled=!1;return}s.getDrawingBufferSize(this._renderSize),this.shaderPass.uniforms.resolution.value.set(Math.max(1,this._renderSize.x||e.getWidth()),Math.max(1,this._renderSize.y||e.getHeight())),this._updateShaderUniforms(),this.shaderPass.enabled=!0}}updateDoubleParameter(e,s){e==="intensity"?this._intensity=i(s):e==="softness"?this._softness=o(s):e==="roundness"&&(this._roundness=a(s)),this._updateShaderUniforms()}getDoubleParameter(e){return e==="intensity"?this._intensity:e==="softness"?this._softness:e==="roundness"?this._roundness:0}updateStringParameter(e,s){e==="color"&&(this._vignetteColor.setHex(n.rgbOrHexStringToNumber(s)),this._updateShaderUniforms())}updateColorParameter(e,s){e==="color"&&(this._vignetteColor.setHex(s),this._updateShaderUniforms())}getColorParameter(e){return e==="color"?this._vignetteColor.getHex():0}updateBooleanParameter(e,s){e==="enabled"&&(this._effectEnabled=s,this.shaderPass.enabled=s)}getNetworkSyncData(){return{i:this._intensity,s:this._softness,r:this._roundness,c:this._vignetteColor.getHex(),e:this._effectEnabled}}updateFromNetworkSyncData(e){this._intensity=i(e.i),this._softness=o(e.s),this._roundness=a(e.r),this._vignetteColor.setHex(e.c),this._effectEnabled=!!e.e,this._updateShaderUniforms(),this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=VignetteEffect.js.map
