import type { ToolSummary } from './chatClient';

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
  return appendLine(`message message--${role}`, text);
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

/** Show the tool-phase timing — wall-clock below the combined work means the calls overlapped. */
export function showToolTiming(summary: ToolSummary): void {
  if (summary.tools.length > 0) appendLine('tool-timing', formatToolTiming(summary));
}

function formatToolTiming({ tools, spanMs }: ToolSummary): string {
  const breakdown = tools.map((tool) => `${tool.name} ${tool.ms}ms`).join(' · ');
  return `🔧 ${tools.length} tools ran in ${spanMs}ms — ${breakdown}`;
}

/** Append a list item with the given class + text, keeping the log scrolled to the end. */
function appendLine(className: string, text: string): HTMLLIElement {
  const item = document.createElement('li');
  item.className = className;
  item.textContent = text;
  log.append(item);
  scrollToEnd();
  return item;
}

function scrollToEnd(): void {
  log.scrollTop = log.scrollHeight;
}
