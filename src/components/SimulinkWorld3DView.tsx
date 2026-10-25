import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  AdasComparisonRun,
  AdasUpdatePackage,
  AdasTraceFrame,
  sampleTraceAt,
} from '../engine/adasSimEngine';
import { ScenarioComparisonEntry, TelemetryArrays } from '../types/deltaguard';
import { Car, BatteryCharging } from 'lucide-react';

export type CameraPreset = 'chase' | 'top' | 'isometric' | 'side';
export type WorldMode3D = 'adas_track' | 'bms_pack';

interface SimulinkWorld3DViewProps {
  worldMode: WorldMode3D;
  onChangeWorldMode: (mode: WorldMode3D) => void;
  adasRun: AdasComparisonRun;
  baselinePkg: AdasUpdatePackage;
  candidatePkg: AdasUpdatePackage;
  bmsScenarioEntry: ScenarioComparisonEntry;
  playbackTimeS: number;
  onChangePlaybackTimeS: (t: number) => void;
  isPlaying: boolean;
  playbackSpeed: number;
  cameraPreset: CameraPreset;
  isPatchedSafe: boolean;
}

interface VectorVehicleRig {
  group: THREE.Group;
  wheels: THREE.Group[];
  bboxWireframe: THREE.LineSegments;
  bboxMat: THREE.LineBasicMaterial;
  frustumGroup: THREE.Group;
  frustumMeshMat: THREE.MeshBasicMaterial;
  frustumWireMat: THREE.LineBasicMaterial;
  velocityArrow: THREE.ArrowHelper;
  gapRulerLine: THREE.Line;
  gapRulerGeo: THREE.BufferGeometry;
  gapRulerMat: THREE.LineBasicMaterial;
}

interface ThermalBatteryRig {
  group: THREE.Group;
  cellMaterials: THREE.MeshStandardMaterial[];
  contactorArm: THREE.Mesh;
  currentArrows: THREE.ArrowHelper[];
  bboxWireMat: THREE.LineBasicMaterial;
}

const WHEEL_RADIUS_M = 0.34;
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _curLookAt = new THREE.Vector3(0, 1, -18);
const _tempColor = new THREE.Color();
const _projEgo1 = new THREE.Vector3();
const _projEgo2 = new THREE.Vector3();
const _projGap1 = new THREE.Vector3();
const _projGap2 = new THREE.Vector3();

function sampleBmsArraysAt(tel: TelemetryArrays, t: number) {
  const n = tel.t.length;
  if (n === 0) {
    return {
      current_a: 0,
      temp_c: 25,
      soc_pct: 0,
      contactor_state: 0,
    };
  }
  let idx = n - 1;
  for (let i = n - 1; i >= 0; i--) {
    if (tel.t[i] <= t) {
      idx = i;
      break;
    }
  }
  return {
    current_a: tel.current_a[idx] ?? 0,
    temp_c: tel.temp_c[idx] ?? 25,
    soc_pct: tel.soc_pct[idx] ?? 0,
    contactor_state: tel.contactor_state[idx] ?? 0,
  };
}

/**
 * Builds a Foxglove Studio / Vector CANoe technical vehicle rig:
 * - Precision CAD inner chassis + cabin + wheels
 * - 3D wireframe bounding box (EdgesGeometry) around the full 4.5m x 1.92m x 1.48m volume
 * - Forward-facing (-Z) radar frustum pyramid (apex at front bumper z=-2.32m, opening ahead to z=-20.32m)
 * - Forward velocity vector arrow
 * - Inter-vehicle distance ruler line
 */
