/* PatrickCounty.life — event calendar engine (no dependencies) */
(function () {
  "use strict";

  var CATEGORIES = ["Festivals", "Live Music", "Outdoors", "Food & Farm", "Family", "Arts & Culture", "Community", "Holiday"];
  var DOW = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var HORIZON_DAYS = 400; // how far ahead recurring events are expanded

  var state = {
    occurrences: [],   // { ev, date: Date, endDate: Date }
    view: "list",
    month: null,       // first day of displayed month
    category: "All",
    query: ""
  };

  /* ---------- date helpers (all local-time safe) ---------- */

  function parseDate(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function toISO(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }
  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function sameDay(a, b) { return a.getTime() === b.getTime(); }
  function fmtTime(t) {
    if (!t) return "";
    var p = t.split(":"), h = +p[0], m = p[1];
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return h + (m === "00" ? "" : ":" + m) + " " + ap;
  }
  function fmtDateLong(d, withYear) {
    var s = DAY_NAMES[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
    if (withYear || d.getFullYear() !== today().getFullYear()) s += ", " + d.getFullYear();
    return s;
  }
  function catClass(cat) {
    return "cat-" + cat.toLowerCase().replace(/\s*&\s*/g, "-").replace(/\s+/g, "-");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- expand events into dated occurrences ---------- */

  function expandAll(events) {
    var occ = [], limit = addDays(today(), HORIZON_DAYS);
    events.forEach(function (ev) {
      if (ev.recurs && ev.recurs.freq === "weekly") {
        var d = parseDate(ev.recurs.from);
        var until = parseDate(ev.recurs.until);
        var target = DOW[ev.recurs.day];
        while (d.getDay() !== target) d = addDays(d, 1);
        while (d <= until && d <= limit) {
          occ.push({ ev: ev, date: d, endDate: d });
          d = addDays(d, 7);
        }
      } else if (ev.date) {
        var start = parseDate(ev.date);
        occ.push({ ev: ev, date: start, endDate: ev.endDate ? parseDate(ev.endDate) : start });
      }
    });
    occ.sort(function (a, b) {
      return a.date - b.date || String(a.ev.time || "").localeCompare(String(b.ev.time || ""));
    });
    return occ;
  }

  function matches(o) {
    if (state.category !== "All" && o.ev.category !== state.category) return false;
    if (state.query) {
      var hay = (o.ev.title + " " + (o.ev.venue || "") + " " + (o.ev.town || "") + " " + (o.ev.description || "")).toLowerCase();
      if (hay.indexOf(state.query) === -1) return false;
    }
    return true;
  }

  function upcoming() {
    var t = today();
    return state.occurrences.filter(function (o) { return o.endDate >= t && matches(o); });
  }

  /* ---------- list view ---------- */

  function renderFeatured() {
    var el = document.getElementById("featured");
    if (state.category !== "All" || state.query) { el.innerHTML = ""; return; }
    var t = today();
    var feats = [], seen = {};
    state.occurrences.forEach(function (o) {
      if (o.ev.featured && o.endDate >= t && !seen[o.ev.id]) { seen[o.ev.id] = 1; feats.push(o); }
    });
    feats = feats.slice(0, 3);
    if (!feats.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="featured-strip">' + feats.map(function (o) {
      var when = sameDay(o.date, o.endDate) ? fmtDateLong(o.date) :
        MONTHS[o.date.getMonth()] + " " + o.date.getDate() + "–" + o.endDate.getDate();
      return '<button class="featured-card" data-open="' + esc(o.ev.id) + '|' + toISO(o.date) + '">' +
        '<span class="fc-label">Featured</span>' +
        "<h3>" + esc(o.ev.title) + "</h3>" +
        "<p>" + esc(when) + " &middot; " + esc(o.ev.venue || "") + "</p></button>";
    }).join("") + "</div>";
  }

  function renderList() {
    var el = document.getElementById("list-view");
    var t = today();
    var items = upcoming();
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><p>No events found. Try another category or search term.</p></div>';
      return;
    }
    // group by effective date (ongoing multi-day events group under today)
    var groups = {}, order = [];
    items.forEach(function (o) {
      var eff = o.date < t ? t : o.date;
      var key = toISO(eff);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(o);
    });
    order.sort();
    el.innerHTML = order.map(function (key) {
      var d = parseDate(key);
      var isToday = sameDay(d, t);
      var head = '<div class="date-header">' + esc(fmtDateLong(d)) +
        (isToday ? '<span class="dh-today">Today</span>' : "") + "</div>";
      return head + groups[key].map(cardHTML).join("");
    }).join("");
  }

  function cardHTML(o) {
    var ev = o.ev;
    var meta = [];
    if (!sameDay(o.date, o.endDate)) meta.push("Through " + MONTHS[o.endDate.getMonth()] + " " + o.endDate.getDate());
    if (ev.time) meta.push(fmtTime(ev.time) + (ev.endTime ? "–" + fmtTime(ev.endTime) : ""));
    if (ev.venue) meta.push(ev.venue + (ev.town ? ", " + ev.town : ""));
    return '<button class="event-card" data-open="' + esc(ev.id) + '|' + toISO(o.date) + '">' +
      '<span class="cat-bar ' + catClass(ev.category) + '"></span>' +
      '<span class="ec-body"><h3>' + esc(ev.title) + "</h3>" +
      '<div class="ec-meta">' + esc(meta.join(" · ")) + "</div>" +
      '<p class="ec-desc">' + esc(ev.description || "") + "</p></span>" +
      '<span class="badge ' + catClass(ev.category) + '">' + esc(ev.category) + "</span></button>";
  }

  /* ---------- month view ---------- */

  function renderMonth() {
    var el = document.getElementById("month-view");
    var m = state.month, t = today();
    document.getElementById("month-label").textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
    var firstDow = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
    var daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var cells = [];
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) {
      cells.push('<div class="dow">' + d + "</div>");
    });
    for (var i = 0; i < firstDow; i++) cells.push('<div class="day-cell other-month"></div>');
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(m.getFullYear(), m.getMonth(), day);
      var todays = state.occurrences.filter(function (o) {
        return matches(o) && o.date <= d && d <= o.endDate;
      });
      var html = '<div class="day-cell' + (sameDay(d, t) ? " today" : "") + '">' +
        '<div class="day-num">' + day + "</div>";
      todays.slice(0, 3).forEach(function (o) {
        html += '<button class="pill ' + catClass(o.ev.category) + '" data-open="' + esc(o.ev.id) + '|' + toISO(d) + '" title="' + esc(o.ev.title) + '">' + esc(o.ev.title) + "</button>";
      });
      if (todays.length > 3) {
        html += '<button class="more-link" data-day="' + toISO(d) + '">+' + (todays.length - 3) + " more</button>";
      }
      cells.push(html + "</div>");
    }
    while ((cells.length - 7) % 7 !== 0) cells.push('<div class="day-cell other-month"></div>');
    el.innerHTML = '<div class="month-grid">' + cells.join("") + "</div>";
  }

  /* ---------- weekend sidebar ---------- */

  function renderWeekend() {
    var el = document.getElementById("weekend-list");
    var t = today(), dow = t.getDay();
    // Fri–Sun window containing today, or the upcoming one
    var fri = (dow === 6) ? addDays(t, -1) : (dow === 0) ? addDays(t, -2) : addDays(t, 5 - dow);
    var sun = addDays(fri, 2);
    var items = state.occurrences.filter(function (o) {
      return o.date <= sun && o.endDate >= (fri > t ? fri : t);
    }).slice(0, 6);
    if (!items.length) {
      el.innerHTML = '<p style="margin:0">Nothing on the calendar yet &mdash; check back soon.</p>';
      return;
    }
    el.innerHTML = items.map(function (o) {
      var showDate = o.date < fri ? fri : o.date;
      return '<button class="weekend-item" data-open="' + esc(o.ev.id) + '|' + toISO(showDate) + '">' +
        '<span class="wd">' + DAY_NAMES[showDate.getDay()].slice(0, 3) + "</span>" +
        '<span class="wt">' + esc(o.ev.title) +
        '<span class="wv">' + esc((o.ev.time ? fmtTime(o.ev.time) + " · " : "") + (o.ev.venue || "")) + "</span></span></button>";
    }).join("");
  }

  /* ---------- modal ---------- */

  function gcalUrl(ev, dateISO) {
    var base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    var dates;
    var startD = dateISO.replace(/-/g, "");
    if (ev.time) {
      var endT = ev.endTime || ev.time;
      var endD = (ev.endDate || dateISO).replace(/-/g, "");
      dates = startD + "T" + ev.time.replace(":", "") + "00/" + endD + "T" + endT.replace(":", "") + "00";
    } else {
      var endEx = toISO(addDays(parseDate(ev.endDate || dateISO), 1)).replace(/-/g, "");
      dates = startD + "/" + endEx;
    }
    return base +
      "&text=" + encodeURIComponent(ev.title) +
      "&dates=" + dates + "&ctz=America/New_York" +
      "&location=" + encodeURIComponent((ev.venue || "") + ", " + (ev.town || "") + ", VA") +
      "&details=" + encodeURIComponent((ev.description || "") + "\n\nFrom patrickcounty.life");
  }

  function openEvent(id, dateISO) {
    var occ = state.occurrences.filter(function (o) { return o.ev.id === id; });
    if (!occ.length) return;
    var o = occ.filter(function (x) { return toISO(x.date) === dateISO; })[0] ||
            occ.filter(function (x) { return x.endDate >= today(); })[0] || occ[0];
    var ev = o.ev;
    var when = sameDay(o.date, o.endDate) ? fmtDateLong(o.date, true) :
      fmtDateLong(o.date, true) + " – " + fmtDateLong(o.endDate, true);
    var mapQ = encodeURIComponent((ev.venue || "") + ", " + (ev.town || "") + ", VA");
    var body =
      '<span class="badge ' + catClass(ev.category) + '">' + esc(ev.category) + "</span>" +
      "<h2>" + esc(ev.title) + "</h2>" +
      '<div class="m-row"><span class="m-ico">&#128197;</span><span>' + esc(when) +
      (ev.recurs ? " (repeats every " + esc(ev.recurs.day) + " through " + esc(fmtDateLong(parseDate(ev.recurs.until))) + ")" : "") + "</span></div>" +
      (ev.time ? '<div class="m-row"><span class="m-ico">&#128336;</span><span>' + fmtTime(ev.time) + (ev.endTime ? " – " + fmtTime(ev.endTime) : "") + "</span></div>" : "") +
      (ev.venue ? '<div class="m-row"><span class="m-ico">&#128205;</span><span>' + esc(ev.venue) + (ev.town ? ", " + esc(ev.town) : "") +
        ' &middot; <a href="https://www.google.com/maps/search/?api=1&query=' + mapQ + '" target="_blank" rel="noopener">Map</a></span></div>' : "") +
      '<p class="m-desc">' + esc(ev.description || "") + "</p>" +
      '<div class="m-actions">' +
      '<a class="button" href="' + gcalUrl(ev, toISO(o.date)) + '" target="_blank" rel="noopener">Add to Google Calendar</a>' +
      (ev.link ? '<a class="button accent" href="' + esc(ev.link) + '" target="_blank" rel="noopener">Event website</a>' : "") +
      "</div>";
    showModal(body);
    if (history.replaceState) history.replaceState(null, "", "#" + ev.id);
  }

  function openDay(dateISO) {
    var d = parseDate(dateISO);
    var items = state.occurrences.filter(function (o) {
      return matches(o) && o.date <= d && d <= o.endDate;
    });
    var body = "<h2>" + esc(fmtDateLong(d, true)) + "</h2>" +
      items.map(function (o) { return '<div class="m-day-item">' + cardHTML(o) + "</div>"; }).join("");
    showModal(body);
  }

  function showModal(html) {
    document.getElementById("modal-body").innerHTML = html;
    document.getElementById("modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    document.getElementById("modal").hidden = true;
    document.body.style.overflow = "";
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  /* ---------- SEO: inject schema.org Event data ---------- */

  function injectJsonLd() {
    var t = today(), limit = addDays(t, 90), seen = {}, out = [];
    state.occurrences.forEach(function (o) {
      if (o.endDate < t || o.date > limit || seen[o.ev.id] || out.length >= 20) return;
      seen[o.ev.id] = 1;
      out.push({
        "@context": "https://schema.org",
        "@type": "Event",
        "name": o.ev.title,
        "startDate": toISO(o.date) + (o.ev.time ? "T" + o.ev.time + ":00" : ""),
        "endDate": toISO(o.endDate) + (o.ev.endTime ? "T" + o.ev.endTime + ":00" : ""),
        "description": o.ev.description || "",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": o.ev.venue || "",
          "address": { "@type": "PostalAddress", "addressLocality": o.ev.town || "Stuart", "addressRegion": "VA", "addressCountry": "US" }
        }
      });
    });
    if (!out.length) return;
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(out);
    document.head.appendChild(s);
  }

  /* ---------- render + wiring ---------- */

  function render() {
    var list = state.view === "list";
    document.getElementById("list-view").hidden = !list;
    document.getElementById("featured").hidden = !list;
    document.getElementById("month-view").hidden = list;
    document.getElementById("month-nav").hidden = list;
    document.getElementById("btn-list").classList.toggle("active", list);
    document.getElementById("btn-month").classList.toggle("active", !list);
    if (list) { renderFeatured(); renderList(); } else { renderMonth(); }
  }

  function buildChips() {
    var el = document.getElementById("chips");
    el.innerHTML = ["All"].concat(CATEGORIES).map(function (c) {
      return '<button class="chip' + (c === state.category ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  }

  function bindUI() {
    document.getElementById("chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      state.category = b.dataset.cat;
      buildChips(); render();
    });
    document.getElementById("search").addEventListener("input", function (e) {
      state.query = e.target.value.trim().toLowerCase();
      render();
    });
    document.getElementById("btn-list").addEventListener("click", function () { state.view = "list"; render(); });
    document.getElementById("btn-month").addEventListener("click", function () { state.view = "month"; render(); });
    document.getElementById("prev-month").addEventListener("click", function () {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); render();
    });
    document.getElementById("next-month").addEventListener("click", function () {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); render();
    });
    document.getElementById("today-btn").addEventListener("click", function () {
      var t = today(); state.month = new Date(t.getFullYear(), t.getMonth(), 1); render();
    });
    document.body.addEventListener("click", function (e) {
      var open = e.target.closest("[data-open]");
      if (open) {
        var p = open.dataset.open.split("|");
        openEvent(p[0], p[1]);
        return;
      }
      var more = e.target.closest("[data-day]");
      if (more) openDay(more.dataset.day);
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", function (e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    fetch("events.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.occurrences = expandAll(data.events || []);
        var t = today();
        state.month = new Date(t.getFullYear(), t.getMonth(), 1);
        buildChips(); bindUI(); render(); renderWeekend(); injectJsonLd();
        var hash = location.hash.replace("#", "");
        if (hash && hash !== "events" && hash !== "weekend") openEvent(hash);
      })
      .catch(function (err) {
        document.getElementById("list-view").innerHTML =
          '<div class="empty-state"><p>Could not load events. (' + esc(err.message) + ")</p></div>";
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
