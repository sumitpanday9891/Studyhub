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
}function renderProgress() {
  const container = $("progressContent");
  if (!container) return;

  const attempts = isAdmin()
    ? state.attempts
    : state.attempts.filter(item => item.studentId === state.user?.uid);

  container.innerHTML = attempts.length
    ? attempts.map(attempt => `
      <div class="result">
        <b>${escapeHTML(attempt.score ?? 0)}%</b>
        <strong>${escapeHTML(attempt.quizTitle || "Quiz result")}</strong>
        <p>Score: ${escapeHTML(attempt.correct ?? "—")} / ${escapeHTML(attempt.total ?? "—")}</p>
        <p>Attempted: ${escapeHTML(dateText(attempt.createdAt))}</p>
      </div>
    `).join("")
    : "<p>No quiz attempts yet. Complete a quiz to see your progress here.</p>";
}

function renderProfile() {
  if ($("profileName")) {
    $("profileName").value =
      state.profile?.name || state.user?.displayName || "";
  }

  if ($("profileClass")) {
    $("profileClass").value = state.profile?.classId || "";
  }

  if ($("profileEmail")) {
    $("profileEmail").textContent = state.user?.email || "";
  }
}

function renderAdmin() {
  $("admin")?.classList.toggle("hide", !isAdmin());

  if (!isAdmin()) return;

  renderStructureAdmin();
  renderResourcesAdmin();
  renderQuizAdmin();
  renderReports();
}

function renderStructureAdmin() {
  const list = $("structureList");
  if (!list) return;

  list.innerHTML = `
    <h3>Classes</h3>
    ${
      state.classes.map(item => `
        <div class="item">
          <div>
            <h4>${escapeHTML(item.name)}</h4>
          </div>
          <button data-delete-class="${escapeHTML(item.id)}">
            Delete
          </button>
        </div>
      `).join("") || "<p>No classes created yet.</p>"
    }

    <h3>Batches</h3>
    ${
      state.batches.map(item => `
        <div class="item">
          <div>
            <h4>${escapeHTML(item.name)}</h4>
            <p>
              ${escapeHTML(classTitle(item.classId))}
              · ${escapeHTML(item.teacher || "No teacher")}
            </p>
          </div>
          <button data-delete-batch="${escapeHTML(item.id)}">
            Delete
          </button>
        </div>
      `).join("") || "<p>No batches created yet.</p>"
    }
  `;

  list.querySelectorAll("[data-delete-class]").forEach(button => {
    button.onclick = () =>
      removeDocument("classes", button.dataset.deleteClass);
  });

  list.querySelectorAll("[data-delete-batch]").forEach(button => {
    button.onclick = () =>
      removeDocument("batches", button.dataset.deleteBatch);
  });
}

function renderResourcesAdmin() {
  const list = $("resourceList");
  if (!list) return;

  list.innerHTML = state.resources.map(item => `
    <div class="item">
      <div>
        <h4>${escapeHTML(item.title || item.name || "Resource")}</h4>
        <p>
          ${escapeHTML(item.type || "material")}
          · ${escapeHTML(classTitle(item.classId))}
          · ${escapeHTML(batchTitle(item.batchId))}
        </p>
        <a
          href="${escapeHTML(safeURL(item.url))}"
          target="_blank"
          rel="noopener"
        >Open resource</a>
      </div>
      <button data-delete-resource="${escapeHTML(item.id)}">
        Delete
      </button>
    </div>
  `).join("") || "<p>No resources added yet.</p>";

  list.querySelectorAll("[data-delete-resource]").forEach(button => {
    button.onclick = () =>
      removeDocument("resources", button.dataset.deleteResource);
  });
}

function renderQuizAdmin() {
  const list = $("quizList");
  if (!list) return;

  list.innerHTML = state.quizzes.map(item => `
    <div class="item">
      <div>
        <h4>${escapeHTML(item.title || "Quiz")}</h4>
        <p>
          ${escapeHTML(classTitle(item.classId))}
          · ${escapeHTML(batchTitle(item.batchId))}
          · ${escapeHTML(item.chapter || "")}
        </p>
      </div>
      <button data-delete-quiz="${escapeHTML(item.id)}">
        Delete
      </button>
    </div>
  `).join("") || "<p>No quizzes created yet.</p>";

  list.querySelectorAll("[data-delete-quiz]").forEach(button => {
    button.onclick = () =>
      removeDocument("quizzes", button.dataset.deleteQuiz);
  });
}

