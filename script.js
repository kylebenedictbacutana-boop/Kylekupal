const STORAGE_KEY = "attendance_system_data_v1";
const THEME_KEY = "attendance_system_theme_v1";

const DEFAULT_STUDENTS = [
  { id: "2026-001", name: "Althea Mae Santos", section: "Grade 10 - Einstein" },
  { id: "2026-002", name: "Miguel Angelo Reyes", section: "Grade 10 - Einstein" },
  { id: "2026-003", name: "Sofia Isabel Cruz", section: "Grade 10 - Newton" },
  { id: "2026-004", name: "Gabriel Paolo Mendoza", section: "Grade 10 - Newton" }
];

const STATUS_OPTIONS = ["Present", "Late", "Absent", "Excused"];

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    // Ignore storage quota or restricted-context errors
  }
}

function getTodayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

function loadAppData() {
  const saved = readStorage(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.students) && parsed.records && typeof parsed.records === "object") {
        return { students: parsed.students, records: parsed.records };
      }
    } catch (err) {
      // Fall back to defaults if stored JSON is corrupted
    }
  }
  return { students: DEFAULT_STUDENTS.slice(), records: {} };
}

let appData = loadAppData();
let activeTab = "daily";

function saveAppData() {
  writeStorage(STORAGE_KEY, JSON.stringify(appData));
}

function applySavedTheme() {
  if (readStorage(THEME_KEY) === "dark") {
    document.body.classList.add("dark");
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  writeStorage(THEME_KEY, isDark ? "dark" : "light");
}

// DOM References
const dateInput = document.getElementById("dateInput");
const sectionSelect = document.getElementById("sectionSelect");
const searchInput = document.getElementById("searchInput");
const studentListEl = document.getElementById("studentList");
const historyTableBody = document.getElementById("historyTableBody");

const modalOverlay = document.getElementById("studentModal");
const studentForm = document.getElementById("studentForm");
const studentIdInput = document.getElementById("studentIdInput");
const studentNameInput = document.getElementById("studentNameInput");
const studentSectionInput = document.getElementById("studentSectionInput");
const modalError = document.getElementById("modalError");

function openStudentModal() {
  modalError.textContent = "";
  modalOverlay.classList.add("open");
  studentIdInput.focus();
}

function closeStudentModal() {
  modalOverlay.classList.remove("open");
  modalError.textContent = "";
}

function setActiveTab(tabName) {
  activeTab = tabName;
  const isDaily = tabName === "daily";
  document.getElementById("tabDailyBtn").classList.toggle("active", isDaily);
  document.getElementById("tabHistoryBtn").classList.toggle("active", !isDaily);
  document.getElementById("dailySection").classList.toggle("hidden", !isDaily);
  document.getElementById("historySection").classList.toggle("hidden", isDaily);
  document.getElementById("dateField").classList.toggle("hidden", !isDaily);
  render();
}

function refreshSectionFilter() {
  const previousValue = sectionSelect.value;
  const sections = [];

  appData.students.forEach((student) => {
    if (!sections.includes(student.section)) {
      sections.push(student.section);
    }
  });
  sections.sort();

  sectionSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = "All Sections";
  sectionSelect.appendChild(allOption);

  sections.forEach((sec) => {
    const option = document.createElement("option");
    option.value = sec;
    option.textContent = sec;
    sectionSelect.appendChild(option);
  });

  if (sections.includes(previousValue)) {
    sectionSelect.value = previousValue;
  }
}

function getFilteredStudents() {
  const selectedSection = sectionSelect.value;
  const query = searchInput.value.trim().toLowerCase();

  return appData.students.filter((student) => {
    const matchesSection = selectedSection === "ALL" || student.section === selectedSection;
    const matchesQuery =
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query);
    return matchesSection && matchesQuery;
  });
}

function ensureDateRecord(dateStr) {
  if (!appData.records[dateStr]) {
    appData.records[dateStr] = {};
  }
  return appData.records[dateStr];
}

