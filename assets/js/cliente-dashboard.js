import { auth, db, adminUIDs } from "../../firebase-config.js";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  customerAuthError,
  loginAliasReference,
  normalizePhone,
  signInCustomer
} from "./customer-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const customerStatus = document.querySelector("#customer-status");
const authView = document.querySelector("#customer-auth-view");
const customerApp = document.querySelector("#customer-app");
const authForm = document.querySelector("#customer-auth-form");
const authFeedback = document.querySelector("#customer-auth-feedback");
const profileForm = document.querySelector("#customer-profile-form");
const profileFeedback = document.querySelector("#customer-profile-feedback");
const submitButton = document.querySelector("#customer-submit");
const customerCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2
});
const cancelledStatuses = new Set(["cancelado", "cancelled"]);
const dayMilliseconds = 24 * 60 * 60 * 1000;

let currentUser = null;
let currentProfile = null;
let clientAppointments = [];

const setCustomerStatus = (message) => {
  customerStatus.textContent = message;
  customerStatus.hidden = !message;
};

const setAuthFeedback = (message, kind = "error") => {
  authFeedback.textContent = message;
  authFeedback.dataset.kind = kind;
};

const setProfileFeedback = (message, kind = "error") => {
  profileFeedback.textContent = message;
  profileFeedback.dataset.kind = kind;
};

const timestampMillis = (value) => {
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
};

const isCancelled = (booking) =>
  cancelledStatuses.has(String(booking.status || "").toLowerCase());

const formatDate = (isoDate) => {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(isoDate || "Data a confirmar")
    : new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
};

const statusDetails = (status) => {
  const normalized = String(status || "pendente").toLowerCase();
  const labels = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado"
  };
  return {
    label: labels[normalized] || "Pendente",
    className: cancelledStatuses.has(normalized) ? "is-cancelled"
      : normalized === "confirmado" ? "is-confirmed"
        : normalized === "concluido" ? "is-completed" : "is-pending"
  };
};

const createText = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

const getBookingWindow = (appointments) => {
  const cutoff = Date.now() - 365 * dayMilliseconds;
  return appointments.filter((booking) => {
    if (isCancelled(booking)) return false;
    const createdAt = timestampMillis(booking.criadoEm);
    return createdAt !== null && createdAt >= cutoff && createdAt <= Date.now();
  });
};

const getProfile = async (user) => {
  const profileReference = doc(db, "clientes", user.uid);
  const snapshot = await getDoc(profileReference);
  if (snapshot.exists()) {
    const data = snapshot.data();
    const migration = {};
    if (!data.loginEmail) migration.loginEmail = user.email;
    if (typeof data.vipAvisoAte !== "number") migration.vipAvisoAte = 0;
    if (Object.keys(migration).length) {
      await updateDoc(profileReference, migration);
      return { reference: profileReference, data: { ...data, ...migration } };
    }
    return { reference: profileReference, data };
  }

  if (!user.emailVerified || !user.email) {
    throw new Error("Esta conta ainda não está vinculada ao perfil do agendamento. Entre com o telefone e a senha usados no cadastro.");
  }

  const legacySnapshot = await getDocs(query(
    collection(db, "agendamentos"),
    where("email", "==", user.email.toLowerCase())
  ));
  const previousBookings = legacySnapshot.docs.map((item) => item.data());
  if (previousBookings.length === 0) {
    throw new Error("Não encontramos reservas vinculadas a esta conta. Confira o telefone/e-mail usado no primeiro agendamento.");
  }

  const latest = [...previousBookings].sort((a, b) =>
    (timestampMillis(b.criadoEm) || 0) - (timestampMillis(a.criadoEm) || 0))[0];
  const phone = normalizePhone(latest.telefone || "");
  const profile = {
    nome: latest.nome || user.displayName || "Cliente Bby Mila",
    telefone: phone,
    email: latest.email || user.email.toLowerCase(),
    instagram: "",
    loginEmail: user.email,
    vipAvisoAte: 0,
    criadoEm: serverTimestamp()
  };
  await setDoc(profileReference, profile);
  return { reference: profileReference, data: profile };
};

