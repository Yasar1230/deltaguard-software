import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';

const CAR_LENGTH_M = 4.6;
const CAR_WIDTH_M = 1.9;
const WHEEL_RADIUS_M = 0.34;

/** Maps the simulation's longitudinal x coordinate and lane index into the Three.js world. 1 simulation metre = 1 world unit. */
export function simToWorld(vehicleState) {
  return new THREE.Vector3((vehicleState.lane - 0.5) * 3.6, 0, -vehicleState.position_m);
}

export class World3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a9c4c5');
    this.scene.fog = new THREE.Fog('#a9c4c5', 90, 380);
    this.camera = new THREE.PerspectiveCamera(53, 1, 0.1, 700);
    this.camera.position.set(5, 6, 13);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.baselineEgo = makeCar('#baf0df', '#58ad91');
    this.baselineLead = makeCar('#e7a96d', '#a85e32');
    this.candidateEgo = makeCar('#c9d7ff', '#657fca');
    this.candidateLead = makeCar('#f0ba82', '#b37a43');
    this.ego = this.baselineEgo;
    this.lead = this.baselineLead;
    this.scene.add(this.baselineEgo.group, this.baselineLead.group, this.candidateEgo.group, this.candidateLead.group);
    this.previousEgoPosition = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.createWorld();
    this.resize();
  }

  createWorld() {
    const hemi = new THREE.HemisphereLight('#eef8f3', '#526254', 2.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff0cf', 3.0);
    sun.position.set(-24, 42, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 130;
    sun.shadow.bias = -0.00018;
    this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1800), new THREE.MeshStandardMaterial({ color: '#617760', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.16, -650); ground.receiveShadow = true;
    this.scene.add(ground);
    const markings = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#d6d4c7', roughness: 0.7, emissive: '#30302a', emissiveIntensity: 0.12 });
    const dash = new THREE.BoxGeometry(0.12, 0.018, 5.5);
    const marks = [];
    for (let z = 150; z >= -1390; z -= 11) marks.push(z);
    const matrix = new THREE.Matrix4();
    const roadMat = new THREE.MeshStandardMaterial({ color: '#343c3e', roughness: 0.92 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#c3c0ad', roughness: 0.85 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#77817d', metalness: 0.62, roughness: 0.42 });
    const corridorCenters = [-11.5, 11.5];
    for (const centerX of corridorCenters) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1600), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(centerX, -0.04, -600); road.receiveShadow = true;
      this.scene.add(road);
      for (const offset of [-5.1, 5.1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 1550), white);
        edge.position.set(centerX + offset, 0.005, -600); markings.add(edge);
      }
      const centerDashes = new THREE.InstancedMesh(dash, white, marks.length);
      marks.forEach((z, i) => { matrix.makeTranslation(centerX, 0.006, z); centerDashes.setMatrixAt(i, matrix); });
      centerDashes.instanceMatrix.needsUpdate = true;
      markings.add(centerDashes);
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 1550), curbMat);
        curb.position.set(centerX + side * 5.9, 0.01, -600); curb.receiveShadow = true; this.scene.add(curb);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 1550), railMat);
        rail.position.set(centerX + side * 7.3, 0.72, -600); rail.castShadow = true; this.scene.add(rail);
        const postGeo = new THREE.BoxGeometry(0.12, 0.78, 0.14);
        const posts = new THREE.InstancedMesh(postGeo, railMat, 100);
        for (let i = 0; i < 100; i++) {
          const z = 140 - i * 15.2;
          matrix.makeTranslation(centerX + side * 7.3, 0.36, z); posts.setMatrixAt(i, matrix);
        }
        posts.castShadow = true; this.scene.add(posts);
      }
    }
    this.scene.add(markings);

    this.createScenery(-11.5, -1);
    this.createScenery(11.5, 1);
  }

  createScenery(centerX, outerSide) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#574a39', roughness: 1 });
    const leafMats = ['#49684e', '#58734f', '#687d55'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.0, 7);
    const canopyGeo = new THREE.IcosahedronGeometry(1.45, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 150);
    const canopies = leafMats.map((material, index) => new THREE.InstancedMesh(canopyGeo, material, 50));
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), quat = new THREE.Quaternion();
    let n = 0;
    for (let z = 85; z >= -1390; z -= 20) {
      for (const side of [outerSide]) {
        const x = side * (11 + ((n * 17) % 8));
        position.set(centerX + x, 1.0, z + ((n * 29) % 13)); scale.setScalar(0.8 + ((n * 7) % 5) * 0.12);
        matrix.compose(position, quat, scale); trunks.setMatrixAt(n, matrix);
        position.y = 3.1; scale.setScalar(0.85 + ((n * 11) % 6) * 0.11);
        matrix.compose(position, quat, scale); canopies[n % 3].setMatrixAt(Math.floor(n / 3), matrix);
        n++;
      }
    }
    trunks.count = n; trunks.castShadow = true; trunks.receiveShadow = true; this.scene.add(trunks);
    for (const canopy of canopies) { canopy.count = 50; canopy.castShadow = true; this.scene.add(canopy); }

    if (centerX < 0) {
      const hillMat = new THREE.MeshStandardMaterial({ color: '#84917a', roughness: 1 });
      for (let i = 0; i < 13; i++) {
        const hill = new THREE.Mesh(new THREE.ConeGeometry(24 + (i % 4) * 8, 18 + (i % 5) * 4, 6), hillMat);
        hill.position.set(-250 + i * 42, 4, -310 - (i % 3) * 50); hill.rotation.y = i * 0.63; hill.receiveShadow = true; this.scene.add(hill);
      }
    }
    const lightMat = new THREE.MeshStandardMaterial({ color: '#65736e', metalness: 0.35, roughness: 0.6 });
    const poleGeo = new THREE.CylinderGeometry(0.055, 0.085, 7, 8);
    const poles = new THREE.InstancedMesh(poleGeo, lightMat, 40);
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1, z = 100 - Math.floor(i / 2) * 72;
      matrix.makeTranslation(centerX + side * 9.5, 3.5, z); poles.setMatrixAt(i, matrix);
    }
    this.scene.add(poles);
  }

  renderComparison(baseline, candidate, renderDeltaS = 0.016) {
    const sessions = [
      { ...baseline, car: this.baselineEgo, targetCar: this.baselineLead, trackCenterX: -11.5 },
      { ...candidate, car: this.candidateEgo, targetCar: this.candidateLead, trackCenterX: 11.5 },
    ];
    let centerZ = 0;
    for (const session of sessions) {
      const { frame, target, car, trackCenterX, deltaPositionM = 0 } = session;
      const ego = frame.ego;
      const trackX = trackCenterX + (ego.lane - 0.5) * 3.6;
      const egoZ = -ego.position_m;
      centerZ += egoZ / sessions.length;
      car.group.position.set(trackX, 0.02, egoZ);
      car.group.rotation.y = 0;
      this.setBrakeLights(car, ego.acceleration_mps2 < -0.15 || frame.controller.mode === 'AEB');
      this.rotateWheels(car, deltaPositionM / WHEEL_RADIUS_M);
      car.group.visible = true;

      const visualTraffic = session.traffic?.[0];
      const showTarget = visualTraffic && visualTraffic.type !== 'pedestrian';
      if (showTarget) {
        const targetZ = -visualTraffic.position_m;
        const targetX = trackCenterX + (visualTraffic.lane - 0.5) * 3.6;
        session.targetCar.group.position.set(targetX, 0.02, targetZ);
        this.setBrakeLights(session.targetCar, visualTraffic.braking === true);
        session.targetCar.group.visible = true;
      } else session.targetCar.group.visible = false;
    }

    const desiredCamera = new THREE.Vector3(0, 11, centerZ + 33);
    const lookAt = new THREE.Vector3(0, 0.8, centerZ - 15);
    const cameraLerp = 1 - Math.exp(-3.8 * Math.max(0.001, renderDeltaS || 0.016));
    this.camera.position.lerp(desiredCamera, cameraLerp);
    this.camera.lookAt(lookAt);
    this.scene.position.z = 0;
    this.renderer.render(this.scene, this.camera);
    this.previousEgoPosition = baseline.frame.ego.position_m;
  }

  resize() {
    const width = Math.max(1, this.canvas.parentElement.clientWidth);
    const height = Math.max(1, this.canvas.parentElement.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
  }

  rotateWheels(car, amount) { for (const wheel of car.wheels) wheel.rotation.x += amount; }
  setBrakeLights(car, active) {
    const intensity = active ? 2.4 : 0.5;
    car.brakeMaterials.forEach(material => { material.emissiveIntensity = intensity; });
  }
}

