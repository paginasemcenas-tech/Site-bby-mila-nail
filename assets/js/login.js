import { auth, db, adminUIDs } from "../../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loginForm = document.querySelector("#login-form");
const feedback = document.querySelector("#login-feedback");
const submitButton = loginForm.querySelector("[type='submit']");
const emailInput = loginForm.elements.email;
const passwordInput = loginForm.elements.password;
const rememberInput = loginForm.elements.remember;
const passwordToggle = document.querySelector(".password-toggle");
const forgotPasswordButton = document.querySelector(".forgot-password");
const isConfiguredAdmin = (user) => Array.isArray(adminUIDs) && adminUIDs.includes(user.uid);
const hasDashboardAccess = async (user) => {
  if (isConfiguredAdmin(user)) return true;
  const profile = await getDoc(doc(db, "profissionais", user.uid));
  return profile.exists() && profile.data().ativo === true;
};

const setFeedback = (message, kind = "error") => {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
};

const authErrorMessage = (code) => ({
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Informe um e-mail válido.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/missing-email": "Informe seu e-mail para recuperar a senha.",
  "auth/user-disabled": "Esta conta está desativada. Fale com a administração."
}[code] || "Não foi possível concluir a solicitação. Tente novamente.");

passwordToggle.addEventListener("click", () => {
  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!isVisible));
  passwordToggle.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "VALIDANDO ACESSO...";
  setFeedback("");

  try {
    await setPersistence(auth, rememberInput.checked
      ? browserLocalPersistence
      : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!await hasDashboardAccess(credential.user)) {
      await signOut(auth);
      setFeedback("Esta conta não está cadastrada como administradora ou profissional parceira.");
      return;
    }

    window.location.replace("dashboard.html");
  } catch (error) {
    setFeedback(authErrorMessage(error.code));
    console.error("Falha no acesso administrativo:", error);
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "ENTRAR NO DASHBOARD";
  }
});

forgotPasswordButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    emailInput.focus();
    setFeedback("Informe seu e-mail para receber o link de recuperação.");
    return;
  }

  if (!emailInput.validity.valid) {
    emailInput.reportValidity();
    return;
  }

  forgotPasswordButton.disabled = true;
  setFeedback("Enviando instruções de recuperação...", "success");
  try {
    await sendPasswordResetEmail(auth, email);
    setFeedback("Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.", "success");
  } catch (error) {
    setFeedback(authErrorMessage(error.code));
    console.error("Falha ao enviar recuperação de senha:", error);
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (isConfiguredAdmin(user)) {
    window.location.replace("dashboard.html");
    return;
  }

  try {
    if (await hasDashboardAccess(user)) {
      window.location.replace("dashboard.html");
      return;
    }
    await signOut(auth);
    setFeedback("Esta conta não está cadastrada como administradora ou profissional parceira.");
  } catch (error) {
    setFeedback("Não foi possível validar a conta. Tente novamente.");
    console.error("Falha ao validar a conta administrativa:", error);
  }
});
