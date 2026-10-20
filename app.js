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
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
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
  el._timer = setTimeout(
    () => el.classList.remove("show"),
    4500
  );
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
  console.error("StudyHub error:", error);

  const messages = {
    "auth/invalid-credential": "Email ya password galat hai.",
    "auth/user-not-found": "Account nahi mila.",
    "auth/wrong-password": "Password galat hai.",
    "auth/email-already-in-use": "Email pehle se registered hai.",
    "auth/weak-password": "Password kam se kam 6 characters ka rakhein.",
    "auth/invalid-email": "Email address sahi nahi hai.",
    "auth/too-many-requests": "Bahut attempts hue. Baad mein try karein.",
    "auth/network-request-failed": "Internet connection check karein.",
    "permission-denied": "Firebase Firestore Rules mein permission error hai.",
    "unavailable": "Firebase connection check karein."
  };

  return messages[error?.code] ||
    error?.message ||
    "Kuch galat hua. Dobara try karein.";
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Please wait..." : label;
}

function classTitle(id) {
  return state.classes.find(x => x.id === id)?.name ||
    "Class not selected";
}

function batchTitle(id) {
  return state.batches.find(x => x.id === id)?.name || "Batch";
}

function myEnrollments() {
  return state.enrollments.filter(
    x => x.studentId === state.user?.uid
  );
}

function isEnrolled(batchId) {
  return myEnrollments().some(x => x.batchId === batchId);
}

function dateText(value) {
  try {
    if (!value) return "—";
    const date = value.toDate ? value.toDate() : new Date(value);
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
    items.map(item =>
      `<option value="${escapeHTML(item.id)}">${
        escapeHTML(item.name || item.title || "Untitled")
      }</option>`
    ).join("");

  if (items.some(item => item.id === previous)) {
    select.value = previous;
  }
}

function updateBatchOptions(classIdSelect, batchSelect) {
  const classId = $(classIdSelect)?.value || "";
  const batches = classId
    ? state.batches.filter(x => x.classId === classId)
    : state.batches;

  setOptions(batchSelect, batches, "Choose batch");
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
    if (!state.user) return [];

    let q;

    if (isAdmin()) {
      q = collectionRef(name);
    } else {
      q = query(
        collectionRef(name),
        where("studentId", "==", state.user.uid)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  }

  const snapshot = await getDocs(collectionRef(name));
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function loadData() {
  const results = await Promise.all([
    readCollection("classes"),
    readCollection("batches"),
    readCollection("resources"),
    readCollection("quizzes"),
    readCollection("enrollments"),
    readCollection("attempts")
  ]);

  [
    state.classes,
    state.batches,
    state.resources,
    state.quizzes,
    state.enrollments,
    state.attempts
  ] = results;

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

  if ($("greeting")) $("greeting").textContent = `Welcome, ${name}`;

  if ($("roleText")) {
    $("roleText").textContent = isAdmin()
      ? "Manage classes, learning resources and quizzes."
      : "Your learning space is ready.";
  }

  if ($("role")) {
    $("role").textContent = isAdmin() ? "ADMIN" : "STUDENT";
  }

  $("adminNav")?.classList.toggle("hide", !isAdmin());

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

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
function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.add("hide");
  });

  const target = $(viewName);
  if (target) target.classList.remove("hide");

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === viewName
    );
  });
}

function renderHome() {
  const classesCount = $("homeClasses");
  const resourcesCount = $("homeResources");
  const quizzesCount = $("homeQuizzes");
  const batchesCount = $("homeBatches");

  if (classesCount) classesCount.textContent = state.classes.length;
  if (resourcesCount) resourcesCount.textContent = state.resources.length;
  if (quizzesCount) quizzesCount.textContent = state.quizzes.length;
  if (batchesCount) batchesCount.textContent = state.batches.length;

  const container = $("recentResources");
  if (!container) return;

  const recent = [...state.resources].slice(0, 5);

  container.innerHTML = recent.length
    ? recent.map(resource => `
      <div class="resource-item">
        <h3>${escapeHTML(resource.title || "Learning resource")}</h3>
        <p>${escapeHTML(resource.description || "")}</p>
        ${resource.link
          ? `<a href="${safeURL(resource.link)}" target="_blank" rel="noopener">Open resource</a>`
          : ""}
      </div>
    `).join("")
    : "<p>No resources available yet.</p>";
}

