/**
 * Deterministic, dependency-free projection planning geometry.
 *
 * Metres and radians internally. A cylindrical screen is
 * [r*sin(theta), bottom + v*height, -r*cos(theta)], with its receiving face
 * pointing inward. Projector basis vectors are orthonormal world vectors.
 * centerOffset/shiftY are IMAGE-HEIGHT fractions; shiftX is an IMAGE-WIDTH
 * fraction. A manufacturer's raw offset percentage must be normalised before
 * it is passed here. Missing offset is never silently replaced with zero.
 *
 * Results are sampled planning estimates, not optical/certification approval.
 * Boundary probes prevent known edge gaps being hidden by centre sampling;
 * features narrower than the sampling resolution still require refinement or
 * independent installation validation.
 */

const EPS = 1e-8;
const TAU = Math.PI * 2;
const SQFT_PER_SQM = 10.763910416709722;
const DEG = 180 / Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = a => Math.hypot(...a);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const value = x => x && typeof x === 'object' && 'value' in x ? x.value : x;
const number = x => typeof value(x) === 'number' && Number.isFinite(value(x)) ? value(x) : null;
const vector = a => Array.isArray(a) && a.length === 3 && a.every(x => typeof x === 'number' && Number.isFinite(x));
const unique = a => [...new Set(a)];
const statusWord = x => String(x || '').trim().toLowerCase();
const provisionalWord = x => /assum|provision|deriv|customer|conflict|unverif|missing|candidate|approx/.test(statusWord(x));

function screenDefinition(screen = {}) {
  const radius = number(screen.radius) ?? (number(screen.diameter) === null ? null : number(screen.diameter) / 2);
  const height = number(screen.height) ?? number(screen.screenHeight);
  const bottom = number(screen.bottom) ?? number(screen.screenBottom) ?? 0;
  const arcDegrees = number(screen.arcDegrees) ?? number(screen.arc) ?? number(screen.angle);
  const arcRadians = number(screen.arcRadians) ?? (arcDegrees === null ? null : arcDegrees / DEG);
  const errors = [];
  if (!(radius > 0)) errors.push('Screen radius must be a positive number in metres.');
  if (!(height > 0)) errors.push('Screen height must be a positive number in metres.');
  if (!(arcRadians > 0 && arcRadians <= TAU + EPS)) errors.push('Screen arc must be greater than zero and no greater than 360 degrees.');
  return { radius, height, bottom, arcRadians, arcDegrees: arcRadians * DEG, errors, valid: errors.length === 0 };
}

function requiredScreen(screen) {
  const s = screenDefinition(screen);
  if (!s.valid) throw new RangeError(s.errors.join(' '));
  return s;
}

/** Position and receiving normal for u/v in [0,1]. */
export function screenPoint(screen, u, v) {
  const s = requiredScreen(screen);
  const theta = (u - 0.5) * s.arcRadians;
  return [s.radius * Math.sin(theta), s.bottom + v * s.height, -s.radius * Math.cos(theta)];
}

export function screenNormal(point) {
  const r = Math.hypot(point[0], point[2]);
  return r > EPS ? [-point[0] / r, 0, -point[2] / r] : [0, 0, 0];
}

/** Compile a profile without changing the caller's fields or evidence. */
export function validateProjector(projector = {}) {
  const missing = [];
  const warnings = [];
  const errors = [];
  const position = projector.position;
  const forward = projector.forward;
  const right = projector.right;
  const up = projector.up;
  for (const [key, v] of Object.entries({ position, forward, right, up })) {
    if (!vector(v)) missing.push(key);
  }
  if ([forward, right, up].every(vector)) {
    if ([forward, right, up].some(v => Math.abs(norm(v) - 1) > 0.002) ||
        Math.abs(dot(forward, right)) > 0.002 || Math.abs(dot(forward, up)) > 0.002 || Math.abs(dot(right, up)) > 0.002) {
      errors.push('Projector forward, right and up must be orthonormal unit vectors.');
    }
  }
  const throwRatio = number(projector.throwRatio);
  const aspect = number(projector.aspect) ?? number(projector.aspectRatio);
  let centerOffset = number(projector.centerOffset);
  let provisional = Boolean(projector.provisional);
  if (!(throwRatio > 0)) missing.push('throwRatio');
  if (!(aspect > 0)) missing.push('aspect');
  if (centerOffset === null) {
    missing.push('centerOffset');
    if (number(projector.provisionalCenterOffset) !== null) {
      centerOffset = number(projector.provisionalCenterOffset);
      provisional = true;
      warnings.push('The explicitly supplied provisional offset is used for preview only.');
    }
  }
  const evidence = projector.evidenceStatus ?? projector.opticsStatus ?? projector.profileStatus ?? null;
  const offsetEvidence = projector.offsetEvidence ?? projector.fieldEvidence?.centerOffset ?? projector.centerOffset?.status ?? null;
  if (provisionalWord(evidence) || provisionalWord(offsetEvidence)) provisional = true;
  if (provisional) warnings.push('This profile has provisional or customer-derived optical data; coverage is not confirmed.');
  if (projector.opticalProfileSupported === false || /unsupported|conflict|invalid/.test(statusWord(evidence))) {
    errors.push('This optical profile is unsupported, invalid or conflicting.');
  }
  const shiftX = number(projector.shiftX) ?? 0;
  const shiftY = number(projector.shiftY) ?? 0;
  const throwMin = number(projector.throwRatioMin) ?? number(projector.throwMin);
  const throwMax = number(projector.throwRatioMax) ?? number(projector.throwMax);
  if (throwMin !== null && throwRatio !== null && throwRatio < throwMin - EPS) errors.push('Optical throw setting is below this lens minimum.');
  if (throwMax !== null && throwRatio !== null && throwRatio > throwMax + EPS) errors.push('Optical throw setting is above this lens maximum.');
  for (const [axis, shift] of [['X', shiftX], ['Y', shiftY]]) {
    const lo = number(projector[`shift${axis}Min`]);
    const hi = number(projector[`shift${axis}Max`]);
    if ((lo !== null && shift < lo - EPS) || (hi !== null && shift > hi + EPS)) errors.push(`Lens shift ${axis} is outside its documented range.`);
  }
  if (typeof projector.shiftAllowed === 'function' && !projector.shiftAllowed(shiftX, shiftY)) errors.push('The combined horizontal and vertical lens shift is not supported.');
  const canCalculate = vector(position) && [forward, right, up].every(vector) && throwRatio > 0 && aspect > 0 && centerOffset !== null && errors.length === 0;
  const complete = canCalculate && missing.length === 0 && !provisional;
  return {
    id: projector.id ?? null, position, forward, right, up, throwRatio, aspect,
    centerOffset, shiftX, shiftY, canCalculate, complete, provisional,
    missing, errors, warnings, evidenceStatus: evidence, offsetEvidence,
    source: projector,
  };
}

