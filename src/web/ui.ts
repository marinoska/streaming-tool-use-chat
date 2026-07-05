/**
 * Presentation layer — the conversation view.
 *
 * Pure DOM rendering: it owns the message log and the composer's enabled state.
 * It knows nothing about the network or how tokens are produced, so the logic
 * layer and this layer can change independently.
 */

const log = document.getElementById('messages') as HTMLOListElement;
const input = document.getElementById('input') as HTMLInputElement;
const button = document.getElementById('send') as HTMLButtonElement;

type Role = 'user' | 'assistant';

/** Append a message bubble and return its element (so text can be streamed in). */
export function addMessage(role: Role, text = ''): HTMLElement {
  const item = document.createElement('li');
  item.className = `message message--${role}`;
  item.textContent = text; // textContent, never innerHTML — output is untrusted text
  log.append(item);
  scrollToEnd();
  return item;
}

/** Append streamed text to an existing message. */
export function appendText(element: HTMLElement, text: string): void {
  element.textContent += text;
  scrollToEnd();
}

/** Toggle the "still streaming" caret on a message. */
export function setPending(element: HTMLElement, pending: boolean): void {
  element.classList.toggle('message--pending', pending);
}

/** Enable/disable the composer while a request is in flight. */
export function setComposerEnabled(enabled: boolean): void {
  input.disabled = !enabled;
  button.disabled = !enabled;
  if (enabled) input.focus();
}

function scrollToEnd(): void {
  log.scrollTop = log.scrollHeight;
}
