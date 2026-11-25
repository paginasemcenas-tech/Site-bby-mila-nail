import { auth, db, adminUIDs } from "../../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = document.querySelector("#dashboard-app");
const statusMessage = document.querySelector("#dashboard-status");
const toast = document.querySelector("#dashboard-toast");
const recordDialog = document.querySelector("#record-dialog");
const recordForm = document.querySelector("#record-form-shell");
const recordTitle = document.querySelector("#record-dialog-title");
const recordFields = document.querySelector("#record-fields");
const recordFeedback = document.querySelector("#record-feedback");
const listDialog = document.querySelector("#list-dialog");
const listTitle = document.querySelector("#list-dialog-title");
const listContent = document.querySelector("#list-dialog-content");
const blockDialog = document.querySelector("#block-dialog");
const blockForm = document.querySelector("#block-form");
const agendaMonthSelect = document.querySelector("#agenda-month");
const agendaMonthStatus = document.querySelector("#agenda-month-status");
const toggleMonthButton = document.querySelector("#toggle-month-button");
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const sidebar = document.querySelector("#dashboard-sidebar");
const notificationsButton = document.querySelector("#notifications-button");
const notificationsPopover = document.querySelector("#notifications-popover");
const notificationList = document.querySelector("#notification-list");
const appointmentsReference = collection(db, "agendamentos");
const clientsReference = collection(db, "clientes");
const servicesReference = collection(db, "servicos");
const reviewsReference = collection(db, "avaliacoes");
const occupiedSlotsReference = collection(db, "horarios_ocupados");
const agendaReference = doc(db, "configuracoes", "agenda");

const siteServices = [
  { id: "site-aplicacao-pm", nome: "Aplicação P/M", descricao: "Aplicação de alongamento em tamanho pequeno ou médio.", valor: 195 },
  { id: "site-aplicacao-gg", nome: "Aplicação G/GG", descricao: "Aplicação de alongamento em tamanho grande ou extra grande.", valor: 260 },
  { id: "site-manutencao-pm", nome: "Manutenção P/M", descricao: "Manutenção de alongamento em tamanho pequeno ou médio.", valor: 165 },
  { id: "site-manutencao-gg", nome: "Manutenção G/GG", descricao: "Manutenção de alongamento em tamanho grande ou extra grande.", valor: 225 },
  { id: "site-banho-gel", nome: "Banho em Gel", descricao: "Estrutura e acabamento para as unhas naturais.", valor: 145 },
  { id: "site-blindagem", nome: "Blindagem", descricao: "Cuidado e reforço das unhas naturais.", valor: 115 },
  { id: "site-remocao", nome: "Remoção", descricao: "Remoção segura do procedimento.", valor: 70 },
  { id: "site-unha-quebrada", nome: "Unha quebrada", descricao: "Reparo de unha quebrada.", valor: 12 },
  { id: "site-manutencao-outra-pm", nome: "Manutenção de outra profissional P/M", descricao: "Manutenção P/M sujeita à remoção e nova aplicação.", valor: 175 },
  { id: "site-manutencao-outra-gg", nome: "Manutenção de outra profissional G/GG", descricao: "Manutenção G/GG sujeita à remoção e nova aplicação.", valor: 230 },
  { id: "site-nail-art", nome: "Nail Art", descricao: "Arte exclusiva desenhada para o estilo da cliente.", valor: null }
];

let bookings = [];
let clients = [];
let services = [];
let reviews = [];
let blockedSlots = [];
const liveData = { bookings: [], clients: [], services: [], reviews: [], blockedSlots: [] };
const loadedCollections = { bookings: false, clients: false, services: false, reviews: false, blockedSlots: false };
let isDemoMode = false;
let demoData = null;
let manualDemoOverride = null;
let readNotificationIds = new Set();
let openMonths = new Set();
let visibleMonth = new Date();
let selectedDate = new Date();
let appointmentsSelectedDate = new Date();
let currentRecordType = "";
let toastTimeout;
let legacyAvailabilitySynced = false;
let currentListType = "";
let currentListOptions = {};
let appointmentsDateRange = "today";
let forecastHidden = false;
let editingBookingId = null;
let appointmentsLoaded = false;
let siteServicesSeedStarted = false;

visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
selectedDate.setHours(12, 0, 0, 0);
appointmentsSelectedDate.setHours(12, 0, 0, 0);

const localDateIso = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0")
].join("-");

const slotDocumentId = (date, time) => `${date}_${time.replace(":", "-")}`;
const parseDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? new Date(`${date}T12:00:00`) : null;
const dateInRange = (value, start, end) => value >= start && value < end;
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const nextMonthStart = (date, offset = 1) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const formatMonth = (date) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
const formatLongDate = (date) => new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long"
}).format(date);
const currency = (value) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
}).format(Number.isFinite(value) ? value : 0);
const amountOf = (booking) => typeof booking.valor === "number" && Number.isFinite(booking.valor) ? booking.valor : 0;
const forecastAmountOf = (booking) => {
  if (typeof booking.valor === "number" && Number.isFinite(booking.valor)) return booking.valor;
  const serviceName = bookingProcedure(booking).trim().toLocaleLowerCase("pt-BR");
  const service = services.find((item) =>
    String(item.nome || "").trim().toLocaleLowerCase("pt-BR") === serviceName);
  return service && Number.isFinite(Number(service.valor)) ? Number(service.valor) : 0;
};
const isCancelled = (booking) => ["cancelado", "cancelled"].includes(String(booking.status || "").toLowerCase());
const statusLabel = (status) => ({
  pendente: "Pendente",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado"
}[String(status || "").toLowerCase()] || status || "Pendente");

const createDemoData = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateAt = (day) => {
    const date = new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
    return { date, iso: localDateIso(date) };
  };
  const clientRows = [
    ["Juliana Santos", "31900000101", "juliana.santos@example.com", "@juliana.demo"],
    ["Luana Ferreira", "31900000102", "luana.ferreira@example.com", "@luana.demo"],
    ["Mariana Alves", "31900000103", "mariana.alves@example.com", "@mariana.demo"],
    ["Beatriz Costa", "31900000104", "beatriz.costa@example.com", "@beatriz.demo"],
    ["Camila Rocha", "31900000105", "camila.rocha@example.com", "@camila.demo"],
    ["Isabela Martins", "31900000106", "isabela.martins@example.com", "@isabela.demo"],
    ["Rafaela Lima", "31900000107", "rafaela.lima@example.com", "@rafaela.demo"]
  ];
  const clientDocs = clientRows.map(([nome, telefone, email, instagram], index) => ({
    id: `demo-client-${index + 1}`,
    nome,
    telefone,
    email,
    instagram,
    ativo: true,
    historico: ["Aplicação P/M", "Nail Art"].slice(0, index % 3 + 1),
    criadoEm: dateAt(Math.max(1, Math.min(20, index * 2 + 2))).date
  }));
  const servicesDocs = [
    ...siteServices.map(({ nome, descricao, valor }) => ({
      nome, descricao, valor, duracao: null, ativo: true
    }))
  ].map((service, index) => ({ id: `demo-service-${index + 1}`, ...service }));
  const appointments = [
    [0, 3, "10:00", "Aplicação P/M", "concluido", 195],
    [1, 6, "13:30", "Banho em Gel", "concluido", 145],
    [2, 9, "09:00", "Blindagem", "concluido", 820],
    [3, 12, "15:00", "Nail Art", "concluido", 780],
    [4, 16, "11:00", "Aplicação G/GG", "concluido", 260],
    [0, 19, "14:00", "Manutenção P/M", "concluido", 165],
    [1, 21, "10:30", "Nail Art", "concluido", 960],
    [2, 22, "16:00", "Aplicação P/M", "concluido", 195],
    [3, now.getDate(), "15:00", "Banho em Gel", "confirmado", 145],
    [4, now.getDate() + 1, "11:00", "Nail Art", "pendente", 350]
  ];
  const bookingsDocs = appointments.map(([clientIndex, day, horario, procedimento, status, valor], index) => {
    const appointmentDate = dateAt(day);
    const createdAt = new Date(now.getTime() - (index + 1) * 47 * 60 * 1000);
    return {
      id: `demo-booking-${String(index + 1).padStart(2, "0")}`,
      nome: clientRows[clientIndex][0],
      telefone: clientRows[clientIndex][1],
      email: clientRows[clientIndex][2],
      procedimento,
      data: appointmentDate.iso,
      horario,
      status,
      valor,
      slotId: slotDocumentId(appointmentDate.iso, horario),
      codigoConsulta: String(index + 1).padStart(2, "0").repeat(32),
      criadoEm: createdAt,
      atualizadoEm: createdAt
    };
  });
  return {
    bookings: bookingsDocs,
    clients: clientDocs,
    services: servicesDocs,
    reviews: [...Array(17).fill({ nota: 5 }), { nota: 4 }]
  };
};

const renderAllData = () => {
  renderMetrics();
  renderAppointmentsTable();
  renderClientsTable();
  renderServicesTable();
  renderFinanceTable();
  renderNotifications();
};

const updateDemoControls = () => {
  document.querySelector("#demo-banner").hidden = !isDemoMode;
  document.querySelectorAll("[data-demo-toggle]").forEach((button) => {
    button.textContent = isDemoMode ? "Voltar aos dados do Firestore" : "Popular dados de exemplo";
  });
  const feedback = document.querySelector("#demo-mode-feedback");
  if (feedback) {
    feedback.textContent = isDemoMode
      ? "Demonstração ativa: as alterações ficam somente nesta sessão."
      : "Dados reais serão carregados do Firestore.";
  }
};