function rasterAt(point, p) {
  if (!p.canCalculate || !vector(point)) return { assessed: false, inRaster: null, inFootprint: null, missing: p.missing, errors: p.errors, provisional: p.provisional };
  const delta = sub(point, p.position);
  const depth = dot(delta, p.forward);
  if (!(depth > EPS)) return { assessed: true, inRaster: false, inFootprint: false, behind: true, depth, distance: norm(delta), provisional: p.provisional };
  const imageWidth = depth / p.throwRatio;
  const imageHeight = imageWidth / p.aspect;
  const u = dot(delta, p.right) / imageWidth - p.shiftX + 0.5;
  const v = dot(delta, p.up) / imageHeight - p.centerOffset - p.shiftY + 0.5;
  const inRaster = u >= -EPS && u <= 1 + EPS && v >= -EPS && v <= 1 + EPS;
  return { assessed: true, inRaster, inFootprint: inRaster, u, v, depth, distance: norm(delta), imageWidth, imageHeight, provisional: p.provisional };
}

/** Raster coordinates alone do not establish a curved-screen light path. */
export function rasterCoordinates(point, projector) {
  return rasterAt(point, validateProjector(projector));
}

/**
 * First intersection of a world-space RAY with the finite cylindrical surface.
 * direction need not be normalised. maxDistance is in metres, not ray units.
 * Both faces count as obstacles. frontFacing describes the first hit.
 */
export function firstScreenIntersection(origin, direction, screen, { maxDistance = Infinity, epsilon = EPS } = {}) {
  const s = requiredScreen(screen);
  if (!vector(origin) || !vector(direction)) return null;
  const magnitude = norm(direction);
  if (magnitude < epsilon) return null;
  const d = mul(direction, 1 / magnitude);
  const a = d[0] ** 2 + d[2] ** 2;
  if (a < epsilon * epsilon) return null;
  const b = 2 * (origin[0] * d[0] + origin[2] * d[2]);
  const c = origin[0] ** 2 + origin[2] ** 2 - s.radius ** 2;
  const disc = b * b - 4 * a * c;
  if (disc < -epsilon) return null;
  const root = Math.sqrt(Math.max(0, disc));
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((x, y) => x - y);
  for (const distance of roots) {
    if (distance <= epsilon || distance > maxDistance + epsilon) continue;
    const point = add(origin, mul(d, distance));
    if (point[1] < s.bottom - epsilon || point[1] > s.bottom + s.height + epsilon) continue;
    const theta = Math.atan2(point[0], -point[2]);
    if (s.arcRadians < TAU - epsilon && Math.abs(theta) > s.arcRadians / 2 + epsilon) continue;
    const normal = screenNormal(point);
    return { point, distance, theta, normal, frontFacing: dot(normal, mul(d, -1)) > epsilon, u: theta / s.arcRadians + 0.5, v: (point[1] - s.bottom) / s.height };
  }
  return null;
}

function obstacleResult(result, maxDistance) {
  if (result === true) return { blocked: true, reason: 'obstruction' };
  if (result === false || result == null) return { blocked: false };
  if (typeof result === 'number') return { blocked: result > EPS && result < maxDistance - EPS, distance: result, reason: 'obstruction' };
  if (typeof result === 'object') {
    if (result.assessed === false || result.unknown === true) return { blocked: null, reason: result.reason || 'Obstruction check not assessed.' };
    const distance = number(result.distance);
    const hit = result.blocked === true || result.hit === true;
    return { blocked: hit && (distance === null || distance < maxDistance - EPS), reason: result.reason ?? result.id ?? 'obstruction', distance };
  }
  return { blocked: null, reason: 'Obstruction callback returned an unsupported result.' };
}

