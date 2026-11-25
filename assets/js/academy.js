const academyWhatsApp = "https://wa.me/553196809579";

const academyHeroVideo = document.querySelector(".academy-hero-video");

if (academyHeroVideo instanceof HTMLVideoElement) {
  academyHeroVideo.muted = true;
  academyHeroVideo.playsInline = true;

  const playAcademyHeroVideo = () => {
    const playback = academyHeroVideo.play();
    if (playback) {
      playback.catch((error) => {
        console.warn("A reprodução automática do vídeo da Academy não foi iniciada.", error);
      });
    }
  };

  if ("IntersectionObserver" in window) {
    const academyVideoObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        playAcademyHeroVideo();
      } else {
        academyHeroVideo.pause();
      }
    }, { threshold: 0.15 });

    academyVideoObserver.observe(academyHeroVideo);
  } else {
    playAcademyHeroVideo();
  }
}

document.querySelectorAll("[data-whatsapp-message]").forEach((link) => {
  const message = link.dataset.whatsappMessage;
  link.href = `${academyWhatsApp}?text=${encodeURIComponent(message)}`;
});

document.querySelectorAll(".academy-scroll-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    const header = document.querySelector(".site-header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 14;

    window.scrollTo({
      top: targetTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });
});

document.querySelectorAll(".academy-faq-item button").forEach((button) => {
  button.addEventListener("click", () => {
    const shouldExpand = button.getAttribute("aria-expanded") !== "true";

    document.querySelectorAll(".academy-faq-item button").forEach((item) => {
      item.setAttribute("aria-expanded", "false");
      const answer = document.getElementById(item.getAttribute("aria-controls"));
      if (answer) answer.hidden = true;
    });

    button.setAttribute("aria-expanded", String(shouldExpand));
    const answer = document.getElementById(button.getAttribute("aria-controls"));
    if (answer) answer.hidden = !shouldExpand;
  });
});

const academyWorkFilters = [...document.querySelectorAll("[data-work-filter]")];
const academyWorkCards = [...document.querySelectorAll(".academy-work-card")];
const academyWorkEmptyState = document.querySelector(".academy-works-empty");
const academyWorkDialog = document.querySelector(".academy-work-dialog");
const academyWorkDialogTitle = document.querySelector("#academy-work-dialog-title");
const academyWorkDialogMedia = document.querySelector(".academy-work-dialog-media");
let academyWorkDialogTrigger = null;

academyWorkFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const selectedFilter = filter.dataset.workFilter;

    academyWorkFilters.forEach((item) => {
      item.setAttribute("aria-pressed", String(item === filter));
    });

    academyWorkCards.forEach((card) => {
      const matchesFilter = selectedFilter === "all"
        || (selectedFilter === "video" && card.dataset.mediaType === "video")
        || card.dataset.workCategory === selectedFilter;
      card.hidden = !matchesFilter;
    });

    if (academyWorkEmptyState) {
      academyWorkEmptyState.hidden = academyWorkCards.some((card) => !card.hidden);
    }
  });
});

document.querySelectorAll("[data-open-work]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!(academyWorkDialog instanceof HTMLDialogElement)
      || !(academyWorkDialogTitle instanceof HTMLElement)
      || !(academyWorkDialogMedia instanceof HTMLElement)) return;

    const card = button.closest(".academy-work-card");
    const media = card?.querySelector(".academy-work-media");
    const title = card?.querySelector(".academy-work-copy h3");
    if (!media || !title) return;

    academyWorkDialogTrigger = button;
    academyWorkDialogTitle.textContent = title.textContent;
    academyWorkDialogMedia.replaceChildren();

    const enlargedMedia = media.cloneNode(true);
    if (enlargedMedia instanceof HTMLVideoElement) {
      enlargedMedia.controls = true;
      enlargedMedia.muted = false;
      enlargedMedia.removeAttribute("muted");
      enlargedMedia.removeAttribute("autoplay");
      enlargedMedia.preload = "metadata";
    }

    document.querySelectorAll("video").forEach((video) => video.pause());
    academyWorkDialogMedia.append(enlargedMedia);
    academyWorkDialog.showModal();
  });
});

if (academyWorkDialog instanceof HTMLDialogElement) {
  academyWorkDialog.querySelector(".academy-work-dialog-close")?.addEventListener("click", () => {
    academyWorkDialog.close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !academyWorkDialog.open) return;
    event.preventDefault();
    academyWorkDialog.close();
  }, true);

  academyWorkDialog.addEventListener("click", (event) => {
    if (event.target === academyWorkDialog) academyWorkDialog.close();
  });

  academyWorkDialog.addEventListener("close", () => {
    academyWorkDialogMedia?.replaceChildren();
    academyWorkDialogTrigger?.focus();
    academyWorkDialogTrigger = null;
  });
}

document.addEventListener("play", (event) => {
  if (!(event.target instanceof HTMLVideoElement)) return;
  document.querySelectorAll("video").forEach((video) => {
    if (video !== event.target) video.pause();
  });
}, true);

const academyRevealItems = [...document.querySelectorAll(".academy-page [data-reveal]")];
const academyReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (academyReduceMotion || !("IntersectionObserver" in window)) {
  academyRevealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  academyRevealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight * 0.95) {
      item.classList.add("is-visible");
    }
  });

  document.body.classList.add("academy-reveal-ready");
  const academyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  academyRevealItems.forEach((item) => {
    if (!item.classList.contains("is-visible")) academyObserver.observe(item);
  });
}
