import { computeJourneyPose } from './journey-pose.js?v=shop-20261015-intro1';
import { easeRange } from './assembly/ritual-timeline.js?v=ritual-20261012-4';

/** A short, sealed construction study. The approved component meshes stay intact.
 * The cap clears its collar before entering its screen-aligned parking lane;
 * the PET insert only rises once that lane is clear, and returns first. */
export function computeIntroPose(value) {
  const pose = computeJourneyPose(0);
  const q = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const lift = easeRange(q, .07, .18) - easeRange(q, .90, .98);
  const park = easeRange(q, .18, .30) - easeRange(q, .78, .90);
  const reveal = Math.max(0, Math.min(1, easeRange(q, .30, .44) - easeRange(q, .64, .78)));
  pose.state.cap.position = [0, 44 * lift, 0];
  pose.state.cap.park = park;
  pose.state.oldRefill.position = [0, 110 * reveal, 0];
  pose.state.framing.oldRefill = reveal > 0;
  pose.state.yaw = .18 * Math.sin(2 * Math.PI * q);
  return { ...pose, q, intro: true, reveal, phase: reveal > .01 ? 'intro-refill' : park > .01 ? 'intro-open' : 'intro-closed',
    phaseProgress: q, ritualProgress: 0 };
}
