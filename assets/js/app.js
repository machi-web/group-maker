const PARTICIPANT_INPUT_COUNT = 100;
const FACILITATOR_INPUT_COUNT = 16;
const ADDITIONAL_PARTICIPANT_INPUT_COUNT = 20;

const MIN_MEMBERS_PER_GROUP = 3;
const MIN_MEMBERS_PER_GROUP_LARGE = 4;
const MIN_MEMBERS_PER_GROUP_LARGE_THRESHOLD = 50;
const MAX_MEMBERS_PER_GROUP = 7;
const MIN_GROUP_COUNT = 2;

const DRAW_DURATION_MS = 4000;
const DRAW_TICK_MS = 120;
const DRUM_ROLL_SOUND_SRC = "sound.mp3";
const FACILITATOR_DRAW_MS = 1500;
const MAX_GROUPS_WITHOUT_MODAL_SCROLL = 16;
const DRAW_GRID_COLUMNS_DESKTOP = 8;
const DRAW_GRID_COLUMNS_MOBILE = 4;
const DRAW_GRID_MOBILE_MAX_WIDTH = 599;
const FACILITATOR_PHASE_TEXT = "ファシリテーター決定中";
const MEMBER_PHASE_TEXT = "メンバーを振り分け中";
const GROUP_PHASE_TEXT = "グループを振り分け中";
const DRAW_PHASE_TEXTS = [FACILITATOR_PHASE_TEXT, MEMBER_PHASE_TEXT, GROUP_PHASE_TEXT];

const ROUND2_PAIR_OVERLAP_PENALTY = 40;
const ROUND2_SAME_GROUP_PENALTY = 220;

const PHASE_DEFINITIONS = {
  1: {
    title: "フェーズ1：ファシ準備",
    description: "必要に応じて最大16名のファシリテーター候補を登録します。",
  },
  2: {
    title: "フェーズ2：1回目準備",
    description: "旧アプリと同じ流れで、参加者の確認・グループ数選択・1回目抽選を行います。",
  },
  3: {
    title: "フェーズ3：1回目結果",
    description: "1回目抽選を実行し、2回目重複回避用の履歴を保存します。",
  },
  4: {
    title: "フェーズ4：2回目準備",
    description: "2回目不参加を除外し、追加参加者とグループ数を確定します。",
  },
  5: {
    title: "フェーズ5：2回目抽選・結果",
    description: "1回目の同席履歴を使って重複を抑えた2回目抽選を実行します。",
  },
};

const NAME_HEADER_TERMS = ["名前", "name", "participant", "ニックネーム", "氏名"];
const ROUND1_HEADER_TERMS = ["1回目", "第1", "round1", "1st", "1回", "回目1", "c列"];
const ROUND2_HEADER_TERMS = ["2回目", "第2", "round2", "2nd", "2回", "回目2", "d列"];
const PARTICIPATION_CODE_GUIDE_ROUND1 = "0=追加ファシ候補, 1=マイクオン, 2=聞き専";
const PARTICIPATION_CODE_GUIDE_ROUND2 =
  "0=追加ファシ候補, 1=マイクオン, 2=聞き専, 3=不参加";
const PARTICIPATION_CODE_GUIDE_ADDITIONAL = "0=追加ファシ候補, 1=マイクオン, 2=聞き専";
const PARTICIPANT_HEADER_ROUND2_DEFAULT = "2回目";

const inputContainer = document.querySelector("#participant-inputs");
const facilitatorContainer = document.querySelector("#facilitator-inputs");
const additionalContainer = document.querySelector("#additional-inputs");
const appRoot = document.querySelector(".app");

const groupSelectRound1 = document.querySelector("#group-count-round1");
const groupSelectRound2 = document.querySelector("#group-count-round2");

const shuffleRound1Button = document.querySelector("#shuffle-round1-button");
const shuffleRound2Button = document.querySelector("#shuffle-round2-button");
const prepareRound2Button = document.querySelector("#prepare-round2-button");
const goPhase2Button = document.querySelector("#go-phase2-button");

const phasePrevButton = document.querySelector("#phase-prev-button");
const phaseNextButton = document.querySelector("#phase-next-button");
const phaseNavButtons = Array.from(document.querySelectorAll("[data-phase-nav]"));
const phaseLabel = document.querySelector("#phase-label");
const phaseDescription = document.querySelector("#phase-description");

const participantGuideRound1 = document.querySelector("#participant-guide-round1");
const participantGuideRound2 = document.querySelector("#participant-guide-round2");
const micOnGuideRound1 = document.querySelector("#mic-on-guide-round1");
const micOnGuideRound2 = document.querySelector("#mic-on-guide-round2");
const listenerGuideRound1 = document.querySelector("#listener-guide-round1");
const listenerGuideRound2 = document.querySelector("#listener-guide-round2");
const facilitatorCount = document.querySelector("#facilitator-count");

const readClipboardButton = document.querySelector("#read-clipboard-button");
const readFacilitatorClipboardButton = document.querySelector(
  "#read-facilitator-clipboard-button"
);
const readFacilitatorClipboardSideButton = document.querySelector(
  "#read-facilitator-clipboard-side-button"
);

const clipboardMessage = document.querySelector("#clipboard-message");
const facilitatorMessage = document.querySelector("#facilitator-message");
const participantMessage = document.querySelector("#participant-message");
const additionalMessage = document.querySelector("#additional-message");
const errorMessage = document.querySelector("#error-message");

const SHUFFLE_ROUND1_IDLE_HTML =
  '<span class="app__shuffle-icon shuffle-icon" aria-hidden="true">⇄</span><span>振り分けスタート</span>';
const SHUFFLE_ROUND2_IDLE_HTML =
  '<span class="app__shuffle-icon shuffle-icon" aria-hidden="true">⇄</span><span>2回目 振り分けスタート</span>';

let modal = null;
let modalTitle = null;
let modalContent = null;
let modalCloseButton = null;
let modalGoRound2Button = null;
let modalDrawIndicator = null;
let modalDrawPhase = null;
let modalDrawCountdown = null;
let modalDrawProgressBar = null;

let currentPhase = 1;
let isDrawing = false;
let drawIntervalId = null;
let countdownIntervalId = null;
let revealTimeoutId = null;
let modalFitRafId = null;
let drumRollAudio = null;

let round1Groups = null;
let round2Groups = null;
let round1PairHistory = new Map();
let round1GroupCompositions = new Set();
let round2OverlapStats = { pairOverlapCount: 0, sameGroupCount: 0 };
const customGroupSelectBindings = new Map();
let customGroupSelectGlobalHandlersBound = false;

const TRUE_FLAG_VALUES = new Set([
  "true",
  "1",
  "yes",
  "on",
  "y",
  "t",
  "はい",
  "有",
  "あり",
  "○",
  "o",
  "✓",
  "✔",
  "☑",
  "✅",
]);

const FALSE_FLAG_VALUES = new Set([
  "false",
  "0",
  "no",
  "off",
  "n",
  "f",
  "いいえ",
  "無",
  "×",
  "✗",
  "-",
]);

function normalizeCellValue(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeFlagToken(raw) {
  return String(raw || "")
    .trim()
    .normalize("NFKC")
    .replace(/\uFE0E|\uFE0F/g, "")
    .toLowerCase();
}

function normalizeNameKey(name) {
  return normalizeFlagToken(name);
}

function includesAnyTerm(value, terms) {
  return terms.some((term) => value.includes(term));
}

function isNumericToken(token) {
  return /^-?\d+(\.\d+)?$/.test(token);
}

function parseRound1Code(raw) {
  const token = normalizeFlagToken(raw);
  return token === "0" || token === "1" || token === "2" ? token : "";
}

function parseRound2Code(raw) {
  const token = normalizeFlagToken(raw);
  return token === "0" || token === "1" || token === "2" || token === "3" ? token : "";
}

function parseAdditionalRound2Code(raw) {
  const token = normalizeFlagToken(raw);
  return token === "0" || token === "1" || token === "2" ? token : "";
}

function parseBooleanFlag(raw) {
  const value = normalizeFlagToken(raw);
  if (!value) {
    return false;
  }

  if (isNumericToken(value)) {
    return Number(value) !== 0;
  }

  if (TRUE_FLAG_VALUES.has(value)) {
    return true;
  }

  if (FALSE_FLAG_VALUES.has(value)) {
    return false;
  }

  return false;
}

function applyStatusToElement(target, message, type) {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.classList.remove("is-error", "is-info");

  if (!message) {
    return;
  }

  if (type === "info") {
    target.classList.add("is-info");
    return;
  }

  target.classList.add("is-error");
}

function setErrorStatusMessage(message = "") {
  applyStatusToElement(errorMessage, message, "error");
}

function showInfo(target, message) {
  applyStatusToElement(target, message, "info");
}

function showErrorMessage(target, message) {
  applyStatusToElement(target, message, "error");
}

function clearLocalMessages() {
  applyStatusToElement(clipboardMessage, "", "info");
  applyStatusToElement(facilitatorMessage, "", "info");
  applyStatusToElement(participantMessage, "", "info");
  applyStatusToElement(additionalMessage, "", "info");
}

function clearError() {
  setErrorStatusMessage("");
}

function clearRound2CompletionMessageOutsidePhase5(nextPhase) {
  if (nextPhase === 5 || !additionalMessage) {
    return;
  }

  if (additionalMessage.textContent.includes("2回目抽選が完了しました")) {
    applyStatusToElement(additionalMessage, "", "info");
  }
}

function ensureModalElements() {
  if (modal && modalTitle && modalContent && modalCloseButton) {
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    if (
      !modalDrawIndicator ||
      !modalDrawPhase ||
      !modalDrawCountdown ||
      !modalDrawProgressBar
    ) {
      modalDrawIndicator = document.querySelector("#modal-draw-indicator");
      modalDrawPhase = document.querySelector("#modal-draw-phase");
      modalDrawCountdown = document.querySelector("#modal-draw-countdown");
      modalDrawProgressBar = document.querySelector("#modal-draw-progress-bar");
    }
    return true;
  }

  modal = document.querySelector("#result-modal");
  modalTitle = document.querySelector("#result-modal-title");
  modalContent = document.querySelector("#modal-content");
  modalCloseButton = document.querySelector("#modal-close-button");
  modalGoRound2Button = document.querySelector("#modal-go-round2-button");
  modalDrawIndicator = document.querySelector("#modal-draw-indicator");
  modalDrawPhase = document.querySelector("#modal-draw-phase");
  modalDrawCountdown = document.querySelector("#modal-draw-countdown");
  modalDrawProgressBar = document.querySelector("#modal-draw-progress-bar");

  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  return Boolean(modal && modalTitle && modalContent && modalCloseButton);
}

function closeAllGroupSelectMenus(exceptRoot = null) {
  customGroupSelectBindings.forEach((binding) => {
    if (exceptRoot && binding.root === exceptRoot) {
      return;
    }
    binding.close();
  });
}

function syncCustomGroupSelect(selectElement) {
  const binding = customGroupSelectBindings.get(selectElement);
  if (!binding) {
    return;
  }
  binding.sync();
}

function bindCustomGroupSelectGlobalHandlers() {
  if (customGroupSelectGlobalHandlersBound) {
    return;
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) {
      closeAllGroupSelectMenus();
      return;
    }

    customGroupSelectBindings.forEach((binding) => {
      if (!binding.root.contains(event.target)) {
        binding.close();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllGroupSelectMenus();
    }
  });

  window.addEventListener(
    "scroll",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".app__group-select-menu")
      ) {
        return;
      }
      closeAllGroupSelectMenus();
    },
    true
  );
  window.addEventListener("resize", () => {
    closeAllGroupSelectMenus();
  });

  customGroupSelectGlobalHandlersBound = true;
}

