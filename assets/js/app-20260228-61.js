const INPUT_COUNT = 100;
const MIN_MEMBERS_PER_GROUP = 3;
const MIN_MEMBERS_PER_GROUP_LARGE = 4;
const MIN_MEMBERS_PER_GROUP_LARGE_THRESHOLD = 50;
const MAX_MEMBERS_PER_GROUP = 7;
const MIN_GROUP_COUNT = 2;
const DRAW_DURATION_MS = 5000;
const DRAW_TICK_MS = 120;
const FACILITATOR_DRAW_MS = 1500;
const MAX_GROUPS_WITHOUT_MODAL_SCROLL = 24;
const GROUP_LABEL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DRAW_PHASE_TEXTS = ["ファシリテーター決定中", "メンバーを振り分け中"];

const inputContainer = document.querySelector("#participant-inputs");
const groupSelect = document.querySelector("#group-count");
const shuffleButton = document.querySelector("#shuffle-button");
const errorMessage = document.querySelector("#error-message");
const readClipboardButton = document.querySelector("#read-clipboard-button");
const clipboardMessage = document.querySelector("#clipboard-message");
const SHUFFLE_BUTTON_IDLE_HTML =
  '<span class="shuffle-icon" aria-hidden="true">⇄</span><span>振り分けスタート</span>';
let participantGuide = document.querySelector("#participant-guide");
let micOnGuide = document.querySelector("#mic-on-guide");

// Remove stale inline CSS custom properties left by older builds.
document.documentElement.style.removeProperty("--controls-reserve");
document.documentElement.style.removeProperty("--inputs-grid-max-height");

let modal = null;
let modalTitle = null;
let modalContent = null;
let modalCloseButton = null;
let modalDrawIndicator = null;
let modalDrawPhase = null;
let modalDrawCountdown = null;
let modalDrawProgressBar = null;

let isDrawing = false;
let drawIntervalId = null;
let countdownIntervalId = null;
let revealTimeoutId = null;
let modalFitRafId = null;
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
const NAME_HEADER_TERMS = [
  "名前",
  "name",
  "participant",
  "ニックネーム",
  "nickname",
  "ハンドルネーム",
];
const FACILITATOR_HEADER_TERMS = ["ファシ", "facilitator", "進行"];
const LISTENER_HEADER_TERMS = ["聞き専", "listener", "listner"];
const SINGLE_ROLE_HEADER_TERMS = [
  "参加方法",
  "参加スタイル",
  "参加種別",
  "participation",
  "method",
];
const TIMESTAMP_HEADER_TERMS = ["タイムスタンプ", "timestamp"];
const FACILITATOR_ROLE_TERMS = ["ファシ", "facilitator", "立候補", "進行"];
const LISTENER_ROLE_TERMS = [
  "聞き専",
  "ききせん",
  "聴講",
  "chat",
  "チャット",
  "listen only",
];
const NORMAL_ROLE_TERMS = ["マイクオン", "通常", "一般参加", "音声で参加", "voice"];

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

function setStatusMessage(message, type) {
  const target = clipboardMessage || errorMessage;
  const secondaryTarget = target === clipboardMessage ? errorMessage : clipboardMessage;
  applyStatusToElement(target, message, type);
  applyStatusToElement(secondaryTarget, "", type);
}

function setClipboardStatusMessage(message, type = "info") {
  setStatusMessage(message, type);
}