const renderAppointmentList = (appointments) => {
  const list = document.querySelector("#customer-bookings-list");
  const empty = document.querySelector("#customer-bookings-empty");
  list.replaceChildren();

  const sorted = [...appointments].sort((a, b) =>
    `${b.data || ""} ${b.horario || ""}`.localeCompare(`${a.data || ""} ${a.horario || ""}`));
  sorted.forEach((booking) => {
    const card = document.createElement("article");
    card.className = "customer-booking-card";

    const dateBlock = document.createElement("div");
    dateBlock.className = "customer-booking-date";
    dateBlock.append(
      createText("strong", "", booking.horario || "—"),
      createText("span", "", formatDate(booking.data))
    );

    const details = document.createElement("div");
    details.className = "customer-booking-details";
    details.append(
      createText("h3", "", booking.procedimento || "Procedimento"),
      createText("p", "", `Código: ${booking.codigoConsulta || "Disponível na confirmação"}`)
    );
    if (typeof booking.valor === "number" && Number.isFinite(booking.valor)) {
      details.append(createText("small", "customer-booking-price", customerCurrency.format(booking.valor)));
    }

    const status = statusDetails(booking.status);
    const badge = createText("span", `customer-booking-status ${status.className}`, status.label);
    card.append(dateBlock, details, badge);

    if (!isCancelled(booking)) {
      const message = [
        "Olá! Gostaria de solicitar uma alteração no meu agendamento.",
        `Procedimento: ${booking.procedimento || "não informado"}`,
        `Data: ${formatDate(booking.data)} às ${booking.horario || "a confirmar"}`,
        `Código da reserva: ${booking.codigoConsulta || "não informado"}`
      ].join("\n");
      const actions = document.createElement("div");
      actions.className = "customer-booking-actions";

      const cancelLink = document.createElement("a");
      cancelLink.href = `https://wa.me/553196809579?text=${encodeURIComponent(
        `Olá! Gostaria de solicitar o cancelamento do meu agendamento de ${booking.procedimento || "procedimento"} em ${formatDate(booking.data)} às ${booking.horario || "a confirmar"}. Código: ${booking.codigoConsulta || "não informado"}.`
      )}`;
      cancelLink.target = "_blank";
      cancelLink.rel = "noopener noreferrer";
      cancelLink.textContent = "Solicitar cancelamento";

      const rescheduleLink = document.createElement("a");
      rescheduleLink.href = `https://wa.me/553196809579?text=${encodeURIComponent(message)}`;
      rescheduleLink.target = "_blank";
      rescheduleLink.rel = "noopener noreferrer";
      rescheduleLink.textContent = "Solicitar reagendamento";
      actions.append(cancelLink, rescheduleLink);
      card.append(actions);
    }
    list.append(card);
  });
  empty.hidden = sorted.length > 0;
};

const renderMetrics = (appointments, recentAppointments) => {
  document.querySelector("#customer-bookings-count").textContent = String(recentAppointments.length);
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  const upcoming = appointments
    .filter((booking) => !isCancelled(booking) && String(booking.data || "") >= todayIso)
    .sort((a, b) => `${a.data || ""} ${a.horario || ""}`.localeCompare(`${b.data || ""} ${b.horario || ""}`))[0];
  document.querySelector("#customer-next-booking").textContent = upcoming
    ? `${formatDate(upcoming.data)} · ${upcoming.horario || "—"}`
    : "Nenhum horário";
  document.querySelector("#customer-next-service").textContent = upcoming?.procedimento || "";

  const frequencies = new Map();
  recentAppointments.forEach((booking) => {
    const procedure = String(booking.procedimento || "").trim();
    if (procedure) frequencies.set(procedure, (frequencies.get(procedure) || 0) + 1);
  });
  const favorite = [...frequencies.entries()].sort((a, b) =>
    b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0];
  document.querySelector("#customer-favorite-service").textContent = favorite?.[0] || "—";
};

const showCustomerDashboard = async (user) => {
  setCustomerStatus("Carregando seus agendamentos...");
  await user.getIdToken(true);
  currentProfile = await getProfile(user);
  const phone = normalizePhone(currentProfile.data.telefone || "");
  if (phone.length < 10 || phone.length > 11) {
    throw new Error("O telefone vinculado à sua conta precisa ser atualizado pelo Studio.");
  }
  const appointmentQueries = [
    query(
      collection(db, "agendamentos"),
      where("clienteUid", "==", user.uid)
    )
  ];
  if (user.emailVerified && user.email) {
    appointmentQueries.push(query(
      collection(db, "agendamentos"),
      where("email", "==", user.email.toLowerCase())
    ));
  }
  const snapshots = await Promise.all(appointmentQueries.map((appointmentsQuery) =>
    getDocs(appointmentsQuery)));
  const appointmentsById = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => {
    appointmentsById.set(item.id, { id: item.id, ...item.data() });
  }));
  clientAppointments = [...appointmentsById.values()];

  const recentAppointments = getBookingWindow(clientAppointments);
  const eligible = recentAppointments.length >= 3;
  const latest = [...clientAppointments].sort((a, b) =>
    (timestampMillis(b.criadoEm) || 0) - (timestampMillis(a.criadoEm) || 0))[0];
  setCustomerStatus("");
  authView.hidden = true;
  customerApp.hidden = false;
  document.querySelector("#customer-welcome-name").textContent =
    latest?.nome || currentProfile.data.nome || user.displayName || "Cliente";
  document.querySelector("#customer-side-name").textContent =
    latest?.nome || currentProfile.data.nome || user.displayName || "Cliente";
  document.querySelector("#customer-vip-badge").hidden = !eligible;
  document.querySelector("#customer-status-label").textContent =
    eligible ? "CLIENTE FREQUENTE" : "ÁREA DA CLIENTE";
  document.querySelector("#customer-metrics").hidden = !eligible;
  document.querySelector("#customer-unlocked-message").hidden = !eligible;
  document.querySelector("#customer-locked").hidden = eligible;
  document.querySelector("#customer-full-dashboard").hidden = !eligible;

  if (!eligible) {
    document.querySelector("#customer-remaining-bookings").textContent = String(recentAppointments.length);
    document.querySelector("#customer-bookings-needed").textContent =
      String(Math.max(0, 3 - recentAppointments.length));
    return;
  }

  renderMetrics(clientAppointments, recentAppointments);
  renderAppointmentList(clientAppointments);
  const fields = profileForm.elements;
  fields.nome.value = currentProfile.data.nome || "";
  fields.telefone.value = phone;
  fields.email.value = currentProfile.data.email || "";
  fields.instagram.value = currentProfile.data.instagram || "";
  profileForm.dataset.profileId = currentProfile.reference.id;
};

