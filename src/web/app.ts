/**
 * Controller — wires the presentation layer to the logic layer.
 *
 * On submit: render the user's message, then stream the assistant's reply token
 * by token into a fresh bubble. This is the only file that touches both layers.
 */
import { streamChat } from './chatClient';
import { addMessage, appendText, setPending, setComposerEnabled } from './ui';

const composer = document.getElementById('composer') as HTMLFormElement;
const input = document.getElementById('input') as HTMLInputElement;

composer.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';
  setComposerEnabled(false);

  const reply = addMessage('assistant');
  setPending(reply, true);

  try {
    for await (const token of streamChat(message)) appendText(reply, token);
  } catch (error) {
    appendText(reply, `⚠️ ${(error as Error).message}`);
  } finally {
    setPending(reply, false);
    setComposerEnabled(true);
  }
});
