const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const navigation = document.querySelector("[data-nav]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionToggle = document.querySelector("[data-motion-toggle]");

const setAmbientMotionPaused = (paused) => {
  document.documentElement.classList.toggle("ambient-motion-paused", paused);
  motionToggle?.setAttribute("aria-pressed", String(paused));
  const label = paused ? "Продолжить анимацию" : "Приостановить анимацию";
  motionToggle?.setAttribute("aria-label", label);
  motionToggle?.setAttribute("title", label);
  const icon = motionToggle?.querySelector("span");
  if (icon) icon.textContent = paused ? "▶" : "Ⅱ";
};

motionToggle?.addEventListener("click", () => {
  setAmbientMotionPaused(!document.documentElement.classList.contains("ambient-motion-paused"));
});

const setMenuState = (open) => {
  menuToggle?.setAttribute("aria-expanded", String(open));
  menuToggle?.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  navigation?.classList.toggle("is-open", open);
  header?.classList.toggle("menu-open", open);
  document.body.classList.toggle("nav-open", open);
};

menuToggle?.addEventListener("click", () => {
  setMenuState(menuToggle.getAttribute("aria-expanded") !== "true");
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuState(false));
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1120) setMenuState(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuState(false);
});

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const revealElements = [...document.querySelectorAll(".reveal")];

if (!prefersReducedMotion.matches && "IntersectionObserver" in window) {
  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const counters = [...document.querySelectorAll("[data-count]")];
const numberFormatter = new Intl.NumberFormat("ru-RU");

const setCounterValue = (counter, value) => {
  const digits = counter.querySelector(".impact-value-digits");
  if (digits) digits.textContent = numberFormatter.format(value).replace(/\u00a0/g, " ");
};

const animateCounter = (counter) => {
  const target = Number(counter.dataset.count);
  const duration = 1400;
  const startedAt = performance.now();

  const update = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setCounterValue(counter, Math.round(target * eased));

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      setCounterValue(counter, target);
      counter.classList.add("is-counted");
    }
  };

  requestAnimationFrame(update);
};

if (!prefersReducedMotion.matches && "IntersectionObserver" in window) {
  counters.forEach((counter) => setCounterValue(counter, 0));

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10%", threshold: 0.45 },
  );

  counters.forEach((counter) => counterObserver.observe(counter));
}

const parkVideo = document.querySelector("[data-park-video]");

if (parkVideo) {
  if (prefersReducedMotion.matches) {
    parkVideo.pause();
    parkVideo.currentTime = 0;
  } else {
    const startParkVideo = () => {
      parkVideo.play().catch(() => {
        // Native controls remain available if a browser blocks autoplay.
      });
    };

    if ("IntersectionObserver" in window) {
      const videoObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            startParkVideo();
            videoObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.4 },
      );

      videoObserver.observe(parkVideo);
    } else {
      startParkVideo();
    }
  }
}

document.querySelector("[data-open-rules]")?.addEventListener("click", () => {
  const firstRule = document.querySelector("#rule-details details");
  if (firstRule) firstRule.open = true;
});

document.querySelectorAll(".rules-list details").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open || window.innerWidth <= 680) return;
    document.querySelectorAll(".rules-list details[open]").forEach((openItem) => {
      if (openItem !== item) openItem.open = false;
    });
  });
});

const year = new Date().getFullYear();
document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(year);
});
