import { auth, db } from "../../firebase-config.js";
import "./main.js";
import {
  createCustomerAccount,
  customerAuthError,
  normalizePhone,
  signInCustomer
} from "./customer-auth.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const agendaReference = doc(db, "configuracoes", "agenda");
const schedulingDialog = document.querySelector(".scheduling-dialog");

if (schedulingDialog) {
  const form = schedulingDialog.querySelector(".new-client-form");
  const dateSelect = form.elements.date;
  const timeSelect = form.elements.time;
  const procedureInput = form.elements.procedure;
  const feedback = form.querySelector(".form-feedback");
  const nailArtOption = schedulingDialog.querySelector(".nailart-option");
  const submitButton = form.querySelector(".normal-schedule");
  const bookingCurrency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2
  });
  const existingForm = schedulingDialog.querySelector(".existing-client-login");
  const accountLoginForm = schedulingDialog.querySelector(".client-account-login");
  const appointmentsPanel = schedulingDialog.querySelector(".client-appointments");
  const appointmentsList = schedulingDialog.querySelector(".appointment-list");
  const appointmentsFeedback = schedulingDialog.querySelector(".appointments-feedback");
  const accountLoginFeedback = schedulingDialog.querySelector(".account-login-feedback");
  const vipAccessDialog = document.querySelector(".vip-access-dialog");
  const vipContinueButton = vipAccessDialog.querySelector(".vip-continue-button");
  const vipSnoozeButton = vipAccessDialog.querySelector(".vip-snooze-button");
  const vipCancelButton = vipAccessDialog.querySelector(".vip-cancel-button");
  const passwordFields = form.querySelectorAll(".account-password-field");
  const accountPasswordNote = form.querySelector(".account-password-note");
  let agendaSettings = null;
  let availableTimes = [];
  let currentCustomer = null;
  let resolveVipDecision = null;

  const createRandomCode = () => {
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw new Error("Este navegador não oferece geração segura de códigos de reserva.");
    }
    return [...window.crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };
  const localDateIso = (year, month, day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timestampMillis = (value) => {
    if (value && typeof value.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return null;
  };
  const validAppointmentCount = async (customer) => {
    const appointmentQueries = [
      query(
        collection(db, "agendamentos"),
        where("clienteUid", "==", customer.uid)
      )
    ];
    if (customer.emailVerified && customer.email) {
      appointmentQueries.push(query(
        collection(db, "agendamentos"),
        where("email", "==", customer.email.toLowerCase())
      ));
    }
    const snapshots = await Promise.all(appointmentQueries.map((appointmentQuery) =>
      getDocs(appointmentQuery)));
    const appointments = new Map();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((booking) => {
      appointments.set(booking.id, booking);
    }));
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return [...appointments.values()].filter((booking) => {
      const data = booking.data();
      const status = String(data.status || "").toLowerCase();
      const createdAt = timestampMillis(data.criadoEm);
      return !["cancelado", "cancelled"].includes(status)
        && createdAt !== null
        && createdAt >= cutoff
        && createdAt <= Date.now();
    }).length;
  };
  const decideVipPrompt = () => new Promise((resolve) => {
    resolveVipDecision = resolve;
    vipAccessDialog.showModal();
  });
  const settleVipPrompt = (decision) => {
    if (!resolveVipDecision) return;
    const resolve = resolveVipDecision;
    resolveVipDecision = null;
    vipAccessDialog.close();
    resolve(decision);
  };

  vipContinueButton.addEventListener("click", () => settleVipPrompt("continue"));
  vipSnoozeButton.addEventListener("click", () => settleVipPrompt("snooze"));
  vipCancelButton.addEventListener("click", () => settleVipPrompt("cancel"));
  vipAccessDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    settleVipPrompt("cancel");
  });

  onAuthStateChanged(auth, (user) => {
    currentCustomer = user;
    accountPasswordNote.hidden = Boolean(user);
    passwordFields.forEach((field) => {
      field.classList.toggle("is-hidden", Boolean(user));
      field.querySelector("input").required = !user;
    });
  });

  const getMonthKey = (value) => {
    if (typeof value === "string") {
      const isoMatch = value.match(/^(\d{4})-(\d{1,2})/);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}`;

      const brMatch = value.match(/^(\d{1,2})\/(\d{4})$/);
      if (brMatch) return `${brMatch[2]}-${brMatch[1].padStart(2, "0")}`;
    }

    if (value && typeof value === "object") {
      if (typeof value.toDate === "function") {
        const date = value.toDate();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (value.ano && value.mes) {
        return `${value.ano}-${String(value.mes).padStart(2, "0")}`;
      }
    }

    return "";
  };

  const getOpenDates = (months) => {
    const today = new Date();
    const todayIso = localDateIso(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const dates = [];

    months.forEach((value) => {
      const monthKey = getMonthKey(value);
      const match = monthKey.match(/^(\d{4})-(\d{2})$/);
      if (!match) return;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = localDateIso(year, month, day);
        if (date >= todayIso) dates.push(date);
      }
    });

    return dates.sort();
  };

  const setOptions = (select, placeholder, values) => {
    select.replaceChildren(new Option(placeholder, ""));
    values.forEach((value) => select.add(new Option(value.label, value.value)));
    select.disabled = values.length === 0;
  };

  const loadAgendaSettings = async () => {
    dateSelect.disabled = true;
    timeSelect.disabled = true;
    setOptions(dateSelect, "Carregando datas...", []);
    setOptions(timeSelect, "Selecione uma data primeiro", []);
    feedback.textContent = "";

    try {
      const snapshot = await getDoc(agendaReference);
      if (!snapshot.exists()) {
        throw new Error("O documento configuracoes/agenda não foi encontrado.");
      }

      const data = snapshot.data();
      const months = Array.isArray(data.mesesAbertos)
        ? data.mesesAbertos.filter((month) =>
          typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        : [];
      const dates = getOpenDates(months);
      const times = Array.isArray(data.horariosPadrao)
        ? data.horariosPadrao.filter((time) =>
          typeof time === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))
        : [];

      if (dates.length === 0 || times.length === 0) {
        throw new Error(
          "A agenda não possui datas e horários válidos. Confira mesesAbertos (AAAA-MM) e horariosPadrao (HH:mm) em configuracoes/agenda."
        );
      }

      agendaSettings = {
        dates,
        times: [...new Set(times)].sort()
      };

      setOptions(dateSelect, "Escolha uma data", dates.map((date) => ({
        value: date,
        label: new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "long"
        }).format(new Date(`${date}T12:00:00`))
      })));

    } catch (error) {
      agendaSettings = null;
      setOptions(dateSelect, "Não foi possível carregar as datas", []);
      feedback.textContent = error.message || "Erro ao consultar a agenda. Tente novamente.";
      console.error("Falha ao carregar agenda do Firestore:", error);
    }
  };

  document.addEventListener("scheduling:open", loadAgendaSettings);
  if (new URLSearchParams(window.location.search).has("agendar")
    || new URLSearchParams(window.location.search).has("consulta")) {
    document.dispatchEvent(new CustomEvent("scheduling:open"));
  }

  dateSelect.addEventListener("change", async () => {
    const selectedDate = dateSelect.value;
    setOptions(timeSelect, "Carregando horários...", []);

    if (!selectedDate || !agendaSettings?.dates.includes(selectedDate)) {
      setOptions(timeSelect, "Selecione uma data primeiro", []);
      return;
    }

    try {
      const bookingsQuery = query(
        collection(db, "horarios_ocupados"),
        where("data", "==", selectedDate)
      );
      const snapshot = await getDocs(bookingsQuery);
      const occupiedTimes = new Set(
        snapshot.docs
          .map((booking) => booking.data())
          .map((booking) => booking.horario || booking.hora)
      );

      availableTimes = agendaSettings.times.filter((time) => !occupiedTimes.has(time));
      setOptions(
        timeSelect,
        availableTimes.length ? "Escolha um horário" : "Sem horários livres nesta data",
        availableTimes.map((time) => ({ value: time, label: time }))
      );
      timeSelect.disabled = availableTimes.length === 0;
    } catch (error) {
      availableTimes = [];
      setOptions(timeSelect, "Erro ao carregar horários", []);
      feedback.textContent = "Não foi possível verificar os horários ocupados. Tente novamente.";
      console.error("Falha ao consultar horários ocupados:", error);
    }
  });

  procedureInput.addEventListener("input", () => {
    const isNailArt = procedureInput.value.trim().toLowerCase() === "nail art";
    nailArtOption.hidden = !isNailArt;
    submitButton.hidden = isNailArt;
    dateSelect.required = !isNailArt;
    timeSelect.required = !isNailArt;
  });

  schedulingDialog.querySelector(".whatsapp-schedule").addEventListener("click", () => {
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const message = [
      "Olá! Gostaria de consultar um orçamento de Nail Art.",
      `Nome: ${data.get("name")}`,
      `Telefone: ${data.get("phone")}`,
      `E-mail: ${data.get("email") || "Não informado"}`,
      `Procedimento: ${data.get("procedure")}`
    ].join("\n");

    window.open(
      `https://wa.me/553196809579?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  });

  accountLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!accountLoginForm.reportValidity()) return;

    const values = new FormData(accountLoginForm);
    const loginButton = accountLoginForm.querySelector("button[type='submit']");
    loginButton.disabled = true;
    accountLoginFeedback.textContent = "";
    try {
      const credential = await signInCustomer(
        values.get("identifier"),
        String(values.get("password") || "")
      );
      const profile = await getDoc(doc(db, "clientes", credential.user.uid));
      if (profile.exists()) {
        form.elements.phone.value = profile.data().telefone || "";
        form.elements.email.value = profile.data().email || "";
      }
      accountLoginFeedback.textContent = "Acesso liberado. Você já pode solicitar um novo agendamento.";
      schedulingDialog.querySelector('.profile-tab[data-profile="new"]').click();
    } catch (error) {
      accountLoginFeedback.textContent = customerAuthError(error);
      console.error("Falha no login pelo agendamento:", error);
    } finally {
      loginButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const date = String(values.get("date"));
    const time = String(values.get("time"));
    const unhaQuebrada = values.get("brokenNail") === "true";
    const basePrice = Number(procedureInput.selectedOptions[0]?.dataset.price);
    const valor = Number.isFinite(basePrice) ? basePrice + (unhaQuebrada ? 12 : 0) : null;

    if (valor === null) {
      feedback.textContent = "Não foi possível calcular o preço deste procedimento. Selecione outro serviço ou solicite um orçamento.";
      return;
    }

    if (!agendaSettings) {
      feedback.textContent =
        "A agenda não está configurada. O Studio deve cadastrar meses abertos (AAAA-MM) e horários padrão (HH:mm) em configuracoes/agenda.";
      return;
    }

    if (!agendaSettings.dates.includes(date)) {
      feedback.textContent = "A data escolhida não está em um mês aberto na agenda do Studio. Selecione outra data.";
      return;
    }

    if (!agendaSettings.times.includes(time) || !availableTimes.includes(time)) {
      feedback.textContent = "Esse horário não está disponível na agenda. Escolha outro horário.";
      return;
    }

    const phone = normalizePhone(String(values.get("phone")));
    if (phone.length < 10 || phone.length > 11) {
      feedback.textContent = "Informe um telefone com DDD válido.";
      return;
    }

    if (!values.get("privacyConsent")) {
      feedback.textContent = "Leia e aceite o Aviso de Privacidade para continuar.";
      return;
    }

    if (!currentCustomer
      && String(values.get("password") || "") !== String(values.get("confirmPassword") || "")) {
      feedback.textContent = "As senhas não correspondem.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      let customer = currentCustomer;
      if (!customer) {
        customer = await createCustomerAccount({
          name: String(values.get("name") || ""),
          phone,
          email: String(values.get("email") || ""),
          password: String(values.get("password") || "")
        });
        currentCustomer = customer;
        passwordFields.forEach((field) => {
          field.classList.add("is-hidden");
          field.querySelector("input").required = false;
        });
      }

      const profileReference = doc(db, "clientes", customer.uid);
      const profileSnapshot = await getDoc(profileReference);
      if (!profileSnapshot.exists() || profileSnapshot.data().telefone !== phone) {
        throw new Error("O telefone informado precisa ser o mesmo vinculado à sua conta. Entre em “Já sou cliente” para usar seu acesso.");
      }

      const previousAppointments = await validAppointmentCount(customer);
      const unlocksVip = previousAppointments === 2;
      const snoozedUntil = Number(profileSnapshot.data().vipAvisoAte || 0);
      if (unlocksVip && snoozedUntil <= Date.now()) {
        const decision = await decideVipPrompt();
        if (decision === "cancel") return;
        if (decision === "snooze") {
          await updateDoc(profileReference, {
            vipAvisoAte: Date.now() + 60 * 24 * 60 * 60 * 1000
          });
        }
      }

      const slotId = `${date}_${time.replace(":", "-")}`;
      const slotReference = doc(db, "horarios_ocupados", slotId);
      const bookingReference = doc(collection(db, "agendamentos"));
      const consultationCode = createRandomCode();
      const consultationReference = doc(db, "consultas_agendamento", consultationCode);

      const appointment = {
        nome: String(values.get("name")).trim(),
        telefone: phone,
        email: String(values.get("email") || "").trim().toLowerCase() || null,
        clienteUid: customer.uid,
        procedimento: String(values.get("procedure")).trim(),
        unhaQuebrada,
        valor,
        data: date,
        horario: time,
        status: "pendente",
        criadoEm: serverTimestamp(),
        slotId,
        codigoConsulta: consultationCode,
        aceiteLGPD: true,
        versaoAvisoPrivacidade: "2026-11-24",
        aceiteLGPDem: serverTimestamp()
      };
      const batch = writeBatch(db);
      batch.set(bookingReference, appointment);
      batch.set(slotReference, {
        data: date,
        horario: time,
        status: "ocupado",
        reservaId: bookingReference.id
      });
      batch.set(consultationReference, {
        data: date,
        horario: time,
        procedimento: appointment.procedimento,
        status: appointment.status,
        reservaId: bookingReference.id
      });
      await batch.commit();

      feedback.textContent = `Pedido enviado! Total: ${bookingCurrency.format(valor)}. Guarde este código para consultar sua reserva: ${consultationCode}. O Studio confirmará seu agendamento.${unlocksVip ? " Parabéns! Você desbloqueou o Acesso VIP da cliente." : ""}`;
      schedulingDialog.querySelector(".client-access-link").hidden = false;
      form.reset();
      procedureInput.dispatchEvent(new Event("input", { bubbles: true }));
      await loadAgendaSettings();
      setOptions(timeSelect, "Selecione uma data primeiro", []);
    } catch (error) {
      feedback.textContent = error.code === "permission-denied"
        ? "A agenda pode ter sido alterada ou este horário acabou de ser reservado. Escolha outra data/horário ou fale com o Studio."
        : customerAuthError(error);
      console.error("Falha ao salvar agendamento:", error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Solicitar agendamento";
    }
  });

  existingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = String(new FormData(existingForm).get("identifier") || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(code)) {
      appointmentsFeedback.textContent = "Informe o código de consulta recebido ao solicitar o agendamento.";
      return;
    }

    appointmentsFeedback.textContent = "Buscando seus agendamentos...";
    appointmentsList.replaceChildren();

    try {
      const snapshot = await getDoc(doc(db, "consultas_agendamento", code));
      if (!snapshot.exists()) {
        appointmentsFeedback.textContent = "Não encontramos uma reserva para esse código.";
        return;
      }

      appointmentsFeedback.textContent = "";
      const booking = snapshot.data();
      schedulingDialog.querySelector(".client-access-link").hidden = false;
      const date = new Date(`${booking.data}T12:00:00`);
      const status = String(booking.status || "pendente").toLowerCase();
      const card = document.createElement("article");
      card.className = "appointment-card";
      card.innerHTML = `
        <time datetime="${booking.data}T${booking.horario || "00:00"}">
          <strong></strong>
          <span></span>
        </time>
        <div>
          <h4></h4>
          <p></p>
        </div>
        <span class="appointment-status"></span>
      `;
      card.querySelector("time strong").textContent = String(date.getDate()).padStart(2, "0");
      card.querySelector("time span").textContent = new Intl.DateTimeFormat("pt-BR", {
        month: "short"
      }).format(date).replace(".", "").toUpperCase();
      card.querySelector("h4").textContent = booking.procedimento || "Procedimento";
      card.querySelector("p").textContent =
        `${booking.horario || "Horário a confirmar"} · ${new Intl.DateTimeFormat("pt-BR").format(date)}`;
      const statusElement = card.querySelector(".appointment-status");
      statusElement.textContent = {
        pendente: "Pendente",
        confirmado: "Confirmado",
        concluido: "Concluído",
        cancelado: "Cancelado"
      }[status] || "Pendente";
      statusElement.classList.add(
        status === "confirmado" ? "is-confirmed" :
          status === "cancelado" ? "is-cancelled" : "is-completed"
      );
      appointmentsPanel.querySelector(".appointments-heading h3").textContent = "Sua reserva";
      appointmentsList.appendChild(card);

      existingForm.hidden = true;
      appointmentsPanel.hidden = false;
    } catch (error) {
      appointmentsFeedback.textContent = "Não foi possível consultar os agendamentos. Tente novamente.";
      console.error("Falha ao consultar reserva pelo código:", error);
    }
  });

  schedulingDialog.querySelector(".new-appointment").addEventListener("click", () => {
    appointmentsPanel.hidden = true;
    existingForm.hidden = false;
  });
}
