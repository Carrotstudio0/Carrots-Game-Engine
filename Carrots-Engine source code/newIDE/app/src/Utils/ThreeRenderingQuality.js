// @flow
import * as THREE from 'three';

const getToneMappingConstant = (toneMappingName?: string): number => {
  const threeWithToneMapping = (THREE: any);
  if (
    toneMappingName === 'Neutral' &&
    typeof threeWithToneMapping.NeutralToneMapping === 'number'
  ) {
    return threeWithToneMapping.NeutralToneMapping;
  }
  if (
    toneMappingName === 'ACESFilmic' &&
    typeof threeWithToneMapping.ACESFilmicToneMapping === 'number'
  ) {
    return threeWithToneMapping.ACESFilmicToneMapping;
  }
  if (typeof threeWithToneMapping.AgXToneMapping === 'number') {
    return threeWithToneMapping.AgXToneMapping;
  }
  return threeWithToneMapping.ACESFilmicToneMapping;
};

const disposeMaterial = (material: THREE.Material | Array<THREE.Material>) => {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  material.dispose();
};

const disposeObjectResources = (object: THREE.Object3D) => {
  object.traverse(child => {
    const childWithResources = ((child: any): {
      geometry?: THREE.BufferGeometry,
      material?: THREE.Material | Array<THREE.Material>,
    });
    if (childWithResources.geometry) {
      childWithResources.geometry.dispose();
    }
    if (childWithResources.material) {
      disposeMaterial(childWithResources.material);
    }
  });
};

const createLightCard = (
  width: number,
  height: number,
  color: THREE.Color,
  position: [number, number, number],
  lookAtTarget: [number, number, number]
): THREE.Mesh => {
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    })
  );
  card.position.set(position[0], position[1], position[2]);
  card.lookAt(lookAtTarget[0], lookAtTarget[1], lookAtTarget[2]);
  return card;
};

export const configureThreeRendererQuality = (
  renderer: THREE.WebGLRenderer,
  options?: {|
    toneMapping?: 'AgX' | 'Neutral' | 'ACESFilmic',
    exposure?: number,
    enableShadows?: boolean,
  |}
) => {
  const rendererWithCompatibility = ((renderer: any): {
    outputColorSpace?: mixed,
    toneMapping?: mixed,
    toneMappingExposure?: mixed,
    shadowMap?: {
      enabled?: boolean,
      type?: mixed,
    },
  });
  if ('outputColorSpace' in rendererWithCompatibility) {
    rendererWithCompatibility.outputColorSpace = (THREE: any).SRGBColorSpace;
  }
  if (typeof rendererWithCompatibility.toneMapping === 'number') {
    rendererWithCompatibility.toneMapping = getToneMappingConstant(
      options?.toneMapping || 'AgX'
    );
  }
  if (typeof rendererWithCompatibility.toneMappingExposure === 'number') {
    rendererWithCompatibility.toneMappingExposure = Math.max(
      0,
      options?.exposure !== undefined ? options.exposure : 1
    );
  }
  if (rendererWithCompatibility.shadowMap && options?.enableShadows !== false) {
    rendererWithCompatibility.shadowMap.enabled = true;
    rendererWithCompatibility.shadowMap.type = (THREE: any).PCFShadowMap;
  }
};

export const createStudioLightingRig = (): THREE.Group => {
  const rig = new THREE.Group();

  const hemisphereLight = new THREE.HemisphereLight(0xfaf6ff, 0x243042, 1.15);
  hemisphereLight.position.set(0, 3, 0);
  rig.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.35);
  keyLight.position.set(4.5, 6.5, 5.5);
  rig.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbfd7ff, 0.9);
  fillLight.position.set(-5.5, 3.2, 4.5);
  rig.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xe8f2ff, 0.72);
  rimLight.position.set(-3.5, 4.5, -6.5);
  rig.add(rimLight);

  return rig;
};

export const createStudioEnvironmentRenderTarget = (
  renderer: THREE.WebGLRenderer,
  baseColor?: ?THREE.Color
): THREE.WebGLRenderTarget | null => {
  if (!renderer) {
    return null;
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentScene = new THREE.Scene();
  const skyColor = baseColor
    ? baseColor.clone()
    : new THREE.Color(0xa6b8cf);
  const shellColor = skyColor.clone().multiplyScalar(0.26);
  const floorColor = skyColor
    .clone()
    .multiplyScalar(0.18)
    .lerp(new THREE.Color(0x3c3530), 0.45);
  environmentScene.background = skyColor.clone().multiplyScalar(0.95);

  const environmentObjects = [];
  const addEnvironmentObject = (object: THREE.Object3D) => {
    environmentScene.add(object);
    environmentObjects.push(object);
  };

  addEnvironmentObject(
    new THREE.Mesh(
      new THREE.SphereGeometry(20, 32, 16),
      new THREE.MeshBasicMaterial({
        color: shellColor,
        side: THREE.BackSide,
      })
    )
  );

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(13, 48),
    new THREE.MeshBasicMaterial({
      color: floorColor,
      side: THREE.DoubleSide,
    })
  );
  floor.position.y = -4.2;
  floor.rotation.x = -Math.PI / 2;
  addEnvironmentObject(floor);

  addEnvironmentObject(
    createLightCard(
      7.5,
      7.5,
      new THREE.Color(8.2, 7.7, 7.1),
      [5.5, 4.8, 7.5],
      [0, 0.5, 0]
    )
  );
  addEnvironmentObject(
    createLightCard(
      5.5,
      5.5,
      new THREE.Color(2.8, 3.4, 4.2),
      [-6.5, 2.6, 4.5],
      [0, 0.2, 0]
    )
  );
  addEnvironmentObject(
    createLightCard(
      6.5,
      4.5,
      new THREE.Color(1.8, 2.2, 2.8),
      [-3.8, 5.6, -7.6],
      [0, 0.4, 0]
    )
  );

  try {
    return pmremGenerator.fromScene(environmentScene, 0.04, 0.1, 60);
  } finally {
    environmentObjects.forEach(disposeObjectResources);
    pmremGenerator.dispose();
  }
};