function coverageAt(point, screen, p, obstruction, index, checkObstacles = true) {
  const raster = rasterAt(point, p);
  const common = { id: p.id ?? index, index, provisional: p.provisional || !p.complete, assessed: raster.assessed, raster, inRaster: raster.inRaster, inFootprint: false, frontFacing: null, firstHit: null, blocked: false, usable: false, shadowAssessed: Boolean(obstruction) };
  if (!raster.assessed) return { ...common, inFootprint: null, blocked: null, usable: null };
  if (!raster.inRaster) return common;
  const normal = screenNormal(point);
  const delta = sub(point, p.position);
  const frontFacing = dot(normal, mul(delta, -1)) > EPS;
  if (!frontFacing) return { ...common, frontFacing: false, reason: 'reverse-face' };
  const intersection = firstScreenIntersection(p.position, delta, screen, { maxDistance: raster.distance + 1e-6 });
  const firstHit = Boolean(intersection && Math.abs(intersection.distance - raster.distance) <= Math.max(1e-6, raster.distance * 1e-7));
  if (!firstHit) return { ...common, frontFacing, firstHit: false, reason: 'nearer-screen-surface' };
  let obstructionState = { blocked: false };
  if (obstruction && checkObstacles) {
    try { obstructionState = obstacleResult(obstruction(p.position, point, index), raster.distance); }
    catch (error) { obstructionState = { blocked: null, reason: `Obstruction calculation failed: ${error.message || error}` }; }
  }
  return { ...common, frontFacing: true, firstHit: true, inFootprint: true, blocked: obstructionState.blocked, blockedBy: obstructionState.blocked ? obstructionState.reason : null, reason: obstructionState.blocked === null ? obstructionState.reason : null, usable: obstructionState.blocked === null ? null : !obstructionState.blocked };
}

export function screenPointCoverage(point, screen, projector, { obstruction, index = 0 } = {}) {
  const s = requiredScreen(screen);
  return coverageAt(point, s, validateProjector(projector), obstruction, index);
}

/** Slab intersection of a finite segment and AABB. Visibility is irrelevant. */
export function segmentAABB(source, target, box, { epsilon = EPS } = {}) {
  const lo = box?.min ?? box?.minimum;
  const hi = box?.max ?? box?.maximum;
  if (![source, target, lo, hi].every(vector)) return { hit: false, valid: false };
  const d = sub(target, source);
  let enter = 0;
  let leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    if (lo[axis] > hi[axis]) return { hit: false, valid: false };
    if (Math.abs(d[axis]) <= epsilon) {
      if (source[axis] < lo[axis] - epsilon || source[axis] > hi[axis] + epsilon) return { hit: false, valid: true };
    } else {
      const t1 = (lo[axis] - source[axis]) / d[axis];
      const t2 = (hi[axis] - source[axis]) / d[axis];
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave + epsilon) return { hit: false, valid: true };
    }
  }
  const hit = leave > epsilon && enter < 1 - epsilon;
  return { hit, valid: true, tEnter: enter, tExit: leave, distance: norm(d) * Math.max(0, enter), point: add(source, mul(d, Math.max(0, enter))) };
}

function rayAt(projector, u, v) {
  const p = projector.source ? projector : validateProjector(projector);
  if (!p.canCalculate) return null;
  const x = (u - 0.5 + p.shiftX) / p.throwRatio;
  const y = (v - 0.5 + p.centerOffset + p.shiftY) / (p.throwRatio * p.aspect);
  const direction = add(add(p.forward, mul(p.right, x)), mul(p.up, y));
  return { origin: [...p.position], direction: mul(direction, 1 / norm(direction)), u, v, provisional: !p.complete };
}

export function projectorRay(projector, u, v) { return rayAt(projector, u, v); }

export function projectorCornerRays(projector) {
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => rayAt(projector, u, v)).filter(Boolean);
}

/**
 * Raster-perimeter ray hits for drawing/debugging. These alone do not describe
 * the full clipped footprint when a screen edge falls inside the raster.
 * evaluateProjection cells are authoritative for the displayed coverage map.
 */
export function projectorFootprint(projector, screen, { segments = 24, maxDistance = 1000 } = {}) {
  const s = requiredScreen(screen);
  const p = validateProjector(projector);
  const count = clamp(Math.round(segments), 2, 512);
  const edges = [];
  const perimeter = [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]];
  for (const [u0, v0, u1, v1] of perimeter) {
    const edge = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const ray = rayAt(p, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
      const hit = ray ? firstScreenIntersection(ray.origin, ray.direction, s, { maxDistance }) : null;
      edge.push({ ray, hit: hit?.frontFacing ? hit : null });
    }
    edges.push(edge);
  }
  return { edges, points: edges.flat().filter(x => x.hit).map(x => x.hit.point), rays: projectorCornerRays(projector), complete: p.complete, warnings: [...p.warnings, ...p.errors], missing: p.missing };
}

function classify(contributions) {
  const planned = contributions.filter(p => p.inFootprint);
  const lit = planned.filter(p => p.usable === true);
  const blocked = planned.filter(p => p.blocked === true);
  const unknown = contributions.some(p => p.inFootprint === null || (p.inFootprint && p.blocked === null));
  let classification = 'uncovered';
  if (!planned.length && unknown) classification = 'unassessed';
  else if (planned.length && !lit.length && blocked.length === planned.length) classification = 'shadow';
  else if (planned.length && !lit.length && unknown) classification = 'unassessed';
  else if (lit.length && blocked.length) classification = 'partial-shadow';
  else if (lit.length > 1) classification = 'overlap';
  else if (lit.length) classification = 'covered';
  return { classification, planned, lit, blocked, unknown };
}

