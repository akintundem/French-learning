import type { Dashboard } from "./types";

export const GOAL_FRACTION = 0.7;

export type Projection = {
  mastered: number;
  target: number;
  fraction: number;            // 0–1 of the whole corpus
  perDay: number;              // mastery rate on days actually practised
  daysRemaining: number | null;
  projectedDate: string | null;
  verdict: "ahead" | "on-track" | "behind" | "unknown";
};

/**
 * Projects when the 70% goal is reached at the current rate.
 *
 * The rate is measured over days actually practised rather than calendar days:
 * a week off shouldn't make the habit look worse than it is. Returns "unknown"
 * until there is enough history to say anything honest.
 */
export function project(
  d: Dashboard,
  totalWords: number,
  deadline?: Date
): Projection {
  const target = Math.ceil(totalWords * GOAL_FRACTION);
  const mastered = d.totals.wordsMastered;
  const fraction = totalWords ? mastered / totalWords : 0;

  const activeDays = d.activity.filter((a) => a.attempts > 0).length;
  const perDay = activeDays >= 3 ? mastered / activeDays : 0;

  if (mastered >= target)
    return {
      mastered, target, fraction, perDay,
      daysRemaining: 0, projectedDate: null, verdict: "ahead",
    };

  if (!perDay)
    return {
      mastered, target, fraction, perDay: 0,
      daysRemaining: null, projectedDate: null, verdict: "unknown",
    };

  const daysRemaining = Math.ceil((target - mastered) / perDay);
  const projected = new Date();
  projected.setDate(projected.getDate() + daysRemaining);

  let verdict: Projection["verdict"] = "unknown";
  if (deadline) {
    const slack = (deadline.getTime() - projected.getTime()) / 86_400_000;
    verdict = slack > 7 ? "ahead" : slack >= -7 ? "on-track" : "behind";
  }

  return {
    mastered, target, fraction, perDay,
    daysRemaining,
    projectedDate: projected.toISOString().slice(0, 10),
    verdict,
  };
}
