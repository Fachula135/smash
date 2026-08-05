// ============================================================
// IMPOSTOR NUMÉRICO — lógica del juego
// Todo corre en el cliente, sin backend. Un solo dispositivo pasa de mano en mano.
// Cada turno: se pasa el teléfono UNA vez -> se revela el rol -> se carga el número -> siguiente.
// ============================================================

const CATEGORY_LABELS = {
  general: "General",
  amigos: "Amigos",
  escuela: "Escuela",
  futbol: "Fútbol",
  otros: "Otros",
};

const state = {
  playerCount: 6,
  impostorCount: 1,
  difficulty: "clasico",
  categories: ["todas"], // ["todas"] o lista de claves específicas
  players: [],           // nombres reales cargados por los jugadores
  impostorSet: new Set(),
  question: null,
  currentIndex: 0,
  answers: [],
};

let QUESTIONS = [];

// ---------------- Carga de preguntas ----------------
fetch("preguntasbis.json")
  .then((r) => r.json())
  .then((data) => {
    QUESTIONS = data.preguntas;
  })
  .catch((err) => {
    console.error("No se pudo cargar preguntas.json", err);
    const errBox = document.getElementById("setup-error");
    errBox.hidden = false;
    errBox.textContent =
      "No se pudieron cargar las preguntas. Si abriste el archivo directo (file://), probá servirlo con un servidor local o subilo a GitHub Pages.";
  });

// ---------------- Helpers ----------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0 });
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// PANTALLA 1: SETUP
// ============================================================
const playersRange = document.getElementById("players-range");
const playersValue = document.getElementById("players-value");

playersRange.addEventListener("input", () => {
  state.playerCount = parseInt(playersRange.value, 10);
  playersValue.textContent = state.playerCount;
});

document.querySelectorAll('.stepper-btn[data-step="players"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    const dir = parseInt(btn.dataset.dir, 10);
    let val = parseInt(playersRange.value, 10) + dir;
    val = Math.min(20, Math.max(3, val));
    playersRange.value = val;
    state.playerCount = val;
    playersValue.textContent = val;
  });
});

document.querySelectorAll("#impostors-group .pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#impostors-group .pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.impostorCount = parseInt(btn.dataset.impostors, 10);
  });
});

document.querySelectorAll("#difficulty-group .pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#difficulty-group .pill").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.difficulty = btn.dataset.difficulty;
  });
});

document.querySelectorAll("#category-group .pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = document.getElementById("category-group");
    const cat = btn.dataset.category;

    if (cat === "todas") {
      group.querySelectorAll(".pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.categories = ["todas"];
      return;
    }

    group.querySelector('[data-category="todas"]').classList.remove("active");
    btn.classList.toggle("active");

    const active = Array.from(group.querySelectorAll(".pill.active"))
      .map((b) => b.dataset.category)
      .filter((c) => c !== "todas");

    if (active.length === 0) {
      group.querySelector('[data-category="todas"]').classList.add("active");
      state.categories = ["todas"];
    } else {
      state.categories = active;
    }
  });
});

document.getElementById("setup-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const errBox = document.getElementById("setup-error");
  errBox.hidden = true;

  if (!QUESTIONS.length) {
    errBox.hidden = false;
    errBox.textContent = "Las preguntas todavía están cargando, esperá un segundo e intentá de nuevo.";
    return;
  }

  const pool =
    state.categories.includes("todas")
      ? QUESTIONS
      : QUESTIONS.filter((q) => state.categories.includes(q.categoria));

  if (!pool.length) {
    errBox.hidden = false;
    errBox.textContent = "No hay preguntas en esas categorías. Elegí al menos una.";
    return;
  }

  goToNames();
});

// ============================================================
// PANTALLA 2: NOMBRES DE JUGADORES
// ============================================================
function goToNames() {
  const list = document.getElementById("names-list");
  list.innerHTML = "";

  for (let i = 0; i < state.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "name-field";
    row.innerHTML = `
      <span class="name-field-index">${i + 1}</span>
      <input
        type="text"
        class="name-field-input"
        data-index="${i}"
        placeholder="Jugador ${i + 1}"
        maxlength="18"
        autocomplete="off"
      >
    `;
    list.appendChild(row);
  }

  document.getElementById("names-error").hidden = true;
  showScreen("screen-names");
}

document.getElementById("names-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const inputs = document.querySelectorAll("#names-list .name-field-input");
  const names = Array.from(inputs).map((input, i) => {
    const val = input.value.trim();
    return val === "" ? `Jugador ${i + 1}` : val;
  });

  startGame(names);
});

