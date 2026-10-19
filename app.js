// STUDYHUB — Complete app.js
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const ADMIN_EMAIL = "sumitpandey9891@gmail.com";
const $ = id => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  classes: [],
  batches: [],
  resources: [],
  quizzes: [],
  enrollments: [],
  attempts: [],
  signup: false,
  questionCount: 0
};

const collectionRef = name => collection(db, name);

const isAdmin = () =>
  state.user?.email?.toLowerCase() === ADMIN_EMAIL;

function toast(message) {
  const el = $("toast");

  if (!el) {
    alert(message);
    return;
  }

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(el._timer);

  el._timer = setTimeout(() => {
    el.classList.remove("show");
  }, 4500);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function errorMessage(error) {
  console.error("StudyHub:", error);

  const messages = {
    "auth/invalid-credential": "Email ya password galat hai.",
    "auth/user-not-found": "Is email se account nahi mila.",
    "auth/wrong-password": "Password galat hai.",
    "auth/email-already-in-use": "Yeh email pehle se registered hai.",
    "auth/weak-password": "Password kam se kam 6 characters ka rakhein.",
    "auth/invalid-email": "Email address sahi nahi hai.",
    "auth/too-many-requests": "Bahut attempts hue. Kuch der baad try karein.",
    "auth/network-request-failed": "Internet connection check karein.",
    "permission-denied": "Firestore permission error. Firebase Rules check karein.",
    "unavailable": "Firebase connection check karein."
  };

  return messages[error?.code] ||
    error?.message ||
    "Kuch galat hua. Dobara try karein.";
}

function setBusy(button, busy, label) {
  if (!button) return;

  button.disabled = busy;

  if (busy) {
    button.textContent = "Please wait...";
  } else if (label) {
    button.textContent = label;
  }
}

function classTitle(id) {
  return state.classes.find(item => item.id === id)?.name ||
    "Class not selected";
}

function batchTitle(id) {
  return state.batches.find(item => item.id === id)?.name ||
    "Batch";
}

function myEnrollments() {
  return state.enrollments.filter(
    item => item.studentId === state.user?.uid
  );
}

function isEnrolled(batchId) {
  return myEnrollments().some(
    item => item.batchId === batchId
  );
}

function dateText(value) {
  try {
    if (!value) return "—";

    const date = value.toDate
      ? value.toDate()
      : new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

function safeURL(value = "") {
  try {
    const url = new URL(value);

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "#";
  } catch {
    return "#";
  }
}

function setOptions(id, items, placeholder, selected = "") {
  const select = $(id);

  if (!select) return;

  const previous = selected || select.value;

  select.innerHTML =
    `<option value="">${escapeHTML(placeholder)}</option>` +
    items.map(item => `
      <option value="${escapeHTML(item.id)}">
        ${escapeHTML(item.name || item.title || "Untitled")}
      </option>
    `).join("");

  if (items.some(item => item.id === previous)) {
    select.value = previous;
  }
}

function updateBatchOptions(classSelectId, batchSelectId) {
  const classId = $(classSelectId)?.value || "";

  const batches = classId
    ? state.batches.filter(item => item.classId === classId)
    : state.batches;

  setOptions(batchSelectId, batches, "Choose batch");
}

function fillOptions() {
  setOptions("classFilter", state.classes, "All classes");

  setOptions(
    "profileClass",
    state.classes,
    "Choose class",
    state.profile?.classId || ""
  );

  setOptions("batchClass", state.classes, "Choose class");
  setOptions("resourceClass", state.classes, "Choose class");
  setOptions("quizClass", state.classes, "Choose class");

  updateBatchOptions("resourceClass", "resourceBatch");
  updateBatchOptions("quizClass", "quizBatch");
}

async function readCollection(name) {
  if (name === "enrollments" || name === "attempts") {
    if (isAdmin()) {
      const snapshot = await getDocs(collectionRef(name));

      return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));
    }

    if (!state.user) return [];

    const ownQuery = query(
      collectionRef(name),
      where("studentId", "==", state.user.uid)
    );

    const snapshot = await getDocs(ownQuery);

    return snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));
  }

  const snapshot = await getDocs(collectionRef(name));

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadData() {
  const [
    classes,
    batches,
    resources,
    quizzes,
    enrollments,
    attempts
  ] = await Promise.all([
    readCollection("classes"),
    readCollection("batches"),
    readCollection("resources"),
    readCollection("quizzes"),
    readCollection("enrollments"),
    readCollection("attempts")
  ]);

  state.classes = classes;
  state.batches = batches;
  state.resources = resources;
  state.quizzes = quizzes;
  state.enrollments = enrollments;
  state.attempts = attempts;

  fillOptions();
  renderShell();
  renderHome();
  renderBatches();
  renderProgress();
  renderProfile();
  renderAdmin();
}

function renderShell() {
  $("auth")?.classList.add("hide");
  $("app")?.classList.remove("hide");
  $("logout")?.classList.remove("hide");

  const name =
    state.profile?.name ||
    state.user?.displayName ||
    state.user?.email?.split("@")[0] ||
    "Student";

  $("greeting").textContent = `Welcome, ${name}`;

  $("roleText").textContent = isAdmin()
    ? "Manage classes, learning resources and quizzes."
    : "Your learning space is ready.";

  $("role").textContent = isAdmin() ? "ADMIN" : "STUDENT";

  $("adminNav")?.classList.toggle("hide", !isAdmin());

  $("year").textContent = new Date().getFullYear();

  document.querySelectorAll("[data-view]").forEach(button => {
    button.onclick = () => showView(button.dataset.view);
  });

  document.querySelectorAll("[data-admin]").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll(".adminview").forEach(view => {
        view.classList.add("hide");
      });

      $(button.dataset.admin)?.classList.remove("hide");

      document.querySelectorAll("[data-admin]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
    };
  });

  showView("home");
}