function createFoxgloveVectorVehicle(
  primaryHex: string,
  wireHex: string,
  isEgo: boolean
): VectorVehicleRig {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: 0.25,
    roughness: 0.45,
    transparent: true,
    opacity: 0.86,
  });

  const cabinMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    metalness: 0.3,
    roughness: 0.25,
    transparent: true,
    opacity: 0.75,
  });

  // 1. Primary technical chassis & cabin silhouette
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.56, 4.46), bodyMat);
  lowerBody.position.y = 0.54;
  group.add(lowerBody);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.2), cabinMat);
  cabin.position.set(0, 1.05, 0.15);
  group.add(cabin);

  // Roof LiDAR / Sensor Puck
  const lidarPuck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.6, roughness: 0.3 })
  );
  lidarPuck.position.set(0, 1.37, 0.1);
  group.add(lidarPuck);

  // 2. 4 Technical Wheels
  const wheelGeo = new THREE.CylinderGeometry(
    WHEEL_RADIUS_M,
    WHEEL_RADIUS_M,
    0.24,
    20
  );
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.8,
  });

  const wheels: THREE.Group[] = [];
  const wheelPositions: Array<[number, number, number]> = [
    [-0.96, WHEEL_RADIUS_M, -1.38],
    [0.96, WHEEL_RADIUS_M, -1.38],
    [-0.96, WHEEL_RADIUS_M, 1.38],
    [0.96, WHEEL_RADIUS_M, 1.38],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.add(new THREE.Mesh(wheelGeo, wheelMat));
    group.add(wg);
    wheels.push(wg);
  }

  // 3. Foxglove 3D Wireframe Bounding Box (4.6m length x 2.0m width x 1.52m height)
  const bboxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.04, 1.52, 4.64));
  const bboxMat = new THREE.LineBasicMaterial({
    color: wireHex,
    transparent: true,
    opacity: 0.95,
  });
  const bboxWireframe = new THREE.LineSegments(bboxGeo, bboxMat);
  bboxWireframe.position.set(0, 0.78, 0);
  group.add(bboxWireframe);

  // 4. Strictly Forward-Facing (-Z) Radar / LiDAR Sensor Frustum Pyramid
  // Apex is at front bumper (0, 0.55, -2.32), expanding forward to z = -20.32m (18m ahead)
  const frustumGroup = new THREE.Group();
  frustumGroup.position.set(0, 0.55, -2.32);

  const frustumLength = 18.0;
  const halfW = 3.2;
  const halfH = 0.95;

  const pyrPositions = new Float32Array([
    0, 0, 0, -halfW, halfH, -frustumLength, halfW, halfH, -frustumLength,
    0, 0, 0, halfW, -halfH, -frustumLength, -halfW, -halfH, -frustumLength,
    0, 0, 0, -halfW, -halfH, -frustumLength, -halfW, halfH, -frustumLength,
    0, 0, 0, halfW, halfH, -frustumLength, halfW, -halfH, -frustumLength,
  ]);
  const pyrGeo = new THREE.BufferGeometry();
  pyrGeo.setAttribute('position', new THREE.BufferAttribute(pyrPositions, 3));

  const frustumMeshMat = new THREE.MeshBasicMaterial({
    color: wireHex,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frustumMesh = new THREE.Mesh(pyrGeo, frustumMeshMat);
  frustumGroup.add(frustumMesh);

  const wirePts: number[] = [
    0, 0, 0, -halfW, halfH, -frustumLength,
    0, 0, 0, halfW, halfH, -frustumLength,
    0, 0, 0, halfW, -halfH, -frustumLength,
    0, 0, 0, -halfW, -halfH, -frustumLength,
  ];
  for (const frac of [0.33, 0.66, 1.0]) {
    const z = -frustumLength * frac;
    const w = halfW * frac;
    const h = halfH * frac;
    wirePts.push(
      -w, h, z, w, h, z,
      w, h, z, w, -h, z,
      w, -h, z, -w, -h, z,
      -w, -h, z, -w, h, z
    );
  }
  const frustumWireGeo = new THREE.BufferGeometry();
  frustumWireGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(wirePts, 3)
  );
  const frustumWireMat = new THREE.LineBasicMaterial({
    color: wireHex,
    transparent: true,
    opacity: 0.65,
  });
  const frustumWire = new THREE.LineSegments(frustumWireGeo, frustumWireMat);
  frustumGroup.add(frustumWire);

  frustumGroup.visible = isEgo;
  group.add(frustumGroup);

  // 5. Forward Velocity Vector Arrow (pointing strictly ahead along -Z)
  const velocityArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1.65, 0),
    6.0,
    new THREE.Color(wireHex).getHex(),
    1.1,
    0.65
  );
  velocityArrow.visible = isEgo;
  group.add(velocityArrow);

  // 6. Inter-Vehicle Distance Ruler Line (world-space line added to scene)
  const gapRulerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.65, 0),
    new THREE.Vector3(0, 0.65, -15),
  ]);
  const gapRulerMat = new THREE.LineBasicMaterial({
    color: wireHex,
    transparent: true,
    opacity: 0.95,
  });
  const gapRulerLine = new THREE.Line(gapRulerGeo, gapRulerMat);
  gapRulerLine.visible = isEgo;

  return {
    group,
    wheels,
    bboxWireframe,
    bboxMat,
    frustumGroup,
    frustumMeshMat,
    frustumWireMat,
    velocityArrow,
    gapRulerLine,
    gapRulerGeo,
    gapRulerMat,
  };
}