function handleAddStudent(event) {
  event.preventDefault();
  modalError.textContent = "";

  const id = studentIdInput.value.trim();
  const name = studentNameInput.value.trim();
  const section = studentSectionInput.value.trim();

  if (!id || !name || !section) {
    modalError.textContent = "Please complete all fields.";
    return;
  }

  const duplicate = appData.students.some((s) => s.id.toLowerCase() === id.toLowerCase());
  if (duplicate) {
    modalError.textContent = "A student with this ID already exists.";
    return;
  }

  appData.students.push({ id, name, section });
  saveAppData();
  refreshSectionFilter();

  if (sectionSelect.value !== "ALL" && sectionSelect.value !== section) {
    sectionSelect.value = "ALL";
  }

  render();
  studentForm.reset();
  closeStudentModal();
}

function removeStudent(studentId) {
  appData.students = appData.students.filter((s) => s.id !== studentId);
  Object.keys(appData.records).forEach((dateKey) => {
    delete appData.records[dateKey][studentId];
  });
  saveAppData();
  refreshSectionFilter();
  render();
}

function renderDailyView() {
  const dateStr = dateInput.value || getTodayISO();
  const dayRecords = appData.records[dateStr] || {};
  const students = getFilteredStudents();

  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  students.forEach((student) => {
    const status = dayRecords[student.id] ? dayRecords[student.id].status : "";
    if (status === "Present") present += 1;
    else if (status === "Late") late += 1;
    else if (status === "Absent") absent += 1;
    else if (status === "Excused") excused += 1;
  });

  const total = students.length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  document.getElementById("totalCount").textContent = String(total);
  document.getElementById("presentCount").textContent = String(present);
  document.getElementById("lateCount").textContent = String(late);
  document.getElementById("absentCount").textContent = String(absent);
  document.getElementById("excusedCount").textContent = String(excused);
  document.getElementById("rateValue").textContent = `${rate}%`;

  studentListEl.innerHTML = "";

  if (students.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "empty-box";
    emptyBox.textContent = "No students match the current filter. Click + Add Student to add one.";
    studentListEl.appendChild(emptyBox);
    return;
  }

  students.forEach((student) => {
    const currentRecord = dayRecords[student.id] || { status: "", remark: "" };

    const card = document.createElement("div");
    card.className = "student-card";

    const topRow = document.createElement("div");
    topRow.className = "student-top";

    const infoBox = document.createElement("div");
    const nameHeading = document.createElement("h3");
    nameHeading.className = "student-name";
    nameHeading.textContent = student.name;

    const metaRow = document.createElement("div");
    metaRow.className = "student-meta";

    const idText = document.createElement("span");
    idText.textContent = `ID: ${student.id}`;

    const badge = document.createElement("span");
    badge.className = "section-badge";
    badge.textContent = student.section;

    metaRow.appendChild(idText);
    metaRow.appendChild(badge);
    infoBox.appendChild(nameHeading);
    infoBox.appendChild(metaRow);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeStudent(student.id));

    topRow.appendChild(infoBox);
    topRow.appendChild(removeBtn);

    const statusGroup = document.createElement("div");
    statusGroup.className = "status-group";

    STATUS_OPTIONS.forEach((statusLabel) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isSelected = currentRecord.status === statusLabel;
      btn.className = `btn status-btn${isSelected ? ` active-${statusLabel}` : ""}`;
      btn.textContent = statusLabel;
      btn.addEventListener("click", () => {
        const recMap = ensureDateRecord(dateStr);
        if (!recMap[student.id]) {
          recMap[student.id] = { status: "", remark: "" };
        }
        recMap[student.id].status = recMap[student.id].status === statusLabel ? "" : statusLabel;
        saveAppData();
        render();
      });
      statusGroup.appendChild(btn);
    });

    const remarkInput = document.createElement("input");
    remarkInput.type = "text";
    remarkInput.className = "remark-input";
    remarkInput.placeholder = "Add remark or note...";
    remarkInput.value = currentRecord.remark || "";
    remarkInput.addEventListener("input", () => {
      const recMap = ensureDateRecord(dateStr);
      if (!recMap[student.id]) {
        recMap[student.id] = { status: "", remark: "" };
      }
      recMap[student.id].remark = remarkInput.value;
      saveAppData();
    });

    card.appendChild(topRow);
    card.appendChild(statusGroup);
    card.appendChild(remarkInput);
    studentListEl.appendChild(card);
  });
}

