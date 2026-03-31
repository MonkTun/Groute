/**
 * Compute the time a user should leave to arrive at the activity on time.
 * Subtracts travel duration + buffer from the activity start time.
 */
export function computeLeaveTime(
  activityStartTime: string,
  travelDurationSeconds: number,
  bufferMinutes: number = 15
): string {
  const startMs = new Date(activityStartTime).getTime();
  const travelMs = travelDurationSeconds * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;
  return new Date(startMs - travelMs - bufferMs).toISOString();
}