function renderReports() {
  const container = $("reportContent");
  if (!container) return;

  if (!isAdmin()) {
    container.textContent = "";
    return;
  }

  container.innerHTML = `
    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Quiz</th>
            <th>Score</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${
            state.attempts.map(item => `
              <tr>
                <td>${escapeHTML(item.studentId || "")}</td>
                <td>${escapeHTML(item.quizTitle || "")}</td>
                <td>${escapeHTML(item.score ?? 0)}%</td>
                <td>${escapeHTML(dateText(item.createdAt))}</td>
              </tr>
            `).join("")
          }
        </tbody>
      </table>
    </div>
    ${state.attempts.length ? "" : "<p>No reports yet.</p>"}
  `;
}

async function removeDocument(collectionName, id) {
  if (!confirm("Kya aap ise delete karna chahte hain?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, collectionName, id));
    toast("Deleted successfully.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
}// AUTHENTICATION: Login and Signup
$("authForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("authButton");
  setBusy(button, true);

  try {
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;

    if (!email || !password) {
      throw new Error("Email aur password bharein.");
    }

    if (state.signup) {
      const name = $("name")?.value.trim() || "";

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (name) {
        await updateProfile(credential.user, {
          displayName: name
        });
      }

      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        email,
        name: name || email.split("@")[0],
        role: "student",
        classId: "",
        createdAt: serverTimestamp()
      });

      toast("Account create ho gaya!");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Login successful!");
    }
  } catch (error) {
    toast(errorMessage(error));
  } finally {
    setBusy(
      button,
      false,
      state.signup ? "Create account →" : "Sign in →"
    );
  }
});


// Switch between Login and Signup
$("toggle")?.addEventListener("click", () => {
  state.signup = !state.signup;

  $("nameLabel")?.classList.toggle("hide", !state.signup);
  $("name")?.toggleAttribute("required", state.signup);

  if ($("authTitle")) {
    $("authTitle").textContent = state.signup
      ? "Create your account"
      : "Sign in to continue";
  }

  if ($("authButton")) {
    $("authButton").textContent = state.signup
      ? "Create account →"
      : "Sign in →";
  }

  if ($("toggle")) {
    $("toggle").textContent = state.signup
      ? "Already registered? Sign in"
      : "New student? Create an account";
  }
});


