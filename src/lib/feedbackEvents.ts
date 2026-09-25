export const OPEN_FEEDBACK_EVENT = "motormila:open-feedback";

export function openFeedbackDialog() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT));
  }
}