const setDemoMode = (enabled) => {
  if (enabled === isDemoMode && (!enabled || demoData)) return;
  isDemoMode = enabled;
  if (enabled) {
    demoData = createDemoData();
    bookings = demoData.bookings;
    clients = demoData.clients;
    services = demoData.services;
    reviews = demoData.reviews;
    blockedSlots = [];
    readNotificationIds = new Set();
  } else {
    demoData = null;
    bookings = liveData.bookings;
    clients = liveData.clients;
    services = liveData.services;
    reviews = liveData.reviews;
    blockedSlots = liveData.blockedSlots;
  }
  updateDemoControls();
  renderAllData();
};

const refreshDataMode = () => {
  if (Object.values(loadedCollections).some((loaded) => !loaded)) return;
  if (manualDemoOverride === null) {
    const collectionsAreEmpty = Object.values(liveData).every((items) => items.length === 0);
    if (collectionsAreEmpty !== isDemoMode) {
      setDemoMode(collectionsAreEmpty);
    } else if (!isDemoMode) {
      bookings = liveData.bookings;
      clients = liveData.clients;
      services = liveData.services;
      reviews = liveData.reviews;
      blockedSlots = liveData.blockedSlots;
      renderAllData();
    }
  } else if (manualDemoOverride !== isDemoMode) {
    setDemoMode(manualDemoOverride);
  } else if (!isDemoMode) {
    bookings = liveData.bookings;
    clients = liveData.clients;
    services = liveData.services;
    reviews = liveData.reviews;
    blockedSlots = liveData.blockedSlots;
    renderAllData();
  }
};

const showToast = (message) => {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
};

const setDashboardError = (message) => {
  statusMessage.hidden = false;
  statusMessage.textContent = message;
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const appointmentMonth = (booking) => parseDate(booking.data);

const bookingsForDate = (date) => {
  const dateKey = typeof date === "string" ? date : localDateIso(date);
  return bookings
    .filter((booking) => booking.data === dateKey && !isCancelled(booking))
    .sort((a, b) => String(a.horario || "").localeCompare(String(b.horario || "")));
};

const normalizeStatus = (booking) => String(booking.status || "pendente").toLowerCase();
const bookingProcedure = (booking) => booking.procedimento || booking.servico || "Serviço";

const formatPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "Telefone não informado";
};

const bookingsInRange = (range, date) => {
  const dateKey = localDateIso(date);
  if (range !== "week") return bookings.filter((booking) => booking.data === dateKey);
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return bookings.filter((booking) => {
    const appointmentDate = parseDate(booking.data);
    return appointmentDate && dateInRange(appointmentDate, weekStart, weekEnd);
  });
};

const updateAppointmentSummary = () => {
  const dateKey = localDateIso(appointmentsSelectedDate);
  const dayBookings = bookings.filter((booking) => booking.data === dateKey && !isCancelled(booking));
  const now = new Date();
  const upcoming = dayBookings
    .filter((booking) => dateKey !== localDateIso(now) || String(booking.horario || "") >=
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
    .sort((a, b) => String(a.horario || "").localeCompare(String(b.horario || "")));
  const next = upcoming[0];
  const confirmedForecast = dayBookings
    .filter((booking) => normalizeStatus(booking) === "confirmado")
    .reduce((total, booking) => total + forecastAmountOf(booking), 0);
  const pendingCount = bookings.filter((booking) => normalizeStatus(booking) === "pendente").length;
  document.querySelector("#appointments-day-count").textContent = String(dayBookings.length);
  document.querySelector("#appointments-day-label").textContent = formatLongDate(appointmentsSelectedDate);
  document.querySelector("#appointments-pending-count").textContent = String(pendingCount);
  document.querySelector("#appointments-next-time").textContent = next ? next.horario || "—" : "—";
  document.querySelector("#appointments-next-client").textContent = next
    ? next.nome || "Cliente"
    : dateKey === localDateIso(now) ? "Nenhum próximo atendimento" : "Sem atendimento previsto";
  document.querySelector("#appointments-next-service").textContent = next ? bookingProcedure(next) : "";
  document.querySelector("#appointments-day-forecast").textContent =
    forecastHidden ? "R$ ••••" : currency(confirmedForecast);
  const visibilityButton = document.querySelector("#toggle-forecast-visibility");
  visibilityButton.setAttribute("aria-pressed", String(forecastHidden));
  visibilityButton.setAttribute("aria-label", forecastHidden ? "Exibir previsão do dia" : "Ocultar previsão do dia");
  visibilityButton.textContent = forecastHidden ? "◎" : "◉";
};

const clientIsReturning = (booking) => {
  const declaredType = String(booking.tipoCliente || "").toLowerCase();
  if (["antiga", "cliente antiga", "recorrente", "returning"].includes(declaredType)) return true;
  if (["nova", "cliente nova", "new"].includes(declaredType)) return false;
  if (clients.some((client) => client.telefone && client.telefone === booking.telefone)) return true;
  return bookings.filter((item) =>
    item.telefone && item.telefone === booking.telefone && !isCancelled(item)
  ).length > 1;
};

const createTimelineBooking = (booking) => {
  const card = createElement("article", "timeline-card");
  const timeBlock = createElement("div", "timeline-time");
  timeBlock.append(createElement("time", "", booking.horario || "—"));
  timeBlock.append(createElement("span", "", booking.data ? formatShortDate(booking.data) : "Data não informada"));

  const details = createElement("div", "timeline-details");
  const customerLine = createElement("div", "timeline-customer-line");
  customerLine.append(createElement("h3", "", booking.nome || "Cliente"));
  customerLine.append(createElement("span",
    `customer-type-badge${clientIsReturning(booking) ? " is-returning" : ""}`,
    clientIsReturning(booking) ? "Cliente recorrente" : "Cliente nova"));
  const phone = createElement("a", "timeline-phone", formatPhone(booking.telefone));
  const phoneDigits = String(booking.telefone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11})/, "");
  if (phoneDigits.length >= 10 && phoneDigits.length <= 11) {
    phone.href = `https://wa.me/55${phoneDigits}`;
    phone.target = "_blank";
    phone.rel = "noopener noreferrer";
  } else {
    phone.removeAttribute("href");
  }
  const serviceLine = createElement("div", "timeline-service-line");
  serviceLine.append(createElement("span", "timeline-service", bookingProcedure(booking)));
  if (booking.nailArt === true || booking.nailArt === "true" || /nail\s*art/i.test(bookingProcedure(booking))) {
    serviceLine.append(createElement("span", "nailart-badge", "Nail Art"));
  }
  details.append(customerLine, phone, serviceLine);
  const observations = String(booking.observacoes || booking.observacao || "").trim();
  if (observations) details.append(createElement("p", "timeline-observations", observations));

  const side = createElement("div", "timeline-side");
  side.append(badgeForStatus(normalizeStatus(booking)));
  if (Number.isFinite(Number(booking.valor)) && Number(booking.valor) > 0) {
    side.append(createElement("strong", "timeline-price", currency(Number(booking.valor))));
  }
  card.append(timeBlock, details, side);

  const actions = createElement("div", "timeline-actions");
  if (phoneDigits.length >= 10 && phoneDigits.length <= 11) {
    const message = `Olá, ${booking.nome || "tudo bem"}! Passando para falar sobre seu atendimento de ${bookingProcedure(booking)} no dia ${booking.data ? formatShortDate(booking.data) : ""} às ${booking.horario || ""}.`;
    const whatsapp = createElement("a", "timeline-action is-whatsapp", "WhatsApp");
    whatsapp.href = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(message)}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    whatsapp.setAttribute("aria-label", `Enviar mensagem para ${booking.nome || "a cliente"} pelo WhatsApp`);
    actions.append(whatsapp);
  }
  const status = normalizeStatus(booking);
  if (status === "pendente") actions.append(createDialogButton("Confirmar", "confirmado", booking.id, "timeline-action"));
  if (status === "confirmado") actions.append(createDialogButton("Concluir", "concluido", booking.id, "timeline-action"));
  if (!isCancelled(booking) && status !== "concluido") {
    actions.append(createDialogButton("Cancelar", "cancelado", booking.id, "timeline-action is-subtle-danger"));
  }
  const edit = createElement("button", "timeline-action", "Reagendar / editar");
  edit.type = "button";
  edit.addEventListener("click", () => openRecordDialog("reschedule", booking.id));
  actions.append(edit);
  card.append(actions);
  return card;
};

const createBlockedSlotCard = (slot) => {
  const card = createElement("article", "timeline-card is-blocked");
  const timeBlock = createElement("div", "timeline-time");
  timeBlock.append(createElement("time", "", slot.horario || "—"));
  timeBlock.append(createElement("span", "", slot.data ? formatShortDate(slot.data) : "Data não informada"));
  const details = createElement("div", "timeline-details");
  details.append(createElement("div", "timeline-customer-line",
    slot.motivo || "Horário bloqueado"));
  details.append(createElement("span", "timeline-service", "Indisponível para agendamento online"));
  const side = createElement("div", "timeline-side");
  side.append(createElement("span", "status-badge is-cancelled", "Bloqueado"));
  const actions = createElement("div", "timeline-actions");
  const unblock = createElement("button", "timeline-action is-subtle-danger", "Desbloquear horário");
  unblock.type = "button";
  unblock.addEventListener("click", async () => {
    try {
      if (isDemoMode) blockedSlots = blockedSlots.filter((item) => item.id !== slot.id);
      else await runTransaction(db, async (transaction) => {
        const reference = doc(db, "horarios_ocupados", slot.id);
        const snapshot = await transaction.get(reference);
        if (snapshot.exists() && snapshot.data().bloqueio === true) transaction.delete(reference);
      });
      renderAppointmentsTable();
      showToast("Horário desbloqueado.");
    } catch (error) {
      showToast("Não foi possível desbloquear este horário.");
      console.error("Falha ao desbloquear horário:", error);
    }
  });
  actions.append(unblock);
  card.append(timeBlock, details, side, actions);
  return card;
};

