var gdjs;(function(r){const o={uniforms:{tDiffuse:{value:null},tSceneColor:{value:null},intensity:{value:.005},radialScale:{value:1}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform sampler2D tSceneColor;
      uniform float intensity;
      uniform float radialScale;
      varying vec2 vUv;

      vec2 clampUv(vec2 uv) {
        return clamp(uv, vec2(0.0), vec2(1.0));
      }

      void main() {
        vec4 baseColor = texture2D(tDiffuse, vUv);
        if (intensity <= 0.0) {
          gl_FragColor = baseColor;
          return;
        }

        vec2 centered = vUv - vec2(0.5);
        float distanceFromCenter = length(centered);
        vec2 direction =
          distanceFromCenter > 0.00001
            ? centered / distanceFromCenter
            : vec2(0.0);

        float edgeFactor = clamp(distanceFromCenter * 1.41421356237, 0.0, 1.0);
        edgeFactor = pow(edgeFactor, max(0.0001, radialScale));
        vec2 channelOffset = direction * intensity * edgeFactor;

        vec2 uvRed = clampUv(vUv + channelOffset);
        vec2 uvBlue = clampUv(vUv - channelOffset);

        vec3 diffuseRed = texture2D(tDiffuse, uvRed).rgb;
        vec3 diffuseCenter = texture2D(tDiffuse, vUv).rgb;
        vec3 diffuseBlue = texture2D(tDiffuse, uvBlue).rgb;

        // Blend in a bit of shared scene capture to keep this pass coherent
        // with the centralized PostProcessingStack capture flow.
        vec3 sceneRed = texture2D(tSceneColor, uvRed).rgb;
        vec3 sceneBlue = texture2D(tSceneColor, uvBlue).rgb;
        float captureMix = 0.18;

        float red = mix(diffuseRed.r, sceneRed.r, captureMix);
        float green = diffuseCenter.g;
        float blue = mix(diffuseBlue.b, sceneBlue.b, captureMix);

        gl_FragColor = vec4(red, green, blue, baseColor.a);
      }
    `};r.PixiFiltersTools.registerFilterCreator("Scene3D::ChromaticAberration",new class{makeFilter(c,d){return typeof THREE=="undefined"?new r.PixiFiltersTools.EmptyFilter:new class{constructor(){this.shaderPass=new THREE_ADDONS.ShaderPass(o),r.markScene3DPostProcessingPass(this.shaderPass,"CHROMA"),this._isEnabled=!1,this._effectEnabled=!0,this._intensity=.005,this._radialScale=1,this.shaderPass.enabled=!0}isEnabled(e){return this._isEnabled}setEnabled(e,t){return this._isEnabled===t?!0:t?this.applyEffect(e):this.removeEffect(e)}applyEffect(e){return e instanceof r.Layer?(e.getRenderer().addPostProcessingPass(this.shaderPass),this._isEnabled=!0,!0):!1}removeEffect(e){return e instanceof r.Layer?(e.getRenderer().removePostProcessingPass(this.shaderPass),this._isEnabled=!1,!0):!1}updatePreRender(e){if(!this._isEnabled||!this._effectEnabled||!(e instanceof r.Layer))return;const a=e.getRuntimeScene().getGame().getRenderer().getThreeRenderer(),s=e.getRenderer(),i=s.getThreeScene(),n=s.getThreeCamera();if(!a||!i||!n)return;if(!r.isScene3DPostProcessingEnabled(e)){this.shaderPass.enabled=!1;return}const l=r.captureScene3DSharedTextures(e,a,i,n);!l||(this.shaderPass.enabled=!0,this.shaderPass.uniforms.tSceneColor.value=l.colorTexture,this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.radialScale.value=this._radialScale)}updateDoubleParameter(e,t){e==="intensity"?(this._intensity=Math.max(0,t),this.shaderPass.uniforms.intensity.value=this._intensity):e==="radialScale"&&(this._radialScale=Math.max(0,t),this.shaderPass.uniforms.radialScale.value=this._radialScale)}getDoubleParameter(e){return e==="intensity"?this._intensity:e==="radialScale"?this._radialScale:0}updateStringParameter(e,t){}updateColorParameter(e,t){}getColorParameter(e){return 0}updateBooleanParameter(e,t){e==="enabled"&&(this._effectEnabled=t,this.shaderPass.enabled=t)}getNetworkSyncData(){return{i:this._intensity,rs:this._radialScale,e:this._effectEnabled}}updateFromNetworkSyncData(e){this._intensity=Math.max(0,e.i),this._radialScale=Math.max(0,e.rs),this._effectEnabled=!!e.e,this.shaderPass.uniforms.intensity.value=this._intensity,this.shaderPass.uniforms.radialScale.value=this._radialScale,this.shaderPass.enabled=this._effectEnabled}}}})})(gdjs||(gdjs={}));
//# sourceMappingURL=ChromaticAberrationEffect.js.map