const showAuth = () => {
  setCustomerStatus("");
  customerApp.hidden = true;
  authView.hidden = false;
};

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;

  submitButton.disabled = true;
  setAuthFeedback("");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInCustomer(
      String(authForm.elements.identifier.value).trim(),
      String(authForm.elements.password.value)
    );
  } catch (error) {
    setAuthFeedback(customerAuthError(error));
    console.error("Falha no acesso à área da cliente:", error);
  } finally {
    submitButton.disabled = false;
  }
});

const logoutCustomer = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    setCustomerStatus("Não foi possível sair da conta. Tente novamente.");
    console.error("Falha ao sair da conta da cliente:", error);
  }
};

document.querySelector("#customer-signout").addEventListener("click", logoutCustomer);

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !currentProfile || !profileForm.reportValidity()) return;

  const values = new FormData(profileForm);
  const email = String(values.get("email") || "").trim().toLowerCase() || null;
  const saveButton = profileForm.querySelector("[type='submit']");
  saveButton.disabled = true;
  setProfileFeedback("");
  try {
    const batch = writeBatch(db);
    batch.update(currentProfile.reference, {
      nome: String(values.get("nome") || "").trim(),
      email,
      instagram: String(values.get("instagram") || "").trim(),
      atualizadoEm: serverTimestamp()
    });

    const previousEmail = currentProfile.data.email;
    if (previousEmail && previousEmail !== email) {
      const previousAliasReference = loginAliasReference("email", previousEmail);
      const previousAliasSnapshot = await getDoc(previousAliasReference);
      if (previousAliasSnapshot.exists()
        && previousAliasSnapshot.data().uid === currentUser.uid) {
        batch.delete(previousAliasReference);
      }
    }

    if (email && email !== previousEmail) {
      const aliasReference = loginAliasReference("email", email);
      const aliasSnapshot = await getDoc(aliasReference);
      if (aliasSnapshot.exists() && aliasSnapshot.data().uid !== currentUser.uid) {
        throw new Error("Este e-mail já está associado a outra conta.");
      }
      if (!aliasSnapshot.exists()) {
        batch.set(aliasReference, {
          uid: currentUser.uid,
          kind: "email",
          identifier: email,
          loginEmail: currentProfile.data.loginEmail
        });
      }
    }

    await batch.commit();
    currentProfile = {
      ...currentProfile,
      data: {
        ...currentProfile.data,
        nome: String(values.get("nome") || "").trim(),
        email,
        instagram: String(values.get("instagram") || "").trim()
      }
    };
    document.querySelector("#customer-welcome-name").textContent = currentProfile.data.nome;
    document.querySelector("#customer-side-name").textContent = currentProfile.data.nome;
    setProfileFeedback("Seus dados foram atualizados.", "success");
  } catch (error) {
    setProfileFeedback(error.message || "Não foi possível atualizar seus dados. Tente novamente.");
    console.error("Falha ao atualizar os dados da cliente:", error);
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector("#customer-menu-toggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  document.querySelector("#customer-sidebar").classList.toggle("is-open", !expanded);
});

document.querySelector("#customer-date").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date());

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    currentProfile = null;
    showAuth();
    return;
  }
  if (adminUIDs.includes(user.uid)) {
    setCustomerStatus("Esta conta pertence à administração. Acesse o painel do Studio.");
    authView.hidden = true;
    customerApp.hidden = true;
    return;
  }
  try {
    await showCustomerDashboard(user);
  } catch (error) {
    setCustomerStatus(error.message || "Não foi possível carregar sua área. Confira o telefone/e-mail usado no agendamento.");
    authView.hidden = true;
    customerApp.hidden = true;
    console.error("Falha ao carregar os dados da cliente:", error);
  }
});
