import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUSU-9GqLcy6MqheWGNbEqBpTke-vQXv0",
  authDomain: "how-long-till-rewatch.firebaseapp.com",
  projectId: "how-long-till-rewatch",
  storageBucket: "how-long-till-rewatch.firebasestorage.app",
  messagingSenderId: "1056654588618",
  appId: "1:1056654588618:web:f54977c3fc9a36f7e91233",
  measurementId: "G-2LM237N5SF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

getRedirectResult(auth).catch((error) => {
  console.error("Redirect sign-in failed:", error.code, error.message);
});

// Known in-app browsers that block popups. Update this list as needed.
const IN_APP_BROWSER_RE = /Telegram|FBAN|FBAV|Instagram|Line|Twitter/i;

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  return IN_APP_BROWSER_RE.test(navigator.userAgent);
}

function shouldUseRedirect() {
  // Use redirect for Android (works reliably) and non-iOS in-app browsers where
  // popups are blocked. iOS is excluded because ITP partitions sessionStorage,
  // breaking redirect-based auth entirely.
  return !isIOS() && (/Android/i.test(navigator.userAgent) || isInAppBrowser());
}

function signIn() {
  // iOS in-app browsers (e.g. Telegram, Instagram) partition sessionStorage so
  // neither signInWithRedirect nor signInWithPopup can complete the OAuth flow.
  // Ask the user to open the page in Safari instead.
  if (isIOS() && isInAppBrowser()) {
    const msg = document.getElementById("open-in-safari-msg");
    if (msg) msg.style.display = "block";
    return;
  }

  if (shouldUseRedirect()) {
    return signInWithRedirect(auth, provider);
  }

  return signInWithPopup(auth, provider);
}

const signedOut = document.getElementById("signed-out");
const signedIn = document.getElementById("signed-in");
const userEl = document.getElementById("user");
const loginButton = document.getElementById("login");
const loginButton2 = document.getElementById("login2");
const logoutButton = document.getElementById("logout");
const form = document.getElementById("add-form");
const list = document.getElementById("list");

loginButton.onclick = signIn;

if (loginButton2) {
  loginButton2.onclick = signIn;
}

logoutButton.onclick = () => {
  signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    userEl.textContent = user.email;
    signedIn.style.display = "block";
    signedOut.style.display = "none";

    loginButton.style.display = "none";
    logoutButton.style.display = "inline-block";

    loadRewatches(user);
  } else {
    signedIn.style.display = "none";
    signedOut.style.display = "block";
    userEl.textContent = "";
    list.innerHTML = "";

    loginButton.style.display = "inline-block";
    logoutButton.style.display = "none";

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }
});

form.onsubmit = async (e) => {
  e.preventDefault();

  const user = auth.currentUser;

  if (!user) {
    return;
  }

  const title = document.getElementById("title").value.trim();
  const wait = parseInt(document.getElementById("wait").value, 10);
  const unit = document.getElementById("unit").value;

  if (!title || Number.isNaN(wait)) {
    return;
  }

  const nextDate = new Date();

  if (unit === "years") {
    nextDate.setFullYear(nextDate.getFullYear() + wait);
  } else {
    nextDate.setMonth(nextDate.getMonth() + wait);
  }

  const iso = nextDate.toISOString();

  await addDoc(
    collection(db, "users", user.uid, "rewatches"),
    {
      title,
      wait,
      unit,
      nextDate: iso,
      nextDateDay: iso.slice(0, 10),
      createdAt: new Date().toISOString(),
      notified: false,
      remindersEnabled: true,
      lastNotifiedAt: null
    }
  );

  form.reset();
  document.getElementById("wait").value = "3";
};

let unsubscribe = null;

function loadRewatches(user) {
  if (unsubscribe) {
    unsubscribe();
  }

  const q = query(
    collection(db, "users", user.uid, "rewatches"),
    orderBy("nextDateDay"),
    orderBy("title")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `
        <li style="text-align:center; color: var(--muted);">
          No rewatches yet.<br>
          Add your first comfort show above ☝️
        </li>
      `;
      return;
    }

    const ready = [];
    const upcoming = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const next = new Date(data.nextDate);

      if (next <= new Date()) {
        ready.push({ id: doc.id, ...data });
      } else {
        upcoming.push({ id: doc.id, ...data });
      }
    });

    if (ready.length) {
      const header = document.createElement("li");
      header.innerHTML = "<strong>Ready to watch</strong>";
      list.appendChild(header);

      ready.forEach(item => renderItem(user, item));
    }

    if (upcoming.length) {
      const header = document.createElement("li");
      header.innerHTML = "<strong>Coming up</strong>";
      list.appendChild(header);

      upcoming.forEach(item => renderItem(user, item));
    }
  });
}

function timeUntil(date) {
  const now = new Date();
  const diffMs = date - now;

  if (diffMs <= 0) return "now";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `in ${years} year${years > 1 ? "s" : ""}`;
  if (months > 0) return `in ${months} month${months > 1 ? "s" : ""}`;
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function renderItem(user, data) {
  const li = document.createElement("li");

  const next = new Date(data.nextDate);

  li.innerHTML = `
    <strong>${data.title}</strong><br>
    ${
      next <= new Date()
        ? "✅ Ready to watch"
        : `Available <span title="${formatDate(next)}">${timeUntil(next)}</span>`
    }
    <br>
    <button class="rewatched">I rewatched this</button>
    <button class="delete">Delete</button>
  `;

  li.querySelector(".rewatched").onclick = async () => {
    const newNextDate = new Date();

    if (data.unit === "years") {
      newNextDate.setFullYear(newNextDate.getFullYear() + data.wait);
    } else {
      newNextDate.setMonth(newNextDate.getMonth() + data.wait);
    }

    const iso = newNextDate.toISOString();

    await updateDoc(
      doc(db, "users", user.uid, "rewatches", data.id),
      {
        nextDate: iso,
        nextDateDay: iso.slice(0, 10),
        lastRewatchedAt: new Date().toISOString(),
        notified: false,
        lastNotifiedAt: null
      }
    );
  };

  li.querySelector(".delete").onclick = async () => {
    await deleteDoc(
      doc(db, "users", user.uid, "rewatches", data.id)
    );
  };

  list.appendChild(li);
}