function makePair(i, j, rows) {
  return { indices: [i, j], geometricArea: 0, illuminatedArea: 0, partialBlockedArea: 0, rows: Array.from({ length: rows }, (_, row) => ({ row, geometricArea: 0, illuminatedArea: 0, aArea: 0, bArea: 0 })) };
}

function angularRoots(a, b, c, minimum, maximum) {
  const length = Math.hypot(a, b);
  if (length < 1e-12 || Math.abs(c) > length + 1e-10) return [];
  const phase = Math.atan2(b, a);
  const first = Math.asin(clamp(-c / length, -1, 1));
  const result = [];
  for (const raw of [first - phase, Math.PI - first - phase]) {
    for (let turn = -2; turn <= 2; turn++) {
      const theta = raw + turn * TAU;
      if (theta > minimum + 1e-10 && theta < maximum - 1e-10) result.push(theta);
    }
  }
  return result;
}

/**
 * Exact conventional-frustum union area on the cylinder for optical origins
 * inside its radius. Each frustum plane cuts the cylinder into a sinusoidal
 * height boundary (or a constant angular boundary). Their intersections give
 * an arrangement whose open regions have constant footprint membership.
 * Integrating each height band catches arbitrarily narrow *geometric* gaps
 * that a regular grid could miss. Mesh shadow areas remain sampled.
 */
function cylinderFrustumUnion(screen, profiles) {
  const active = profiles.filter(p => p.canCalculate);
  if (!active.length || active.some(p => Math.hypot(p.position[0], p.position[2]) >= screen.radius - 1e-7)) return null;
  const minimum = -screen.arcRadians / 2;
  const maximum = screen.arcRadians / 2;
  const breaks = [minimum, maximum];
  const curves = [
    { a: 0, b: 0, c: screen.bottom },
    { a: 0, b: 0, c: screen.bottom + screen.height },
  ];
  for (const p of active) {
    const horizontal = 1 / p.throwRatio;
    const vertical = horizontal / p.aspect;
    const centre = p.centerOffset + p.shiftY;
    const planes = [
      p.forward,
      sub(p.right, mul(p.forward, (p.shiftX - 0.5) * horizontal)),
      sub(mul(p.forward, (p.shiftX + 0.5) * horizontal), p.right),
      sub(p.up, mul(p.forward, (centre - 0.5) * vertical)),
      sub(mul(p.forward, (centre + 0.5) * vertical), p.up),
    ];
    for (const normal of planes) {
      const a = normal[0] * screen.radius;
      const b = -normal[2] * screen.radius;
      const c = normal[1];
      const d = -dot(normal, p.position);
      if (Math.abs(c) < 1e-10) breaks.push(...angularRoots(a, b, d, minimum, maximum));
      else curves.push({ a: -a / c, b: -b / c, c: -d / c });
    }
  }
  for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
    breaks.push(...angularRoots(curves[i].a - curves[j].a, curves[i].b - curves[j].b, curves[i].c - curves[j].c, minimum, maximum));
  }
  breaks.sort((a, b) => a - b);
  const angles = breaks.filter((theta, index) => index === 0 || theta - breaks[index - 1] > 1e-10);
  let coveredArea = 0;
  let confirmedArea = 0;
  let gapRegions = 0;
  for (let i = 0; i < angles.length - 1; i++) {
    const left = angles[i], right = angles[i + 1], theta = (left + right) / 2;
    const boundaries = curves.map(curve => ({ curve, y: curve.a * Math.sin(theta) + curve.b * Math.cos(theta) + curve.c }))
      .filter(entry => entry.y >= screen.bottom - 1e-8 && entry.y <= screen.bottom + screen.height + 1e-8)
      .sort((a, b) => a.y - b.y)
      .filter((entry, index, list) => index === 0 || entry.y - list[index - 1].y > 1e-9);
    for (let j = 0; j < boundaries.length - 1; j++) {
      const lower = boundaries[j], upper = boundaries[j + 1];
      if (upper.y - lower.y <= 1e-10) continue;
      const point = [screen.radius * Math.sin(theta), (lower.y + upper.y) / 2, -screen.radius * Math.cos(theta)];
      const reaching = active.filter(p => rasterAt(point, p).inRaster);
      const integral = curve => curve.a * (Math.cos(left) - Math.cos(right)) + curve.b * (Math.sin(right) - Math.sin(left)) + curve.c * (right - left);
      const area = Math.max(0, screen.radius * (integral(upper.curve) - integral(lower.curve)));
      if (reaching.length) coveredArea += area;
      else if (area > 1e-12) gapRegions++;
      if (reaching.some(p => p.complete)) confirmedArea += area;
    }
  }
  const total = screen.radius * screen.arcRadians * screen.height;
  return { coveredArea: clamp(coveredArea, 0, total), confirmedArea: clamp(confirmedArea, 0, total), uncoveredArea: Math.max(0, total - coveredArea), gapRegions, method: 'analytic cylindrical frustum arrangement; shadow areas sampled separately' };
}

