/** What to tell the member about a failed call: a validation issue's message, or the error's own. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const issues: unknown = JSON.parse(message);
    if (Array.isArray(issues) && issues[0]?.message)
      return String(issues[0].message);
  } catch {
    // Not a validation error: the message is already readable.
  }
  return message || "Something went wrong. Try again.";
}
