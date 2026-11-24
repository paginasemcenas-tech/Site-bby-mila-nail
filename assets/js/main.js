const menuToggle = document.querySelector(".menu-toggle");
const mainNavigation = document.querySelector("#main-navigation");

const activePage = document.body.dataset.page;
if (activePage) {
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.setAttribute("aria-current", "page");
    }
  });
}

if (menuToggle && mainNavigation) {
  const isMobileNavigation = () => {
    const breakpoint = document.body.dataset.page === "sobre" ? 680 : 820;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  };
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menu");
    mainNavigation.hidden = true;
  };

  const syncNavigation = () => {
    if (isMobileNavigation()) {
      closeMenu();
    } else {
      mainNavigation.hidden = false;
    }
  };

  syncNavigation();

  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
    mainNavigation.hidden = isExpanded;
  });

  mainNavigation.addEventListener("click", (event) => {
    if (isMobileNavigation() && event.target.closest("a, [data-open-scheduling]")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });

  window.addEventListener("resize", syncNavigation);
}

const schedulingDialog = document.createElement("dialog");
schedulingDialog.className = "scheduling-dialog";
schedulingDialog.setAttribute("aria-labelledby", "scheduling-title");
schedulingDialog.innerHTML = `
  <div class="scheduling-drawer">
    <button class="scheduling-close" type="button" aria-label="Fechar agendamento">&times;</button>

    <header class="scheduling-header">
      <span>BBY MILA NAILS</span>
      <h2 id="scheduling-title">Agendamento</h2>
    </header>

    <div class="profile-tabs" role="tablist" aria-label="Tipo de cliente">
      <button type="button" class="profile-tab is-active" role="tab" aria-selected="true" data-profile="new">Sou cliente nova</button>
      <button type="button" class="profile-tab" role="tab" aria-selected="false" data-profile="existing">Já sou cliente</button>
    </div>

    <section class="profile-panel" data-panel="new" role="tabpanel">
      <form class="new-client-form">
        <div class="field-grid">
          <label class="form-field">
            <span>Nome completo</span>
            <input name="name" type="text" autocomplete="name" required placeholder="Seu nome">
          </label>

          <label class="form-field">
            <span>Telefone / WhatsApp</span>
            <input name="phone" type="tel" autocomplete="tel" required placeholder="(31) 99999-9999">
          </label>

          <label class="form-field">
            <span>E-mail <small>(opcional)</small></span>
            <input name="email" type="email" autocomplete="email" placeholder="voce@email.com">
          </label>

          <label class="form-field procedure-field">
            <span>Procedimento</span>
            <input name="procedure" type="text" list="procedures-list" required placeholder="Selecione ou digite">
            <datalist id="procedures-list">
              <option value="Alongamento"></option>
              <option value="Manutenção"></option>
              <option value="Blindagem"></option>
              <option value="Banho em Gel"></option>
              <option value="Spa dos Pés"></option>
              <option value="Nail Art"></option>
              <option value="Remoção"></option>
            </datalist>
          </label>

          <label class="form-field">
            <span>Data preferida</span>
            <select name="date" required disabled>
              <option value="">Carregando datas...</option>
            </select>
          </label>

          <label class="form-field">
            <span>Horário preferido</span>
            <select name="time" required disabled>
              <option value="">Selecione uma data primeiro</option>
            </select>
          </label>
        </div>

        <div class="nailart-option" hidden>
          <strong>Nail Art escolhida</strong>
          <p>Para criar uma arte exclusiva e confirmar o orçamento, vamos conversar pelo WhatsApp.</p>
          <button class="whatsapp-schedule" type="button">Conversar no WhatsApp</button>
        </div>

        <button class="normal-schedule" type="submit">Solicitar agendamento</button>
        <p class="form-feedback" role="status" aria-live="polite"></p>
      </form>
    </section>

    <section class="profile-panel" data-panel="existing" role="tabpanel" hidden>
      <form class="existing-client-login">
        <label class="form-field">
          <span>Código da reserva</span>
          <input name="identifier" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" pattern="[a-fA-F0-9]{64}" required placeholder="Cole o código recebido">
        </label>
        <p class="booking-code-hint">O código aparece após a solicitação do agendamento. Ele protege os dados pessoais da sua reserva.</p>
        <button class="normal-schedule" type="submit">Consultar reserva</button>
      </form>

      <div class="client-appointments" hidden>
        <div class="appointments-heading">
          <div>
            <span>CONSULTA DE RESERVA</span>
            <h3>Sua reserva</h3>
          </div>
          <button type="button" class="new-appointment">Novo agendamento</button>
        </div>

        <p class="appointments-feedback" role="status" aria-live="polite"></p>
        <div class="appointment-list"></div>
      </div>
    </section>
  </div>
`;

document.body.appendChild(schedulingDialog);

const openSchedulingButtons = document.querySelectorAll("[data-open-scheduling]");
const closeSchedulingButton = schedulingDialog.querySelector(".scheduling-close");
const profileTabs = schedulingDialog.querySelectorAll(".profile-tab");
const profilePanels = schedulingDialog.querySelectorAll(".profile-panel");
const newClientForm = schedulingDialog.querySelector(".new-client-form");
const procedureInput = newClientForm.elements.procedure;
const nailartOption = schedulingDialog.querySelector(".nailart-option");
const normalScheduleButton = schedulingDialog.querySelector(".normal-schedule");

openSchedulingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (typeof schedulingDialog.showModal === "function") {
      schedulingDialog.showModal();
    } else {
      schedulingDialog.setAttribute("open", "");
    }
    document.dispatchEvent(new CustomEvent("scheduling:open"));
  });
});

closeSchedulingButton.addEventListener("click", () => schedulingDialog.close());

schedulingDialog.addEventListener("click", (event) => {
  if (event.target === schedulingDialog) schedulingDialog.close();
});

profileTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    profileTabs.forEach((item) => {
      item.classList.toggle("is-active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });
    profilePanels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.profile;
    });
  });
});

procedureInput.addEventListener("input", () => {
  const isNailArt = procedureInput.value.trim().toLowerCase() === "nail art";
  nailartOption.hidden = !isNailArt;
  normalScheduleButton.hidden = isNailArt;
});

schedulingDialog.querySelector(".new-appointment").addEventListener("click", () => {
  profileTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.profile === "new");
    tab.setAttribute("aria-selected", String(tab.dataset.profile === "new"));
  });
  profilePanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== "new";
  });
});

const bookingProcedureButtons = document.querySelectorAll("[data-booking-procedure]");
bookingProcedureButtons.forEach((button) => {
  button.addEventListener("click", () => {
    procedureInput.value = button.dataset.bookingProcedure;
    procedureInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
});

const revealElements = document.querySelectorAll("[data-reveal]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const homeHeroContent = document.querySelector(".home-hero [data-reveal]");
const homeStudioLink = document.querySelector(".home-hero a[href='#studio']");
const studioSection = document.querySelector("#studio");

if (homeHeroContent && !prefersReducedMotion) {
  homeHeroContent.classList.add("is-visible", "hero-enter");
}

if (homeStudioLink && studioSection) {
  homeStudioLink.addEventListener("click", (event) => {
    event.preventDefault();
    studioSection.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start"
    });
    window.history.replaceState(null, "", "#studio");
  });
}

if (revealElements.length && !prefersReducedMotion && "IntersectionObserver" in window) {
  document.body.classList.add("has-reveal");
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -30px 0px" });

  revealElements.forEach((element) => {
    if (element !== homeHeroContent) revealObserver.observe(element);
  });
}