/**
 * Main screen assessment. obstruction(source,target,projectorIndex) returns
 * boolean, a distance, or {blocked/hit, distance?, reason?}. It must ignore
 * purely visual hidden/ghosted flags. Omit it to mark shadows not assessed.
 * overlapTarget fractions refer to the smaller clipped footprint in each row.
 */
export function evaluateProjection({ screen, projectors = [], columns = 64, rows = 24, obstruction, overlapTarget = null, material = null, blendWeight, requiredMask, boundaryChecks = true } = {}) {
  const s = screenDefinition(screen);
  if (!s.valid) return { status: 'invalid', coverageStatus: 'invalid', shadowStatus: 'not-assessed', overlapStatus: 'not-assessed', cells: [], channels: [], overlaps: [], stats: null, warnings: s.errors, brightness: { status: 'not-assessed', warnings: s.errors } };
  columns = clamp(Math.round(Number(columns) || 64), 2, 1024);
  rows = clamp(Math.round(Number(rows) || 24), 2, 512);
  const profiles = projectors.map(validateProjector);
  const nominalArea = s.radius * s.arcRadians * s.height;
  const cellArea = nominalArea / (columns * rows);
  const stats = { nominalArea, totalArea: 0, geometricArea: 0, coveredArea: 0, confirmedCoveredArea: 0, provisionalCoveredArea: 0, uncoveredArea: 0, fullyShadowedArea: 0, partialShadowedArea: 0, overlapArea: 0, geometricOverlapArea: 0, unassessedArea: 0, boundaryGaps: 0, boundaryShadows: 0, boundaryPartialShadows: 0 };
  const channels = profiles.map((p, index) => ({ id: p.id ?? index, index, geometricArea: 0, illuminatedArea: 0, blockedArea: 0, distanceMin: null, distanceMax: null, axialDistanceMin: null, axialDistanceMax: null, complete: p.complete, provisional: p.provisional, canCalculate: p.canCalculate, missing: p.missing, evidenceStatus: p.evidenceStatus, warnings: [...p.warnings, ...p.errors], status: p.errors.length ? 'invalid' : p.complete ? 'pass' : 'partial' }));
  const overlaps = projectors.slice(1).map((_, i) => makePair(i, i + 1, rows));
  const cells = [];
  const warnings = [];
  function updateDistance(c) {
    if (!c.inFootprint) return;
    const channel = channels[c.index];
    channel.distanceMin = channel.distanceMin === null ? c.raster.distance : Math.min(channel.distanceMin, c.raster.distance);
    channel.distanceMax = channel.distanceMax === null ? c.raster.distance : Math.max(channel.distanceMax, c.raster.distance);
    channel.axialDistanceMin = channel.axialDistanceMin === null ? c.raster.depth : Math.min(channel.axialDistanceMin, c.raster.depth);
    channel.axialDistanceMax = channel.axialDistanceMax === null ? c.raster.depth : Math.max(channel.axialDistanceMax, c.raster.depth);
  }
  function at(u, v) {
    const position = screenPoint(s, u, v);
    if (requiredMask && !requiredMask(position, u, v)) return null;
    const contributions = profiles.map((p, index) => coverageAt(position, s, p, obstruction, index));
    return { position, contributions, ...classify(contributions) };
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const u = (column + 0.5) / columns;
      const v = (row + 0.5) / rows;
      const assessed = at(u, v);
      if (!assessed) continue;
      const { position, contributions, planned, lit, blocked, unknown, classification } = assessed;
      const confirmedLit = lit.filter(p => profiles[p.index].complete);
      const cell = { column, row, u, v, theta: (u - 0.5) * s.arcRadians, position, x: position[0], y: position[1], z: position[2], normal: screenNormal(position), area: cellArea, projectors: contributions, contributions, classification, coverageCount: planned.length, unblockedCount: lit.length, confirmedCount: confirmedLit.length, provisional: lit.length > 0 && confirmedLit.length === 0 };
      cells.push(cell);
      stats.totalArea += cellArea;
      if (planned.length) stats.geometricArea += cellArea;
      else stats.uncoveredArea += cellArea;
      if (lit.length) stats.coveredArea += cellArea;
      if (confirmedLit.length) stats.confirmedCoveredArea += cellArea;
      else if (lit.length) stats.provisionalCoveredArea += cellArea;
      if (planned.length && blocked.length === planned.length) stats.fullyShadowedArea += cellArea;
      if (lit.length && blocked.length) stats.partialShadowedArea += cellArea;
      if (lit.length > 1) stats.overlapArea += cellArea;
      if (planned.length > 1) stats.geometricOverlapArea += cellArea;
      if (unknown) stats.unassessedArea += cellArea;
      for (const c of contributions) {
        const channel = channels[c.index];
        if (c.inFootprint) channel.geometricArea += cellArea;
        if (c.usable) channel.illuminatedArea += cellArea;
        if (c.blocked) channel.blockedArea += cellArea;
        if (c.reason && c.blocked === null) warnings.push(c.reason);
        updateDistance(c);
      }
      for (const pair of overlaps) {
        const [a, b] = pair.indices.map(index => contributions[index]);
        const rowData = pair.rows[row];
        if (a.inFootprint) rowData.aArea += cellArea;
        if (b.inFootprint) rowData.bArea += cellArea;
        if (a.inFootprint && b.inFootprint) {
          pair.geometricArea += cellArea;
          rowData.geometricArea += cellArea;
          if (a.usable && b.usable) { pair.illuminatedArea += cellArea; rowData.illuminatedArea += cellArea; }
          else if (a.usable || b.usable) pair.partialBlockedArea += cellArea;
        }
      }
    }
  }
  // Perimeter probes include both screen ends and the upper/lower boundaries.
  // They are not added to area totals (a boundary has no surface area).
  if (boundaryChecks && profiles.length) {
    const probes = [];
    for (let c = 0; c <= columns; c++) { probes.push([c / columns, 0], [c / columns, 1]); }
    for (let r = 1; r < rows; r++) { probes.push([0, r / rows], [1, r / rows]); }
    for (const [u, v] of probes) {
      const result = at(u, v);
      if (!result) continue;
      if (!result.planned.length) stats.boundaryGaps++;
      if (result.classification === 'shadow') stats.boundaryShadows++;
      if (result.classification === 'partial-shadow') stats.boundaryPartialShadows++;
      result.contributions.forEach(updateDistance);
    }
  }
  const analytic = requiredMask ? null : cylinderFrustumUnion(s, profiles);
  if (analytic) {
    stats.sampledGeometricArea = stats.geometricArea;
    stats.analyticGeometricArea = analytic.coveredArea;
    stats.analyticGapRegions = analytic.gapRegions;
    stats.geometricArea = analytic.coveredArea;
    stats.uncoveredArea = analytic.uncoveredArea < 1e-10 ? 0 : analytic.uncoveredArea;
    // The sampled shadow map cannot illuminate an analytically uncovered area.
    stats.coveredArea = Math.min(stats.coveredArea, analytic.coveredArea);
    stats.confirmedCoveredArea = Math.min(stats.confirmedCoveredArea, analytic.confirmedArea);
    stats.provisionalCoveredArea = Math.max(0, stats.coveredArea - stats.confirmedCoveredArea);
  }
  for (const [i, channel] of channels.entries()) {
    const p = projectors[i];
    const focusMin = number(p.focusMin) ?? number(p.minThrowDistance);
    const focusMax = number(p.focusMax) ?? number(p.maxThrowDistance);
    channel.operatingLimitStatus = focusMin === null && focusMax === null ? 'not-assessed' : 'pass';
    if (channel.distanceMin !== null && focusMin !== null && channel.distanceMin < focusMin - EPS) {
      channel.warnings.push('A sampled screen point is nearer than the documented minimum focus distance.');
      channel.operatingLimitStatus = 'fail';
    }
    if (channel.distanceMax !== null && focusMax !== null && channel.distanceMax > focusMax + EPS) {
      channel.warnings.push('A sampled screen point is beyond the documented maximum focus distance.');
      channel.operatingLimitStatus = 'fail';
    }
    channel.distanceRange = channel.distanceMin === null ? null : [channel.distanceMin, channel.distanceMax];
    channel.warnings = unique(channel.warnings);
  }
  const target = typeof overlapTarget === 'number' ? { min: overlapTarget, max: 1 } : overlapTarget;
  for (const pair of overlaps) {
    pair.basis = 'fraction of the smaller clipped footprint in each sampled horizontal row';
    for (const row of pair.rows) {
      const reference = Math.min(row.aArea, row.bArea);
      row.fraction = reference > EPS ? row.illuminatedArea / reference : 0;
      row.geometricFraction = reference > EPS ? row.geometricArea / reference : 0;
    }
    pair.minimumRowFraction = Math.min(...pair.rows.map(r => r.fraction));
    pair.maximumRowFraction = Math.max(...pair.rows.map(r => r.fraction));
    pair.fullHeight = pair.rows.every(r => r.illuminatedArea > EPS);
    pair.status = target && number(target.min) !== null
      ? pair.rows.every(r => r.fraction + EPS >= target.min && (number(target.max) === null || r.fraction <= target.max + EPS)) ? 'pass' : 'fail'
      : 'not-assessed';
    if (pair.indices.some(i => !profiles[i].complete) && pair.status === 'pass') pair.status = 'partial';
  }
  const denominator = stats.totalArea;
  for (const [key, areaKey] of Object.entries({ coverage: 'coveredArea', geometricCoverage: 'geometricArea', confirmedCoverage: 'confirmedCoveredArea', provisionalCoverage: 'provisionalCoveredArea', uncoveredFraction: 'uncoveredArea', fullyShadowedFraction: 'fullyShadowedArea', partialShadowedFraction: 'partialShadowedArea', overlapFraction: 'overlapArea' })) stats[key] = denominator > 0 ? clamp(stats[areaKey] / denominator, 0, 1) : null;
  stats.coveragePercent = stats.coverage === null ? null : stats.coverage * 100;
  stats.confirmedCoveragePercent = stats.confirmedCoverage === null ? null : stats.confirmedCoverage * 100;
  const incomplete = profiles.some(p => !p.complete);
  const geometryFailed = stats.uncoveredArea > EPS || stats.boundaryGaps > 0;
  const coverageStatus = !profiles.length || denominator === 0 ? 'not-assessed' : incomplete ? 'partial' : geometryFailed ? 'fail' : 'pass';
  const shadowStatus = !obstruction || !profiles.length ? 'not-assessed' : stats.unassessedArea > EPS || incomplete ? 'partial' : stats.fullyShadowedArea > EPS || stats.boundaryShadows ? 'fail' : stats.partialShadowedArea > EPS || stats.boundaryPartialShadows ? 'partial' : 'pass';
  const overlapStatus = !overlaps.length || !target ? 'not-assessed' : overlaps.some(o => o.status === 'fail') ? 'fail' : overlaps.some(o => o.status === 'partial') ? 'partial' : 'pass';
  let status = !profiles.length ? 'not-assessed' : [coverageStatus, shadowStatus, overlapStatus].includes('fail') ? 'fail' : incomplete || shadowStatus !== 'pass' || (overlaps.length && overlapStatus !== 'pass') ? 'partial' : coverageStatus;
  if (profiles.some(p => p.errors.length)) status = 'invalid';
  const opticsStatus = channels.some(c => c.operatingLimitStatus === 'fail') ? 'fail' : channels.every(c => c.operatingLimitStatus === 'pass') && channels.length ? 'partial' : 'not-assessed';
  if (opticsStatus === 'fail' && status !== 'invalid') status = 'fail';
  warnings.push(...channels.flatMap(c => c.warnings));
  if (profiles.some(p => p.missing.length)) warnings.push('One or more optical profiles are incomplete; provisional coverage is kept separate from confirmed coverage.');
  if (!obstruction) warnings.push('Cockpit and structure shadows are not assessed because no obstruction model was supplied.');
  if (overlaps.length && !target) warnings.push('No approved overlap target was supplied; overlap geometry is shown without an overlap approval.');
  warnings.push('Sampled geometric planning estimate; not optical installation validation or certification.');
  const result = { status, coverageStatus, shadowStatus, overlapStatus, opticsStatus, cells, stats, channels, overlaps, columns, rows, screen: s, warnings: unique(warnings), resolution: { arcStepMetres: s.radius * s.arcRadians / columns, verticalStepMetres: s.height / rows, perimeterChecked: boundaryChecks, method: analytic ? analytic.method : 'area-weighted cell centres plus screen perimeter probes', analyticalGeometry: Boolean(analytic) } };
  result.brightness = material ? estimateBrightness({ cells, projectors, material, blendWeight }) : { status: 'not-assessed', warnings: ['Select a documented diffuse material and brightness profile to estimate luminance.'] };
  return result;
}