const renderCalendar = () => {
  const label = document.querySelector("#calendar-month-label");
  const daysContainer = document.querySelector("#calendar-days");
  label.textContent = formatMonth(visibleMonth);
  daysContainer.replaceChildren();

  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const offset = firstDay.getDay();
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - offset);
  const todayKey = localDateIso(new Date());
  const selectedKey = localDateIso(selectedDate);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = localDateIso(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(date.getDate());
    button.setAttribute("aria-label", formatLongDate(date));
    if (date.getMonth() !== visibleMonth.getMonth()) button.classList.add("is-outside");
    if (dateKey === todayKey) button.classList.add("is-today");
    if (dateKey === selectedKey) button.classList.add("is-selected");
    if (bookingsForDate(dateKey).length) button.classList.add("has-bookings");
    button.addEventListener("click", () => {
      selectedDate = date;
      if (date.getMonth() !== visibleMonth.getMonth()) {
        visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      renderCalendar();
      renderSelectedDay();
    });
    daysContainer.append(button);
  }
};

const renderSelectedDay = () => {
  const label = document.querySelector("#selected-date-label");
  const feedback = document.querySelector("#appointments-feedback");
  const list = document.querySelector("#day-appointments-list");
  const selectedKey = localDateIso(selectedDate);
  const items = bookingsForDate(selectedKey);
  label.textContent = formatLongDate(selectedDate);
  list.replaceChildren();

  if (!items.length) {
    feedback.hidden = false;
    feedback.textContent = "Nenhum agendamento para este dia.";
    return;
  }

  feedback.hidden = true;
  items.slice(0, 4).forEach((booking) => list.append(createCompactBooking(booking)));
};

const createCompactBooking = (booking) => {
  const row = document.createElement("article");
  row.className = "day-booking";
  const initial = document.createElement("span");
  initial.className = "booking-initial";
  initial.textContent = (booking.nome || "C").trim().charAt(0).toUpperCase();
  const details = document.createElement("span");
  details.className = "booking-summary";
  const name = document.createElement("strong");
  name.textContent = booking.nome || "Cliente";
  const info = document.createElement("small");
  info.textContent = `${booking.procedimento || "Serviço"} · ${booking.horario || "Horário a definir"}`;
  details.append(name, info);
  const badge = document.createElement("span");
  badge.className = `status-badge${String(booking.status).toLowerCase() === "pendente" ? " is-pending" : ""}`;
  badge.textContent = statusLabel(booking.status);
  row.append(initial, details, badge);
  return row;
};

const changeMonth = (offset) => {
  visibleMonth = nextMonthStart(visibleMonth, offset);
  renderCalendar();
};

const monthBookings = (date) => {
  const start = monthStart(date);
  const end = nextMonthStart(start);
  return bookings.filter((booking) => {
    const parsed = appointmentMonth(booking);
    return parsed && dateInRange(parsed, start, end) && !isCancelled(booking);
  });
};

const completedBookingsForMonth = (date) => monthBookings(date).filter((booking) =>
  String(booking.status || "").toLowerCase() === "concluido");

const monthClients = (date) => {
  const start = monthStart(date);
  const end = nextMonthStart(start);
  return clients.filter((client) => {
    const created = toDate(client.criadoEm);
    return created && dateInRange(created, start, end) && client.ativo !== false;
  });
};