// Password Reset
$("reset")?.addEventListener("click", async () => {
  const email = $("email")?.value.trim();

  if (!email) {
    return toast("Pehle email address bharein.");
  }

  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email bhej diya gaya hai.");
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Logout
$("logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("Logged out.");
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Batch and Resource Filters
$("classFilter")?.addEventListener("change", renderBatches);
$("search")?.addEventListener("input", renderBatches);

$("resourceClass")?.addEventListener("change", () => {
  updateBatchOptions("resourceClass", "resourceBatch");
});

$("quizClass")?.addEventListener("change", () => {
  updateBatchOptions("quizClass", "quizBatch");
});


// Save Student Profile
$("profileForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    const name = $("profileName").value.trim();
    const classId = $("profileClass").value;

    await setDoc(
      doc(db, "users", state.user.uid),
      {
        name,
        classId,
        email: state.user.email,
        uid: state.user.uid
      },
      { merge: true }
    );

    state.profile = {
      ...state.profile,
      name,
      classId
    };

    toast("Profile saved.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Admin: Create Class
$("classForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin()) {
    return toast("Admin access required.");
  }

  try {
    const name = $("className").value.trim();
    if (!name) return;

    await addDoc(collectionRef("classes"), {
      name,
      createdAt: serverTimestamp()
    });

    $("classForm").reset();
    toast("Class added.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Admin: Create Batch
$("batchForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin()) {
    return toast("Admin access required.");
  }

  try {
    await addDoc(collectionRef("batches"), {
      name: $("batchName").value.trim(),
      classId: $("batchClass").value,
      teacher: $("teacher").value.trim(),
      createdAt: serverTimestamp()
    });

    $("batchForm").reset();
    toast("Batch added.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Admin: Add Learning Resource
$("resourceForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin()) {
    return toast("Admin access required.");
  }

  try {
    const title = $("resourceTitle").value.trim();

    await addDoc(collectionRef("resources"), {
      title,
      name: title,
      classId: $("resourceClass").value,
      batchId: $("resourceBatch").value,
      chapter: $("chapter").value.trim(),
      type: $("type").value,
      url: safeURL($("url").value.trim()),
      description: $("description").value.trim(),
      createdAt: serverTimestamp()
    });

    $("resourceForm").reset();
    toast("Resource saved.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Admin: Add Questions to Quiz
function addQuestionEditor() {
  const container = $("questions");
  if (!container) return;

  state.questionCount++;
  const index = state.questionCount;

  const block = document.createElement("div");
  block.className = "question";
  block.dataset.questionEditor = String(index);

  block.innerHTML = `
    <h4>Question ${index}</h4>

    <label>
      Question text
      <input data-qtext required>
    </label>

    <div class="twocol">
      <label>Option A<input data-option="0" required></label>
      <label>Option B<input data-option="1" required></label>
      <label>Option C<input data-option="2" required></label>
      <label>Option D<input data-option="3" required></label>
    </div>

    <label>
      Correct answer
      <select data-correct>
        <option value="0">A</option>
        <option value="1">B</option>
        <option value="2">C</option>
        <option value="3">D</option>
      </select>
    </label>

    <button type="button" data-remove-question>
      Remove question
    </button>
  `;

  block.querySelector("[data-remove-question]").onclick = () => {
    block.remove();
  };

  container.appendChild(block);
}

$("addQuestion")?.addEventListener("click", addQuestionEditor);


// Admin: Publish Quiz
$("quizForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin()) {
    return toast("Admin access required.");
  }

  const questionBlocks = [
    ...document.querySelectorAll("[data-question-editor]")
  ];

  if (!questionBlocks.length) {
    return toast("Kam se kam ek question add karein.");
  }

  try {
    const questions = questionBlocks.map(block => ({
      question: block.querySelector("[data-qtext]").value.trim(),
      options: [
        ...block.querySelectorAll("[data-option]")
      ].map(input => input.value.trim()),
      correct: Number(
        block.querySelector("[data-correct]").value
      )
    }));

    if (
      questions.some(q =>
        !q.question || q.options.some(option => !option)
      )
    ) {
      return toast("Har question aur uske 4 options bharein.");
    }

    await addDoc(collectionRef("quizzes"), {
      title: $("quizTitle").value.trim(),
      chapter: $("quizChapter").value.trim(),
      classId: $("quizClass").value,
      batchId: $("quizBatch").value,
      questions,
      createdAt: serverTimestamp()
    });

    $("quizForm").reset();
    $("questions").innerHTML = "";
    state.questionCount = 0;

    toast("Quiz publish ho gaya.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});


// Student: Take Quiz
async function takeQuiz(quizId) {
  const quiz = state.quizzes.find(item => item.id === quizId);

  if (!quiz) {
    return toast("Quiz nahi mila.");
  }

  const questions = Array.isArray(quiz.questions)
    ? quiz.questions
    : [];

  if (
    !questions.length &&
    quiz.question &&
    Array.isArray(quiz.options)
  ) {
    questions.push({
      question: quiz.question,
      options: quiz.options,
      correct: quiz.correct
    });
  }

  if (!questions.length) {
    return toast("Is quiz mein questions nahi hain.");
  }

  const answers = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = Array.isArray(q.options)
      ? q.options
      : [];

    const promptText =
      `${i + 1}. ${q.question}\n` +
      options.map((option, index) =>
        `${String.fromCharCode(65 + index)}. ${option}`
      ).join("\n") +
      "\n\nApna answer A, B, C ya D likhein:";

    const answer = prompt(promptText);

    if (answer === null) return;

    const index =
      answer.trim().toUpperCase().charCodeAt(0) - 65;

    if (index < 0 || index > 3 || !Number.isFinite(index)) {
      toast("Answer A, B, C ya D mein dein.");
      return;
    }

    answers.push(index);
  }

  const correct = questions.reduce(
    (sum, q, index) =>
      sum + (Number(q.correct) === answers[index] ? 1 : 0),
    0
  );

  const score = Math.round(
    correct / questions.length * 100
  );

  try {
    await addDoc(collectionRef("attempts"), {
      studentId: state.user.uid,
      quizId,
      quizTitle: quiz.title || "Quiz",
      answers,
      correct,
      total: questions.length,
      score,
      createdAt: serverTimestamp()
    });

    toast(`Quiz complete! Score: ${score}%`);

    await loadData();
    showView("progress");
  } catch (error) {
    toast(errorMessage(error));
  }
}


// Firebase Login State and Initial Data Loading
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
    const profileRef = doc(db, "users", user.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (profileSnapshot.exists()) {
      state.profile = profileSnapshot.data();
    } else {
      state.profile = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email.split("@")[0],
        role: "student",
        classId: ""
      };

      await setDoc(profileRef, {
        ...state.profile,
        createdAt: serverTimestamp()
      });
    }

    await loadData();
  } catch (error) {
    console.error("StudyHub initialization:", error);

    toast(
      "Login hua, lekin data load nahi hua: " +
      errorMessage(error)
    );
  }
});


// Show current year before login
if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}