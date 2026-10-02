import { renderHome, renderLobby, renderMission, renderResult, timeLabel } from './render.js';

const app = document.querySelector('#app');
const connectionLabel = document.querySelector('#connection');
const notice = document.querySelector('#notice');
const inputs = {};
let socket;
let state = null;
let renderKey = '';
let manualTab = 'wires';
let pending = false;
let intentionalClose = false;
let retryTimer;
let retryCount = 0;
let submittingSession = false;
let savedSession = readStorage(sessionStorage, 'signal-session', null, (value) =>
  value && /^[A-Z2-9]{6}$/.test(value.code) && typeof value.token === 'string');
let profile = readStorage(localStorage, 'signal-profile', { name: '', wins: 0, completed: [] }, (value) =>
  value && typeof value.name === 'string' && Number.isInteger(value.wins) && value.wins >= 0
  && Array.isArray(value.completed) && value.completed.every((id) => typeof id === 'string'));
const invite = new URL(location.href).searchParams.get('room')?.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) ?? '';
const connectionDraft = { name: profile.name, code: invite };
let channelMode = invite ? 'join' : 'create';

function notify(text) {
  notice.querySelector('span').textContent = text;
  notice.hidden = false;
}

function readStorage(storage, key, fallback, isValid) {
  try {
    const value = storage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    if (!isValid(parsed)) throw new Error('Stored data has an invalid shape.');
    return parsed;
  } catch (error) {
    console.warn(`Unable to read ${key}:`, error);
    notify('Browser storage is unavailable or damaged. You can play, but refreshing may lose your session.');
    return fallback;
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to save ${key}:`, error);
    notify('Browser storage is unavailable. Your game works, but reconnect details and progress cannot be saved.');
  }
}

// Only meaningful state changes redraw controls; clock ticks must preserve focus and input.
function draw(force = false) {
  const signature = JSON.stringify(state, (key, value) => key === 'remaining' || key === 'elapsed' ? undefined : value);
  if (force || signature !== renderKey) {
    const active = document.activeElement;
    const focusId = active?.id;
    const selection = active instanceof HTMLInputElement && active.type === 'text' ? [active.selectionStart, active.selectionEnd] : null;
    app.innerHTML = !state ? renderHome({ name: connectionDraft.name, invite: connectionDraft.code, stats: profile, mode: channelMode })
      : !state.mission ? renderLobby(state)
        : state.mission.phase === 'playing' ? renderMission(state, manualTab, inputs)
          : renderResult(state);
    renderKey = signature;
    const next = focusId ? document.getElementById(focusId) : null;
    if (next) {
      next.focus({ preventScroll: true });
      if (selection && next instanceof HTMLInputElement) next.setSelectionRange(...selection);
    }
  }
  const timer = document.querySelector('#mission-timer');
  if (timer && state?.mission) {
    timer.textContent = timeLabel(state.mission.remaining);
    timer.classList.toggle('urgent', state.mission.remaining !== null && state.mission.remaining <= 60);
  }
  app.classList.toggle('transport-offline', socket?.readyState !== WebSocket.OPEN);
  for (const fieldset of app.querySelectorAll('fieldset')) fieldset.disabled = state?.paused || socket?.readyState !== WebSocket.OPEN;
  const pauseBanner = document.querySelector('#pause-banner');
  if (pauseBanner) {
    const offline = socket?.readyState !== WebSocket.OPEN;
    pauseBanner.hidden = !offline && !state.paused;
    pauseBanner.textContent = offline
      ? 'Connection lost. Reconnecting to your crew… Controls are locked until the relay is back.'
      : 'Partner disconnected. The clock is paused and controls are locked until they return.';
  }
}

function transmit(message) {
  if (socket?.readyState !== WebSocket.OPEN) { notify('The relay is reconnecting. Please wait a moment.'); return false; }
  socket.send(JSON.stringify(message));
  return true;
}

function clearSession() {
  savedSession = null;
  state = null;
  pending = false;
  submittingSession = false;
  writeStorage(sessionStorage, 'signal-session', null);
  for (const key of Object.keys(inputs)) delete inputs[key];
  draw(true);
}

function connect() {
  clearTimeout(retryTimer);
  connectionLabel.textContent = retryCount ? 'Reconnecting…' : 'Connecting…';
  connectionLabel.className = 'connection';
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/socket`);
  socket.addEventListener('open', () => {
    retryCount = 0;
    connectionLabel.textContent = 'Relay online';
    connectionLabel.className = 'connection online';
    if (savedSession) {
      submittingSession = true;
      transmit({ type: 'resume', ...savedSession });
    }
    draw();
  });
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); }
    catch (error) { console.error('Unreadable relay message:', error); notify('An unreadable response arrived from the relay. Refresh to reconnect.'); return; }
    if (message.type === 'session') {
      savedSession = { code: message.code, token: message.token };
      writeStorage(sessionStorage, 'signal-session', savedSession);
      submittingSession = false;
      pending = false;
      notice.hidden = true;
    } else if (message.type === 'state') {
      if (message.mission?.id !== state?.mission?.id) for (const key of Object.keys(inputs)) delete inputs[key];
      state = message;
      pending = false;
      if (state.mission?.phase === 'won' && !profile.completed.includes(state.mission.id)) {
        profile.wins++;
        profile.completed = [...profile.completed.slice(-99), state.mission.id];
        writeStorage(localStorage, 'signal-profile', profile);
      }
      draw();
    } else if (message.type === 'error') {
      if (submittingSession) clearSession();
      pending = false;
      const submit = app.querySelector('#room-form button:disabled');
      if (submit) submit.disabled = false;
      notify(message.text);
    } else if (message.type === 'left') {
      clearSession();
    }
  });
  socket.addEventListener('close', (event) => {
    connectionLabel.textContent = 'Relay offline';
    connectionLabel.className = 'connection offline';
    pending = false;
    draw(true);
    if (event.code === 4001) {
      intentionalClose = true;
      clearSession();
      notify('Your session was opened in another tab. Use that tab, or reload this page to create a new room.');
      return;
    }
    if (!intentionalClose) {
      const delay = Math.min(1000 * 2 ** retryCount++, 10000);
      retryTimer = setTimeout(connect, delay);
    }
  });
  socket.addEventListener('error', () => {
    connectionLabel.textContent = 'Connection trouble';
    connectionLabel.className = 'connection offline';
  });
}

