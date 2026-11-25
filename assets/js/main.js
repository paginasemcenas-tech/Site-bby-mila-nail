const menuToggle = document.querySelector(".menu-toggle");
const mainNavigation = document.querySelector("#main-navigation");
const siteHeader = document.querySelector(".site-header");

if (siteHeader) {
  const updateHeaderState = () => {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 16);
  };

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

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

  window.addEventListener("scroll", () => {
    if (isMobileNavigation() && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  }, { passive: true });

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

          <label class="form-field account-password-field">
            <span>Crie sua senha <small>(mínimo 6 caracteres)</small></span>
            <input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Senha da sua área de cliente">
          </label>

          <label class="form-field account-password-field">
            <span>Confirme sua senha</span>
            <input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Digite a senha novamente">
          </label>

          <p class="booking-code-hint account-password-note">Seu primeiro agendamento cria sua conta. Depois, entre com telefone ou e-mail e esta senha.</p>

          <label class="form-field procedure-field">
            <span>Procedimento</span>
            <select name="procedure" required>
              <option value="">Selecione um serviço e confira o preço</option>
              <option value="Aplicação P/M" data-price="195">Aplicação P/M — R$ 195,00</option>
              <option value="Aplicação G/GG" data-price="260">Aplicação G/GG — R$ 260,00</option>
              <option value="Manutenção P/M" data-price="165">Manutenção P/M — R$ 165,00</option>
              <option value="Manutenção G/GG" data-price="225">Manutenção G/GG — R$ 225,00</option>
              <option value="Banho em Gel" data-price="145">Banho em Gel — R$ 145,00</option>
              <option value="Blindagem" data-price="115">Blindagem — R$ 115,00</option>
              <option value="Remoção" data-price="70">Remoção — R$ 70,00</option>
              <option value="Unha quebrada" data-price="12">Unha quebrada — R$ 12,00</option>
              <option value="Manutenção de outra profissional P/M" data-price="175">Manutenção de outra profissional P/M — R$ 175,00</option>
              <option value="Manutenção de outra profissional G/GG" data-price="230">Manutenção de outra profissional G/GG — R$ 230,00</option>
              <option value="Nail Art">Nail Art — Sob consulta</option>
            </select>
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

        <div class="booking-price-summary" hidden aria-live="polite">
          <label class="booking-broken-nail" hidden>
            <input name="brokenNail" type="checkbox" value="true">
            <span>Possui unha quebrada? <small>+ R$ 12,00</small></span>
          </label>
          <p>Valor total: <strong class="booking-price-total"></strong></p>
        </div>

        <div class="nailart-option" hidden>
          <strong>Nail Art escolhida</strong>
          <p>Para criar uma arte exclusiva e confirmar o orçamento, vamos conversar pelo WhatsApp.</p>
          <button class="whatsapp-schedule" type="button">Conversar no WhatsApp</button>
        </div>

        <label class="booking-privacy-consent">
          <input name="privacyConsent" type="checkbox" required>
          <span>Li e aceito o <a href="privacidade.html" target="_blank" rel="noopener noreferrer">Aviso de Privacidade (LGPD)</a> e autorizo o uso dos meus dados para gerenciar este agendamento e minha área de cliente.</span>
        </label>

        <button class="normal-schedule" type="submit">Solicitar agendamento</button>
        <p class="form-feedback" role="status" aria-live="polite"></p>
        <a class="client-access-link" href="cliente-dashboard.html" hidden>
          Consulte se você já desbloqueou sua área exclusiva de cliente.
        </a>
      </form>
    </section>

    <section class="profile-panel" data-panel="existing" role="tabpanel" hidden>
      <form class="client-account-login">
        <label class="form-field">
          <span>Telefone ou e-mail</span>
          <input name="identifier" type="text" autocomplete="username" required placeholder="Telefone com DDD ou e-mail">
        </label>
        <label class="form-field">
          <span>Senha</span>
          <input name="password" type="password" autocomplete="current-password" required>
        </label>
        <p class="account-login-feedback" role="status" aria-live="polite"></p>
        <button class="normal-schedule" type="submit">Entrar na área da cliente</button>
        <a class="client-access-link" href="cliente-dashboard.html">Abrir meu painel da cliente</a>
        <a class="client-access-link" href="https://wa.me/553196809579?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20recuperar%20o%20acesso%20%C3%A0%20minha%20%C3%A1rea%20de%20cliente." target="_blank" rel="noopener noreferrer">Esqueci a senha: solicitar ajuda pelo WhatsApp</a>
        <p class="booking-code-hint">O telefone e a senha usados no primeiro agendamento também funcionam para entrar com o e-mail informado.</p>
      </form>

      <div class="existing-login-divider"><span>ou consulte somente uma reserva</span></div>
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

const vipAccessDialog = document.createElement("dialog");
vipAccessDialog.className = "vip-access-dialog";
vipAccessDialog.setAttribute("aria-labelledby", "vip-access-title");
vipAccessDialog.innerHTML = `
  <div class="vip-access-card">
    <span class="section-eyebrow">UM CARINHO A MAIS</span>
    <h2 id="vip-access-title">Seu acesso VIP está a um passo.</h2>
    <p>Sua conta já foi criada no primeiro agendamento. Ao solicitar este, você completa três reservas válidas nos últimos 12 meses e desbloqueia seu painel de cliente fiel.</p>
    <a class="vip-dashboard-link" href="cliente-dashboard.html">Conhecer meu painel exclusivo</a>
    <button class="vip-continue-button" type="button">Continuar e solicitar agendamento</button>
    <button class="vip-snooze-button" type="button">Não mostrar novamente por 2 meses</button>
    <button class="vip-cancel-button" type="button">Voltar ao formulário</button>
  </div>
`;
document.body.appendChild(vipAccessDialog);

const openSchedulingButtons = document.querySelectorAll("[data-open-scheduling]");
const closeSchedulingButton = schedulingDialog.querySelector(".scheduling-close");
const profileTabs = schedulingDialog.querySelectorAll(".profile-tab");
const profilePanels = schedulingDialog.querySelectorAll(".profile-panel");
const newClientForm = schedulingDialog.querySelector(".new-client-form");
const procedureInput = newClientForm.elements.procedure;
const nailartOption = schedulingDialog.querySelector(".nailart-option");
const normalScheduleButton = schedulingDialog.querySelector(".normal-schedule");
const brokenNailOption = schedulingDialog.querySelector(".booking-broken-nail");
const brokenNailInput = newClientForm.elements.brokenNail;
const bookingPriceSummary = schedulingDialog.querySelector(".booking-price-summary");
const bookingPriceTotal = schedulingDialog.querySelector(".booking-price-total");
const bookingCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2
});

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