function makeCar(bodyColor, trimColor) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: bodyColor, metalness: 0.48, roughness: 0.3, clearcoat: 0.72, clearcoatRoughness: 0.22 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, metalness: 0.28, roughness: 0.43 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#23363b', metalness: 0.25, roughness: 0.14, clearcoat: 0.8, transparent: true, opacity: 0.92 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#202729', metalness: 0.2, roughness: 0.55 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: '#9f201b', emissive: '#ff271a', emissiveIntensity: 0.5, roughness: 0.25 });
  const frontLightMat = new THREE.MeshStandardMaterial({ color: '#fff1d4', emissive: '#ffe1a2', emissiveIntensity: 1.2, roughness: 0.22 });
  const add = (geometry, material, x, y, z, cast = true) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  add(new THREE.BoxGeometry(1.84, 0.44, 4.32), darkMat, 0, 0.53, 0);
  add(new THREE.BoxGeometry(1.9, 0.43, 3.75), bodyMat, 0, 0.78, 0.05);
  add(new THREE.BoxGeometry(1.78, 0.36, 1.18), bodyMat, 0, 0.8, -1.42);
  add(new THREE.BoxGeometry(1.78, 0.34, 0.88), bodyMat, 0, 0.78, 1.45);
  add(new THREE.BoxGeometry(1.54, 0.7, 1.86), bodyMat, 0, 1.28, 0.02);
  add(new THREE.BoxGeometry(1.46, 0.55, 1.72), glassMat, 0, 1.31, 0.02);
  add(new THREE.BoxGeometry(1.55, 0.10, 1.82), trimMat, 0, 1.65, 0.02);
  add(new THREE.BoxGeometry(1.9, 0.18, 0.18), darkMat, 0, 0.53, -2.13);
  add(new THREE.BoxGeometry(1.9, 0.18, 0.18), darkMat, 0, 0.53, 2.13);
  for (const x of [-0.97, 0.97]) {
    add(new THREE.BoxGeometry(0.08, 0.17, 0.36), frontLightMat, x * 0.9, 0.91, -1.77);
    add(new THREE.BoxGeometry(0.07, 0.2, 0.42), brakeMat, x * 0.9, 0.91, 1.8);
    add(new THREE.BoxGeometry(0.12, 0.12, 0.12), darkMat, x * 0.78, 1.73, 0.75);
  }
  const wheels = [];
  for (const x of [-0.91, 0.91]) for (const z of [-1.38, 1.38]) {
    const wheelGroup = new THREE.Group(); wheelGroup.position.set(x, 0.4, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS_M, WHEEL_RADIUS_M, 0.22, 20), darkMat);
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; wheelGroup.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.226, 12), trimMat);
    hub.rotation.z = Math.PI / 2; wheelGroup.add(hub);
    group.add(wheelGroup); wheels.push(wheelGroup);
  }
  group.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return { group, wheels, brakeMaterials: [brakeMat], lengthM: CAR_LENGTH_M, widthM: CAR_WIDTH_M };
}
