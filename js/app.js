import { supabase } from "./supabaseClient.js";
import { countryName, flagEmoji } from "./countries.js";

const state = {
  guest: loadGuest(),
  selectedMatch: null,
  chatChannel: null
};

const ui = {
  upcomingList: document.getElementById("upcomingList"),
  pastList: document.getElementById("pastList"),
  joinBtn: document.getElementById("joinBtn"),
  userBadge: document.getElementById("userBadge"),
  joinModal: document.getElementById("joinModal"),
  joinForm: document.getElementById("joinForm"),
  nameInput: document.getElementById("nameInput"),
  countryInput: document.getElementById("countryInput"),
  cancelJoinBtn: document.getElementById("cancelJoinBtn"),
  chatPanel: document.getElementById("chatPanel"),
  chatMatchTitle: document.getElementById("chatMatchTitle"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  closeChatBtn: document.getElementById("closeChatBtn")
};

ui.joinBtn.addEventListener("click", () => toggleJoinModal(true));
ui.cancelJoinBtn.addEventListener("click", () => toggleJoinModal(false));
ui.closeChatBtn.addEventListener("click", closeChatPanel);
ui.joinForm.addEventListener("submit", onJoinSubmit);
ui.chatForm.addEventListener("submit", onChatSubmit);

await bootstrap();

async function bootstrap() {
  renderGuestBadge();
  await Promise.all([loadUpcomingMatches(), loadPastMatches()]);
}

function loadGuest() {
  try {
    const raw = localStorage.getItem("wc_guest");
    if (!raw) return null;

    const guest = JSON.parse(raw);
    if (!guest.guest_id) {
      guest.guest_id = newGuestId();
      localStorage.setItem("wc_guest", JSON.stringify(guest));
    }
    return guest;
  } catch {
    return null;
  }
}

function newGuestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function saveGuest(guest) {
  localStorage.setItem("wc_guest", JSON.stringify(guest));
  state.guest = guest;
  renderGuestBadge();
}

function renderGuestBadge() {
  if (!state.guest) {
    ui.userBadge.classList.add("d-none");
    return;
  }

  const pt = state.guest.country_code === "PT" ? " · Portugal Supporter" : "";
  ui.userBadge.textContent = `${flagEmoji(state.guest.country_code)} ${state.guest.display_name}${pt}`;
  ui.userBadge.classList.remove("d-none");
}

async function loadUpcomingMatches() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("kickoff_at", now)
    .order("kickoff_at", { ascending: true })
    .limit(30);

  if (error) return showDataError(ui.upcomingList, error.message);

  const sorted = (data || []).sort((a, b) => {
    const aPT = involvesPortugal(a);
    const bPT = involvesPortugal(b);
    if (aPT && !bPT) return -1;
    if (!aPT && bPT) return 1;
    return new Date(a.kickoff_at) - new Date(b.kickoff_at);
  });

  ui.upcomingList.innerHTML = "";
  if (!sorted.length) {
    ui.upcomingList.innerHTML = `<p class="text-light-emphasis">No upcoming matches loaded yet.</p>`;
    return;
  }

  sorted.forEach((match) => ui.upcomingList.appendChild(renderMatchCard(match, false)));
}

async function loadPastMatches() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .lt("kickoff_at", now)
    .order("kickoff_at", { ascending: false })
    .limit(30);

  if (error) return showDataError(ui.pastList, error.message);

  ui.pastList.innerHTML = "";
  if (!data?.length) {
    ui.pastList.innerHTML = `<p class="text-light-emphasis">No past results yet.</p>`;
    return;
  }

  data.forEach((match) => ui.pastList.appendChild(renderMatchCard(match, true)));
}

function renderMatchCard(match, isPast) {
  const col = document.createElement("div");
  col.className = "col-12 col-md-6 col-lg-4";

  const ptClass = involvesPortugal(match) ? "portugal" : "";
  const kickoff = new Date(match.kickoff_at).toLocaleString();
  const score = isPast
    ? `<div class="fw-bold">${match.home_score ?? "-"} : ${match.away_score ?? "-"}</div>`
    : "";

  col.innerHTML = `
    <article class="match-card ${ptClass}">
      <div class="match-body">
        <div class="match-top">${match.stage || "Group Stage"} · ${kickoff}</div>
        <div class="match-teams">${flagEmoji(match.home_code)} ${match.home_team} vs ${flagEmoji(match.away_code)} ${match.away_team}</div>
        ${score}
        ${isPast ? "" : `
          <div class="prediction-row">
            <button class="btn-vote" data-vote="home">Vote ${match.home_team}</button>
            <button class="btn-vote" data-vote="draw">Vote Draw</button>
            <button class="btn-vote" data-vote="away">Vote ${match.away_team}</button>
          </div>
          <div class="vote-summary" id="vote-${match.id}">Loading votes...</div>
        `}
        <button class="btn btn-sm btn-outline-light mt-2" data-chat="1">Open Chat</button>
      </div>
    </article>
  `;

  const chatBtn = col.querySelector("[data-chat]");
  chatBtn.addEventListener("click", () => openChatPanel(match));

  if (!isPast) {
    col.querySelectorAll("[data-vote]").forEach((btn) => {
      btn.addEventListener("click", () => onVote(match, btn.dataset.vote));
    });
    loadVoteSummary(match.id);
  }

  return col;
}

