/* =============================================
   DIGICA — script.js
   Firebase Auth + Firestore per-user data
   ============================================= */

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, updateProfile,
         GoogleAuthProvider, signInWithPopup }    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection,
         addDoc, getDocs, updateDoc,
         deleteDoc, onSnapshot, query,
         orderBy }                                from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ── Firebase init ── */
const firebaseConfig = {
  apiKey:            "AIzaSyBpVxGMz1eMMQIKh2AdR2W5dagAXqklMdQ",
  authDomain:        "digica-app.firebaseapp.com",
  projectId:         "digica-app",
  storageBucket:     "digica-app.firebasestorage.app",
  messagingSenderId: "446526518466",
  appId:             "1:446526518466:web:3f90623275e40fe17eb75b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── Google provider ── */
const googleProvider = new GoogleAuthProvider();

/* =============================================
   HELPERS
   ============================================= */

const $ = id => document.getElementById(id);

/* ── Firestore paths for current user ── */
let currentUser = null;
const txCol  = () => collection(db, "users", currentUser.uid, "transactions");
const crCol  = () => collection(db, "users", currentUser.uid, "credits");

/* =============================================
   AUTH SCREEN LOGIC
   ============================================= */

/* Toggle between login / signup panels */
$("showSignup").addEventListener("click", () => {
  $("loginPanel").style.display  = "none";
  $("signupPanel").style.display = "block";
});
$("showLogin").addEventListener("click", () => {
  $("signupPanel").style.display = "none";
  $("loginPanel").style.display  = "block";
});

/* ── Sign Up ── */
$("signupBtn").addEventListener("click", async () => {
  const name     = $("signupName").value.trim();
  const email    = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  // Clear errors
  ["signupName","signupEmail","signupPassword"].forEach(id => {
    $(id + "Err").textContent = "";
    $(id).classList.remove("error");
  });

  let ok = true;
  if (!name)            { showFieldErr("signupName",     "Enter your name.");        ok = false; }
  if (!email)           { showFieldErr("signupEmail",    "Enter your email.");       ok = false; }
  if (password.length < 6) { showFieldErr("signupPassword","Min 6 characters.");    ok = false; }
  if (!ok) return;

  try {
    $("signupBtn").textContent = "Creating…";
    $("signupBtn").disabled = true;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
  } catch (err) {
    showFieldErr("signupEmail", friendlyError(err.code));
    $("signupBtn").textContent = "Create Account";
    $("signupBtn").disabled = false;
  }
});

/* ── Login ── */
$("loginBtn").addEventListener("click", async () => {
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  ["loginEmail","loginPassword"].forEach(id => {
    $(id + "Err").textContent = "";
    $(id).classList.remove("error");
  });

  if (!email)    { showFieldErr("loginEmail",    "Enter your email.");    return; }
  if (!password) { showFieldErr("loginPassword", "Enter your password."); return; }

  try {
    $("loginBtn").textContent = "Signing in…";
    $("loginBtn").disabled = true;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showFieldErr("loginEmail", friendlyError(err.code));
    $("loginBtn").textContent = "Sign In";
    $("loginBtn").disabled = false;
  }
});

/* ── Google Sign-in (both panels) ── */
async function handleGoogleSignIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    toast(friendlyError(err.code), "error");
  }
}
$("googleLoginBtn") .addEventListener("click", handleGoogleSignIn);
$("googleSignupBtn").addEventListener("click", handleGoogleSignIn);

/* ── Logout ── */
$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