document.querySelector('#help-toggle').addEventListener('click', (event) => {
  const help = document.querySelector('#help');
  help.hidden = !help.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
});
notice.querySelector('button').addEventListener('click', () => { notice.hidden = true; });
document.querySelector('.brand').addEventListener('click', (event) => {
  if (state) {
    event.preventDefault();
    notify('Use “Leave room” to exit your crew. During a mission, the host can end it first.');
  }
});

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'room-form') {
    if (pending) return;
    const name = form.elements.name.value.trim();
    const code = form.elements.code.value.trim().toUpperCase();
    const intent = event.submitter?.value ?? channelMode;
    if (!name) { notify('Enter your call sign first.'); return; }
    if (intent === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { notify('Enter your partner’s six-character room code.'); return; }
    profile.name = name;
    writeStorage(localStorage, 'signal-profile', profile);
    if (transmit({ type: intent, name, code })) {
      pending = true;
      submittingSession = true;
      if (event.submitter) event.submitter.disabled = true;
    }
  } else if (form.dataset.pulse) {
    if (state?.paused) return;
    transmit({ type: 'action', moduleId: form.dataset.pulse, value: form.elements.digits.value });
  }
});

app.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id === 'room-code') input.value = input.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (input.id === 'room-code') connectionDraft.code = input.value;
  if (input.id === 'player-name') connectionDraft.name = input.value;
  if (input.dataset.dial) {
    inputs[input.dataset.dial] = Number(input.value);
    document.getElementById(`output-${input.dataset.dial}`).textContent = (Number(input.value) / 10).toFixed(1);
  }
  if (input.name === 'digits') inputs[input.closest('form').dataset.pulse] = input.value;
});

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.mode) {
    channelMode = button.dataset.mode;
    draw(true);
    app.querySelector(`[data-mode="${channelMode}"]`)?.focus({ preventScroll: true });
  } else if (button.dataset.command) transmit({ type: button.dataset.command });
  else if (button.dataset.difficulty) transmit({ type: 'difficulty', value: button.dataset.difficulty });
  else if (button.dataset.manual) {
    manualTab = button.dataset.manual;
    draw(true);
    app.querySelector(`[data-manual="${manualTab}"]`)?.focus({ preventScroll: true });
  } else if (button.hasAttribute('data-copy')) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', state.code);
    try {
      await navigator.clipboard.writeText(url.href);
      notify('Invite copied. Send it to your partner!');
    } catch (error) {
      console.warn('Clipboard unavailable:', error);
      notify(`Clipboard unavailable. Share this link: ${url.href}`);
    }
  } else if (button.dataset.step) {
    const id = button.dataset.module;
    const slider = document.getElementById(`dial-${id}`);
    const value = Math.max(880, Math.min(960, Number(slider.value) + Number(button.dataset.step)));
    slider.value = value;
    inputs[id] = value;
    document.getElementById(`output-${id}`).textContent = (value / 10).toFixed(1);
  } else if (button.dataset.action) {
    if (state?.paused) return;
    const value = button.dataset.action === 'wire' ? Number(button.dataset.value)
      : button.dataset.action === 'glyph' ? button.dataset.value
        : Number(document.getElementById(`dial-${button.dataset.module}`).value);
    transmit({ type: 'action', moduleId: button.dataset.module, value });
  } else if (button.hasAttribute('data-confirm-abort')) {
    if (button.dataset.confirm === 'yes') transmit({ type: 'abort' });
    else {
      button.dataset.confirm = 'yes';
      button.textContent = 'Confirm end mission';
      setTimeout(() => {
        if (button.isConnected) { delete button.dataset.confirm; button.textContent = 'End this mission'; }
      }, 5000);
    }
  }
});

draw(true);
connect();
