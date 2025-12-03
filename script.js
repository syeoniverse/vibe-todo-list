import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB98DmbWwsqeDEfsKperX3D8LrWXzL85R0",
  authDomain: "vibe-todo-58493.firebaseapp.com",
  projectId: "vibe-todo-58493",
  storageBucket: "vibe-todo-58493.firebasestorage.app",
  messagingSenderId: "681718765342",
  appId: "1:681718765342:web:aa733b2b4f501f18949b0f",
  measurementId: "G-Z3760HX1N5",
  databaseURL: "https://vibe-todo-58493-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const todosRef = ref(db, "todos");

const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const template = document.getElementById("todoItemTemplate");
const filterButtons = document.querySelectorAll(".filter-btn");
const moodToggle = document.getElementById("moodToggle");
const moodList = document.getElementById("moodList");
const moodValue = document.getElementById("moodValue");
const dateInput = document.getElementById("dateInput");
const moodField = document.querySelector(".mood-field");

const MOOD_PLACEHOLDER = "오늘의 기분을 알려주세요";
const DEFAULT_MOOD = "😀 행복해요";
const CLIENT_KEY = "vibe-todo-client-id";

let clientId = localStorage.getItem(CLIENT_KEY);
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_KEY, clientId);
}

let todos = [];
let currentFilter = "all";
let editingId = null;
let datePickerOpen = false;

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  addTodo(text);
  todoInput.value = "";
  todoInput.focus();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setFilter(btn.dataset.filter);
  });
});

// 한 번의 클릭만 처리하도록 moodField에서 전체 영역을 토글한다.
moodToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMood();
});
moodValue.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMood();
});
if (moodField) {
  moodField.addEventListener("click", (e) => {
    if (e.target.closest("#moodList")) return;
    toggleMood();
  });
}

moodList.addEventListener("click", (e) => {
  const target = e.target.closest("button[data-mood]");
  if (!target) return;
  const mood = (target.textContent || target.dataset.mood || "").trim();
  setMoodDisplay(mood);
  setMoodOpen(false);
});

document.addEventListener("click", (e) => {
  const inMoodArea = moodField ? moodField.contains(e.target) : false;
  if (moodList.classList.contains("open") && !inMoodArea) {
    setMoodOpen(false);
  }
});

if (dateInput) {
  const openPicker = () => {
    if (typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
    } else {
      dateInput.focus();
    }
  };
  dateInput.addEventListener("click", (e) => {
    if (datePickerOpen) {
      e.preventDefault();
      dateInput.blur();
      datePickerOpen = false;
      return;
    }
    openPicker();
    datePickerOpen = true;
  });
  dateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (datePickerOpen) {
        dateInput.blur();
        datePickerOpen = false;
      } else {
        openPicker();
        datePickerOpen = true;
      }
    }
  });

  dateInput.addEventListener("change", () => {
    datePickerOpen = false;
    render();
    syncMoodDisplayForDate();
  });
  dateInput.addEventListener("blur", () => {
    datePickerOpen = false;
  });
}

function setMoodOpen(state) {
  moodToggle.setAttribute("aria-expanded", String(state));
  if (state) {
    moodList.classList.add("open");
  } else {
    moodList.classList.remove("open");
  }
}

function setFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  render();
}

function toggleMood() {
  const expanded = moodToggle.getAttribute("aria-expanded") === "true";
  setMoodOpen(!expanded);
}

function setMoodDisplay(text) {
  const moodText = text && text !== MOOD_PLACEHOLDER ? text : MOOD_PLACEHOLDER;
  moodValue.textContent = moodText;
  if (moodText === MOOD_PLACEHOLDER) {
    moodValue.classList.remove("mood-selected");
  } else {
    moodValue.classList.add("mood-selected");
  }
}

const getTodoRef = (id) => ref(db, `todos/${id}`);