/* ── Error helpers ── */
function showFieldErr(id, msg) {
  $(id + "Err").textContent = msg;
  $(id).classList.add("error");
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":    "That email is already registered.",
    "auth/invalid-email":           "Please enter a valid email.",
    "auth/user-not-found":          "No account found with that email.",
    "auth/wrong-password":          "Incorrect password.",
    "auth/too-many-requests":       "Too many attempts. Try again later.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/popup-closed-by-user":    "Sign-in cancelled.",
    "auth/invalid-credential":      "Invalid email or password.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* =============================================
   AUTH STATE OBSERVER
   ============================================= */

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    $("authScreen").style.display = "none";
    $("appScreen").style.display  = "block";

    /* Show user initials in avatar */
    const name = user.displayName || user.email || "U";
    $("userAvatar").textContent = name[0].toUpperCase();

    /* Reset login btn text in case it was in loading state */
    $("loginBtn").textContent = "Sign In";
    $("loginBtn").disabled = false;

    initApp();          // boot the main app
  } else {
    currentUser = null;
    $("authScreen").style.display = "block";
    $("appScreen").style.display  = "none";
    stopListeners();    // clean up Firestore listeners
  }
});

/* =============================================
   MAIN APP
   ============================================= */

/* We keep Firestore listeners so we can unsubscribe on logout */
let unsubTx = null;
let unsubCr = null;

function stopListeners() {
  if (unsubTx) { unsubTx(); unsubTx = null; }
  if (unsubCr) { unsubCr  && unsubCr(); unsubCr = null; }
}

/* In-memory mirrors of Firestore data */
let transactions = [];
let credits      = [];

