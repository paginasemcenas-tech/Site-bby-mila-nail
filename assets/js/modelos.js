const modelsForm = document.querySelector("#models-form");
const modelsStatus = document.querySelector("#models-status");
const modelsFallbackLink = document.querySelector("#models-whatsapp-fallback");
const modelsPhone = modelsForm.querySelector('[name="phone"]');
const modelsInstagram = modelsForm.querySelector('[name="instagram"]');
const modelsDays = [...modelsForm.querySelectorAll('[name="days"]')];
const modelsWhatsApp = "https://wa.me/553196809579";

const formatBrazilianPhone = (value) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits;
  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  const splitAt = number.length > 8 ? 5 : 4;
  return `(${areaCode}) ${number.slice(0, splitAt)}${number.length > splitAt ? `-${number.slice(splitAt)}` : ""}`;
};

const validateModelsPhone = () => {
  const digits = modelsPhone.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  modelsPhone.setCustomValidity(
    digits.length === 10 || digits.length === 11
      ? ""
      : "Informe um telefone com DDD e 10 ou 11 dígitos."
  );
};

const validateModelsDays = () => {
  const hasDay = modelsDays.some((day) => day.checked);
  modelsDays.forEach((day, index) => {
    day.setCustomValidity(index === 0 && !hasDay ? "Selecione ao menos um dia disponível." : "");
  });
};

modelsPhone.addEventListener("input", () => {
  modelsPhone.value = formatBrazilianPhone(modelsPhone.value);
  validateModelsPhone();
});
modelsPhone.addEventListener("blur", validateModelsPhone);
modelsDays.forEach((day) => day.addEventListener("change", validateModelsDays));

modelsInstagram.addEventListener("blur", () => {
  const value = modelsInstagram.value.trim();
  if (value && !value.startsWith("@")) modelsInstagram.value = `@${value}`;
});

modelsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  validateModelsPhone();
  validateModelsDays();
  if (!modelsForm.reportValidity()) return;

  const formData = new FormData(modelsForm);
  const days = formData.getAll("days").join(", ");
  const instagram = String(formData.get("instagram") || "Não informado");
  const notes = String(formData.get("notes") || "Sem observações");
  const photoConsent = formData.has("photoConsent")
    ? "Autorizo uso de fotos das unhas no portfólio."
    : "Não autorizo divulgação das fotos no portfólio.";
  const message = [
    "Olá! Gostaria de me candidatar ao Programa de Modelos da Bby Mila Nails.",
    "",
    `Nome: ${formData.get("name")}`,
    `WhatsApp: ${formData.get("phone")}`,
    `Instagram: ${instagram}`,
    `Disponibilidade: ${days} / ${formData.get("period")}`,
    `Procedimento de interesse: ${formData.get("procedure")}`,
    `Informações sobre minhas unhas/estilo: ${notes}`,
    `Uso de fotos no portfólio: ${photoConsent}`
  ].join("\n");
  const url = `${modelsWhatsApp}?text=${encodeURIComponent(message)}`;

  modelsFallbackLink.href = url;
  modelsFallbackLink.hidden = false;
  modelsStatus.textContent = "Candidatura preparada. Se o WhatsApp não abrir, use o link abaixo.";
  window.open(url, "_blank", "noopener,noreferrer");
});

const modelsRevealItems = [...document.querySelectorAll(".models-page [data-reveal]")];
const modelsReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (modelsReduceMotion || !("IntersectionObserver" in window)) {
  modelsRevealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  modelsRevealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight * 0.95) {
      item.classList.add("is-visible");
    }
  });

  document.body.classList.add("models-reveal-ready");
  const modelsObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  modelsRevealItems.forEach((item) => {
    if (!item.classList.contains("is-visible")) modelsObserver.observe(item);
  });
}
