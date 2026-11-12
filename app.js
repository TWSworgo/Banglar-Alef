(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "banglar-alef.preferences.v1";
  const GAME_SAVE_KEY = "banglar-alef.game-save.v1";
  const bootStarted = performance.now();
  const bootScreen = $("#boot-screen");
  const appShell = $("#app-shell");
  const progress = $("#boot-progress");
  const percent = $("#boot-percent");
  const bootMessage = $("#boot-message");
  const dialog = $("#notice-dialog");
  let dialogReturnFocus = null;

  const defaultPreferences = { sound: false, reduceMotion: false, graphics: "balanced" };
  let preferences = { ...defaultPreferences };

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        preferences = {
          sound: Boolean(saved.sound),
          reduceMotion: Boolean(saved.reduceMotion),
          graphics: ["high", "balanced", "performance"].includes(saved.graphics) ? saved.graphics : "balanced"
        };
      }
    } catch (error) {
      console.warn("Preferences could not be read; defaults are active.", error);
    }
    applyPreferences();
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      $("#settings-feedback").textContent = "পছন্দগুলো এই browser-এ সংরক্ষিত হয়েছে।";
    } catch (error) {
      $("#settings-feedback").textContent = "এই browser-এ সংরক্ষণ করা যায়নি। Private browsing বা storage restriction পরীক্ষা করো।";
      console.warn("Preferences could not be saved.", error);
    }
  }

  function applyPreferences() {
    document.body.classList.toggle("reduce-motion", preferences.reduceMotion);
    $("#settings-sound").setAttribute("aria-checked", String(preferences.sound));
    $("#settings-motion").setAttribute("aria-checked", String(preferences.reduceMotion));
    $("#graphics-quality").value = preferences.graphics;
    $("#sound-toggle").classList.toggle("is-muted", !preferences.sound);
    $("#sound-toggle").setAttribute("aria-pressed", String(preferences.sound));
  }

  function showView(route) {
    const validRoutes = ["home", "garage", "settings", "controls", "credits", "exit"];
    const destination = validRoutes.includes(route) ? route : "home";
    $$(".view").forEach(view => {
      const active = view.dataset.view === destination;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });
    $$("[data-route]").forEach(link => {
      const active = link.dataset.route === destination && link.classList.contains("nav-link");
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    $("#primary-nav").classList.remove("is-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#main-content").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: preferences.reduceMotion ? "auto" : "smooth" });
    if (location.hash !== "#" + destination) history.replaceState(null, "", "#" + destination);
  }

  function openNotice(title, message) {
    dialogReturnFocus = document.activeElement;
    $("#notice-title").textContent = title;
    $("#notice-message").textContent = message;
    dialog.hidden = false;
    $("#dialog-ok").focus();
  }

  function closeNotice() {
    dialog.hidden = true;
    if (dialogReturnFocus && typeof dialogReturnFocus.focus === "function") dialogReturnFocus.focus();
  }

  function refreshContinueButton() {
    const button = $("#continue-game");
    const caption = $("#continue-caption");
    let save = null;
    try { save = JSON.parse(localStorage.getItem(GAME_SAVE_KEY) || "null"); } catch (_) {}
    const valid = Boolean(save && save.version === 1 && save.player && Number.isFinite(save.player.money) && save.player.position && Number.isFinite(save.player.position.z));
    button.disabled = !valid;
    caption.textContent = valid ? "আগের সংরক্ষিত যাত্রা চালিয়ে যাও" : "এখনো কোনো সংরক্ষিত যাত্রা নেই";
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const routeLink = event.target.closest("[data-route]");
      if (routeLink) {
        event.preventDefault();
        showView(routeLink.dataset.route);
      }
    });

    $("#menu-toggle").addEventListener("click", () => {
      const nav = $("#primary-nav");
      const expanded = $("#menu-toggle").getAttribute("aria-expanded") === "true";
      $("#menu-toggle").setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("is-open", !expanded);
    });

    $("#new-game").addEventListener("click", () => {
      window.location.href = "./game.html?new=1";
    });

    $("#continue-game").addEventListener("click", () => {
      if (!$("#continue-game").disabled) window.location.href = "./game.html?continue=1";
    });

    $("#dialog-close").addEventListener("click", closeNotice);
    $("#dialog-ok").addEventListener("click", closeNotice);
    dialog.addEventListener("click", event => { if (event.target === dialog) closeNotice(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!dialog.hidden) closeNotice();
        $("#primary-nav").classList.remove("is-open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
      }
      if (!dialog.hidden && event.key === "Tab") {
        const focusable = $$("button:not(:disabled)", dialog);
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault(); focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          event.preventDefault(); focusable[0].focus();
        }
      }
    });

    $("#settings-sound").addEventListener("click", () => {
      preferences.sound = !preferences.sound;
      applyPreferences(); savePreferences();
    });
    $("#settings-motion").addEventListener("click", () => {
      preferences.reduceMotion = !preferences.reduceMotion;
      applyPreferences(); savePreferences();
    });
    $("#graphics-quality").addEventListener("change", event => {
      preferences.graphics = event.target.value;
      savePreferences();
    });
    $("#sound-toggle").addEventListener("click", () => {
      preferences.sound = !preferences.sound;
      applyPreferences(); savePreferences();
      $("#settings-feedback").textContent = preferences.sound
        ? "সাউন্ড preference চালু হয়েছে। Gameplay audio পরবর্তী sound feature-এ যুক্ত হবে।"
        : "সাউন্ড preference বন্ধ হয়েছে।";
    });
    $("#year").textContent = String(new Date().getFullYear());
    refreshContinueButton();
  }

  function setBootProgress(value, message) {
    progress.style.width = value + "%";
    percent.textContent = new Intl.NumberFormat("bn-BD").format(value) + "%";
    if (message) bootMessage.textContent = message;
  }

  function finishBoot() {
    const elapsed = performance.now() - bootStarted;
    const remaining = Math.max(0, 3000 - elapsed);
    window.setTimeout(() => {
      setBootProgress(100, "প্রস্তুত");
      bootScreen.classList.add("is-done");
      appShell.classList.remove("is-hidden");
      window.setTimeout(() => { bootScreen.hidden = true; }, 600);
      const initialRoute = location.hash.replace("#", "");
      showView(initialRoute || "home");
    }, remaining);
  }

  function startBoot() {
    const milestones = [
      [450, 18, "ব্র্যান্ডিং প্রস্তুত হচ্ছে"],
      [1000, 42, "ইন্টারফেস লোড হচ্ছে"],
      [1650, 68, "কন্ট্রোল ও সেটিংস প্রস্তুত হচ্ছে"],
      [2250, 88, "শহরের জন্য প্রস্তুত"],
      [2700, 96, "প্রায় প্রস্তুত"]
    ];
    milestones.forEach(([delay, value, message]) => {
      window.setTimeout(() => setBootProgress(value, message), delay);
    });
    const assetsReady = document.readyState === "complete"
      ? Promise.resolve()
      : new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
    Promise.all([assetsReady, document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve()])
      .then(finishBoot)
      .catch(error => {
        console.error("Startup resource issue:", error);
        setBootProgress(100, "সীমিত মোডে প্রস্তুত");
        finishBoot();
      });
  }

  let runtimeErrorShown = false;
  window.addEventListener("error", event => {
    console.error("Runtime error:", event.error || event.message);
    if (!runtimeErrorShown && !dialog.hidden) return;
    runtimeErrorShown = true;
    openNotice("একটি সমস্যা হয়েছে", "ওয়েবসাইটের একটি অংশ ঠিকভাবে কাজ করেনি। পেজটি refresh করে আবার চেষ্টা করো। সমস্যাটি থাকলে development team-কে জানাও।");
  });
  window.addEventListener("unhandledrejection", event => {
    console.error("Unhandled application promise:", event.reason);
    if (!runtimeErrorShown) {
      runtimeErrorShown = true;
      openNotice("একটি কাজ সম্পন্ন করা যায়নি", "একটি background operation ব্যর্থ হয়েছে। পেজটি refresh করে আবার চেষ্টা করো।");
    }
  });

  loadPreferences();
  bindEvents();
  startBoot();
})();