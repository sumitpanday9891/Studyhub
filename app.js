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
    !state.profile?.classId ||
    batch.classId === state.profile.classId
  );

  if ($("statBatches")) {
    $("statBatches").textContent = isAdmin()
      ? state.batches.length
      : myEnrollments().length;
  }

  if ($("statResources")) {
    $("statResources").textContent = state.resources.length;
  }

  if ($("statAttempts")) {
    $("statAttempts").textContent = state.attempts.length;
  }

  const scores = state.attempts.filter(
    x => Number.isFinite(Number(x.score))
  );

  if ($("statScore")) {
    $("statScore").textContent = scores.length
      ? Math.round(
          scores.reduce((sum, x) => sum + Number(x.score), 0) /
          scores.length
        ) + "%"
      : "—";
  }

  const cards = $("homeCards");
  if (!cards) return;

  cards.innerHTML = myBatches.slice(0, 6).map(batch => `
    <article>
      <h3>${escapeHTML(batch.name || "Batch")}</h3>
      <p>${escapeHTML(classTitle(batch.classId))}</p>
      <p>${escapeHTML(batch.teacher || "Teacher not assigned")}</p>
      <button data-open-batches>View batches</button>
    </article>
  `).join("") || "<p>No batches yet.</p>";

  cards.querySelectorAll("[data-open-batches]").forEach(button => {
    button.onclick = () => showView("batches");
  });

  if (state.resources.length) {
    cards.insertAdjacentHTML("beforeend", `
      <article>
        <h3>Learning resources</h3>
        ${state.resources.slice(0, 3).map(resource => `
          <p>
            <a href="${escapeHTML(safeURL(resource.url))}"
               target="_blank" rel="noopener">
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
    const matchesClass = !classId || batch.classId === classId;
    const text = `${batch.name || ""} ${batch.teacher || ""} ${classTitle(batch.classId)}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const allowed =
      isAdmin() ||
      !state.profile?.classId ||
      batch.classId === state.profile.classId ||
      isEnrolled(batch.id);

    return matchesClass && matchesSearch && allowed;
  });

  container.innerHTML = list.map(batch => `
    <article>
      <h3>${escapeHTML(batch.name || "Batch")}</h3>
      <p>Class: ${escapeHTML(classTitle(batch.classId))}</p>
      <p>Teacher: ${escapeHTML(batch.teacher || "Not assigned")}</p>

      ${
        isEnrolled(batch.id)
          ? '<span class="pill">Enrolled ✓</span>'
          : `<button data-enroll="${escapeHTML(batch.id)}">Enroll</button>`
      }

      <div>
        ${state.resources.filter(r => r.batchId === batch.id).map(r => `
          <p>
            📘 <a href="${escapeHTML(safeURL(r.url))}"
                  target="_blank" rel="noopener">
              ${escapeHTML(r.title || r.name || "Resource")}
            </a>
          </p>
        `).join("")}
      </div>

      <div>
        ${state.quizzes.filter(q => q.batchId === batch.id).map(q => `
          <p>
            📝 ${escapeHTML(q.title || "Quiz")}
            <button data-take-quiz="${escapeHTML(q.id)}">Take quiz</button>
          </p>
        `).join("")}
      </div>
    </article>
  `).join("") || "<p>No batches found.</p>";

  container.querySelectorAll("[data-enroll]").forEach(button => {
    button.onclick = () => enroll(button.dataset.enroll);
  });

  container.querySelectorAll("[data-take-quiz]").forEach(button => {
    button.onclick = () => takeQuiz(button.dataset.takeQuiz);
  });
}

async function enroll(batchId) {
  if (!state.user) return;
  if (isEnrolled(batchId)) return toast("Already enrolled.");

  try {
    const batch = state.batches.find(x => x.id === batchId);

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

function renderProgress() {
  const container = $("progressContent");
  if (!container) return;

  container.innerHTML = state.attempts.length
    ? state.attempts.map(item => `
      <div class="result">
        <b>${escapeHTML(item.score ?? 0)}%</b>
        <strong>${escapeHTML(item.quizTitle || "Quiz result")}</strong>
        <p>Score: ${escapeHTML(item.correct ?? "—")} / ${escapeHTML(item.total ?? "—")}</p>
        <p>Attempted: ${escapeHTML(dateText(item.createdAt))}</p>
      </div>
    `).join("")
    : "<p>No quiz attempts yet.</p>";
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
    ${state.classes.map(item => `
      <div class="item">
        <h4>${escapeHTML(item.name)}</h4>
        <button data-delete-class="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No classes created yet.</p>"}

    <h3>Batches</h3>
    ${state.batches.map(item => `
      <div class="item">
        <h4>${escapeHTML(item.name)}</h4>
        <p>${escapeHTML(classTitle(item.classId))}</p>
        <button data-delete-batch="${escapeHTML(item.id)}">Delete</button>
      </div>
    `).join("") || "<p>No batches created yet.</p>"}
  `;

  list.querySelectorAll("[data-delete-class]").forEach(button => {
    button.onclick = () => removeDocument("classes", button.dataset.deleteClass);
  });

  list.querySelectorAll("[data-delete-batch]").forEach(button => {
    button.onclick = () => removeDocument("batches", button.dataset.deleteBatch);
  });
}

function renderResourcesAdmin() {
  const list = $("resourceList");
  if (!list) return;

  list.innerHTML = state.resources.map(item => `
    <div class="item">
      <h4>${escapeHTML(item.title || item.name || "Resource")}</h4>
      <p>${escapeHTML(item.type || "material")} · ${escapeHTML(batchTitle(item.batchId))}</p>
      <a href="${escapeHTML(safeURL(item.url))}" target="_blank" rel="noopener">Open resource</a>
      <button data-delete-resource="${escapeHTML(item.id)}">Delete</button>
    </div>
  `).join("") || "<p>No resources added yet.</p>";

  list.querySelectorAll("[data-delete-resource]").forEach(button => {
    button.onclick = () => removeDocument("resources", button.dataset.deleteResource);
  });
}

function renderQuizAdmin() {
  const list = $("quizList");
  if (!list) return;

  list.innerHTML = state.quizzes.map(item => `
    <div class="item">
      <h4>${escapeHTML(item.title || "Quiz")}</h4>
      <p>${escapeHTML(classTitle(item.classId))} · ${escapeHTML(batchTitle(item.batchId))}</p>
      <button data-delete-quiz="${escapeHTML(item.id)}">Delete</button>
    </div>
  `).join("") || "<p>No quizzes created yet.</p>";

  list.querySelectorAll("[data-delete-quiz]").forEach(button => {
    button.onclick = () => removeDocument("quizzes", button.dataset.deleteQuiz);
  });
}

function renderReports() {
  const container = $("reportContent");
  if (!container) return;

  container.innerHTML = state.attempts.map(item => `
    <div class="item">
      <p>Student: ${escapeHTML(item.studentId || "")}</p>
      <p>Quiz: ${escapeHTML(item.quizTitle || "")}</p>
      <p>Score: ${escapeHTML(item.score ?? 0)}%</p>
      <p>Date: ${escapeHTML(dateText(item.createdAt))}</p>
    </div>
  `).join("") || "<p>No reports yet.</p>";
}

async function removeDocument(collectionName, id) {
  if (!confirm("Kya aap ise delete karna chahte hain?")) return;

  try {
    await deleteDoc(doc(db, collectionName, id));
    toast("Deleted successfully.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
}

/* LOGIN AND SIGNUP */
$("authForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  event.stopPropagation();

  const button = $("authButton");
  const email = $("email")?.value.trim().toLowerCase();
  const password = $("password")?.value;

  if (!email || !password) {
    toast("Email aur password bharein.");
    return;
  }

  setBusy(button, true, "");

  try {
    if (state.signup) {
      const name = $("name")?.value.trim() || "";
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (name) {
        await updateProfile(credential.user, { displayName: name });
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

$("toggle")?.addEventListener("click", () => {
  state.signup = !state.signup;

  $("nameLabel")?.classList.toggle("hide", !state.signup);
  $("name")?.toggleAttribute("required", state.signup);

  $("authTitle").textContent = state.signup
    ? "Create your account"
    : "Sign in to continue";

  $("authButton").textContent = state.signup
    ? "Create account →"
    : "Sign in →";

  $("toggle").textContent = state.signup
    ? "Already registered? Sign in"
    : "New student? Create an account";
});

$("reset")?.addEventListener("click", async () => {
  const email = $("email")?.value.trim();
  if (!email) return toast("Pehle email address bharein.");

  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email bhej diya gaya hai.");
  } catch (error) {
    toast(errorMessage(error));
  }
});

$("logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("Logged out.");
  } catch (error) {
    toast(errorMessage(error));
  }
});

$("classFilter")?.addEventListener("change", renderBatches);
$("search")?.addEventListener("input", renderBatches);

$("resourceClass")?.addEventListener("change", () => {
  updateBatchOptions("resourceClass", "resourceBatch");
});

$("quizClass")?.addEventListener("change", () => {
  updateBatchOptions("quizClass", "quizBatch");
});

$("profileForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    const name = $("profileName").value.trim();
    const classId = $("profileClass").value;

    await setDoc(doc(db, "users", state.user.uid), {
      uid: state.user.uid,
      email: state.user.email,
      name,
      classId
    }, { merge: true });

    state.profile = { ...state.profile, name, classId };
    toast("Profile saved.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});

$("classForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return toast("Admin access required.");

  try {
    await addDoc(collectionRef("classes"), {
      name: $("className").value.trim(),
      createdAt: serverTimestamp()
    });

    $("classForm").reset();
    toast("Class added.");
    await loadData();
  } catch (error) {
    toast(errorMessage(error));
  }
});

$("batchForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return toast("Admin access required.");

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

$("resourceForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return toast("Admin access required.");

  try {
    const title = $("resourceTitle").value.trim();

    await addDoc(collectionRef("resources"), {
      title,
      name: title,
      classId: $("resourceClass").value,
      batchId: $("resourceBatch").value,
      chaner.innerHTML = list.map(batch => `
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
onAuthStateChanged(auth, async (user) => {
  state.user = user;

  if (!user) {
    $("auth")?.classList.remove("hide");
    $("app")?.classList.add("hide");
    return;
  }

  // Login ke baad turant dashboard dikhao
  $("auth")?.classList.add("hide");
  $("app")?.classList.remove("hide");

  try {
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      state.profile = profileSnap.data();
    } else {
      state.profile = {
        name: user.email?.split("@")[0] || "Student",
        email: user.email || "",
        role: "student"
      };

      await setDoc(profileRef, {
        ...state.profile,
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    }

    await loadData();

  } catch (error) {
    console.error("Dashboard error:", error);
    toast("Dashboard data error: " + (error.message || error));
  }
});


// Show current year before login
if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}
