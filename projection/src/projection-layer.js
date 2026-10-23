import * as THREE from 'projection:/assets/vendor/three/three.module.min.js';
import { TransformControls } from 'projection:/assets/vendor/three/TransformControls.js';
import { MeshBVH, StaticGeometryGenerator, acceleratedRaycast } from 'projection:/assets/vendor/three/mesh-bvh.js';
import { evaluateProjection, projectorCornerRays, firstScreenIntersection } from 'projection:/src/optics.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const PALETTE = ['#1766b2', '#188a71', '#8c59c5'];
const numeric = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
const valueAt = (record, paths) => {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], record);
    if (numeric(value) !== null) return value;
  }
  return null;
};
const frameOf = state => (state.projectors || []).map(p => ({ id: p.id, position: [...p.position], yaw: p.yaw || 0, pitch: p.pitch || 0, roll: p.roll || 0, throwRatio: p.throwRatio, shiftX: p.shiftX || 0, shiftY: p.shiftY || 0 }));
const stateKey = frame => JSON.stringify(frame);

/** Adapt sourced catalogue records to the pure optics engine, without guesses. */
export function opticalRecord(instance, profile = {}) {
  const euler = new THREE.Euler((instance.pitch || 0) * RAD, (instance.yaw || 0) * RAD, (instance.roll || 0) * RAD, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(euler);
  const basis = vector => new THREE.Vector3(...vector).applyQuaternion(q).toArray();
  const aspectWidth = valueAt(profile, ['resolution.aspectWidth', 'resolution.width']);
  const aspectHeight = valueAt(profile, ['resolution.aspectHeight', 'resolution.height']);
  const offset = valueAt(profile, ['opticalOffset.normalizedCenterOffsetImageHeights', 'centerOffset']);
  const throwMin = valueAt(profile, ['throwRatio.min', 'throwRatioMin']);
  const throwMax = valueAt(profile, ['throwRatio.max', 'throwRatioMax']);
  const offsetStatus = profile.opticalOffset?.normalizationStatus || profile.offsetEvidence || '';
  const imported = /import/i.test(profile.approvalStatus || profile.verificationStatus || '') || profile.imported === true;
  const provisional = profile.fullVerificationAllowed !== true || profile.provisional === true || /deriv|conflict|approx|customer|candidate/i.test(offsetStatus);
  const horizontalRange = profile.lensShift?.previewAllowedRange?.horizontal;
  const verticalRange = profile.lensShift?.previewAllowedRange?.vertical;
  return {
    id: instance.id,
    modelId: instance.modelId,
    position: [...instance.position],
    forward: basis([0, 0, -1]), right: basis([1, 0, 0]), up: basis([0, 1, 0]),
    throwRatio: numeric(instance.throwRatio) ?? throwMin,
    throwRatioMin: throwMin, throwRatioMax: throwMax,
    aspect: valueAt(profile, ['aspect', 'aspectRatio']) ?? (aspectWidth > 0 && aspectHeight > 0 ? aspectWidth / aspectHeight : null),
    centerOffset: offset,
    // The inverted quaternion already rotates 'up'; never invert offset twice.
    shiftX: numeric(instance.shiftX) ?? 0,
    shiftY: numeric(instance.shiftY) ?? 0,
    shiftXMin: horizontalRange?.[0] ?? 0, shiftXMax: horizontalRange?.[1] ?? 0,
    shiftYMin: verticalRange?.[0] ?? 0, shiftYMax: verticalRange?.[1] ?? 0,
    focusMin: valueAt(profile, ['installation.focusDistanceM.min', 'focusMin']),
    focusMax: valueAt(profile, ['installation.focusDistanceM.max', 'focusMax']),
    brightnessLumens: valueAt(profile, ['brightness.lumens', 'brightnessLumens']),
    brightnessBasis: profile.brightness?.basis ?? profile.brightnessBasis ?? '',
    brightnessMode: profile.brightness?.mode ?? profile.brightnessMode ?? null,
    brightnessEfficiency: valueAt(profile, ['brightness.efficiency', 'brightnessEfficiency']),
    provisional,
    // A disclosed source conflict may still have a deliberate manual-derived
    // preview value. Preserve that warning without pretending it is approval.
    profileStatus: provisional ? imported ? 'imported-provisional' : 'candidate-provisional' : imported ? 'imported' : 'source-supported',
    offsetEvidence: offsetStatus,
    sourceWarnings: [...(profile.planningWarnings || [])],
    clearanceAssessed: Boolean(profile.body?.lensOriginMm),
  };
}

/**
 * onMove persists the supplied instance patch; it does not recalculate optics.
 * This layer schedules drag calculations and completes suggest/undo updates.
 * The owner invokes update() after its own numeric or configuration edits.
 */
export function createProjectionLayer({ viewer, getState, getProfile, onMove = () => {}, onSelect = () => {}, onResult = () => {} }) {
  const context = viewer.context();
  const group = new THREE.Group();
  group.name = 'projection-owned-planning-layer';
  const projectorGroup = new THREE.Group();
  const frustumGroup = new THREE.Group();
  const structureGroup = new THREE.Group();
  const roomGroup = new THREE.Group();
  structureGroup.name = 'schematic-enclosure-pending-step';
  roomGroup.name = 'room-dimensions-guide';
  group.add(projectorGroup, frustumGroup, structureGroup, roomGroup);
  context.scene.add(group);
  const objects = new Map();
  const materialOrigins = new WeakMap();
  const ghosts = new Set();
  const bodyMaterials = new Map();
  const physicalMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x515b67, metalness: 0.6, roughness: 0.55 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x20262d, side: THREE.DoubleSide, roughness: 1, transparent: true, opacity: 0.72 });
  const transform = new TransformControls(context.camera, context.renderer.domElement);
  transform.setSize(0.8);
  transform.setSpace('world');
  const transformHelper = transform.getHelper();
  context.scene.add(transformHelper);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const pointer = new THREE.Vector2();
  const canvas = document.createElement('canvas');
  const mapContext = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  const overlayMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, toneMapped: false });
  let overlay = null;
  let overlaySource = null;
  let physicalMesh = null;
  let physicalKey = '';
  let enclosureKey = '';
  let roomKey = '';
  let syncing = false;
  let dragging = false;
  let applyingHistory = false;
  let destroyed = false;
  let lastResult = null;
  let scheduledFine = null;
  let scheduledCoarse = null;
  let lastPositions = frameOf(getState());
  const undoStack = [];
  let dragStart = null;
  let pointerStart = null;
  let previousControlsEnabled = true;

  function disposeGroup(target, shared = new Set()) {
    for (const child of [...target.children]) {
      child.traverse(object => {
        object.geometry?.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material && !shared.has(material)) material.dispose();
      });
      target.remove(child);
    }
  }

  function remember(frame) {
    if (!frame?.length || (undoStack.length && stateKey(undoStack.at(-1)) === stateKey(frame))) return;
    undoStack.push(frame.map(p => ({ ...p, position: [...p.position] })));
    if (undoStack.length > 35) undoStack.shift();
  }

  function selectedInstance() { return getState().projectors?.find(p => p.id === getState().selectedProjector); }

  function captureOriginal(mesh) {
    let original = materialOrigins.get(mesh);
    if (!original) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const transmissive = materials.length > 0 && materials.every(material => material && (material.transmission > 0.2 || (material.transparent && material.opacity < 0.65)));
      original = { material: mesh.material, glass: transmissive, ghosts: null };
      materialOrigins.set(mesh, original);
    }
    return original;
  }

  function applyGhosting(simulator, enabled) {
    simulator?.traverse(mesh => {
      if (!mesh.isMesh) return;
      const original = captureOriginal(mesh);
      if (original.glass) return;
      if (enabled) {
        if (!original.ghosts) {
          const materials = Array.isArray(original.material) ? original.material : [original.material];
          const clones = materials.map(material => {
            const clone = material.clone();
            clone.transparent = true; clone.opacity = 0.17; clone.depthWrite = false;
            ghosts.add(clone); return clone;
          });
          original.ghosts = Array.isArray(original.material) ? clones : clones[0];
        }
        mesh.material = original.ghosts;
      } else mesh.material = original.material;
    });
  }

  function addBox(target, dimensions, position, material, name) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
    object.position.set(...position); object.name = name;
    target.add(object); return object;
  }

  function buildStructure(state) {
    const key = JSON.stringify([state.enclosure, state.diameter, state.viewableHeight, state.screenBottom]);
    if (key === enclosureKey) { structureGroup.visible = state.showStructure !== false; return; }
    enclosureKey = key;
    disposeGroup(structureGroup, new Set([railMaterial, panelMaterial]));
    const radius = state.diameter / 2;
    const top = state.screenBottom + state.viewableHeight;
    if (state.enclosure !== 'screen-only') {
      const railHeight = top + 0.31;
      // Keep the schematic projector-support frame outside the active curved screen.
      // Its legs are derived from the actual arc endpoints rather than a fixed
      // percentage of radius, which could put them behind/through wide screens.
      const halfArc = Math.min(Math.PI * 0.985, Math.max(0.05, state.horizontalFov * Math.PI / 360));
      const clearance = 0.12;
      const supportRadius = radius + clearance;
      const side = Math.abs(Math.sin(halfArc) * supportRadius);
      const back = -Math.cos(halfArc) * supportRadius;
      // Do not draw temporary vertical support legs in the customer preview.
      // The real support geometry will come from the supplied STEP assemblies.
      addBox(structureGroup, [side * 2, 0.035, 0.035], [0, railHeight, back], railMaterial, 'schematic-rear-cross-rail');
      if (state.enclosure === 'fully-enclosed') {
        const depth = radius * 1.45;
        addBox(structureGroup, [radius * 2.03, 0.025, depth], [0, top + 0.42, -radius + depth / 2], panelMaterial, 'schematic-blackout-roof');
        for (const x of [-radius * 1.015, radius * 1.015]) addBox(structureGroup, [0.025, top + 0.42, radius * 0.7], [x, (top + 0.42) / 2, radius * 0.1], panelMaterial, 'schematic-side-panel');
        const opening = Math.min(0.9, radius);
        const panelWidth = Math.max(0.1, radius - opening / 2);
        for (const sign of [-1, 1]) addBox(structureGroup, [panelWidth, top + 0.42, 0.025], [sign * (opening / 2 + panelWidth / 2), (top + 0.42) / 2, back], panelMaterial, 'schematic-rear-panel-with-access-opening');
      }
    }
    structureGroup.visible = state.showStructure !== false;
    structureGroup.updateMatrixWorld(true);
    physicalKey = '';
  }

  function buildRoomGuide(state) {
    const room = state.room || {};
    roomGroup.visible = room.enabled === true;
    if (!roomGroup.visible) return;
    const dimensions = [numeric(room.width), numeric(room.height), numeric(room.depth)];
    if (dimensions.some(value => value === null || value <= 0)) {
      roomGroup.visible = false;
      return;
    }
    const screenFromLeft=finite(room.screenFromLeft)?room.screenFromLeft:dimensions[0]/2;
    const screenFromFront=finite(room.screenFromFront)?room.screenFromFront:dimensions[2]/2;
    const key = JSON.stringify([...dimensions,screenFromLeft,screenFromFront]);
    if (key === roomKey) return;
    roomKey = key;
    disposeGroup(roomGroup);
    const box = new THREE.BoxGeometry(...dimensions);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x7d94ac, transparent: true, opacity: 0.65, depthWrite: false }));
    outline.position.set(dimensions[0]/2-screenFromLeft,dimensions[1]/2,dimensions[2]/2-screenFromFront);
    outline.name = 'room-boundary-guide-not-surveyed-wall-geometry';
    roomGroup.add(outline);
    // Room dimensions are a fit guide. Only the supplied physical meshes, not
    // this wireframe, participate in the finite-segment obstruction calculation.
  }

  function rebuildOcclusion(state, current) {
    current.scene.updateMatrixWorld(true);
    const meshes = [];
    if (current.simulator) current.simulator.traverse(mesh => {
      if (mesh.isMesh && !captureOriginal(mesh).glass) meshes.push(mesh);
    });
    // Existing frame geometry participates even while hidden in pilot mode.
    current.model?.traverse(mesh => {
      if (mesh.isMesh && mesh !== current.screenMesh && (mesh.material === current.frameMaterial || (Array.isArray(mesh.material) && mesh.material.includes(current.frameMaterial)))) meshes.push(mesh);
    });
    structureGroup.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    const key = meshes.map(mesh => `${mesh.uuid}:${mesh.geometry.uuid}:${mesh.matrixWorld.elements.join(',')}`).join('|');
    if (key === physicalKey) return;
    physicalKey = key;
    physicalMesh?.geometry.dispose();
    physicalMesh = null;
    if (!meshes.length) return;
    // The generator traverses visible meshes. Detached visible clones preserve
    // hidden/ghosted physical structures without changing the displayed model.
    const clones = meshes.map(mesh => {
      const clone = new THREE.Mesh(mesh.geometry, physicalMaterial);
      clone.matrixAutoUpdate = false;
      clone.matrix.copy(mesh.matrixWorld);
      clone.matrixWorld.copy(mesh.matrixWorld);
      clone.visible = true;
      return clone;
    });
    const generator = new StaticGeometryGenerator(clones);
    generator.attributes = ['position']; generator.useGroups = false;
    const geometry = generator.generate();
    geometry.boundsTree = new MeshBVH(geometry, { maxLeafTris: 12 });
    physicalMesh = new THREE.Mesh(geometry, physicalMaterial);
    physicalMesh.raycast = acceleratedRaycast;
    physicalMesh.updateMatrixWorld(true);
  }

  const sourceVector = new THREE.Vector3();
  const directionVector = new THREE.Vector3();
  function obstruction(source, target) {
    if (!physicalMesh) return false;
    sourceVector.fromArray(source);
    directionVector.fromArray(target).sub(sourceVector);
    const length = directionVector.length();
    if (length < 0.00001) return false;
    raycaster.ray.origin.copy(sourceVector);
    raycaster.ray.direction.copy(directionVector).multiplyScalar(1 / length);
    raycaster.near = 0.00001; raycaster.far = Math.max(0, length - 0.00005);
    const hits = raycaster.intersectObject(physicalMesh, false);
    return hits.length ? { blocked: true, distance: hits[0].distance, reason: 'cockpit or physical structure' } : false;
  }

  function bodyFor(instance, profile, index) {
    let object = objects.get(instance.id);
    const bodyKey = JSON.stringify([profile.id || instance.modelId, profile.body]);
    if (object && object.userData.bodyKey !== bodyKey) {
      if (transform.object === object) transform.detach();
      disposeGroup(object); projectorGroup.remove(object); objects.delete(instance.id); object = null;
    }
    if (!object) {
      object = new THREE.Group(); object.name = `projector-${instance.id}`;
      object.userData.projectorId = instance.id; object.userData.bodyKey = bodyKey;
      const width = (numeric(profile.body?.widthMm) ?? 300) / 1000;
      const height = (numeric(profile.body?.heightMm) ?? 120) / 1000;
      const depth = (numeric(profile.body?.depthMm) ?? 240) / 1000;
      const material = new THREE.MeshStandardMaterial({ color: PALETTE[index % PALETTE.length], metalness: 0.15, roughness: 0.55 });
      bodyMaterials.set(instance.id, material);
      // Body is an indicative silhouette until the real body-to-lens datum is known.
      const body = addBox(object, [width, height, depth], [0, 0, depth / 2 + 0.015], material, 'schematic-projector-chassis');
      body.userData.projectorId = instance.id;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.12, width * 0.12, 0.035, 20), new THREE.MeshStandardMaterial({ color: 0x182633, metalness: 0.5, roughness: 0.25 }));
      lens.rotation.x = Math.PI / 2; lens.userData.projectorId = instance.id;
      object.add(lens);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
      dot.renderOrder = 40; object.add(dot);
      projectorGroup.add(object); objects.set(instance.id, object);
    }
    if (!dragging || transform.object !== object) {
      object.position.fromArray(instance.position);
      object.rotation.set((instance.pitch || 0) * RAD, (instance.yaw || 0) * RAD, (instance.roll || 0) * RAD, 'YXZ');
    }
    const selected = instance.id === getState().selectedProjector;
    const bodyMaterial = bodyMaterials.get(instance.id);
    if (bodyMaterial) { bodyMaterial.emissive.set(selected ? 0x16385e : 0x000000); bodyMaterial.emissiveIntensity = selected ? 0.65 : 0; }
    object.updateMatrixWorld(true);
    return object;
  }

  function drawFrusta(records, state, result) {
    disposeGroup(frustumGroup);
    frustumGroup.visible = state.showFrusta !== false;
    if (!frustumGroup.visible) return;
    const screen = { radius: state.diameter / 2, height: state.viewableHeight, bottom: state.screenBottom, arcDegrees: state.horizontalFov };
    records.forEach((record, index) => {
      const rays = projectorCornerRays(record);
      if (rays.length !== 4) return;
      const distance = Math.max(result?.channels[index]?.distanceMax || 0, state.diameter * 0.9);
      const corners = rays.map(ray => {
        const hit = firstScreenIntersection(ray.origin, ray.direction, screen, { maxDistance: state.diameter * 3 });
        return hit?.point ?? ray.origin.map((v, axis) => v + ray.direction[axis] * distance);
      });
      const vertices = [];
      const lines = [];
      for (let i = 0; i < 4; i++) {
        vertices.push(...record.position, ...corners[i], ...corners[(i + 1) % 4]);
        lines.push(...record.position, ...corners[i], ...corners[i], ...corners[(i + 1) % 4]);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const colour = PALETTE[index % PALETTE.length];
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: record.id === state.selectedProjector ? 0.09 : 0.035, side: THREE.DoubleSide, depthWrite: false }));
      frustumGroup.add(mesh);
      const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      frustumGroup.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: record.id === state.selectedProjector ? 0.52 : 0.25, depthWrite: false })));
    });
  }

  function drawCoverage(result, state) {
    const tile = 6;
    canvas.width = result.columns * tile;
    canvas.height = result.rows * tile;
    mapContext.clearRect(0, 0, canvas.width, canvas.height);
    for (const cell of result.cells) {
      const { classification } = cell;
      const shadows = classification === 'shadow' || classification === 'partial-shadow';
      if (state.showCoverage === false && !(state.showShadows !== false && shadows)) continue;
      const x = cell.column * tile;
      const y = (result.rows - cell.row - 1) * tile;
      const planned = cell.projectors.filter(p => p.inFootprint);
      let colour = planned.length > 1 ? '#2cbac0' : planned.length ? PALETTE[planned[0].index % PALETTE.length] : '#a6afb9';
      if (state.showShadows !== false && classification === 'shadow') colour = '#000000';
      if (state.showShadows !== false && classification === 'partial-shadow') colour = '#4b4f54';
      if (classification === 'unassessed') colour = '#a6afb9';
      mapContext.globalAlpha = state.showShadows !== false && classification === 'shadow' ? 1 : shadows && state.showShadows !== false ? 0.88 : 0.62;
      mapContext.fillStyle = colour; mapContext.fillRect(x, y, tile, tile);
      if (shadows && state.showShadows !== false || !planned.length) {
        mapContext.strokeStyle = shadows ? '#553c3c' : '#66707c';
        mapContext.globalAlpha = 0.7; mapContext.lineWidth = 1;
        mapContext.beginPath(); mapContext.moveTo(x, y + tile); mapContext.lineTo(x + tile, y); mapContext.stroke();
      }
    }
    mapContext.globalAlpha = 1;
    texture.needsUpdate = true;
    const current = viewer.context();
    if (overlaySource !== current.screenMesh?.geometry) {
      if (overlay) { group.remove(overlay); overlay.geometry.dispose(); overlay = null; }
      overlaySource = current.screenMesh?.geometry;
      if (overlaySource) {
        current.screenMesh.updateWorldMatrix(true, false);
        const geometry = overlaySource.clone(); geometry.applyMatrix4(current.screenMesh.matrixWorld);
        const points = geometry.getAttribute('position');
        for (let i = 0; i < points.count; i++) {
          const x = points.getX(i), z = points.getZ(i), radius = Math.hypot(x, z);
          if (radius > 0.005) { points.setX(i, x * (radius - 0.003) / radius); points.setZ(i, z * (radius - 0.003) / radius); }
        }
        points.needsUpdate = true;
        overlay = new THREE.Mesh(geometry, overlayMaterial); overlay.name = 'calculated-projection-coverage-overlay';
        overlay.renderOrder = 4; group.add(overlay);
      }
    }
    if (overlay) overlay.visible = state.showCoverage !== false || state.showShadows !== false;
  }

  function select(id, notify = true) {
    const instance = getState().projectors?.find(p => p.id === id);
    const object = objects.get(id);
    syncing = true;
    if (object && instance && !instance.locked && !viewer.context().pilotMode && getState().manualPlacement === true) transform.attach(object);
    else transform.detach();
    syncing = false;
    if (notify && id !== getState().selectedProjector) onSelect(id);
    viewer.context().invalidate();
  }

  function update({ fine = false } = {}) {
    if (destroyed) return null;
    clearTimeout(scheduledFine);
    scheduledFine = null;
    const started = performance.now();
    const state = getState();
    const current = viewer.context();
    const nowFrame = frameOf(state);
    if (!dragging && !applyingHistory && stateKey(nowFrame) !== stateKey(lastPositions)) remember(lastPositions);
    lastPositions = nowFrame;
    syncing = true;
    const activeProjectors = state.layoutReady === true && state.guidedStep >= 3 ? state.projectors : [];
    const ids = new Set(activeProjectors.map(p => p.id));
    for (const [id, object] of objects) if (!ids.has(id)) {
      if (transform.object === object) transform.detach();
      disposeGroup(object); projectorGroup.remove(object); objects.delete(id); bodyMaterials.delete(id);
    }
    const records = activeProjectors.map((instance, index) => {
      const profile = getProfile(instance.modelId) || {};
      bodyFor(instance, profile, index);
      return opticalRecord(instance, profile);
    });
    buildStructure(state);
    buildRoomGuide(state);
    applyGhosting(current.simulator, state.ghostCockpit === true);
    rebuildOcclusion(state, current);
    syncing = false;
    const result = evaluateProjection({
      screen: { radius: state.diameter / 2, height: state.viewableHeight, bottom: state.screenBottom, arcDegrees: state.horizontalFov },
      projectors: records,
      columns: fine ? 128 : 32, rows: fine ? 48 : 16,
      obstruction,
      overlapTarget: state.overlapTarget ?? null,
      material: numeric(state.materialGain) === null ? null : { gain: state.materialGain, diffuse: true },
    });
    result.opticalRecords = records;
    result.cockpitShadowStatus = current.simulator ? result.shadowStatus : 'not-assessed';
    result.structureStatus = 'schematic-pending-step';
    result.clearanceStatus = records.every(p => p.clearanceAssessed) && records.length ? 'partial' : 'not-assessed';
    result.warnings.push('Screen supports and enclosure are schematic pending Simworx STEP assemblies; mounting travel and manufacturing clearances are not validated.');
    if (!current.simulator) result.warnings.push('No cockpit is selected; the frame/structure is assessed but cockpit shadows are not assessed.');
    if (records.some(p => !p.clearanceAssessed)) result.warnings.push('Projector optical origins are positioned explicitly; chassis positions are indicative because lens-to-body datums are unverified.');
    if (state.placementMode === 'mounted') result.warnings.push('Mounted placement is illustrative until approved STEP mounting locations and travel limits are supplied.');
    if (state.placementMode === 'free') result.warnings.push('Free placement uses customer-supplied or unresolved mounting.');
    result.warnings.push(...records.flatMap(p => p.sourceWarnings));
    result.warnings = [...new Set(result.warnings)];
    result.performance = { milliseconds: performance.now() - started, fine, cells: result.cells.length, bvhTriangles: physicalMesh?.geometry.index?.count ? physicalMesh.geometry.index.count / 3 : (physicalMesh?.geometry.attributes.position.count || 0) / 3 };
    result.fullEngineeringVerified = false;
    lastResult = result;
    drawCoverage(result, state);
    if(overlay)overlay.visible = state.layoutReady === true && state.guidedStep >= 3 && (state.showCoverage === true || state.showShadows === true);
    frustumGroup.visible = state.layoutReady === true && state.guidedStep >= 3 && state.showFrusta === true;
    projectorGroup.visible = state.layoutReady === true && state.guidedStep >= 3;
    drawFrusta(records, state, result);
    select(state.selectedProjector, false);
    current.invalidate();
    onResult(result);
    if (!fine && !dragging && state.layoutReady === true) {
      clearTimeout(scheduledFine);
      scheduledFine = setTimeout(() => update({ fine: true }), 180);
    }
    return result;
  }

  function emitTransform(finished) {
    if (syncing || !transform.object) return;
    const object = transform.object;
    const id = object.userData.projectorId;
    const instance = getState().projectors?.find(p => p.id === id);
    if (!instance || instance.locked) return;
    const limits = getState().mountLimits?.[id];
    if (getState().placementMode === 'mounted' && limits?.approved === true) {
      for (const [axis, index] of [['x', 0], ['y', 1], ['z', 2]]) if (limits.min?.[index] !== undefined && limits.max?.[index] !== undefined) object.position[axis] = THREE.MathUtils.clamp(object.position[axis], limits.min[index], limits.max[index]);
    }
    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, 'YXZ');
    onMove(id, { position: object.position.toArray(), yaw: euler.y * DEG, pitch: euler.x * DEG, roll: euler.z * DEG }, finished);
    viewer.context().invalidate();
  }

  function onDragging(event) {
    dragging = event.value;
    if (dragging) {
      clearTimeout(scheduledFine);
      dragStart = frameOf(getState());
      previousControlsEnabled = viewer.context().controls.enabled;
      viewer.context().controls.enabled = false;
    } else {
      viewer.context().controls.enabled = previousControlsEnabled && !viewer.context().pilotMode;
      if (dragStart && stateKey(dragStart) !== stateKey(frameOf(getState()))) remember(dragStart);
      dragStart = null;
      emitTransform(true);
      if (scheduledCoarse !== null) {
        cancelAnimationFrame(scheduledCoarse);
        scheduledCoarse = null;
      }
      clearTimeout(scheduledFine);
      scheduledFine = setTimeout(() => update({ fine: true }), 70);
    }
  }
  function onObjectChange() {
    if (syncing) return;
    // The owner writes the patch immediately. Coalesce high-frequency pointer
    // events into one coarse physical-coverage calculation per rendered frame.
    emitTransform(false);
    if (scheduledCoarse === null) {
      scheduledCoarse = requestAnimationFrame(() => {
        scheduledCoarse = null;
        update();
      });
    }
  }
  const invalidate = () => viewer.context().invalidate();
  transform.addEventListener('dragging-changed', onDragging);
  transform.addEventListener('objectChange', onObjectChange);
  transform.addEventListener('change', invalidate);

  function pointerDown(event) { pointerStart = [event.clientX, event.clientY]; }
  function pointerUp(event) {
    if(getState().manualPlacement !== true || !getState().layoutReady)return;
    if (!pointerStart || dragging || (transform.axis && transform.object) || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) { pointerStart = null; return; }
    pointerStart = null;
    const current = viewer.context();
    const rect = current.renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.near = 0; raycaster.far = Infinity;
    raycaster.setFromCamera(pointer, current.camera);
    const hit = raycaster.intersectObjects([...objects.values()], true)[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.projectorId) object = object.parent;
      if (object) { onSelect(object.userData.projectorId); select(object.userData.projectorId, false); }
    }
  }
  context.renderer.domElement.addEventListener('pointerdown', pointerDown);
  context.renderer.domElement.addEventListener('pointerup', pointerUp);

  function suggestPositions() {
    const state = getState();
    remember(frameOf(state));
    applyingHistory = true;
    const count = state.projectors?.length || 0;
    const radius = state.diameter / 2;
    const lensHeight = state.screenBottom + state.viewableHeight + 0.17;
    (state.projectors || []).forEach((instance, index) => {
      if (instance.locked) return;
      const profile = getProfile(instance.modelId) || {};
      const theta = ((index + 0.5) / count - 0.5) * state.horizontalFov * RAD;
      const target = new THREE.Vector3(radius * Math.sin(theta), state.screenBottom + state.viewableHeight / 2, -radius * Math.cos(theta));
      const ratio = valueAt(profile, ['throwRatio.min', 'throwRatioMin']) ?? numeric(instance.throwRatio);
      const record = opticalRecord({ ...instance, throwRatio: ratio, yaw: 0, pitch: 0, roll: 180 }, profile);
      // A layout cannot be inferred from an unknown lens/offset convention.
      if (!(ratio > 0 && record.aspect > 0) || record.centerOffset === null) return;
      const sectorChordWidth = 2 * radius * Math.sin(state.horizontalFov * RAD / count / 2);
      // A starting distance sized for both vertical image height and the sector
      // chord. This is not a curved-screen optimisation or a coverage guarantee;
      // the ordinary first-hit, obstruction and operating-limit checks still run.
      const distance = Math.max(state.viewableHeight * record.aspect * ratio, sectorChordWidth * ratio) * 1.1;
      const position = [Math.sin(theta) * (radius - distance), lensHeight, -Math.cos(theta) * (radius - distance)];
      const delta = target.clone().sub(new THREE.Vector3(...position));
      const offsetCorrection = Math.atan(record.centerOffset / (ratio * record.aspect));
      const pitch = (Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) + offsetCorrection) * DEG;
      const yaw = Math.atan2(-delta.x, -delta.z) * DEG;
      onMove(instance.id, { position, yaw, pitch, roll: 180, throwRatio: ratio, shiftX: 0, shiftY: 0 }, true);
    });
    applyingHistory = false;
    lastPositions = frameOf(getState());
    update({ fine: true });
  }

  function undo() {
    const frame = undoStack.pop();
    if (!frame) return false;
    applyingHistory = true;
    for (const p of frame) if (getState().projectors?.some(current => current.id === p.id)) {
      const { id, ...patch } = p; onMove(id, patch, true);
    }
    applyingHistory = false;
    lastPositions = frameOf(getState());
    update({ fine: true });
    return true;
  }

  function destroy() {
    destroyed = true;
    clearTimeout(scheduledFine);
    if (scheduledCoarse !== null) cancelAnimationFrame(scheduledCoarse);
    context.renderer.domElement.removeEventListener('pointerdown', pointerDown);
    context.renderer.domElement.removeEventListener('pointerup', pointerUp);
    transform.removeEventListener('dragging-changed', onDragging);
    transform.removeEventListener('objectChange', onObjectChange);
    transform.removeEventListener('change', invalidate);
    transform.detach(); transform.dispose(); context.scene.remove(transformHelper);
    applyGhosting(viewer.context().simulator, false);
    physicalMesh?.geometry.dispose(); physicalMaterial.dispose();
    if (overlay) overlay.geometry.dispose();
    texture.dispose(); overlayMaterial.dispose();
    disposeGroup(projectorGroup); disposeGroup(frustumGroup);
    disposeGroup(roomGroup);
    disposeGroup(structureGroup, new Set([railMaterial, panelMaterial]));
    railMaterial.dispose(); panelMaterial.dispose();
    for (const material of ghosts) material.dispose();
    context.scene.remove(group);
    viewer.context().invalidate();
  }

  function planningContext(candidate) {
    clearTimeout(scheduledFine);scheduledFine=null;
    if(candidate){viewer.update(candidate);buildStructure(candidate);rebuildOcclusion(candidate,viewer.context());}
    const simulator=viewer.context().simulator,box=simulator?new THREE.Box3().setFromObject(simulator):null;
    return {obstruction,makeRecord:p=>opticalRecord(p,getProfile(p.modelId)||{}),cockpitBounds:box?{min:box.min.toArray(),max:box.max.toArray()}:null};
  }
  return {
    update, select, planningContext, testObstruction:obstruction,
    setTransformMode: mode => { transform.setMode(mode === 'rotate' ? 'rotate' : 'translate'); transform.setSpace(mode === 'rotate' ? 'local' : 'world'); transform.showX=true;transform.showY=true;transform.showZ=true;invalidate(); },
    setManualConstraint: mode => {
      if(mode==='tilt'){transform.setMode('rotate');transform.setSpace('local');transform.showX=true;transform.showY=false;transform.showZ=false;}
      else{transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;}
      invalidate();
    },
    suggestPositions, undo,
    captureMap: () => canvas.toDataURL('image/png'),
    getResult: () => lastResult,
    destroy,
  };
}