function initApp() {
  /* ---- Date defaults ---- */
  $("date").value       = today();
  $("creditDate").value = today();

  /* ---- Theme ---- */
  initTheme();

  /* ---- Real-time Firestore listeners ---- */
  unsubTx = onSnapshot(query(txCol(), orderBy("date", "desc")), snap => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  unsubCr = onSnapshot(query(crCol(), orderBy("date", "desc")), snap => {
    credits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

/* =============================================
   HELPERS (same as original)
   ============================================= */

const formatINR = n =>
  "₹\u202f" + Math.abs(n).toLocaleString("en-IN");

const today = () =>
  new Date().toISOString().split("T")[0];

const formatDate = str => {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* =============================================
   ANIMATED COUNTER
   ============================================= */

const timers = new WeakMap();
function animateTo(el, target, duration = 400) {
  if (!el) return;
  if (timers.has(el)) clearInterval(timers.get(el));
  const start = parseFloat(el.dataset.cur || 0) || 0;
  const steps = Math.ceil(duration / 16);
  const inc   = (target - start) / steps;
  let cur = start, count = 0;
  const t = setInterval(() => {
    count++;
    cur += inc;
    if (count >= steps) { cur = target; clearInterval(t); timers.delete(el); }
    el.dataset.cur = cur;
    el.textContent = formatINR(Math.round(cur));
  }, 16);
  timers.set(el, t);
}

/* =============================================
   TOAST
   ============================================= */

function toast(msg, type = "success") {
  const icons = { success: "✓", error: "✕", info: "i" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  $("toastContainer").appendChild(el);
  setTimeout(() => {
    el.classList.add("hide");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3000);
}

/* =============================================
   CONFIRM DIALOG
   ============================================= */

function confirmDialog(msg) {
  return new Promise(resolve => {
    $("confirmMsg").textContent = msg;
    $("confirmOverlay").classList.add("open");
    const close = result => {
      $("confirmOverlay").classList.remove("open");
      $("confirmOk").removeEventListener("click", onOk);
      $("confirmCancel").removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk     = () => close(true);
    const onCancel = () => close(false);
    $("confirmOk").addEventListener("click",     onOk,     { once: true });
    $("confirmCancel").addEventListener("click", onCancel, { once: true });
  });
}

/* =============================================
   THEME
   ============================================= */

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("toggleLabel").textContent = dark ? "Dark" : "Light";
}
function initTheme() {
  const saved = localStorage.getItem("theme");
  const sys   = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved ? saved === "dark" : sys);
}
$("themeToggle").addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  $("toggleLabel").textContent = dark ? "Dark" : "Light";
});

/* =============================================
   TABS
   ============================================= */

const tabBtns     = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

function activateTab(name) {
  tabBtns.forEach(b => {
    b.classList.toggle("active", b.dataset.tab === name);
    b.setAttribute("aria-selected", b.dataset.tab === name);
  });
  tabContents.forEach(c => c.classList.toggle("active", c.id === name));
}
tabBtns.forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
$("viewAllBtn").addEventListener("click", () => activateTab("transactions"));

/* =============================================
   FILTER
   ============================================= */

let activeFilter = "All";
$("accountFilter").addEventListener("change", () => {
  activeFilter = $("accountFilter").value;
  renderAll();
});
const filtered = arr =>
  activeFilter === "All" ? arr : arr.filter(i => i.account === activeFilter);

/* =============================================
   ENTRY BADGE HELPERS
   ============================================= */

const INCOME_TYPES = ["Income", "Sale"];
const isIncome  = t => INCOME_TYPES.includes(t.type);
const badgeClass = t => isIncome(t) ? "badge-income" : "badge-expense";
const amtClass   = t => isIncome(t) ? "amount-income" : "amount-expense";
const prefix     = t => isIncome(t) ? "+" : "−";
const INITIALS = { Income: "In", Expense: "Ex", Purchase: "Pu", Sale: "Sa" };
const initial  = t => INITIALS[t.type] || t.type[0];

/* =============================================
   RENDER DASHBOARD
   ============================================= */

function renderDashboard() {
  let income = 0, expense = 0, pending = 0, given = 0, received = 0;
  filtered(transactions).forEach(t => {
    isIncome(t) ? (income += t.amount) : (expense += t.amount);
  });
  filtered(credits).forEach(c => {
    given += c.amount;
    c.status === "Pending" ? (pending += c.amount) : (received += c.amount);
  });
  const net = income - expense;

  animateTo($("totalIncome"),   income);
  animateTo($("totalExpense"),  expense);
  animateTo($("pendingCredit"), pending);

  const nb = $("netBalance");
  animateTo(nb, Math.abs(net));
  nb.className = "balance-amount " + (net >= 0 ? "positive" : "negative");

  const hint = $("balanceHint");
  if (net > 0)       { hint.textContent = "You're in profit 🎉"; hint.className = "balance-sub positive"; }
  else if (net < 0)  { hint.textContent = "Expenses exceed income"; hint.className = "balance-sub negative"; }
  else               { hint.textContent = "–"; hint.className = "balance-sub"; }

  /* Recent list (last 5) */
  const recent = filtered(transactions).slice(0, 5);
  const rl = $("recentList");
  rl.innerHTML = "";
  $("recentEmpty").hidden = recent.length > 0;
  recent.forEach(t => rl.appendChild(buildTxItem(t, transactions.indexOf(t))));
}

/* =============================================
   BUILD TRANSACTION LIST ITEM
   ============================================= */

function buildTxItem(t, idx) {
  const li = document.createElement("li");
  li.className = "entry-item";
  li.innerHTML = `
    <div class="entry-left">
      <div class="entry-avatar ${badgeClass(t)}">${initial(t)}</div>
      <div class="entry-info">
        <span class="entry-title">${t.notes || t.type}</span>
        <span class="entry-sub">${t.account} · ${formatDate(t.date)}</span>
      </div>
    </div>
    <div class="entry-right">
      <span class="entry-amount ${amtClass(t)}">${prefix(t)} ${formatINR(t.amount)}</span>
      <button class="btn-icon btn-delete js-del-tx" data-id="${t.id}" aria-label="Delete">✕</button>
    </div>`;
  return li;
}

/* =============================================
   RENDER TRANSACTIONS
   ============================================= */

function renderTransactions() {
  const items = filtered(transactions);
  const tl = $("transactionList");
  tl.innerHTML = "";
  $("txEmpty").hidden = items.length > 0;
  items.forEach((t, i) => tl.appendChild(buildTxItem(t, i)));
}

/* =============================================
   RENDER CREDITS
   ============================================= */

function renderCredits() {
  const items = filtered(credits);
  const cl = $("creditList");
  cl.innerHTML = "";
  let given = 0, pending = 0, received = 0;
  credits.forEach(c => {
    given += c.amount;
    c.status === "Pending" ? (pending += c.amount) : (received += c.amount);
  });

  $("creditEmpty").hidden = items.length > 0;
  items.forEach(cr => {
    const li = document.createElement("li");
    li.className = "entry-item";
    li.innerHTML = `
      <div class="entry-left">
        <div class="entry-avatar ${cr.status === 'Paid' ? 'badge-income' : 'badge-pending'}">
          ${cr.customer[0].toUpperCase()}
        </div>
        <div class="entry-info">
          <span class="entry-title">${cr.customer}</span>
          <span class="entry-sub">${cr.account} · ${formatDate(cr.date)}
            <span class="status-tag ${cr.status === 'Paid' ? 'tag-paid' : 'tag-pending'}">${cr.status}</span>
          </span>
        </div>
      </div>
      <div class="entry-right">
        <span class="entry-amount amount-neutral">${formatINR(cr.amount)}</span>
        ${cr.status === "Pending"
          ? `<button class="btn-icon btn-paid js-mark-paid" data-id="${cr.id}" aria-label="Mark paid">Paid</button>`
          : ""}
        <button class="btn-icon btn-delete js-del-credit" data-id="${cr.id}" aria-label="Delete">✕</button>
      </div>`;
    cl.appendChild(li);
  });

  animateTo($("totalCredit"),      given);
  animateTo($("pendingCreditTab"), pending);
  animateTo($("receivedCredit"),   received);
}

/* =============================================
   RENDER ALL
   ============================================= */

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderCredits();
}

/* =============================================
   FORM VALIDATION
   ============================================= */

function clearErrors(ids) {
  ids.forEach(id => {
    const err = $(id + "Err"), inp = $(id);
    if (err) err.textContent = "";
    if (inp) inp.classList.remove("error");
  });
}
function setError(id, msg) {
  const err = $(id + "Err"), inp = $(id);
  if (err) err.textContent = msg;
  if (inp) inp.classList.add("error");
  return false;
}
function validate(rules) {
  let ok = true;
  rules.forEach(([id, cond, msg]) => { if (!cond) ok = setError(id, msg); });
  return ok;
}

/* =============================================
   ADD TRANSACTION (Firestore)
   ============================================= */

$("transactionForm").addEventListener("submit", async e => {
  e.preventDefault();
  clearErrors(["account", "type", "amount", "date"]);

  const account = $("account").value;
  const type    = $("type").value;
  const amount  = parseFloat($("amount").value);
  const date    = $("date").value;
  const notes   = $("notes").value.trim();

  if (!validate([
    ["account", account,    "Select an account."],
    ["type",    type,       "Select a type."],
    ["amount",  amount > 0, "Enter a valid amount."],
    ["date",    date,       "Select a date."],
  ])) return;

  try {
    await addDoc(txCol(), { account, type, amount, date, notes, createdAt: Date.now() });
    $("transactionForm").reset();
    $("date").value = today();
    closeModal($("transactionModal"));
    toast("Transaction added.");
  } catch (err) {
    toast("Failed to save. Check your connection.", "error");
  }
});

/* =============================================
   ADD CREDIT (Firestore)
   ============================================= */

$("creditForm").addEventListener("submit", async e => {
  e.preventDefault();
  clearErrors(["creditAccount", "customerName", "creditAmount", "creditDate"]);

  const account  = $("creditAccount").value;
  const customer = $("customerName").value.trim();
  const amount   = parseFloat($("creditAmount").value);
  const date     = $("creditDate").value;
  const notes    = $("creditNotes").value.trim();

  if (!validate([
    ["creditAccount",  account,    "Select an account."],
    ["customerName",   customer,   "Enter customer name."],
    ["creditAmount",   amount > 0, "Enter a valid amount."],
    ["creditDate",     date,       "Select a date."],
  ])) return;

  try {
    await addDoc(crCol(), { account, customer, amount, date, notes, status: "Pending", createdAt: Date.now() });
    $("creditForm").reset();
    $("creditDate").value = today();
    closeModal($("creditModal"));
    toast("Credit entry added.");
  } catch (err) {
    toast("Failed to save. Check your connection.", "error");
  }
});

/* =============================================
   EVENT DELEGATION — DELETE & MARK PAID (Firestore)
   ============================================= */

document.addEventListener("click", async e => {

  /* ── Delete transaction ── */
  if (e.target.classList.contains("js-del-tx")) {
    const id = e.target.dataset.id;
    if (!await confirmDialog("Delete this transaction?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "transactions", id));
      toast("Deleted.", "info");
    } catch { toast("Delete failed.", "error"); }
  }

  /* ── Delete credit ── */
  if (e.target.classList.contains("js-del-credit")) {
    const id = e.target.dataset.id;
    if (!await confirmDialog("Delete this credit entry?")) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "credits", id));
      toast("Deleted.", "info");
    } catch { toast("Delete failed.", "error"); }
  }

  /* ── Mark credit as paid ── */
  if (e.target.classList.contains("js-mark-paid")) {
    const id = e.target.dataset.id;
    const cr = credits.find(c => c.id === id);
    if (!cr) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "credits", id), { status: "Paid" });
      await addDoc(txCol(), {
        account:   cr.account,
        type:      "Income",
        amount:    cr.amount,
        date:      today(),
        notes:     `Credit received from ${cr.customer}`,
        createdAt: Date.now(),
      });
      toast(`₹${cr.amount.toLocaleString("en-IN")} received from ${cr.customer}.`);
    } catch { toast("Update failed.", "error"); }
  }
});