function involvesPortugal(match) {
  return match.home_code === "PT" || match.away_code === "PT";
}

async function onVote(match, voteType) {
  if (!state.guest) return toggleJoinModal(true);

  const payload = {
    match_id: match.id,
    guest_id: state.guest.guest_id,
    guest_name: state.guest.display_name,
    country_code: state.guest.country_code,
    vote_type: voteType
  };

  const { error } = await supabase.from("predictions").insert(payload);
  if (error) {
    if (error.code === "23505") {
      alert("You already voted for this match. One vote per user is allowed.");
      return;
    }
    alert(`Prediction error: ${error.message}`);
    return;
  }
  await loadVoteSummary(match.id);
}

async function loadVoteSummary(matchId) {
  const target = document.getElementById(`vote-${matchId}`);
  if (!target) return;

  const { data, error } = await supabase
    .from("predictions")
    .select("vote_type")
    .eq("match_id", matchId);

  if (error) {
    target.textContent = "Could not load votes.";
    return;
  }

  const total = data.length;
  const counts = { home: 0, draw: 0, away: 0 };
  data.forEach((row) => (counts[row.vote_type] += 1));

  if (!total) {
    target.textContent = "No votes yet.";
    return;
  }

  target.textContent = `Votes: Home ${pct(counts.home, total)} | Draw ${pct(counts.draw, total)} | Away ${pct(counts.away, total)} (${total} total)`;
}

function pct(count, total) {
  return `${Math.round((count / total) * 100)}%`;
}

function toggleJoinModal(open) {
  ui.joinModal.classList.toggle("d-none", !open);
}

function onJoinSubmit(event) {
  event.preventDefault();

  const display_name = ui.nameInput.value.trim();
  const country_code = ui.countryInput.value;
  if (!display_name || !country_code) return;

  saveGuest({
    guest_id: state.guest?.guest_id || newGuestId(),
    display_name,
    country_code
  });
  ui.joinForm.reset();
  toggleJoinModal(false);
}

function showDataError(target, message) {
  target.innerHTML = `<p class="text-warning">Error: ${message}</p>`;
}

async function openChatPanel(match) {
  state.selectedMatch = match;
  ui.chatPanel.classList.add("open");
  setTimeout(() => {
    ui.chatInput?.focus();
    ui.chatInput?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 50);
  ui.chatMatchTitle.textContent = `${match.home_team} vs ${match.away_team}`;
  ui.chatMessages.innerHTML = "";

  if (state.chatChannel) {
    await supabase.removeChannel(state.chatChannel);
  }

  await loadChatHistory(match.id);

  const channelName = `match-room-${match.id}`;
  state.chatChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `match_id=eq.${match.id}`
      },
      (payload) => appendChatMessage(payload.new)
    )
    .subscribe();
}

function closeChatPanel() {
  ui.chatPanel.classList.remove("open");
}

async function loadChatHistory(matchId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    ui.chatMessages.innerHTML = `<p class="text-warning">Could not load chat.</p>`;
    return;
  }

  data.forEach(appendChatMessage);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function onChatSubmit(event) {
  event.preventDefault();
  if (!state.guest) return toggleJoinModal(true);
  if (!state.selectedMatch) return;

  const message = ui.chatInput.value.trim();
  if (!message) return;

  const payload = {
    match_id: state.selectedMatch.id,
    guest_name: state.guest.display_name,
    country_code: state.guest.country_code,
    message_text: message,
    is_portugal: state.guest.country_code === "PT"
  };

  const { error } = await supabase.from("chat_messages").insert(payload);
  if (error) {
    alert(`Chat error: ${error.message}`);
    return;
  }

  ui.chatInput.value = "";
}

function appendChatMessage(row) {
  const el = document.createElement("article");
  el.className = `chat-message ${row.is_portugal ? "portugal-user" : ""}`;

  const supporter = row.is_portugal ? " · Portugal Supporter" : "";
  el.innerHTML = `
    <div class="msg-meta">${flagEmoji(row.country_code)} ${row.guest_name} (${countryName(row.country_code)})${supporter}</div>
    <div class="msg-body"></div>
  `;
  el.querySelector(".msg-body").textContent = row.message_text;

  ui.chatMessages.appendChild(el);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}
