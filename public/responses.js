const results = document.querySelector("#results");
const message = document.querySelector("#message");
const filters = document.querySelector("#filters");
let officeKey = sessionStorage.getItem("officeKey") || "";
let ratingLabels = [];
let highlight = new URLSearchParams(location.search).get("highlight") || "";

init();

filters.addEventListener("input", () => loadResponses());
document.querySelector("#unlock").addEventListener("click", () => {
  officeKey = document.querySelector("#office-key").value;
  sessionStorage.setItem("officeKey", officeKey);
  loadResponses();
});

async function init() {
  const meta = await fetch("/api/meta").then((response) => response.json());
  ratingLabels = meta.ratings;
  setStorage(meta);
  const department = document.querySelector("#department");
  for (const name of meta.departments) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    department.append(option);
  }
  if (officeKey) document.querySelector("#office-key").value = officeKey;
  await Promise.all([loadStats(), loadResponses()]);
}

async function loadStats() {
  const stats = await fetch("/api/stats").then((response) => response.json());
  const summary = document.querySelector("#stats");
  summary.innerHTML = "";
  for (const [value, label] of [
    [String(stats.total), "Stored responses"],
    [stats.total ? stats.average.toFixed(1) : "—", "Average rating"],
    [String(stats.byDepartment.length), "Departments"],
    [stats.label, "Database"]
  ]) {
    const card = document.createElement("article");
    card.className = "stat";
    const strong = document.createElement("b");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    summary.append(card);
  }

  const bars = document.querySelector("#bars");
  bars.innerHTML = "";
  const max = Math.max(1, ...stats.byDepartment.map((row) => row.average));
  for (const row of stats.byDepartment) {
    const line = document.createElement("div");
    line.className = "bar-row";
    const name = document.createElement("span");
    name.textContent = `${row.department} (${row.count})`;
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("span");
    fill.style.width = `${(row.average / max) * 100}%`;
    track.append(fill);
    const score = document.createElement("strong");
    score.textContent = row.average.toFixed(1);
    line.append(name, track, score);
    bars.append(line);
  }
}

async function loadResponses() {
  const params = new URLSearchParams();
  const q = document.querySelector("#q").value.trim();
  const department = document.querySelector("#department").value;
  const minRating = document.querySelector("#minRating").value;
  if (q) params.set("q", q);
  if (department) params.set("department", department);
  if (minRating) params.set("minRating", minRating);

  const started = new Date();
  try {
    const response = await fetch(`/api/feedback?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Responses could not be retrieved.");
    const when = started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    document.querySelector("#retrieved").textContent =
      `Retrieved ${data.count} response${data.count === 1 ? "" : "s"} from ${data.label} at ${when}.`;
    render(data.responses);
    clearMessage();
  } catch (error) {
    showMessage(error.message);
  }
}

function render(responses) {
  results.innerHTML = "";
  if (!responses.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No responses match. Submit feedback, then retrieve it here.";
    results.append(empty);
    return;
  }

  for (const item of responses) {
    const card = document.createElement("article");
    card.className = "card";
    card.id = `response-${item.id}`;
    if (item.id === highlight) card.classList.add("highlight");

    const top = document.createElement("div");
    top.className = "card-top";
    const heading = document.createElement("div");
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${item.department} · Semester ${item.semester} · ${item.academicYear}`;
    const title = document.createElement("h2");
    title.textContent = item.course;
    const who = document.createElement("p");
    who.className = "meta";
    const whoBits = [item.anonymous ? "Anonymous" : item.name];
    if (!item.anonymous && item.roll) whoBits.push(item.roll);
    if (item.faculty) whoBits.push(item.faculty);
    whoBits.push(new Date(item.createdAt).toLocaleString());
    who.textContent = whoBits.join(" · ");
    heading.append(meta, title, who);
    const score = document.createElement("div");
    score.className = "score";
    score.textContent = item.average.toFixed(1);
    top.append(heading, score);

    const quote = document.createElement("p");
    quote.className = "quote";
    quote.textContent = item.comments;
    const suggestion = document.createElement("p");
    suggestion.className = "meta";
    if (item.suggestions) suggestion.textContent = `Suggestion: ${item.suggestions}`;

    const scores = document.createElement("ul");
    scores.className = "scores";
    for (const field of ratingLabels) {
      const li = document.createElement("li");
      li.textContent = `${field.label} ${item.ratings[field.key]}`;
      scores.append(li);
    }

    const foot = document.createElement("div");
    foot.className = "card-foot";
    const id = document.createElement("p");
    id.className = "meta";
    id.textContent = item.id;
    foot.append(id);
    if (officeKey) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => removeResponse(item.id));
      foot.append(remove);
    }

    card.append(top, quote);
    if (item.suggestions) card.append(suggestion);
    card.append(scores, foot);
    results.append(card);
  }

  if (highlight) {
    document.getElementById(`response-${highlight}`)?.scrollIntoView({ block: "center" });
  }
}

async function removeResponse(id) {
  if (!confirm("Delete this stored response?")) return;
  const response = await fetch(`/api/feedback/${id}`, {
    method: "DELETE",
    headers: { "x-admin-key": officeKey }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showMessage(data.error || "The response could not be deleted.");
    return;
  }
  highlight = "";
  await Promise.all([loadStats(), loadResponses()]);
}

function setStorage(meta) {
  const pill = document.querySelector("#storage");
  pill.classList.toggle("cloud", meta.storage === "mongodb");
  pill.querySelector("span").textContent = meta.label;
}

function showMessage(text) {
  message.hidden = false;
  message.className = "banner";
  message.textContent = text;
}

function clearMessage() {
  message.hidden = true;
  message.textContent = "";
}
