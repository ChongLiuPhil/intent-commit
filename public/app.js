const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  user: null,
  rooms: [],
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

function show(view) {
  ["authView", "lobbyView", "roomView"].forEach((id) => $(`#${id}`).classList.toggle("hidden", id !== view));
}

function errorAt(id, message = "") {
  const node = $(`#${id}`);
  node.textContent = message;
  node.classList.toggle("hidden", !message);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function roomFromUrl() {
  return new URLSearchParams(location.search).get("room")?.trim().toUpperCase() || "";
}

function setRoomUrl(code = "") {
  const url = new URL(location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  history.pushState({}, "", url);
}

function resetPrivateWorkspace() {
  state.card = null;
  $("#draft").value = "";
  $("#clarification").value = "";
  $("#finalStatement").value = "";
  $("#approveCheck").checked = false;
  $("#commitBtn").disabled = true;
  $("#reflectionStep").classList.add("hidden");
  $("#commitStep").classList.add("hidden");
}

function renderUser() {
  $("#userBadge").textContent = state.user ? state.user.displayName : "";
  $("#userBadge").classList.toggle("hidden", !state.user);
  $("#logoutBtn").classList.toggle("hidden", !state.user);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRooms() {
  const root = $("#roomList");
  root.innerHTML = "";
  if (!state.rooms.length) {
    root.innerHTML = `<div class="empty-state"><strong>No persistent rooms yet.</strong><p>Create one or join with an invite code.</p></div>`;
    return;
  }
  for (const room of state.rooms) {
    const button = document.createElement("button");
    button.className = "room-row";
    button.innerHTML = `<span><strong>${escapeHtml(room.name)}</strong><small>${escapeHtml(room.code)} · ${escapeHtml(room.role)}</small></span><span>Open →</span>`;
    button.addEventListener("click", () => openRoom(room.code));
    root.append(button);
  }
}

function renderRoom() {
  if (!state.room) return;
  $("#roomTitle").textContent = state.room.name;
  $("#roomCodeBadge").textContent = state.room.code;
  $("#memberList").innerHTML = state.room.participants
    .map((p) => `<span class="member"><strong>${escapeHtml(p.displayName)}</strong>${p.role === "owner" ? " · owner" : ""}</span>`)
    .join("");

  const root = $("#conversation");
  root.innerHTML = "";
  if (!state.room.messages.length) {
    root.innerHTML = `<div class="empty-state"><strong>No committed statements yet.</strong><p>Draft privately, reflect, approve, and commit the first one.</p></div>`;
    return;
  }
  const template = $("#messageTemplate");
  for (const message of state.room.messages) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector(".message");
    if (message.author.id === state.user.id) article.classList.add("mine");
    node.querySelector(".speaker-name").textContent = message.author.displayName;
    node.querySelector("time").textContent = new Date(message.committedAt).toLocaleString();
    node.querySelector(".statement").textContent = message.statement;
    root.append(node);
  }
  root.scrollTop = root.scrollHeight;
}

function renderIntentCard(card) {
  $("#intentCard").innerHTML = fields.map(([label, key]) => {
    const value = card[key];
    const body = Array.isArray(value)
      ? (value.length ? `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<span class="none">None identified</span>`)
      : `<p>${escapeHtml(value || "Not identified")}</p>`;
    return `<section><h3>${label}</h3>${body}</section>`;
  }).join("");
}

function closeEvents() {
  if (state.events) state.events.close();
  state.events = null;
}

function connectEvents() {
  closeEvents();
  if (!state.room) return;
  const events = new EventSource(`/api/rooms/${state.room.code}/events`);
  events.addEventListener("snapshot", (event) => {
    state.room = JSON.parse(event.data);
    renderRoom();
  });
  state.events = events;
}

async function refreshMe() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    state.rooms = data.rooms || [];
    renderUser();
    return true;
  } catch (error) {
    if (error.status !== 401) console.error(error);
    state.user = null;
    state.rooms = [];
    renderUser();
    return false;
  }
}

async function enterLobby() {
  closeEvents();
  state.room = null;
  await refreshMe();
  renderRooms();
  show("lobbyView");
  const invited = roomFromUrl();
  if (invited) $("#joinCode").value = invited;
}

async function openRoom(code, { updateUrl = true } = {}) {
  try {
    errorAt("lobbyError");
    const data = await api(`/api/rooms/${encodeURIComponent(code)}`);
    state.room = data.room;
    if (updateUrl) setRoomUrl(state.room.code);
    resetPrivateWorkspace();
    renderRoom();
    show("roomView");
    connectEvents();
  } catch (error) {
    if (error.status === 403 && roomFromUrl() === code) {
      $("#joinCode").value = code;
      setRoomUrl("");
    }
    errorAt("lobbyError", error.message);
    show("lobbyView");
  }
}