/**
 * Idealised uniform raster-flux model. Projection's local area Jacobian maps
 * flux to the actual curved surface, including incidence and distance effects.
 * It does not invent measured lens falloff, focus, directional screen response
 * or ambient-light contrast. Default equal overlap weights are PLANNED weights:
 * a blocked projector does not cause its neighbour to brighten automatically.
 */
export function estimateBrightness({ cells = [], projectors = [], material = {}, blendWeight } = {}) {
  const profiles = projectors.map(validateProjector);
  const gain = number(material.gain);
  const warnings = [];
  if (!(gain >= 0) || material.diffuse === false || material.directional === true || /alr|directional/i.test(material.opticalModel || '')) {
    return { status: 'not-assessed', warnings: ['A documented diffuse-material gain is required; directional/ALR luminance is not modelled.'], meanLux: null, meanNits: null, meanFootLamberts: null };
  }
  const light = projectors.map((p, i) => {
    const lumens = number(p.brightnessLumens) ?? number(p.lumens);
    const basis = String(p.brightnessBasis ?? p.brightnessStandard ?? '');
    const efficiency = number(p.brightnessEfficiency) ?? 1;
    const valid = lumens >= 0 && /\bANSI\b|\bISO\b/i.test(basis) && efficiency >= 0 && efficiency <= 1 && profiles[i].canCalculate;
    if (!valid) warnings.push(`${p.id ?? `Projector ${i + 1}`}: standardised output lumens, optical data or a valid efficiency are missing.`);
    if (number(p.brightnessEfficiency) === null) warnings.push(`${p.id ?? `Projector ${i + 1}`}: nominal rated output is assumed; no measured calibration, operating-mode or ageing loss was supplied.`);
    return { valid, lumens, basis, efficiency };
  });
  const channelResults = projectors.map((p, i) => ({ id: p.id ?? i, usefulLumens: 0, beforeBlendLumens: 0, status: light[i].valid ? 'estimated' : 'not-assessed' }));
  let area = 0;
  let usefulLumens = 0;
  let missingArea = 0;
  let minimumLux = Infinity;
  let maximumLux = 0;
  const values = [];
  for (const cell of cells) {
    const cellArea = number(cell.area);
    const point = cell.position ?? [cell.x, cell.y, cell.z];
    if (!(cellArea > 0) || !vector(point)) continue;
    area += cellArea;
    const normal = cell.normal ?? screenNormal(point);
    const contributions = cell.projectors ?? cell.contributions ?? profiles.map((p, i) => ({ index: i, inFootprint: rasterAt(point, p).inRaster, usable: true, blocked: false }));
    const planned = contributions.filter(c => c.inFootprint);
    let lux = 0;
    let unknown = false;
    for (const c of planned) {
      const i = c.index;
      if (c.blocked === null) { unknown = true; continue; }
      if (c.blocked === true || c.usable === false) continue;
      const p = profiles[i];
      const output = light[i];
      if (!p || !output?.valid) { unknown = true; continue; }
      const raster = c.raster ?? rasterAt(point, p);
      if (!(raster.depth > EPS)) continue;
      // d(normalised raster area)/d(screen area), in m^-2.
      const jacobian = p.throwRatio ** 2 * p.aspect * Math.abs(dot(normal, sub(point, p.position))) / raster.depth ** 3;
      const unweightedLux = output.lumens * output.efficiency * jacobian;
      const candidate = blendWeight ? blendWeight(point, i, planned.map(x => x.index), cell) : 1 / planned.length;
      if (!(Number.isFinite(candidate) && candidate >= 0 && candidate <= 1)) { unknown = true; warnings.push('A supplied blend weight was invalid; affected luminance is incomplete.'); continue; }
      const contributionLux = unweightedLux * candidate;
      lux += contributionLux;
      channelResults[i].beforeBlendLumens += unweightedLux * cellArea;
      channelResults[i].usefulLumens += contributionLux * cellArea;
    }
    if (unknown) missingArea += cellArea;
    usefulLumens += lux * cellArea;
    minimumLux = Math.min(minimumLux, lux);
    maximumLux = Math.max(maximumLux, lux);
    values.push({ lux, nits: lux * gain / Math.PI, footLamberts: lux * gain / SQFT_PER_SQM, complete: !unknown });
  }
  if (!(area > 0)) return { status: 'not-assessed', warnings: ['No positive assessed screen area.'], meanLux: null, meanNits: null, meanFootLamberts: null };
  const allKnown = missingArea <= EPS && light.every(l => l.valid) && profiles.every(p => p.complete);
  const knownAny = light.some(l => l.valid);
  const meanLux = usefulLumens / area;
  warnings.push('Indicative uniform-raster calculation; measured lens non-uniformity, focus, directional gain and ambient-light contrast are not simulated.');
  if (!blendWeight) warnings.push('Equal planned overlap weights are assumed; this is not an exported or calibrated blend map.');
  return { status: !knownAny ? 'not-assessed' : allKnown ? 'estimated' : 'partial', assessedArea: area, missingArea, usefulLumens, meanLux: knownAny ? meanLux : null, meanNits: knownAny ? meanLux * gain / Math.PI : null, meanFootLamberts: knownAny ? usefulLumens * gain / (area * SQFT_PER_SQM) : null, minimumLux: knownAny ? minimumLux : null, maximumLux: knownAny ? maximumLux : null, gain, values, channels: channelResults, warnings: unique(warnings), assumptions: { rasterFlux: 'uniform', blend: blendWeight ? 'provided weights' : 'equal planned contributions', screen: 'diffuse', source: 'declared standardised output', losses: 'only explicitly supplied efficiency factors' } };
}