function renderBatches() {
  const container = $("batchesList");
  if (!container) return;

  const selectedClass = $("classFilter")?.value || "";

  const batches = state.batches.filter(batch =>
    !selectedClass || batch.classId === selectedClass
  );

  container.innerHTML = batches.length
    ? batches.map(batch => `
      <article class="card">
        <h3>${escapeHTML(batch.name || batch.title || "Batch")}</h3>
        <p>${escapeHTML(batch.description || "")}</p>
        <p>Class: ${escapeHTML(classTitle(batch.classId))}</p>
        <p>Schedule: ${escapeHTML(batch.schedule || "Not specified")}</p>
        ${
          isEnrolled(batch.id)
            ? '<span class="badge">Enrolled</span>'
            : `<button type="button" data-enroll="${escapeHTML(batch.id)}">Enroll</button>`
        }
        ${
          batch.link
            ? `<a href="${safeURL(batch.link)}" target="_blank" rel="noopener">Open batch</a>`
            : ""
        }
        ${
          isAdmin()
            ? `<button type="button" data-delete-batch="${escapeHTML(batch.id)}">Delete</button>`
            : ""
        }
      </article>
    `).join("")
    : "<p>No batches available.</p>";
}

function renderProgress() {
  const container = $("progressList");
  if (!container) return;

  const attempts = state.attempts.filter(
    attempt => isAdmin() || attempt.studentId === state.user?.uid
  );

  container.innerHTML = attempts.length
    ? attempts.map(attempt => `
      <article class="card">
        <h3>${escapeHTML(attempt.quizTitle || "Quiz")}</h3>
        <p>Score: ${Number(attempt.score || 0)} / ${Number(attempt.total || 0)}</p>
        <p>Date: ${dateText(attempt.createdAt)}</p>
      </article>
    `).join("")
    : "<p>No quiz attempts yet.</p>";
}

function renderProfile() {
  const profile = state.profile || {};

  if ($("profileName")) $("profileName").value = profile.name || "";
  if ($("profileEmail")) $("profileEmail").value = state.user?.email || "";
  if ($("profilePhone")) $("profilePhone").value = profile.phone || "";
  if ($("profileClass")) $("profileClass").value = profile.classId || "";
}

function renderAdmin() {
  if (!isAdmin()) return;

  const classesList = $("adminClassesList");

  if (classesList) {
    classesList.innerHTML = state.classes.map(item => `
      <article class="card">
        <h3>${escapeHTML(item.name || item.title || "Class")}</h3>
        <p>${escapeHTML(item.description || "")}</p>
        <button type="button" data-delete-class="${escapeHTML(item.id)}">Delete</button>
      </article>
    `).join("");
  }

  const resourcesList = $("adminResourcesList");

  if (resourcesList) {
    resourcesList.innerHTML = state.resources.map(item => `
      <article class="card">
        <h3>${escapeHTML(item.title || "Resource")}</h3>
        <p>${escapeHTML(item.type || "Resource")}</p>
        <button type="button" data-delete-resource="${escapeHTML(item.id)}">Delete</button>
      </article>
    `).join("");
  }

  const quizzesList = $("adminQuizzesList");

  if (quizzesList) {
    quizzesList.innerHTML = state.quizzes.map(item => `
      <article class="card">
        <h3>${escapeHTML(item.title || "Quiz")}</h3>
        <p>${Number(item.questions?.length || 0)} questions</p>
        <button type="button" data-delete-quiz="${escapeHTML(item.id)}">Delete</button>
      </article>
    `).join("");
  }
}

async function refreshData() {
  try {
    await loadData();
    toast("Data refreshed successfully.");
  } catch (error) {
    errorMessage(error);
  }
}