/* =============================================
   EXPORT CSV
   ============================================= */

$("exportBtn").addEventListener("click", () => {
  const data = filtered(transactions);
  if (!data.length) { toast("No transactions to export.", "error"); return; }

  const rows = [
    ["Account", "Date", "Type", "Amount", "Notes"],
    ...data.map(t => [t.account, t.date, t.type, t.amount, `"${(t.notes || "").replace(/"/g, '""')}"`]),
  ];
  const csv  = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `digica-${today()}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`${data.length} transaction${data.length > 1 ? "s" : ""} exported.`);
});

/* =============================================
   MODAL HELPERS
   ============================================= */

const slideDownStyle = document.createElement("style");
slideDownStyle.textContent = `@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }`;
document.head.appendChild(slideDownStyle);

function openModal(modal) {
  modal.classList.add("open");
  modal.style.display = "flex";
  setTimeout(() => { const f = modal.querySelector("select, input"); if (f) f.focus(); }, 80);
}
function closeModal(modal) {
  const mc = modal.querySelector(".modal-content");
  mc.style.animation = "slideDown 0.2s cubic-bezier(0.32, 0.72, 0, 1) both";
  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.remove("open");
    mc.style.animation = "";
  }, 190);
}

$("openTransactionBtn").addEventListener("click", () => openModal($("transactionModal")));
$("openCreditBtn")     .addEventListener("click", () => openModal($("creditModal")));
$("closeTransactionBtn") .addEventListener("click", () => closeModal($("transactionModal")));
$("closeTransactionBtn2").addEventListener("click", () => closeModal($("transactionModal")));
$("closeCreditBtn")      .addEventListener("click", () => closeModal($("creditModal")));
$("closeCreditBtn2")     .addEventListener("click", () => closeModal($("creditModal")));

[$("transactionModal"), $("creditModal")].forEach(m =>
  m.addEventListener("click", e => { if (e.target === m) closeModal(m); })
);

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if ($("transactionModal").classList.contains("open")) closeModal($("transactionModal"));
  if ($("creditModal").classList.contains("open"))      closeModal($("creditModal"));
});
