/**
 * A single reversible product-use cycle. Units are millimetres and radians.
 * No accumulated transforms, timers, particle history or autoplay.
 * The previous exploded-study timeline remains archived in timeline.js.
 */
export const TAU = Math.PI * 2;
export const TILT_AXIS = [Math.SQRT1_2, 0, -Math.SQRT1_2];
export const MAX_TILT = Math.PI * .75;
export const SWIVEL_ANGLE = Math.PI * 110 / 180;
export const RITUAL_PHASES = [
  { at: 0, id: 'factory-sealed' },
  { at: .06, id: 'remove-cap' },
  { at: .15, id: 'peel-seal' },
  { at: .27, id: 'replace-cap' },
  { at: .35, id: 'open-outlet' },
  { at: .42, id: 'tilt' },
  { at: .49, id: 'steady-pour' },
  { at: .54, id: 'press-dose' },
  { at: .59, id: 'drain' },
  { at: .66, id: 'close-outlet' },
  { at: .72, id: 'replace-refill' },
  { at: .90, id: 'close-cap' },
  { at: .96, id: 'factory-sealed-again' },
];

export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
// Minimum-jerk transitions have zero velocity and acceleration at both ends.
export const smooth = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
export const range = (p, a, b) => clamp((p - a) / (b - a));
export const easeRange = (p, a, b) => smooth(range(p, a, b));
const mix = (a, b, t) => a + (b - a) * t;

function capPosition(p) {
  // Clear the actual 20 mm collar before translating sideways. Its three
  // components remain together; only the outlet and actuator operate.
  const lift = easeRange(p, .06, .10) - easeRange(p, .31, .35)
    + easeRange(p, .72, .741) - easeRange(p, .927, .96);
  const park = easeRange(p, .10, .15) - easeRange(p, .27, .31)
    + easeRange(p, .741, .765) - easeRange(p, .90, .927);
  // The scene replaces this nominal lateral coordinate with a camera-aligned
  // lane, so axial inspection never swings the parked cap through the insert.
  return [park ? -130 * park : 0, 44 * lift, 0];
}

function remainingFill(p) {
  if (p <= .475) return 1;
  if (p < .54) return mix(1, .88, range(p, .475, .54));
  if (p < .59) return mix(.88, .55, range(p, .54, .59));
  return .55 * (1 - range(p, .59, .66));
}

export function computeRitualState(value) {
  const p = clamp(Number.isFinite(value) ? value : 0);
  const phase = RITUAL_PHASES.findLast(chapter => p >= chapter.at).id;
  const tilt = MAX_TILT * (easeRange(p, .42, .49) - easeRange(p, .66, .70));
  const lift = easeRange(p, .35, .373) - easeRange(p, .703, .72);
  const swivel = SWIVEL_ANGLE * (easeRange(p, .373, .42) - easeRange(p, .675, .703));
  const press = easeRange(p, .54, .552) * (1 - easeRange(p, .564, .585));
  const gush = easeRange(p, .547, .558) * (1 - easeRange(p, .567, .588));
  const flow = easeRange(p, .475, .49) * (1 - easeRange(p, .635, .66));
  const yaw = 2 * TAU * p;
  const dispose = easeRange(p, .79, .825);
  // The spent PET has left before its replacement starts to enter.
  const arrive = easeRange(p, .83, .86);
  const lower = easeRange(p, .86, .90);
  const filmExit = easeRange(p, .246, .27);
  return {
    progress: p, phase, tilt, yaw,
    cap: { position: capPosition(p), lift, swivel, press,
      park: easeRange(p, .10, .15) - easeRange(p, .27, .31)
        + easeRange(p, .741, .765) - easeRange(p, .90, .927) },
    oldRefill: {
      position: [0, 174 * easeRange(p, .765, .79), 0],
      rotation: [0, 0, 0], depart: dispose,
      visible: p < .83, fill: remainingFill(p),
    },
    newRefill: {
      position: [0, 174 * (1 - lower), 0],
      rotation: [0, 0, 0], approach: 1 - arrive,
      visible: p >= .83, fill: 1,
    },
    seal: {
      unfold: easeRange(p, .15, .167),
      peel: easeRange(p, .167, .246), exit: filmExit,
      visible: p < .27,
    },
    newSeal: { unfold: 0, peel: 0, exit: 0, visible: p >= .83 },
    liquid: { flow, gush, fillOld: remainingFill(p), fillNew: 1 },
    // Framing ignores a thrown-away refill and the departing foil. Those
    // should leave the frame, rather than drag the camera along with them.
    framing: {
      oldRefill: p >= .765 && p <= .79,
      newRefill: p >= .83 && p <= .90,
      foil: easeRange(p, .15, .20) * (1 - easeRange(p, .246, .27)),
      liquid: p >= .473 && p <= .67,
      pouring: easeRange(p, .42, .49) * (1 - easeRange(p, .67, .72)),
    },
    sealed: p < .06 || p >= .96,
  };
}

/** Infinite signed coordinate, with no discontinuity in the authored yaw. */
export function computeCycleState(value) {
  const cyclePosition = Number.isFinite(value) ? value : 0;
  const cycleIndex = Math.floor(cyclePosition);
  const state = computeRitualState(cyclePosition - cycleIndex);
  return { ...state, cyclePosition, cycleIndex, yaw: 2 * TAU * cyclePosition };
}

/** Equivalent physical retail state, independent of which refill is present. */
export function retailFingerprint(state) {
  const refill = state.newRefill.visible && state.progress >= .9 ? state.newRefill : state.oldRefill;
  const seal = state.newRefill.visible && state.progress >= .9 ? state.newSeal : state.seal;
  const rotation = ((state.yaw % TAU) + TAU) % TAU;
  return {
    cap: state.cap, tilt: state.tilt, yaw: Math.abs(rotation) < 1e-10 ? 0 : rotation,
    refillPosition: refill.position, refillRotation: refill.rotation,
    fill: refill.fill, seal: { unfold: seal.unfold, peel: seal.peel, exit: seal.exit },
    liquid: { flow: state.liquid.flow, gush: state.liquid.gush },
  };
}