function setupCustomGroupSelect(selectElement) {
  if (!(selectElement instanceof HTMLSelectElement)) {
    return;
  }

  const existingBinding = customGroupSelectBindings.get(selectElement);
  if (existingBinding) {
    existingBinding.sync();
    return;
  }

  const root = selectElement.closest("[data-group-select-shell]");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const trigger = root.querySelector(".app__group-select-trigger");
  const menu = root.querySelector("[data-group-select-menu]");
  const valueLabel = root.querySelector("[data-group-select-value]");

  if (
    !(trigger instanceof HTMLButtonElement) ||
    !(menu instanceof HTMLElement) ||
    !(valueLabel instanceof HTMLElement)
  ) {
    return;
  }

  const close = () => {
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  };

  const open = () => {
    if (trigger.disabled) {
      return;
    }
    closeAllGroupSelectMenus(root);
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  };

  const sync = () => {
    const options = Array.from(selectElement.options);
    const selectedOption =
      options.find((option) => option.value === selectElement.value) ||
      options[0] ||
      null;

    valueLabel.textContent = selectedOption ? selectedOption.textContent || "-" : "-";
    trigger.disabled = selectElement.disabled;

    menu.replaceChildren();
    options.forEach((option) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "app__group-select-option";
      optionButton.dataset.value = option.value;
      optionButton.textContent = option.textContent || option.value || "-";
      optionButton.disabled = Boolean(option.disabled);
      optionButton.setAttribute("role", "option");
      const isSelected = option.value === selectElement.value;
      optionButton.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        optionButton.classList.add("is-selected");
      }
      menu.appendChild(optionButton);
    });

    if (selectElement.disabled) {
      close();
    }
  };

  trigger.addEventListener("click", () => {
    if (root.classList.contains("is-open")) {
      close();
      return;
    }
    open();
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
      const firstOption = menu.querySelector(".app__group-select-option");
      if (firstOption instanceof HTMLButtonElement) {
        firstOption.focus();
      }
    }
  });

  menu.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const optionButton = event.target.closest(".app__group-select-option");
    if (!(optionButton instanceof HTMLButtonElement)) {
      return;
    }

    const nextValue = optionButton.dataset.value ?? "";
    if (selectElement.value !== nextValue) {
      selectElement.value = nextValue;
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      sync();
    }

    close();
    trigger.focus();
  });

  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
    }
  });

  selectElement.addEventListener("change", () => {
    sync();
  });

  const binding = {
    root,
    sync,
    close,
  };
  customGroupSelectBindings.set(selectElement, binding);
  bindCustomGroupSelectGlobalHandlers();
  sync();
}

function setModalRoundActionVisibility(showRound2Button, showBackButton = true) {
  if (modalCloseButton instanceof HTMLButtonElement) {
    modalCloseButton.hidden = !showBackButton;
    modalCloseButton.disabled = !showBackButton || isDrawing;
  }

  if (!(modalGoRound2Button instanceof HTMLButtonElement)) {
    return;
  }
  modalGoRound2Button.hidden = !showRound2Button;
  modalGoRound2Button.disabled = !showRound2Button || isDrawing;
}

function createFacilitatorFields() {
  if (!facilitatorContainer) {
    return;
  }

  const table = document.createElement("table");
  table.className =
    "app__input-sheet input-sheet input-sheet--facilitator app__input-sheet--facilitator app__input-sheet--facilitator-grid";
  table.innerHTML = "<tbody></tbody>";

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const row = document.createElement("tr");
    row.className = "app__input-row input-row facilitator-grid-row";

    const cells = [];
    for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
      const cellIndex = rowIndex * 4 + columnIndex;
      const inputNumber = cellIndex + 1;
      cells.push(`
        <td>
          <input
            id="facilitator-${inputNumber}"
            class="app__participant-name participant-name facilitator-name"
            type="text"
            placeholder="候補者名を入力"
            autocomplete="off"
            aria-label="${inputNumber}番のファシリテーター候補名"
            data-cell-index="${cellIndex}"
          />
        </td>
      `);
    }

    row.innerHTML = cells.join("");

    tbody.appendChild(row);
  }

  facilitatorContainer.appendChild(table);
}

function createParticipantFields() {
  if (!inputContainer) {
    return;
  }

  const table = document.createElement("table");
  table.className =
    "app__input-sheet input-sheet input-sheet--participant app__input-sheet--participant";
  table.innerHTML = `
    <colgroup>
      <col class="app__input-col app__input-col--index col-index" />
      <col class="app__input-col app__input-col--name col-name" />
      <col class="app__input-col app__input-col--role col-role participant-col-round1" />
      <col class="app__input-col app__input-col--role col-role participant-col-round2" />
    </colgroup>
    <thead>
      <tr>
        <th class="app__input-header-index header-index" scope="col"></th>
        <th scope="col">名前</th>
        <th class="participant-header-round1" scope="col">1回目</th>
        <th class="participant-header-round2" scope="col">${PARTICIPANT_HEADER_ROUND2_DEFAULT}</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  for (let i = 1; i <= PARTICIPANT_INPUT_COUNT; i += 1) {
    const row = document.createElement("tr");
    row.className = "app__input-row input-row participant-row";
    row.dataset.rowIndex = String(i - 1);

    const nameId = `participant-${i}`;
    const round1Id = `participant-${i}-round1`;
    const round2Id = `participant-${i}-round2`;

    row.innerHTML = `
      <th class="app__participant-index participant-index" scope="row">${i}</th>
      <td>
        <input
          id="${nameId}"
          class="app__participant-name participant-name"
          type="text"
          placeholder="名前を入力"
          autocomplete="off"
          aria-label="${i}番の名前"
        />
      </td>
      <td class="participant-cell-round1">
        <select
          id="${round1Id}"
          class="app__role-value role-value participant-round1-code"
          aria-label="${i}番の1回目参加方法"
        >
          <option value="" selected>-</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </td>
      <td class="participant-cell-round2">
        <select
          id="${round2Id}"
          class="app__role-value role-value participant-round2-code"
          aria-label="${i}番の2回目参加方法"
        >
          <option value="" selected>-</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </td>
    `;

    tbody.appendChild(row);
  }

  inputContainer.appendChild(table);
}

function createAdditionalParticipantFields() {
  if (!additionalContainer) {
    return;
  }

  const table = document.createElement("table");
  table.className =
    "app__input-sheet input-sheet input-sheet--additional app__input-sheet--additional";
  table.innerHTML = `
    <colgroup>
      <col class="app__input-col app__input-col--index col-index" />
      <col class="app__input-col app__input-col--name col-name" />
      <col class="app__input-col app__input-col--role col-role" />
    </colgroup>
    <thead>
      <tr>
        <th class="app__input-header-index header-index" scope="col"></th>
        <th scope="col">名前</th>
        <th scope="col">参加方法</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  for (let i = 1; i <= ADDITIONAL_PARTICIPANT_INPUT_COUNT; i += 1) {
    const row = document.createElement("tr");
    row.className = "app__input-row input-row additional-row";
    row.dataset.rowIndex = String(i - 1);

    const nameId = `additional-participant-${i}`;
    const round2Id = `additional-participant-${i}-round2`;

    row.innerHTML = `
      <th class="app__participant-index participant-index" scope="row">${i}</th>
      <td>
        <input
          id="${nameId}"
          class="app__participant-name participant-name additional-name"
          type="text"
          placeholder="名前を入力"
          autocomplete="off"
          aria-label="追加参加者${i}番の名前"
        />
      </td>
      <td>
        <select
          id="${round2Id}"
          class="app__role-value role-value additional-round2-code"
          aria-label="追加参加者${i}番の参加方法"
        >
          <option value="" selected>-</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </td>
    `;

    tbody.appendChild(row);
  }

  additionalContainer.appendChild(table);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function htmlTableToTsv(html) {
  if (!html) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr"));

  if (rows.length === 0) {
    return normalizeCellValue(doc.body?.textContent || "");
  }

  return rows
    .map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => normalizeCellValue(cell.textContent || ""))
        .join("\t")
    )
    .join("\n");
}

function getClipboardText(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return "";
  }

  const plainText = clipboard.getData("text/plain");
  if (plainText && plainText.trim().length > 0) {
    return plainText;
  }

  const tsvText = clipboard.getData("text/tab-separated-values");
  if (tsvText && tsvText.trim().length > 0) {
    return tsvText;
  }

  const textData = clipboard.getData("text");
  if (textData && textData.trim().length > 0) {
    return textData;
  }

  const htmlText = clipboard.getData("text/html");
  if (htmlText && htmlText.trim().length > 0) {
    return htmlTableToTsv(htmlText);
  }

  return "";
}

function splitRowCells(line) {
  if (line.includes("\t")) {
    return line.split("\t");
  }

  if (line.includes(",")) {
    return parseCsvLine(line);
  }

  return [line];
}

function parseRowsFromText(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return normalized
    .split("\n")
    .map((line) => splitRowCells(line).map(normalizeCellValue))
    .filter((cells) => cells.some((cell) => cell.length > 0));
}

function isNameHeaderToken(value) {
  return includesAnyTerm(value, NAME_HEADER_TERMS);
}

function isRound1HeaderToken(value) {
  return includesAnyTerm(value, ROUND1_HEADER_TERMS);
}

function isRound2HeaderToken(value) {
  return includesAnyTerm(value, ROUND2_HEADER_TERMS);
}

function looksLikeParticipantHeaderRow(row) {
  const tokens = row.map(normalizeFlagToken).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return false;
  }

  const hasName = tokens.some((token) => isNameHeaderToken(token));
  const hasRound1 = tokens.some((token) => isRound1HeaderToken(token));
  const hasRound2 = tokens.some((token) => isRound2HeaderToken(token));

  return hasName && (hasRound1 || hasRound2);
}

function resolveParticipantColumnMapping(rows) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const defaultMapping = {
    nameIndex: 0,
    round1Index: 1,
    round2Index: 2,
    headerRowIndex: -1,
  };

  if (maxColumns === 0) {
    return defaultMapping;
  }

  const headerRowIndex = rows.findIndex((row) => looksLikeParticipantHeaderRow(row));
  if (headerRowIndex >= 0) {
    const headerTokens = rows[headerRowIndex].map(normalizeFlagToken);
    const nameIndex = headerTokens.findIndex((token) => isNameHeaderToken(token));
    const round1Index = headerTokens.findIndex((token) => isRound1HeaderToken(token));
    const round2Index = headerTokens.findIndex((token) => isRound2HeaderToken(token));

    return {
      nameIndex: nameIndex >= 0 ? nameIndex : defaultMapping.nameIndex,
      round1Index: round1Index >= 0 ? round1Index : defaultMapping.round1Index,
      round2Index: round2Index >= 0 ? round2Index : defaultMapping.round2Index,
      headerRowIndex,
    };
  }

  const nonEmptyCount = Array.from({ length: maxColumns }, () => 0);
  const textLikeCount = Array.from({ length: maxColumns }, () => 0);
  const round1Score = Array.from({ length: maxColumns }, () => 0);
  const round2Score = Array.from({ length: maxColumns }, () => 0);

  rows.forEach((row) => {
    for (let i = 0; i < maxColumns; i += 1) {
      const cell = normalizeCellValue(row[i] || "");
      if (!cell) {
        continue;
      }

      nonEmptyCount[i] += 1;
      const token = normalizeFlagToken(cell);
      const isRound1Code = token === "0" || token === "1" || token === "2";
      const isRound2Code = isRound1Code || token === "3";

      if (isRound1Code) {
        round1Score[i] += 1;
      }
      if (isRound2Code) {
        round2Score[i] += 1;
      }
      if (!isRound2Code && !isNumericToken(token)) {
        textLikeCount[i] += 1;
      }
    }
  });

  let nameIndex = 0;
  let bestNameScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < maxColumns; i += 1) {
    const score = textLikeCount[i] * 6 + nonEmptyCount[i] - round2Score[i] * 3;
    if (score > bestNameScore) {
      bestNameScore = score;
      nameIndex = i;
    }
  }

  const candidateColumns = Array.from({ length: maxColumns }, (_, index) => index).filter(
    (index) => index !== nameIndex
  );

  const round1Index =
    candidateColumns
      .slice()
      .sort((a, b) => round1Score[b] - round1Score[a] || nonEmptyCount[b] - nonEmptyCount[a])[0] ??
    1;

  const round2Index =
    candidateColumns
      .filter((index) => index !== round1Index)
      .sort((a, b) => round2Score[b] - round2Score[a] || nonEmptyCount[b] - nonEmptyCount[a])[0] ??
    2;

  return {
    nameIndex,
    round1Index,
    round2Index,
    headerRowIndex: -1,
  };
}