const variationLabel = (current, previous) => {
  if (previous <= 0) return current > 0 ? "Novo no período" : "Sem histórico anterior";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "↑ +" : "↓ "}${change}% em relação ao mês anterior`;
};

const renderPerformanceChart = (items) => {
  const weeks = [0, 0, 0, 0];
  items.forEach((booking) => {
    const date = appointmentMonth(booking);
    if (!date) return;
    const week = Math.min(3, Math.floor((date.getDate() - 1) / 7));
    weeks[week] += amountOf(booking);
  });

  let runningTotal = 0;
  const cumulativeWeeks = weeks.map((week) => {
    runningTotal += week;
    return runningTotal;
  });
  const points = [55, 165, 275, 385].map((x, index) => {
    const y = 146 - Math.min(1, cumulativeWeeks[index] / 6000) * 126;
    return { x, y };
  });
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  document.querySelectorAll(".performance-chart").forEach((chart) => {
    const lineElement = chart.querySelector("#chart-line, [data-chart-line]");
    const areaElement = chart.querySelector("#chart-area, [data-chart-area]");
    const pointGroup = chart.querySelector("#chart-points, [data-chart-points]");
    lineElement.setAttribute("d", line);
    areaElement.setAttribute("d", `${line} L385 146 L55 146 Z`);
    pointGroup.replaceChildren(...points.map(({ x, y }) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", "4");
      return circle;
    }));
  });
};

const renderMetrics = () => {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentBookings = monthBookings(now);
  const previousBookings = monthBookings(previousMonth);
  const completedThisMonth = completedBookingsForMonth(now);
  const completedPreviousMonth = completedBookingsForMonth(previousMonth);
  const currentClients = monthClients(now);
  const previousClients = monthClients(previousMonth);
  const revenue = completedThisMonth.reduce((total, booking) => total + amountOf(booking), 0);
  const previousRevenue = completedPreviousMonth.reduce((total, booking) => total + amountOf(booking), 0);

  document.querySelector("#metric-appointments").textContent = String(currentBookings.length);
  document.querySelector("#metric-appointments-change").textContent =
    variationLabel(currentBookings.length, previousBookings.length);
  document.querySelector("#metric-clients").textContent =
    String(clients.filter((client) => client.ativo !== false).length);
  document.querySelector("#metric-clients-change").textContent =
    variationLabel(currentClients.length, previousClients.length);
  document.querySelector("#metric-revenue").textContent = currency(revenue);
  document.querySelector("#metric-revenue-change").textContent = variationLabel(revenue, previousRevenue);
  const ratingValues = reviews.map((review) => Number(review.nota ?? review.rating ?? review.avaliacao))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageRating = ratingValues.length
    ? ratingValues.reduce((total, rating) => total + rating, 0) / ratingValues.length
    : null;
  document.querySelector("#metric-rating").textContent = averageRating === null ? "—" : averageRating.toFixed(1);
  document.querySelector("#metric-rating-description").textContent = ratingValues.length
    ? `${ratingValues.length} avaliações${isDemoMode ? " de demonstração" : ""}`
    : "Sem avaliações cadastradas";
  document.querySelector("#performance-total").textContent = currency(revenue);
  document.querySelector("#performance-change").textContent = variationLabel(revenue, previousRevenue);
  document.querySelector("#performance-period").textContent = formatMonth(now);
  renderPerformanceChart(completedThisMonth);

  const pendingCount = bookings.filter((booking) =>
    String(booking.status || "").toLowerCase() === "pendente" && !isCancelled(booking)
  ).length;
  const averageTicket = completedThisMonth.length ? revenue / completedThisMonth.length : 0;
  document.querySelector("#finance-total").textContent = currency(revenue);
  document.querySelector("#finance-average").textContent = currency(averageTicket);
  document.querySelector("#finance-pending").textContent = String(pendingCount);
  document.querySelector("#finance-completed-count").textContent =
    `${completedThisMonth.length} atendimento${completedThisMonth.length === 1 ? "" : "s"} concluído${completedThisMonth.length === 1 ? "" : "s"}`;
  document.querySelector("#finance-chart-total").textContent = currency(revenue);
  document.querySelector("#finance-chart-change").textContent = variationLabel(revenue, previousRevenue);
  document.querySelector("#finance-period").textContent = formatMonth(now);
  document.querySelector("#finance-weekly-summary").textContent =
    `${completedThisMonth.length} serviços · ${currency(revenue)} realizados`;
  renderCalendar();
  renderSelectedDay();
};

const createRandomCode = () => {
  if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
    throw new Error("Este navegador não oferece geração segura de códigos de reserva.");
  }
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const createRandomPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) {
    throw new Error("Informe um telefone com DDD e 10 ou 11 dígitos.");
  }
  return digits;
};

const syncLegacyAvailability = async () => {
  if (legacyAvailabilitySynced) return;
  legacyAvailabilitySynced = true;

  const snapshot = await getDocs(appointmentsReference);
  for (const appointment of snapshot.docs) {
    const initialData = appointment.data();
    if (isCancelled(initialData) || !initialData.data || !initialData.horario) continue;
    const bookingReference = doc(db, "agendamentos", appointment.id);
    await runTransaction(db, async (transaction) => {
      const currentBooking = await transaction.get(bookingReference);
      if (!currentBooking.exists() || isCancelled(currentBooking.data())) return;
      const booking = currentBooking.data();
      const slotId = booking.slotId || slotDocumentId(booking.data, booking.horario);
      const code = booking.codigoConsulta || createRandomCode();
      const slotReference = doc(db, "horarios_ocupados", slotId);
      const lookupReference = doc(db, "consultas_agendamento", code);
      const slot = await transaction.get(slotReference);
      const lookup = await transaction.get(lookupReference);
      if (!slot.exists()) {
        transaction.set(slotReference, {
          data: booking.data,
          horario: booking.horario,
          status: "ocupado",
          reservaId: appointment.id
        });
      }
      if (!booking.slotId || !booking.codigoConsulta) {
        transaction.update(bookingReference, { slotId, codigoConsulta: code });
      }
      if (!lookup.exists()) {
        transaction.set(lookupReference, {
          data: booking.data,
          horario: booking.horario,
          procedimento: booking.procedimento || "Procedimento",
          status: booking.status || "pendente",
          reservaId: appointment.id
        });
      }
    });
  }
};

const subscribeToData = () => {
  appointmentsLoaded = false;
  document.querySelector("#appointments-loading").hidden = false;
  document.querySelector("#appointments-table-empty").hidden = true;
  const syncAvailabilityIfNeeded = async () => {
    if (!Object.values(loadedCollections).every(Boolean) || isDemoMode || legacyAvailabilitySynced) return;
    try {
      await syncLegacyAvailability();
    } catch (error) {
      showToast("Não foi possível sincronizar os horários antigos. Verifique as regras do Firestore.");
      console.error("Falha ao migrar horários antigos para horarios_ocupados:", error);
    }
  };

  onSnapshot(appointmentsReference, async (snapshot) => {
    liveData.bookings = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => `${a.data || ""} ${a.horario || ""}`.localeCompare(`${b.data || ""} ${b.horario || ""}`));
    loadedCollections.bookings = true;
    refreshDataMode();
    appointmentsLoaded = true;
    renderAppointmentsTable();
    await syncAvailabilityIfNeeded();
    if (currentListType === "appointments" && listDialog.open) {
      renderList("appointments", currentListOptions);
    }
  }, (error) => {
    appointmentsLoaded = true;
    document.querySelector("#appointments-loading").hidden = true;
    document.querySelector("#appointments-table-empty").hidden = false;
    document.querySelector("#appointments-table-empty").textContent =
      "Não foi possível carregar os agendamentos. Verifique a conexão e tente novamente.";
    setDashboardError("Não foi possível carregar os agendamentos. Verifique as regras do Firestore.");
    console.error("Falha ao acompanhar agendamentos:", error);
  });

  onSnapshot(clientsReference, async (snapshot) => {
    liveData.clients = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    loadedCollections.clients = true;
    refreshDataMode();
    await syncAvailabilityIfNeeded();
    if (currentListType === "clients" && listDialog.open) renderList("clients");
  }, (error) => {
    setDashboardError("Não foi possível carregar as clientes. Verifique as regras do Firestore.");
    console.error("Falha ao acompanhar clientes:", error);
  });

  onSnapshot(servicesReference, async (snapshot) => {
    if (!siteServicesSeedStarted) {
      siteServicesSeedStarted = true;
      const existingNames = new Set(snapshot.docs.map((item) =>
        String(item.data().nome || "").trim().toLocaleLowerCase("pt-BR")));
      const missingServices = siteServices.filter((service) =>
        !existingNames.has(service.nome.toLocaleLowerCase("pt-BR")));

      if (missingServices.length > 0) {
        try {
          await Promise.all(missingServices.map((service) => setDoc(
            doc(servicesReference, service.id),
            { ...service, duracao: null, ativo: true, criadoEm: serverTimestamp() }
          )));
        } catch (error) {
          setDashboardError("Não foi possível cadastrar os serviços padrão. Verifique as permissões do Firestore.");
          console.error("Falha ao cadastrar os serviços padrão:", error);
        }
      }
    }

    liveData.services = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    loadedCollections.services = true;
    refreshDataMode();
    await syncAvailabilityIfNeeded();
    if (currentListType === "services" && listDialog.open) renderList("services");
  }, (error) => {
    setDashboardError("Não foi possível carregar os serviços. Verifique as regras do Firestore.");
    console.error("Falha ao acompanhar serviços:", error);
  });

  onSnapshot(reviewsReference, async (snapshot) => {
    liveData.reviews = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    loadedCollections.reviews = true;
    refreshDataMode();
    await syncAvailabilityIfNeeded();
  }, (error) => {
    setDashboardError("Não foi possível carregar as avaliações. Verifique as regras do Firestore.");
    console.error("Falha ao acompanhar avaliações:", error);
  });

  onSnapshot(occupiedSlotsReference, async (snapshot) => {
    liveData.blockedSlots = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((slot) => slot.bloqueio === true || slot.status === "bloqueado");
    loadedCollections.blockedSlots = true;
    refreshDataMode();
    await syncAvailabilityIfNeeded();
  }, (error) => {
    setDashboardError("Não foi possível carregar os horários bloqueados.");
    console.error("Falha ao acompanhar horários bloqueados:", error);
  });
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const appendCell = (row, value, className = "") => {
  const cell = createElement("td", className, value);
  row.append(cell);
  return cell;
};

const badgeForStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  const badge = createElement("span", "status-badge", statusLabel(status));
  if (normalized === "pendente") badge.classList.add("is-pending");
  if (normalized === "cancelado" || normalized === "cancelled") badge.classList.add("is-cancelled");
  if (normalized === "concluido") badge.classList.add("is-completed");
  if (normalized === "confirmado") badge.classList.add("is-confirmed");
  return badge;
};

const formatShortDate = (dateKey) => {
  const date = parseDate(dateKey);
  return date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "—";
};

const renderAppointmentsTable = () => {
  const timeline = document.querySelector("#appointments-timeline");
  const search = document.querySelector("#appointments-search").value.trim().toLocaleLowerCase("pt-BR");
  const searchDigits = search.replace(/\D/g, "");
  const statusFilter = document.querySelector("#appointments-filter").value;
  const searchResults = bookingsInRange(appointmentsDateRange, appointmentsSelectedDate)
    .filter((booking) => statusFilter === "all" || normalizeStatus(booking) === statusFilter)
    .filter((booking) => {
      const text = `${booking.nome || ""} ${booking.telefone || ""}`.toLocaleLowerCase("pt-BR");
      return text.includes(search) || (searchDigits && String(booking.telefone || "").replace(/\D/g, "").includes(searchDigits));
    })
    .map((booking) => ({ kind: "booking", date: booking.data, time: booking.horario || "", item: booking }));
  const slotResults = statusFilter === "all" ? blockedSlots
    .filter((slot) => appointmentsDateRange === "week"
      ? (() => {
        const date = parseDate(slot.data);
        if (!date) return false;
        const start = new Date(appointmentsSelectedDate.getFullYear(), appointmentsSelectedDate.getMonth(), appointmentsSelectedDate.getDate(), 12);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return dateInRange(date, start, end);
      })()
      : slot.data === localDateIso(appointmentsSelectedDate))
    .map((slot) => ({ kind: "blocked", date: slot.data, time: slot.horario || "", item: slot })) : [];
  const items = [...searchResults, ...slotResults]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  timeline.replaceChildren();
  items.forEach((entry) => timeline.append(
    entry.kind === "blocked" ? createBlockedSlotCard(entry.item) : createTimelineBooking(entry.item)
  ));
  document.querySelector("#appointments-loading").hidden = appointmentsLoaded;
  const empty = document.querySelector("#appointments-table-empty");
  empty.hidden = !appointmentsLoaded || items.length > 0;
  const rangeLabel = appointmentsDateRange === "week"
    ? "Esta semana"
    : appointmentsDateRange === "tomorrow"
      ? "Agenda de amanhã"
      : appointmentsDateRange === "today"
        ? "Agenda de hoje"
        : `Agenda de ${formatShortDate(localDateIso(appointmentsSelectedDate))}`;
  document.querySelector("#appointments-list-heading").textContent = rangeLabel;
  document.querySelector("#appointments-list-count").textContent =
    `${items.length} ${items.length === 1 ? "item" : "itens"}`;
  updateAppointmentSummary();
};

const renderClientsTable = () => {
  const body = document.querySelector("#clients-table-body");
  const search = document.querySelector("#clients-search").value.trim().toLocaleLowerCase("pt-BR");
  const items = clients.filter((client) =>
    `${client.nome || ""} ${client.telefone || ""} ${client.email || ""} ${client.instagram || ""}`
      .toLocaleLowerCase("pt-BR").includes(search));
  body.replaceChildren();
  items.forEach((client) => {
    const row = document.createElement("tr");
    appendCell(row, client.nome || "Cliente");
    appendCell(row, client.telefone || "—");
    appendCell(row, client.email || "—");
    appendCell(row, client.instagram || "—");
    const history = bookings.filter((booking) => booking.telefone === client.telefone).length;
    const historyCell = appendCell(row, `${history} atendimento${history === 1 ? "" : "s"}`);
    if (client.ativo === false) historyCell.append(createElement("small", "table-summary", " · Inativa"));
    body.append(row);
  });
  document.querySelector("#clients-total").textContent = `${items.length} de ${clients.length} clientes`;
  document.querySelector("#clients-table-empty").hidden = items.length > 0;
};

const renderServicesTable = () => {
  const body = document.querySelector("#services-table-body");
  body.replaceChildren();
  services.forEach((service) => {
    const row = document.createElement("tr");
    appendCell(row, service.nome || "Serviço");
    appendCell(row, service.descricao || "—");
    appendCell(row, service.duracao ? `${service.duracao} min` : "—");
    appendCell(row, typeof service.valor === "number" && Number.isFinite(service.valor)
      ? currency(service.valor)
      : "Sob consulta");
    const statusCell = document.createElement("td");
    statusCell.append(badgeForStatus(service.ativo === false ? "cancelado" : "confirmado"));
    statusCell.lastElementChild.textContent = service.ativo === false ? "Inativo" : "Ativo";
    row.append(statusCell);
    body.append(row);
  });
  document.querySelector("#services-table-empty").hidden = services.length > 0;
};

const renderFinanceTable = () => {
  const body = document.querySelector("#finance-table-body");
  const completed = completedBookingsForMonth(new Date())
    .sort((a, b) => `${b.data || ""} ${b.horario || ""}`.localeCompare(`${a.data || ""} ${a.horario || ""}`));
  body.replaceChildren();
  completed.forEach((booking) => {
    const row = document.createElement("tr");
    appendCell(row, booking.nome || "Cliente");
    appendCell(row, booking.procedimento || "Serviço");
    appendCell(row, formatShortDate(booking.data));
    appendCell(row, currency(amountOf(booking)));
    body.append(row);
  });
  document.querySelector("#finance-table-empty").hidden = completed.length > 0;
};

const relativeTime = (date) => {
  if (!date) return "Horário não informado";
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return "Agora";
  if (Math.abs(minutes) < 60) return minutes < 0 ? `Há ${Math.abs(minutes)} min` : `Em ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours < 0 ? `Há ${Math.abs(hours)} h` : `Em ${hours} h`;
  const days = Math.round(hours / 24);
  return days < 0 ? `Há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}` : `Em ${days} dia${days === 1 ? "" : "s"}`;
};

