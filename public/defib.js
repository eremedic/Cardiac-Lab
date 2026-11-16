/* CSHealthED Defib Lab: a monitor / defibrillator / pacer trainer.
   Loaded on demand by index.html. Exposes window.DefibLab = { render(el, host), stop() }.
   host = { save(id, result), load(id), esc(str), onDone() }                                  */
(function () {
  "use strict";
  var FS = 250;                       // samples per second
  var SWEEP = 4.6;                    // seconds across the ECG trace (about 25 mm/s on this screen)
  var ENERGIES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 70, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 360];

  /* ------------------------------------------------------------------ scenarios */
  var SCEN = [
    { id: "vf", title: "Collapse while shoveling snow", type: "defib", start: { r: "vf", amp: 0.55 }, pulse: false, cpr: true,
      text: "A 55-year-old man collapsed while shoveling snow. Bystanders started CPR. Pads are on.", lesson: "Shockable rhythm: defibrillate (unsynchronized), 120–200 J biphasic, then resume CPR immediately." },
    { id: "pvt", title: "Found unresponsive and pulseless", type: "defib", start: { r: "vt", rate: 182 }, pulse: false,
      text: "A 62-year-old is unresponsive, not breathing normally, and has no carotid pulse. Pads are on.", lesson: "Pulseless VT is treated exactly like VF: an unsynchronized shock, then CPR." },
    { id: "tdp", title: "Collapse in the clinic waiting room", type: "defib", start: { r: "torsades" }, pulse: false,
      text: "A 41-year-old on high-dose methadone collapses. No pulse. Pads are on.", lesson: "Polymorphic VT can't be synchronized: defibrillate, then give magnesium sulfate 1–2 g." },
    { id: "fvf", title: "Long down-time", type: "defib", start: { r: "vf", amp: 0.14 }, pulse: false, cpr: true,
      text: "Unwitnessed arrest, about 8 minutes down. Your partner is doing compressions.", lesson: "Fine VF is still VF and still shockable. Pause CPR briefly to read the rhythm, then shock." },
    { id: "uvt", title: "Palpitations and chest pain", type: "sync", start: { r: "vt", rate: 164 }, pulse: true, conscious: true, bp: "74/42", minJ: 100, maxJ: 200,
      text: "A 58-year-old with chest pain and palpitations. Pale, diaphoretic, BP 74/42. He has a pulse.", lesson: "Unstable monomorphic VT with a pulse: sedate, SYNC on, cardiovert at 100 J and escalate if needed." },
    { id: "svt", title: "Sudden racing heart", type: "sync", start: { r: "svt", rate: 204 }, pulse: true, conscious: true, bp: "78/46", minJ: 50, maxJ: 100,
      text: "A 34-year-old with sudden palpitations, now confused. BP 78/46. Vagal maneuvers and adenosine have failed.", lesson: "Unstable narrow, regular tachycardia: sedate, SYNC on, cardiovert at 50–100 J." },
    { id: "af", title: "Irregular and unstable", type: "sync", start: { r: "af", rate: 162 }, pulse: true, conscious: true, bp: "80/50", minJ: 120, maxJ: 200,
      text: "A 72-year-old, short of breath with chest pressure. BP 80/50.", lesson: "Unstable atrial fibrillation: sedate, SYNC on, cardiovert at 120–200 J biphasic." },
    { id: "afl", title: "Regular at exactly 150", type: "sync", start: { r: "flutter" }, pulse: true, conscious: true, bp: "82/48", minJ: 50, maxJ: 100,
      text: "A 66-year-old, dizzy and hypotensive. BP 82/48.", lesson: "Unstable atrial flutter: sedate, SYNC on, cardiovert at 50–100 J; flutter usually converts at low energy." },
    { id: "chb", title: "The slow, confused patient", type: "pace", start: { r: "chb" }, pulse: true, conscious: true, bp: "70/38", threshold: [60, 80],
      text: "An 81-year-old, confused and pale. BP 70/38. Atropine didn't help.", lesson: "Unstable complete heart block: pace at 60–80/min, raise the current until every spike captures, confirm a femoral pulse, and give analgesia or sedation." },
    { id: "b21", title: "Dizzy with a wide, slow rhythm", type: "pace", start: { r: "b21" }, pulse: true, conscious: true, bp: "76/40", threshold: [55, 75],
      text: "A 76-year-old with an anterior MI, dizzy and clammy. BP 76/40.", lesson: "High-grade block with a wide QRS won't respond to atropine: pace, confirm mechanical capture, treat the pain." },
    { id: "asy", title: "Found down at home", type: "noshock", start: { r: "asystole" }, pulse: false,
      text: "An 84-year-old found unresponsive in bed. No pulse, not breathing. Pads are on.", lesson: "Asystole isn't shockable and pacing doesn't help: high-quality CPR, epinephrine 1 mg as soon as possible, look for reversible causes." },
    { id: "pea", title: "Organized, but no pulse", type: "noshock", start: { r: "sinus", rate: 72 }, pulse: false, pea: true,
      text: "A 67-year-old dialysis patient, unresponsive. The monitor shows an organized rhythm, but you can't feel a pulse.", lesson: "PEA isn't shockable: CPR, epinephrine as soon as possible, and treat the cause (here, think hyperkalemia: calcium and bicarbonate)." }
  ];

  /* ------------------------------------------------------------------ waveform engine */
  function gauss(x, a, w) { return a * Math.exp(-(x * x) / (2 * w * w)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function Engine() {
    this.t = 0; this.ev = []; this.vtimes = []; this.pulseT = [];
    this.rh = null; this.pacer = { on: false, rate: 60, mA: 0, paused: false };
    this.threshold = 999; this.cpr = false; this.flat = 0; this.lastV = -9;
    this.nextP = 0; this.nextV = 0; this.nextPace = 0; this.pCount = 0; this.lastNative = -9;
    this.listeners = [];
  }
  Engine.prototype.setRhythm = function (rh, perfusing) {
    this.rh = rh; this.perfusing = perfusing;
    this.nextP = this.t + rnd(0.1, 0.4); this.nextV = this.t + rnd(0.1, 0.5); this.pCount = 0;
    this.phase = Math.random() * 6;
    if (rh.r === "vf" || rh.r === "torsades") { this.vf = []; for (var i = 0; i < 5; i++) this.vf.push([rnd(3, 7.5), rnd(0.45, 1), rnd(0, 6.3), rnd(0.15, 0.45)]); }
  };
  Engine.prototype.addV = function (t, kind) {
    this.ev.push({ t: t, k: kind }); this.lastV = t; if (kind !== "paced") this.lastNative = t; this.vtimes.push(t); this.vtimes.sort(function (a, b) { return a - b; });
    if (this.vtimes.length > 8) this.vtimes.shift();
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i]("v", t, kind);
  };
  Engine.prototype.hasQRS = function () { var r = this.rh && this.rh.r; return r && r !== "vf" && r !== "torsades" && r !== "asystole"; };
  Engine.prototype.schedule = function (tEnd) {
    var rh = this.rh, r = rh.r;
    // atrial activity
    if (r === "sinus" || r === "chb" || r === "b21") {
      var pp = r === "sinus" ? 60 / rh.rate : (r === "chb" ? 60 / 82 : 0.78);
      while (this.nextP <= tEnd) {
        var pt = this.nextP; this.ev.push({ t: pt, k: "p" });
        if (r === "sinus") this.addV(pt + 0.16, rh.wide ? "w" : "n");
        if (r === "b21") { if (this.pCount % 2 === 0 && pt + 0.2 - this.lastV > 0.35) this.addV(pt + 0.2, "w"); }
        this.pCount++; this.nextP += pp * rnd(0.99, 1.01);
      }
    }
    // ventricular activity that doesn't follow P waves
    if (r === "svt" || r === "af" || r === "flutter" || r === "vt") {
      while (this.nextV <= tEnd) {
        var vt = this.nextV;
        this.addV(vt, r === "vt" ? "vt" : "n");
        if (r === "af") this.nextV += rnd(0.28, 0.52) * (150 / Math.max(rh.rate, 60)) * 1.0;
        else if (r === "flutter") this.nextV += 0.4;
        else this.nextV += 60 / rh.rate;
      }
    }
    if (r === "chb") {   // ventricular escape, suppressed by captured pacing
      var esc = 60 / 32;
      if (this.nextV < this.lastV + esc * 0.98) this.nextV = this.lastV + esc;
      while (this.nextV <= tEnd) { this.addV(this.nextV, "w"); this.nextV += esc; }
    }
    // transcutaneous pacer (demand mode)
    var pc = this.pacer;
    if (pc.on) {
      var interval = 60 / (pc.paused ? Math.max(pc.rate / 4, 20) : pc.rate);
      if (this.nextPace < this.lastNative + interval - 0.001) this.nextPace = this.lastNative + interval;   // demand: inhibited by the patient's own beats
      if (this.nextPace < this.t) this.nextPace = this.t + 0.05;
      while (this.nextPace <= tEnd) {
        var s = this.nextPace;
        this.ev.push({ t: s, k: "spike" });
        for (var j = 0; j < this.listeners.length; j++) this.listeners[j]("spike", s);
        if (pc.mA >= this.threshold && this.hasQRS()) { this.addV(s + 0.04, "paced"); this.nextPace = s + interval; this.nextV = s + 60 / 32; }
        else this.nextPace = s + interval;
      }
    }
  };
  Engine.prototype.sample = function (t) {
    var rh = this.rh, r = rh.r, y = 0;
    if (t < this.flat) return 0.004 * Math.sin(t * 40);                       // post-shock pause
    if (r === "vf" || r === "torsades") {
      if (r === "vf") { for (var i = 0; i < this.vf.length; i++) { var c = this.vf[i]; y += rh.amp * c[1] * Math.sin(2 * Math.PI * c[0] * t + c[2]) * (0.55 + 0.45 * Math.sin(2 * Math.PI * c[3] * t)); } }
      else { var env = 0.2 + 0.9 * Math.abs(Math.sin(Math.PI * t / 2.3)); y += env * Math.sin(2 * Math.PI * 4.0 * t + 0.6 * Math.sin(Math.PI * t)); }
    }
    if (r === "af") y += 0.04 * Math.sin(2 * Math.PI * 6.3 * t + this.phase) + 0.03 * Math.sin(2 * Math.PI * 8.7 * t) + 0.02 * Math.sin(2 * Math.PI * 5.1 * t + 1);
    if (r === "flutter") { var ph = (t * 5) % 1; y += (ph < 0.8 ? -0.2 * (ph / 0.8) : -0.2 + 0.2 * ((ph - 0.8) / 0.2)) + 0.1; }
    if (r === "asystole") y += 0.03 * Math.sin(2 * Math.PI * 0.2 * t + this.phase);
    for (var k = this.ev.length - 1; k >= 0; k--) {
      var e = this.ev[k], d = t - e.t;
      if (d > 0.75) break;
      if (d < -0.3) continue;
      switch (e.k) {
        case "p": y += gauss(d, 0.15, 0.022); break;
        case "n": y += gauss(d + 0.022, -0.1, 0.008) + gauss(d, 1.05, 0.01) + gauss(d - 0.024, -0.25, 0.009) + gauss(d - (r === "svt" ? 0.2 : 0.28), r === "svt" ? 0.18 : 0.28, 0.045); break;
        case "w": y += gauss(d, 0.95, 0.03) + gauss(d - 0.07, -0.25, 0.025) + gauss(d - 0.34, -0.32, 0.06); break;
        case "vt": y += gauss(d, 0.9, 0.045) + gauss(d - 0.12, -0.55, 0.05); break;
        case "paced": y += gauss(d - 0.04, -0.95, 0.035) + gauss(d - 0.36, 0.55, 0.07); break;
        case "spike": if (d >= 0 && d < 0.25) y += -0.6 * Math.exp(-d / 0.05); break;
      }
    }
    if (this.cpr) y += 1.1 * Math.max(0, Math.sin(2 * Math.PI * 1.85 * t)) - 0.35;
    return y + (Math.random() - 0.5) * 0.02;
  };
  Engine.prototype.advance = function (t) {
    this.schedule(t + 0.4);
    var cut = t - 1.2, i = 0;
    while (i < this.ev.length && this.ev[i].t < cut) i++;
    if (i) this.ev.splice(0, i);
    this.ev.sort(function (a, b) { return a.t - b.t; });
  };
  Engine.prototype.hr = function () {
    if (!this.hasQRS() || this.cpr || this.t < this.flat) return null;
    var v = this.vtimes.filter(function (x, i, a) { return x <= this._t; }, { _t: this.t });
    if (v.length < 3 || this.t - v[v.length - 1] > 3) return null;
    var n = Math.min(4, v.length - 1), sum = 0;
    for (var i = v.length - n; i < v.length; i++) sum += v[i] - v[i - 1];
    return Math.round(60 / (sum / n));
  };

  /* ------------------------------------------------------------------ the device */
  var root, eng, raf, lastTs, sc, st, ui = {}, cv = {}, x = { ecg: 0, pl: 0, co: 0 }, tPrev = 0;

  function el(id) { return root.querySelector("#" + id); }
  function H(s) { return HOST.esc(String(s)); }
  var HOST = null;

  function deviceHTML() {
    return '' +
      '<div class="dv" id="dv">' +
      '  <div class="dv-handle" aria-hidden="true"></div>' +
      '  <div class="dv-face">' +
      '    <div class="dv-brand"><span class="dv-logo"></span><b>CSHealthED</b><span>Monitor · Defibrillator · Pacer trainer</span><i class="dv-pwr" title="Power">●</i></div>' +
      '    <div class="dv-main">' +
      '      <div class="dv-screen" id="dvScreen">' +
      '        <div class="sc-top"><span class="sc-pt">ADULT</span><span class="sc-pads">PADS</span><span id="scLead" class="sc-lead">II</span><span class="sc-x" id="scSync" hidden>SYNC</span><span class="sc-x pace" id="scPaceTag" hidden>PACING</span><span class="sc-clock" id="scClock">00:00</span><span class="sc-batt" aria-hidden="true"><i></i></span></div>' +
      '        <div class="sc-body">' +
      '          <div class="sc-waves">' +
      '            <div class="sc-wave ecg"><span class="sc-wl">II  x1.0</span><canvas id="cvEcg"></canvas></div>' +
      '            <div class="sc-wave pl"><span class="sc-wl">SpO₂</span><canvas id="cvPl"></canvas></div>' +
      '            <div class="sc-wave co"><span class="sc-wl">CO₂</span><canvas id="cvCo"></canvas></div>' +
      '          </div>' +
      '          <div class="sc-nums">' +
      '            <div class="sc-n hr"><small>HR</small><b id="nHr">---</b><em>bpm</em></div>' +
      '            <div class="sc-n sp"><small>SpO₂ %</small><b id="nSp">---</b></div>' +
      '            <div class="sc-n bp"><small>NIBP mmHg</small><b id="nBp">---/---</b><em id="nBpT">manual</em></div>' +
      '            <div class="sc-n co"><small>EtCO₂ mmHg</small><b id="nCo">--</b><em id="nRr">RR --</em></div>' +
      '          </div>' +
      '        </div>' +
      '        <div class="sc-therapy"><span class="sc-energy" id="scEnergy">ENERGY 200 J</span><span class="sc-pacer" id="scPacer" hidden></span></div>' +
      '        <div class="sc-msg" id="scMsg" role="status" aria-live="polite">Monitoring</div>' +
      '      </div>' +
      '      <div class="dv-keys">' +
      '        <div class="kgrp"><span class="klab"><i>1</i>ENERGY SELECT</span><div class="krow"><button class="key" id="kEdn" aria-label="Energy down">▼</button><button class="key" id="kEup" aria-label="Energy up">▲</button></div></div>' +
      '        <div class="kgrp"><span class="klab"><i>2</i>CHARGE</span><button class="key charge" id="kCharge">CHARGE</button></div>' +
      '        <div class="kgrp"><span class="klab"><i>3</i>SHOCK</span><button class="key shock" id="kShock" aria-label="Shock"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg></button></div>' +
      '        <div class="kgrp row"><button class="key soft led" id="kSync"><i class="led-dot"></i>SYNC</button><button class="key soft" id="kAnalyze">ANALYZE</button></div>' +
      '        <div class="kgrp pacer"><span class="klab">PACER</span>' +
      '          <button class="key soft led" id="kPacer"><i class="led-dot"></i>PACER</button>' +
      '          <div class="kpair"><span>RATE</span><button class="key mini" id="kRdn" aria-label="Pacing rate down">▼</button><button class="key mini" id="kRup" aria-label="Pacing rate up">▲</button></div>' +
      '          <div class="kpair"><span>CURRENT</span><button class="key mini" id="kCdn" aria-label="Pacing current down">▼</button><button class="key mini" id="kCup" aria-label="Pacing current up">▲</button></div>' +
      '          <button class="key soft" id="kPause">PAUSE</button>' +
      '        </div>' +
      '        <div class="kgrp row"><button class="key soft" id="kLead">LEAD</button><button class="key soft" id="kNibp">NIBP</button></div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dv-grill" aria-hidden="true"></div>' +
      '  </div>' +
      '</div>';
  }

  function scenarioListHTML() {
    var groups = [["defib", "Shockable arrests"], ["sync", "Unstable tachycardias"], ["pace", "Unstable bradycardias"], ["noshock", "Non-shockable arrests"]];
    var all = SCEN.map(function (s, i) {
      var r = HOST.load(s.id), badge = r ? (r.ok ? '<span class="pill done">Passed · ' + r.score[0] + '/' + r.score[1] + '</span>' : '<span class="pill part">Review · ' + r.score[0] + '/' + r.score[1] + '</span>') : '<span class="pill">Not started</span>';
      return '<button class="case df-case" data-i="' + i + '"><span class="no">SCENARIO ' + String(i + 1).padStart(2, "0") + '</span><h3>' + H(s.title) + '</h3><span class="focus">' + H(s.text) + '</span><span class="st"><span>' + (s.pulse ? 'Has a pulse' : 'Pulseless') + '</span>' + badge + '</span></button>';
    });
    return '<div class="qhead"><div><div class="eyebrow">Monitor · defibrillator · pacer</div><h2>Defib lab</h2></div><div class="qstats"><span>Passed <b class="num">' + passed() + '</b> of ' + SCEN.length + '</span></div></div>' +
      '<p class="sv-lede">Each scenario puts a patient on the monitor who needs the right intervention: defibrillation, synchronized cardioversion, pacing, or no electricity at all. Work the device like you would on scene, then press <b>Done</b> for feedback.</p>' +
      '<div class="cases">' + all.join("") + '</div>';
  }
  function passed() { return SCEN.filter(function (s) { var r = HOST.load(s.id); return r && r.ok; }).length; }

  function runnerHTML(s, idx) {
    return '<div class="df-run">' +
      '<div class="runner-head"><div><div class="eyebrow">Scenario ' + (idx + 1) + ' of ' + SCEN.length + '</div><h2>' + H(s.title) + '</h2></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="dfBack">All scenarios</button><button class="btn btn-primary" id="dfDone">Done: get feedback</button></div></div>' +
      '<div class="df-grid"><div class="df-devwrap">' + deviceHTML() + '</div>' +
      '<aside class="card df-side"><div class="scenario">' + '<p>' + H(s.text) + '</p></div>' +
      '<div class="df-pt"><h4>Patient</h4><div id="ptStatus" class="df-ptstat"></div>' +
      '<div class="df-acts"><button class="btn btn-ghost" id="aPulse">Check pulse</button><button class="btn btn-ghost" id="aCpr">Start CPR</button><button class="btn btn-ghost" id="aSed">Sedation / analgesia</button><button class="btn btn-ghost" id="aEpi">Epinephrine 1 mg</button></div></div>' +
      '<div class="df-log"><h4>Event log</h4><ol id="dfLog"></ol></div></aside></div>' +
      '<div id="dfFb"></div></div>';
  }

  /* ------------------------------------------------------------------ simulation state */
  function startScenario(i) {
    sc = SCEN[i]; st = { i: i, log: [], t0: performance.now(), energyI: ENERGIES.indexOf(200), charging: false, charged: false, chargeP: 0, chargedAt: 0, sync: false,
      pendingSync: 0, cpr: false, perfusing: !!sc.pulse, bp: sc.bp || null, rhythm: sc.start.r, converted: false, induced: false, firstShockT: null,
      sed: false, epi: 0, pulseChecks: [], leadI: 1, captureT: null, pulseAfterCapture: false, done: false, analyzeUntil: 0 };
    root.innerHTML = runnerHTML(sc, i);
    eng = new Engine(); eng.threshold = sc.threshold ? Math.round(rnd(sc.threshold[0], sc.threshold[1]) / 5) * 5 : 999;
    eng.setRhythm(copy(sc.start), !!sc.pulse);
    eng.listeners.push(onEvent);
    if (sc.cpr) setCpr(true, true);
    bindKeys(); setupCanvases(); updateScreen(); logEv("Scenario started. " + sc.text);
    lastTs = performance.now(); tPrev = 0; x = { ecg: 0, pl: 0, co: 0 };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    root.querySelector("#dfBack").onclick = function () { DefibLab.stop(); HOST.list(); };
    root.querySelector("#dfDone").onclick = finish;
  }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function now() { return eng ? eng.t : 0; }
  function stamp() { var s = Math.floor(now()); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function logEv(txt, cls) { st.log.push({ t: now(), txt: txt }); var ol = el("dfLog"); if (!ol) return; var li = document.createElement("li"); if (cls) li.className = cls; li.innerHTML = '<b>' + stamp() + '</b> ' + H(txt); ol.prepend(li); }
  function msg(txt, cls) { var m = el("scMsg"); m.textContent = txt; m.className = "sc-msg" + (cls ? " " + cls : ""); }

  function onEvent(kind, t) {
    if (kind === "v" && st.pendingSync && t >= now() - 0.05) { st.pendingSync = 0; deliver(true); }
  }

  /* ------------------------------------------------------------------ controls */
  function bindKeys() {
    var on = function (id, fn) { var b = el(id); if (b) b.onclick = function () { if (!st.done) fn(); }; };
    on("kEup", function () { changeEnergy(1); }); on("kEdn", function () { changeEnergy(-1); });
    on("kCharge", charge); on("kShock", shock);
    on("kSync", function () { st.sync = !st.sync; if (st.charged && !st.sync) {} logEv("SYNC " + (st.sync ? "on" : "off") + "."); msg(st.sync ? "SYNC MODE: markers on each QRS" : "SYNC off", st.sync ? "info" : ""); updateScreen(); });
    on("kAnalyze", analyze);
    on("kPacer", function () { var p = eng.pacer; p.on = !p.on; p.paused = false; if (p.on) { p.rate = p.rate || 60; logEv("PACER on: " + p.rate + " ppm, " + p.mA + " mA."); msg("PACER ON · set RATE and CURRENT", "info"); } else { logEv("PACER off."); msg("Pacing stopped"); } updateScreen(); });
    on("kRup", function () { pacerAdj("rate", 5); }); on("kRdn", function () { pacerAdj("rate", -5); });
    on("kCup", function () { pacerAdj("mA", 5); }); on("kCdn", function () { pacerAdj("mA", -5); });
    on("kPause", function () { var p = eng.pacer; if (!p.on) { msg("PACER is off"); return; } p.paused = !p.paused; logEv(p.paused ? "Pacing paused (rate reduced to view the underlying rhythm)." : "Pacing resumed."); updateScreen(); });
    on("kLead", function () { var L = ["I", "II", "III", "PADS"]; st.leadI = (st.leadI + 1) % 4; st.leadChanged = true; el("scLead").textContent = L[st.leadI]; root.querySelector(".sc-wave.ecg .sc-wl").textContent = L[st.leadI] + "  x1.0"; logEv("Lead changed to " + L[st.leadI] + "."); });
    on("kNibp", function () { var v = st.perfusing ? (st.bp || "---/---") : "---/---"; el("nBp").textContent = v; el("nBpT").textContent = stamp(); logEv("NIBP: " + (st.perfusing ? v : "no reading (no pulse)") + "."); });
    on("aPulse", checkPulse); on("aCpr", function () { setCpr(!st.cpr); });
    on("aSed", function () { if (st.sed) { msg("Sedation already given"); return; } st.sed = true; st.sedT = now(); logEv("Sedation / analgesia given per protocol."); });
    on("aEpi", function () { st.epi++; logEv("Epinephrine 1 mg IV/IO given (" + st.epi + ")."); });
  }
  function changeEnergy(d) {
    var n = Math.max(0, Math.min(ENERGIES.length - 1, st.energyI + d));
    if (n === st.energyI) return;
    st.energyI = n;
    if (st.charged || st.charging) { st.charged = false; st.charging = false; logEv("Energy changed while charged: charge removed."); msg("CHARGE REMOVED", "warn"); }
    updateScreen();
  }
  function charge() {
    if (st.charging) return;
    if (st.charged) { msg("Already charged · press SHOCK", "warn"); return; }
    st.charging = true; st.chargeP = 0; logEv("Charging to " + ENERGIES[st.energyI] + " J.");
  }
  function shock() {
    if (!st.charged) { msg(st.charging ? "Still charging" : "Not charged · press CHARGE first", "warn"); return; }
    if (st.sync) {
      if (!eng.hasQRS()) { msg("SYNC: NO QRS DETECTED · SHOCK NOT DELIVERED", "warn"); logEv("SHOCK pressed in SYNC mode, but there's no QRS to synchronize to: no shock delivered.", "bad"); st.syncNoQRS = true; return; }
      st.pendingSync = 1; msg("SYNC: delivering on the next QRS…", "info"); return;
    }
    deliver(false);
  }
  function deliver(synced) {
    var J = ENERGIES[st.energyI], r = eng.rh.r;
    st.charged = false; if (st.firstShockT == null) st.firstShockT = now();
    if (st.cpr) { st.shockDuringCpr = true; setCpr(false, true); logEv("Shock delivered while compressions were going: always stop CPR and call \"clear\" before pressing SHOCK.", "bad"); }
    st.shocks = st.shocks || []; st.shocks.push({ t: now(), J: J, sync: synced, rhythm: r, perfusing: st.perfusing });
    logEv((synced ? "Synchronized cardioversion" : "Unsynchronized shock") + " delivered at " + J + " J.", "shock");
    msg("ENERGY DELIVERED " + J + " J", "shock");
    flash();
    if (eng.pacer.on) { eng.pacer.on = false; logEv("Pacing stopped by the shock."); }
    eng.flat = now() + 1.6;
    var after = function (rh, perf, note) { eng.setRhythm(rh, perf); st.perfusing = perf; if (note) logEv(note); updateScreen(); };
    var shockable = (r === "vf" || r === "torsades" || (r === "vt" && !st.perfusing));
    if (shockable) {
      if (!synced && J >= 120) { st.converted = true; st.bp = "102/64"; after({ r: "sinus", rate: Math.round(rnd(84, 104)) }, true, "Rhythm changes after the shock."); setCpr(false, true); }
      else after(eng.rh, false, synced ? "The synchronized shock didn't convert the arrest rhythm." : "No change: the rhythm is still shockable.");
      return;
    }
    if (st.perfusing && (r === "svt" || r === "af" || r === "flutter" || r === "vt")) {
      if (!synced) { st.induced = true; st.perfusing = false; st.bp = null; after({ r: "vf", amp: 0.45 }, false, "The unsynchronized shock landed on the T wave: the patient is now in VF and pulseless."); return; }
      if (J >= sc.minJ) { st.converted = true; st.bp = "112/70"; after({ r: "sinus", rate: Math.round(rnd(78, 98)) }, true, "Rhythm changes after cardioversion."); }
      else after(eng.rh, true, "No change at " + J + " J. Consider escalating the energy.");
      return;
    }
    if (st.perfusing && (r === "chb" || r === "b21" || r === "sinus")) { st.induced = true; st.perfusing = false; st.bp = null; after({ r: "vf", amp: 0.45 }, false, "Shocking a patient with a pulse caused VF."); return; }
    after(eng.rh, st.perfusing, "No change: this rhythm isn't shockable.");
  }
  function analyze() {
    if (st.cpr) { msg("MOTION DETECTED · STOP CPR TO ANALYZE", "warn"); logEv("ANALYZE pressed during CPR: motion detected."); return; }
    var r = eng.rh.r, sh = (r === "vf" || r === "torsades" || (r === "vt" && (!st.perfusing || eng.hr() > 150)));
    msg(sh ? "SHOCK ADVISED" : "NO SHOCK ADVISED", sh ? "shock" : "info"); logEv("ANALYZE: " + (sh ? "shock advised." : "no shock advised."));
  }
  function pacerAdj(k, d) {
    var p = eng.pacer; if (!p.on) { msg("Turn the PACER on first", "warn"); return; }
    if (k === "rate") p.rate = Math.max(40, Math.min(170, p.rate + d)); else p.mA = Math.max(0, Math.min(200, p.mA + d));
    updateScreen(); clearTimeout(st.pTimer); st.pTimer = setTimeout(function () { logEv("PACER set to " + p.rate + " ppm, " + p.mA + " mA."); }, 900);
  }
  function setCpr(on, quiet) {
    st.cpr = on; eng.cpr = on; var b = el("aCpr"); if (b) b.textContent = on ? "Stop CPR" : "Start CPR";
    if (!quiet || on) logEv(on ? "CPR in progress." : "CPR stopped.");
    if (on) st.cprEver = true;
    updateScreen();
  }
  function checkPulse() {
    var r = eng.rh.r, captured = eng.pacer.on && eng.pacer.mA >= eng.threshold && eng.hasQRS();
    var res;
    if (st.cpr) res = "Pulse check during compressions isn't reliable: pause CPR first.";
    else if (!st.perfusing) res = "No pulse.";
    else if (captured) { res = "Femoral pulse present at " + eng.pacer.rate + "/min, matching the pacer: mechanical capture confirmed."; if (st.captureT != null) st.pulseAfterCapture = true; }
    else if (r === "chb" || r === "b21") res = "Weak, slow pulse at about " + (eng.hr() || 35) + "/min.";
    else res = "Pulse present, about " + (eng.hr() || "--") + "/min" + (st.bp ? ", BP " + st.bp : "") + ".";
    st.pulseChecks.push({ t: now(), res: res }); logEv("Pulse check: " + res); el("ptStatus").innerHTML = '<b>Last pulse check</b> ' + H(res);
  }
  function flash() { var s = el("dvScreen"); s.classList.remove("flash"); void s.offsetWidth; s.classList.add("flash"); }

  /* ------------------------------------------------------------------ screen */
  function updateScreen() {
    if (!eng) return;
    var p = eng.pacer, J = ENERGIES[st.energyI];
    var e = el("scEnergy");
    e.textContent = st.charging ? "CHARGING " + Math.round(J * st.chargeP) + " J" : (st.charged ? "CHARGED " + J + " J · PRESS SHOCK" : "ENERGY " + J + " J");
    e.className = "sc-energy" + (st.charged ? " ready" : "") + (st.charging ? " charging" : "");
    el("kShock").classList.toggle("armed", st.charged);
    el("kSync").classList.toggle("on", st.sync); el("scSync").hidden = !st.sync;
    el("kPacer").classList.toggle("on", p.on); el("scPaceTag").hidden = !p.on;
    var pc = el("scPacer"); pc.hidden = !p.on;
    if (p.on) pc.innerHTML = 'PACER <b>' + p.rate + '</b> ppm &nbsp; <b>' + p.mA + '</b> mA' + (p.paused ? ' &nbsp;PAUSED' : '');
    var cap = p.on && p.mA >= eng.threshold && eng.hasQRS();
    if (cap && st.captureT == null) { st.captureT = now(); logEv("Electrical capture: every pacer spike is now followed by a wide QRS."); if (sc.type === "pace" && p.rate >= 60) { setTimeout(function () { if (eng && eng.pacer.on && eng.pacer.mA >= eng.threshold) { st.bp = "104/62"; st.perfusing = true; } }, 2500); } }
    if (!cap && st.captureT != null && p.on) { st.captureT = null; logEv("Capture lost."); }
    var hr = eng.hr(); el("nHr").textContent = hr == null ? "---" : hr;
    el("nSp").textContent = st.perfusing && !st.cpr ? (st.converted || cap ? 97 : 91) : "---";
    var co = st.cpr ? 15 : (st.perfusing ? (st.converted ? 38 : 34) : 5);
    el("nCo").textContent = co; el("nRr").textContent = "RR " + (st.cpr || !st.perfusing ? 10 : 16);
  }

  function setupCanvases() {
    ["cvEcg", "cvPl", "cvCo"].forEach(function (id) {
      var c = el(id), r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      c.width = Math.max(10, Math.round(r.width * d)); c.height = Math.max(10, Math.round(r.height * d));
      var g = c.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.lineJoin = "round"; g.lineCap = "round";
      cv[id] = { c: c, g: g, w: r.width, h: r.height, px: 0, py: null };
    });
  }
  var syncMarks = [], paceMarks = [];
  function frame(ts) {
    if (!eng) return;
    var dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
    var t0 = eng.t, t1 = t0 + dt; eng.t = t1;
    // charging
    if (st.charging) { st.chargeP = Math.min(1, st.chargeP + dt / 2.6); if (st.chargeP >= 1) { st.charging = false; st.charged = true; st.chargedAt = t1; msg("CHARGED " + ENERGIES[st.energyI] + " J · PRESS SHOCK", "shock"); logEv("Charged to " + ENERGIES[st.energyI] + " J."); } updateScreen(); }
    if (st.charged && t1 - st.chargedAt > 60) { st.charged = false; msg("CHARGE REMOVED (60 s)", "warn"); logEv("Charge removed automatically after 60 seconds."); updateScreen(); }
    if (st.pendingSync && t1 - st.pendingSync > 0 && !eng.hasQRS()) { st.pendingSync = 0; }
    eng.advance(t1);
    drawEcg(t0, t1); drawPleth(t0, t1); drawCo2(t0, t1);
    el("scClock").textContent = stamp();
    if (Math.floor(t1 * 2) !== Math.floor(t0 * 2)) updateScreen();
    raf = requestAnimationFrame(frame);
  }
  function drawEcg(t0, t1) {
    var o = cv.cvEcg, g = o.g, pps = o.w / SWEEP, mid = o.h * 0.58, scale = o.h * 0.26;
    var ampLead = [0.6, 1, 0.75, 0.9][st.leadI];
    var n = Math.max(1, Math.round((t1 - t0) * FS));
    for (var i = 1; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, xx = (t % SWEEP) * pps;
      if (xx < o.px) { o.px = 0; o.py = null; }
      g.clearRect(xx, 0, 14, o.h);
      var yv = Math.max(-1.9, Math.min(1.9, eng.sample(t) * ampLead));
      var yy = mid - yv * scale;
      if (o.py != null) { g.strokeStyle = "#3DF08E"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(o.px, o.py); g.lineTo(xx, yy); g.stroke(); }
      o.px = xx; o.py = yy;
    }
    // markers for events inside this slice
    for (var k = 0; k < eng.ev.length; k++) {
      var e = eng.ev[k]; if (e.t <= t0 || e.t > t1) continue;
      var ex = (e.t % SWEEP) * pps;
      if (e.k === "spike") { g.strokeStyle = "#FFFFFF"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(ex, mid - scale * 1.6); g.lineTo(ex, mid + scale * 0.4); g.stroke(); }
      if (st.sync && (e.k === "n" || e.k === "w" || e.k === "vt" || e.k === "paced")) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(ex - 5, 6); g.lineTo(ex + 5, 6); g.lineTo(ex, 13); g.closePath(); g.fill(); }
    }
  }
  function perfusingNow() { return st.perfusing && !st.cpr; }
  function drawPleth(t0, t1) {
    var o = cv.cvPl, g = o.g, pps = o.w / SWEEP, n = Math.max(1, Math.round((t1 - t0) * FS / 2));
    for (var i = 1; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, xx = (t % SWEEP) * pps; if (xx < o.px) { o.px = 0; o.py = null; }
      g.clearRect(xx, 0, 14, o.h);
      var y = 0;
      if (perfusingNow() || (st.cpr && st.cprEver)) {
        var lv = eng.lastV, vt = eng.vtimes; var d = 9;
        for (var j = vt.length - 1; j >= 0; j--) { if (vt[j] <= t) { d = t - vt[j]; break; } }
        if (st.cpr) y = 0.35 * Math.max(0, Math.sin(2 * Math.PI * 1.85 * t));
        else if (d < 1.2) y = Math.exp(-Math.pow((d - 0.25) / 0.09, 2)) * 0.9 + Math.exp(-Math.pow((d - 0.45) / 0.08, 2)) * 0.25;
      }
      var yy = o.h * 0.85 - y * o.h * 0.65;
      if (o.py != null) { g.strokeStyle = "#4FD8F2"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(o.px, o.py); g.lineTo(xx, yy); g.stroke(); }
      o.px = xx; o.py = yy;
    }
  }
  function drawCo2(t0, t1) {
    var o = cv.cvCo, g = o.g, pps = o.w / (SWEEP * 2), n = Math.max(1, Math.round((t1 - t0) * FS / 2));
    var et = st.cpr ? 15 : (st.perfusing ? (st.converted ? 38 : 34) : 5), rr = st.cpr || !st.perfusing ? 10 : 16, per = 60 / rr;
    for (var i = 1; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n, xx = (t % (SWEEP * 2)) * pps; if (xx < o.px) { o.px = 0; o.py = null; }
      g.clearRect(xx, 0, 14, o.h);
      var ph = (t % per) / per, y = ph < 0.12 ? 0 : (ph < 0.2 ? (ph - 0.12) / 0.08 : (ph < 0.62 ? 1 + (ph - 0.2) * 0.12 : (ph < 0.7 ? (1 - (ph - 0.62) / 0.08) : 0)));
      var yy = o.h * 0.9 - y * (et / 50) * o.h * 0.8;
      if (o.py != null) { g.strokeStyle = "#F5C842"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(o.px, o.py); g.lineTo(xx, yy); g.stroke(); }
      o.px = xx; o.py = yy;
    }
  }

  /* ------------------------------------------------------------------ feedback */
  function finish() {
    if (st.done) return; st.done = true; cancelAnimationFrame(raf);
    var items = evaluate(), crit = items.filter(function (x) { return x.crit; }), ok = crit.every(function (x) { return x.pass; });
    var p = items.filter(function (x) { return x.pass; }).length;
    HOST.save(sc.id, { ok: ok, score: [p, items.length], at: Date.now() });
    var list = items.map(function (x) {
      return '<li class="' + (x.pass ? 'ok' : (x.crit ? 'bad' : 'warn')) + '"><span class="df-ic">' + (x.pass ? '✓' : '✗') + '</span><div><b>' + H(x.t) + (x.crit ? ' <em>critical</em>' : '') + '</b><p>' + H(x.why) + '</p></div></li>';
    }).join("");
    var tfs = st.firstShockT != null ? 'First shock at ' + fmt(st.firstShockT) + '.' : 'No shocks delivered.';
    el("dfFb").innerHTML = '<div class="card df-fb ' + (ok ? 'pass' : 'fail') + '"><div class="df-fb-head"><div><div class="verdict">' + (ok ? 'Scenario passed' : 'Scenario needs review') + '</div><h3>' + p + ' of ' + items.length + ' steps correct</h3><p>' + H(tfs) + '</p></div>' +
      '<div class="df-fb-actions"><button class="btn btn-ghost" id="dfRetry">Try again</button>' + (st.i < SCEN.length - 1 ? '<button class="btn btn-primary" id="dfNext">Next scenario →</button>' : '<button class="btn btn-primary" id="dfAll">All scenarios</button>') + '</div></div>' +
      '<p class="df-lesson"><b>Key point:</b> ' + H(sc.lesson) + '</p><ol class="df-check">' + list + '</ol></div>';
    el("dfFb").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    el("dfRetry").onclick = function () { startScenario(st.i); };
    if (el("dfNext")) el("dfNext").onclick = function () { startScenario(st.i + 1); };
    if (el("dfAll")) el("dfAll").onclick = function () { DefibLab.stop(); HOST.list(); };
    root.querySelector("#dfDone").disabled = true;
    HOST.onDone && HOST.onDone();
  }
  function fmt(t) { var s = Math.round(t); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function evaluate() {
    var S = st.shocks || [], unsync = S.filter(function (s) { return !s.sync; }), synced = S.filter(function (s) { return s.sync; });
    var out = [], add = function (t, pass, why, crit) { out.push({ t: t, pass: !!pass, why: why, crit: !!crit }); };
    var paced = !!st.everPaced;
    if (sc.type === "defib") {
      add("Delivered an unsynchronized shock", unsync.some(function (s) { return s.rhythm === sc.start.r || s.rhythm === "vf" || s.rhythm === "torsades" || s.rhythm === "vt"; }), unsync.length ? "Defibrillation is the treatment for VF and pulseless VT." : "This rhythm needed defibrillation and no unsynchronized shock was delivered.", true);
      var first = unsync[0];
      add("Used defibrillation energy (120–200 J or higher)", first && first.J >= 120, first ? "Your first shock was " + first.J + " J. Biphasic defibrillation starts at the manufacturer's dose, usually 120–200 J; if unsure, use the maximum." : "No defibrillation energy was selected and delivered.", true);
      add("Kept SYNC off for the arrest rhythm", !st.syncNoQRS && !synced.length, st.syncNoQRS ? "SYNC was on, so the device waited for a QRS that never came. Turn SYNC off for VF, pulseless VT and torsades." : "Correct: arrest rhythms get unsynchronized shocks.", true);
      add("Cleared the patient before shocking", !st.shockDuringCpr, st.shockDuringCpr ? "Compressions were still going when the shock was delivered. Charge during CPR, then stop compressions, call \"clear\", and shock." : "Good: compressions stopped and everyone was clear for the shock.", true);
      add("CPR during the resuscitation", !!st.cprEver, st.cprEver ? "Good: compressions before and right after shocks." : "Start (or continue) high-quality CPR whenever the patient is pulseless.");
      add("Fast first shock", st.firstShockT != null && st.firstShockT <= 60, st.firstShockT != null ? "First shock at " + fmt(st.firstShockT) + ". Aim for as soon as a shockable rhythm is seen." : "No shock was delivered.");
      add("Didn't pace a pulseless shockable rhythm", !paced, paced ? "Pacing has no role in VF or pulseless VT." : "Correct.");
      add("Patient converted", st.converted, st.converted ? "The rhythm converted and a pulse returned." : "The rhythm didn't convert.");
    } else if (sc.type === "sync") {
      var sedOk = st.sed && (!synced.length || st.sedT <= synced[0].t);
      add("Sedated before cardioversion", sedOk, sedOk ? "Good: the patient is awake, so sedation or analgesia comes first when time allows." : (st.sed ? "Sedation came after the first shock. This patient was awake: sedate before cardioverting when time allows." : "This patient was conscious: give sedation or analgesia before cardioverting when time allows."));
      add("SYNC on for the shock", synced.length > 0 && !unsync.filter(function (s) { return s.perfusing; }).length, synced.length ? "Synchronized cardioversion times the shock to the QRS and avoids the T wave." : "An organized rhythm with a pulse needs SYNC on so the shock avoids the T wave.", true);
      add("No unsynchronized shock on a rhythm with a pulse", !unsync.some(function (s) { return s.perfusing; }), unsync.some(function (s) { return s.perfusing; }) ? "An unsynchronized shock on a perfusing rhythm can land on the T wave and cause VF, which is what happened." : "Correct.", true);
      var f = synced[0];
      add("Started at the recommended energy (" + sc.minJ + "–" + sc.maxJ + " J)", f && f.J >= sc.minJ && f.J <= sc.maxJ, f ? "Your first synchronized shock was " + f.J + " J. Recommended starting energy here: " + sc.minJ + "–" + sc.maxJ + " J." : "No synchronized shock was delivered.");
      add("Didn't pace a tachycardia", !paced, paced ? "Pacing isn't a treatment for this tachycardia." : "Correct.");
      add("Patient converted", st.converted, st.converted ? "The rhythm converted and blood pressure improved." : "The rhythm didn't convert" + (st.induced ? " and VF was induced." : "."));
    } else if (sc.type === "pace") {
      add("Turned the pacer on", !!st.everPaced, st.everPaced ? "Transcutaneous pacing is the treatment for unstable bradycardia that doesn't respond to atropine." : "This patient needed transcutaneous pacing.", true);
      add("Rate 60–80 ppm", st.maxRate >= 60 && st.maxRate <= 80 || (st.rateAtCapture >= 60 && st.rateAtCapture <= 80), "Your pacing rate was " + (st.rateAtCapture || st.maxRate || 0) + " ppm. Set 60–80 ppm for an adult.");
      add("Achieved electrical capture", st.capEver, st.capEver ? "Capture at " + st.capmA + " mA (this patient's threshold was " + eng.threshold + " mA). Set the current about 10% above the capture threshold." : "The current never reached this patient's capture threshold (" + eng.threshold + " mA): spikes without wide QRS complexes don't pump blood.", true);
      add("Confirmed mechanical capture with a pulse check", st.pulseAfterCapture, st.pulseAfterCapture ? "Good: a femoral pulse matching the pacer rate confirms mechanical capture." : "After electrical capture, confirm a pulse (femoral, not carotid) that matches the pacing rate.");
      add("Gave analgesia or sedation", st.sed, st.sed ? "Good: transcutaneous pacing is painful." : "Pacing is painful: give analgesia or sedation per protocol.");
      add("No shocks delivered", !S.length, S.length ? "This patient had a pulse and a bradycardia: shocking was harmful." : "Correct.", true);
    } else {
      add("No shock delivered", !S.length, S.length ? (sc.start.r === "asystole" ? "Asystole isn't shockable." : "PEA isn't shockable, even though the rhythm looks organized.") : "Correct: this rhythm isn't shockable.", true);
      add("CPR started", st.cprEver, st.cprEver ? "Good: high-quality CPR is the main treatment." : "This patient is pulseless and needs CPR.", true);
      add("Epinephrine given", st.epi > 0, st.epi ? "Good: give epinephrine as soon as possible in non-shockable arrests." : "Give epinephrine 1 mg as soon as possible for asystole and PEA.");
      add("Didn't pace", !paced, paced ? "Pacing isn't recommended for asystolic or PEA arrest." : "Correct.");
      if (sc.start.r === "asystole") add("Confirmed asystole in another lead", st.leadChanged, st.leadChanged ? "Good: changing leads helps rule out fine VF or a disconnected lead." : "Confirm a flat line in a second lead (press LEAD) to rule out fine VF.");
      if (sc.pea) add("Checked for a pulse", st.pulseChecks.length > 0, st.pulseChecks.length ? "Good: an organized rhythm without a pulse is PEA." : "Always check for a pulse when the monitor shows an organized rhythm.", true);
    }
    return out;
  }

  /* ------------------------------------------------------------------ tracking a few derived facts */
  setInterval(function () {
    if (!eng || !st || st.done) return;
    var p = eng.pacer;
    if (p.on) { st.everPaced = true; st.maxRate = Math.max(st.maxRate || 0, p.rate); }
    if (p.on && p.mA >= eng.threshold && eng.hasQRS() && !st.capEver) { st.capEver = true; st.capmA = p.mA; st.rateAtCapture = p.rate; }
  }, 250);

  /* ------------------------------------------------------------------ public */
  window.DefibLab = {
    scenarios: SCEN,
    render: function (container, host) {
      HOST = host; root = container; HOST.list = function () { window.DefibLab.list(); };
      window.DefibLab.list();
    },
    list: function () {
      cancelAnimationFrame(raf); eng = null;
      root.innerHTML = scenarioListHTML();
      root.querySelectorAll(".df-case").forEach(function (b) { b.onclick = function () { startScenario(+b.getAttribute("data-i")); window.scrollTo(0, 0); }; });
    },
    stop: function () { cancelAnimationFrame(raf); eng = null; },
    resize: function () { if (eng) setupCanvases(); }
  };
  window.addEventListener("resize", function () { if (eng) { setupCanvases(); } });
})();