function parseParticipantsFromText(text) {
  const rows = parseRowsFromText(text);
  if (rows.length === 0) {
    return { participants: [], skippedRows: 0 };
  }

  const mapping = resolveParticipantColumnMapping(rows);
  const dataRows =
    mapping.headerRowIndex >= 0
      ? rows.filter((_, index) => index !== mapping.headerRowIndex)
      : rows;

  let skippedRows = 0;

  const participants = dataRows
    .map((cells) => {
      const name = normalizeCellValue(cells[mapping.nameIndex] || "");
      if (!name) {
        skippedRows += 1;
        return null;
      }

      const round1Code = parseRound1Code(cells[mapping.round1Index] || "");
      const round2Code = parseRound2Code(cells[mapping.round2Index] || "");

      if (!round1Code && !round2Code) {
        skippedRows += 1;
        return null;
      }

      return {
        name,
        round1Code,
        round2Code,
      };
    })
    .filter((participant) => participant !== null);

  return { participants, skippedRows };
}

function parseAdditionalParticipantsFromText(text) {
  const rows = parseRowsFromText(text);
  if (rows.length === 0) {
    return { participants: [], skippedRows: 0 };
  }

  let headerRowIndex = -1;
  const headerIndex = rows.findIndex((row) => {
    const tokens = row.map(normalizeFlagToken);
    return tokens.some((token) => isNameHeaderToken(token));
  });

  if (headerIndex >= 0) {
    headerRowIndex = headerIndex;
  }

  const baseRows =
    headerRowIndex >= 0 ? rows.filter((_, index) => index !== headerRowIndex) : rows;

  let skippedRows = 0;

  const participants = baseRows
    .map((cells) => {
      const name = normalizeCellValue(cells[0] || "");
      if (!name) {
        skippedRows += 1;
        return null;
      }

      const round2Code = parseAdditionalRound2Code(cells[1] || "");
      if (!round2Code) {
        skippedRows += 1;
        return null;
      }

      return { name, round2Code };
    })
    .filter((participant) => participant !== null);

  return { participants, skippedRows };
}

function parseFacilitatorNamesFromText(text) {
  const rows = parseRowsFromText(text);
  const allCells = rows.flatMap((cells) => cells.map(normalizeCellValue));
  const names = allCells.filter((name) => name.length > 0);

  return names;
}

function dedupeNames(names) {
  const unique = [];
  const seen = new Set();
  let duplicateCount = 0;

  names.forEach((name) => {
    const key = normalizeNameKey(name);
    if (!key) {
      return;
    }

    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    seen.add(key);
    unique.push(name.trim());
  });

  return { unique, duplicateCount };
}

function getFacilitatorInputs() {
  if (!facilitatorContainer) {
    return [];
  }
  return Array.from(facilitatorContainer.querySelectorAll(".facilitator-name"));
}

function getParticipantRows() {
  if (!inputContainer) {
    return [];
  }
  return Array.from(inputContainer.querySelectorAll(".participant-row"));
}

function getAdditionalRows() {
  if (!additionalContainer) {
    return [];
  }
  return Array.from(additionalContainer.querySelectorAll(".additional-row"));
}

function getFacilitatorCandidates() {
  const names = getFacilitatorInputs()
    .map((input) => {
      if (!(input instanceof HTMLInputElement)) {
        return "";
      }
      return normalizeCellValue(input.value);
    })
    .filter((name) => name.length > 0);

  const { unique, duplicateCount } = dedupeNames(names);
  return { names: unique, duplicateCount };
}

function getBaseParticipants() {
  return getParticipantRows()
    .map((row) => {
      const nameInput = row.querySelector(".participant-name");
      const round1Select = row.querySelector(".participant-round1-code");
      const round2Select = row.querySelector(".participant-round2-code");
      if (
        !(nameInput instanceof HTMLInputElement) ||
        !(round1Select instanceof HTMLSelectElement) ||
        !(round2Select instanceof HTMLSelectElement)
      ) {
        return null;
      }

      const rowIndex = Number(row.dataset.rowIndex || "-1");
      const name = normalizeCellValue(nameInput.value);
      if (!name) {
        return null;
      }

      return {
        sourceId: `base-${rowIndex}`,
        name,
        round1Code: parseRound1Code(round1Select.value),
        round2Code: parseRound2Code(round2Select.value),
      };
    })
    .filter((participant) => participant !== null);
}

function getAdditionalParticipants() {
  return getAdditionalRows()
    .map((row) => {
      const nameInput = row.querySelector(".additional-name");
      const round2Select = row.querySelector(".additional-round2-code");
      if (
        !(nameInput instanceof HTMLInputElement) ||
        !(round2Select instanceof HTMLSelectElement)
      ) {
        return null;
      }

      const rowIndex = Number(row.dataset.rowIndex || "-1");
      const name = normalizeCellValue(nameInput.value);
      if (!name) {
        return null;
      }

      return {
        sourceId: `additional-${rowIndex}`,
        name,
        round2Code: parseAdditionalRound2Code(round2Select.value),
      };
    })
    .filter((participant) => participant !== null);
}

function buildFacilitatorOnlyParticipants(existingNames = []) {
  const existingNameKeys = new Set(
    existingNames.map((name) => normalizeNameKey(name)).filter((name) => name.length > 0)
  );

  return getFacilitatorCandidates().names
    .filter((name) => !existingNameKeys.has(normalizeNameKey(name)))
    .map((name) => ({
      sourceId: `facilitator-candidate-${normalizeNameKey(name)}`,
      name,
      listener: false,
      facilitator: true,
      isAdditional: false,
    }));
}

function buildRound1Participants() {
  const baseParticipants = getBaseParticipants();
  const facilitatorSet = new Set(
    getFacilitatorCandidates().names.map((name) => normalizeNameKey(name))
  );

  const round1Participants = baseParticipants
    .filter(
      (participant) =>
        participant.round1Code === "0" ||
        participant.round1Code === "1" ||
        participant.round1Code === "2"
    )
    .map((participant) => ({
      sourceId: participant.sourceId,
      name: participant.name,
      listener: participant.round1Code === "2",
      facilitator:
        participant.round1Code === "0" ||
        facilitatorSet.has(normalizeNameKey(participant.name)),
    }));

  const facilitatorOnlyParticipants = buildFacilitatorOnlyParticipants(
    baseParticipants.map((participant) => participant.name)
  ).map((participant) => ({
    sourceId: participant.sourceId,
    name: participant.name,
    listener: false,
    facilitator: true,
  }));

  return round1Participants.concat(facilitatorOnlyParticipants);
}

function buildRound2Participants() {
  const baseParticipantsSource = getBaseParticipants();
  const additionalParticipantsSource = getAdditionalParticipants();
  const facilitatorSet = new Set(
    getFacilitatorCandidates().names.map((name) => normalizeNameKey(name))
  );

  const baseParticipants = baseParticipantsSource
    .filter(
      (participant) =>
        participant.round2Code === "0" ||
        participant.round2Code === "1" ||
        participant.round2Code === "2"
    )
    .map((participant) => ({
      sourceId: participant.sourceId,
      name: participant.name,
      listener: participant.round2Code === "2",
      facilitator:
        participant.round2Code === "0" ||
        facilitatorSet.has(normalizeNameKey(participant.name)),
      isAdditional: false,
    }));

  const additionalParticipants = additionalParticipantsSource
    .filter(
      (participant) =>
        participant.round2Code === "0" ||
        participant.round2Code === "1" ||
        participant.round2Code === "2"
    )
    .map((participant) => ({
      sourceId: participant.sourceId,
      name: participant.name,
      listener: participant.round2Code === "2",
      facilitator:
        participant.round2Code === "0" ||
        facilitatorSet.has(normalizeNameKey(participant.name)),
      isAdditional: true,
    }));

  const facilitatorOnlyParticipants = buildFacilitatorOnlyParticipants(
    baseParticipantsSource
      .map((participant) => participant.name)
      .concat(additionalParticipantsSource.map((participant) => participant.name))
  );

  return baseParticipants.concat(additionalParticipants, facilitatorOnlyParticipants);
}

function getMinimumMembersPerGroup(participantCount) {
  if (participantCount >= MIN_MEMBERS_PER_GROUP_LARGE_THRESHOLD) {
    return MIN_MEMBERS_PER_GROUP_LARGE;
  }
  return MIN_MEMBERS_PER_GROUP;
}

function getRequiredGroupCount(participantCount) {
  if (participantCount <= 0) {
    return MIN_GROUP_COUNT;
  }
  return Math.ceil(participantCount / MAX_MEMBERS_PER_GROUP);
}

function getMaximumGroupCount(
  participantCount
) {
  if (participantCount <= 0) {
    return 0;
  }

  const minMembers = getMinimumMembersPerGroup(participantCount);
  const participantCapacityUpperBound = Math.floor(participantCount / minMembers);
  return Math.min(PARTICIPANT_INPUT_COUNT, participantCapacityUpperBound);
}

function countFacilitatorParticipants(participants) {
  return participants.filter((participant) => participant.facilitator).length;
}

function getDefaultGroupCount(minimumSelectable, maximumSelectable, facilitatorCount) {
  if (facilitatorCount > 0) {
    return Math.min(maximumSelectable, Math.max(minimumSelectable, facilitatorCount));
  }

  return maximumSelectable;
}

function formatPeopleRange(minValue, maxValue) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return "-";
  }

  if (minValue === maxValue) {
    return `${minValue}人`;
  }

  return `${minValue}〜${maxValue}人`;
}

function rebuildGroupSelect(
  selectElement,
  participantCount,
  facilitatorCount = 0
) {
  if (!(selectElement instanceof HTMLSelectElement)) {
    return;
  }

  const previousValue = Number(selectElement.value);
  const keepManualSelection = selectElement.dataset.userSelected === "true";
  const minMembers = getMinimumMembersPerGroup(participantCount);
  const minimumSelectable = Math.max(MIN_GROUP_COUNT, getRequiredGroupCount(participantCount));
  const maximumSelectable = getMaximumGroupCount(participantCount);

  if (minimumSelectable > maximumSelectable) {
    selectElement.innerHTML = '<option value="">-</option>';
    selectElement.value = "";
    selectElement.disabled = true;
    selectElement.dataset.userSelected = "false";
    syncCustomGroupSelect(selectElement);
    return;
  }

  const options = [];
  for (let value = maximumSelectable; value >= minimumSelectable; value -= 1) {
    options.push(`<option value="${value}">${value}</option>`);
  }

  selectElement.innerHTML = options.join("");
  selectElement.disabled = false;

  const canKeepPreviousValue = keepManualSelection &&
    Number.isFinite(previousValue) &&
    previousValue >= minimumSelectable &&
    previousValue <= maximumSelectable;
  const fallbackValue = canKeepPreviousValue
    ? previousValue
    : getDefaultGroupCount(minimumSelectable, maximumSelectable, facilitatorCount);
  selectElement.value = String(fallbackValue);
  if (!canKeepPreviousValue) {
    selectElement.dataset.userSelected = "false";
  }

  if (participantCount < MIN_GROUP_COUNT * minMembers) {
    selectElement.value = "";
    selectElement.dataset.userSelected = "false";
  }

  syncCustomGroupSelect(selectElement);
}