const getNotifications = () => {
  const items = bookings.map((booking) => {
    const status = String(booking.status || "").toLowerCase();
    const titles = {
      pendente: "Novo agendamento aguardando confirmação",
      confirmado: "Agendamento confirmado",
      concluido: "Atendimento concluído",
      cancelado: "Agendamento cancelado"
    };
    const eventDate = toDate(booking.atualizadoEm) || toDate(booking.criadoEm)
      || parseDate(booking.data);
    return {
      id: `${booking.id}:${status}`,
      title: titles[status] || "Atualização de agendamento",
      message: `${booking.nome || "Cliente"} · ${booking.procedimento || "Serviço"} · ${booking.data || "Data a definir"} às ${booking.horario || "—"}`,
      date: eventDate
    };
  });
  const pendingCount = bookings.filter((booking) =>
    String(booking.status || "").toLowerCase() === "pendente" && !isCancelled(booking)
  ).length;
  if (pendingCount) {
    items.push({
      id: `pending-alert:${pendingCount}`,
      title: "Atenção: confirmações pendentes",
      message: `${pendingCount} agendamento${pendingCount === 1 ? "" : "s"} aguardando confirmação da equipe.`,
      date: new Date()
    });
  }
  return items.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
};

const renderNotifications = () => {
  const items = getNotifications();
  const unreadCount = items.filter((item) => !readNotificationIds.has(item.id)).length;
  document.querySelector("#notification-count").textContent = String(Math.min(unreadCount, 99));
  notificationsButton.setAttribute("aria-label", `${unreadCount} notificações não lidas`);
  document.querySelector("#mark-notifications-read").disabled = unreadCount === 0;
  notificationList.replaceChildren();
  if (!items.length) {
    notificationList.append(createElement("p", "notification-empty", "Você não tem notificações recentes."));
    return;
  }
  items.forEach((item) => {
    const button = createElement("button", `notification-item${readNotificationIds.has(item.id) ? "" : " is-unread"}`);
    button.type = "button";
    const dot = createElement("span", "notification-dot");
    dot.setAttribute("aria-hidden", "true");
    const content = document.createElement("span");
    content.append(createElement("strong", "", item.title));
    content.append(createElement("p", "", item.message));
    content.append(createElement("time", "", relativeTime(item.date)));
    button.append(dot, content);
    button.addEventListener("click", () => {
      readNotificationIds.add(item.id);
      renderNotifications();
      notificationsPopover.hidden = true;
      notificationsButton.setAttribute("aria-expanded", "false");
      document.querySelector("#appointments-search").value = "";
      document.querySelector("#appointments-filter").value = "all";
      showView("appointments");
    });
    notificationList.append(button);
  });
};

const createDialogButton = (label, action, bookingId, className = "") => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", async () => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    button.disabled = true;
    try {
      await updateBookingStatus(booking, action);
      showToast(`Agendamento ${statusLabel(action).toLowerCase()}.`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || "Não foi possível atualizar o agendamento.");
      console.error("Falha ao atualizar status do agendamento:", error);
    }
  });
  return button;
};

const renderList = (type, options = {}) => {
  currentListType = type;
  currentListOptions = options;
  listContent.replaceChildren();
  const titleByType = {
    appointments: options.pendingOnly ? "Agendamentos pendentes" : "Todos os agendamentos",
    clients: "Clientes cadastradas",
    services: "Serviços do Studio",
    content: "Conteúdo do Site"
  };
  listTitle.textContent = titleByType[type] || "Painel";

  if (type === "content") {
    listContent.append(createElement("p", "empty-state",
      "As páginas públicas ainda são editadas nos arquivos do site. Esta área não altera o conteúdo automaticamente."));
    return;
  }

  const source = type === "appointments"
    ? bookings.filter((booking) => !options.pendingOnly || String(booking.status).toLowerCase() === "pendente")
    : type === "clients" ? clients : services;
  if (!source.length) {
    listContent.append(createElement("p", "empty-state",
      type === "appointments" ? "Nenhum agendamento encontrado." :
        type === "clients" ? "Nenhuma cliente cadastrada." : "Nenhum serviço cadastrado."));
    return;
  }

  source.forEach((item) => {
    const row = createElement("article", "dialog-list-item");
    const details = document.createElement("div");
    const title = createElement("strong", "", type === "appointments"
      ? item.nome || "Cliente" : item.nome || "Sem nome");
    const description = createElement("p", "", type === "appointments"
      ? `${item.procedimento || "Serviço"} · ${item.data || "Sem data"} · ${item.horario || "Sem horário"} · ${statusLabel(item.status)}`
      : type === "clients"
        ? `${item.telefone || "Sem telefone"}${item.email ? ` · ${item.email}` : ""}${item.ativo === false ? " · Inativa" : ""}`
        : `${item.descricao || "Sem descrição"} · ${item.duracao ? `${item.duracao} min` : "Duração não informada"} · ${currency(Number(item.valor) || 0)}`);
    details.append(title, description);
    if (type === "appointments" && item.codigoConsulta) {
      details.append(createElement("p", "", `Código da reserva: ${item.codigoConsulta}`));
    }
    row.append(details);

    if (type === "appointments" && !isCancelled(item)
      && String(item.status || "").toLowerCase() !== "concluido") {
      const actions = createElement("div", "dialog-list-actions");
      if (item.codigoConsulta) {
        const copyCode = document.createElement("button");
        copyCode.type = "button";
        copyCode.textContent = "Copiar código";
        copyCode.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(item.codigoConsulta);
            showToast("Código de consulta copiado.");
          } catch (error) {
            showToast("Não foi possível copiar. Selecione o código manualmente no registro.");
            console.error("Falha ao copiar código de consulta:", error);
          }
        });
        actions.append(copyCode);
      }
      const currentStatus = String(item.status || "").toLowerCase();
      if (currentStatus === "pendente") {
        actions.append(createDialogButton("Confirmar", "confirmado", item.id));
      }
      if (currentStatus === "confirmado") {
        actions.append(createDialogButton("Concluir", "concluido", item.id));
      }
      actions.append(createDialogButton("Cancelar", "cancelado", item.id));
      row.append(actions);
    }
    listContent.append(row);
  });
};

const openList = (type, options = {}) => {
  renderList(type, options);
  if (!listDialog.open) listDialog.showModal();
};

const updateBookingStatus = async (booking, status) => {
  if (isDemoMode) {
    const demoBooking = bookings.find((item) => item.id === booking.id);
    if (!demoBooking) throw new Error("Este agendamento não existe mais.");
    demoBooking.status = status;
    demoBooking.atualizadoEm = new Date();
    renderAllData();
    return;
  }

  const bookingReference = doc(db, "agendamentos", booking.id);
  const slotId = booking.slotId || (booking.data && booking.horario
    ? slotDocumentId(booking.data, booking.horario)
    : "");
  const slotReference = slotId ? doc(db, "horarios_ocupados", slotId) : null;
  const lookupReference = booking.codigoConsulta
    ? doc(db, "consultas_agendamento", booking.codigoConsulta)
    : null;

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingReference);
    if (!bookingSnapshot.exists()) throw new Error("Este agendamento não existe mais.");

    let slotSnapshot = null;
    let lookupSnapshot = null;
    if (status === "cancelado" && slotReference) slotSnapshot = await transaction.get(slotReference);
    if (lookupReference) lookupSnapshot = await transaction.get(lookupReference);

    transaction.update(bookingReference, { status, atualizadoEm: serverTimestamp() });
    if (status === "cancelado" && slotSnapshot && slotSnapshot.exists()
      && slotSnapshot.data().reservaId === booking.id) {
      transaction.delete(slotReference);
    }
    if (lookupSnapshot && lookupSnapshot.exists()) {
      transaction.update(lookupReference, { status });
    }
  });
};

