export function moduleStatus(attempts, module) {
  const recent = attempts.filter((a) => a.module === module).slice(-6);
  if (!recent.length) return "Not Started";
  const correct = recent.filter((a) => a.correct && !a.assisted);
  const distinct = new Set(correct.map((a) => a.question)).size;
  const days = new Set(
    correct.map((a) => new Date(a.time).toLocaleDateString()),
  ).size;
  return recent.length >= 4 &&
    correct.length / recent.length >= 0.8 &&
    distinct >= 3 &&
    days >= 2
    ? "Mastered"
    : "Learning";
}
export function validProgress(value) {
  if (!value || typeof value !== "object") return false;
  if (
    !Array.isArray(value.completed) ||
    !value.completed.every(Number.isInteger)
  )
    return false;
  if (
    !Array.isArray(value.attempts) ||
    !value.attempts.every(
      (a) =>
        a &&
        typeof a.question === "string" &&
        typeof a.module === "string" &&
        typeof a.correct === "boolean" &&
        Number.isFinite(a.time),
    )
  )
    return false;
  if (!["classic", "ocean", "dark", "forest", "minimal"].includes(value.theme))
    return false;
  if (
    value.colors &&
    (!Array.isArray(value.colors) ||
      value.colors.length !== 2 ||
      !value.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c)))
  )
    return false;
  return (
    value.notes &&
    typeof value.notes === "object" &&
    value.wrong &&
    typeof value.wrong === "object"
  );
}
