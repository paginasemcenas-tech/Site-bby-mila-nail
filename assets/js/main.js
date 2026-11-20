"use strict";

// Configuração central baseada na pesquisa de campo.
const WHATSAPP_LINK = "https://wa.me/553196809579";
const INSTAGRAM_LINK = "https://instagram.com/bbymilanails";

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-navigation");
const navLinks = document.querySelectorAll(".nav-link");
const currentPage = document.body.dataset.page;

navLinks.forEach((link) => {
  const isCurrentPage = link.dataset.page === currentPage;
  link.classList.toggle("is-active", isCurrentPage);
  if (isCurrentPage) {
    link.setAttribute("aria-current", "page");
  } else {
    link.removeAttribute("aria-current");
  }
});

function closeMenu() {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Abrir menu");
  navigation?.classList.remove("is-open");
  document.body.classList.remove("menu-open");
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Abrir menu" : "Fechar menu");
  navigation.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
});

navLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuToggle.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760) closeMenu();
});

// Aplica os links oficiais aos CTAs quando forem informados.
document.querySelectorAll(".whatsapp-link").forEach((link) => {
  if (WHATSAPP_LINK) {
    link.href = WHATSAPP_LINK;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
});

const instagramLink = document.querySelector(".instagram-link");
if (instagramLink && INSTAGRAM_LINK) {
  instagramLink.href = INSTAGRAM_LINK;
}

// Microanimações discretas e respeitosas a preferências de movimento.
const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const currentYear = document.getElementById("current-year");
if (currentYear) currentYear.textContent = new Date().getFullYear();

const artworkTriggers = [...document.querySelectorAll(".artwork-trigger")];
const galleryLightbox = document.querySelector("#gallery-lightbox");
const lightboxImage = galleryLightbox?.querySelector(".lightbox-image");
const lightboxCaption = galleryLightbox?.querySelector(".lightbox-caption");
const lightboxClose = galleryLightbox?.querySelector(".lightbox-close");
const lightboxPrevious = galleryLightbox?.querySelector(".lightbox-previous");
const lightboxNext = galleryLightbox?.querySelector(".lightbox-next");

if (
  artworkTriggers.length > 0 &&
  galleryLightbox &&
  lightboxImage &&
  lightboxCaption &&
  lightboxClose &&
  lightboxPrevious &&
  lightboxNext
) {
  let activeArtworkIndex = 0;

  function showArtwork(index) {
    activeArtworkIndex = (index + artworkTriggers.length) % artworkTriggers.length;
    const trigger = artworkTriggers[activeArtworkIndex];
    const image = trigger.querySelector("img");
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = trigger.dataset.title;
  }

  artworkTriggers.forEach((trigger, index) => {
    trigger.addEventListener("click", () => {
      showArtwork(index);
      galleryLightbox.showModal();
    });
  });

  lightboxClose.addEventListener("click", () => galleryLightbox.close());
  lightboxPrevious.addEventListener("click", () => showArtwork(activeArtworkIndex - 1));
  lightboxNext.addEventListener("click", () => showArtwork(activeArtworkIndex + 1));

  galleryLightbox.addEventListener("click", (event) => {
    if (event.target === galleryLightbox) galleryLightbox.close();
  });

  galleryLightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showArtwork(activeArtworkIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showArtwork(activeArtworkIndex + 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      galleryLightbox.close();
    }
  });
}
