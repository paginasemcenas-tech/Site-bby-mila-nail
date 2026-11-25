const contactForm = document.querySelector("#contact-form");
const contactInput = contactForm.querySelector('[name="contact"]');
const contactStatus = document.querySelector("#contact-form-status");
const contactFallbackLink = document.querySelector("#contact-whatsapp-fallback");
const contactWhatsApp = "https://wa.me/553196809579";

const validateContact = () => {
  const value = contactInput.value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const phoneDigits = value.replace(/\D/g, "");
  const isPhone = phoneDigits.length >= 8 && phoneDigits.length <= 13;

  contactInput.setCustomValidity(
    isEmail || isPhone ? "" : "Informe um e-mail válido ou um telefone com DDD."
  );
};

contactInput.addEventListener("input", validateContact);
contactInput.addEventListener("blur", validateContact);

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  validateContact();
  if (!contactForm.reportValidity()) return;

  const formData = new FormData(contactForm);
  const message = [
    "Olá! Vim pela página de Contato da Bby Mila Nails.",
    "",
    `Nome: ${formData.get("name")}`,
    `Contato: ${formData.get("contact")}`,
    `Assunto: ${formData.get("subject")}`,
    "",
    `Mensagem: ${formData.get("message")}`
  ].join("\n");
  const url = `${contactWhatsApp}?text=${encodeURIComponent(message)}`;

  contactFallbackLink.href = url;
  contactFallbackLink.hidden = false;
  contactStatus.textContent = "Mensagem preparada. Se o WhatsApp não abrir, use o link abaixo.";
  window.open(url, "_blank", "noopener,noreferrer");
});

const copyStatus = document.querySelector("#contact-copy-status");
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(button.dataset.copy);
      } else {
        const field = document.createElement("textarea");
        field.value = button.dataset.copy;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        let copied = false;
        try {
          copied = document.execCommand("copy");
        } finally {
          field.remove();
        }
        if (!copied) throw new Error("O navegador não confirmou a cópia.");
      }

      copyStatus.textContent = "Copiado para a área de transferência.";
    } catch (error) {
      copyStatus.textContent = "Não foi possível copiar automaticamente. Selecione e copie o conteúdo manualmente.";
      console.error("Falha ao copiar o contato da Bby Mila Nails.", error);
    }
  });
});

const contactMapScene = document.querySelector("[data-contact-map-scene]");

if (contactMapScene) {
  let contactMapZoom = 1;

  document.querySelectorAll("[data-contact-map-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      switch (button.dataset.contactMapZoom) {
        case "in":
          contactMapZoom = Math.min(1.8, contactMapZoom + 0.2);
          break;
        case "out":
          contactMapZoom = Math.max(0.8, contactMapZoom - 0.2);
          break;
        case "reset":
          contactMapZoom = 1;
          break;
        default:
          return;
      }

      contactMapScene.setAttribute(
        "transform",
        `translate(320 195) scale(${contactMapZoom}) translate(-320 -195)`
      );
    });
  });
}

const contactRevealItems = [...document.querySelectorAll(".contact-page [data-reveal]")];
const contactReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (contactReduceMotion || !("IntersectionObserver" in window)) {
  contactRevealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  contactRevealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight * 0.95) {
      item.classList.add("is-visible");
    }
  });

  document.body.classList.add("contact-reveal-ready");
  const contactObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  contactRevealItems.forEach((item) => {
    if (!item.classList.contains("is-visible")) contactObserver.observe(item);
  });
}
