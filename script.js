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

const headerToneSections = [...document.querySelectorAll("[data-header-tone]")];
let headerToneFrame = 0;

const updateHeaderTone = () => {
  if (!header) return;
  const probeLine = header.offsetHeight + 2;
  const activeSection = headerToneSections.find((section) => {
    const bounds = section.getBoundingClientRect();
    return bounds.top <= probeLine && bounds.bottom > probeLine;
  });
  header.dataset.surface = activeSection?.dataset.headerTone || "white";
};

const requestHeaderToneUpdate = () => {
  if (headerToneFrame) return;
  headerToneFrame = window.requestAnimationFrame(() => {
    headerToneFrame = 0;
    updateHeaderTone();
  });
};

updateHeaderTone();
window.addEventListener("scroll", requestHeaderToneUpdate, { passive: true });
window.addEventListener("resize", requestHeaderToneUpdate);

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

const handoffItems = [...document.querySelectorAll(".handoff-route li")];

const toggleHandoffItem = (item) => {
  const shouldActivate = !item.classList.contains("is-active");
  handoffItems.forEach((routeItem) => routeItem.classList.remove("is-active"));
  if (shouldActivate) item.classList.add("is-active");
};

handoffItems.forEach((item) => {
  item.addEventListener("click", () => toggleHandoffItem(item));
  item.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleHandoffItem(item);
  });
});

const supportDialog = document.querySelector("[data-support-dialog]");
const supportDialogOpeners = [...document.querySelectorAll("[data-support-open]")];
const supportDialogCloser = supportDialog?.querySelector("[data-support-close]");
const supportForm = supportDialog?.querySelector("[data-bitrix-lead-form]");
const leadStatus = supportDialog?.querySelector("[data-lead-status]");
const leadSubmitButton = supportDialog?.querySelector("[data-lead-submit]");
let supportDialogTrigger = null;

const setLeadStatus = (message = "", state = "") => {
  if (!leadStatus) return;
  leadStatus.textContent = message;
  leadStatus.hidden = !message;
  if (state) leadStatus.dataset.state = state;
  else delete leadStatus.dataset.state;
};

const readCookie = (name) => {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

const getTrackingValues = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    yclid: params.get("yclid") || "",
    gclid: params.get("gclid") || "",
    client_id: readCookie("_ym_uid") || readCookie("_ga") || "",
  };
};

const closeSupportDialog = () => {
  if (!supportDialog) return;
  if (typeof supportDialog.close === "function") {
    supportDialog.close();
  } else {
    supportDialog.removeAttribute("open");
  }
};

supportDialogOpeners.forEach((button) => {
  button.addEventListener("click", () => {
    if (!supportDialog) return;
    supportDialogTrigger = button;
    setMenuState(false);
    setLeadStatus();
    if (supportForm) supportForm.dataset.startedAt = String(Date.now());
    document.body.classList.add("lead-dialog-open");
    if (typeof supportDialog.showModal === "function") {
      supportDialog.showModal();
    } else {
      supportDialog.setAttribute("open", "");
      supportDialog.querySelector("input, select, textarea, button")?.focus();
    }
  });
});

supportDialogCloser?.addEventListener("click", closeSupportDialog);

supportDialog?.addEventListener("click", (event) => {
  if (event.target !== supportDialog) return;
  const bounds = supportDialog.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (!inside) closeSupportDialog();
});

supportDialog?.addEventListener("close", () => {
  document.body.classList.remove("lead-dialog-open");
  supportDialogTrigger?.focus({ preventScroll: true });
});

supportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supportForm.reportValidity()) return;

  const formData = new FormData(supportForm);
  const values = Object.fromEntries(formData.entries());
  const bitrixEvent = new CustomEvent("bitrix:lead-submit", {
    bubbles: true,
    cancelable: true,
    detail: {
      form: supportForm,
      formData,
      values,
      close: closeSupportDialog,
      setStatus: setLeadStatus,
    },
  });

  supportForm.dispatchEvent(bitrixEvent);
  if (bitrixEvent.defaultPrevented) return;

  const initialButtonText = leadSubmitButton?.textContent || "Отправить заявку";
  if (leadSubmitButton) {
    leadSubmitButton.disabled = true;
    leadSubmitButton.textContent = "Отправляем…";
  }
  setLeadStatus("Отправляем заявку…");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("api/lead.php", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify({
        ...values,
        consent: formData.has("consent"),
        elapsed_ms: Math.max(0, Date.now() - Number(supportForm.dataset.startedAt || Date.now())),
        page_url: window.location.href,
        ...getTrackingValues(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error("Lead request failed");

    supportForm.reset();
    supportForm.dataset.startedAt = String(Date.now());
    setLeadStatus("Спасибо! Заявка отправлена. Координатор программы свяжется с вами.", "success");
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Сервис отвечает дольше обычного. Попробуйте ещё раз или позвоните нам: +7 977 970-49-64."
      : "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам: +7 977 970-49-64.";
    setLeadStatus(message, "error");
  } finally {
    window.clearTimeout(timeoutId);
    if (leadSubmitButton) {
      leadSubmitButton.disabled = false;
      leadSubmitButton.textContent = initialButtonText;
    }
  }
});

const year = new Date().getFullYear();
document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(year);
});