/**
 * Builds the 3D Panasonic NCR18650B Cell Thermal Array & Current Vector schematic
 */
function createFoxgloveBatteryArray(accentHex: string): ThermalBatteryRig {
  const group = new THREE.Group();

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.22, 7.6),
    new THREE.MeshStandardMaterial({
      color: '#CBD5E1',
      metalness: 0.25,
      roughness: 0.55,
    })
  );
  tray.position.y = 0.11;
  group.add(tray);

  const bboxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(5.0, 2.35, 7.8));
  const bboxWireMat = new THREE.LineBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.85,
  });
  const bboxSegments = new THREE.LineSegments(bboxGeo, bboxWireMat);
  bboxSegments.position.set(0, 1.18, 0);
  group.add(bboxSegments);

  const cellMaterials: THREE.MeshStandardMaterial[] = [];
  const cellGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.65, 24);
  const capGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
  const capMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    metalness: 0.8,
    roughness: 0.2,
  });

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const cx = (c - 1.5) * 1.02;
      const cz = (r - 2.5) * 1.05;
      const cellMat = new THREE.MeshStandardMaterial({
        color: '#10B981',
        metalness: 0.3,
        roughness: 0.35,
      });
      cellMaterials.push(cellMat);

      const cellMesh = new THREE.Mesh(cellGeo, cellMat);
      cellMesh.position.set(cx, 1.04, cz);
      group.add(cellMesh);

      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(cx, 1.9, cz);
      group.add(capMesh);
    }
  }

  const contactorArm = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.14, 0.32),
    new THREE.MeshStandardMaterial({
      color: accentHex,
      metalness: 0.6,
      roughness: 0.3,
    })
  );
  contactorArm.position.set(0, 2.1, -3.5);
  group.add(contactorArm);

  const currentArrows: THREE.ArrowHelper[] = [];
  for (const xOff of [-1.5, 0, 1.5]) {
    const arr = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(xOff, 2.35, 2.8),
      5.2,
      new THREE.Color(accentHex).getHex(),
      0.85,
      0.48
    );
    group.add(arr);
    currentArrows.push(arr);
  }

  return {
    group,
    cellMaterials,
    contactorArm,
    currentArrows,
    bboxWireMat,
  };
}

