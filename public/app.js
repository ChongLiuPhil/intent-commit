const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  user: null,
  rooms: [],
  room: null,
  card: null,
  events: null,
  federation: {
    enabled: false,
    issuer: null,
    publications: [],
    events: [],
    provenance: [],
    argumentMaps: [],
    graphNodes: [],
  },
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
    error.data = data;
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

function resetFederationState() {
  state.federation.publications = [];
  state.federation.events = [];
  state.federation.provenance = [];
  state.federation.argumentMaps = [];
  state.federation.graphNodes = [];
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

function memberActions(participant) {
  if (!state.room || participant.id === state.user.id) return "";
  const actorRole = state.room.membership.role;
  const userId = escapeHtml(participant.id);
  const controls = [];
  if (actorRole === "owner" && participant.role !== "owner") {
    const nextRole = participant.role === "moderator" ? "member" : "moderator";
    controls.push(`<button class="ghost small" data-member-action="role" data-user-id="${userId}" data-role="${nextRole}">${nextRole === "moderator" ? "Promote" : "Demote"}</button>`);
    controls.push(`<button class="ghost small" data-member-action="transfer" data-user-id="${userId}">Make owner</button>`);
    controls.push(`<button class="ghost small" data-member-action="remove" data-user-id="${userId}">Remove</button>`);
  } else if (actorRole === "moderator" && participant.role === "member") {
    controls.push(`<button class="ghost small" data-member-action="remove" data-user-id="${userId}">Remove</button>`);
  }
  return controls.length ? `<span class="member-actions">${controls.join("")}</span>` : "";
}

async function runMemberAction(button) {
  if (!state.room) return;
  const userId = button.dataset.userId;
  const participant = state.room.participants.find((p) => p.id === userId);
  if (!participant) return;
  errorAt("roomError");
  try {
    if (button.dataset.memberAction === "role") {
      const data = await api(`/api/rooms/${state.room.code}/members/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: button.dataset.role }),
      });
      state.room = data.room;
      renderRoom();
      return;
    }
    if (button.dataset.memberAction === "transfer") {
      if (!confirm(`Transfer room ownership to ${participant.displayName}? You will become a regular member.`)) return;
      const data = await api(`/api/rooms/${state.room.code}/ownership`, {
        method: "POST",
        body: JSON.stringify({ targetUserId: userId }),
      });
      state.room = data.room;
      await refreshMe();
      renderRoom();
      return;
    }
    if (button.dataset.memberAction === "remove") {
      if (!confirm(`Remove ${participant.displayName} from this room?`)) return;
      const data = await api(`/api/rooms/${state.room.code}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
      state.room = data.room;
      renderRoom();
    }
  } catch (error) {
    errorAt("roomError", error.message);
  }
}

function federationPublication(messageId) {
  return state.federation.publications.find((item) => item.messageId === messageId) || null;
}

function federationRelation(messageId) {
  const publication = federationPublication(messageId);
  if (!publication) return null;
  return state.federation.events.find((item) => item.subjectUri === publication.canonicalUri) || null;
}

function provenanceForMessage(messageId) {
  const publication = federationPublication(messageId);
  if (!publication) return [];
  return state.federation.provenance.filter((item) => item.sourceUri === publication.canonicalUri);
}

function argumentMapForMessage(messageId) {
  return state.federation.argumentMaps.find((item) => item.messageId === messageId) || null;
}

async function refreshFederation() {
  resetFederationState();
  if (!state.room || !state.federation.enabled) return;
  try {
    const [roomData, graphData] = await Promise.all([
      api(`/api/rooms/${state.room.code}/federation`),
      api("/federation/graph"),
    ]);
    state.federation.publications = roomData.publications || [];
    state.federation.events = roomData.events || [];
    state.federation.provenance = roomData.provenance || [];
    state.federation.argumentMaps = roomData.argumentMaps || [];
    state.federation.graphNodes = graphData.nodes || [];
  } catch (error) {
    console.error("Could not load federation state", error);
  }
}

async function publishToFederation(messageId) {
  if (!state.room || !state.federation.enabled) return;
  const message = state.room.messages.find((item) => item.id === messageId);
  if (!message || message.author.id !== state.user.id) return;
  if (!confirm("Publish this committed statement to the federation? This creates a public, signed canonical URI. Copies made by other systems cannot be recalled by deleting this room.")) return;
  errorAt("roomError");
  try {
    const data = await api(`/api/rooms/${state.room.code}/federation/publish`, {
      method: "POST",
      body: JSON.stringify({ messageId, approved: true }),
    });
    state.federation.publications.push(data.publication);
    await refreshFederation();
    renderRoom();
  } catch (error) {
    if (error.status === 409 && error.data?.publication) {
      await refreshFederation();
      renderRoom();
      return;
    }
    errorAt("roomError", error.message);
  }
}

async function retractFederatedMessage(messageId) {
  if (!state.room || federationRelation(messageId)) return;
  const message = state.room.messages.find((item) => item.id === messageId);
  if (!message || message.author.id !== state.user.id) return;
  const reason = prompt("Optional public reason for retraction. Leave blank for no reason.", "");
  if (reason === null) return;
  if (!confirm("Publish a signed retraction? The original utterance remains verifiable; this adds a public statement that you no longer endorse it.")) return;
  errorAt("roomError");
  try {
    await api(`/api/rooms/${state.room.code}/federation/retract`, {
      method: "POST",
      body: JSON.stringify({ messageId, approved: true, reason }),
    });
    await refreshFederation();
    renderRoom();
  } catch (error) {
    errorAt("roomError", error.message);
  }
}

function revisionCandidates(messageId) {
  return state.room.messages.filter((candidate) => {
    if (candidate.id === messageId || candidate.author.id !== state.user.id) return false;
    if (!federationPublication(candidate.id)) return false;
    return federationRelation(candidate.id)?.type !== "federated-retraction";
  });
}

async function reviseFederatedMessage(messageId) {
  if (!state.room || federationRelation(messageId)) return;
  const message = state.room.messages.find((item) => item.id === messageId);
  if (!message || message.author.id !== state.user.id) return;
  const candidates = revisionCandidates(messageId);
  if (!candidates.length) {
    errorAt("roomError", "To revise this utterance, first create a new committed statement through the normal reflection flow and publish that new statement to federation.");
    return;
  }
  const menu = candidates.map((item, index) => `${index + 1}. ${item.statement.slice(0, 100)}${item.statement.length > 100 ? "…" : ""}`).join("\n");
  const choice = prompt(`Choose the already-federated replacement by number:\n\n${menu}`, "1");
  if (choice === null) return;
  const replacement = candidates[Number(choice) - 1];
  if (!replacement) return errorAt("roomError", "Invalid replacement selection.");
  const reason = prompt("Optional public reason for the revision link.", "");
  if (reason === null) return;
  if (!confirm("Publish a signed revision relation? The original remains part of the public record and will point to the replacement utterance.")) return;
  errorAt("roomError");
  try {
    await api(`/api/rooms/${state.room.code}/federation/revise`, {
      method: "POST",
      body: JSON.stringify({ messageId, replacementMessageId: replacement.id, approved: true, reason }),
    });
    await refreshFederation();
    renderRoom();
  } catch (error) {
    errorAt("roomError", error.message);
  }
}

async function createProvenance(messageId, predicate) {
  if (!state.room || !state.federation.enabled || federationRelation(messageId)) return;
  const message = state.room.messages.find((item) => item.id === messageId);
  const sourcePublication = federationPublication(messageId);
  if (!message || message.author.id !== state.user.id || !sourcePublication) return;

  const candidates = state.federation.graphNodes.filter((node) => node.messageId !== messageId);
  if (!candidates.length) {
    errorAt("roomError", "A provenance edge needs another already-federated utterance as its target.");
    return;
  }

  const menu = candidates.map((node, index) => {
    const lifecycle = node.lifecycle?.type === "federated-retraction" ? " [retracted]" : node.lifecycle?.type === "federated-revision" ? " [revised]" : "";
    const author = node.author?.displayName || "Unknown";
    const statement = String(node.statement || "").replace(/\s+/g, " ");
    return `${index + 1}. ${author}: ${statement.slice(0, 110)}${statement.length > 110 ? "…" : ""}${lifecycle}`;
  }).join("\n");

  const choice = prompt(`Choose the public utterance this statement ${predicate}:\n\n${menu}`, "1");
  if (choice === null) return;
  const target = candidates[Number(choice) - 1];
  if (!target) return errorAt("roomError", "Invalid provenance target selection.");
  const note = prompt(`Optional public note explaining why this statement ${predicate} the target.`, "");
  if (note === null) return;
  if (!confirm(`Publish a signed '${predicate}' edge? This is a new public assertion by you about the relationship between two public utterances.`)) return;

  errorAt("roomError");
  try {
    await api(`/api/rooms/${state.room.code}/federation/provenance`, {
      method: "POST",
      body: JSON.stringify({
        sourceMessageId: messageId,
        targetMessageId: target.messageId,
        predicate,
        note,
        approved: true,
      }),
    });
    await refreshFederation();
    renderRoom();
  } catch (error) {
    errorAt("roomError", error.message);
  }
}

async function publishArgumentMap(messageId) {
  if (!state.room || !state.federation.enabled || argumentMapForMessage(messageId)) return;
  const message = state.room.messages.find((item) => item.id === messageId);
  if (!message || message.author.id !== state.user.id || !federationPublication(messageId)) return;
  errorAt("roomError");
  try {
    const suggestion = await api(`/api/rooms/${state.room.code}/arguments/suggest`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    });
    const draft = JSON.stringify(suggestion.structure, null, 2);
    const edited = prompt(
      "Private AI suggestion only. Review and edit this JSON before anything becomes public. Node kinds: claim/reason/objection/qualification. Edge predicates: supports/challenges/qualifies.",
      draft,
    );
    if (edited === null) return;
    let structure;
    try {
      structure = JSON.parse(edited);
    } catch {
      return errorAt("roomError", "Argument structure must be valid JSON.");
    }
    if (!confirm("Publish this argument structure as your signed public interpretation of this utterance? It becomes a separate immutable federation object.")) return;
    await api(`/api/rooms/${state.room.code}/federation/arguments`, {
      method: "POST",
      body: JSON.stringify({ messageId, nodes: structure.nodes, edges: structure.edges || [], approved: true }),
    });
    await refreshFederation();
    renderRoom();
  } catch (error) {
    if (error.status === 409 && error.data?.argumentMap) {
      await refreshFederation();
      renderRoom();
      return;
    }
    errorAt("roomError", error.message);
  }
}

function renderRoom() {
  if (!state.room) return;
  $("#roomTitle").textContent = state.room.name;
  $("#roomCodeBadge").textContent = `${state.room.code} · ${state.room.membership.role}`;
  $("#memberList").innerHTML = state.room.participants
    .map((p) => `<span class="member"><span><strong>${escapeHtml(p.displayName)}</strong> · ${escapeHtml(p.role)}</span>${memberActions(p)}</span>`)
    .join("");
  $$('[data-member-action]').forEach((button) => button.addEventListener("click", () => runMemberAction(button)));

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
    const mine = message.author.id === state.user.id;
    if (mine) article.classList.add("mine");
    node.querySelector(".speaker-name").textContent = message.author.displayName;
    node.querySelector("time").textContent = new Date(message.committedAt).toLocaleString();
    node.querySelector(".statement").textContent = message.statement;

    const actions = node.querySelector(".message-actions");
    const publication = federationPublication(message.id);
    const relation = federationRelation(message.id);
    const provenance = provenanceForMessage(message.id);
    const argumentMap = argumentMapForMessage(message.id);

    if (publication) {
      const link = document.createElement("a");
      link.className = "federation-link";
      link.href = publication.canonicalUri;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Federated · signed URI ↗";
      actions.append(link);

      if (argumentMap) {
        const mapLink = document.createElement("a");
        mapLink.className = "federation-link argument-map-link";
        mapLink.href = argumentMap.mapUri;
        mapLink.target = "_blank";
        mapLink.rel = "noopener noreferrer";
        mapLink.textContent = "Argument map · signed ↗";
        actions.append(mapLink);
      }

      for (const edge of provenance) {
        const edgeLink = document.createElement("a");
        edgeLink.className = `federation-link provenance-link predicate-${edge.predicate}`;
        edgeLink.href = edge.edgeUri;
        edgeLink.target = "_blank";
        edgeLink.rel = "noopener noreferrer";
        edgeLink.textContent = `${edge.predicate} →`;
        edgeLink.title = edge.targetUri;
        actions.append(edgeLink);
      }

      if (relation) {
        article.classList.add(relation.type === "federated-retraction" ? "is-retracted" : "is-revised");
        const eventLink = document.createElement("a");
        eventLink.className = "federation-link relation-link";
        eventLink.href = relation.eventUri;
        eventLink.target = "_blank";
        eventLink.rel = "noopener noreferrer";
        eventLink.textContent = relation.type === "federated-retraction" ? "Retracted · signed event ↗" : "Revised · signed event ↗";
        actions.append(eventLink);
        if (relation.replacementUri) {
          const replacementLink = document.createElement("a");
          replacementLink.className = "federation-link";
          replacementLink.href = relation.replacementUri;
          replacementLink.target = "_blank";
          replacementLink.rel = "noopener noreferrer";
          replacementLink.textContent = "Replacement ↗";
          actions.append(replacementLink);
        }
      } else if (mine) {
        if (!argumentMap) {
          const structureButton = document.createElement("button");
          structureButton.className = "ghost small argument-action";
          structureButton.textContent = "Structure…";
          structureButton.title = "Privately suggest, review, then explicitly publish a signed argument map.";
          structureButton.addEventListener("click", () => publishArgumentMap(message.id));
          actions.append(structureButton);
        }

        for (const [predicate, label] of [["cites", "Cite…"], ["supports", "Support…"], ["challenges", "Challenge…"]]) {
          const button = document.createElement("button");
          button.className = "ghost small provenance-action";
          button.textContent = label;
          button.addEventListener("click", () => createProvenance(message.id, predicate));
          actions.append(button);
        }

        const retractButton = document.createElement("button");
        retractButton.className = "ghost small";
        retractButton.textContent = "Retract";
        retractButton.addEventListener("click", () => retractFederatedMessage(message.id));
        actions.append(retractButton);

        const reviseButton = document.createElement("button");
        reviseButton.className = "ghost small";
        reviseButton.textContent = "Revise…";
        reviseButton.addEventListener("click", () => reviseFederatedMessage(message.id));
        actions.append(reviseButton);
      }
    } else if (mine && state.federation.enabled) {
      const button = document.createElement("button");
      button.className = "ghost small";
      button.textContent = "Publish to federation";
      button.addEventListener("click", () => publishToFederation(message.id));
      actions.append(button);
    } else {
      actions.classList.add("hidden");
    }
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
  events.addEventListener("snapshot", async (event) => {
    state.room = JSON.parse(event.data);
    await refreshFederation();
    renderRoom();
  });
  events.addEventListener("error", () => {
    if (events.readyState === EventSource.CLOSED) errorAt("roomError", "Live room connection closed. You may no longer be a member of this room.");
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
  resetFederationState();
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
    await refreshFederation();
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
    state.federation.enabled = Boolean(health.federation?.enabled);
    state.federation.issuer = health.federation?.issuer || null;
    const federationMark = state.federation.enabled ? ` · FED ${health.federation.version}` : "";
    $("#modeBadge").textContent = health.mode === "openai"
      ? `v${health.version} · protocol ${health.protocolVersion} · AI${federationMark}`
      : `v${health.version} · protocol ${health.protocolVersion} · DEMO${federationMark}`;
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
  resetFederationState();
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
    await refreshFederation();
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
    await refreshFederation();
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
