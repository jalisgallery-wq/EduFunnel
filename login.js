// login.js - Versi JSON (tanpa Supabase)
// Autentikasi sederhana menggunakan data dummy lokal

const DUMMY_USERS = [
  { email: "admin@edufunnel.com", password: "edufunnel123", name: "Admin Edufunnel" },
  { email: "demo@edufunnel.com", password: "demo123", name: "Demo User" }
];

document.addEventListener("DOMContentLoaded", function () {

  // --- Password toggle ---
  const toggleBtn = document.querySelector(".password-toggle");
  const passwordInput = document.getElementById("password");

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", function () {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
    });
  }

  // --- Form login ---
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email    = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      // Cek ke daftar user dummy
      const user = DUMMY_USERS.find(u => u.email === email && u.password === password);

      if (user) {
        // Simpan session sederhana di sessionStorage
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("userName", user.name);
        sessionStorage.setItem("userEmail", user.email);

        // Redirect ke dashboard
        window.location.href = "dashboard.html";
      } else {
        showError("Email atau password salah.");
      }
    });
  }

  // --- Google login (disabled, tampilkan pesan) ---
  const googleBtn = document.querySelector(".btn-google");
  if (googleBtn) {
    googleBtn.addEventListener("click", function () {
      alert("Login Google tidak tersedia di versi JSON.\nGunakan email: admin@edufunnel.com\nPassword: edufunnel123");
    });
  }

});

// Fungsi tampilkan error di bawah form
function showError(message) {
  let errorEl = document.getElementById("login-error");

  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.id = "login-error";
    errorEl.style.cssText = "color:#ef4444; font-size:14px; margin-top:12px; text-align:center;";
    const form = document.getElementById("loginForm");
    form.appendChild(errorEl);
  }

  errorEl.textContent = message;
}