function showView(id) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.add("hide");
  });

  $(id)?.classList.remove("hide");

  document.querySelectorAll("nav [data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === id);
  });
}

function renderHome() {
  const myBatches = state.batches.filter(batch =>
    isAdmin() ||
    isEnrolled(batch.id) ||
    (!state.profile?.classId ||
      batch.classId === state.profile.classId)
  );

  $("statBatches").textContent = isAdmin()
    ? state.batches.length
    : myEnrollments().length;

  $("statResources").textContent = state.resources.length;
  $("statAttempts").textContent = state.attempts.length;

  const scoreList = state.attempts.filter(
    item => Number.isFinite(Number(item.score))
  );

  $("statScore").textContent = scoreList.length
    ? `${Math.round(
        scoreList.reduce(
          (sum, item) => sum + Number(item.score),
          0
        ) / scoreList.length
      )}%`
    : "—";

  const cards = $("homeCards");

  if (cards) {
    cards.innerHTML = myBatches.slice(0, 6).map(batch => `
      <article>
        <h3>${escapeHTML(batch.name || "Batch")}</h3>
        <p>
          ${escapeHTML(classTitle(batch.classId))}
          · ${escapeHTML(batch.teacher || "Teacher not assigned")}
        </p>
        <button data-open-batches>View batches</button>
      </article>
    `).join("") ||
      "<p>No batches yet. Open Batches to explore available classes.</p>";

    cards.querySelectorAll("[data-open-batches]").forEach(button => {
      button.onclick = () => showView("batches");
    });
  }

  if (cards && state.resources.length) {
    cards.insertAdjacentHTML("beforeend", `
      <article>
        <h3>Latest learning resources</h3>
        ${state.resources.slice(0, 3).map(resource => `
          <p>
            <a
              href="${escapeHTML(safeURL(resource.url))}"
              target="_blank"
              rel="noopener"
            >
              ${escapeHTML(resource.title || resource.name || "Open resource")}
            </a>
          </p>
        `).join("")}
      </article>
    `);
  }
}

function renderBatches() {
  const container = $("batchCards");

  if (!container) return;

  const classId = $("classFilter")?.value || "";
  const search = ($("search")?.value || "").trim().toLowerCase();

  const list = state.batches.filter(batch => {
    const classMatches =
      !classId || batch.classId === classId;

    const searchMatches =
      !search ||
      `${batch.name || ""} ${batch.teacher || ""} ${classTitle(batch.classId)}`
        .toLowerCase()
        .includes(search);

    const access =
      isAdmin() ||
      !state.profile?.classId ||
      batch.classId === state.profile.classId ||
      isEnrolled(batch.id);

    return classMatches && searchMatches && access;
  });

  container.innerHTML = list.map(batch => `
    <article>
      <h3>${escapeHTML(batch.name || "Untitled batch")}</h3>
      <p>Class: ${escapeHTML(classTitle(batch.classId))}</p>
      <p>Teacher: ${escapeHTML(batch.teacher || "Not assigned")}</p>

      ${
        isEnrolled(batch.id)
          ? '<span class="pill">Enrolled ✓</span>'
          : `<button data-enroll="${escapeHTML(batch.id)}">Enroll</button>`
      }

      <div>
        ${state.resources
          .filter(resource => resource.batchId === batch.id)
          .map(resource => `
            <p>
              📘
              <a
                href="${escapeHTML(safeURL(resource.url))}"
                target="_blank"
                rel="noopener"
              >
                ${escapeHTML(resource.title || resource.name || "Learning resource")}
              </a>
              <small>${escapeHTML(resource.type || "material")}</small>
            </p>
          `).join("")}
      </div>

      <div>
        ${state.quizzes
          .filter(quiz => quiz.batchId === batch.id)
          .map(quiz => `
            <p>
              📝 ${escapeHTML(quiz.title || "Quiz")}
              <button data-take-quiz="${escapeHTML(quiz.id)}">
                Take quiz
              </button>
            </p>
          `).join("")}
      </div>
    </article>
  `).join("") ||
    "<p>No batches found. Try another filter or ask the admin to add a batch.</p>";

  container.querySelectorAll("[data-enroll]").forEach(button => {
    button.onclick = () => enroll(button.dataset.enroll);
  });

  container.querySelectorAll("[data-take-quiz]").forEach(button => {
    button.onclick = () => takeQuiz(button.dataset.takeQuiz);
  });
}

async function enroll(batchId) {
  if (!state.user) return;

  if (isEnrolled(batchId)) {
    return toast("You are already enrolled.");
  }

  try {
    const batch = state.batches.find(item => item.id === batchId);

    await addDoc(collectionRef("enrollments"), {
      studentId: state.user.uid,
      batchId,
      classId: batch?.classId || "",
      createdAt: serverTimestamp()
    });

    toast("Enrollment successful!");

    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
}