async function reflect() {
  if (!state.room) return;
  const draft = $("#draft").value.trim();
  const clarification = $("#clarification").value.trim();
  if (!draft) return $("#draft").focus();
  [$("#reflectBtn"), $("#reReflectBtn")].forEach((b) => { b.disabled = true; });
  errorAt("roomError");
  try {
    const data = await api("/api/reflect", {
      method: "POST",
      body: JSON.stringify({ roomCode: state.room.code, draft, clarification }),
    });
    state.card = data.card;
    renderIntentCard(data.card);
    $("#finalStatement").value = data.card.proposed_statement || draft;
    $("#approveCheck").checked = false;
    $("#commitBtn").disabled = true;
    $("#reflectionStep").classList.remove("hidden");
    $("#commitStep").classList.remove("hidden");
  } catch (error) {
    errorAt("roomError", error.message);
  } finally {
    [$("#reflectBtn"), $("#reReflectBtn")].forEach((b) => { b.disabled = false; });
  }
}

async function commit() {
  const statement = $("#finalStatement").value.trim();
  if (!state.room || !statement || !$("#approveCheck").checked) return;
  $("#commitBtn").disabled = true;
  errorAt("roomError");
  try {
    await api(`/api/rooms/${state.room.code}/commit`, {
      method: "POST",
      body: JSON.stringify({ statement, approved: true }),
    });
    resetPrivateWorkspace();
  } catch (error) {
    errorAt("roomError", error.message);
    $("#commitBtn").disabled = false;
  }
}

async function init() {
  try {
    const health = await api("/api/health");
    $("#modeBadge").textContent = health.mode === "openai" ? `AI · ${health.model}` : `v${health.version} · SQLITE · DEMO`;
  } catch {
    $("#modeBadge").textContent = "offline";
  }
  const signedIn = await refreshMe();
  if (!signedIn) return show("authView");
  renderRooms();
  const code = roomFromUrl();
  if (code) await openRoom(code, { updateUrl: false });
  else show("lobbyView");
}

$$('[data-auth-tab]').forEach((button) => button.addEventListener("click", () => {
  $$('[data-auth-tab]').forEach((b) => b.classList.toggle("active", b === button));
  $("#loginForm").classList.toggle("hidden", button.dataset.authTab !== "login");
  $("#registerForm").classList.toggle("hidden", button.dataset.authTab !== "register");
  errorAt("authError");
}));

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    errorAt("authError");
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: $("#loginUsername").value, password: $("#loginPassword").value }),
    });
    state.user = data.user;
    state.rooms = data.rooms || [];
    renderUser();
    renderRooms();
    const code = roomFromUrl();
    if (code) $("#joinCode").value = code;
    show("lobbyView");
  } catch (error) {
    errorAt("authError", error.message);
  }
});

$("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    errorAt("authError");
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: $("#registerUsername").value,
        displayName: $("#registerDisplayName").value,
        password: $("#registerPassword").value,
      }),
    });
    state.user = data.user;
    state.rooms = [];
    renderUser();
    renderRooms();
    const code = roomFromUrl();
    if (code) $("#joinCode").value = code;
    show("lobbyView");
  } catch (error) {
    errorAt("authError", error.message);
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  closeEvents();
  state.user = null;
  state.rooms = [];
  state.room = null;
  renderUser();
  show("authView");
});

$("#createRoomForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ roomName: $("#roomName").value }),
    });
    await refreshMe();
    renderRooms();
    state.room = data.room;
    setRoomUrl(data.room.code);
    renderRoom();
    show("roomView");
    connectEvents();
    resetPrivateWorkspace();
  } catch (error) {
    errorAt("lobbyError", error.message);
  }
});

$("#joinRoomForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#joinCode").value.trim().toUpperCase();
  if (!code) return;
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST", body: "{}" });
    await refreshMe();
    renderRooms();
    state.room = data.room;
    setRoomUrl(data.room.code);
    renderRoom();
    show("roomView");
    connectEvents();
    resetPrivateWorkspace();
  } catch (error) {
    errorAt("lobbyError", error.message);
  }
});

$("#copyInviteBtn").addEventListener("click", async () => {
  if (!state.room) return;
  const url = new URL(location.origin);
  url.searchParams.set("room", state.room.code);
  await navigator.clipboard.writeText(url.toString());
  const old = $("#copyInviteBtn").textContent;
  $("#copyInviteBtn").textContent = "Copied";
  setTimeout(() => { $("#copyInviteBtn").textContent = old; }, 1200);
});

$("#leaveRoomBtn").addEventListener("click", async () => {
  if (!state.room || !confirm("Leave this room? Its committed history will remain for other members.")) return;
  try {
    await api(`/api/rooms/${state.room.code}/leave`, { method: "POST", body: "{}" });
    setRoomUrl("");
    await enterLobby();
  } catch (error) {
    errorAt("roomError", error.message);
  }
});

$("#reflectBtn").addEventListener("click", reflect);
$("#reReflectBtn").addEventListener("click", reflect);
$("#commitBtn").addEventListener("click", commit);
$("#approveCheck").addEventListener("change", () => {
  $("#commitBtn").disabled = !$("#approveCheck").checked || !$("#finalStatement").value.trim();
});
$("#finalStatement").addEventListener("input", () => {
  $("#commitBtn").disabled = !$("#approveCheck").checked || !$("#finalStatement").value.trim();
});
window.addEventListener("popstate", async () => {
  if (!state.user) return;
  const code = roomFromUrl();
  if (code) await openRoom(code, { updateUrl: false });
  else await enterLobby();
});

init();