function updateRoundGuides() {
  const facilitator = getFacilitatorCandidates();
  const round1Participants = buildRound1Participants();
  const round2Participants = buildRound2Participants();
  const baseParticipants = getBaseParticipants();
  const additionalParticipants = getAdditionalParticipants();

  const round1MicOn = round1Participants.filter((participant) => !participant.listener).length;
  const round1Listeners = round1Participants.length - round1MicOn;
  const round1Facilitators = countFacilitatorParticipants(round1Participants);

  const round2MicOn = round2Participants.filter((participant) => !participant.listener).length;
  const round2Listeners = round2Participants.length - round2MicOn;
  const round2Facilitators = countFacilitatorParticipants(round2Participants);

  const round1GroupCount = Number(groupSelectRound1?.value || "0");
  const round2GroupCount = Number(groupSelectRound2?.value || "0");

  if (participantGuideRound1) {
    participantGuideRound1.textContent = `参加者：${round1Participants.length}人（マイクオン：${round1MicOn}人）`;
  }

  if (participantGuideRound2) {
    participantGuideRound2.textContent = `参加者：${round2Participants.length}人（マイクオン：${round2MicOn}人）`;
  }

  if (facilitatorCount) {
    facilitatorCount.textContent = `登録済み：${facilitator.names.length}人`;
  }

  const round1MembersText = Number.isInteger(round1GroupCount) && round1GroupCount > 0
    ? formatPeopleRange(
        Math.floor(round1Participants.length / round1GroupCount),
        Math.ceil(round1Participants.length / round1GroupCount)
      )
    : "-〜-人";

  const round1MicText = Number.isInteger(round1GroupCount) && round1GroupCount > 0
    ? formatPeopleRange(
        Math.floor(round1MicOn / round1GroupCount),
        Math.ceil(round1MicOn / round1GroupCount)
      )
    : "-〜-人";

  if (micOnGuideRound1) {
    micOnGuideRound1.textContent = `1グループ：${round1MembersText}（マイクオン：${round1MicText}）`;
  }

  if (listenerGuideRound1) {
    listenerGuideRound1.textContent = `聞き専：${round1Listeners}人 / ファシ候補：${round1Facilitators}人`;
  }

  const round2MembersText = Number.isInteger(round2GroupCount) && round2GroupCount > 0
    ? formatPeopleRange(
        Math.floor(round2Participants.length / round2GroupCount),
        Math.ceil(round2Participants.length / round2GroupCount)
      )
    : "-〜-人";

  const round2MicText = Number.isInteger(round2GroupCount) && round2GroupCount > 0
    ? formatPeopleRange(
        Math.floor(round2MicOn / round2GroupCount),
        Math.ceil(round2MicOn / round2GroupCount)
      )
    : "-〜-人";

  const absentBaseCount = baseParticipants.filter((participant) => participant.round2Code === "3").length;
  const absentAdditionalCount = additionalParticipants.filter(
    (participant) => participant.round2Code === "3"
  ).length;
  const absentCount = absentBaseCount + absentAdditionalCount;
  const activeAdditionalCount = additionalParticipants.filter(
    (participant) =>
      participant.round2Code === "0" ||
      participant.round2Code === "1" ||
      participant.round2Code === "2"
  ).length;

  if (micOnGuideRound2) {
    micOnGuideRound2.textContent = `1グループ：${round2MembersText}（マイクオン：${round2MicText}）`;
  }

  if (listenerGuideRound2) {
    listenerGuideRound2.textContent = `聞き専：${round2Listeners}人 / ファシ候補：${round2Facilitators}人 / 不参加：${absentCount}人 / 追加：${activeAdditionalCount}人`;
  }
}

function updateGroupSelectConstraints() {
  const round1Participants = buildRound1Participants();
  const round2Participants = buildRound2Participants();

  rebuildGroupSelect(
    groupSelectRound1,
    round1Participants.length,
    countFacilitatorParticipants(round1Participants)
  );
  rebuildGroupSelect(
    groupSelectRound2,
    round2Participants.length,
    countFacilitatorParticipants(round2Participants)
  );

  updateRoundGuides();
  updateActionButtonStates();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildBalancedCapacities(totalCount, groupCount) {
  const capacities = Array.from({ length: groupCount }, () => Math.floor(totalCount / groupCount));
  const remainder = totalCount % groupCount;
  const order = shuffle(Array.from({ length: groupCount }, (_, index) => index));

  for (let i = 0; i < remainder; i += 1) {
    capacities[order[i]] += 1;
  }

  return capacities;
}

function buildRoleTargets(roleCount, capacities) {
  const targets = Array.from({ length: capacities.length }, () => 0);

  for (let i = 0; i < roleCount; i += 1) {
    let chosenGroup = -1;

    for (let groupIndex = 0; groupIndex < capacities.length; groupIndex += 1) {
      if (targets[groupIndex] >= capacities[groupIndex]) {
        continue;
      }

      if (chosenGroup === -1) {
        chosenGroup = groupIndex;
        continue;
      }

      const chosenTarget = targets[chosenGroup];
      const candidateTarget = targets[groupIndex];

      if (candidateTarget < chosenTarget) {
        chosenGroup = groupIndex;
        continue;
      }

      if (candidateTarget === chosenTarget) {
        const chosenRemaining = capacities[chosenGroup] - targets[chosenGroup];
        const candidateRemaining = capacities[groupIndex] - targets[groupIndex];

        if (
          candidateRemaining > chosenRemaining ||
          (candidateRemaining === chosenRemaining && Math.random() < 0.5)
        ) {
          chosenGroup = groupIndex;
        }
      }
    }

    if (chosenGroup === -1) {
      break;
    }

    targets[chosenGroup] += 1;
  }

  return targets;
}

function expandGroupSlots(targets) {
  return targets.flatMap((count, groupIndex) =>
    Array.from({ length: count }, () => groupIndex)
  );
}

function seedFacilitatorsAcrossGroups(groups, facilitatorParticipants) {
  if (!Array.isArray(groups) || groups.length === 0 || facilitatorParticipants.length < groups.length) {
    return new Set();
  }

  const assignedIds = new Set();
  const shuffledGroupOrder = shuffle(Array.from({ length: groups.length }, (_, index) => index));
  const shuffledFacilitators = shuffle([...facilitatorParticipants]);

  shuffledGroupOrder.forEach((groupIndex, orderIndex) => {
    const facilitator = shuffledFacilitators[orderIndex];
    if (!facilitator) {
      return;
    }
    groups[groupIndex].push(facilitator);
    assignedIds.add(facilitator.sourceId);
  });

  return assignedIds;
}

function buildPairKey(sourceIdA, sourceIdB) {
  return sourceIdA < sourceIdB ? `${sourceIdA}::${sourceIdB}` : `${sourceIdB}::${sourceIdA}`;
}

function buildGroupCompositionKey(group) {
  return group
    .map((participant) => participant.sourceId)
    .sort()
    .join("||");
}

function calculateBalanceScore(
  groups,
  capacities,
  totals,
  totalCount,
  micOnTargets,
  listenerTargets,
  options = {}
) {
  let score = 0;

  groups.forEach((group, index) => {
    const listeners = group.filter((item) => item.listener).length;
    const micOn = group.length - listeners;
    const facilitators = group.filter((item) => item.facilitator).length;

    const targetListeners = (totals.listeners * capacities[index]) / totalCount;
    const targetFacilitators = (totals.facilitators * capacities[index]) / totalCount;

    score += (micOn - micOnTargets[index]) ** 2 * 12;
    score += (listeners - listenerTargets[index]) ** 2 * 3;
    score += (listeners - targetListeners) ** 2 * 0.8;
    score += (facilitators - targetFacilitators) ** 2 * 2.2;
  });

  if (options.pairHistory instanceof Map && options.pairHistory.size > 0) {
    groups.forEach((group) => {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const key = buildPairKey(group[i].sourceId, group[j].sourceId);
          const overlapCount = options.pairHistory.get(key) || 0;
          if (overlapCount > 0) {
            score += overlapCount * (options.pairPenaltyWeight || ROUND2_PAIR_OVERLAP_PENALTY);
          }
        }
      }

      const compositionKey = buildGroupCompositionKey(group);
      if (
        options.previousGroupCompositions instanceof Set &&
        options.previousGroupCompositions.has(compositionKey)
      ) {
        score += options.sameGroupPenalty || ROUND2_SAME_GROUP_PENALTY;
      }
    });
  }

  return score;
}

function splitIntoBalancedGroups(participants, groupCount, options = {}) {
  const totalCount = participants.length;
  const capacities = buildBalancedCapacities(totalCount, groupCount);
  const facilitatorParticipants = participants.filter((item) => item.facilitator);
  const listenerParticipants = participants.filter((item) => item.listener);
  const micOnParticipants = participants.filter((item) => !item.listener);

  const listenerTargets = buildRoleTargets(listenerParticipants.length, capacities);
  const micOnTargets = capacities.map((capacity, index) => capacity - listenerTargets[index]);
  const lockOneFacilitatorPerGroup = facilitatorParticipants.length >= groupCount;

  const totals = {
    listeners: listenerParticipants.length,
    facilitators: facilitatorParticipants.length,
  };

  const iterations = Number.isInteger(options.iterations)
    ? options.iterations
    : Math.max(1200, totalCount * 300);

  let bestScore = Number.POSITIVE_INFINITY;
  let bestGroups = null;

  for (let i = 0; i < iterations; i += 1) {
    const groups = Array.from({ length: groupCount }, () => []);
    let remainingCapacities = [...capacities];
    let availableListeners = listenerParticipants;
    let availableMicOn = micOnParticipants;

    if (lockOneFacilitatorPerGroup) {
      const seededFacilitatorIds = seedFacilitatorsAcrossGroups(groups, facilitatorParticipants);

      remainingCapacities = remainingCapacities.map(
        (capacity, groupIndex) => capacity - groups[groupIndex].length
      );
      availableListeners = listenerParticipants.filter(
        (participant) => !seededFacilitatorIds.has(participant.sourceId)
      );
      availableMicOn = micOnParticipants.filter(
        (participant) => !seededFacilitatorIds.has(participant.sourceId)
      );
    }

    const remainingListenerTargets = buildRoleTargets(
      availableListeners.length,
      remainingCapacities
    );
    const remainingMicOnTargets = remainingCapacities.map(
      (capacity, index) => capacity - remainingListenerTargets[index]
    );

    const shuffledListeners = shuffle([...availableListeners]);
    const shuffledListenerSlots = shuffle(expandGroupSlots(remainingListenerTargets));
    const shuffledMicOn = shuffle([...availableMicOn]);
    const shuffledMicOnSlots = shuffle(expandGroupSlots(remainingMicOnTargets));

    shuffledListeners.forEach((participant, index) => {
      groups[shuffledListenerSlots[index]].push(participant);
    });

    shuffledMicOn.forEach((participant, index) => {
      groups[shuffledMicOnSlots[index]].push(participant);
    });

    const score = calculateBalanceScore(
      groups,
      capacities,
      totals,
      totalCount,
      micOnTargets,
      listenerTargets,
      options
    );

    if (score < bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      bestGroups = groups;
    }
  }

  return bestGroups;
}

function buildRound1History(groups) {
  const pairHistory = new Map();
  const groupCompositions = new Set();

  groups.forEach((group) => {
    groupCompositions.add(buildGroupCompositionKey(group));

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const key = buildPairKey(group[i].sourceId, group[j].sourceId);
        pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
      }
    }
  });

  return { pairHistory, groupCompositions };
}

function measureRound2Overlaps(groups) {
  let pairOverlapCount = 0;
  let sameGroupCount = 0;

  groups.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const key = buildPairKey(group[i].sourceId, group[j].sourceId);
        if (round1PairHistory.has(key)) {
          pairOverlapCount += 1;
        }
      }
    }

    const compositionKey = buildGroupCompositionKey(group);
    if (round1GroupCompositions.has(compositionKey)) {
      sameGroupCount += 1;
    }
  });

  return { pairOverlapCount, sameGroupCount };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatGroupSymbol(groupNumber) {
  const normalized = Number(groupNumber);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return String(groupNumber);
  }

  return String(normalized);
}

function pickFacilitatorIndex(group) {
  const facilitatorIndexes = group
    .map((participant, index) => (participant.facilitator ? index : -1))
    .filter((index) => index !== -1);

  if (facilitatorIndexes.length === 0) {
    return -1;
  }

  const nonListenerFacilitator = facilitatorIndexes.find((index) => !group[index].listener);
  if (typeof nonListenerFacilitator === "number") {
    return nonListenerFacilitator;
  }

  return facilitatorIndexes[0];
}