const schedulingQuery = new URLSearchParams(window.location.search);
if (schedulingQuery.has("agendar") || schedulingQuery.has("consulta")) {
  if (typeof schedulingDialog.showModal === "function") {
    schedulingDialog.showModal();
  } else {
    schedulingDialog.setAttribute("open", "");
  }
}

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

if (schedulingQuery.has("consulta")) {
  Array.from(profileTabs).find((tab) => tab.dataset.profile === "existing")?.click();
}

procedureInput.addEventListener("input", () => {
  const isNailArt = procedureInput.value.trim().toLowerCase() === "nail art";
  const isMaintenance = procedureInput.value.trim().toLocaleLowerCase("pt-BR").startsWith("manutenção");
  nailartOption.hidden = !isNailArt;
  normalScheduleButton.hidden = isNailArt;
  brokenNailOption.hidden = !isMaintenance;
  if (!isMaintenance) brokenNailInput.checked = false;

  const selectedOption = procedureInput.selectedOptions[0];
  const basePrice = Number(selectedOption.dataset.price);
  bookingPriceSummary.hidden = !procedureInput.value;
  bookingPriceTotal.textContent = Number.isFinite(basePrice)
    ? bookingCurrency.format(basePrice + (isMaintenance && brokenNailInput.checked ? 12 : 0))
    : "Sob consulta";
});

brokenNailInput.addEventListener("change", () => {
  procedureInput.dispatchEvent(new Event("input", { bubbles: true }));
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