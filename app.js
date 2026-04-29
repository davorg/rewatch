import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  getDocs,
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

const signedOut = document.getElementById("signed-out");
const signedIn = document.getElementById("signed-in");
const userEl = document.getElementById("user");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const form = document.getElementById("add-form");
const list = document.getElementById("list");

loginButton.onclick = () => {
  signInWithPopup(auth, provider);
};

logoutButton.onclick = () => {
  signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    userEl.textContent = user.email;
    signedIn.style.display = "block";
    signedOut.style.display = "none";

    loadRewatches(user);
  } else {
    signedIn.style.display = "none";
    signedOut.style.display = "block";
    userEl.textContent = "";
    list.innerHTML = "";

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

  await addDoc(
    collection(db, "users", user.uid, "rewatches"),
    {
      title,
      wait,
      unit,
      nextDate: nextDate.toISOString(),
      createdAt: new Date().toISOString()
    }
  );

  form.reset();
  document.getElementById("wait").value = "3";
};

let unsubscribe = null;

function loadRewatches(user) {
  // Clean up previous listener if it exists
  if (unsubscribe) {
    unsubscribe();
  }

  const q = query(
    collection(db, "users", user.uid, "rewatches"),
    orderBy("nextDate"),
    orderBy("title")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    list.innerHTML = "";

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const id = docSnapshot.id;

      const li = document.createElement("li");

      const next = new Date(data.nextDate);
      const today = new Date();

      const status =
        next <= today
          ? "✅ Ready to watch"
          : `Available ${next.toDateString()}`;

      li.innerHTML = `
        <strong>${data.title}</strong><br>
        ${status}<br>
        <button type="button" class="rewatched">I rewatched this</button>
        <button type="button" class="delete">Delete</button>
      `;

      li.querySelector(".rewatched").onclick = async () => {
        const newNextDate = new Date();

        if (data.unit === "years") {
          newNextDate.setFullYear(newNextDate.getFullYear() + data.wait);
        } else {
          newNextDate.setMonth(newNextDate.getMonth() + data.wait);
        }

        await updateDoc(
          doc(db, "users", user.uid, "rewatches", id),
          {
            nextDate: newNextDate.toISOString(),
            lastRewatchedAt: new Date().toISOString()
          }
        );
      };

      li.querySelector(".delete").onclick = async () => {
        await deleteDoc(
          doc(db, "users", user.uid, "rewatches", id)
        );
      };

      list.appendChild(li);
    });
  });
}