function buildDisplayMembers(group) {
  const facilitatorIndex = pickFacilitatorIndex(group);

  return group
    .map((participant, index) => {
      const isFacilitator = index === facilitatorIndex;
      const isListener = participant.listener && !isFacilitator;
      return { participant, index, isFacilitator, isListener };
    })
    .sort((a, b) => {
      const rankA = a.isFacilitator ? 0 : a.isListener ? 2 : 1;
      const rankB = b.isFacilitator ? 0 : b.isListener ? 2 : 1;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.index - b.index;
    });
}

function renderGroups(groups, roundLabel) {
  if (!ensureModalElements()) {
    return;
  }

  setModalRoundActionVisibility(roundLabel === "1回目", roundLabel !== "1回目");

  const cards = groups
    .map((group, index) => {
      const displayMembers = buildDisplayMembers(group);
      const facilitatorName = displayMembers.find((member) => member.isFacilitator)?.participant.name;

      const facilitatorLabel = facilitatorName
        ? `${escapeHtml(facilitatorName)}さん`
        : "ファシ未設定";
      const facilitatorRawLabel = facilitatorName ? `${facilitatorName}さん` : "ファシ未設定";

      const groupPrefix = formatGroupSymbol(index + 1);
      const headingText = `${groupPrefix}: ${facilitatorLabel}グループ`;
      const headingTitle = `${groupPrefix}: ${facilitatorRawLabel}グループ`;

      const members =
        displayMembers.length > 0
          ? displayMembers
              .map((member) => {
                const roleLabels = [];
                if (member.isFacilitator) {
                  roleLabels.push("ファシ");
                }
                if (member.isListener) {
                  roleLabels.push("聞き専");
                }

                const badges =
                  roleLabels.length > 0
                    ? `<span class="result-group-card__tags member-tags">${roleLabels
                        .map((label) => {
                          const className =
                            label === "ファシ"
                              ? "result-group-card__tag result-group-card__tag--facilitator member-tag facilitator"
                              : "result-group-card__tag result-group-card__tag--listener member-tag listener";
                          return `<em class="${className}">${label}</em>`;
                        })
                        .join("")}</span>`
                    : "";

                return `<li class="result-group-card__member member-item">
                  <span class="result-group-card__member-name member-name">${escapeHtml(
                    member.participant.name
                  )}</span>
                  ${badges}
                </li>`;
              })
              .join("")
          : '<li class="result-group-card__empty empty">メンバーなし</li>';

      return `<article class="result-group-card group-card result-group-card--pop result-pop">
        <h3 class="result-group-card__title" title="${escapeHtml(headingTitle)}">${headingText}</h3>
        <ul>${members}</ul>
      </article>`;
    })
    .join("");

  updateModalDrawHeader({ active: false });
  modalContent.dataset.groupCount = String(groups.length);

  const overlapInfo =
    roundLabel === "2回目"
      ? `<p class="result-groups-note">同席重複ペア: ${round2OverlapStats.pairOverlapCount} / 同一構成グループ: ${round2OverlapStats.sameGroupCount}</p>`
      : "";

  modalContent.innerHTML = `
    <div class="result-groups-layout">
      <div class="result-groups-fit result-grid-fit" data-group-count="${groups.length}">
        <div class="result-groups-grid group-grid">${cards}</div>
      </div>
      ${overlapInfo}
    </div>
  `;
  scheduleResultGridFit();
}

function clearDrawTimers() {
  if (drawIntervalId !== null) {
    window.clearInterval(drawIntervalId);
    drawIntervalId = null;
  }

  if (countdownIntervalId !== null) {
    window.clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }

  if (revealTimeoutId !== null) {
    window.clearTimeout(revealTimeoutId);
    revealTimeoutId = null;
  }

  stopDrumRoll();
}

function getDrumRollAudio() {
  if (!drumRollAudio) {
    drumRollAudio = new Audio(DRUM_ROLL_SOUND_SRC);
    drumRollAudio.preload = "auto";
    drumRollAudio.load();
  }

  return drumRollAudio;
}

async function startDrumRoll() {
  stopDrumRoll();

  const audio = getDrumRollAudio();

  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    stopDrumRoll();
  }
}

function stopDrumRoll() {
  if (!drumRollAudio) {
    return;
  }

  drumRollAudio.pause();

  try {
    drumRollAudio.currentTime = 0;
  } catch (error) {
    // Some browsers can reject seeking before metadata is loaded.
  }
}

function ensureModalDrawPhaseMinWidth() {
  if (!modalDrawPhase || !modalDrawIndicator) {
    return;
  }

  if (modalDrawPhase.dataset.widthFixed === "1") {
    return;
  }

  const measureElement = document.createElement("span");
  measureElement.className = modalDrawPhase.className;
  measureElement.style.position = "absolute";
  measureElement.style.visibility = "hidden";
  measureElement.style.pointerEvents = "none";
  measureElement.style.left = "-9999px";
  measureElement.style.top = "0";

  modalDrawIndicator.appendChild(measureElement);

  let maxWidth = 0;
  DRAW_PHASE_TEXTS.forEach((text) => {
    measureElement.textContent = text;
    maxWidth = Math.max(maxWidth, Math.ceil(measureElement.getBoundingClientRect().width));
  });

  measureElement.remove();

  if (maxWidth > 0) {
    modalDrawPhase.style.minWidth = `${maxWidth}px`;
    modalDrawPhase.dataset.widthFixed = "1";
  }
}

function updateModalDrawHeader({
  active,
  phaseText = "ファシリテーター決定中",
  remainingMs = DRAW_DURATION_MS,
  progress = 0,
}) {
  if (!ensureModalElements()) {
    return;
  }

  if (
    !modal ||
    !modalDrawIndicator ||
    !modalDrawPhase ||
    !modalDrawCountdown ||
    !modalDrawProgressBar
  ) {
    return;
  }

  if (!active) {
    modal.classList.remove("is-drawing");
    modalDrawIndicator.hidden = true;
    modalDrawPhase.textContent = "";
    modalDrawCountdown.textContent = "0.0";
    modalDrawProgressBar.style.transform = "scaleX(0)";
    return;
  }

  const safeRemainingMs = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const safeProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  modal.classList.add("is-drawing");
  modalDrawIndicator.hidden = false;
  ensureModalDrawPhaseMinWidth();
  modalDrawPhase.textContent = phaseText;
  modalDrawCountdown.textContent = (safeRemainingMs / 1000).toFixed(1);
  modalDrawProgressBar.style.transform = `scaleX(${safeProgress.toFixed(4)})`;
}

function setShuffleButtonsDrawing(round) {
  if (shuffleRound1Button) {
    if (round === 1) {
      shuffleRound1Button.textContent = "抽選中...";
    } else {
      shuffleRound1Button.innerHTML = SHUFFLE_ROUND1_IDLE_HTML;
    }
  }

  if (shuffleRound2Button) {
    if (round === 2) {
      shuffleRound2Button.textContent = "抽選中...";
    } else {
      shuffleRound2Button.innerHTML = SHUFFLE_ROUND2_IDLE_HTML;
    }
  }
}

function openModal(title) {
  if (!ensureModalElements()) {
    return false;
  }

  modalTitle.textContent = title;
  setModalRoundActionVisibility(false, true);
  updateModalDrawHeader({ active: false });
  modal.hidden = false;
  return true;
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function closeModal() {
  if (isDrawing) {
    return;
  }

  if (!ensureModalElements()) {
    return;
  }

  updateModalDrawHeader({ active: false });
  modal.hidden = true;

  if (currentPhase === 5) {
    setPhase(4);
  } else if (currentPhase === 3) {
    setPhase(2);
  }
}

function syncResultPanelForCurrentPhase() {
  if (isDrawing || !ensureModalElements()) {
    return;
  }

  if (currentPhase === 3 && round1Groups) {
    openModal("1回目 振り分け完了");
    setModalLocked(false);
    renderGroups(round1Groups, "1回目");
    return;
  }

  if (currentPhase === 5 && round2Groups) {
    openModal("2回目 振り分け完了");
    setModalLocked(false);
    renderGroups(round2Groups, "2回目");
    return;
  }

  updateModalDrawHeader({ active: false });
  modal.hidden = true;
}

function setModalLocked(locked) {
  if (!ensureModalElements()) {
    return;
  }

  modal.classList.toggle("locked", locked);
  modalCloseButton.disabled = locked;
  if (modalGoRound2Button instanceof HTMLButtonElement && !modalGoRound2Button.hidden) {
    modalGoRound2Button.disabled = locked;
  }
}

function applyResultGridFit() {
  if (!ensureModalElements()) {
    return;
  }

  const groupCount = Number(modalContent.dataset.groupCount || "0");
  const fitRoot = modalContent.querySelector(".result-groups-fit, .result-grid-fit");
  const resultLayout = modalContent.querySelector(".result-groups-layout");

  const shouldFit =
    Boolean(fitRoot) &&
    Number.isInteger(groupCount) &&
    groupCount > 0 &&
    groupCount <= MAX_GROUPS_WITHOUT_MODAL_SCROLL;

  modalContent.classList.toggle("is-fit-groups", shouldFit);
  if (modal) {
    modal.classList.toggle("is-fit-groups", shouldFit);
  }
  if (!fitRoot) {
    return;
  }

  fitRoot.classList.toggle("is-fit-25", shouldFit);
  fitRoot.style.removeProperty("--fit-scale");

  const grid = fitRoot.querySelector(".result-groups-grid, .group-grid");
  if (!grid) {
    return;
  }

  if (!shouldFit) {
    grid.style.removeProperty("grid-template-columns");
    return;
  }

  const columnCount = getGridColumnCount(groupCount);
  grid.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
}

function scheduleResultGridFit() {
  if (modalFitRafId !== null) {
    window.cancelAnimationFrame(modalFitRafId);
  }

  modalFitRafId = window.requestAnimationFrame(() => {
    modalFitRafId = null;
    applyResultGridFit();
    lockDrawGridTrackSizes();
  });
}

function getGridMaxColumnCount() {
  if (window.matchMedia(`(max-width: ${DRAW_GRID_MOBILE_MAX_WIDTH}px)`).matches) {
    return DRAW_GRID_COLUMNS_MOBILE;
  }
  return DRAW_GRID_COLUMNS_DESKTOP;
}

function getGridColumnCount(groupCount) {
  const normalizedGroupCount = Number(groupCount);
  const maxColumns = getGridMaxColumnCount();

  if (!Number.isInteger(normalizedGroupCount) || normalizedGroupCount <= 0) {
    return maxColumns;
  }

  const TARGET_ASPECT_RATIO = 16 / 9;
  const cappedMaxColumns = Math.max(1, Math.min(normalizedGroupCount, maxColumns));
  let bestColumnCount = cappedMaxColumns;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columnCount = 1; columnCount <= cappedMaxColumns; columnCount += 1) {
    const rowCount = Math.ceil(normalizedGroupCount / columnCount);
    const emptySlots = rowCount * columnCount - normalizedGroupCount;
    const ratioDiff = Math.abs(columnCount / rowCount - TARGET_ASPECT_RATIO);
    const score = ratioDiff * 10 + emptySlots * 2;

    if (score < bestScore) {
      bestScore = score;
      bestColumnCount = columnCount;
    }
  }

  return bestColumnCount;
}