function ensureModalElements() {
  if (modal && modalTitle && modalContent && modalCloseButton) {
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

  if (!document.querySelector("#result-modal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="result-modal" class="result-modal" hidden>
        <div class="result-modal__backdrop" data-modal-close></div>
        <section
          class="result-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-modal-title"
        >
          <header class="result-modal__header">
            <div class="result-modal__header-main">
              <h2 id="result-modal-title">グループ分け結果</h2>
              <div id="modal-draw-indicator" class="result-modal__draw" hidden>
                <span id="modal-draw-phase" class="result-modal__draw-phase">ファシリテーター決定中</span>
                <div class="result-modal__draw-progress" aria-hidden="true">
                  <span id="modal-draw-progress-bar" class="result-modal__draw-progress-bar"></span>
                </div>
                <span class="result-modal__draw-remaining">残り <strong id="modal-draw-countdown">5.0</strong> 秒</span>
              </div>
              <button
                id="modal-close-button"
                class="result-modal__close"
                type="button"
                aria-label="結果ページを閉じる"
              >
                戻る
              </button>
            </div>
          </header>
          <div id="modal-content" class="result-modal__content"></div>
        </section>
      </div>
      `
    );
  }

  modal = document.querySelector("#result-modal");
  modalTitle = document.querySelector("#result-modal-title");
  modalContent = document.querySelector("#modal-content");
  modalCloseButton = document.querySelector("#modal-close-button");
  modalDrawIndicator = document.querySelector("#modal-draw-indicator");
  modalDrawPhase = document.querySelector("#modal-draw-phase");
  modalDrawCountdown = document.querySelector("#modal-draw-countdown");
  modalDrawProgressBar = document.querySelector("#modal-draw-progress-bar");

  return Boolean(modal && modalTitle && modalContent && modalCloseButton);
}

function createInputFields() {
  const table = document.createElement("table");
  table.className = "input-sheet";
  table.innerHTML = `
    <colgroup>
      <col class="col-index" />
      <col class="col-name" />
      <col class="col-role" />
    </colgroup>
    <thead>
      <tr>
        <th class="header-index" scope="col"></th>
        <th scope="col">名前</th>
        <th scope="col">参加方法: 1=ファシリ, 2=通常, 3=聞き専</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  for (let i = 1; i <= INPUT_COUNT; i += 1) {
    const row = document.createElement("tr");
    row.className = "input-row";
    row.dataset.rowIndex = String(i - 1);

    const nameId = `participant-${i}`;
    const participationId = `participant-${i}-participation-value`;

    row.innerHTML = `
      <th class="participant-index" scope="row">${i}</th>
      <td>
        <input id="${nameId}" class="participant-name" type="text" placeholder="名前を入力" autocomplete="off" aria-label="${i}番の名前" />
      </td>
      <td>
        <select
          id="${participationId}"
          class="role-value role-code"
          aria-label="${i}番の参加方法（1=ファシリ、2=通常、3=聞き専）"
        >
          <option value="" selected>-</option>
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

function showError(message) {
  setStatusMessage(message, "error");
  if (ensureModalElements()) {
    modalContent.innerHTML = "";
  }
  closeModal();
}

function showInfo(message) {
  setClipboardStatusMessage(message, "info");
}

function clearError() {
  setStatusMessage("", "error");
}

function renderPlaceholder() {
  return;
}

function normalizeFlagToken(raw) {
  return String(raw)
    .trim()
    .normalize("NFKC")
    .replace(/\uFE0E|\uFE0F/g, "")
    .toLowerCase();
}

function includesAnyTerm(value, terms) {
  return terms.some((term) => value.includes(term));
}

function isNameHeaderToken(value) {
  return includesAnyTerm(value, NAME_HEADER_TERMS);
}

function isFacilitatorHeaderToken(value) {
  return includesAnyTerm(value, FACILITATOR_HEADER_TERMS);
}

function isListenerHeaderToken(value) {
  return includesAnyTerm(value, LISTENER_HEADER_TERMS);
}

function isSingleRoleHeaderToken(value) {
  return includesAnyTerm(value, SINGLE_ROLE_HEADER_TERMS);
}

function isTimestampHeaderToken(value) {
  return includesAnyTerm(value, TIMESTAMP_HEADER_TERMS);
}

function looksLikeDateTimeValue(value) {
  const text = normalizeCellValue(value);
  return /^(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(
    text
  );
}

function parseSingleRoleSelection(raw) {
  const value = normalizeFlagToken(raw);
  if (!value) {
    return { known: false, facilitatorRaw: "", listenerRaw: "" };
  }

  const isFacilitator = includesAnyTerm(value, FACILITATOR_ROLE_TERMS);
  const isListener = includesAnyTerm(value, LISTENER_ROLE_TERMS);
  const isNormal = includesAnyTerm(value, NORMAL_ROLE_TERMS);

  if (!isFacilitator && !isListener && !isNormal) {
    return { known: false, facilitatorRaw: "", listenerRaw: "" };
  }

  return {
    known: true,
    facilitatorRaw: isFacilitator ? "1" : "0",
    listenerRaw: isListener ? "1" : "0",
  };
}

function parseParticipationCode(raw) {
  const token = normalizeFlagToken(raw);
  if (token === "1") {
    return { facilitatorRaw: "1", listenerRaw: "0" };
  }
  if (token === "3") {
    return { facilitatorRaw: "0", listenerRaw: "1" };
  }
  if (token === "2" || token === "") {
    return { facilitatorRaw: "0", listenerRaw: "0" };
  }

  const selection = parseSingleRoleSelection(raw);
  if (selection.known) {
    return {
      facilitatorRaw: selection.facilitatorRaw,
      listenerRaw: selection.listenerRaw,
    };
  }

  return { facilitatorRaw: "0", listenerRaw: "0" };
}

function isStrictParticipationCode(raw) {
  const token = normalizeFlagToken(raw);
  return token === "1" || token === "2" || token === "3";
}

function encodeParticipationCode(facilitatorRaw, listenerRaw) {
  const facilitator = parseBooleanFlag(facilitatorRaw);
  const listener = parseBooleanFlag(listenerRaw);
  if (listener) {
    return "3";
  }
  if (facilitator) {
    return "1";
  }
  return "2";
}

function ensureMicOnGuideElement() {
  if (participantGuide && micOnGuide) {
    return micOnGuide;
  }

  const controls = document.querySelector(".controls");
  const settingsCard = controls?.querySelector(".control-card--settings") || controls;
  const controlLine = controls?.querySelector(".control-line");
  if (!controls || !settingsCard) {
    return null;
  }

  if (!participantGuide) {
    const summary = document.createElement("span");
    summary.id = "participant-guide";
    summary.className = "participants-guide";
    summary.setAttribute("aria-live", "polite");
    summary.textContent = "参加者：0人（マイクオン：0人）";
    if (controlLine && controlLine.parentElement === settingsCard) {
      settingsCard.insertBefore(summary, controlLine);
    } else {
      settingsCard.append(summary);
    }
    participantGuide = summary;
  }

  if (!micOnGuide) {
    const guide = document.createElement("span");
    guide.id = "mic-on-guide";
    guide.className = "mic-on-guide";
    guide.setAttribute("aria-live", "polite");
    guide.textContent = "1グループ：0人（マイクオン：0人）";
    settingsCard.append(guide);
    micOnGuide = guide;
  }

  return micOnGuide;
}

function parseBooleanFlag(raw) {
  const value = normalizeFlagToken(raw);
  if (!value) {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
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

function normalizeCellValue(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function isNumericToken(token) {
  return /^-?\d+(\.\d+)?$/.test(token);
}

function isBooleanLikeToken(token) {
  if (!token) {
    return false;
  }

  if (TRUE_FLAG_VALUES.has(token) || FALSE_FLAG_VALUES.has(token)) {
    return true;
  }

  if (isNumericToken(token)) {
    const numeric = Number(token);
    return numeric === 0 || numeric === 1;
  }

  return false;
}

function isBooleanLikeValue(value) {
  return isBooleanLikeToken(normalizeFlagToken(value));
}

function isHeaderRow(cells) {
  const normalizedCells = cells
    .map(normalizeFlagToken)
    .filter((value) => value.length > 0);

  if (normalizedCells.length === 0) {
    return false;
  }

  if (normalizedCells.some((value) => value.includes("form_response"))) {
    return true;
  }

  if (normalizedCells.length === 1) {
    const value = normalizedCells[0];
    return (
      isNameHeaderToken(value) ||
      isFacilitatorHeaderToken(value) ||
      isListenerHeaderToken(value) ||
      isSingleRoleHeaderToken(value) ||
      isTimestampHeaderToken(value)
    );
  }

  let headerCategories = 0;
  if (normalizedCells.some(isNameHeaderToken)) {
    headerCategories += 1;
  }
  if (normalizedCells.some(isFacilitatorHeaderToken)) {
    headerCategories += 1;
  }
  if (normalizedCells.some(isListenerHeaderToken)) {
    headerCategories += 1;
  }
  if (normalizedCells.some(isSingleRoleHeaderToken)) {
    headerCategories += 1;
  }
  if (normalizedCells.some(isTimestampHeaderToken)) {
    headerCategories += 1;
  }

  return headerCategories >= 2;
}

function looksLikeIndexCell(value) {
  const normalized = normalizeFlagToken(value);
  return /^\d+$/.test(normalized) || /^no\.?\s*\d+$/.test(normalized);
}

function normalizeRoleCell(raw) {
  const trimmed = normalizeCellValue(raw);
  if (!trimmed) {
    return "";
  }

  const token = normalizeFlagToken(trimmed);
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token) !== 0 ? "1" : "0";
  }
  if (TRUE_FLAG_VALUES.has(token)) {
    return "1";
  }
  if (FALSE_FLAG_VALUES.has(token)) {
    return "0";
  }
  return trimmed;
}

function isLikelySequentialIndex(values) {
  const nonEmpty = values
    .map((value) => normalizeCellValue(value))
    .filter((value) => value.length > 0);

  if (nonEmpty.length < 4) {
    return false;
  }

  const numbers = nonEmpty
    .map((value) => Number(normalizeFlagToken(value)))
    .filter((value) => Number.isInteger(value));

  if (numbers.length !== nonEmpty.length) {
    return false;
  }

  let sequentialCount = 1;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] === numbers[i - 1] + 1) {
      sequentialCount += 1;
    }
  }

  return sequentialCount / numbers.length >= 0.8;
}

function inferColumnMapping(rows) {
  const maxColumns = rows.reduce(
    (max, cells) => Math.max(max, cells.length),
    0
  );

  if (maxColumns === 0) {
    return {
      nameIndex: 0,
      facilitatorIndex: 1,
      listenerIndex: 2,
      singleRoleIndex: -1,
    };
  }

  const columnValues = Array.from({ length: maxColumns }, () => []);
  rows.forEach((cells) => {
    for (let i = 0; i < maxColumns; i += 1) {
      columnValues[i].push(normalizeCellValue(cells[i] || ""));
    }
  });

  const stats = columnValues.map((values) => {
    let nonEmpty = 0;
    let booleanLike = 0;
    let numericLike = 0;
    let textLike = 0;
    let roleKeywordLike = 0;
    let dateTimeLike = 0;

    values.forEach((value) => {
      if (!value) {
        return;
      }

      nonEmpty += 1;
      const token = normalizeFlagToken(value);

      if (isBooleanLikeToken(token)) {
        booleanLike += 1;
      }

      if (isNumericToken(token)) {
        numericLike += 1;
      }

      if (!isBooleanLikeToken(token) && !isNumericToken(token)) {
        textLike += 1;
      }

      if (parseSingleRoleSelection(value).known) {
        roleKeywordLike += 1;
      }

      if (looksLikeDateTimeValue(value)) {
        dateTimeLike += 1;
      }
    });

    return {
      nonEmpty,
      booleanLike,
      numericLike,
      textLike,
      roleKeywordLike,
      dateTimeLike,
      sequentialIndex: isLikelySequentialIndex(values),
    };
  });

  let nameIndex = 0;
  let bestNameScore = Number.NEGATIVE_INFINITY;

  stats.forEach((stat, index) => {
    let score = stat.textLike * 100 + stat.nonEmpty * 8 - stat.booleanLike * 20;
    score -= stat.dateTimeLike * 90;
    if (stat.sequentialIndex) {
      score -= 200;
    }

    if (score > bestNameScore) {
      bestNameScore = score;
      nameIndex = index;
    }
  });

  if (bestNameScore <= 0) {
    nameIndex = stats
      .map((stat, index) => ({ index, nonEmpty: stat.nonEmpty }))
      .sort((a, b) => b.nonEmpty - a.nonEmpty)[0]?.index ?? 0;
  }

  const singleRoleCandidate = stats
    .map((stat, index) => {
      if (index === nameIndex) {
        return null;
      }

      const score = stat.roleKeywordLike * 120 + stat.nonEmpty * 2;
      return { index, score, roleKeywordLike: stat.roleKeywordLike, nonEmpty: stat.nonEmpty };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.score - a.score)[0];

  if (
    singleRoleCandidate &&
    singleRoleCandidate.roleKeywordLike >=
      Math.max(2, Math.ceil(singleRoleCandidate.nonEmpty * 0.45))
  ) {
    return {
      nameIndex,
      facilitatorIndex: -1,
      listenerIndex: -1,
      singleRoleIndex: singleRoleCandidate.index,
    };
  }

  const roleCandidates = stats
    .map((stat, index) => {
      if (index === nameIndex) {
        return null;
      }

      const score = stat.booleanLike * 100 + stat.nonEmpty * 4 - stat.textLike * 30;
      return { index, score };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.score - a.score);

  let facilitatorIndex = roleCandidates[0]?.index ?? nameIndex + 1;
  let listenerIndex = roleCandidates[1]?.index ?? nameIndex + 2;

  if (facilitatorIndex === nameIndex) {
    facilitatorIndex = nameIndex + 1;
  }
  if (listenerIndex === nameIndex || listenerIndex === facilitatorIndex) {
    listenerIndex =
      roleCandidates.find(
        (candidate) =>
          candidate.index !== nameIndex &&
          candidate.index !== facilitatorIndex
      )?.index ?? nameIndex + 2;
  }

  return {
    nameIndex,
    facilitatorIndex,
    listenerIndex,
    singleRoleIndex: -1,
  };
}

function resolveColumnMapping(rows) {
  const defaultMapping = {
    nameIndex: 0,
    facilitatorIndex: 1,
    listenerIndex: 2,
    singleRoleIndex: -1,
  };

  const headerRow = rows.find((cells) => isHeaderRow(cells));
  if (!headerRow) {
    const dataRows = rows.filter((cells) =>
      cells.some((value) => normalizeCellValue(value).length > 0)
    );
    if (dataRows.length === 0) {
      return defaultMapping;
    }

    return inferColumnMapping(dataRows);
  }

  const normalized = headerRow.map((value) => normalizeFlagToken(value));
  const nameIndex = normalized.findIndex(
    (value) => isNameHeaderToken(value)
  );
  const facilitatorIndex = normalized.findIndex(
    (value) => isFacilitatorHeaderToken(value)
  );
  const listenerIndex = normalized.findIndex(
    (value) => isListenerHeaderToken(value)
  );
  const singleRoleIndex = normalized.findIndex(
    (value) => isSingleRoleHeaderToken(value)
  );
  const fallbackNameIndex =
    nameIndex >= 0
      ? nameIndex
      : normalized.findIndex(
          (value, index) =>
            index !== singleRoleIndex && !isTimestampHeaderToken(value)
        );

  if (singleRoleIndex >= 0 && facilitatorIndex < 0 && listenerIndex < 0) {
    return {
      nameIndex:
        fallbackNameIndex >= 0 ? fallbackNameIndex : defaultMapping.nameIndex,
      facilitatorIndex: -1,
      listenerIndex: -1,
      singleRoleIndex,
    };
  }

  return {
    nameIndex: nameIndex >= 0 ? nameIndex : defaultMapping.nameIndex,
    facilitatorIndex:
      facilitatorIndex >= 0 ? facilitatorIndex : defaultMapping.facilitatorIndex,
    listenerIndex: listenerIndex >= 0 ? listenerIndex : defaultMapping.listenerIndex,
    singleRoleIndex: -1,
  };
}

function parseParticipantRow(cells, mapping) {
  const getCell = (index) =>
    index >= 0 ? normalizeCellValue(cells[index] || "") : "";
  let name = getCell(mapping.nameIndex);
  if (!name) {
    const fallbackName = cells
      .map((value) => normalizeCellValue(value))
      .find(
        (value) =>
          value.length > 0 &&
          !isBooleanLikeValue(value) &&
          !looksLikeIndexCell(value)
      );
    name = fallbackName || "";
  }

  if (typeof mapping.singleRoleIndex === "number" && mapping.singleRoleIndex >= 0) {
    const singleRole = parseSingleRoleSelection(getCell(mapping.singleRoleIndex));
    if (singleRole.known) {
      return {
        name,
        facilitatorRaw: singleRole.facilitatorRaw,
        listenerRaw: singleRole.listenerRaw,
      };
    }
  }

  const facilitatorRaw = normalizeRoleCell(getCell(mapping.facilitatorIndex));
  const listenerRaw = normalizeRoleCell(getCell(mapping.listenerIndex));
  return { name, facilitatorRaw, listenerRaw };
}

function parseClipboardParticipants(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  const rows = lines.map((line) => splitRowCells(line).map(normalizeCellValue));

  if (rows.length === 0) {
    return [];
  }

  const firstRowTokens = rows[0].map((value) => normalizeFlagToken(value));
  const hasHeader =
    firstRowTokens.some((value) => isNameHeaderToken(value)) ||
    firstRowTokens.some((value) => isSingleRoleHeaderToken(value)) ||
    firstRowTokens.some((value) => isTimestampHeaderToken(value));

  const startRow = hasHeader ? 1 : 0;
  const dataRows = rows.slice(startRow);
  if (dataRows.length === 0) {
    return [];
  }

  const columnCount = dataRows.reduce(
    (max, cells) => Math.max(max, cells.length),
    0
  );
  const roleScores = Array.from({ length: columnCount }, () => 0);

  dataRows.forEach((cells) => {
    cells.forEach((value, index) => {
      const parsedRole = parseParticipationCode(value);
      if (parsedRole.facilitatorRaw === "1") {
        roleScores[index] += 2;
        return;
      }
      if (parsedRole.listenerRaw === "1") {
        roleScores[index] += 2;
        return;
      }
      if (normalizeFlagToken(value) === "2") {
        roleScores[index] += 1;
      }
    });
  });

  let roleIndex = roleScores.findIndex(
    (score) => score === Math.max(...roleScores)
  );
  if (roleIndex < 0) {
    roleIndex = 1;
  }

  let nameIndex = roleIndex === 0 ? 1 : 0;
  const explicitNameIndex = firstRowTokens.findIndex((value) =>
    isNameHeaderToken(value)
  );
  if (explicitNameIndex >= 0) {
    nameIndex = explicitNameIndex;
  } else {
    const likelyNameIndex = dataRows[0]?.findIndex(
      (value, index) =>
        index !== roleIndex &&
        normalizeCellValue(value).length > 0 &&
        !looksLikeDateTimeValue(value)
    );
    if (typeof likelyNameIndex === "number" && likelyNameIndex >= 0) {
      nameIndex = likelyNameIndex;
    }
  }

  return dataRows
    .map((cells) => {
      const name = normalizeCellValue(cells[nameIndex] || "");
      if (!name || looksLikeDateTimeValue(name)) {
        return null;
      }
      const role = parseParticipationCode(cells[roleIndex] || "");
      return {
        name,
        facilitatorRaw: role.facilitatorRaw,
        listenerRaw: role.listenerRaw,
      };
    })
    .filter((participant) => participant !== null);
}

function applyPastedParticipants(startIndex, participants) {
  let appliedCount = 0;

  participants
    .slice(0, INPUT_COUNT - startIndex)
    .forEach((participant, offset) => {
      const rowIndex = startIndex + offset;
      const row = inputContainer.querySelector(
        `.input-row[data-row-index="${rowIndex}"]`
      );
      if (!row) {
        return;
      }

      row.querySelector(".participant-name").value = participant.name;
      row.querySelector(".role-code").value = encodeParticipationCode(
        participant.facilitatorRaw,
        participant.listenerRaw
      );
      appliedCount += 1;
    });

  if (appliedCount > 0) {
    updateGroupSelectConstraints();
  }

  return appliedCount;
}

function importParticipantsFromText(text, startIndex) {
  const participants = parseClipboardParticipants(text);
  if (participants.length === 0) {
    return 0;
  }

  return applyPastedParticipants(startIndex, participants);
}

function applySingleRolePaste(target, clipboardText) {
  if (!(target instanceof HTMLSelectElement) || !target.classList.contains("role-code")) {
    return false;
  }

  const raw = normalizeCellValue(clipboardText);
  if (!raw || raw.includes("\t") || raw.includes("\n")) {
    return false;
  }

  const strictToken = normalizeFlagToken(raw);
  if (isStrictParticipationCode(strictToken)) {
    target.value = strictToken;
    updateGroupSelectConstraints();
    return true;
  }

  const selection = parseSingleRoleSelection(raw);
  if (!selection.known) {
    return false;
  }

  target.value = encodeParticipationCode(selection.facilitatorRaw, selection.listenerRaw);
  updateGroupSelectConstraints();
  return true;
}

function handleGridPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  const inGridRow = event.target.closest(".input-row");
  if (!inGridRow) {
    return;
  }

  const clipboardText = getClipboardText(event);

  const row = inGridRow;
  if (!row) {
    return;
  }

  const startIndex = Number(row.dataset.rowIndex || "0");
  if (clipboardText && (clipboardText.includes("\t") || clipboardText.includes("\n"))) {
    const appliedCount = importParticipantsFromText(clipboardText, startIndex);
    if (appliedCount > 0) {
      showInfo(`${appliedCount}件を貼り付けました。`);
      event.preventDefault();
      return;
    }
  }

  if (applySingleRolePaste(event.target, clipboardText)) {
    event.preventDefault();
    return;
  }

  window.setTimeout(() => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const fallbackText = event.target.value;
    if (!fallbackText) {
      return;
    }

    if (!fallbackText.includes("\t") && !fallbackText.includes("\n")) {
      return;
    }

    const appliedCount = importParticipantsFromText(fallbackText, startIndex);
    if (appliedCount <= 0) {
      return;
    }

    event.target.value = "";
    showInfo(`${appliedCount}件を貼り付けました。`);
  }, 0);
}

async function handleReadClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showError(
      "このブラウザではクリップボード読取に対応していません。スプシのB:Cをコピーしてから再試行してください。"
    );
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      showError("クリップボードが空です。スプシのB:Cをコピーしてから実行してください。");
      return;
    }

    const parsedParticipants = parseClipboardParticipants(text);
    const importableCount = Math.min(parsedParticipants.length, INPUT_COUNT);
    if (importableCount <= 3) {
      showError("参加者が3人以下のため反映できません。4人以上をコピーしてください。");
      return;
    }

    const appliedCount = applyPastedParticipants(0, parsedParticipants);
    if (appliedCount <= 0) {
      showError(
        "貼り付けデータを読み取れませんでした。B:C（1=ファシリ, 2=通常, 3=聞き専）をコピーしてください。"
      );
      return;
    }
    if (appliedCount <= 3) {
      showError("参加者が3人以下のため反映できません。4人以上をコピーしてください。");
      return;
    }

    showInfo(`${appliedCount}件をシートから反映しました。`);
  } catch (error) {
    showError(
      "クリップボード読取が許可されていません。ブラウザで読取を許可して再実行してください。"
    );
  }
}

function handleGlobalPaste(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  if (event.target.closest(".sheet-import") || event.target.closest(".input-row")) {
    return;
  }

  const clipboardText = getClipboardText(event);
  if (!clipboardText) {
    return;
  }

  if (!clipboardText.includes("\t") && !clipboardText.includes("\n")) {
    return;
  }

  const appliedCount = importParticipantsFromText(clipboardText, 0);
  if (appliedCount <= 0) {
    return;
  }

  showInfo(`${appliedCount}件をシートから反映しました。`);
  event.preventDefault();
}

function getParticipants() {
  return Array.from(inputContainer.querySelectorAll(".input-row"))
    .map((row) => {
      const name = row.querySelector(".participant-name").value.trim();
      const roleRaw = row.querySelector(".role-code").value;
      if (!name || !isStrictParticipationCode(roleRaw)) {
        return null;
      }
      const role = parseParticipationCode(roleRaw);
      const listener = role.listenerRaw === "1";
      const facilitator = role.facilitatorRaw === "1";
      return { name, listener, facilitator };
    })
    .filter((participant) => participant !== null);
}

function getRequiredGroupCount(participantCount) {
  if (participantCount <= 0) {
    return MIN_GROUP_COUNT;
  }
  return Math.ceil(participantCount / MAX_MEMBERS_PER_GROUP);
}

function getMinimumMembersPerGroup(participantCount) {
  if (participantCount >= MIN_MEMBERS_PER_GROUP_LARGE_THRESHOLD) {
    return MIN_MEMBERS_PER_GROUP_LARGE;
  }
  return MIN_MEMBERS_PER_GROUP;
}

function getMaximumGroupCount(participantCount) {
  if (participantCount <= 0) {
    return 0;
  }
  const minimumMembersPerGroup = getMinimumMembersPerGroup(participantCount);
  return Math.min(
    INPUT_COUNT,
    MAX_GROUPS_WITHOUT_MODAL_SCROLL,
    Math.floor(participantCount / minimumMembersPerGroup)
  );
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

function updateMicOnGuide(participants, groupCount) {
  const guide = ensureMicOnGuideElement();
  if (!guide || !participantGuide) {
    return;
  }

  const participantCount = Array.isArray(participants) ? participants.length : 0;
  const micOnCount = Array.isArray(participants)
    ? participants.filter((participant) => !participant.listener).length
    : 0;
  participantGuide.textContent = `参加者：${participantCount}人（マイクオン：${micOnCount}人）`;

  if (participantCount === 0) {
    guide.textContent = "1グループ：0人（マイクオン：0人）";
    return;
  }

  if (!Number.isInteger(groupCount) || groupCount <= 0) {
    guide.textContent = "1グループ：-〜-人（マイクオン：-〜-人）";
    return;
  }

  const minMembersPerGroup = Math.floor(participantCount / groupCount);
  const maxMembersPerGroup = Math.ceil(participantCount / groupCount);
  const minMicOnPerGroup = Math.floor(micOnCount / groupCount);
  const maxMicOnPerGroup = Math.ceil(micOnCount / groupCount);
  const membersText = formatPeopleRange(minMembersPerGroup, maxMembersPerGroup);
  const micOnText = formatPeopleRange(minMicOnPerGroup, maxMicOnPerGroup);
  guide.textContent = `1グループ：${membersText}（マイクオン：${micOnText}）`;
}

function updateGroupSelectConstraints() {
  const participants = getParticipants();
  const participantCount = participants.length;
  const requiredGroupCount = getRequiredGroupCount(participantCount);
  const maximumGroupCount = getMaximumGroupCount(participantCount);
  const minimumSelectable = Math.max(MIN_GROUP_COUNT, requiredGroupCount);
  const previousValue = Number(groupSelect.value);

  if (minimumSelectable > maximumGroupCount) {
    groupSelect.innerHTML = '<option value="">-</option>';
    groupSelect.value = "";
    groupSelect.disabled = true;
    updateMicOnGuide(participants, 0);
    return;
  }

  const options = [];
  for (let value = minimumSelectable; value <= maximumGroupCount; value += 1) {
    options.push(`<option value="${value}">${value}</option>`);
  }

  groupSelect.disabled = false;
  groupSelect.innerHTML = options.join("");

  if (previousValue >= minimumSelectable && previousValue <= maximumGroupCount) {
    groupSelect.value = String(previousValue);
  } else {
    groupSelect.value = String(minimumSelectable);
  }

  updateMicOnGuide(participants, Number(groupSelect.value));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function escapeHtml(value) {
  return value
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

  let value = normalized;
  let label = "";
  while (value > 0) {
    const index = (value - 1) % GROUP_LABEL_ALPHABET.length;
    label = `${GROUP_LABEL_ALPHABET[index]}${label}`;
    value = Math.floor((value - 1) / GROUP_LABEL_ALPHABET.length);
  }

  return label;
}

function getRoleLabels(participant) {
  const labels = [];
  if (participant.listener) {
    labels.push("聞き専");
  }
  if (participant.facilitator) {
    labels.push("ファシ");
  }
  return labels;
}

function pickFacilitatorIndex(group) {
  const facilitatorIndexes = group
    .map((participant, index) => (participant.facilitator ? index : -1))
    .filter((index) => index !== -1);

  if (facilitatorIndexes.length === 0) {
    return -1;
  }

  const nonListenerFacilitator = facilitatorIndexes.find(
    (index) => !group[index].listener
  );

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

function buildBalancedCapacities(totalCount, groupCount) {
  const capacities = Array.from(
    { length: groupCount },
    () => Math.floor(totalCount / groupCount)
  );
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

function calculateBalanceScore(
  groups,
  capacities,
  totals,
  totalCount,
  micOnTargets,
  listenerTargets
) {
  let score = 0;

  groups.forEach((group, index) => {
    const listeners = group.filter((item) => item.listener).length;
    const micOn = group.length - listeners;
    const facilitators = group.filter((item) => item.facilitator).length;
    const dual = group.filter((item) => item.listener && item.facilitator).length;

    const targetListeners = (totals.listeners * capacities[index]) / totalCount;
    const targetFacilitators =
      (totals.facilitators * capacities[index]) / totalCount;
    const targetDual = (totals.dual * capacities[index]) / totalCount;

    score += (micOn - micOnTargets[index]) ** 2 * 12;
    score += (listeners - listenerTargets[index]) ** 2 * 3;
    score += (listeners - targetListeners) ** 2 * 0.6;
    score += (facilitators - targetFacilitators) ** 2 * 2.2;
    score += (dual - targetDual) ** 2 * 1.6;
  });

  return score;
}

function splitIntoBalancedGroups(participants, groupCount) {
  const totalCount = participants.length;
  const capacities = buildBalancedCapacities(totalCount, groupCount);
  const listenerParticipants = participants.filter((item) => item.listener);
  const micOnParticipants = participants.filter((item) => !item.listener);
  const listenerTargets = buildRoleTargets(listenerParticipants.length, capacities);
  const micOnTargets = capacities.map(
    (capacity, index) => capacity - listenerTargets[index]
  );
  const listenerSlots = listenerTargets.flatMap((count, groupIndex) =>
    Array.from({ length: count }, () => groupIndex)
  );
  const micOnSlots = micOnTargets.flatMap((count, groupIndex) =>
    Array.from({ length: count }, () => groupIndex)
  );

  const totals = {
    listeners: participants.filter((item) => item.listener).length,
    facilitators: participants.filter((item) => item.facilitator).length,
    dual: participants.filter((item) => item.listener && item.facilitator).length,
  };

  const iterations = Math.max(1200, totalCount * 300);
  let bestScore = Number.POSITIVE_INFINITY;
  let bestGroups = null;

  for (let i = 0; i < iterations; i += 1) {
    const shuffledListeners = shuffle([...listenerParticipants]);
    const shuffledListenerSlots = shuffle([...listenerSlots]);
    const shuffledMicOn = shuffle([...micOnParticipants]);
    const shuffledMicOnSlots = shuffle([...micOnSlots]);
    const groups = Array.from({ length: groupCount }, () => []);

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
      listenerTargets
    );
    if (score < bestScore || (score === bestScore && Math.random() < 0.5)) {
      bestScore = score;
      bestGroups = groups;
    }
  }

  return bestGroups;
}

function renderGroups(groups) {
  const cards = groups
    .map((group, index) => {
      const displayMembers = buildDisplayMembers(group);
      const facilitatorName = displayMembers.find(
        (member) => member.isFacilitator
      )?.participant.name;
      const facilitatorLabel = facilitatorName
        ? `${escapeHtml(facilitatorName)}さん`
        : "ファシ未設定";
      const facilitatorRawLabel = facilitatorName
        ? `${facilitatorName}さん`
        : "ファシ未設定";
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
                    ? `<span class="member-tags">${roleLabels
                        .map((label) => {
                          const className =
                            label === "ファシ"
                              ? "member-tag facilitator"
                              : "member-tag listener";
                          return `<em class="${className}">${label}</em>`;
                        })
                        .join("")}</span>`
                    : "";

                return `<li class="member-item">
                  <span class="member-name">${escapeHtml(
                    member.participant.name
                  )}</span>
                  ${badges}
                </li>`;
              })
              .join("")
          : '<li class="empty">メンバーなし</li>';

      return `<article class="group-card result-pop">
        <h3 title="${escapeHtml(headingTitle)}">${headingText}</h3>
        <ul>${members}</ul>
      </article>`;
    })
    .join("");

  if (ensureModalElements()) {
    updateModalDrawHeader({ active: false });
    modalContent.dataset.groupCount = String(groups.length);
    modalContent.innerHTML = `
      <div class="result-grid-fit" data-group-count="${groups.length}">
        <div class="group-grid">${cards}</div>
      </div>
    `;
    scheduleResultGridFit();
  }
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
  measureElement.style.maxWidth = "none";
  measureElement.style.minWidth = "0";

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

function setControlsDisabled(disabled) {
  shuffleButton.disabled = disabled;
  groupSelect.disabled = disabled;

  Array.from(inputContainer.querySelectorAll("input, select")).forEach((field) => {
    field.disabled = disabled;
  });

  if (readClipboardButton) {
    readClipboardButton.disabled = disabled;
  }
}

function setShuffleButtonLabel(isDrawingState) {
  if (!shuffleButton) {
    return;
  }

  if (isDrawingState) {
    shuffleButton.textContent = "抽選中...";
    return;
  }

  shuffleButton.innerHTML = SHUFFLE_BUTTON_IDLE_HTML;
}

function openModal(title) {
  if (!ensureModalElements()) {
    return false;
  }
  modalTitle.textContent = title;
  updateModalDrawHeader({ active: false });
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  return true;
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
  document.body.classList.remove("is-modal-open");
}

function setModalLocked(locked) {
  if (!ensureModalElements()) {
    return;
  }
  modal.classList.toggle("locked", locked);
  modalCloseButton.disabled = locked;
}

function applyResultGridFit() {
  if (!ensureModalElements()) {
    return;
  }

  const groupCount = Number(modalContent.dataset.groupCount || "0");
  const fitRoot = modalContent.querySelector(".result-grid-fit");
  const shouldFit =
    Boolean(fitRoot) &&
    Number.isInteger(groupCount) &&
    groupCount > 0 &&
    groupCount <= MAX_GROUPS_WITHOUT_MODAL_SCROLL;

  modalContent.classList.toggle("is-fit-groups", shouldFit);
  if (!fitRoot) {
    return;
  }

  fitRoot.classList.toggle("is-fit-25", shouldFit);
  fitRoot.style.removeProperty("--fit-scale");

  if (!shouldFit) {
    return;
  }

  const grid = fitRoot.querySelector(".group-grid");
  if (!grid) {
    return;
  }

  fitRoot.style.setProperty("--fit-scale", "1");
  const drawStatus = fitRoot.querySelector(".draw-status-line");
  const drawProgress = fitRoot.querySelector(".draw-progress-plain");
  const reservedHeight =
    (drawStatus ? drawStatus.offsetHeight : 0) +
    (drawProgress ? drawProgress.offsetHeight : 0) +
    (drawStatus || drawProgress ? 12 : 0);

  const availableWidth = Math.max(1, modalContent.clientWidth - 2);
  const availableHeight = Math.max(1, modalContent.clientHeight - reservedHeight - 2);
  const gridWidth = Math.max(1, Math.ceil(grid.scrollWidth));
  const gridHeight = Math.max(1, Math.ceil(grid.scrollHeight));
  const scale = Math.min(1, availableWidth / gridWidth, availableHeight / gridHeight);
  fitRoot.style.setProperty("--fit-scale", scale.toFixed(4));
}

function scheduleResultGridFit() {
  if (modalFitRafId !== null) {
    window.cancelAnimationFrame(modalFitRafId);
  }

  modalFitRafId = window.requestAnimationFrame(() => {
    modalFitRafId = null;
    applyResultGridFit();
  });
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

function getShuffledRandomMembers(participants, count, blockedNames = []) {
  const blockedSet = new Set(blockedNames);
  const filtered = participants.filter(
    (participant) => !blockedSet.has(participant.name)
  );
  const shuffled = shuffle([...filtered]);
  return shuffled.slice(0, count);
}

function buildPhasePreviewState(participants, finalGroups, elapsedMs) {
  const groupCount = finalGroups.length;
  const randomGroups = buildAnimatedPreviewGroups(participants, groupCount);
  const facilitatorLocked = elapsedMs >= FACILITATOR_DRAW_MS;
  const memberPhaseDuration = Math.max(1, DRAW_DURATION_MS - FACILITATOR_DRAW_MS);
  const memberProgress = facilitatorLocked
    ? Math.min(1, (elapsedMs - FACILITATOR_DRAW_MS) / memberPhaseDuration)
    : 0;

  return finalGroups.map((finalGroup, index) => {
    const randomGroup = randomGroups[index] || [];

    const facilitatorCandidateIndex = (() => {
      const designated = pickFacilitatorIndex(finalGroup);
      if (designated !== -1) {
        return designated;
      }
      return finalGroup.length > 0 ? 0 : -1;
    })();

    const finalFacilitator =
      facilitatorCandidateIndex >= 0
        ? finalGroup[facilitatorCandidateIndex]
        : null;
    const randomFacilitator =
      randomGroup[Math.floor(Math.random() * Math.max(1, randomGroup.length))] ||
      finalFacilitator;
    const facilitatorParticipant = facilitatorLocked
      ? finalFacilitator || randomFacilitator
      : randomFacilitator || finalFacilitator;
    const facilitatorName = facilitatorParticipant?.name || "調整中";

    const finalMembers = finalGroup.filter(
      (_, memberIndex) => memberIndex !== facilitatorCandidateIndex
    );
    const memberCount = finalMembers.length;
    const lockedMemberCount = facilitatorLocked
      ? Math.min(memberCount, Math.floor(memberProgress * memberCount))
      : 0;

    const lockedMembers = finalMembers
      .slice(0, lockedMemberCount)
      .map((participant) => ({ participant, locked: true }));

    const randomGroupMembers = randomGroup.filter(
      (participant) =>
        participant.name !== facilitatorName &&
        !lockedMembers.some(
          (lockedItem) => lockedItem.participant.name === participant.name
        )
    );

    const remainingCount = memberCount - lockedMemberCount;
    let randomMembers = randomGroupMembers.slice(0, remainingCount);

    if (randomMembers.length < remainingCount) {
      const fallbackMembers = getShuffledRandomMembers(participants, remainingCount, [
        facilitatorName,
        ...lockedMembers.map((lockedItem) => lockedItem.participant.name),
        ...randomMembers.map((participant) => participant.name),
      ]);
      randomMembers = randomMembers.concat(fallbackMembers);
    }

    const shuffledMembers = [
      ...lockedMembers.map((item) => ({
        participant: item.participant,
        locked: true,
      })),
      ...randomMembers.slice(0, remainingCount).map((participant) => ({
        participant,
        locked: false,
      })),
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
        locked: facilitatorLocked,
      });
    }

    displayMembers.push(...micOnMembers, ...listenerMembers);

    return {
      facilitatorName,
      facilitatorLocked,
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
      const facilitatorLabel =
        state && state.facilitatorName !== "調整中"
          ? `${state.facilitatorName}さん`
          : "抽選中";
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
        <li class="member-item draw-member is-shuffling draw-preview-empty">
          <span class="member-name">調整中...</span>
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
            ? `<span class="member-tags">${roleLabels
                .map((label) => {
                  const className =
                    label === "ファシ"
                      ? "member-tag facilitator"
                      : "member-tag listener";
                  return `<em class="${className}">${label}</em>`;
                })
                .join("")}</span>`
            : "";

        return `<li class="member-item draw-member ${
          member.locked ? "is-locked" : "is-shuffling"
        }">
          <span class="member-name">${escapeHtml(member.name)}</span>
          ${badges}
        </li>`;
      })
      .join("");
  });
}

function renderDrawStage(_participants, groupCount) {
  if (!ensureModalElements()) {
    return;
  }

  modalContent.dataset.groupCount = String(groupCount);

  const previewGroups = Array.from({ length: groupCount }, (_, index) => {
    const symbol = formatGroupSymbol(index + 1);
    const headingText = `${symbol}: 抽選中グループ`;
    const escapedHeadingText = escapeHtml(headingText);
    return `<article class="group-card draw-group-card" data-preview-card>
      <h3 data-preview-heading="${index}" title="${escapedHeadingText}">${escapedHeadingText}</h3>
      <ul data-preview-group="${index}">
        <li class="member-item draw-member is-shuffling draw-preview-empty">
          <span class="member-name">抽選中...</span>
        </li>
      </ul>
    </article>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="result-grid-fit" data-group-count="${groupCount}">
      <section class="draw-stage-plain" aria-live="polite">
        <div class="group-grid draw-group-grid">${previewGroups}</div>
      </section>
    </div>
  `;
  scheduleResultGridFit();
}

function runDrawAnimation(participants, groupCount, finalGroups) {
  renderDrawStage(participants, groupCount);

  if (!ensureModalElements()) {
    return Promise.resolve();
  }

  const previewCards = Array.from(modalContent.querySelectorAll("[data-preview-card]"));
  const startTime = Date.now();
  let highlightedIndex = -1;

  const renderInitialFrame = () => {
    const previewState = buildPhasePreviewState(participants, finalGroups, 0);
    renderAnimatedPreviewGroups(previewState);

    if (previewCards.length > 0) {
      highlightedIndex = Math.floor(Math.random() * previewCards.length);
      previewCards[highlightedIndex].classList.add("is-hot");
    }

    updateModalDrawHeader({
      active: true,
      phaseText: "ファシリテーター決定中",
      remainingMs: DRAW_DURATION_MS,
      progress: 0,
    });
  };

  renderInitialFrame();

  drawIntervalId = window.setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const previewState = buildPhasePreviewState(
      participants,
      finalGroups,
      elapsedMs
    );
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
    const phaseLabel =
      elapsed < FACILITATOR_DRAW_MS
        ? "ファシリテーター決定中"
        : "メンバーを振り分け中";
    updateModalDrawHeader({
      active: true,
      phaseText: phaseLabel,
      remainingMs: remaining,
      progress: elapsed / DRAW_DURATION_MS,
    });
  }, 50);

  return new Promise((resolve) => {
    revealTimeoutId = window.setTimeout(() => {
      clearDrawTimers();
      updateModalDrawHeader({ active: false });
      resolve();
    }, DRAW_DURATION_MS);
  });
}

async function handleShuffle() {
  if (isDrawing) {
    return;
  }

  clearError();

  const participants = getParticipants();
  const groupCount = Number(groupSelect.value);
  const minimumMembersPerGroup = getMinimumMembersPerGroup(participants.length);
  const requiredGroupCount = getRequiredGroupCount(participants.length);
  const maximumGroupCount = getMaximumGroupCount(participants.length);

  if (participants.length < 3) {
    showError("参加者は3人以上入力してください。");
    return;
  }

  if (!Number.isInteger(groupCount) || groupCount < MIN_GROUP_COUNT) {
    showError("グループ数を選択してください。");
    return;
  }

  if (requiredGroupCount > maximumGroupCount) {
    showError(
      `参加者${participants.length}人では、1グループ${minimumMembersPerGroup}〜${MAX_MEMBERS_PER_GROUP}人で2グループ以上を作れません。参加者を${MIN_GROUP_COUNT * minimumMembersPerGroup}人以上にしてください。`
    );
    return;
  }

  if (groupCount < requiredGroupCount) {
    showError(
      `1グループ最大${MAX_MEMBERS_PER_GROUP}人のため、参加者${participants.length}人は${requiredGroupCount}グループ以上を選択してください。`
    );
    return;
  }

  if (groupCount > maximumGroupCount) {
    showError(
      `1グループ最小${minimumMembersPerGroup}人のため、参加者${participants.length}人は${maximumGroupCount}グループ以下を選択してください。`
    );
    return;
  }

  if (participants.length < groupCount) {
    showError(
      `参加者数（${participants.length}人）がグループ数（${groupCount}）より少ないです。`
    );
    return;
  }

  const groups = splitIntoBalancedGroups(participants, groupCount);

  isDrawing = true;
  setControlsDisabled(true);
  setShuffleButtonLabel(true);

  try {
    openModal("抽選中");
    setModalLocked(true);
    await runDrawAnimation(participants, groupCount, groups);
    openModal("振り分け完了");
    setModalLocked(false);
    renderGroups(groups);
  } finally {
    clearDrawTimers();
    updateModalDrawHeader({ active: false });
    isDrawing = false;
    setModalLocked(false);
    setControlsDisabled(false);
    updateGroupSelectConstraints();
    setShuffleButtonLabel(false);
  }
}

createInputFields();
renderPlaceholder();
ensureModalElements();
setShuffleButtonLabel(false);
updateGroupSelectConstraints();
inputContainer.addEventListener("input", updateGroupSelectConstraints);
inputContainer.addEventListener("change", updateGroupSelectConstraints);
groupSelect.addEventListener("change", () => {
  updateMicOnGuide(getParticipants(), Number(groupSelect.value));
});
inputContainer.addEventListener("paste", handleGridPaste);
if (readClipboardButton) {
  readClipboardButton.addEventListener("click", handleReadClipboard);
}
shuffleButton.addEventListener("click", handleShuffle);
document.addEventListener("paste", handleGlobalPaste);
if (ensureModalElements()) {
  modalCloseButton.addEventListener("click", closeModal);
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
  }
});