async function enrollInBatch(batchId) {
  if (!state.user) {
    toast("Please log in first.");
    return;
  }

  if (isEnrolled(batchId)) {
    toast("You are already enrolled in this batch.");
    return;
  }

  try {
    await addDoc(collectionRef("enrollments"), {
      studentId: state.user.uid,
      studentEmail: state.user.email || "",
      batchId,
      createdAt: serverTimestamp()
    });

    toast("Enrollment successful!");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

async function deleteItem(collectionName, id) {
  if (!isAdmin()) {
    toast("Only the admin can delete items.");
    return;
  }

  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    await deleteDoc(doc(db, collectionName, id));
    toast("Item deleted successfully.");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

async function saveProfile(event) {
  event.preventDefault();

  if (!state.user) return;

  const name = $("profileName")?.value.trim() || "";
  const phone = $("profilePhone")?.value.trim() || "";
  const classId = $("profileClass")?.value || "";

  try {
    await setDoc(doc(db, "users", state.user.uid), {
      name,
      phone,
      classId,
      email: state.user.email || "",
      role: isAdmin() ? "admin" : "student",
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.profile = {
      ...state.profile,
      name,
      phone,
      classId
    };

    toast("Profile saved successfully.");
    renderShell();
    renderProfile();
  } catch (error) {
    errorMessage(error);
  }
          }
async function createClass(event) {
  event.preventDefault();

  if (!isAdmin()) {
    toast("Only admin can create classes.");
    return;
  }

  const name = $("className")?.value.trim() || "";
  const description = $("classDescription")?.value.trim() || "";

  if (!name) {
    toast("Please enter a class name.");
    return;
  }

  try {
    await addDoc(collectionRef("classes"), {
      name,
      description,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    event.target.reset();
    toast("Class created successfully.");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

async function createBatch(event) {
  event.preventDefault();

  if (!isAdmin()) {
    toast("Only admin can create batches.");
    return;
  }

  const name = $("batchName")?.value.trim() || "";
  const classId = $("batchClass")?.value || "";
  const description = $("batchDescription")?.value.trim() || "";
  const schedule = $("batchSchedule")?.value.trim() || "";
  const link = $("batchLink")?.value.trim() || "";

  if (!name || !classId) {
    toast("Please enter the batch name and select a class.");
    return;
  }

  try {
    await addDoc(collectionRef("batches"), {
      name,
      classId,
      description,
      schedule,
      link,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    event.target.reset();
    toast("Batch created successfully.");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

async function createResource(event) {
  event.preventDefault();

  if (!isAdmin()) {
    toast("Only admin can add resources.");
    return;
  }

  const title = $("resourceTitle")?.value.trim() || "";
  const type = $("resourceType")?.value || "Notes";
  const classId = $("resourceClass")?.value || "";
  const batchId = $("resourceBatch")?.value || "";
  const description = $("resourceDescription")?.value.trim() || "";
  const link = $("resourceLink")?.value.trim() || "";

  if (!title || !link) {
    toast("Please enter a title and resource link.");
    return;
  }

  if (safeURL(link) === "#") {
    toast("Please enter a valid HTTP or HTTPS link.");
    return;
  }

  try {
    await addDoc(collectionRef("resources"), {
      title,
      type,
      classId,
      batchId,
      description,
      link,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    event.target.reset();
    toast("Resource added successfully.");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

async function createQuiz(event) {
  event.preventDefault();

  if (!isAdmin()) {
    toast("Only admin can create quizzes.");
    return;
  }

  const title = $("quizTitle")?.value.trim() || "";
  const description = $("quizDescription")?.value.trim() || "";
  const classId = $("quizClass")?.value || "";
  const batchId = $("quizBatch")?.value || "";

  if (!title) {
    toast("Please enter a quiz title.");
    return;
  }

  const questions = Array.from(
    document.querySelectorAll(".quiz-question")
  ).map((item, index) => {
    const question = item.querySelector("[name='question']")?.value.trim() || "";
    const options = [
      item.querySelector("[name='optionA']")?.value.trim() || "",
      item.querySelector("[name='optionB']")?.value.trim() || "",
      item.querySelector("[name='optionC']")?.value.trim() || "",
      item.querySelector("[name='optionD']")?.value.trim() || ""
    ];
    const answer = item.querySelector("[name='answer']")?.value || "";

    return {
      index,
      question,
      options,
      answer
    };
  }).filter(item =>
    item.question &&
    item.options.every(Boolean) &&
    ["0", "1", "2", "3"].includes(String(item.answer))
  );

  if (!questions.length) {
    toast("Add at least one complete question with four options and an answer.");
    return;
  }

  try {
    await addDoc(collectionRef("quizzes"), {
      title,
      description,
      classId,
      batchId,
      questions,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    event.target.reset();

    const questionContainer = $("quizQuestions");
    if (questionContainer) questionContainer.innerHTML = "";

    state.questionCount = 0;
    toast("Quiz created successfully.");
    await refreshData();
  } catch (error) {
    errorMessage(error);
  }
}

function addQuizQuestion() {
  const container = $("quizQuestions");

  if (!container) {
    toast("Quiz question container not found.");
    return;
  }

  state.questionCount += 1;

  const number = state.questionCount;
  const item = document.createElement("div");

  item.className = "quiz-question card";

  item.innerHTML = `
    <h3>Question ${number}</h3>

    <label>
      Question
      <input name="question" type="text" required>
    </label>

    <label>Option A
      <input name="optionA" type="text" required>
    </label>

    <label>Option B
      <input name="optionB" type="text" required>
    </label>

    <label>Option C
      <input name="optionC" type="text" required>
    </label>

    <label>Option D
      <input name="optionD" type="text" required>
    </label>

    <label>Correct answer
      <select name="answer" required>
        <option value="">Choose answer</option>
        <option value="0">Option A</option>
        <option value="1">Option B</option>
        <option value="2">Option C</option>
        <option value="3">Option D</option>
      </select>
    </label>

    <button type="button" class="remove-question">Remove question</button>
  `;

  item.querySelector(".remove-question").addEventListener("click", () => {
    item.remove();
  });

  container.appendChild(item);
}

function openQuiz(quizId) {
  const quiz = state.quizzes.find(item => item.id === quizId);

  if (!quiz) {
    toast("Quiz not found.");
    return;
  }

  if (!Array.isArray(quiz.questions) || !quiz.questions.length) {
    toast("This quiz has no questions.");
    return;
  }

  const container = $("quizPlayer");
  if (!container) {
    toast("Quiz player container not found.");
    return;
  }

  const view = $("quizPlayerView");

  if (view) view.classList.remove("hide");

  container.innerHTML = `
    <h2>${escapeHTML(quiz.title || "Quiz")}</h2>
    <p>${escapeHTML(quiz.description || "")}</p>

    <form id="quizAttemptForm">
      ${quiz.questions.map((question, index) => `
        <fieldset class="card">
          <legend>
            ${index + 1}. ${escapeHTML(question.question || "")}
          </legend>

          ${(question.options || []).map((option, optionIndex) => `
            <label>
              <input
                type="radio"
                name="q${index}"
                value="${optionIndex}"
                required
              >
              ${escapeHTML(option)}
            </label>
          `).join("")}
        </fieldset>
      `).join("")}

      <button type="submit">Submit quiz</button>
      <button type="button" id="closeQuiz">Close</button>
    </form>
  `;

  $("closeQuiz")?.addEventListener("click", () => {
    if (view) view.classList.add("hide");
  });

  $("quizAttemptForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    let score = 0;

    quiz.questions.forEach((question, index) => {
      if (String(data.get(`q${index}`)) === String(question.answer)) {
        score += 1;
      }
    });

    try {
      await addDoc(collectionRef("attempts"), {
        studentId: state.user.uid,
        quizId: quiz.id,
        quizTitle: quiz.title || "Quiz",
        score,
        total: quiz.questions.length,
        createdAt: serverTimestamp()
      });

      toast(`Quiz submitted. Your score: ${score}/${quiz.questions.length}`);

      if (view) view.classList.add("hide");

      await refreshData();
    } catch (error) {
      errorMessage(error);
    }
  });
                 }
async function handleLogin(event) {
  event.preventDefault();

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";
  const button = $("authButton");

  if (!email || !password) {
    toast("Email aur password dono bharein.");
    return;
  }

  setBusy(button, true, "Login");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast("Login successful!");
  } catch (error) {
    errorMessage(error);
  } finally {
    setBusy(button, false, "Login");
  }
}

async function handleSignup(event) {
  event.preventDefault();

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";
  const name = $("name")?.value.trim() || "";

  if (!email || !password) {
    toast("Email aur password bharein.");
    return;
  }

  const button = $("authButton");
  setBusy(button, true, "Sign Up");

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (name) {
      await updateProfile(result.user, { displayName: name });
    }

    await setDoc(doc(db, "users", result.user.uid), {
      name: name || email.split("@")[0],
      email,
      role: email.toLowerCase() === ADMIN_EMAIL ? "admin" : "student",
      createdAt: serverTimestamp()
    });

    toast("Account created successfully!");
  } catch (error) {
    errorMessage(error);
  } finally {
    setBusy(button, false, "Sign Up");
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    toast("Logged out successfully.");
  } catch (error) {
    errorMessage(error);
  }
}

async function handlePasswordReset() {
  const email = $("email")?.value.trim() || "";

  if (!email) {
    toast("Pehle email address bharein.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email bhej diya gaya hai.");
  } catch (error) {
    errorMessage(error);
  }
}

function bindEvents() {
  const authForm = $("authForm");
  const signupButton = $("signupButton");
  const logoutButton = $("logout");
  const profileForm = $("profileForm");
  const classForm = $("classForm");
  const batchForm = $("batchForm");
  const resourceForm = $("resourceForm");
  const quizForm = $("quizForm");
  const addQuestionButton = $("addQuestion");
  const resetButton = $("forgotPassword");
  const refreshButton = $("refreshButton");
  const classFilter = $("classFilter");

  if (authForm) {
    authForm.addEventListener("submit", handleLogin);
  }

  if (signupButton) {
    signupButton.addEventListener("click", () => {
      state.signup = !state.signup;

      const button = $("authButton");
      if (button) {
        button.textContent = state.signup ? "Sign Up" : "Login";
      }

      const title = $("authTitle");
      if (title) {
        title.textContent = state.signup ? "Create Account" : "Login";
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  if (profileForm) {
    profileForm.addEventListener("submit", saveProfile);
  }

  if (classForm) {
    classForm.addEventListener("submit", createClass);
  }

  if (batchForm) {
    batchForm.addEventListener("submit", createBatch);
  }

  if (resourceForm) {
    resourceForm.addEventListener("submit", createResource);
  }

  if (quizForm) {
    quizForm.addEventListener("submit", createQuiz);
  }

  if (addQuestionButton) {
    addQuestionButton.addEventListener("click", addQuizQuestion);
  }

  if (resetButton) {
    resetButton.addEventListener("click", handlePasswordReset);
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", refreshData);
  }

  if (classFilter) {
    classFilter.addEventListener("change", renderBatches);
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.enroll) {
      enrollInBatch(target.dataset.enroll);
    }

    if (target.dataset.deleteClass) {
      deleteItem("classes", target.dataset.deleteClass);
    }

    if (target.dataset.deleteBatch) {
      deleteItem("batches", target.dataset.deleteBatch);
    }

    if (target.dataset.deleteResource) {
      deleteItem("resources", target.dataset.deleteResource);
    }

    if (target.dataset.deleteQuiz) {
      deleteItem("quizzes", target.dataset.deleteQuiz);
    }

    if (target.dataset.startQuiz) {
      openQuiz(target.dataset.startQuiz);
    }
  });
}

onAuthStateChanged(auth, async user => {
  state.user = user;

  if (!user) {
    state.profile = null;
    $("auth")?.classList.remove("hide");
    $("app")?.classList.add("hide");
    $("logout")?.classList.add("hide");
    return;
  }

  try {
    await loadProfile(user);
    await loadData();
    renderShell();

    $("auth")?.classList.add("hide");
    $("app")?.classList.remove("hide");
    $("logout")?.classList.remove("hide");
  } catch (error) {
    errorMessage(error);
  }
});

bindEvents();
