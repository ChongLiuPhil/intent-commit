const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "intent-commit:mvp:v1";
const state = {
  speaker: "A",
  messages: [],
  card: null,
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

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: state.messages }));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.messages = Array.isArray(saved.messages) ? saved.messages : [];
  } catch {
    state.messages = [];
  }
}

function renderConversation() {
  const root = $("#conversation");
  root.innerHTML = "";

  if (!state.messages.length) {
    root.innerHTML = `
      <div class="empty-state">
        <strong>No committed statements yet.</strong>
        <p>Speaker A can draft privately, reflect, approve, and commit the first message.</p>
      </div>`;
    return;
  }

  const template = $("#messageTemplate");
  for (const message of state.messages) {
    const node = template.content.cloneNode(true);
    node.querySelector(".message").classList.add(`from-${message.speaker.toLowerCase()}`);
    node.querySelector(".speaker-name").textContent = `Speaker ${message.speaker}`;
    node.querySelector("time").textContent = new Date(message.committedAt).toLocaleString();
    node.querySelector(".statement").textContent = message.statement;
    root.append(node);
  }
  root.scrollTop = root.scrollHeight;
}

function setSpeaker(speaker) {
  state.speaker = speaker;
  $$(".speaker").forEach((button) => {
    button.classList.toggle("active", button.dataset.speaker === speaker);
  });
  clearPrivateWorkspace();
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
  const html = fields.map(([label, key]) => {
    const value = card[key];
    const body = Array.isArray(value)
      ? (value.length ? `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<span class="none">None identified</span>`)
      : `<p>${escapeHtml(value || "Not identified")}</p>`;
    return `<section><h3>${label}</h3>${body}</section>`;
  }).join("");
  $("#intentCard").innerHTML = html;
}

async function reflect() {
  const draft = $("#draft").value.trim();
  const clarification = $("#clarification").value.trim();
  if (!draft) {
    $("#draft").focus();
    return;
  }

  const buttons = [$("#reflectBtn"), $("#reReflectBtn")];
  buttons.forEach((b) => { b.disabled = true; });
  const oldLabel = $("#reflectBtn").textContent;
  $("#reflectBtn").textContent = "Reflecting…";

  try {
    const response = await fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, clarification, history: state.messages }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Reflection failed.");

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
    buttons.forEach((b) => { b.disabled = false; });
    $("#reflectBtn").textContent = oldLabel;
  }
}

function commit() {
  const statement = $("#finalStatement").value.trim();
  if (!statement || !$("#approveCheck").checked) return;

  state.messages.push({
    id: crypto.randomUUID(),
    speaker: state.speaker,
    statement,
    committedAt: new Date().toISOString(),
  });
  save();
  renderConversation();

  const next = state.speaker === "A" ? "B" : "A";
  setSpeaker(next);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    const badge = $("#modeBadge");
    badge.textContent = data.mode === "openai" ? `AI · ${data.model}` : "DEMO REFLECTOR";
    badge.title = data.mode === "openai"
      ? "Private drafts are sent to the configured server-side AI provider for reflection."
      : "No API key configured. The app uses a deterministic local demo reflector.";
  } catch {
    $("#modeBadge").textContent = "offline";
  }
}

$$(".speaker").forEach((button) => button.addEventListener("click", () => setSpeaker(button.dataset.speaker)));
$("#reflectBtn").addEventListener("click", reflect);
$("#reReflectBtn").addEventListener("click", reflect);
$("#approveCheck").addEventListener("change", (event) => {
  $("#commitBtn").disabled = !event.target.checked || !$("#finalStatement").value.trim();
});
$("#finalStatement").addEventListener("input", () => {
  $("#commitBtn").disabled = !$("#approveCheck").checked || !$("#finalStatement").value.trim();
});
$("#commitBtn").addEventListener("click", commit);
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Delete the locally stored committed conversation?")) return;
  state.messages = [];
  localStorage.removeItem(STORAGE_KEY);
  renderConversation();
  clearPrivateWorkspace();
});

load();
renderConversation();
checkHealth();
