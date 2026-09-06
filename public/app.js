const $ = (selector) => document.querySelector(selector);

const SESSION_KEY = "intent-commit:session:v2";
const state = {
  session: null,
  room: null,
  card: null,
  events: null,
};

const fields = [
  ["Core claim", "core_claim"],
  ["Communicative intention", "communicative_intention"],
  ["Explicit reasons", "explicit_reasons"],
  ["Possible assumptions", "assumptions"],
  ["Ambiguities", "ambiguities"],
  ["Possible misinterpretations", "possible_misinterpretations"],
  ["Questions for you", "questions_for_speaker"],
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLobbyError(message = "") {
  const node = $("#lobbyError");
  node.textContent = message;
  node.classList.toggle("hidden", !message);
}

function saveSession() {
  if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  else localStorage.removeItem(SESSION_KEY);
}

function loadSession() {
  try {
    state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    state.session = null;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function renderParticipants() {
  const root = $("#participants");
  root.innerHTML = "";
  for (const participant of state.room?.participants || []) {
    const pill = document.createElement("span");
    pill.className = "participant-pill";
    if (participant.id === state.session?.participantId) pill.classList.add("self");
    pill.textContent = participant.id === state.session?.participantId
      ? `${participant.name} · you`
      : participant.name;
    root.append(pill);
  }
}

function renderConversation() {
  const root = $("#conversation");
  root.innerHTML = "";
  const messages = state.room?.messages || [];

  if (!messages.length) {
    root.innerHTML = `
      <div class="empty-state">
        <strong>No committed statements yet.</strong>
        <p>Draft privately, inspect the agent's interpretation, then commit only when the final statement represents what you mean.</p>
      </div>`;
    return;
  }

  const template = $("#messageTemplate");
  for (const message of messages) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector(".message");
    const isSelf = message.author?.id === state.session?.participantId;
    article.classList.add(isSelf ? "from-self" : "from-other");
    node.querySelector(".speaker-name").textContent = isSelf
      ? `${message.author?.name || "Participant"} · you`
      : (message.author?.name || "Participant");
    node.querySelector("time").textContent = new Date(message.committedAt).toLocaleString();
    node.querySelector(".statement").textContent = message.statement;
    root.append(node);
  }
  root.scrollTop = root.scrollHeight;
}

function renderRoom() {
  if (!state.room || !state.session) return;
  $("#roomTitle").textContent = state.room.name;
  $("#roomBadge").textContent = `ROOM ${state.room.code}`;
  $("#roomBadge").classList.remove("hidden");
  $("#identityLabel").textContent = state.session.displayName;
  $("#roomMeta").textContent = `${state.room.participants.length} participant${state.room.participants.length === 1 ? "" : "s"} · ephemeral server memory`;
  renderParticipants();
  renderConversation();
}

function showWorkspace() {
  $("#lobby").classList.add("hidden");
  $("#workspace").classList.remove("hidden");
  $("#leaveBtn").classList.remove("hidden");
  renderRoom();
  clearPrivateWorkspace();
}

function showLobby(message = "") {
  state.room = null;
  state.card = null;
  if (state.events) state.events.close();
  state.events = null;
  $("#workspace").classList.add("hidden");
  $("#lobby").classList.remove("hidden");
  $("#leaveBtn").classList.add("hidden");
  $("#roomBadge").classList.add("hidden");
  if (state.session?.displayName) $("#displayName").value = state.session.displayName;
  setLobbyError(message);
}

function clearPrivateWorkspace() {
  state.card = null;
  $("#draft").value = "";
  $("#clarification").value = "";
  $("#finalStatement").value = "";
  $("#approveCheck").checked = false;
  $("#commitBtn").disabled = true;
  $("#reflectionStep").classList.add("hidden");
  $("#commitStep").classList.add("hidden");
  $("#draft").focus();
}

function renderIntentCard(card) {
  $("#intentCard").innerHTML = fields.map(([label, key]) => {
    const value = card[key];
    const body = Array.isArray(value)
      ? (value.length
          ? `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          : `<span class="none">None identified</span>`)
      : `<p>${escapeHtml(value || "Not identified")}</p>`;
    return `<section><h3>${label}</h3>${body}</section>`;
  }).join("");
}

function applySession(result, displayName) {
  state.room = result.room;
  state.session = {
    roomCode: result.room.code,
    participantId: result.session.participantId,
    participantToken: result.session.participantToken,
    displayName,
  };
  saveSession();
  const params = new URLSearchParams(location.search);
  params.set("room", result.room.code);
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  showWorkspace();
  connectEvents();
}

async function createRoom() {
  const displayName = $("#displayName").value.trim();
  const roomName = $("#roomName").value.trim();
  if (!displayName) return setLobbyError("Enter your display name first.");

  setLobbyError();
  $("#createRoomBtn").disabled = true;
  try {
    const result = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ displayName, roomName }),
    });
    applySession(result, displayName);
  } catch (error) {
    setLobbyError(error.message);
  } finally {
    $("#createRoomBtn").disabled = false;
  }
}

async function joinRoom() {
  const displayName = $("#displayName").value.trim();
  const code = $("#roomCode").value.trim().toUpperCase();
  if (!displayName) return setLobbyError("Enter your display name first.");
  if (!code) return setLobbyError("Enter a room code.");

  setLobbyError();
  $("#joinRoomBtn").disabled = true;
  try {
    const result = await api(`/api/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
    applySession(result, displayName);
  } catch (error) {
    setLobbyError(error.message);
  } finally {
    $("#joinRoomBtn").disabled = false;
  }
}

async function refreshRoom() {
  if (!state.session) return;
  const { roomCode, participantToken } = state.session;
  const data = await api(`/api/rooms/${encodeURIComponent(roomCode)}?token=${encodeURIComponent(participantToken)}`);
  state.room = data.room;
  renderRoom();
}

function connectEvents() {
  if (!state.session) return;
  if (state.events) state.events.close();

  const { roomCode, participantToken } = state.session;
  const events = new EventSource(`/api/rooms/${encodeURIComponent(roomCode)}/events?token=${encodeURIComponent(participantToken)}`);
  state.events = events;

  events.addEventListener("snapshot", (event) => {
    try {
      state.room = JSON.parse(event.data);
      renderRoom();
    } catch {
      // Ignore malformed event payloads; the connection can recover on the next snapshot.
    }
  });
}

async function restoreSession() {
  loadSession();
  if (!state.session?.roomCode || !state.session?.participantToken) {
    showLobby();
    return;
  }

  try {
    await refreshRoom();
    showWorkspace();
    connectEvents();
  } catch {
    const oldName = state.session.displayName || "";
    state.session = null;
    saveSession();
    $("#displayName").value = oldName;
    showLobby("That room session no longer exists. The v0.2 server stores rooms in memory, so a server restart clears them.");
  }
}

async function reflect() {
  if (!state.session) return;
  const draft = $("#draft").value.trim();
  const clarification = $("#clarification").value.trim();
  if (!draft) return $("#draft").focus();

  const buttons = [$("#reflectBtn"), $("#reReflectBtn")];
  buttons.forEach((button) => { button.disabled = true; });
  const oldLabel = $("#reflectBtn").textContent;
  $("#reflectBtn").textContent = "Reflecting…";

  try {
    const data = await api("/api/reflect", {
      method: "POST",
      body: JSON.stringify({
        draft,
        clarification,
        roomCode: state.session.roomCode,
        participantToken: state.session.participantToken,
      }),
    });

    state.card = data.card;
    renderIntentCard(state.card);
    $("#finalStatement").value = state.card.proposed_statement || draft;
    $("#approveCheck").checked = false;
    $("#commitBtn").disabled = true;
    $("#reflectionStep").classList.remove("hidden");
    $("#commitStep").classList.remove("hidden");
    $("#reflectionStep").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    alert(error.message);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
    $("#reflectBtn").textContent = oldLabel;
  }
}

async function commit() {
  if (!state.session) return;
  const statement = $("#finalStatement").value.trim();
  if (!statement || !$("#approveCheck").checked) return;

  $("#commitBtn").disabled = true;
  try {
    await api(`/api/rooms/${encodeURIComponent(state.session.roomCode)}/commit`, {
      method: "POST",
      body: JSON.stringify({
        participantToken: state.session.participantToken,
        statement,
        approved: true,
      }),
    });
    clearPrivateWorkspace();
    await refreshRoom();
  } catch (error) {
    alert(error.message);
    $("#commitBtn").disabled = false;
  }
}

async function leaveRoom() {
  if (!state.session) return;
  const previous = state.session;
  try {
    await api(`/api/rooms/${encodeURIComponent(previous.roomCode)}/leave`, {
      method: "POST",
      body: JSON.stringify({ participantToken: previous.participantToken }),
    });
  } catch {
    // Leaving locally still succeeds if the ephemeral server session already disappeared.
  }
  if (state.events) state.events.close();
  state.events = null;
  state.session = null;
  state.room = null;
  saveSession();
  history.replaceState(null, "", location.pathname);
  $("#displayName").value = previous.displayName || "";
  showLobby();
}

async function copyInvite() {
  if (!state.room) return;
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(state.room.code)}`;
  try {
    await navigator.clipboard.writeText(url);
    const button = $("#copyInviteBtn");
    const old = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = old; }, 1200);
  } catch {
    prompt("Copy this invite link:", url);
  }
}

async function checkHealth() {
  try {
    const data = await api("/api/health", { headers: {} });
    const badge = $("#modeBadge");
    badge.textContent = data.mode === "openai" ? `AI · ${data.model}` : "DEMO REFLECTOR";
    badge.title = data.mode === "openai"
      ? "Private drafts are sent to the configured server-side AI provider for reflection."
      : "No API key configured. The app uses a deterministic demo reflector.";
  } catch {
    $("#modeBadge").textContent = "offline";
  }
}

$("#createRoomBtn").addEventListener("click", createRoom);
$("#joinRoomBtn").addEventListener("click", joinRoom);
$("#roomCode").addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase(); });
$("#reflectBtn").addEventListener("click", reflect);
$("#reReflectBtn").addEventListener("click", reflect);
$("#approveCheck").addEventListener("change", (event) => {
  $("#commitBtn").disabled = !event.target.checked || !$("#finalStatement").value.trim();
});
$("#finalStatement").addEventListener("input", () => {
  $("#commitBtn").disabled = !$("#approveCheck").checked || !$("#finalStatement").value.trim();
});
$("#commitBtn").addEventListener("click", commit);
$("#leaveBtn").addEventListener("click", leaveRoom);
$("#copyInviteBtn").addEventListener("click", copyInvite);

const inviteRoom = new URLSearchParams(location.search).get("room");
if (inviteRoom) $("#roomCode").value = inviteRoom.toUpperCase();

checkHealth();
restoreSession();
