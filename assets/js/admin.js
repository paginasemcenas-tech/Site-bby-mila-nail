import { auth, db } from "../../firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  arrayUnion,
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginSection = document.querySelector("#login-section");
const loginForm = document.querySelector("#login-form");
const dashboard = document.querySelector("#dashboard-section");
const loginFeedback = document.querySelector("#login-error");
const dashboardFeedback = document.querySelector("#dashboard-feedback");
const bookingsContainer = document.querySelector(".admin-booking-list");
const monthSelect = document.querySelector("[data-agenda-month]");
const monthStatus = document.querySelector("[data-month-status]");
const toggleMonthButton = document.querySelector("[data-toggle-month]");
const signOutButton = document.querySelector("#logout-button");
const agendaReference = doc(db, "configuracoes", "agenda");
const bookingsReference = collection(db, "agendamentos");
let openMonths = new Set();

const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
};

const getAvailableMonthKeys = () => {
  const firstMonth = new Date();
  firstMonth.setDate(1);
  firstMonth.setHours(0, 0, 0, 0);

  const monthKeys = new Set(openMonths);
  for (let offset = 0; offset < 12; offset += 1) {
    const month = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset, 1);
    monthKeys.add(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
  }

  return [...monthKeys].sort();
};

const renderMonthControl = () => {
  const selectedMonth = monthSelect.value;
  monthSelect.replaceChildren(...getAvailableMonthKeys().map((month) => new Option(monthLabel(month), month)));
  monthSelect.value = selectedMonth && monthSelect.querySelector(`option[value="${selectedMonth}"]`)
    ? selectedMonth
    : getAvailableMonthKeys()[0];

  const isOpen = openMonths.has(monthSelect.value);
  toggleMonthButton.textContent = isOpen ? "Fechar mês" : "Abrir mês";
  monthStatus.textContent = isOpen
    ? `${monthLabel(monthSelect.value)} está aberto para agendamentos.`
    : `${monthLabel(monthSelect.value)} está fechado para agendamentos.`;
};

const loadAgendaSettings = async () => {
  const snapshot = await getDoc(agendaReference);
  const months = snapshot.exists() && Array.isArray(snapshot.data().mesesAbertos)
    ? snapshot.data().mesesAbertos
    : [];
  openMonths = new Set(months.filter((month) =>
    typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  ));
  renderMonthControl();
};

const loadBookings = async () => {
  bookingsContainer.replaceChildren();
  dashboardFeedback.textContent = "Carregando agendamentos...";

  try {
    const snapshot = await getDocs(bookingsReference);
    const bookings = snapshot.docs
      .map((booking) => ({ id: booking.id, ...booking.data() }))
      .sort((a, b) => `${b.data || ""} ${b.horario || ""}`.localeCompare(`${a.data || ""} ${a.horario || ""}`));

    if (bookings.length === 0) {
      dashboardFeedback.textContent = "Ainda não há agendamentos.";
      return;
    }

    dashboardFeedback.textContent = "";
    bookings.forEach((booking) => {
      const card = document.createElement("article");
      card.className = "admin-booking-card";
      const details = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = booking.nome || "Cliente";
      const service = document.createElement("p");
      service.textContent = booking.procedimento || "Procedimento não informado";
      const when = document.createElement("p");
      when.textContent = `${booking.data || "Data não informada"} · ${booking.horario || "Horário não informado"}`;
      const contact = document.createElement("p");
      contact.textContent = `Telefone: ${booking.telefone || "Não informado"}${booking.email ? ` · ${booking.email}` : ""}`;
      const status = document.createElement("span");
      status.className = "admin-booking-status";
      status.textContent = `Status: ${booking.status || "pendente"}`;

      details.append(title, service, when, contact, status);
      card.append(details);

      const actions = document.createElement("div");
      actions.className = "admin-booking-actions";

      if (!["confirmado", "cancelado", "concluido"].includes(String(booking.status).toLowerCase())) {
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.textContent = "Confirmar";
        confirmButton.addEventListener("click", () => updateBookingStatus(booking.id, "confirmado", confirmButton));
        actions.append(confirmButton);
      }

      if (!["cancelado", "concluido"].includes(String(booking.status).toLowerCase())) {
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "cancel-booking";
        cancelButton.textContent = "Cancelar";
        cancelButton.addEventListener("click", () => updateBookingStatus(booking.id, "cancelado", cancelButton));
        actions.append(cancelButton);
      }

      card.append(actions);
      bookingsContainer.append(card);
    });
  } catch (error) {
    dashboardFeedback.textContent = "Não foi possível carregar os agendamentos.";
    console.error("Falha ao carregar agendamentos no painel:", error);
  }
};

const updateBookingStatus = async (bookingId, status, button) => {
  button.disabled = true;

  try {
    await updateDoc(doc(db, "agendamentos", bookingId), { status });
    await loadBookings();
  } catch (error) {
    button.disabled = false;
    dashboardFeedback.textContent = "Não foi possível atualizar o agendamento.";
    console.error("Falha ao atualizar status do agendamento:", error);
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type='submit']");
  const values = new FormData(loginForm);
  const email = String(values.get("email") || "").trim();
  const password = String(values.get("password") || "");
  submitButton.disabled = true;
  loginFeedback.textContent = "Validando acesso...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/user-not-found": "E-mail ou senha incorretos.",
      "auth/invalid-email": "Informe um e-mail válido.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
      "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente."
    };
    loginFeedback.textContent = messages[error.code] || "Não foi possível entrar. Tente novamente.";
    console.error("Falha no login do painel:", error);
  } finally {
    submitButton.disabled = false;
  }
});

monthSelect.addEventListener("change", renderMonthControl);

toggleMonthButton.addEventListener("click", async () => {
  const month = monthSelect.value;
  const isOpen = openMonths.has(month);
  toggleMonthButton.disabled = true;
  dashboardFeedback.textContent = `${isOpen ? "Fechando" : "Abrindo"} ${monthLabel(month)}...`;
  try {
    await setDoc(
      agendaReference,
      { mesesAbertos: isOpen ? arrayRemove(month) : arrayUnion(month) },
      { merge: true }
    );
    await loadAgendaSettings();
    dashboardFeedback.textContent = `Mês ${isOpen ? "fechado" : "aberto"} com sucesso.`;
  } catch (error) {
    dashboardFeedback.textContent = "Não foi possível atualizar o mês da agenda.";
    console.error("Falha ao atualizar mês da agenda:", error);
  } finally {
    toggleMonthButton.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    dashboardFeedback.textContent = "Não foi possível encerrar a sessão.";
    console.error("Falha ao sair do painel:", error);
  }
});

onAuthStateChanged(auth, async (user) => {
  loginSection.style.display = user ? "none" : "";
  dashboard.style.display = user ? "block" : "none";

  if (!user) {
    bookingsContainer.replaceChildren();
    return;
  }

  dashboardFeedback.textContent = "Carregando painel...";
  try {
    await Promise.all([loadAgendaSettings(), loadBookings()]);
  } catch (error) {
    dashboardFeedback.textContent = "Não foi possível carregar as configurações da agenda.";
    console.error("Falha ao inicializar painel:", error);
  }
});