const fieldMarkup = ({ label, name, type = "text", required = false, wide = false, placeholder = "", value = "", options = "", min = "", step = "" }) => {
  const classes = `dialog-field${wide ? " is-wide" : ""}`;
  const requiredAttribute = required ? "required" : "";
  const minAttribute = min ? `min="${min}"` : "";
  const stepAttribute = step ? `step="${step}"` : "";
  if (type === "select") {
    return `<label class="${classes}"><span>${label}</span><select name="${name}" ${requiredAttribute}>${options}</select></label>`;
  }
  if (type === "textarea") {
    return `<label class="${classes}"><span>${label}</span><textarea name="${name}" placeholder="${placeholder}" ${requiredAttribute}></textarea></label>`;
  }
  return `<label class="${classes}"><span>${label}</span><input name="${name}" type="${type}" value="${value}" placeholder="${placeholder}" ${requiredAttribute} ${minAttribute} ${stepAttribute}></label>`;
};

const openRecordDialog = (type, bookingId = null) => {
  currentRecordType = type;
  editingBookingId = bookingId;
  recordFeedback.textContent = "";
  recordFields.replaceChildren();
  const now = new Date();
  const today = localDateIso(now);
  const existingBooking = bookingId ? bookings.find((booking) => booking.id === bookingId) : null;
  const appointmentType = type === "appointment" || type === "reschedule";
  if (type === "reschedule" && !existingBooking) {
    showToast("Este agendamento não está mais disponível para edição.");
    return;
  }
  const fieldValue = (name, fallback = "") => existingBooking && existingBooking[name] !== undefined
    ? String(existingBooking[name])
    : fallback;
  const existingHasNailArt = existingBooking && (
    existingBooking.nailArt === true || existingBooking.nailArt === "true"
    || /nail\s*art/i.test(bookingProcedure(existingBooking))
  );
  const selectedEditStatus = existingBooking && !isCancelled(existingBooking)
    ? normalizeStatus(existingBooking)
    : "pendente";
  const statusOptions = (status) => ["pendente", "confirmado", "concluido", "cancelado"]
    .map((value) => `<option value="${value}"${value === status ? " selected" : ""}>${statusLabel(value)}</option>`)
    .join("");
  const templates = {
    appointment: {
      title: "Novo agendamento",
      fields: [
        fieldMarkup({ label: "Nome da cliente", name: "nome", required: true }),
        fieldMarkup({ label: "WhatsApp", name: "telefone", type: "tel", required: true, placeholder: "(31) 99999-9999" }),
        fieldMarkup({ label: "E-mail (opcional)", name: "email", type: "email", placeholder: "cliente@email.com" }),
        fieldMarkup({ label: "Procedimento", name: "procedimento", required: true }),
        fieldMarkup({ label: "Data", name: "data", type: "date", required: true, value: today }),
        fieldMarkup({ label: "Horário", name: "horario", type: "time", required: true }),
        fieldMarkup({ label: "Valor previsto (R$)", name: "valor", type: "number", min: "0", step: "0.01", placeholder: "0,00" }),
        fieldMarkup({ label: "Status", name: "status", type: "select", options: '<option value="pendente" selected>Pendente</option><option value="confirmado">Confirmado</option>' }),
        fieldMarkup({ label: "Inclui Nail Art?", name: "nailArt", type: "select", options: '<option value="false" selected>Não</option><option value="true">Sim</option>' }),
        fieldMarkup({ label: "Observações", name: "observacoes", type: "textarea", wide: true, placeholder: "Preferências ou detalhes do atendimento." })
      ]
    },
    reschedule: {
      title: "Reagendar / editar atendimento",
      fields: [
        fieldMarkup({ label: "Nome da cliente", name: "nome", required: true, value: fieldValue("nome") }),
        fieldMarkup({ label: "WhatsApp", name: "telefone", type: "tel", required: true, value: fieldValue("telefone") }),
        fieldMarkup({ label: "E-mail (opcional)", name: "email", type: "email", value: fieldValue("email") }),
        fieldMarkup({ label: "Procedimento", name: "procedimento", required: true, value: fieldValue("procedimento", fieldValue("servico")) }),
        fieldMarkup({ label: "Data", name: "data", type: "date", required: true, value: fieldValue("data", today) }),
        fieldMarkup({ label: "Horário", name: "horario", type: "time", required: true, value: fieldValue("horario") }),
        fieldMarkup({ label: "Valor previsto (R$)", name: "valor", type: "number", min: "0", step: "0.01", value: fieldValue("valor") }),
        fieldMarkup({ label: "Status", name: "status", type: "select", options: statusOptions(selectedEditStatus) }),
        fieldMarkup({ label: "Inclui Nail Art?", name: "nailArt", type: "select", options: `<option value="false"${existingHasNailArt ? "" : " selected"}>Não</option><option value="true"${existingHasNailArt ? " selected" : ""}>Sim</option>` }),
        fieldMarkup({ label: "Observações", name: "observacoes", type: "textarea", wide: true, placeholder: "Preferências ou detalhes do atendimento.", value: fieldValue("observacoes", fieldValue("observacao")) })
      ]
    },
    client: {
      title: "Cadastrar cliente",
      fields: [
        fieldMarkup({ label: "Nome completo", name: "nome", required: true }),
        fieldMarkup({ label: "WhatsApp", name: "telefone", type: "tel", required: true, placeholder: "(31) 99999-9999" }),
        fieldMarkup({ label: "E-mail (opcional)", name: "email", type: "email", placeholder: "cliente@email.com" }),
        fieldMarkup({ label: "Instagram (opcional)", name: "instagram", placeholder: "@usuario" })
      ]
    },
    service: {
      title: "Adicionar serviço",
      fields: [
        fieldMarkup({ label: "Nome do serviço", name: "nome", required: true }),
        fieldMarkup({ label: "Preço (R$)", name: "valor", type: "number", required: true, min: "0", step: "0.01", placeholder: "0,00" }),
        fieldMarkup({ label: "Duração (minutos)", name: "duracao", type: "number", min: "0", step: "5", placeholder: "Ex.: 90" }),
        fieldMarkup({ label: "Descrição", name: "descricao", type: "textarea", wide: true, placeholder: "Descreva brevemente o serviço." })
      ]
    }
  };
  const template = templates[type];
  if (!template) return;
  if (type === "reschedule") currentRecordType = "reschedule";
  if (appointmentType && existingBooking) currentRecordType = type;
  recordTitle.textContent = template.title;
  recordFields.innerHTML = template.fields.join("");
  if (existingBooking) {
    const nailArtField = recordFields.querySelector('[name="nailArt"]');
    if (nailArtField) nailArtField.value = String(Boolean(existingHasNailArt));
    const notesField = recordFields.querySelector('[name="observacoes"]');
    if (notesField) notesField.value = existingBooking.observacoes || existingBooking.observacao || "";
  }
  const phoneField = recordFields.querySelector('[name="telefone"]');
  if (phoneField) {
    phoneField.addEventListener("input", () => {
      let digits = phoneField.value.replace(/\D/g, "").slice(0, 11);
      if (digits.length > 2) {
        const area = digits.slice(0, 2);
        const number = digits.slice(2);
        const split = number.length > 8 ? 5 : 4;
        digits = `(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ""}`;
      }
      phoneField.value = digits;
    });
  }
  recordDialog.showModal();
};

