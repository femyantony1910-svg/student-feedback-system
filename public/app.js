const form = document.querySelector("#feedback-form");
const ratingsRoot = document.querySelector("#ratings");
const message = document.querySelector("#message");
const success = document.querySelector("#success");
const submitButton = document.querySelector("#submit");
const anonymous = document.querySelector("#anonymous");
const selected = {};

init();

anonymous.addEventListener("change", () => {
  const hide = anonymous.checked;
  for (const id of ["name", "roll"]) {
    const input = document.querySelector(`#${id}`);
    input.disabled = hide;
    input.required = !hide;
    if (hide) input.value = "";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const payload = {
    name: value("#name"),
    roll: value("#roll"),
    department: value("#department"),
    semester: Number(value("#semester")),
    course: value("#course"),
    faculty: value("#faculty"),
    academicYear: value("#year"),
    anonymous: anonymous.checked,
    comments: value("#comments"),
    suggestions: value("#suggestions"),
    ratings: { ...selected }
  };

  submitButton.disabled = true;
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The response could not be saved.");
    showSaved(data);
  } catch (error) {
    showMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#another").addEventListener("click", () => {
  form.reset();
  anonymous.dispatchEvent(new Event("change"));
  for (const key of Object.keys(selected)) delete selected[key];
  paintRatings();
  success.hidden = true;
  form.hidden = false;
  document.querySelector("#name").focus();
});

async function init() {
  const meta = await fetch("/api/meta").then((response) => response.json());
  setStorage(meta);
  fillSelect("#department", meta.departments);
  fillSelect("#semester", meta.semesters.map(String));
  fillSelect("#year", meta.academicYears, "2026-27");
  ratingsRoot.innerHTML = "";
  for (const field of meta.ratings) {
    const row = document.createElement("div");
    row.className = "rate-row";
    row.dataset.key = field.key;
    const copy = document.createElement("div");
    const title = document.createElement("p");
    title.textContent = field.label;
    copy.append(title);
    const pips = document.createElement("div");
    pips.className = "pips";
    pips.setAttribute("role", "radiogroup");
    pips.setAttribute("aria-label", field.label);
    for (let score = 1; score <= 5; score += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(score);
      button.setAttribute("aria-label", `${score} out of 5`);
      button.addEventListener("click", () => {
        selected[field.key] = score;
        paintRatings();
      });
      pips.append(button);
    }
    row.append(copy, pips);
    ratingsRoot.append(row);
  }
}

function paintRatings() {
  for (const row of ratingsRoot.querySelectorAll(".rate-row")) {
    const score = selected[row.dataset.key] || 0;
    row.querySelectorAll("button").forEach((button, index) => {
      const on = index < score;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", index + 1 === score ? "true" : "false");
    });
  }
}

function showSaved(data) {
  form.hidden = true;
  success.hidden = false;
  document.querySelector("#saved-id").textContent = data.id;
  document.querySelector("#saved-store").textContent = document.querySelector("#storage span").textContent;
  document.querySelector("#view-saved").href = `/responses?highlight=${encodeURIComponent(data.id)}`;
}

function fillSelect(selector, values, preferred) {
  const select = document.querySelector(selector);
  select.innerHTML = "";
  for (const item of values) {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    if (item === preferred) option.selected = true;
    select.append(option);
  }
}

function setStorage(meta) {
  const pill = document.querySelector("#storage");
  pill.classList.toggle("cloud", meta.storage === "mongodb");
  pill.querySelector("span").textContent = meta.label;
}

function value(selector) {
  return document.querySelector(selector).value.trim();
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