// ============================================================
// ARRANQUE DE PARTIDA (ya con nombres cargados)
// ============================================================
function startGame(names) {
  const pool =
    state.categories.includes("todas")
      ? QUESTIONS
      : QUESTIONS.filter((q) => state.categories.includes(q.categoria));

  state.question = pickRandom(pool);
  state.players = names;

  const indices = shuffle([...Array(state.playerCount).keys()]);
  state.impostorSet = new Set(indices.slice(0, state.impostorCount));

  state.answers = new Array(state.playerCount).fill(null);
  state.currentIndex = 0;

  goToPass();
}

// ============================================================
// PASAR TELÉFONO (una vez por jugador)
// ============================================================
function goToPass() {
  const name = state.players[state.currentIndex];
  document.getElementById("pass-name").textContent = name;
  showScreen("screen-pass");
}

document.getElementById("pass-continue").addEventListener("click", () => {
  goToRoleIntro();
});

// ============================================================
// REVELAR ROL + CARGAR NÚMERO (misma instancia de turno)
// ============================================================
function goToRoleIntro() {
  const name = state.players[state.currentIndex];
  document.getElementById("reveal-name").textContent = `${name}, tu turno`;
  showScreen("screen-reveal-intro");
}

document.getElementById("reveal-tap").addEventListener("click", () => {
  renderRoleContent();
  showScreen("screen-reveal-content");
});

function renderRoleContent() {
  const card = document.getElementById("role-card");
  const isImpostor = state.impostorSet.has(state.currentIndex);

  const answerBlock = `
    <div class="role-answer-block">
      <p class="role-answer-label">Tu número</p>
      <input type="number" id="role-answer-input" class="role-answer-input" inputmode="numeric" placeholder="0" autocomplete="off">
    </div>
  `;

  if (isImpostor) {
    card.className = "role-card role-card--impostor";
    const clue = state.question.pistas[state.difficulty];
    const catLabel = CATEGORY_LABELS[state.question.categoria] || state.question.categoria;
    card.innerHTML = `
      <span class="role-tag">🕵️ Sos el impostor</span>
      <p class="role-meta-label">📂 Categoría</p>
      <p class="role-meta-value">${catLabel}</p>
      <p class="role-meta-label">💡 Pista</p>
      <p class="role-clue">"${clue}"</p>
      ${answerBlock}
      <button id="role-continue" class="btn btn-primary btn-big" disabled>Confirmar y pasar</button>
    `;
  } else {
    card.className = "role-card role-card--normal";
    card.innerHTML = `
      <span class="role-tag">❓ Pregunta</span>
      <p class="role-question">${state.question.pregunta}</p>
      ${answerBlock}
      <button id="role-continue" class="btn btn-primary btn-big" disabled>Confirmar y pasar</button>
    `;
  }

  const input = document.getElementById("role-answer-input");
  const continueBtn = document.getElementById("role-continue");

  input.addEventListener("input", () => {
    continueBtn.disabled = input.value.trim() === "";
  });

  continueBtn.addEventListener("click", () => {
    const val = input.value.trim();
    if (val === "") return;
    onRoleContinue(val);
  });

  setTimeout(() => input.focus(), 250);
}

function onRoleContinue(answerValue) {
  state.answers[state.currentIndex] = answerValue;
  state.currentIndex++;

  if (state.currentIndex < state.playerCount) {
    goToPass();
  } else {
    goToResults();
  }
}

// ============================================================
// RESULTADOS
// ============================================================
function goToResults() {
  const list = document.getElementById("results-list");
  list.innerHTML = "";
  state.players.forEach((name, i) => {
    const li = document.createElement("li");
    li.style.animationDelay = `${i * 60}ms`;
    li.innerHTML = `<span>${name}</span><span class="result-chip">${state.answers[i]}</span>`;
    list.appendChild(li);
  });

  document.getElementById("question-reveal-box").hidden = true;
  document.getElementById("question-reveal-text").textContent = "";
  document.getElementById("reveal-question-btn").hidden = false;
  document.getElementById("end-game-btn").hidden = true;

  showScreen("screen-results");
}

document.getElementById("reveal-question-btn").addEventListener("click", () => {
  document.getElementById("question-reveal-text").textContent = state.question.pregunta;
  document.getElementById("question-reveal-box").hidden = false;
  document.getElementById("reveal-question-btn").hidden = true;
  document.getElementById("end-game-btn").hidden = false;
});

document.getElementById("end-game-btn").addEventListener("click", () => {
  showScreen("screen-setup");
});