export const SimulinkWorld3DView: React.FC<SimulinkWorld3DViewProps> = ({
  worldMode,
  onChangeWorldMode,
  adasRun,
  baselinePkg,
  candidatePkg,
  bmsScenarioEntry,
  playbackTimeS,
  onChangePlaybackTimeS,
  isPlaying,
  playbackSpeed,
  cameraPreset,
  isPatchedSafe,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const v1TagRef = useRef<HTMLDivElement | null>(null);
  const v2TagRef = useRef<HTMLDivElement | null>(null);
  const v1GapTagRef = useRef<HTMLDivElement | null>(null);
  const v2GapTagRef = useRef<HTMLDivElement | null>(null);

  const durationS =
    worldMode === 'adas_track'
      ? adasRun.scenario.duration_s
      : Math.max(
          bmsScenarioEntry.scenario.duration_s,
          bmsScenarioEntry.v1_baseline.summary.charge_time_s,
          bmsScenarioEntry.v2_candidate.summary.charge_time_s,
          60
        );

  const stateRef = useRef({
    worldMode,
    adasRun,
    bmsScenarioEntry,
    playbackTimeS,
    isPlaying,
    playbackSpeed,
    cameraPreset,
    durationS,
    isPatchedSafe,
  });
  stateRef.current = {
    worldMode,
    adasRun,
    bmsScenarioEntry,
    playbackTimeS,
    isPlaying,
    playbackSpeed,
    cameraPreset,
    durationS,
    isPatchedSafe,
  };

  const timeAccumRef = useRef<number>(playbackTimeS);
  useEffect(() => {
    timeAccumRef.current = playbackTimeS;
  }, [playbackTimeS]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F1F5F9');
    scene.fog = new THREE.Fog('#F1F5F9', 95, 240);

    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      500
    );
    camera.position.set(0, 12.5, 16.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#FFFFFF', 1.35);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight('#FFFFFF', 1.45);
    dirLight.position.set(22, 42, 24);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight('#93C5FD', 0.65);
    rimLight.position.set(-20, 18, -30);
    scene.add(rimLight);

    const cadPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 600),
      new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        roughness: 0.95,
        metalness: 0.02,
      })
    );
    cadPlane.rotation.x = -Math.PI / 2;
    cadPlane.position.set(0, -0.02, -160);
    scene.add(cadPlane);

    const majorGrid = new THREE.GridHelper(400, 80, '#94A3B8', '#CBD5E1');
    majorGrid.position.set(0, 0.0, -140);
    scene.add(majorGrid);

    const adasGroup = new THREE.Group();
    scene.add(adasGroup);

    const corridorX: [number, number] = [-5.8, 5.8];

    for (let i = 0; i < 2; i++) {
      const cx = corridorX[i];
      const trackColor = i === 0 ? '#DBEAFE' : '#FEE2E2';
      const borderColor = i === 0 ? '#2563EB' : '#DC2626';

      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 420),
        new THREE.MeshBasicMaterial({
          color: trackColor,
          transparent: true,
          opacity: 0.35,
        })
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(cx, 0.01, -160);
      adasGroup.add(strip);

      for (const edgeX of [cx - 3.4, cx + 3.4]) {
        const edgeMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, 420),
          new THREE.MeshBasicMaterial({
            color: borderColor,
            transparent: true,
            opacity: 0.55,
          })
        );
        edgeMesh.rotation.x = -Math.PI / 2;
        edgeMesh.position.set(edgeX, 0.02, -160);
        adasGroup.add(edgeMesh);
      }

      for (let distM = 0; distM <= 180; distM += 10) {
        const tick = new THREE.Mesh(
          new THREE.PlaneGeometry(6.8, 0.06),
          new THREE.MeshBasicMaterial({
            color: '#94A3B8',
            transparent: true,
            opacity: 0.5,
          })
        );
        tick.rotation.x = -Math.PI / 2;
        tick.position.set(cx, 0.015, -distM);
        adasGroup.add(tick);
      }
    }

    const v1Ego = createFoxgloveVectorVehicle('#2563EB', '#1D4ED8', true);
    const v1Lead = createFoxgloveVectorVehicle('#64748B', '#475569', false);
    const v2Ego = createFoxgloveVectorVehicle('#DC2626', '#B91C1C', true);
    const v2Lead = createFoxgloveVectorVehicle('#64748B', '#475569', false);

    adasGroup.add(v1Ego.group);
    adasGroup.add(v1Lead.group);
    adasGroup.add(v1Ego.gapRulerLine);

    adasGroup.add(v2Ego.group);
    adasGroup.add(v2Lead.group);
    adasGroup.add(v2Ego.gapRulerLine);

    const bmsGroup = new THREE.Group();
    const bmsV1Pack = createFoxgloveBatteryArray('#2563EB');
    bmsV1Pack.group.position.set(-4.6, 0, -6);
    bmsGroup.add(bmsV1Pack.group);

    const bmsV2Pack = createFoxgloveBatteryArray('#DC2626');
    bmsV2Pack.group.position.set(4.6, 0, -6);
    bmsGroup.add(bmsV2Pack.group);

    scene.add(bmsGroup);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let animId = 0;
    let lastTimeMs = performance.now();

    const updateVehicleTransform = (
      egoRig: VectorVehicleRig,
      leadRig: VectorVehicleRig,
      corridorCenterX: number,
      snap: AdasTraceFrame | null,
      isCandidate: boolean,
      patchedSafe: boolean
    ) => {
      if (!snap) return;

      const egoX = corridorCenterX;
      const egoZ = -snap.ego.position_m;
      egoRig.group.position.set(egoX, 0, egoZ);

      const pitchRad = THREE.MathUtils.clamp(
        snap.ego.acceleration_mps2 * 0.004,
        -0.04,
        0.03
      );
      egoRig.group.rotation.x = pitchRad;

      const wheelAngle = snap.ego.position_m / WHEEL_RADIUS_M;
      for (const w of egoRig.wheels) {
        w.rotation.x = -wheelAngle;
      }

      const wireColor = !isCandidate
        ? '#2563EB'
        : patchedSafe
        ? '#059669'
        : snap.ego.collision
        ? '#DC2626'
        : snap.controller.mode === 'AEB'
        ? '#EA580C'
        : '#DC2626';

      egoRig.bboxMat.color.set(wireColor);
      egoRig.frustumMeshMat.color.set(wireColor);
      egoRig.frustumWireMat.color.set(wireColor);
      egoRig.frustumGroup.visible = snap.sensor.valid;

      const arrowLen = Math.max(1.5, (snap.ego.speed_mps / 22.0) * 7.5);
      egoRig.velocityArrow.setLength(arrowLen, 0.95, 0.55);
      egoRig.velocityArrow.setColor(new THREE.Color(wireColor));
      egoRig.velocityArrow.visible = snap.ego.speed_mps > 0.25;

      const leadActor = snap.traffic_state?.[0];
      if (leadActor) {
        leadRig.group.visible = true;
        const laneOffset = (leadActor.lane ?? 0) * 2.4;
        const leadX = corridorCenterX + laneOffset;
        const leadZ = -leadActor.position_m;
        leadRig.group.position.set(leadX, 0, leadZ);

        const gapM = Math.max(0.6, snap.ground_truth_target?.gap_m ?? 18.0);
        const frustumScaleZ = THREE.MathUtils.clamp(gapM / 18.0, 0.08, 1.25);
        egoRig.frustumGroup.scale.set(1, 1, frustumScaleZ);

        const posAttr = egoRig.gapRulerGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        posAttr.setXYZ(0, egoX, 0.65, egoZ - 2.32);
        posAttr.setXYZ(1, leadX, 0.65, leadZ + 2.32);
        posAttr.needsUpdate = true;
        egoRig.gapRulerMat.color.set(wireColor);
        egoRig.gapRulerLine.visible = true;
      } else {
        leadRig.group.visible = false;
        egoRig.frustumGroup.scale.set(1, 1, 1);
        egoRig.gapRulerLine.visible = false;
      }
    };

    const projectToOverlay = (
      worldPos: THREE.Vector3,
      el: HTMLDivElement | null,
      w: number,
      h: number
    ) => {
      if (!el) return;
      const p = worldPos.clone().project(camera);
      if (p.z > 1 || p.z < -1) {
        el.style.opacity = '0';
        return;
      }
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-(p.y * 0.5) + 0.5) * h;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    };

    const animate = (nowMs: number) => {
      animId = requestAnimationFrame(animate);
      const dtReal = Math.min(0.1, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;

      const st = stateRef.current;

      if (st.isPlaying) {
        const rate =
          st.worldMode === 'adas_track'
            ? st.playbackSpeed
            : st.playbackSpeed * (st.durationS / 12.0);
        let nextT = timeAccumRef.current + dtReal * rate;
        if (nextT >= st.durationS) {
          nextT = 0;
        }
        timeAccumRef.current = nextT;
        onChangePlaybackTimeS(nextT);
      }

      const curT = timeAccumRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (st.worldMode === 'adas_track') {
        adasGroup.visible = true;
        bmsGroup.visible = false;

        const bSnap = sampleTraceAt(st.adasRun.baseline, curT);
        const cSnap = sampleTraceAt(st.adasRun.candidate, curT);

        updateVehicleTransform(
          v1Ego,
          v1Lead,
          corridorX[0],
          bSnap,
          false,
          st.isPatchedSafe
        );
        updateVehicleTransform(
          v2Ego,
          v2Lead,
          corridorX[1],
          cSnap,
          true,
          st.isPatchedSafe
        );

        const midEgoZ =
          (-(bSnap?.ego.position_m ?? 0) - (cSnap?.ego.position_m ?? 0)) * 0.5;

        if (st.cameraPreset === 'chase') {
          _desiredCamPos.set(0, 10.5, midEgoZ + 17.5);
          _desiredLookAt.set(0, 0.8, midEgoZ - 14.0);
        } else if (st.cameraPreset === 'top') {
          _desiredCamPos.set(0, 36.0, midEgoZ - 10.0);
          _desiredLookAt.set(0, 0, midEgoZ - 10.5);
        } else if (st.cameraPreset === 'isometric') {
          _desiredCamPos.set(22.0, 17.0, midEgoZ + 12.0);
          _desiredLookAt.set(0, 0.8, midEgoZ - 12.0);
        } else {
          _desiredCamPos.set(24.0, 5.5, midEgoZ - 8.0);
          _desiredLookAt.set(0, 1.0, midEgoZ - 8.0);
        }

        camera.position.lerp(_desiredCamPos, 0.14);
        _curLookAt.lerp(_desiredLookAt, 0.16);
        camera.lookAt(_curLookAt);

        _projEgo1.set(corridorX[0], 2.5, -(bSnap?.ego.position_m ?? 0));
        _projEgo2.set(corridorX[1], 2.5, -(cSnap?.ego.position_m ?? 0));
        projectToOverlay(_projEgo1, v1TagRef.current, w, h);
        projectToOverlay(_projEgo2, v2TagRef.current, w, h);

        const bLeadZ = -(
          bSnap?.traffic_state?.[0]?.position_m ??
          (bSnap?.ego.position_m ?? 0) + 18
        );
        const cLeadZ = -(
          cSnap?.traffic_state?.[0]?.position_m ??
          (cSnap?.ego.position_m ?? 0) + 18
        );
        _projGap1.set(
          corridorX[0],
          1.1,
          (-(bSnap?.ego.position_m ?? 0) + bLeadZ) * 0.5
        );
        _projGap2.set(
          corridorX[1],
          1.1,
          (-(cSnap?.ego.position_m ?? 0) + cLeadZ) * 0.5
        );
        projectToOverlay(_projGap1, v1GapTagRef.current, w, h);
        projectToOverlay(_projGap2, v2GapTagRef.current, w, h);
      } else {
        adasGroup.visible = false;
        bmsGroup.visible = true;

        const v1Tel = st.bmsScenarioEntry.v1_baseline.telemetry;
        const v2Tel = st.bmsScenarioEntry.v2_candidate.telemetry;

        const s1 = sampleBmsArraysAt(v1Tel, curT);
        const s2 = sampleBmsArraysAt(v2Tel, curT);

        const setPackThermalState = (
          rig: ThermalBatteryRig,
          tempC: number,
          currA: number,
          contactorOpen: number,
          isV2: boolean
        ) => {
          if (tempC < 12) {
            _tempColor.set('#0284C7');
          } else if (tempC <= 38) {
            _tempColor.set('#10B981');
          } else if (tempC <= 45.0) {
            _tempColor.set('#F59E0B');
          } else {
            _tempColor.set('#DC2626');
          }

          rig.cellMaterials.forEach((m) => {
            m.color.copy(_tempColor);
          });

          rig.contactorArm.rotation.z = contactorOpen ? 0.48 : 0.0;
          const arrowScale = Math.max(0.2, (currA / 1.625) * 5.2);
          const arrowHex =
            isV2 && !st.isPatchedSafe && (currA > 0.9 || tempC > 45)
              ? '#DC2626'
              : isV2
              ? '#059669'
              : '#2563EB';
          rig.bboxWireMat.color.set(arrowHex);

          rig.currentArrows.forEach((arr) => {
            arr.visible = currA > 0.02 && contactorOpen === 0;
            arr.setLength(arrowScale, 0.85, 0.45);
            arr.setColor(new THREE.Color(arrowHex));
          });
        };

        setPackThermalState(
          bmsV1Pack,
          s1.temp_c,
          s1.current_a,
          s1.contactor_state,
          false
        );
        setPackThermalState(
          bmsV2Pack,
          s2.temp_c,
          s2.current_a,
          s2.contactor_state,
          true
        );

        if (st.cameraPreset === 'top') {
          _desiredCamPos.set(0, 22, -6);
          _desiredLookAt.set(0, 0, -6.1);
        } else if (st.cameraPreset === 'isometric') {
          _desiredCamPos.set(14, 12, 6);
          _desiredLookAt.set(0, 1.0, -6);
        } else {
          _desiredCamPos.set(0, 9.2, 6.8);
          _desiredLookAt.set(0, 1.0, -6);
        }

        camera.position.lerp(_desiredCamPos, 0.14);
        _curLookAt.lerp(_desiredLookAt, 0.16);
        camera.lookAt(_curLookAt);

        _projEgo1.set(-4.6, 3.1, -6);
        _projEgo2.set(4.6, 3.1, -6);
        projectToOverlay(_projEgo1, v1TagRef.current, w, h);
        projectToOverlay(_projEgo2, v2TagRef.current, w, h);

        if (v1GapTagRef.current) v1GapTagRef.current.style.opacity = '0';
        if (v2GapTagRef.current) v2GapTagRef.current.style.opacity = '0';
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [onChangePlaybackTimeS]);

  const clampedTimeS = Math.min(Math.max(playbackTimeS, 0), durationS);
  const bSnap = sampleTraceAt(adasRun.baseline, clampedTimeS);
  const cSnap = sampleTraceAt(adasRun.candidate, clampedTimeS);

  const bmsS1 = sampleBmsArraysAt(
    bmsScenarioEntry.v1_baseline.telemetry,
    clampedTimeS
  );
  const bmsS2 = sampleBmsArraysAt(
    bmsScenarioEntry.v2_candidate.telemetry,
    clampedTimeS
  );

  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-white overflow-hidden select-none">
      {/* PANEL 2 HEADER: Compact Foxglove Title Bar + View Mode Toggle */}
      <div
        data-demo-target="digital-twin-tab"
        className="h-7 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 truncate">
            3D DIGITAL TWIN — VECTOR &amp; BOUNDING-BOX TELEMETRY
          </span>
          <span className="hidden xl:inline font-mono text-[10px] text-slate-500">
            ·{' '}
            {worldMode === 'adas_track'
              ? `${adasRun.scenario.label} (Grid: 10m×10m)`
              : `${bmsScenarioEntry.scenario.id}: ${bmsScenarioEntry.scenario.name}`}
          </span>
        </div>

        {/* View Mode Toggle: [🚗 ADAS Vector View] | [🔋 NCR18650B Cell Thermal Array] */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded border border-slate-300/80 shrink-0">
          <button
            data-demo-target="world-mode-adas"
            onClick={() => onChangeWorldMode('adas_track')}
            className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              worldMode === 'adas_track'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-3 h-3" />
            <span>ADAS Vector View</span>
          </button>

          <button
            data-demo-target="world-mode-bms"
            onClick={() => onChangeWorldMode('bms_pack')}
            className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              worldMode === 'bms_pack'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BatteryCharging className="w-3 h-3" />
            <span>NCR18650B Cell Thermal Array</span>
          </button>
        </div>
      </div>

      {/* Sub-Header Telemetry Comparison Bar (v1.0 Baseline vs v2.0 Candidate) */}
      <div className="h-7 bg-slate-100/90 border-b border-slate-200 px-3 grid grid-cols-2 divide-x divide-slate-200 font-mono text-[10px] tabular-nums shrink-0">
        {/* Left: v1.0 Baseline */}
        <div className="pr-3 flex items-center justify-between">
          <span className="font-bold text-blue-700">
            v1.0 BASELINE (
            {worldMode === 'adas_track'
              ? `TTC≤${baselinePkg.params.aeb_ttc_s.toFixed(1)}s`
              : 'JEITA 0.81A / 45°C'}
            )
          </span>
          {worldMode === 'adas_track' ? (
            <span className="text-slate-700">
              Vel: <strong>{((bSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(1)} km/h</strong> ·
              Gap:{' '}
              <strong className="text-blue-700">
                {(bSnap?.ground_truth_target?.gap_m ?? 0).toFixed(2)}m
              </strong>{' '}
              · Mode: <strong>{bSnap?.controller.mode ?? 'ACC'}</strong>
            </span>
          ) : (
            <span className="text-slate-700">
              I: <strong className="text-blue-700">{bmsS1.current_a.toFixed(3)}A</strong> ·
              T: <strong>{bmsS1.temp_c.toFixed(1)}°C</strong> · SoC:{' '}
              <strong>{bmsS1.soc_pct.toFixed(1)}%</strong>
            </span>
          )}
        </div>

        {/* Right: v2.0 Candidate */}
        <div className="pl-3 flex items-center justify-between">
          <span
            className={`font-bold ${
              isPatchedSafe ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {isPatchedSafe ? 'v2.0.1 PATCHED' : 'v2.0 CANDIDATE'} (
            {worldMode === 'adas_track'
              ? `TTC≤${candidatePkg.params.aeb_ttc_s.toFixed(1)}s`
              : isPatchedSafe
              ? 'JEITA 0.81A Restored'
              : 'No Cold Derate / 50°C'}
            )
          </span>
          {worldMode === 'adas_track' ? (
            <span className="text-slate-700">
              Vel: <strong>{((cSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(1)} km/h</strong> ·
              Gap:{' '}
              <strong className={isPatchedSafe ? 'text-emerald-700' : 'text-red-700'}>
                {(cSnap?.ground_truth_target?.gap_m ?? 0).toFixed(2)}m
              </strong>{' '}
              · Mode: <strong>{cSnap?.controller.mode ?? 'ACC'}</strong>
            </span>
          ) : (
            <span className="text-slate-700">
              I:{' '}
              <strong className={isPatchedSafe ? 'text-emerald-700' : 'text-red-700'}>
                {bmsS2.current_a.toFixed(3)}A
              </strong>{' '}
              · T: <strong>{bmsS2.temp_c.toFixed(1)}°C</strong> · SoC:{' '}
              <strong>{bmsS2.soc_pct.toFixed(1)}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* Main 3D WebGL Canvas + Projected Vector Callout Rulers */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <div ref={mountRef} className="w-full h-full" />

        {/* Projected 3D Bounding-Box Header Tag: Baseline v1.0 */}
        <div
          ref={v1TagRef}
          className="pointer-events-none absolute top-0 left-0 z-10 px-2 py-0.5 rounded bg-blue-950/90 text-white border border-blue-400 font-mono text-[10px] whitespace-nowrap shadow-xs"
        >
          {worldMode === 'adas_track' ? (
            <span>
              <strong>v1.0 Baseline</strong> ·{' '}
              {((bSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(0)} km/h · [
              {bSnap?.controller.mode ?? 'ACC'}]
            </span>
          ) : (
            <span>
              <strong>v1.0 Pack</strong> · {bmsS1.current_a.toFixed(2)}A ·{' '}
              {bmsS1.temp_c.toFixed(1)}°C
            </span>
          )}
        </div>

        {/* Projected 3D Bounding-Box Header Tag: Candidate v2.0 */}
        <div
          ref={v2TagRef}
          className={`pointer-events-none absolute top-0 left-0 z-10 px-2 py-0.5 rounded text-white border font-mono text-[10px] whitespace-nowrap shadow-xs ${
            isPatchedSafe
              ? 'bg-emerald-950/90 border-emerald-400'
              : 'bg-red-950/90 border-red-400'
          }`}
        >
          {worldMode === 'adas_track' ? (
            <span>
              <strong>{isPatchedSafe ? 'v2.0.1 Safe' : 'v2.0 Candidate'}</strong> ·{' '}
              {((cSnap?.ego.speed_mps ?? 0) * 3.6).toFixed(0)} km/h · [
              {cSnap?.controller.mode ?? 'ACC'}]
            </span>
          ) : (
            <span>
              <strong>{isPatchedSafe ? 'v2.0.1 Pack' : 'v2.0 Pack'}</strong> ·{' '}
              {bmsS2.current_a.toFixed(2)}A · {bmsS2.temp_c.toFixed(1)}°C
            </span>
          )}
        </div>

        {/* Projected 3D Distance Ruler Callout: Baseline Gap */}
        <div
          ref={v1GapTagRef}
          className="pointer-events-none absolute top-0 left-0 z-10 px-1.5 py-0.5 rounded bg-white/95 text-blue-800 border border-blue-400 font-mono text-[9.5px] font-bold whitespace-nowrap shadow-2xs"
        >
          Gap: {(bSnap?.ground_truth_target?.gap_m ?? 0).toFixed(1)}m
        </div>

        {/* Projected 3D Distance Ruler Callout: Candidate Gap */}
        <div
          ref={v2GapTagRef}
          className={`pointer-events-none absolute top-0 left-0 z-10 px-1.5 py-0.5 rounded bg-white/95 border font-mono text-[9.5px] font-bold whitespace-nowrap shadow-2xs ${
            isPatchedSafe
              ? 'text-emerald-800 border-emerald-400'
              : 'text-red-700 border-red-400'
          }`}
        >
          Gap: {(cSnap?.ground_truth_target?.gap_m ?? 0).toFixed(1)}m
        </div>

        {/* Subtle Bottom-Left Foxglove Coordinate Legend */}
        <div className="pointer-events-none absolute bottom-2 left-2.5 px-2 py-1 rounded bg-white/85 border border-slate-200 font-mono text-[9.5px] text-slate-600 flex items-center gap-3">
          <span>Frame: base_link (-Z Forward)</span>
          <span>·</span>
          <span>
            {worldMode === 'adas_track'
              ? 'Radar Frustum: 18m Forward Cone | Wireframe BBox'
              : 'Thermal Scale: 0°C Blue ➔ 25°C Green ➔ 47°C Red'}
          </span>
        </div>
      </div>
    </section>
  );
};
