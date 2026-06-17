import { supabase } from "./supabaseClient.js";
import { countryName, flagEmoji } from "./countries.js";

const state = {
  guest: loadGuest(),
  selectedMatch: null,
  chatChannel: null,
  upcomingPage: 0,
  upcomingPageSize: 6,
  upcomingMatches: []
};

const ui = {
  todaySection: document.getElementById("todaySection"),
  todayList: document.getElementById("todayList"),
  upcomingList: document.getElementById("upcomingList"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  pastList: document.getElementById("pastList"),
  winnerForm: document.getElementById("winnerForm"),
  winnerTeamSelect: document.getElementById("winnerTeamSelect"),
  winnerSummary: document.getElementById("winnerSummary"),
  winnerTotal: document.getElementById("winnerTotal"),
  winnerVoteBtn: document.getElementById("winnerVoteBtn"),
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
ui.loadMoreBtn.addEventListener("click", loadMoreUpcoming);
ui.winnerForm?.addEventListener("submit", onWinnerVoteSubmit);

await bootstrap();

async function bootstrap() {
  try {
    populateCountryOptions(state.guest?.country_code || "");
  } catch (error) {
    console.warn("Country options fallback activated:", error);
  }
  renderGuestBadge();
  await Promise.all([loadTodayMatches(), loadUpcomingMatches(), loadPastMatches(), loadWinnerPoll()]);
}

function localDayBounds() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  return {
    startOfYesterday,
    startOfToday,
    startOfTomorrow
  };
}

function normalizeCountryCode(code) {
  if (!code) return "XX";
  const upper = String(code).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const map = {
    POR: "PT",
    ARG: "AR",
    BRA: "BR",
    FRA: "FR",
    GER: "DE",
    ESP: "ES",
    ENG: "GB",
    USA: "US",
    MAR: "MA",
    JPN: "JP",
    NED: "NL",
    CRO: "HR",
    BEL: "BE",
    DEN: "DK",
    POL: "PL",
    MEX: "MX",
    URU: "UY",
    KOR: "KR",
    AUS: "AU",
    SEN: "SN",
    TUN: "TN",
    KSA: "SA",
    SRB: "RS",
    CMR: "CM",
    GHA: "GH",
    NGA: "NG",
    EGY: "EG"
  };

  return map[upper] || "XX";
}

function populateCountryOptions(selectedCode = "") {
  const select = ui.countryInput;
  if (!select) return;

  const previousSelection = selectedCode || select.value || "";
  const options = getCountryOptions();

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select Country";
  select.appendChild(placeholder);

  options.forEach(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${name} (${code})`;
    select.appendChild(option);
  });

  if (previousSelection) {
    select.value = previousSelection;
  }
}

function getCountryOptions() {
  if (typeof Intl !== "undefined" && Intl.DisplayNames && Intl.supportedValuesOf) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      return Intl.supportedValuesOf("region")
        .filter((code) => /^[A-Z]{2}$/.test(code))
        .map((code) => ({ code, name: displayNames.of(code) || code }))
        .filter((item) => item.name && item.name !== item.code)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      // Fall back to a static list if runtime Intl region support is partial.
    }
  }

  return [
    { code: "AR", name: "Argentina" },
    { code: "AU", name: "Australia" },
    { code: "BE", name: "Belgium" },
    { code: "BR", name: "Brazil" },
    { code: "CA", name: "Canada" },
    { code: "DE", name: "Germany" },
    { code: "DK", name: "Denmark" },
    { code: "EG", name: "Egypt" },
    { code: "ES", name: "Spain" },
    { code: "FR", name: "France" },
    { code: "GB", name: "England" },
    { code: "GH", name: "Ghana" },
    { code: "HR", name: "Croatia" },
    { code: "IT", name: "Italy" },
    { code: "JP", name: "Japan" },
    { code: "KR", name: "South Korea" },
    { code: "MA", name: "Morocco" },
    { code: "MX", name: "Mexico" },
    { code: "NL", name: "Netherlands" },
    { code: "NG", name: "Nigeria" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "RS", name: "Serbia" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "SN", name: "Senegal" },
    { code: "TN", name: "Tunisia" },
    { code: "TR", name: "Turkey" },
    { code: "US", name: "USA" },
    { code: "UY", name: "Uruguay" }
  ].sort((a, b) => a.name.localeCompare(b.name));
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

  const guestCode = normalizeCountryCode(state.guest.country_code);
  const pt = guestCode === "PT" ? " · GOAT fan" : "";
  ui.userBadge.textContent = `${flagEmoji(guestCode)} ${state.guest.display_name}${pt}`;
  ui.userBadge.classList.remove("d-none");
}

async function loadTodayMatches() {
  const { startOfToday, startOfTomorrow } = localDayBounds();
  const windowStart = startOfToday.toISOString();
  const windowEnd = startOfTomorrow.toISOString();

  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("kickoff_at", windowStart)
    .lt("kickoff_at", windowEnd)
    .order("kickoff_at", { ascending: true });

  if (error) return showDataError(ui.todayList, error.message);

  if (!data?.length) {
    ui.todaySection.style.display = "none";
    return;
  }

  const sorted = data.sort((a, b) => {
    const aPT = involvesPortugal(a);
    const bPT = involvesPortugal(b);
    if (aPT && !bPT) return -1;
    if (!aPT && bPT) return 1;
    return new Date(a.kickoff_at) - new Date(b.kickoff_at);
  });

  ui.todayList.innerHTML = "";
  ui.todaySection.style.display = "block";
  sorted.forEach((match) => ui.todayList.appendChild(renderMatchCard(match, false)));
}

async function loadUpcomingMatches() {
  state.upcomingPage = 0;
  const { startOfTomorrow } = localDayBounds();
  const windowStart = startOfTomorrow.toISOString();

  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("kickoff_at", windowStart)
    .order("kickoff_at", { ascending: true });

  if (error) return showDataError(ui.upcomingList, error.message);

  const sorted = (data || []).sort((a, b) => {
    const aPT = involvesPortugal(a);
    const bPT = involvesPortugal(b);
    if (aPT && !bPT) return -1;
    if (!aPT && bPT) return 1;
    return new Date(a.kickoff_at) - new Date(b.kickoff_at);
  });

  state.upcomingMatches = sorted;
  ui.upcomingList.innerHTML = "";

  const pageMatches = getUpcomingPageSlice();

  if (!pageMatches.length) {
    ui.upcomingList.innerHTML = `<p class="text-light-emphasis">No more upcoming matches.</p>`;
    ui.loadMoreBtn.style.display = "none";
    return;
  }

  pageMatches.forEach((match) => ui.upcomingList.appendChild(renderMatchCard(match, false)));

  ui.loadMoreBtn.style.display = hasMoreUpcoming() ? "block" : "none";
}

async function loadMoreUpcoming() {
  if (!state.upcomingMatches.length) return;

  state.upcomingPage += 1;
  const pageMatches = getUpcomingPageSlice();

  pageMatches.forEach((match) => ui.upcomingList.appendChild(renderMatchCard(match, false)));
  ui.loadMoreBtn.style.display = hasMoreUpcoming() ? "block" : "none";
}

function getUpcomingPageSlice() {
  const pageStart = state.upcomingPage * state.upcomingPageSize;
  const pageEnd = pageStart + state.upcomingPageSize;
  return state.upcomingMatches.slice(pageStart, pageEnd);
}

function hasMoreUpcoming() {
  const shown = (state.upcomingPage + 1) * state.upcomingPageSize;
  return shown < state.upcomingMatches.length;
}

async function loadPastMatches() {
  const { startOfYesterday, startOfToday } = localDayBounds();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .gte("kickoff_at", startOfYesterday.toISOString())
    .lt("kickoff_at", startOfToday.toISOString())
    .order("kickoff_at", { ascending: false })
    .limit(20);

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
  const homeCode = normalizeCountryCode(match.home_code);
  const awayCode = normalizeCountryCode(match.away_code);
  const score = isPast
    ? `<div class="scoreline">${match.home_score ?? "-"} : ${match.away_score ?? "-"}</div>`
    : "";

  col.innerHTML = `
    <article class="match-card ${ptClass}">
      <div class="match-body">
        <div class="match-top">${match.stage || "Group Stage"} · ${kickoff}</div>
        <div class="match-teams">${flagEmoji(homeCode)} ${match.home_team} vs ${flagEmoji(awayCode)} ${match.away_team}</div>
        ${score}
        ${isPast ? "" : `
          <div class="prediction-row">
            <button class="btn-vote" data-vote="home">Vote ${match.home_team}</button>
            <button class="btn-vote" data-vote="draw">Vote Draw</button>
            <button class="btn-vote" data-vote="away">Vote ${match.away_team}</button>
          </div>
        `}
        <div class="vote-summary" id="vote-${match.id}" data-home="${match.home_team}" data-away="${match.away_team}">Loading votes...</div>
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
  }

  loadVoteSummary(match.id);

  return col;
}

function involvesPortugal(match) {
  return normalizeCountryCode(match.home_code) === "PT" || normalizeCountryCode(match.away_code) === "PT";
}

async function onVote(match, voteType) {
  if (!state.guest) return toggleJoinModal(true);

  const payload = {
    match_id: match.id,
    guest_id: state.guest.guest_id,
    guest_name: state.guest.display_name,
    country_code: normalizeCountryCode(state.guest.country_code),
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
  const homeTeam = target.dataset.home || "Home";
  const awayTeam = target.dataset.away || "Away";

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

  target.innerHTML = `
    <span class="vote-pill">${homeTeam}: <strong>${pct(counts.home, total)}</strong></span>
    <span class="vote-pill">Draw: <strong>${pct(counts.draw, total)}</strong></span>
    <span class="vote-pill">${awayTeam}: <strong>${pct(counts.away, total)}</strong></span>
    <span class="vote-total">${total} total votes</span>
  `;
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

  await loadChatHistory(match);

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

async function loadChatHistory(match) {
  const relatedMatchIds = await findRelatedMatchIds(match);

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .in("match_id", relatedMatchIds)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    ui.chatMessages.innerHTML = `<p class="text-warning">Could not load chat.</p>`;
    return;
  }

  data.forEach(appendChatMessage);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function findRelatedMatchIds(match) {
  const matchIds = new Set([match.id]);
  const kickoff = new Date(match.kickoff_at);
  const windowStart = new Date(kickoff.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(kickoff.getTime() + 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("matches")
    .select("id")
    .eq("home_team", match.home_team)
    .eq("away_team", match.away_team)
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd);

  if (!error && data?.length) {
    data.forEach((row) => matchIds.add(row.id));
  }

  return Array.from(matchIds);
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
    country_code: normalizeCountryCode(state.guest.country_code),
    message_text: message,
    is_portugal: normalizeCountryCode(state.guest.country_code) === "PT"
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

  const rowCountryCode = normalizeCountryCode(row.country_code);
  const supporter = row.is_portugal ? " · GOAT fan" : "";
  el.innerHTML = `
    <div class="msg-meta">${flagEmoji(rowCountryCode)} ${row.guest_name} (${countryName(rowCountryCode)})${supporter}</div>
    <div class="msg-body"></div>
  `;
  el.querySelector(".msg-body").textContent = row.message_text;

  ui.chatMessages.appendChild(el);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function loadWinnerPoll() {
  await Promise.all([loadWinnerTeamOptions(), loadWinnerSummary()]);
}

async function loadWinnerTeamOptions() {
  if (!ui.winnerTeamSelect) return;

  const { data, error } = await supabase
    .from("matches")
    .select("home_team, away_team");

  if (error) {
    ui.winnerTeamSelect.innerHTML = `<option value="">Could not load teams</option>`;
    return;
  }

  const teams = new Set();
  (data || []).forEach((row) => {
    if (row.home_team) teams.add(row.home_team);
    if (row.away_team) teams.add(row.away_team);
  });

  const sortedTeams = Array.from(teams).sort((a, b) => {
    if (a === "Portugal" && b !== "Portugal") return -1;
    if (a !== "Portugal" && b === "Portugal") return 1;
    return a.localeCompare(b);
  });

  ui.winnerTeamSelect.innerHTML = "<option value=\"\">Select your champion</option>";
  sortedTeams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team;
    option.textContent = team;
    ui.winnerTeamSelect.appendChild(option);
  });
}

async function onWinnerVoteSubmit(event) {
  event.preventDefault();
  if (!state.guest) return toggleJoinModal(true);

  const teamName = ui.winnerTeamSelect?.value;
  if (!teamName) return;

  ui.winnerVoteBtn.disabled = true;

  const payload = {
    guest_id: state.guest.guest_id,
    guest_name: state.guest.display_name,
    country_code: normalizeCountryCode(state.guest.country_code),
    team_name: teamName
  };

  const { error } = await supabase
    .from("winner_predictions")
    .upsert(payload, { onConflict: "guest_id" });

  ui.winnerVoteBtn.disabled = false;

  if (error) {
    alert(`Winner vote error: ${error.message}`);
    return;
  }

  await loadWinnerSummary();
}

async function loadWinnerSummary() {
  if (!ui.winnerSummary) return;

  const { data, error } = await supabase
    .from("winner_predictions")
    .select("team_name");

  if (error) {
    ui.winnerSummary.textContent = "Could not load winner votes.";
    return;
  }

  const rows = data || [];
  const total = rows.length;
  ui.winnerTotal.textContent = `${total} total votes`;

  if (!total) {
    ui.winnerSummary.textContent = "No winner votes yet.";
    return;
  }

  const counts = {};
  rows.forEach((row) => {
    counts[row.team_name] = (counts[row.team_name] || 0) + 1;
  });

  const ranking = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  ui.winnerSummary.innerHTML = ranking
    .map(([team, count]) => {
      return `<span class="winner-pill">${team}: <strong>${pct(count, total)}</strong></span>`;
    })
    .join("");
}
