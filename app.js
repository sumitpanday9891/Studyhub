// ============================================
// STUDYHUB - FULL APP.JS
// Firebase Authentication + Firestore
// ============================================

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
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ============================================
// CONFIGURATION
// ============================================

const ADMIN = "sumitpandey9891@gmail.com";

const s = {
  user: null,
  profile: null,
  classes: [],
  batches: [],
  resources: [],
  quizzes: [],
  enrollments: [],
  attempts: [],
  signup: false
};

// ============================================
// HELPERS
// ============================================

const $ = id => document.getElementById(id);

function msg(text) {
  const el = $("toast");

  if (el) {
    el.textContent = text;
    el.classList.remove("hide");

    clearTimeout(el._timer);

    el._timer = setTimeout(() => {
      el.classList.add("hide");
    }, 5000);
  } else {
    alert(text);
  }
}

function err(e) {
  console.error("StudyHub error:", e);

  const messages = {
    "auth/invalid-credential": "Email ya password galat hai.",
    "auth/user-not-found": "Yeh account nahi mila.",
    "auth/wrong-password": "Password galat hai.",
    "auth/email-already-in-use": "Yeh email pehle se registered hai.",
    "auth/weak-password": "Password kam se kam 6 characters ka rakhein.",
    "auth/invalid-email": "Email address sahi nahi hai.",
    "auth/too-many-requests": "Bahut attempts hue. Kuch der baad try karein.",
    "permission-denied": "Firestore permission error. Rules check karein.",
    "unavailable": "Internet ya Firebase connection check karein."
  };

  return messages[e?.code] ||
    e?.message ||
    "Kuch galat hua. Dobara try karein.";
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function admin() {
  return s.user?.email?.toLowerCase() === ADMIN &&
    s.profile?.role === "admin";
}

function col(name) {
  return collection(db, name);
}

function busy(button, state, label = "") {
  if (!button) return;

  button.disabled = state;

  if (!state && label) {
    button.textContent = label;
  } else if (state) {
    button.textContent = "Please wait...";
  }
}

function className(id) {
  return s.classes.find(x => x.id === id)?.name || "No class";
}

function batchName(id) {
  return s.batches.find(x => x.id === id)?.name || "No batch";
}

function mine() {
  return s.enrollments.filter(
    x => x.studentId === s.user?.uid
  );
}

function enrolled(batchId) {
  return mine().some(x => x.batchId === batchId);
}

function date(value) {
  try {
    if (!value) return "—";

    const d = value.toDate
      ? value.toDate()
      : new Date(value);

    return d.toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

// ============================================
// AUTH FORM
// ============================================

if ($("authForm")) {
  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();

    const button = $("authButton");

    busy(button, true);

    try {
      const email = $("email").value.trim().toLowerCase();
      const password = $("password").value;

      if (!email || !password) {
        throw new Error("Email aur password bharein.");
      }

      if (s.signup) {
        const name = $("name")?.value.trim() || "";

        if (password.length < 6) {
          throw new Error("Password kam se kam 6 characters ka hona chahiye.");
        }

        // Admin account ko registration form se promote nahi karein.
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

        msg("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        msg("Login successful!");
      }
    } catch (e) {
      msg(err(e));
    } finally {
      busy(
        button,
        false,
        s.signup ? "Create account →" : "Sign in →"
      );
    }
  });
}

// ============================================
// SIGNUP / LOGIN TOGGLE
// ============================================

if ($("toggle")) {
  $("toggle").addEventListener("click", () => {
    s.signup = !s.signup;

    const name = $("name");
    const button = $("authButton");

    if (name) {
      name.classList.toggle("hide", !s.signup);
    }

    if (button) {
      button.textContent = s.signup
        ? "Create account →"
        : "Sign in →";
    }

    const title = document.querySelector("#auth h1");

    if (title) {
      title.textContent = s.signup
        ? "Create your account"
        : "Sign in to continue";
    }
  });
}

// ============================================
// PASSWORD RESET
// ============================================

if ($("reset")) {
  $("reset").addEventListener("click", async () => {
    const email = $("email")?.value.trim();

    if (!email) {
      msg("Pehle email address bharein.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      msg("Password reset email bhej diya gaya hai.");
    } catch (e) {
      msg(err(e));
    }
  });
}

// ============================================
// LOGOUT
// ============================================

if ($("logout")) {
  $("logout").addEventListener("click", async () => {
    try {
      await signOut(auth);
      msg("Logged out successfully.");
    } catch (e) {
      msg(err(e));
    }
  });
}

// ============================================
// FIRESTORE DATA LOADING
// ============================================

// Admin can read all documents.
// Students read only their own enrollments and attempts.
async function read(name) {
  let snapshot;

  if (
    name === "enrollments" ||
    name === "attempts"
  ) {
    if (admin()) {
      snapshot = await getDocs(col(name));
    } else {
      const q = query(
        col(name),
        where("studentId", "==", s.user.uid)
      );

      snapshot = await getDocs(q);
    }
  } else {
    snapshot = await getDocs(col(name));
  }

  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function load() {
  try {
    const [
      classes,
      batches,
      resources,
      quizzes,
      enrollments,
      attempts
    ] = await Promise.all([
      read("classes"),
      read("batches"),
      read("resources"),
      read("quizzes"),
      read("enrollments"),
      read("attempts")
    ]);

    s.classes = classes;
    s.batches = batches;
    s.resources = resources;
    s.quizzes = quizzes;
    s.enrollments = enrollments;
    s.attempts = attempts;

    options();
    shell();
    renderBatches();
    renderAdmin();
    renderProgress();

  } catch (e) {
    console.error("Load error:", e);

    msg(
      "Data load nahi hua: " +
      err(e)
    );
  }
}

// ============================================
// AUTH STATE
// ============================================

onAuthStateChanged(auth, async user => {
  if (!user) {
    s.user = null;
    s.profile = null;

    $("auth")?.classList.remove("hide");
    $("app")?.classList.add("hide");
    $("logout")?.classList.add("hide");

    return;
  }

  s.user = user;

  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      s.profile = snap.data();
    } else {
      // Never automatically grant admin privileges.
      s.profile = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email.split("@")[0],
        role: "student",
        classId: ""
      };

      await setDoc(ref, {
        ...s.profile,
        createdAt: serverTimestamp()
      });
    }

    $("auth")?.classList.add("hide");
    $("app")?.classList.remove("hide");
    $("logout")?.classList.remove("hide");

    await load();

  } catch (e) {
    console.error("Authentication/profile error:", e);

    msg(
      "Login hua, lekin profile ya data access mein problem hai: " +
      err(e)
    );
  }
});

// ============================================
// DROPDOWN OPTIONS
// ============================================

function opts(id, arr, placeholder, selected = "") {
  const el = $(id);

  if (!el) return;

  const old = selected || el.value;

  el.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    arr.map(x =>
      `<option value="${esc(x.id)}">${esc(x.name || "Untitled")}</option>`
    ).join("");

  if (arr.some(x => x.id === old)) {
    el.value = old;
  }
}

function options() {
  opts("classFilter", s.classes, "All classes");
  opts("profileClass", s.classes, "Choose class", s.profile?.classId);
  opts("batchClass", s.classes, "Choose class");
  opts("resourceClass", s.classes, "Choose class");
  opts("quizClass", s.classes, "Choose class");

  batchOpts("resourceClass", "resourceBatch");
  batchOpts("quizClass", "quizBatch");
}

function batchOpts(classSelectId, batchSelectId) {
  const classId = $(classSelectId)?.value;
  const list = classId
    ? s.batches.filter(x => x.classId === classId)
    : s.batches;

  opts(batchSelectId, list, "Choose batch");
}

$("resourceClass")?.addEventListener("change", () => {
  batchOpts("resourceClass", "resourceBatch");
});

$("quizClass")?.addEventListener("change", () => {
  batchOpts("quizClass", "quizBatch");
});

// ============================================
// NAVIGATION / APP SHELL
// ============================================

function shell() {
  const isAdmin = admin();

  document.querySelectorAll("[data-view]").forEach(button => {
    button.onclick = () => {
      const view = button.dataset.view;

      document.querySelectorAll(".view").forEach(el => {
        el.classList.add("hide");
      });

      $(view)?.classList.remove("hide");
    };

    if (button.dataset.admin === "true") {
      button.classList.toggle("hide", !isAdmin);
    }
  });

  $("admin")?.classList.toggle("hide", !isAdmin);

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  $("home")?.classList.remove("hide");
}

// ============================================
// BATCHES
// ============================================

function renderBatches() {
  const container = $("batchList");

  if (!container) return;

  const list = s.batches.filter(batch =>
    !batch.classId ||
    !s.profile?.classId ||
    batch.classId === s.profile.classId ||
    admin() ||
    enrolled(batch.id)
  );

  container.innerHTML = list.map(batch => `
    <article class="card">
      <h3>${esc(batch.name || "Untitled batch")}</h3>
      <p>${esc(className(batch.classId))}</p>
      <p>Teacher: ${esc(batch.teacher || "Not assigned")}</p>
      ${
        enrolled(batch.id)
          ? `<span>Enrolled ✓</span>`
          : `<button data-enroll="${esc(batch.id)}">Enroll</button>`
      }
    </article>
  `).join("") || "<p>No batches available yet.</p>";

  container.querySelectorAll("[data-enroll]").forEach(button => {
    button.onclick = async () => {
      if (!s.user) return;

      try {
        const batchId = button.dataset.enroll;

        if (enrolled(batchId)) {
          msg("You are already enrolled.");
          return;
        }

        await addDoc(col("enrollments"), {
          studentId: s.user.uid,
          batchId,
          classId: s.batches.find(x => x.id === batchId)?.classId || "",
          createdAt: serverTimestamp()
        });

        msg("Enrollment successful!");

        await load();

      } catch (e) {
        msg(err(e));
      }
    };
  });
}

// ============================================
// ADMIN DASHBOARD
// ============================================

function renderAdmin() {
  const container = $("structure");

  if (!container || !admin()) return;

  container.innerHTML = `
    <div class="card">
      <h3>Admin Dashboard</h3>
      <p>Total classes: ${s.classes.length}</p>
      <p>Total batches: ${s.batches.length}</p>
      <p>Total resources: ${s.resources.length}</p>
      <p>Total quizzes: ${s.quizzes.length}</p>
      <p>Total enrollments: ${s.enrollments.length}</p>
    </div>

    <div class="card">
      <h3>Add Class</h3>
      <form id="addClassForm">
        <input id="newClassName" placeholder="Class name" required>
        <button type="submit">Add class</button>
      </form>
    </div>

    <div class="card">
      <h3>Add Batch</h3>
      <form id="addBatchForm">
        <input id="newBatchName" placeholder="Batch name" required>
        <select id="newBatchClass" required>
          <option value="">Choose class</option>
          ${s.classes.map(x =>
            `<option value="${esc(x.id)}">${esc(x.name)}</option>`
          ).join("")}
        </select>
        <input id="newBatchTeacher" placeholder="Teacher name">
        <button type="submit">Add batch</button>
      </form>
    </div>

    <div class="card">
      <h3>Classes</h3>
      ${s.classes.map(x => `
        <div class="row">
          <span>${esc(x.name)}</span>
          <button data-delete-class="${esc(x.id)}">Delete</button>
        </div>
      `).join("") || "<p>No classes yet.</p>"}
    </div>

    <div class="card">
      <h3>Batches</h3>
      ${s.batches.map(x => `
        <div class="row">
          <span>${esc(x.name)} — ${esc(className(x.classId))}</span>
          <button data-delete-batch="${esc(x.id)}">Delete</button>
        </div>
      `).join("") || "<p>No batches yet.</p>"}
    </div>

    <div class="card">
      <h3>Add Resource</h3>
      <form id="addResourceForm">
        <input id="newResourceName" placeholder="Resource title" required>
        <select id="newResourceType">
          <option value="lecture">Lecture</option>
          <option value="notes">Notes</option>
          <option value="dpp">DPP</option>
          <option value="material">Study material</option>
        </select>
        <select id="newResourceClass">
          <option value="">Choose class</option>
          ${s.classes.map(x =>
            `<option value="${esc(x.id)}">${esc(x.name)}</option>`
          ).join("")}
        </select>
        <select id="newResourceBatch">
          <option value="">Choose batch</option>
          ${s.batches.map(x =>
            `<option value="${esc(x.id)}">${esc(x.name)}</option>`
          ).join("")}
        </select>
        <input id="newResourceUrl" type="url" placeholder="https://..." required>
        <button type="submit">Add resource</button>
      </form>
    </div>

    <div class="card">
      <h3>Resources</h3>
      ${s.resources.map(x => `
        <div class="row">
          <a href="${esc(x.url || "#")}" target="_blank" rel="noopener">
            ${esc(x.name || x.title || "Resource")}
          </a>
          <button data-delete-resource="${esc(x.id)}">Delete</button>
        </div>
      `).join("") || "<p>No resources yet.</p>"}
    </div>

    <div class="card">
      <h3>Add Quiz</h3>
      <form id="addQuizForm">
        <input id="newQuizTitle" placeholder="Quiz title" required>
        <input id="newQuizQuestion" placeholder="Question" required>
        <input id="quizOptionA" placeholder="Option A" required>
        <input id="quizOptionB" placeholder="Option B" required>
        <input id="quizOptionC" placeholder="Option C" required>
        <input id="quizOptionD" placeholder="Option D" required>
        <select id="quizCorrect">
          <option value="0">Correct: A</option>
          <option value="1">Correct: B</option>
          <option value="2">Correct: C</option>
          <option value="3">Correct: D</option>
        </select>
        <button type="submit">Add quiz</button>
      </form>
    </div>

    <div class="card">
      <h3>Quizzes</h3>
      ${s.quizzes.map(x => `
        <div class="row">
          <span>${esc(x.title || x.question || "Quiz")}</span>
          <button data-delete-quiz="${esc(x.id)}">Delete</button>
        </div>
      `).join("") || "<p>No quizzes yet.</p>"}
    </div>
  `;

  bindAdminForms(container);
}

// ============================================
// ADMIN FORM HANDLERS
// ============================================

function bindAdminForms(container) {
  if (!admin()) return;

  $("addClassForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const name = $("newClassName").value.trim();

      if (!name) return;

      await addDoc(col("classes"), {
        name,
        createdAt: serverTimestamp()
      });

      msg("Class added.");
      await load();

    } catch (e) {
      msg(err(e));
    }
  });

  $("addBatchForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      await addDoc(col("batches"), {
        name: $("newBatchName").value.trim(),
        classId: $("newBatchClass").value,
        teacher: $("newBatchTeacher").value.trim(),
        createdAt: serverTimestamp()
      });

      msg("Batch added.");
      await load();

    } catch (e) {
      msg(err(e));
    }
  });

  $("addResourceForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      await addDoc(col("resources"), {
        name: $("newResourceName").value.trim(),
        type: $("newResourceType").value,
        classId: $("newResourceClass").value,
        batchId: $("newResourceBatch").value,
        url: $("newResourceUrl").value.trim(),
        createdAt: serverTimestamp()
      });

      msg("Resource added.");
      await load();

    } catch (e) {
      msg(err(e));
    }
  });

  $("addQuizForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      await addDoc(col("quizzes"), {
        title: $("newQuizTitle").value.trim(),
        question: $("newQuizQuestion").value.trim(),
        options: [
          $("quizOptionA").value.trim(),
          $("quizOptionB").value.trim(),
          $("quizOptionC").value.trim(),
          $("quizOptionD").value.trim()
        ],
        correct: Number($("quizCorrect").value),
        createdAt: serverTimestamp()
      });

      msg("Quiz added.");
      await load();

    } catch (e) {
      msg(err(e));
    }
  });

  container.querySelectorAll("[data-delete-class]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this class?")) return;

      try {
        await deleteDoc(doc(db, "classes", button.dataset.deleteClass));
        msg("Class deleted.");
        await load();
      } catch (e) {
        msg(err(e));
      }
    };
  });

  container.querySelectorAll("[data-delete-batch]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this batch?")) return;

      try {
        await deleteDoc(doc(db, "batches", button.dataset.deleteBatch));
        msg("Batch deleted.");
        await load();
      } catch (e) {
        msg(err(e));
      }
    };
  });

  container.querySelectorAll("[data-delete-resource]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this resource?")) return;

      try {
        await deleteDoc(doc(db, "resources", button.dataset.deleteResource));
        msg("Resource deleted.");
        await 