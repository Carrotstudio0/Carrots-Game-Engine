namespace gdjs {
  type ThreeRendererWithNodeLibrary =
    | THREE.WebGLRenderer
    | (Record<string, any> & {
        isWebGPURenderer?: boolean;
        library?: {
          fromMaterial?: (material: THREE.Material) => THREE.Material | null;
        };
      })
    | null;

  type ThreeShadowMapType =
    | typeof THREE.BasicShadowMap
    | typeof THREE.PCFShadowMap
    | typeof THREE.PCFSoftShadowMap
    | typeof THREE.VSMShadowMap;

  type ThreeNodeMaterialCompat = THREE.Material & {
    isNodeMaterial?: boolean;
    isMeshBasicNodeMaterial?: boolean;
    colorNode?: any;
    emissiveNode?: any;
    vertexNode?: any;
    side?: number;
    depthWrite?: boolean;
    depthTest?: boolean;
    toneMapped?: boolean;
    fog?: boolean;
    transparent?: boolean;
    needsUpdate?: boolean;
    userData: {
      [key: string]: any;
    };
    clone?: () => THREE.Material;
  };

  type RimLightTslParams = {
    colorHex: number;
    intensity: number;
    outerWrap: number;
    power: number;
    fresnel0: number;
    shadowStrength?: number;
    debugForceMaxRim?: boolean;
  };

  type SkyTslParams = {
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
    sunIntensity: number;
    sunElevation: number;
    sunAzimuth: number;
    exposure: number;
    skyTintColorHex: number;
    sunColorHex: number;
    cloudCoverage: number;
    cloudOpacity: number;
    cloudScale: number;
    cloudSoftness: number;
    cloudSpeed: number;
    cloudColorHex: number;
  };

  const rimLightTslStateKey = '__gdScene3dTslRimLightState';
  const skyTslStateKey = '__gdScene3dTslSkyState';

  const getThreeTslApi = (): any | null => {
    if (!gdjs.hasThreeTslBundleSupport()) {
      return null;
    }

    return typeof THREE_TSL !== 'undefined' ? (THREE_TSL as any) : null;
  };

  const getThreeWebGpuApi = (): any | null => {
    if (!gdjs.hasThreeWebGpuBundleSupport()) {
      return null;
    }

    return typeof THREE_WEBGPU !== 'undefined' ? (THREE_WEBGPU as any) : null;
  };

  const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

  const buildSunPosition = (
    elevationDeg: number,
    azimuthDeg: number
  ): THREE.Vector3 => {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    return new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(phi)
    ).multiplyScalar(450000);
  };

  export const supportsThreeTslSceneEffects = (
    renderer: ThreeRendererWithNodeLibrary
  ): boolean => {
    const webGpuApi = getThreeWebGpuApi();
    return (
      gdjs.canUseThreeTslNodeMaterials(renderer) &&
      !!webGpuApi &&
      typeof webGpuApi.NodeMaterial === 'function'
    );
  };

  export const getPreferredThreeShadowMapType = (
    renderer: ThreeRendererWithNodeLibrary,
    lightKind: 'directional' | 'spot' | 'point' | 'generic' = 'generic'
  ): ThreeShadowMapType => {
    if (
      lightKind !== 'point' &&
      gdjs.supportsThreeTslSceneEffects(renderer) &&
      typeof (THREE as any).VSMShadowMap === 'number'
    ) {
      return THREE.VSMShadowMap;
    }

    return THREE.PCFShadowMap;
  };

  export const createThreeTslRimLightMaterial = (
    renderer: ThreeRendererWithNodeLibrary,
    sourceMaterial: THREE.Material,
    params: RimLightTslParams
  ): ThreeNodeMaterialCompat | null => {
    if (!gdjs.supportsThreeTslSceneEffects(renderer) || !sourceMaterial) {
      return null;
    }

    const tsl = getThreeTslApi();
    if (!tsl) {
      return null;
    }

    let nodeMaterial: ThreeNodeMaterialCompat | null = null;
    const materialWithClone = sourceMaterial as ThreeNodeMaterialCompat;
    const rendererWithNodeLibrary = renderer as
      | (Record<string, any> & {
          library?: {
            fromMaterial?: (material: THREE.Material) => THREE.Material | null;
          };
        })
      | null;
    if (
      materialWithClone.isNodeMaterial &&
      typeof materialWithClone.clone === 'function'
    ) {
      nodeMaterial = materialWithClone.clone() as ThreeNodeMaterialCompat;
    } else if (rendererWithNodeLibrary?.library?.fromMaterial) {
      nodeMaterial = rendererWithNodeLibrary.library.fromMaterial(
        sourceMaterial
      ) as ThreeNodeMaterialCompat | null;
    }

    if (!nodeMaterial) {
      return null;
    }

    const rimColor = tsl.uniform(new THREE.Color(params.colorHex));
    const rimIntensity = tsl.uniform(0);
    const rimOuterWrap = tsl.uniform(clamp01(params.outerWrap));
    const rimPower = tsl.uniform(Math.max(0.05, params.power));
    const rimFresnel0 = tsl.uniform(clamp01(params.fresnel0));

    const baseColorNode = nodeMaterial.colorNode || tsl.materialColor;
    const baseEmissiveNode = nodeMaterial.emissiveNode || tsl.materialEmissive;

    const one = tsl.float(1.0);
    const zero = tsl.float(0.0);
    const worldNormal = tsl.normalize(tsl.normalWorld);
    const viewDirection = tsl.normalize(tsl.cameraPosition.sub(tsl.positionWorld));
    const ndv = tsl.clamp(tsl.dot(worldNormal, viewDirection), 0.0, 1.0);
    const oneMinusNdv = one.sub(ndv);
    const rimCore = tsl.pow(
      tsl.max(oneMinusNdv, zero),
      tsl.max(rimPower, tsl.float(0.05))
    );
    const wrapped = tsl.clamp(
      oneMinusNdv.add(tsl.clamp(rimOuterWrap, 0.0, 1.0).mul(0.5)),
      0.0,
      1.0
    );
    const rimEnvelope = tsl.smoothstep(0.0, 1.0, wrapped);
    const fresnel = rimFresnel0.add(
      one.sub(rimFresnel0).mul(tsl.pow(one.sub(ndv), 5.0))
    );
    const rimStrength = tsl.clamp(
      rimCore.mul(rimEnvelope).mul(fresnel),
      0.0,
      1.0
    );
    const rimContribution = rimColor.mul(rimIntensity).mul(rimStrength);

    if (nodeMaterial.isMeshBasicNodeMaterial) {
      nodeMaterial.colorNode = baseColorNode.add(rimContribution);
    } else if ('emissiveNode' in nodeMaterial) {
      nodeMaterial.emissiveNode = baseEmissiveNode.add(rimContribution);
    } else {
      nodeMaterial.colorNode = baseColorNode.add(rimContribution);
    }

    nodeMaterial.userData[rimLightTslStateKey] = {
      rimColor,
      rimIntensity,
      rimOuterWrap,
      rimPower,
      rimFresnel0,
    };
    nodeMaterial.needsUpdate = true;

    gdjs.updateThreeTslRimLightMaterial(nodeMaterial, params);

    return nodeMaterial;
  };

  export const updateThreeTslRimLightMaterial = (
    material: THREE.Material,
    params: RimLightTslParams
  ): boolean => {
    const state = (material as ThreeNodeMaterialCompat).userData?.[
      rimLightTslStateKey
    ];
    if (!state) {
      return false;
    }

    state.rimColor.value.setHex(params.colorHex);
    state.rimIntensity.value = params.debugForceMaxRim
      ? 1.0
      : Math.max(
          0,
          params.intensity * clamp01(params.shadowStrength === undefined ? 1 : params.shadowStrength)
        );
    state.rimOuterWrap.value = clamp01(params.outerWrap);
    state.rimPower.value = Math.max(0.05, params.power);
    state.rimFresnel0.value = clamp01(params.fresnel0);

    return true;
  };

  export const createThreeTslSkyMaterial = (): ThreeNodeMaterialCompat | null => {
    const tsl = getThreeTslApi();
    const webGpuApi = getThreeWebGpuApi();
    if (!tsl || !webGpuApi || typeof webGpuApi.NodeMaterial !== 'function') {
      return null;
    }

    const material = new webGpuApi.NodeMaterial() as ThreeNodeMaterialCompat;

    const turbidity = tsl.uniform(4.2);
    const rayleigh = tsl.uniform(1.35);
    const mieCoefficient = tsl.uniform(0.009);
    const mieDirectionalG = tsl.uniform(0.92);
    const sunPosition = tsl.uniform(new THREE.Vector3(0, 0, 1));
    const upUniform = tsl.uniform(new THREE.Vector3(0, 0, 1));
    const exposure = tsl.uniform(0.68);
    const sunIntensity = tsl.uniform(1.35);
    const skyTintColor = tsl.uniform(new THREE.Color(0xfffefa));
    const sunColor = tsl.uniform(new THREE.Color(0xfffaeb));
    const cloudCoverage = tsl.uniform(0.44);
    const cloudOpacity = tsl.uniform(0.46);
    const cloudScale = tsl.uniform(1.35);
    const cloudSoftness = tsl.uniform(0.2);
    const cloudSpeed = tsl.uniform(0);
    const cloudColor = tsl.uniform(new THREE.Color(0xf4f6fa));

    const vSunDirection = tsl.varyingProperty('vec3');
    const vSunE = tsl.varyingProperty('float');
    const vBetaR = tsl.varyingProperty('vec3');
    const vBetaM = tsl.varyingProperty('vec3');

    material.vertexNode = tsl.Fn(() => {
      const e = tsl.float(2.7182818284590452);
      const totalRayleigh = tsl.vec3(
        5.804542996261093e-6,
        1.3562911419845635e-5,
        3.0265902468824876e-5
      );
      const mieConst = tsl.vec3(
        1.8399918514433978e14,
        2.7798023919660528e14,
        4.0790479543861094e14
      );
      const cutoffAngle = tsl.float(1.6110731556870734);
      const steepness = tsl.float(1.5);
      const EE = tsl.float(1000.0);

      const normalizedSun = tsl.normalize(sunPosition);
      vSunDirection.assign(normalizedSun);

      const zenithAngleCos = tsl.clamp(tsl.dot(normalizedSun, upUniform), -1, 1);
      const sunEnergy = EE.mul(
        tsl.max(
          0.0,
          tsl.float(1.0).sub(
            tsl.pow(
              e,
              cutoffAngle.sub(tsl.acos(zenithAngleCos)).div(steepness).negate()
            )
          )
        )
      );
      vSunE.assign(sunEnergy);

      const sunFade = tsl.float(1.0).sub(
        tsl.clamp(
          tsl.float(1.0).sub(tsl.exp(sunPosition.z.div(450000.0))),
          0,
          1
        )
      );

      const rayleighCoefficient = tsl.max(
        0.0,
        rayleigh.sub(tsl.float(1.0).mul(tsl.float(1.0).sub(sunFade)))
      );
      vBetaR.assign(totalRayleigh.mul(rayleighCoefficient));

      const totalMie = tsl.float(0.434)
        .mul(tsl.float(0.2).mul(turbidity).mul(10e-18))
        .mul(mieConst);
      vBetaM.assign(totalMie.mul(tsl.max(0.0, mieCoefficient)));

      const position = tsl.modelViewProjection;
      position.z.assign(position.w);
      return position;
    })();

    material.colorNode = tsl.Fn(() => {
      const pi = tsl.float(Math.PI);
      const rayleighZenithLength = tsl.float(8.4e3);
      const mieZenithLength = tsl.float(1.25e3);
      const sunAngularDiameterCos = tsl.float(0.9999566769464484);
      const THREE_OVER_SIXTEENPI = tsl.float(0.05968310365946075);
      const ONE_OVER_FOURPI = tsl.float(0.07957747154594767);

      const direction = tsl.normalize(tsl.positionWorld.sub(tsl.cameraPosition));

      const zenithAngle = tsl.acos(
        tsl.max(0.0, tsl.dot(upUniform, direction))
      );
      const inverse = tsl.float(1.0).div(
        tsl.cos(zenithAngle).add(
          tsl.float(0.15).mul(
            tsl.pow(
              tsl.float(93.885).sub(zenithAngle.mul(180.0).div(pi)),
              -1.253
            )
          )
        )
      );
      const sR = rayleighZenithLength.mul(inverse);
      const sM = mieZenithLength.mul(inverse);
      const Fex = tsl.exp(vBetaR.mul(sR).add(vBetaM.mul(sM)).negate());

      const cosTheta = tsl.dot(direction, vSunDirection);
      const rPhase = THREE_OVER_SIXTEENPI.mul(
        tsl.float(1.0).add(tsl.pow(cosTheta.mul(0.5).add(0.5), 2.0))
      );
      const betaRTheta = vBetaR.mul(rPhase);

      const g2 = tsl.pow(mieDirectionalG, 2.0);
      const mPhase = ONE_OVER_FOURPI.mul(tsl.float(1.0).sub(g2)).mul(
        tsl.float(1.0).div(
          tsl.pow(
            tsl.float(1.0)
              .sub(tsl.float(2.0).mul(mieDirectionalG).mul(cosTheta))
              .add(g2),
            1.5
          )
        )
      );
      const betaMTheta = vBetaM.mul(mPhase);
      const scattering = betaRTheta
        .add(betaMTheta)
        .div(tsl.max(vBetaR.add(vBetaM), tsl.vec3(0.0001)));

      const Lin = tsl
        .pow(vSunE.mul(scattering).mul(tsl.float(1.0).sub(Fex)), tsl.vec3(1.5))
        .toVar();
      Lin.mulAssign(
        tsl.mix(
          tsl.vec3(1.0),
          tsl.pow(vSunE.mul(scattering).mul(Fex), tsl.vec3(0.5)),
          tsl.clamp(
            tsl.pow(tsl.float(1.0).sub(tsl.dot(upUniform, vSunDirection)), 5.0),
            0.0,
            1.0
          )
        )
      );

      const skyBase = Lin.mul(0.04)
        .add(tsl.vec3(0.00002, 0.00028, 0.00055))
        .mul(skyTintColor);
      const nightBase = tsl.vec3(0.1).mul(Fex);
      const sundisk = tsl.smoothstep(
        sunAngularDiameterCos,
        sunAngularDiameterCos.add(0.00002),
        cosTheta
      );
      const sunDiskColor = sunColor.mul(
        vSunE
          .mul(18000.0)
          .mul(Fex)
          .mul(sundisk)
          .mul(tsl.max(0.0, tsl.float(0.35).add(sunIntensity)))
      );

      const hash = tsl.Fn(([p]: [any]) => {
        return tsl.fract(
          tsl.sin(tsl.dot(p, tsl.vec2(127.1, 311.7))).mul(43758.5453123)
        );
      });

      const noise = tsl.Fn(([pInput]: [any]) => {
        const p = tsl.vec2(pInput).toVar();
        const i = tsl.floor(p);
        const f = tsl.fract(p);
        const u = f.mul(f).mul(tsl.float(3.0).sub(f.mul(2.0)));

        const a = hash(i);
        const b = hash(i.add(tsl.vec2(1.0, 0.0)));
        const c = hash(i.add(tsl.vec2(0.0, 1.0)));
        const d = hash(i.add(tsl.vec2(1.0, 1.0)));

        return tsl.mix(tsl.mix(a, b, u.x), tsl.mix(c, d, u.x), u.y);
      });

      const fbm = tsl.Fn(([pInput]: [any]) => {
        const p = tsl.vec2(pInput).toVar();
        const sum = tsl.float(0.0).toVar();
        const amplitude = tsl.float(0.5).toVar();

        tsl.Loop(5, () => {
          sum.addAssign(amplitude.mul(noise(p)));
          p.assign(p.mul(2.02).add(tsl.vec2(11.5, 17.3)));
          amplitude.mulAssign(0.5);
        });

        return sum;
      });

      const texColor = skyBase.add(nightBase).add(sunDiskColor).toVar();
      const cloudUv = direction.xy
        .div(tsl.max(direction.z.add(0.22), 0.04))
        .mul(tsl.max(0.1, cloudScale))
        .add(
          tsl.vec2(
            tsl.time.mul(cloudSpeed).mul(0.045),
            tsl.time.mul(cloudSpeed).mul(0.006)
          )
        );

      const noisePrimary = fbm(cloudUv.mul(0.65));
      const noiseDetail = fbm(cloudUv.mul(1.9).add(tsl.vec2(17.0, 5.0)));
      const cloudNoise = tsl.mix(noisePrimary, noiseDetail, 0.35);
      const threshold = tsl.mix(
        tsl.float(0.92),
        tsl.float(0.34),
        tsl.clamp(cloudCoverage, 0.0, 1.0)
      );
      const softness = tsl.max(0.02, cloudSoftness.mul(0.25).add(0.02));
      const cloudMask = tsl.smoothstep(
        threshold.sub(softness),
        threshold.add(softness),
        cloudNoise
      );
      const cloudSkyVisibility = tsl.smoothstep(-0.08, 0.35, direction.z);
      const cloudBlend = tsl.clamp(
        cloudMask.mul(cloudOpacity).mul(cloudSkyVisibility),
        0.0,
        1.0
      );

      const sunScatter = tsl.pow(
        tsl.max(tsl.dot(direction, vSunDirection), 0.0),
        18.0
      );
      const cloudBaseColor = cloudColor.mul(
        tsl.float(0.78).add(
          tsl.float(0.22).mul(
            tsl.clamp(direction.z.mul(0.8).add(0.2), 0.0, 1.0)
          )
        )
      );
      const cloudLitColor = cloudBaseColor.add(
        sunColor.mul(
          tsl.float(0.18).mul(sunScatter).mul(tsl.float(0.4).add(sunIntensity))
        )
      );

      texColor.assign(tsl.mix(texColor, cloudLitColor, cloudBlend));
      texColor.mulAssign(tsl.max(0.0, exposure));

      return tsl.vec4(texColor, 1.0);
    })();

    material.side = THREE.BackSide;
    material.depthWrite = false;
    material.depthTest = true;
    material.fog = false;
    material.toneMapped = false;
    material.userData[skyTslStateKey] = {
      turbidity,
      rayleigh,
      mieCoefficient,
      mieDirectionalG,
      sunPosition,
      exposure,
      sunIntensity,
      skyTintColor,
      sunColor,
      cloudCoverage,
      cloudOpacity,
      cloudScale,
      cloudSoftness,
      cloudSpeed,
      cloudColor,
    };

    return material;
  };

  export const updateThreeTslSkyMaterial = (
    material: THREE.Material,
    params: SkyTslParams
  ): boolean => {
    const state = (material as ThreeNodeMaterialCompat).userData?.[skyTslStateKey];
    if (!state) {
      return false;
    }

    state.turbidity.value = Math.max(0, Math.min(20, params.turbidity));
    state.rayleigh.value = Math.max(0, Math.min(6, params.rayleigh));
    state.mieCoefficient.value = Math.max(
      0,
      Math.min(0.1, params.mieCoefficient)
    );
    state.mieDirectionalG.value = Math.max(
      0,
      Math.min(0.999, params.mieDirectionalG)
    );
    state.sunPosition.value.copy(
      buildSunPosition(params.sunElevation, params.sunAzimuth)
    );
    state.exposure.value = Math.max(0, Math.min(2, params.exposure));
    state.sunIntensity.value = Math.max(0, params.sunIntensity);
    state.skyTintColor.value.setHex(params.skyTintColorHex);
    state.sunColor.value.setHex(params.sunColorHex);
    state.cloudCoverage.value = clamp01(params.cloudCoverage);
    state.cloudOpacity.value = clamp01(params.cloudOpacity);
    state.cloudScale.value = Math.max(0.1, Math.min(8, params.cloudScale));
    state.cloudSoftness.value = clamp01(params.cloudSoftness);
    state.cloudSpeed.value = Math.max(0, Math.min(10, params.cloudSpeed));
    state.cloudColor.value.setHex(params.cloudColorHex);

    return true;
  };
}