const saveAppointment = async (values) => {
  const nome = String(values.get("nome") || "").trim();
  const telefone = createRandomPhone(values.get("telefone"));
  const data = String(values.get("data") || "");
  const horario = String(values.get("horario") || "");
  const procedimento = String(values.get("procedimento") || "").trim();
  const nailArt = values.get("nailArt") === "true" || /nail\s*art/i.test(procedimento);
  const observacoes = String(values.get("observacoes") || "").trim();
  const status = String(values.get("status") || "pendente");
  const valor = Number(values.get("valor")) || 0;
  if (!parseDate(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    throw new Error("Informe uma data e um horário válidos.");
  }

  const originalBooking = editingBookingId
    ? bookings.find((booking) => booking.id === editingBookingId)
    : null;
  if (editingBookingId && !originalBooking) throw new Error("Este agendamento não existe mais.");

  if (isDemoMode) {
    const newSlotId = slotDocumentId(data, horario);
    if (status !== "cancelado" && (bookings.some((booking) => booking.id !== editingBookingId
      && booking.slotId === newSlotId && !isCancelled(booking))
      || blockedSlots.some((slot) => slot.id === newSlotId))) {
      throw new Error("Este horário já está ocupado. Escolha outro.");
    }
    const bookingData = {
      nome,
      telefone,
      email: String(values.get("email") || "").trim() || null,
      procedimento,
      data,
      horario,
      status,
      valor,
      nailArt,
      observacoes: observacoes || null,
      slotId: newSlotId,
      atualizadoEm: new Date()
    };
    if (originalBooking) {
      Object.assign(originalBooking, bookingData);
    } else {
      bookings.push({
        id: `demo-booking-${Date.now()}`,
        ...bookingData,
        codigoConsulta: createRandomCode(),
        criadoEm: new Date()
      });
    }
    renderAllData();
    return;
  }

  if (originalBooking) {
    const bookingReference = doc(db, "agendamentos", originalBooking.id);
    const oldSlotId = originalBooking.slotId || slotDocumentId(originalBooking.data, originalBooking.horario);
    const newSlotId = slotDocumentId(data, horario);
    const oldSlotReference = doc(db, "horarios_ocupados", oldSlotId);
    const newSlotReference = doc(db, "horarios_ocupados", newSlotId);
    const lookupReference = originalBooking.codigoConsulta
      ? doc(db, "consultas_agendamento", originalBooking.codigoConsulta)
      : null;
    await runTransaction(db, async (transaction) => {
      const currentBooking = await transaction.get(bookingReference);
      if (!currentBooking.exists()) throw new Error("Este agendamento não existe mais.");
      const targetSlot = await transaction.get(newSlotReference);
      const previousSlot = oldSlotId === newSlotId
        ? targetSlot
        : await transaction.get(oldSlotReference);
      const lookup = lookupReference ? await transaction.get(lookupReference) : null;
      if (status !== "cancelado" && targetSlot.exists() && (oldSlotId !== newSlotId
        || targetSlot.data().reservaId !== originalBooking.id)) {
        throw new Error("Este horário já está ocupado. Escolha outro.");
      }
      transaction.update(bookingReference, {
        nome,
        telefone,
        email: String(values.get("email") || "").trim() || null,
        procedimento,
        data,
        horario,
        status,
        valor,
        nailArt,
        observacoes: observacoes || null,
        slotId: newSlotId,
        atualizadoEm: serverTimestamp()
      });
      if ((status === "cancelado" || oldSlotId !== newSlotId) && previousSlot.exists()
        && previousSlot.data().reservaId === originalBooking.id) {
        transaction.delete(oldSlotReference);
      }
      if (status !== "cancelado") {
        transaction.set(newSlotReference, {
          data,
          horario,
          status: "ocupado",
          reservaId: originalBooking.id
        });
      }
      if (lookup && lookup.exists()) {
        transaction.update(lookupReference, { data, horario, procedimento, status });
      }
    });
    return;
  }

  const slotId = slotDocumentId(data, horario);
  const slotReference = doc(db, "horarios_ocupados", slotId);
  const bookingReference = doc(collection(db, "agendamentos"));
  const code = createRandomCode();
  const lookupReference = doc(db, "consultas_agendamento", code);
  const bookingData = {
    nome,
    telefone,
    email: String(values.get("email") || "").trim() || null,
    procedimento,
    data,
    horario,
    status,
    valor,
    nailArt,
    observacoes: observacoes || null,
    slotId,
    codigoConsulta: code,
    criadoEm: serverTimestamp()
  };

  await runTransaction(db, async (transaction) => {
    const slot = await transaction.get(slotReference);
    if (slot.exists()) throw new Error("Este horário já está ocupado. Escolha outro.");
    transaction.set(bookingReference, bookingData);
    transaction.set(slotReference, { data, horario, status: "ocupado", reservaId: bookingReference.id });
    transaction.set(lookupReference, {
      data,
      horario,
      procedimento,
      status: bookingData.status,
      reservaId: bookingReference.id
    });
  });
};

const openBlockDialog = () => {
  const dateField = blockForm.querySelector('[name="data"]');
  const timeField = blockForm.querySelector('[name="horario"]');
  blockForm.reset();
  dateField.value = localDateIso(appointmentsSelectedDate);
  timeField.value = "";
  timeField.required = true;
  document.querySelector("#block-time-field").hidden = false;
  document.querySelector("#block-feedback").textContent = "";
  blockDialog.showModal();
};

blockForm.querySelector('[name="diaInteiro"]').addEventListener("change", (event) => {
  const allDay = event.currentTarget.checked;
  blockForm.querySelector('[name="horario"]').required = !allDay;
  document.querySelector("#block-time-field").hidden = allDay;
});

const blockSelectedTime = async (values) => {
  const data = String(values.get("data") || "");
  const horario = String(values.get("horario") || "");
  const motivo = String(values.get("motivo") || "").trim();
  const allDay = values.get("diaInteiro") === "on";
  if (!parseDate(data) || (!allDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario))) {
    throw new Error("Informe uma data e um horário válidos.");
  }
  let times = [horario];
  if (allDay) {
    if (isDemoMode) {
      times = Array.from({ length: 10 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`);
    } else {
      const agenda = await getDoc(agendaReference);
      const configuredTimes = agenda.exists() && Array.isArray(agenda.data().horariosPadrao)
        ? agenda.data().horariosPadrao
        : [];
      times = configuredTimes
        .map((time) => typeof time === "string" ? time : time.hora || time.time || "")
        .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
      if (!times.length) throw new Error("Configure os horários padrão da agenda antes de bloquear o dia inteiro.");
    }
  }
  const slots = times.map((time) => ({ id: slotDocumentId(data, time), time }));
  const existingAppointments = bookings.filter((booking) => booking.data === data && !isCancelled(booking));
  if (allDay && existingAppointments.length) {
    throw new Error("Há agendamentos neste dia. Reagende ou cancele-os antes de marcar a folga.");
  }
  if (isDemoMode) {
    const occupied = slots.filter(({ id }) =>
      bookings.some((booking) => booking.slotId === id && !isCancelled(booking))
      || blockedSlots.some((slot) => slot.id === id));
    if (occupied.length) {
      throw new Error(`Já existem horários ocupados: ${occupied.map((slot) => slot.time).join(", ")}.`);
    }
    blockedSlots.push(...slots.map(({ id, time }) => ({
      id, data, horario: time, motivo: motivo || (allDay ? "Folga" : ""), status: "bloqueado", bloqueio: true
    })));
    renderAppointmentsTable();
    return;
  }

  const slotReferences = slots.map(({ id }) => doc(db, "horarios_ocupados", id));
  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(slotReferences.map((reference) => transaction.get(reference)));
    const occupied = snapshots
      .map((snapshot, index) => ({ snapshot, time: slots[index].time }))
      .filter(({ snapshot }) => snapshot.exists());
    if (occupied.length) {
      throw new Error(`Já existem horários ocupados: ${occupied.map((slot) => slot.time).join(", ")}.`);
    }
    slotReferences.forEach((reference, index) => transaction.set(reference, {
      data,
      horario: slots[index].time,
      status: "bloqueado",
      bloqueio: true,
      motivo: motivo || (allDay ? "Folga" : null),
      criadoEm: serverTimestamp()
    }));
  });
};

const saveRecord = async (values) => {
  if (currentRecordType === "appointment" || currentRecordType === "reschedule") {
    await saveAppointment(values);
    return currentRecordType === "reschedule"
      ? "Agendamento atualizado. A disponibilidade do horário foi sincronizada."
      : "Agendamento criado e horário reservado.";
  }

  if (currentRecordType === "client") {
    const telefone = createRandomPhone(values.get("telefone"));
    const clientData = {
      nome: String(values.get("nome") || "").trim(),
      telefone,
      email: String(values.get("email") || "").trim() || null,
      instagram: String(values.get("instagram") || "").trim() || null,
      ativo: true,
      criadoEm: isDemoMode ? new Date() : serverTimestamp()
    };
    if (isDemoMode) {
      clients.push({ id: `demo-client-${Date.now()}`, ...clientData });
      renderAllData();
      return "Cliente cadastrada somente nesta demonstração.";
    }
    await setDoc(doc(clientsReference), {
      ...clientData,
      criadoEm: serverTimestamp()
    });
    return "Cliente cadastrada.";
  }

  if (currentRecordType === "service") {
    const serviceData = {
      nome: String(values.get("nome") || "").trim(),
      descricao: String(values.get("descricao") || "").trim(),
      valor: Number(values.get("valor")) || 0,
      duracao: Number(values.get("duracao")) || null,
      ativo: true
    };
    if (isDemoMode) {
      services.push({ id: `demo-service-${Date.now()}`, ...serviceData });
      renderAllData();
      return "Serviço adicionado somente nesta demonstração.";
    }
    await setDoc(doc(servicesReference), {
      ...serviceData,
      ativo: true,
      criadoEm: serverTimestamp()
    });
    return "Serviço adicionado.";
  }

  throw new Error("Tipo de cadastro inválido.");
};

const monthKeyLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return formatMonth(new Date(year, month - 1, 1));
};

const availableMonthKeys = () => {
  const firstMonth = monthStart(new Date());
  const monthKeys = new Set(openMonths);
  for (let offset = 0; offset < 12; offset += 1) {
    const month = nextMonthStart(firstMonth, offset);
    monthKeys.add(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...monthKeys].sort();
};

const renderAgendaSettings = () => {
  const selected = agendaMonthSelect.value;
  agendaMonthSelect.replaceChildren(...availableMonthKeys().map((month) =>
    new Option(monthKeyLabel(month), month)));
  agendaMonthSelect.value = selected && availableMonthKeys().includes(selected)
    ? selected
    : availableMonthKeys()[0];
  const monthOpen = openMonths.has(agendaMonthSelect.value);
  toggleMonthButton.textContent = monthOpen ? "Fechar mês" : "Abrir mês";
  agendaMonthStatus.textContent = monthOpen
    ? `${monthKeyLabel(agendaMonthSelect.value)} está aberto para agendamentos.`
    : `${monthKeyLabel(agendaMonthSelect.value)} está fechado para agendamentos.`;
};

const loadAgendaSettings = async () => {
  if (isDemoMode) {
    openMonths = new Set([`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`]);
    renderAgendaSettings();
    return;
  }
  const snapshot = await getDoc(agendaReference);
  const months = snapshot.exists() && Array.isArray(snapshot.data().mesesAbertos)
    ? snapshot.data().mesesAbertos
    : [];
  openMonths = new Set(months.filter((month) =>
    typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)));
  renderAgendaSettings();
};

const updateAgendaMonth = async () => {
  const month = agendaMonthSelect.value;
  if (!month) return;
  const isOpen = openMonths.has(month);
  toggleMonthButton.disabled = true;
  try {
    if (isDemoMode) {
      if (isOpen) openMonths.delete(month);
      else openMonths.add(month);
      renderAgendaSettings();
      document.querySelector("#settings-feedback").textContent =
        `Mês ${isOpen ? "fechado" : "aberto"} somente nesta demonstração.`;
      return;
    }
    await setDoc(agendaReference, {
      mesesAbertos: isOpen ? arrayRemove(month) : arrayUnion(month)
    }, { merge: true });
    await loadAgendaSettings();
    document.querySelector("#settings-feedback").textContent =
      `Mês ${isOpen ? "fechado" : "aberto"} com sucesso.`;
  } catch (error) {
    document.querySelector("#settings-feedback").textContent =
      "Não foi possível atualizar o mês da agenda.";
    console.error("Falha ao atualizar mês da agenda:", error);
  } finally {
    toggleMonthButton.disabled = false;
  }
};

const showReport = () => {
  currentListType = "report";
  currentListOptions = {};
  const now = new Date();
  const monthly = monthBookings(now);
  const completed = completedBookingsForMonth(now);
  const revenue = completed.reduce((total, booking) => total + amountOf(booking), 0);
  listTitle.textContent = `Resumo de ${formatMonth(now)}`;
  listContent.replaceChildren();
  const grid = createElement("div", "report-grid");
  [
    ["Agendamentos", String(monthly.length)],
    ["Agendamentos pendentes", String(monthly.filter((booking) =>
      String(booking.status || "").toLowerCase() === "pendente").length)],
    ["Serviços concluídos", String(completed.length)],
    ["Faturamento realizado", currency(revenue)],
    ["Clientes ativas", String(clients.filter((client) => client.ativo !== false).length)],
    ["Serviços ativos", String(services.filter((service) => service.ativo !== false).length)]
  ].forEach(([label, value]) => {
    const cell = createElement("div", "report-cell");
    cell.append(createElement("span", "", label), createElement("strong", "", value));
    grid.append(cell);
  });
  listContent.append(grid);
  listDialog.showModal();
};

document.querySelectorAll("[data-calendar-step]").forEach((button) => {
  button.addEventListener("click", () => changeMonth(Number(button.dataset.calendarStep)));
});

document.querySelectorAll("[data-create]").forEach((button) => {
  button.addEventListener("click", () => openRecordDialog(button.dataset.create));
});

document.querySelectorAll("[data-open-block]").forEach((button) => {
  button.addEventListener("click", openBlockDialog);
});

document.querySelectorAll("[data-open-list]").forEach((button) => {
  button.addEventListener("click", () => openList(button.dataset.openList));
});

document.querySelectorAll("[data-open-reports]").forEach((button) => {
  button.addEventListener("click", showReport);
});

const showView = (view) => {
  document.querySelectorAll("[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  document.querySelectorAll("[data-nav]").forEach((button) => {
    const active = button.dataset.nav === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  sidebar.classList.remove("is-open");
  mobileMenuToggle.setAttribute("aria-expanded", "false");
  if (view === "appointments") renderAppointmentsTable();
  if (view === "clients") renderClientsTable();
  if (view === "services") renderServicesTable();
  if (view === "finance") renderFinanceTable();
  if (view === "settings") loadAgendaSettings().catch((error) => {
    console.error("Falha ao carregar configurações da agenda:", error);
  });
  document.querySelector("#dashboard").scrollTo({ top: 0, behavior: "smooth" });
};

notificationsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = notificationsPopover.hidden;
  notificationsPopover.hidden = !willOpen;
  notificationsButton.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) renderNotifications();
});

document.querySelector("#mark-notifications-read").addEventListener("click", () => {
  getNotifications().forEach((item) => readNotificationIds.add(item.id));
  renderNotifications();
});

document.querySelectorAll("[data-demo-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    manualDemoOverride = isDemoMode ? false : true;
    setDemoMode(manualDemoOverride);
    showToast(isDemoMode
      ? "Dados de exemplo ativados nesta demonstração."
      : "Dados reais do Firestore restaurados.");
  });
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    showToast("Não foi possível encerrar a sessão. Tente novamente.");
    console.error("Falha ao encerrar sessão administrativa:", error);
  }
});

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.nav);
  });
});

mobileMenuToggle.addEventListener("click", () => {
  const expanded = mobileMenuToggle.getAttribute("aria-expanded") === "true";
  mobileMenuToggle.setAttribute("aria-expanded", String(!expanded));
  mobileMenuToggle.setAttribute("aria-label", expanded ? "Abrir menu" : "Fechar menu");
  sidebar.classList.toggle("is-open", !expanded);
});

recordForm.addEventListener("submit", async (event) => {
  if (event.submitter && event.submitter.value === "cancel") return;
  event.preventDefault();
  if (!recordForm.reportValidity()) return;
  const submitButton = recordForm.querySelector(".dialog-submit");
  submitButton.disabled = true;
  recordFeedback.textContent = "Salvando...";
  try {
    const message = await saveRecord(new FormData(recordForm));
    recordDialog.close();
    recordForm.reset();
    showToast(message);
  } catch (error) {
    recordFeedback.textContent = error.message || "Não foi possível salvar. Verifique os dados e tente novamente.";
    console.error("Falha ao salvar registro administrativo:", error);
  } finally {
    submitButton.disabled = false;
  }
});

recordFields.addEventListener("input", (event) => {
  if (!event.target.matches('[name="telefone"]')) return;
  let digits = event.target.value.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 2) {
    const area = digits.slice(0, 2);
    const number = digits.slice(2);
    const split = number.length > 8 ? 5 : 4;
    digits = `(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ""}`;
  }
  event.target.value = digits;
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => listDialog.close());
});

blockDialog.addEventListener("click", (event) => {
  if (event.target === blockDialog) blockDialog.close();
});

blockForm.addEventListener("submit", async (event) => {
  if (event.submitter && event.submitter.value === "cancel") return;
  event.preventDefault();
  if (!blockForm.reportValidity()) return;
  const submitButton = blockForm.querySelector(".dialog-submit");
  submitButton.disabled = true;
  document.querySelector("#block-feedback").textContent = "Bloqueando horário...";
  try {
    await blockSelectedTime(new FormData(blockForm));
    blockDialog.close();
    showToast("Horário bloqueado e indisponível para novos pedidos.");
  } catch (error) {
    document.querySelector("#block-feedback").textContent =
      error.message || "Não foi possível bloquear esse horário.";
    console.error("Falha ao bloquear horário:", error);
  } finally {
    submitButton.disabled = false;
  }
});

listDialog.addEventListener("click", (event) => {
  if (event.target === listDialog) listDialog.close();
});
recordDialog.addEventListener("click", (event) => {
  if (event.target === recordDialog) recordDialog.close();
});
notificationsPopover.addEventListener("click", (event) => event.stopPropagation());
agendaMonthSelect.addEventListener("change", renderAgendaSettings);
toggleMonthButton.addEventListener("click", updateAgendaMonth);

document.addEventListener("click", (event) => {
  if (!notificationsPopover.hidden
    && event.target !== notificationsButton
    && !notificationsButton.contains(event.target)
    && !notificationsPopover.contains(event.target)) {
    notificationsPopover.hidden = true;
    notificationsButton.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!notificationsPopover.hidden) {
    notificationsPopover.hidden = true;
    notificationsButton.setAttribute("aria-expanded", "false");
  }
  [recordDialog, listDialog].forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
  if (blockDialog.open) blockDialog.close();
});

const setDateLabel = () => {
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
};

setDateLabel();
renderCalendar();
renderSelectedDay();
renderAppointmentsTable();
renderClientsTable();
renderServicesTable();
renderFinanceTable();
renderNotifications();

const appointmentsDateInput = document.querySelector("#appointments-date");
appointmentsDateInput.value = localDateIso(appointmentsSelectedDate);

const selectAppointmentsRange = (range, date = new Date()) => {
  appointmentsSelectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  appointmentsDateRange = range;
  appointmentsDateInput.value = localDateIso(appointmentsSelectedDate);
  document.querySelectorAll("[data-date-range]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dateRange === range);
  });
  renderAppointmentsTable();
};

document.querySelectorAll("[data-date-range]").forEach((button) => {
  button.addEventListener("click", () => {
    const date = new Date();
    if (button.dataset.dateRange === "tomorrow") date.setDate(date.getDate() + 1);
    selectAppointmentsRange(button.dataset.dateRange, date);
  });
});

appointmentsDateInput.addEventListener("change", () => {
  const [year, month, day] = appointmentsDateInput.value.split("-").map(Number);
  if (year && month && day) selectAppointmentsRange("custom", new Date(year, month - 1, day, 12));
});

document.querySelector("#appointments-search").addEventListener("input", renderAppointmentsTable);
document.querySelector("#appointments-filter").addEventListener("change", renderAppointmentsTable);
document.querySelector("#clients-search").addEventListener("input", renderClientsTable);
document.querySelector("#toggle-forecast-visibility").addEventListener("click", () => {
  forecastHidden = !forecastHidden;
  updateAppointmentSummary();
});
loadAgendaSettings().catch((error) => {
  console.error("Falha ao carregar configurações da agenda:", error);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("admin.html");
    return;
  }
  if (!Array.isArray(adminUIDs) || !adminUIDs.includes(user.uid)) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Falha ao encerrar sessão sem permissão administrativa:", error);
    }
    window.location.replace("admin.html?error=not-admin");
    return;
  }

  const name = user.displayName && user.displayName.trim() ? user.displayName.trim() : "Camila";
  document.querySelector("#profile-name").textContent = name;
  document.querySelector("#welcome-name").textContent = name;
  statusMessage.hidden = true;
  app.hidden = false;
  subscribeToData();
});