function lockDrawGridTrackSizes() {
  if (!ensureModalElements() || !modalContent) {
    return;
  }

  const drawGrid = modalContent.querySelector(".result-groups-grid--draw, .draw-group-grid");
  if (!(drawGrid instanceof HTMLElement)) {
    return;
  }

  const groupCount = Number(modalContent.dataset.groupCount || drawGrid.children.length || "0");
  const columnCount = getGridColumnCount(groupCount);
  if (!Number.isInteger(columnCount) || columnCount <= 0) {
    return;
  }

  const computedStyle = window.getComputedStyle(drawGrid);
  const gapValue = computedStyle.columnGap || computedStyle.gap || "0";
  const gap = Number.parseFloat(gapValue) || 0;
  const containerWidth = drawGrid.clientWidth;

  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return;
  }

  const trackWidth = Math.max(1, Math.floor((containerWidth - gap * (columnCount - 1)) / columnCount));

  drawGrid.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, ${trackWidth}px))`;
  drawGrid.style.justifyContent = "center";
}

function buildAnimatedPreviewGroups(participants, groupCount) {
  const capacities = buildBalancedCapacities(participants.length, groupCount);
  const slots = capacities.flatMap((count, groupIndex) =>
    Array.from({ length: count }, () => groupIndex)
  );

  const shuffledSlots = shuffle([...slots]);
  const shuffledParticipants = shuffle([...participants]);
  const groups = Array.from({ length: groupCount }, () => []);

  shuffledParticipants.forEach((participant, index) => {
    groups[shuffledSlots[index]].push(participant);
  });

  groups.forEach((group) => {
    shuffle(group);
  });

  return groups;
}

function getShuffledRandomMembers(participants, count, blockedIds = []) {
  const blockedSet = new Set(blockedIds);
  const filtered = participants.filter((participant) => !blockedSet.has(participant.sourceId));
  const shuffled = shuffle([...filtered]);
  return shuffled.slice(0, count);
}

function buildPhasePreviewState(participants, finalGroups, elapsedMs, options = {}) {
  const groupCount = finalGroups.length;
  const randomGroups = buildAnimatedPreviewGroups(participants, groupCount);
  const hasFacilitatorPhase = options.hasFacilitatorPhase === true;
  const facilitatorPhaseDuration = hasFacilitatorPhase ? FACILITATOR_DRAW_MS : 0;
  const facilitatorLocked = hasFacilitatorPhase && elapsedMs >= facilitatorPhaseDuration;
  const memberPhaseDuration = Math.max(1, DRAW_DURATION_MS - facilitatorPhaseDuration);
  const memberProgress = Math.min(
    1,
    Math.max(0, elapsedMs - facilitatorPhaseDuration) / memberPhaseDuration
  );

  return finalGroups.map((finalGroup, index) => {
    const randomGroup = randomGroups[index] || [];

    const facilitatorCandidateIndex = pickFacilitatorIndex(finalGroup);
    const hasDesignatedFacilitator = facilitatorCandidateIndex !== -1;

    const finalFacilitator =
      hasDesignatedFacilitator ? finalGroup[facilitatorCandidateIndex] : null;

    const randomFacilitator =
      hasDesignatedFacilitator
        ? randomGroup[Math.floor(Math.random() * Math.max(1, randomGroup.length))] ||
          finalFacilitator
        : null;

    const facilitatorParticipant = hasDesignatedFacilitator
      ? facilitatorLocked
        ? finalFacilitator || randomFacilitator
        : randomFacilitator || finalFacilitator
      : null;

    const finalMembers = hasDesignatedFacilitator
      ? finalGroup.filter((_, memberIndex) => memberIndex !== facilitatorCandidateIndex)
      : finalGroup;
    const memberCount = finalMembers.length;

    const lockedMemberCount = facilitatorLocked
      ? Math.min(memberCount, Math.floor(memberProgress * memberCount))
      : 0;

    const lockedMembers = finalMembers
      .slice(0, lockedMemberCount)
      .map((participant) => ({ participant, locked: true }));

    const randomGroupMembers = randomGroup.filter(
      (participant) =>
        participant.sourceId !== facilitatorParticipant?.sourceId &&
        !lockedMembers.some((item) => item.participant.sourceId === participant.sourceId)
    );

    const remainingCount = memberCount - lockedMemberCount;
    let randomMembers = randomGroupMembers.slice(0, remainingCount);

    if (randomMembers.length < remainingCount) {
      const fallback = getShuffledRandomMembers(participants, remainingCount, [
        facilitatorParticipant?.sourceId,
        ...lockedMembers.map((item) => item.participant.sourceId),
        ...randomMembers.map((participant) => participant.sourceId),
      ]);
      randomMembers = randomMembers.concat(fallback);
    }

    const shuffledMembers = [
      ...lockedMembers.map((item) => ({ participant: item.participant, locked: true })),
      ...randomMembers.slice(0, remainingCount).map((participant) => ({ participant, locked: false })),
    ];

    const micOnMembers = shuffledMembers
      .filter((item) => !item.participant.listener)
      .map((item) => ({
        name: item.participant.name,
        isFacilitator: false,
        isListener: false,
        locked: item.locked,
      }));

    const listenerMembers = shuffledMembers
      .filter((item) => item.participant.listener)
      .map((item) => ({
        name: item.participant.name,
        isFacilitator: false,
        isListener: true,
        locked: item.locked,
      }));

    const displayMembers = [];

    if (facilitatorParticipant) {
      displayMembers.push({
        name: facilitatorParticipant.name,
        isFacilitator: true,
        isListener: false,
        locked: hasDesignatedFacilitator ? facilitatorLocked : false,
      });
    }

    displayMembers.push(...micOnMembers, ...listenerMembers);

    return {
      facilitatorName:
        facilitatorParticipant?.name || (hasDesignatedFacilitator ? "調整中" : "ファシ未設定"),
      facilitatorLocked: hasDesignatedFacilitator ? facilitatorLocked : false,
      displayMembers,
    };
  });
}

function renderAnimatedPreviewGroups(previewState) {
  if (!ensureModalElements()) {
    return;
  }

  const groupCards = Array.from(modalContent.querySelectorAll("[data-preview-card]"));

  groupCards.forEach((card, index) => {
    const state = previewState[index];
    const heading = card.querySelector("[data-preview-heading]");
    const list = card.querySelector("[data-preview-group]");

    if (heading) {
      const symbol = formatGroupSymbol(index + 1);
      let facilitatorLabel = "抽選中";
      if (state) {
        if (state.facilitatorName === "ファシ未設定") {
          facilitatorLabel = "ファシ未設定";
        } else if (state.facilitatorName !== "調整中") {
          facilitatorLabel = `${state.facilitatorName}さん`;
        }
      }
      const headingText = `${symbol}: ${facilitatorLabel}グループ`;
      heading.textContent = headingText;
      heading.title = headingText;
      heading.classList.toggle("is-locked", Boolean(state?.facilitatorLocked));
    }

    if (!list) {
      return;
    }

    if (!state || state.displayMembers.length === 0) {
      list.innerHTML = `
        <li class="result-group-card__member member-item result-group-card__member--draw draw-member is-shuffling result-group-card__member--preview-empty draw-preview-empty">
          <span class="result-group-card__member-name member-name">調整中...</span>
        </li>
      `;
      return;
    }

    list.innerHTML = state.displayMembers
      .map((member) => {
        const roleLabels = [];
        if (member.isFacilitator) {
          roleLabels.push("ファシ");
        }
        if (member.isListener) {
          roleLabels.push("聞き専");
        }

        const badges =
          roleLabels.length > 0
            ? `<span class="result-group-card__tags member-tags">${roleLabels
                .map((label) => {
                  const className =
                    label === "ファシ"
                      ? "result-group-card__tag result-group-card__tag--facilitator member-tag facilitator"
                      : "result-group-card__tag result-group-card__tag--listener member-tag listener";
                  return `<em class="${className}">${label}</em>`;
                })
                .join("")}</span>`
            : "";

        return `<li class="result-group-card__member member-item result-group-card__member--draw draw-member ${
          member.locked
            ? "result-group-card__member--locked is-locked"
            : "result-group-card__member--shuffling is-shuffling"
        }">
          <span class="result-group-card__member-name member-name">${escapeHtml(member.name)}</span>
          ${badges}
        </li>`;
      })
      .join("");
  });
}

function renderDrawStage(groupCount) {
  if (!ensureModalElements()) {
    return;
  }

  modalContent.dataset.groupCount = String(groupCount);

  const previewGroups = Array.from({ length: groupCount }, (_, index) => {
    const symbol = formatGroupSymbol(index + 1);
    const headingText = `${symbol}: 抽選中グループ`;
    const escapedHeadingText = escapeHtml(headingText);

    return `<article class="result-group-card group-card result-group-card--draw draw-group-card" data-preview-card>
      <h3 class="result-group-card__title" data-preview-heading="${index}" title="${escapedHeadingText}">${escapedHeadingText}</h3>
      <ul data-preview-group="${index}">
        <li class="result-group-card__member member-item result-group-card__member--draw draw-member result-group-card__member--shuffling is-shuffling result-group-card__member--preview-empty draw-preview-empty">
          <span class="result-group-card__member-name member-name">抽選中...</span>
        </li>
      </ul>
    </article>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="result-groups-fit result-grid-fit" data-group-count="${groupCount}">
      <section class="draw-stage-plain" aria-live="polite">
        <div class="result-groups-grid group-grid result-groups-grid--draw draw-group-grid">${previewGroups}</div>
      </section>
    </div>
  `;

  scheduleResultGridFit();
  lockDrawGridTrackSizes();
}

async function runDrawAnimation(participants, groupCount, finalGroups) {
  renderDrawStage(groupCount);

  if (!ensureModalElements()) {
    return;
  }

  const previewCards = Array.from(modalContent.querySelectorAll("[data-preview-card]"));
  const hasFacilitatorPhase = finalGroups.some(
    (group) => pickFacilitatorIndex(group) !== -1
  );
  const initialPhaseText = hasFacilitatorPhase
    ? FACILITATOR_PHASE_TEXT
    : GROUP_PHASE_TEXT;
  let highlightedIndex = -1;

  const renderInitialFrame = () => {
    const previewState = buildPhasePreviewState(participants, finalGroups, 0, {
      hasFacilitatorPhase,
    });
    renderAnimatedPreviewGroups(previewState);

    if (previewCards.length > 0) {
      highlightedIndex = Math.floor(Math.random() * previewCards.length);
      previewCards[highlightedIndex].classList.add("is-hot");
    }

    updateModalDrawHeader({
      active: true,
      phaseText: initialPhaseText,
      remainingMs: DRAW_DURATION_MS,
      progress: 0,
    });
  };

  renderInitialFrame();

  await startDrumRoll();

  return new Promise((resolve) => {
    const startTime = Date.now();

    drawIntervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const previewState = buildPhasePreviewState(participants, finalGroups, elapsedMs, {
        hasFacilitatorPhase,
      });
      renderAnimatedPreviewGroups(previewState);

      if (previewCards.length > 0) {
        if (highlightedIndex >= 0) {
          previewCards[highlightedIndex].classList.remove("is-hot");
        }
        highlightedIndex = Math.floor(Math.random() * previewCards.length);
        previewCards[highlightedIndex].classList.add("is-hot");
      }
    }, DRAW_TICK_MS);

    countdownIntervalId = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, DRAW_DURATION_MS - elapsed);

      if (remaining <= 0) {
        updateModalDrawHeader({ active: false });
        return;
      }

      const phaseLabel = hasFacilitatorPhase
        ? elapsed < FACILITATOR_DRAW_MS
          ? FACILITATOR_PHASE_TEXT
          : MEMBER_PHASE_TEXT
        : GROUP_PHASE_TEXT;

      updateModalDrawHeader({
        active: true,
        phaseText: phaseLabel,
        remainingMs: remaining,
        progress: elapsed / DRAW_DURATION_MS,
      });
    }, 50);

    revealTimeoutId = window.setTimeout(() => {
      clearDrawTimers();
      updateModalDrawHeader({ active: false });
      resolve();
    }, DRAW_DURATION_MS);
  });
}

function setControlsDisabled(disabled) {
  if (disabled) {
    closeAllGroupSelectMenus();
  }

  if (appRoot) {
    appRoot.classList.toggle("is-drawing", disabled);
  }

  const controls = Array.from(document.querySelectorAll("input, select, button"));
  controls.forEach((control) => {
    if (control === modalCloseButton) {
      return;
    }
    control.disabled = disabled;
  });
}

function validateRoundShuffle(participants, groupCount) {
  const minimumMembersPerGroup = getMinimumMembersPerGroup(participants.length);
  const minimumParticipants = MIN_GROUP_COUNT * minimumMembersPerGroup;
  const requiredGroupCount = getRequiredGroupCount(participants.length);
  const maximumGroupCount = getMaximumGroupCount(participants.length);

  if (participants.length < minimumParticipants) {
    return `参加者が${minimumParticipants}人未満です。`;
  }

  if (!Number.isInteger(groupCount) || groupCount < MIN_GROUP_COUNT) {
    return "グループ数を選択してください。";
  }

  if (requiredGroupCount > maximumGroupCount) {
    return `参加者${participants.length}人では、1グループ${minimumMembersPerGroup}〜${MAX_MEMBERS_PER_GROUP}人で2グループ以上を作れません。`;
  }

  if (groupCount < requiredGroupCount) {
    return `1グループ最大${MAX_MEMBERS_PER_GROUP}人のため、参加者${participants.length}人は${requiredGroupCount}グループ以上を選択してください。`;
  }

  if (groupCount > maximumGroupCount) {
    return `1グループ最小${minimumMembersPerGroup}人のため、参加者${participants.length}人は${maximumGroupCount}グループ以下を選択してください。`;
  }

  if (participants.length < groupCount) {
    return `参加者数（${participants.length}人）がグループ数（${groupCount}）より少ないです。`;
  }

  return "";
}

async function handleShuffleRound1() {
  if (isDrawing) {
    return;
  }

  clearError();

  const participants = buildRound1Participants();
  const groupCount = Number(groupSelectRound1?.value || "0");

  const validationError = validateRoundShuffle(participants, groupCount);
  if (validationError) {
    setErrorStatusMessage(validationError);
    return;
  }

  const groups = splitIntoBalancedGroups(participants, groupCount);
  if (!groups) {
    setErrorStatusMessage("グループ分けに失敗しました。入力内容を確認してください。");
    return;
  }

  setPhase(3, { allowRound1ResultPending: true });
  isDrawing = true;
  setControlsDisabled(true);
  setShuffleButtonsDrawing(1);

  try {
    openModal("1回目 抽選中");
    setModalLocked(true);
    await runDrawAnimation(participants, groupCount, groups);
    openModal("1回目 振り分け完了");
    setModalLocked(false);
    renderGroups(groups, "1回目");

    round1Groups = groups;
    const history = buildRound1History(groups);
    round1PairHistory = history.pairHistory;
    round1GroupCompositions = history.groupCompositions;

    showInfo(participantMessage, "1回目抽選が完了しました。2回目準備へ進めます。");
    updatePhaseUI();
  } finally {
    clearDrawTimers();
    updateModalDrawHeader({ active: false });
    isDrawing = false;
    setModalLocked(false);
    setControlsDisabled(false);
    setShuffleButtonsDrawing(0);
    updateGroupSelectConstraints();
  }
}

async function handleShuffleRound2() {
  if (isDrawing) {
    return;
  }

  clearError();

  if (!round1Groups || round1PairHistory.size === 0) {
    setErrorStatusMessage("2回目抽選の前に1回目抽選を完了してください。");
    return;
  }

  const participants = buildRound2Participants();
  const groupCount = Number(groupSelectRound2?.value || "0");

  const validationError = validateRoundShuffle(participants, groupCount);
  if (validationError) {
    setErrorStatusMessage(validationError);
    return;
  }

  setPhase(5, { allowRound2ResultPending: true });
  isDrawing = true;
  setControlsDisabled(true);
  setShuffleButtonsDrawing(2);

  try {
    openModal("2回目 抽選中");
    setModalLocked(true);

    await waitForNextPaint();

    const groups = splitIntoBalancedGroups(participants, groupCount, {
      pairHistory: round1PairHistory,
      previousGroupCompositions: round1GroupCompositions,
      pairPenaltyWeight: ROUND2_PAIR_OVERLAP_PENALTY,
      sameGroupPenalty: ROUND2_SAME_GROUP_PENALTY,
      iterations: Math.max(2200, participants.length * 450),
    });

    if (!groups) {
      if (ensureModalElements()) {
        updateModalDrawHeader({ active: false });
        modal.hidden = true;
      }
      setPhase(4);
      setErrorStatusMessage("2回目グループ分けに失敗しました。入力内容を確認してください。");
      return;
    }

    round2OverlapStats = measureRound2Overlaps(groups);

    await runDrawAnimation(participants, groupCount, groups);
    openModal("2回目 振り分け完了");
    setModalLocked(false);
    renderGroups(groups, "2回目");

    round2Groups = groups;
    showInfo(
      additionalMessage,
      `2回目抽選が完了しました（同席重複ペア: ${round2OverlapStats.pairOverlapCount}）。`
    );

    updatePhaseUI();
  } finally {
    clearDrawTimers();
    updateModalDrawHeader({ active: false });
    isDrawing = false;
    setModalLocked(false);
    setControlsDisabled(false);
    setShuffleButtonsDrawing(0);
    updateGroupSelectConstraints();
  }
}

function resetRound2ResultState() {
  round2Groups = null;
  round2OverlapStats = { pairOverlapCount: 0, sameGroupCount: 0 };
}

function resetRound1ResultState() {
  round1Groups = null;
  round1PairHistory = new Map();
  round1GroupCompositions = new Set();
}

function handleParticipantGridMutation(event) {
  if (
    event.target instanceof HTMLElement &&
    (event.target.closest(".participant-round2-code") ||
      event.target.closest(".participant-name"))
  ) {
    resetRound2ResultState();
    updateGroupSelectConstraints();
    return;
  }

  resetRound1ResultState();
  resetRound2ResultState();
  updateGroupSelectConstraints();
}

function applyParticipantsToGrid(participants, startIndex = 0, clearBefore = false) {
  const rows = getParticipantRows();
  if (clearBefore) {
    rows.forEach((row) => {
      const nameInput = row.querySelector(".participant-name");
      const round1Select = row.querySelector(".participant-round1-code");
      const round2Select = row.querySelector(".participant-round2-code");
      if (nameInput instanceof HTMLInputElement) {
        nameInput.value = "";
      }
      if (round1Select instanceof HTMLSelectElement) {
        round1Select.value = "";
      }
      if (round2Select instanceof HTMLSelectElement) {
        round2Select.value = "";
      }
    });
  }

  let appliedCount = 0;
  participants
    .slice(0, PARTICIPANT_INPUT_COUNT - startIndex)
    .forEach((participant, offset) => {
      const rowIndex = startIndex + offset;
      const row = rows[rowIndex];
      if (!row) {
        return;
      }

      const nameInput = row.querySelector(".participant-name");
      const round1Select = row.querySelector(".participant-round1-code");
      const round2Select = row.querySelector(".participant-round2-code");
      if (
        !(nameInput instanceof HTMLInputElement) ||
        !(round1Select instanceof HTMLSelectElement) ||
        !(round2Select instanceof HTMLSelectElement)
      ) {
        return;
      }

      nameInput.value = participant.name;
      round1Select.value = participant.round1Code || "";
      round2Select.value = participant.round2Code || "";
      appliedCount += 1;
    });

  if (appliedCount > 0) {
    round1Groups = null;
    round1PairHistory = new Map();
    round1GroupCompositions = new Set();
    resetRound2ResultState();
  }

  updateGroupSelectConstraints();
  return appliedCount;
}

function applyAdditionalParticipantsToGrid(participants, startIndex = 0) {
  const rows = getAdditionalRows();
  let appliedCount = 0;

  participants
    .slice(0, ADDITIONAL_PARTICIPANT_INPUT_COUNT - startIndex)
    .forEach((participant, offset) => {
      const rowIndex = startIndex + offset;
      const row = rows[rowIndex];
      if (!row) {
        return;
      }

      const nameInput = row.querySelector(".additional-name");
      const round2Select = row.querySelector(".additional-round2-code");
      if (!(nameInput instanceof HTMLInputElement) || !(round2Select instanceof HTMLSelectElement)) {
        return;
      }

      nameInput.value = participant.name;
      round2Select.value = participant.round2Code;
      appliedCount += 1;
    });

  if (appliedCount > 0) {
    resetRound2ResultState();
  }

  updateGroupSelectConstraints();
  return appliedCount;
}

function applyFacilitatorsToGrid(names, startIndex = 0, clearBefore = false) {
  const inputs = getFacilitatorInputs();

  if (clearBefore) {
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
    });
  }

  let appliedCount = 0;

  names
    .slice(0, FACILITATOR_INPUT_COUNT - startIndex)
    .forEach((name, offset) => {
      const inputIndex = startIndex + offset;
      const input = inputs[inputIndex];
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      input.value = name;
      appliedCount += 1;
    });

  if (appliedCount > 0) {
    updateGroupSelectConstraints();
  }

  return appliedCount;
}

function applySingleCodePaste(target, clipboardText) {
  if (!(target instanceof HTMLSelectElement)) {
    return false;
  }

  const value = normalizeFlagToken(clipboardText);
  if (!value || value.includes("\n") || value.includes("\t")) {
    return false;
  }

  if (target.classList.contains("participant-round1-code")) {
    if (value === "0" || value === "1" || value === "2") {
      target.value = value;
      updateGroupSelectConstraints();
      return true;
    }
    return false;
  }

  if (
    target.classList.contains("participant-round2-code") ||
    target.classList.contains("additional-round2-code")
  ) {
    if (value === "0" || value === "1" || value === "2" || value === "3") {
      target.value = value;
      updateGroupSelectConstraints();
      return true;
    }
    return false;
  }

  return false;
}

function handleFacilitatorGridPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  const targetInput = event.target.closest(".facilitator-name");
  if (!(targetInput instanceof HTMLInputElement)) {
    return;
  }

  const clipboardText = getClipboardText(event);
  if (!clipboardText) {
    return;
  }

  if (!clipboardText.includes("\n") && !clipboardText.includes("\t")) {
    return;
  }

  const startIndex = Number(targetInput.dataset.cellIndex || "0");
  const rawNames = parseFacilitatorNamesFromText(clipboardText);
  const deduped = dedupeNames(rawNames);
  const appliedCount = applyFacilitatorsToGrid(deduped.unique, startIndex, false);

  if (appliedCount > 0) {
    showInfo(
      facilitatorMessage,
      `${appliedCount}名の候補者を貼り付けました。${
        deduped.duplicateCount > 0 ? ` 重複 ${deduped.duplicateCount} 件は除外しました。` : ""
      }`
    );
    event.preventDefault();
  }
}

function handleParticipantGridPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  const row = event.target.closest(".participant-row");
  if (!row) {
    return;
  }

  const clipboardText = getClipboardText(event);
  if (!clipboardText) {
    return;
  }

  if (applySingleCodePaste(event.target, clipboardText)) {
    event.preventDefault();
    return;
  }

  if (!clipboardText.includes("\n") && !clipboardText.includes("\t")) {
    return;
  }

  if (currentPhase >= 3) {
    showErrorMessage(
      participantMessage,
      "フェーズ3以降は参加者名を変更できません。参加方法のみ変更してください。"
    );
    event.preventDefault();
    return;
  }

  const startIndex = Number(row.dataset.rowIndex || "0");
  const parsed = parseParticipantsFromText(clipboardText);
  const appliedCount = applyParticipantsToGrid(parsed.participants, startIndex, false);

  if (appliedCount > 0) {
    showInfo(
      participantMessage,
      `${appliedCount}件を貼り付けました。${
        parsed.skippedRows > 0 ? ` 無効行 ${parsed.skippedRows} 件を除外しました。` : ""
      }`
    );
    event.preventDefault();
  }
}

function handleAdditionalGridPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  const row = event.target.closest(".additional-row");
  if (!row) {
    return;
  }

  const clipboardText = getClipboardText(event);
  if (!clipboardText) {
    return;
  }

  if (applySingleCodePaste(event.target, clipboardText)) {
    event.preventDefault();
    return;
  }

  if (!clipboardText.includes("\n") && !clipboardText.includes("\t")) {
    return;
  }

  const startIndex = Number(row.dataset.rowIndex || "0");
  const parsed = parseAdditionalParticipantsFromText(clipboardText);
  const appliedCount = applyAdditionalParticipantsToGrid(parsed.participants, startIndex);

  if (appliedCount > 0) {
    showInfo(
      additionalMessage,
      `${appliedCount}件の追加参加者を貼り付けました。${
        parsed.skippedRows > 0 ? ` 無効行 ${parsed.skippedRows} 件を除外しました。` : ""
      }`
    );
    event.preventDefault();
  }
}

async function handleReadClipboardParticipants() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showErrorMessage(
      clipboardMessage,
      "このブラウザではクリップボード読取に対応していません。B:Dをコピーして再試行してください。"
    );
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      showErrorMessage(clipboardMessage, "クリップボードが空です。B:Dをコピーして再実行してください。");
      return;
    }

    const parsed = parseParticipantsFromText(text);
    const appliedCount = applyParticipantsToGrid(parsed.participants, 0, true);

    if (appliedCount <= 0) {
      showErrorMessage(
        clipboardMessage,
        "貼り付けデータを読み取れませんでした。B:D（名前/1回目/2回目）をコピーしてください。"
      );
      return;
    }

    showInfo(
      clipboardMessage,
      `${appliedCount}件をシートから反映しました。${
        parsed.skippedRows > 0 ? ` 無効行 ${parsed.skippedRows} 件を除外しました。` : ""
      }`
    );
    clearError();
  } catch (_error) {
    showErrorMessage(
      clipboardMessage,
      "クリップボード読取が許可されていません。ブラウザで許可して再実行してください。"
    );
  }
}

async function handleReadClipboardFacilitators() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showErrorMessage(
      facilitatorMessage,
      "このブラウザではクリップボード読取に対応していません。候補者名をコピーして再試行してください。"
    );
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      showErrorMessage(facilitatorMessage, "クリップボードが空です。候補者名をコピーして再実行してください。");
      return;
    }

    const names = parseFacilitatorNamesFromText(text);
    const deduped = dedupeNames(names);
    const appliedCount = applyFacilitatorsToGrid(deduped.unique, 0, true);

    if (appliedCount <= 0) {
      showErrorMessage(facilitatorMessage, "候補者名を読み取れませんでした。");
      return;
    }

    showInfo(
      facilitatorMessage,
      `${appliedCount}名を候補者として登録しました。${
        deduped.duplicateCount > 0 ? ` 重複 ${deduped.duplicateCount} 件は除外しました。` : ""
      }`
    );
    clearError();
  } catch (_error) {
    showErrorMessage(
      facilitatorMessage,
      "クリップボード読取が許可されていません。ブラウザで許可して再実行してください。"
    );
  }
}

function setPhase(nextPhase, options = {}) {
  closeAllGroupSelectMenus();

  const phase = Math.min(5, Math.max(1, Number(nextPhase) || 1));
  const allowRound1ResultPending = options.allowRound1ResultPending === true;
  const allowRound2ResultPending = options.allowRound2ResultPending === true;

  if (phase >= 4 && !round1Groups) {
    setErrorStatusMessage("フェーズ4以降へ進むには、先に1回目抽選を完了してください。");
    return;
  }

  if (phase === 3 && !round1Groups && !allowRound1ResultPending) {
    setErrorStatusMessage("フェーズ3へ進むには、先に1回目抽選を実行してください。");
    return;
  }

  if (phase === 5 && !round2Groups && !allowRound2ResultPending) {
    setErrorStatusMessage("フェーズ5へ進むには、先に2回目抽選を完了してください。");
    return;
  }

  clearRound2CompletionMessageOutsidePhase5(phase);
  currentPhase = phase;
  clearError();
  updatePhaseUI();
  syncResultPanelForCurrentPhase();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updatePhaseUI() {
  const def = PHASE_DEFINITIONS[currentPhase] || PHASE_DEFINITIONS[1];

  if (phaseLabel) {
    phaseLabel.textContent = `現在: ${def.title}`;
  }

  if (phaseDescription) {
    phaseDescription.textContent = def.description;
  }

  if (appRoot) {
    appRoot.dataset.phase = String(currentPhase);
  }

  phaseNavButtons.forEach((button) => {
    const phase = Number(button.dataset.phaseNav || "0");
    const blockedByRound1ResultRule = phase === 3 && !round1Groups;
    const blockedByRound2ResultRule = phase === 5 && !round2Groups;
    button.classList.toggle("is-active", phase === currentPhase);
    button.disabled =
      isDrawing ||
      blockedByRound1ResultRule ||
      blockedByRound2ResultRule;
  });

  Array.from(document.querySelectorAll("[data-phase-visible]")).forEach((element) => {
    const values = String(element.getAttribute("data-phase-visible") || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value));
    element.hidden = !values.includes(currentPhase);
  });

  const participantNamesReadonly = currentPhase >= 3;
  getParticipantRows().forEach((row) => {
    const nameInput = row.querySelector(".participant-name");
    if (!(nameInput instanceof HTMLInputElement)) {
      return;
    }
    nameInput.readOnly = participantNamesReadonly;
    nameInput.classList.toggle("is-readonly", participantNamesReadonly);
    if (participantNamesReadonly) {
      nameInput.setAttribute("aria-readonly", "true");
    } else {
      nameInput.removeAttribute("aria-readonly");
    }
  });

  if (phasePrevButton) {
    phasePrevButton.disabled = currentPhase <= 1 || isDrawing;
  }

  if (phaseNextButton) {
    phaseNextButton.disabled =
      currentPhase >= 5 ||
      isDrawing ||
      (currentPhase === 2 && !round1Groups) ||
      (currentPhase === 4 && !round2Groups);
  }

  updateParticipantTableHeaders();
  updateActionButtonStates();
}

function updateParticipantTableHeaders() {
  const round2Header = inputContainer?.querySelector(".participant-header-round2");
  if (!(round2Header instanceof HTMLElement)) {
    return;
  }

  round2Header.textContent = PARTICIPANT_HEADER_ROUND2_DEFAULT;
}

function updateActionButtonStates() {
  const round1Participants = buildRound1Participants();
  const round2Participants = buildRound2Participants();

  const round1GroupCount = Number(groupSelectRound1?.value || "0");
  const round2GroupCount = Number(groupSelectRound2?.value || "0");

  const round1Error = validateRoundShuffle(round1Participants, round1GroupCount);
  const round2Error = validateRoundShuffle(round2Participants, round2GroupCount);

  if (shuffleRound1Button) {
    shuffleRound1Button.disabled =
      isDrawing || currentPhase !== 2 || Boolean(round1Error);
  }

  if (prepareRound2Button) {
    prepareRound2Button.disabled = isDrawing || !round1Groups;
  }

  if (shuffleRound2Button) {
    shuffleRound2Button.disabled =
      isDrawing || currentPhase !== 4 || !round1Groups || Boolean(round2Error);
  }

  if (goPhase2Button) {
    goPhase2Button.disabled = isDrawing || currentPhase !== 1;
  }
}

function handlePhaseNext() {
  if (currentPhase >= 5) {
    return;
  }
  setPhase(currentPhase + 1);
}

function handlePhasePrev() {
  if (currentPhase <= 1) {
    return;
  }
  setPhase(currentPhase - 1);
}

function handlePrepareRound2() {
  if (!round1Groups) {
    setErrorStatusMessage("先に1回目抽選を完了してください。");
    return;
  }

  setPhase(4);
}

function handleGoPhase2() {
  setPhase(2);
}

function handleModalGoRound2() {
  if (!round1Groups) {
    setErrorStatusMessage("先に1回目抽選を完了してください。");
    return;
  }

  handlePrepareRound2();
  closeModal();
}

function handleGlobalPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  if (
    event.target.closest(".participant-row") ||
    event.target.closest(".facilitator-name") ||
    event.target.closest(".additional-row") ||
    event.target.closest(".sheet-import")
  ) {
    return;
  }

  if (currentPhase !== 2) {
    return;
  }

  const clipboardText = getClipboardText(event);
  if (!clipboardText) {
    return;
  }

  if (!clipboardText.includes("\t") && !clipboardText.includes("\n")) {
    return;
  }

  const parsed = parseParticipantsFromText(clipboardText);
  const appliedCount = applyParticipantsToGrid(parsed.participants, 0, true);

  if (appliedCount > 0) {
    showInfo(
      clipboardMessage,
      `${appliedCount}件をシートから反映しました。${
        parsed.skippedRows > 0 ? ` 無効行 ${parsed.skippedRows} 件を除外しました。` : ""
      }`
    );
    event.preventDefault();
  }
}

function initializeApp() {
  if (
    !inputContainer ||
    !facilitatorContainer ||
    !additionalContainer ||
    !groupSelectRound1 ||
    !groupSelectRound2 ||
    !shuffleRound1Button ||
    !shuffleRound2Button
  ) {
    console.error("初期化に必要なDOM要素が見つかりませんでした。");
    return;
  }

  createFacilitatorFields();
  createParticipantFields();
  createAdditionalParticipantFields();
  ensureModalElements();
  setupCustomGroupSelect(groupSelectRound1);
  setupCustomGroupSelect(groupSelectRound2);

  setShuffleButtonsDrawing(0);
  clearLocalMessages();
  updateGroupSelectConstraints();
  updatePhaseUI();

  facilitatorContainer.addEventListener("input", () => {
    resetRound1ResultState();
    resetRound2ResultState();
    updateGroupSelectConstraints();
  });

  inputContainer.addEventListener("input", handleParticipantGridMutation);

  inputContainer.addEventListener("change", handleParticipantGridMutation);

  additionalContainer.addEventListener("input", () => {
    resetRound2ResultState();
    updateGroupSelectConstraints();
  });

  additionalContainer.addEventListener("change", () => {
    resetRound2ResultState();
    updateGroupSelectConstraints();
  });

  if (groupSelectRound1) {
    groupSelectRound1.addEventListener("change", () => {
      groupSelectRound1.dataset.userSelected = "true";
      updateGroupSelectConstraints();
    });
  }

  if (groupSelectRound2) {
    groupSelectRound2.addEventListener("change", () => {
      groupSelectRound2.dataset.userSelected = "true";
      updateGroupSelectConstraints();
    });
  }

  facilitatorContainer.addEventListener("paste", handleFacilitatorGridPaste);
  inputContainer.addEventListener("paste", handleParticipantGridPaste);
  additionalContainer.addEventListener("paste", handleAdditionalGridPaste);

  if (readClipboardButton) {
    readClipboardButton.addEventListener("click", handleReadClipboardParticipants);
  }

  if (readFacilitatorClipboardButton) {
    readFacilitatorClipboardButton.addEventListener("click", handleReadClipboardFacilitators);
  }

  if (readFacilitatorClipboardSideButton) {
    readFacilitatorClipboardSideButton.addEventListener(
      "click",
      handleReadClipboardFacilitators
    );
  }

  if (phasePrevButton) {
    phasePrevButton.addEventListener("click", handlePhasePrev);
  }

  if (phaseNextButton) {
    phaseNextButton.addEventListener("click", handlePhaseNext);
  }

  phaseNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const phase = Number(button.dataset.phaseNav || "1");
      setPhase(phase);
    });
  });

  if (shuffleRound1Button) {
    shuffleRound1Button.addEventListener("click", handleShuffleRound1);
  }

  if (prepareRound2Button) {
    prepareRound2Button.addEventListener("click", handlePrepareRound2);
  }

  if (goPhase2Button) {
    goPhase2Button.addEventListener("click", handleGoPhase2);
  }

  if (shuffleRound2Button) {
    shuffleRound2Button.addEventListener("click", handleShuffleRound2);
  }

  document.addEventListener("paste", handleGlobalPaste);

  if (ensureModalElements()) {
    modalCloseButton.addEventListener("click", closeModal);
    if (modalGoRound2Button) {
      modalGoRound2Button.addEventListener("click", handleModalGoRound2);
    }
    modal.addEventListener("click", (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.hasAttribute("data-modal-close")
      ) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  window.addEventListener("resize", () => {
    if (modal && !modal.hidden) {
      scheduleResultGridFit();
      if (isDrawing) {
        lockDrawGridTrackSizes();
      }
    }
  });
}

initializeApp();
