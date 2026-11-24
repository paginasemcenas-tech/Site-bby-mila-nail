import { db } from "../../firebase-config.js";
import "./main.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
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
  const existingForm = schedulingDialog.querySelector(".existing-client-login");
  const appointmentsPanel = schedulingDialog.querySelector(".client-appointments");
  const appointmentsList = schedulingDialog.querySelector(".appointment-list");
  const appointmentsFeedback = schedulingDialog.querySelector(".appointments-feedback");
  let agendaSettings = null;
  let availableTimes = [];

  const normalizePhone = (value) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    return digits;
  };
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
      const months = Array.isArray(data.mesesAbertos) ? data.mesesAbertos : [];
      const dates = getOpenDates(months);
      const times = Array.isArray(data.horariosPadrao) ? data.horariosPadrao : [];

      if (dates.length === 0 || times.length === 0) {
        throw new Error("A agenda ainda não possui datas ou horários disponíveis.");
      }

      agendaSettings = {
        dates,
        times: times
          .map((time) => typeof time === "string" ? time : time.hora || time.time || "")
          .filter(Boolean)
          .sort()
      };

      setOptions(dateSelect, "Escolha uma data", dates.map((date) => ({
        value: date,
        label: new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "long"
        }).format(new Date(`${date}T12:00:00`))
      })));

      if (agendaSettings.times.length === 0) {
        throw new Error("Não há horários padrão configurados para a agenda.");
      }
    } catch (error) {
      agendaSettings = null;
      setOptions(dateSelect, "Não foi possível carregar as datas", []);
      feedback.textContent = error.message || "Erro ao consultar a agenda. Tente novamente.";
      console.error("Falha ao carregar agenda do Firestore:", error);
    }
  };

  document.addEventListener("scheduling:open", loadAgendaSettings);

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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const date = String(values.get("date"));
    const time = String(values.get("time"));

    if (!agendaSettings?.dates.includes(date) || !availableTimes.includes(time)) {
      feedback.textContent = "Selecione uma data e um horário disponíveis.";
      return;
    }

    const phone = normalizePhone(String(values.get("phone")));
    if (phone.length < 10 || phone.length > 11) {
      feedback.textContent = "Informe um telefone com DDD válido.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      const slotId = `${date}_${time.replace(":", "-")}`;
      const slotReference = doc(db, "horarios_ocupados", slotId);
      const bookingReference = doc(collection(db, "agendamentos"));
      const consultationCode = createRandomCode();
      const consultationReference = doc(db, "consultas_agendamento", consultationCode);

      await runTransaction(db, async (transaction) => {
        const slot = await transaction.get(slotReference);
        if (slot.exists()) {
          throw new Error("Este horário acabou de ser reservado. Escolha outro horário.");
        }

        const appointment = {
          nome: String(values.get("name")).trim(),
          telefone: phone,
          email: String(values.get("email") || "").trim() || null,
          procedimento: String(values.get("procedure")).trim(),
          data: date,
          horario: time,
          status: "pendente",
          criadoEm: serverTimestamp(),
          slotId,
          codigoConsulta: consultationCode
        };
        transaction.set(bookingReference, appointment);
        transaction.set(slotReference, {
          data: date,
          horario: time,
          status: "ocupado",
          reservaId: bookingReference.id
        });
        transaction.set(consultationReference, {
          data: date,
          horario: time,
          procedimento: appointment.procedimento,
          status: appointment.status,
          reservaId: bookingReference.id
        });
      });

      feedback.textContent = `Pedido enviado! Guarde este código para consultar sua reserva: ${consultationCode}. O Studio confirmará seu agendamento.`;
      form.reset();
      await loadAgendaSettings();
      setOptions(timeSelect, "Selecione uma data primeiro", []);
    } catch (error) {
      feedback.textContent = error.message || "Não foi possível solicitar o agendamento. Tente novamente.";
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