function renderHistoryView() {
  const students = getFilteredStudents();
  const recordedDates = Object.keys(appData.records);
  historyTableBody.innerHTML = "";

  if (students.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No students to display.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    historyTableBody.appendChild(tr);
    return;
  }

  students.forEach((student) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    recordedDates.forEach((dateKey) => {
      const entry = appData.records[dateKey] ? appData.records[dateKey][student.id] : null;
      const status = entry ? entry.status : "";
      if (status === "Present") present += 1;
      else if (status === "Late") late += 1;
      else if (status === "Absent") absent += 1;
      else if (status === "Excused") excused += 1;
    });

    const totalMarked = present + late + absent + excused;
    const rate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 0;

    const tr = document.createElement("tr");
    const columns = [student.id, student.name, student.section, present, late, absent, excused, `${rate}%`];

    columns.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = String(val);
      tr.appendChild(td);
    });

    historyTableBody.appendChild(tr);
  });
}

function render() {
  if (activeTab === "daily") {
    renderDailyView();
  } else {
    renderHistoryView();
  }
}

function markAllPresent() {
  const dateStr = dateInput.value || getTodayISO();
  const recMap = ensureDateRecord(dateStr);
  getFilteredStudents().forEach((student) => {
    if (!recMap[student.id]) {
      recMap[student.id] = { status: "Present", remark: "" };
    } else {
      recMap[student.id].status = "Present";
    }
  });
  saveAppData();
  render();
}

function resetDayAttendance() {
  const dateStr = dateInput.value || getTodayISO();
  if (appData.records[dateStr]) {
    getFilteredStudents().forEach((student) => {
      delete appData.records[dateStr][student.id];
    });
  }
  saveAppData();
  render();
}

function downloadCsvFile(filename, rows) {
  const csvText = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportDailyCsv() {
  const dateStr = dateInput.value || getTodayISO();
  const dayRecords = appData.records[dateStr] || {};
  const rows = [["Date", "Student ID", "Name", "Section", "Status", "Remark"]];

  getFilteredStudents().forEach((student) => {
    const rec = dayRecords[student.id] || {};
    rows.push([dateStr, student.id, student.name, student.section, rec.status || "Unmarked", rec.remark || ""]);
  });

  downloadCsvFile(`attendance_${dateStr}.csv`, rows);
}

function exportSummaryCsv() {
  const recordedDates = Object.keys(appData.records);
  const rows = [["Student ID", "Name", "Section", "Present", "Late", "Absent", "Excused", "Rate"]];

  getFilteredStudents().forEach((student) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    recordedDates.forEach((dateKey) => {
      const entry = appData.records[dateKey] ? appData.records[dateKey][student.id] : null;
      const status = entry ? entry.status : "";
      if (status === "Present") present += 1;
      else if (status === "Late") late += 1;
      else if (status === "Absent") absent += 1;
      else if (status === "Excused") excused += 1;
    });

    const totalMarked = present + late + absent + excused;
    const rate = totalMarked > 0 ? `${Math.round(((present + late) / totalMarked) * 100)}%` : "0%";
    rows.push([student.id, student.name, student.section, present, late, absent, excused, rate]);
  });

  downloadCsvFile(`attendance_summary_${getTodayISO()}.csv`, rows);
}

// Event Listeners
document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document.getElementById("openModalBtn").addEventListener("click", openStudentModal);
document.getElementById("closeModalBtn").addEventListener("click", closeStudentModal);
studentForm.addEventListener("submit", handleAddStudent);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeStudentModal();
  }
});

document.getElementById("tabDailyBtn").addEventListener("click", () => setActiveTab("daily"));
document.getElementById("tabHistoryBtn").addEventListener("click", () => setActiveTab("history"));

dateInput.value = getTodayISO();
dateInput.addEventListener("change", render);
document.getElementById("todayBtn").addEventListener("click", () => {
  dateInput.value = getTodayISO();
  render();
});

sectionSelect.addEventListener("change", render);
searchInput.addEventListener("input", render);

document.getElementById("markAllPresentBtn").addEventListener("click", markAllPresent);
document.getElementById("resetDayBtn").addEventListener("click", resetDayAttendance);
document.getElementById("exportDayBtn").addEventListener("click", exportDailyCsv);
document.getElementById("exportSummaryBtn").addEventListener("click", exportSummaryCsv);

// Initialize
applySavedTheme();
refreshSectionFilter();
render();