/** Geometric screen angular extent from an eye. Cockpit sightlines are separate. */
export function computeFov(eye, screen, { samples = 256 } = {}) {
  const s = requiredScreen(screen);
  if (!vector(eye)) return { status: 'not-assessed', horizontalDegrees: null, verticalDegrees: null, warnings: ['A finite three-dimensional eye position is required.'] };
  samples = clamp(Math.round(samples), 16, 4096);
  let previousYaw = null;
  let minimumYaw = Infinity;
  let maximumYaw = -Infinity;
  let minimumElevation = Infinity;
  let maximumElevation = -Infinity;
  let eyeOnSurface = false;
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const mid = screenPoint(s, u, 0.5);
    const dx = mid[0] - eye[0];
    const dz = mid[2] - eye[2];
    let yaw = Math.atan2(dx, -dz);
    if (previousYaw !== null) {
      while (yaw - previousYaw > Math.PI) yaw -= TAU;
      while (yaw - previousYaw < -Math.PI) yaw += TAU;
    }
    previousYaw = yaw;
    minimumYaw = Math.min(minimumYaw, yaw);
    maximumYaw = Math.max(maximumYaw, yaw);
    const horizontalDistance = Math.hypot(dx, dz);
    if (horizontalDistance < EPS && eye[1] >= s.bottom && eye[1] <= s.bottom + s.height) eyeOnSurface = true;
    for (const y of [s.bottom, s.bottom + s.height]) {
      const elevation = Math.atan2(y - eye[1], horizontalDistance);
      minimumElevation = Math.min(minimumElevation, elevation);
      maximumElevation = Math.max(maximumElevation, elevation);
    }
  }
  return { status: eyeOnSurface ? 'invalid' : 'estimated', horizontalDegrees: Math.min(360, (maximumYaw - minimumYaw) * DEG), verticalDegrees: (maximumElevation - minimumElevation) * DEG, horizontalFov: Math.min(360, (maximumYaw - minimumYaw) * DEG), verticalFov: (maximumElevation - minimumElevation) * DEG, leftDegrees: minimumYaw * DEG, rightDegrees: maximumYaw * DEG, bottomDegrees: minimumElevation * DEG, topDegrees: maximumElevation * DEG, nominalArcDegrees: s.arcDegrees, visibilityAssessed: false, warnings: eyeOnSurface ? ['Eye position lies on the modelled screen.'] : ['Geometric screen extent only; cockpit-obstructed pilot visibility is a separate assessment.'] };
}