async function addTodo(text) {
  const dateValue = (dateInput && dateInput.value) || new Date().toISOString().slice(0, 10);
  const moodTextRaw = (moodValue && moodValue.textContent.trim()) || "";
  const moodToSave = !moodTextRaw || moodTextRaw === MOOD_PLACEHOLDER ? DEFAULT_MOOD : moodTextRaw;
  const newRef = push(todosRef);
  const payload = {
    text,
    done: false,
    date: dateValue,
    createdAt: Date.now(),
    ownerId: clientId,
    mood: moodToSave,
  };
  try {
    await set(newRef, payload);
  } catch (err) {
    console.error("Failed to add todo", err);
  }
}

async function updateTodo(id, text) {
  try {
    await update(getTodoRef(id), { text });
  } catch (err) {
    console.error("Failed to update todo", err);
  }
}

async function toggleTodo(id) {
  const target = todos.find((t) => t.id === id);
  if (!target) return;
  try {
    await update(getTodoRef(id), { done: !target.done });
  } catch (err) {
    console.error("Failed to toggle todo", err);
  }
}

async function deleteTodo(id) {
  try {
    await remove(getTodoRef(id));
  } catch (err) {
    console.error("Failed to delete todo", err);
  }
}

function startInlineEdit(id) {
  editingId = id;
  Array.from(todoList.children).forEach((li) => {
    if (li.dataset.id === id) {
      li.classList.add("editing");
      const input = li.querySelector(".edit-input");
      const currentText = li.querySelector(".text").textContent;
      input.value = currentText;
      input.focus();
      input.setSelectionRange(currentText.length, currentText.length);
    } else {
      li.classList.remove("editing");
    }
  });
}

function cancelInlineEdit() {
  editingId = null;
  Array.from(todoList.children).forEach((li) => li.classList.remove("editing"));
}

function render() {
  todoList.innerHTML = "";
  const selectedDate = (dateInput && dateInput.value) || "";
  const visible = todos.filter((todo) => {
    const statusOk =
      currentFilter === "done" ? todo.done : currentFilter === "todo" ? !todo.done : true;
    const dateOk = selectedDate ? todo.date === selectedDate : true;
    return statusOk && dateOk;
  });

  visible.forEach((todo) => {
    const clone = template.content.cloneNode(true);
    const li = clone.querySelector(".todo-item");
    li.dataset.id = todo.id;
    const textEl = clone.querySelector(".text");
    const editInput = clone.querySelector(".edit-input");
    const checkBtn = clone.querySelector(".check");
    const editBtn = clone.querySelector(".edit");
    const deleteBtn = clone.querySelector(".delete");
    const saveBtn = clone.querySelector(".save");
    const cancelBtn = clone.querySelector(".cancel");

    textEl.textContent = todo.text;
    editInput.value = todo.text;

    if (todo.done) {
      li.classList.add("completed");
      checkBtn.classList.add("checked");
    }

    checkBtn.addEventListener("click", () => toggleTodo(todo.id));
    editBtn.addEventListener("click", () => startInlineEdit(todo.id));
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));
    saveBtn.addEventListener("click", () => {
      const value = editInput.value.trim();
      if (!value) return editInput.focus();
      editingId = null;
      updateTodo(todo.id, value);
    });
    cancelBtn.addEventListener("click", () => cancelInlineEdit());

    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancelInlineEdit();
      }
    });

    todoList.appendChild(clone);
  });

  // keep editing state if filter didn't remove it
  if (editingId) {
    const li = todoList.querySelector(`[data-id="${editingId}"]`);
    if (li) li.classList.add("editing");
    else editingId = null;
  }
}

// Realtime listener to sync with Firebase
onValue(todosRef, (snapshot) => {
  const data = snapshot.val();
  todos = data
    ? Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .filter((todo) => todo.ownerId === clientId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];
  render();
  syncMoodDisplayForDate();
});

function getMoodForDate(date) {
  if (!date) return null;
  const match = todos
    .filter((t) => t.date === date && t.mood)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return match ? match.mood : null;
}

function syncMoodDisplayForDate() {
  const selectedDate = (dateInput && dateInput.value) || "";
  if (!selectedDate) return;
  const mood = getMoodForDate(selectedDate);
  if (mood) {
    setMoodDisplay(mood);
  } else {
    setMoodDisplay(MOOD_PLACEHOLDER);
  }
}

// initialize mood placeholder
setMoodDisplay(MOOD_PLACEHOLDER);
