/* CSHealthED Code lab: adult ACLS cases run on the live monitor/defibrillator, with adaptive coaching.
   Loaded on demand by index.html. Exposes window.CodeLab = { render(el, host), stop() }.
   host = { esc, load(id), save(id, result) }. Needs window.DefibLab (defib.js) for the device.

   Content follows the current AHA adult advanced life support algorithms (cardiac arrest, bradycardia with a
   pulse, tachycardia with a pulse, post-cardiac arrest care). Always follow local protocols and medical direction. */
(function () {
  "use strict";
  var HOST, root, dev, cur, timer;
  var H = function (s) { return HOST.esc(String(s)); };

  /* ------------------------------------------------------------------ rhythms the monitor can show */
  var RH = {
    vf: { r: "vf", amp: 0.55 }, vfFine: { r: "vf", amp: 0.2 }, pvt: { r: "vt", rate: 184 }, vt: { r: "vt", rate: 168 },
    svt: { r: "svt", rate: 196 }, af: { r: "af", rate: 158 }, afl: { r: "flutter" }, asys: { r: "asystole" },
    nsr: { r: "sinus", rate: 92 }, stach: { r: "sinus", rate: 108 }, brady: { r: "sinus", rate: 38 }, chb: { r: "chb" }, pea: { r: "sinus", rate: 64 }
  };
  // a patient state: rhythm, pulse, blood pressure, CPR in progress
  var P0 = P;
  function P(rh, pulse, bp, cpr, good) { return { rhythm: RH[rh], pulse: !!pulse, bp: bp || null, cpr: !!cpr, good: !!good }; }

  /* ------------------------------------------------------------------ step builders
     Q: a decision. opts: [text, ok, why, prompt (the "are you sure?" coaching), result (what happens if they insist)]
     D: a device task. goal: shock | sync | pace                                                                      */
  function Q(p, say, q, opts) { return { t: "q", p: p, say: say, q: q, opts: opts }; }
  function D(p, say, task, goal, how) { return { t: "d", p: p, say: say, task: task, goal: goal, how: how }; }
  var ARREST_RESULT = "Precious seconds pass without compressions. Every pause drops coronary and brain perfusion back to zero.";

  var NO_ATRO = "Atropine isn't indicated for 2nd- or 3rd-degree AV block. The block sits at or below the AV node, so atropine can't get the impulses through to the ventricles, and it can make the block worse. Go straight to pacing.";

  // --- cardiac arrest pieces (Adult Cardiac Arrest Algorithm)
  function recognizeArrest(say) {
    return Q(P("nsr", false, null, false), say, "What do you do first?", [
      ["Start high-quality CPR, give oxygen and attach the monitor/defibrillator pads", true, "Unresponsive, not breathing normally and no pulse within 10 seconds: start CPR right away and get the pads on. Every algorithm begins here."],
      ["Check a carotid pulse for a full 15–20 seconds to be certain before starting compressions", false, "A pulse check takes no more than 10 seconds. If you aren't sure there's a pulse, start compressions.", "How long should a pulse check take before you commit to CPR?", ARREST_RESULT],
      ["Open the airway and give 2 rescue breaths, then reassess for signs of life before compressions", false, "Adult CPR starts with compressions (C-A-B). Breaths come after the first 30 compressions.", "In adult cardiac arrest, what comes first: compressions or breaths?", ARREST_RESULT],
      ["Hold compressions until the pads are on and the rhythm is analyzed, so CPR doesn't delay the shock", false, "Start CPR immediately and keep it going while the pads are placed. Pause only for the rhythm check.", "Should compressions wait for the monitor?", ARREST_RESULT]
    ]);
  }
  function identifyShockable(p, name, note) {
    return Q(p, (note ? note + " " : "") + "Pads are on. Compressions pause for a rhythm check (under 10 seconds).", "What is the rhythm, and what's next?", [
      [name + ": shockable, defibrillate now, then resume CPR immediately", true, name + " is shockable: deliver an unsynchronized shock as soon as possible, then resume CPR immediately."],
      [name + ": shockable, but give epinephrine 1 mg first so the shock is more likely to work", false, "Shock first. In VF/pVT, epinephrine is given after the second shock.", "Which comes first for a shockable rhythm: the drug or the shock?", "Two more minutes of VF with no shock: the chance of conversion falls with every minute."],
      [name + ": shockable, with SYNC on so the shock avoids the T wave", false, "VF and pulseless VT get an unsynchronized shock. SYNC may never fire because there's no reliable QRS to sense.", "Does SYNC help in a pulseless rhythm?", "The device waits for a QRS it can't find, and no shock is delivered."],
      [name + ": shockable, but finish 2 minutes of CPR before the first shock", false, "Once a shockable rhythm is identified, shock as soon as possible. Keep CPR going while the device charges.", "How quickly should a shockable rhythm be defibrillated?", "Two more minutes of VF with no shock: the chance of conversion falls with every minute."]
    ]);
  }
  function shock(p, n) {
    return D(p, n === 1 ? "Shockable rhythm confirmed. Everyone clear." : "Two minutes of CPR are done. Rhythm check: still shockable.",
      "Deliver an unsynchronized shock at the defibrillation dose (biphasic 120–200 J, or your device's recommended dose; if unknown, use the maximum).",
      { kind: "shock", minJ: 120 }, "Make sure SYNC is off, set the energy to 120–200 J with ENERGY SELECT ▲▼, press CHARGE, wait for CHARGED, then press SHOCK.");
  }
  function afterShock(p) {
    return Q(p, "Shock delivered. The monitor still looks shockable for a moment.", "What do you do immediately after the shock?", [
      ["Resume CPR right away for 2 minutes, starting with compressions", true, "Restart compressions immediately: don't stop to check the rhythm or a pulse. The heart is stunned after a shock and needs perfusion."],
      ["Pause for a quick 5-second pulse check, then resume CPR if there's no pulse", false, "The pulse and rhythm are checked at the end of the 2-minute cycle, not right after the shock.", "Do you want to pause compressions right now?", ARREST_RESULT],
      ["Resume CPR, and check the rhythm again after 1 minute to catch it early", false, "CPR runs in 2-minute cycles between rhythm checks. Extra checks add pauses.", "How long is each CPR cycle between rhythm checks?", "An extra pause at 1 minute drops perfusion back to zero."],
      ["Resume CPR and give amiodarone 300 mg now that the first shock failed", false, "Amiodarone (or lidocaine) comes after the third shock. Epinephrine comes after the second.", "When does the antiarrhythmic come in the VF/pVT pathway?", "An antiarrhythmic given too early, ahead of the vasopressor."]
    ]);
  }
  function cprQuality(p) {
    return Q(p, "CPR is underway and an IV is being placed. ETCO₂ reads 9 mmHg.", "What does that ETCO₂ tell you, and what do you change?", [
      ["Compressions are probably inadequate: push harder and faster (100–120/min, at least 2 in/5 cm, full recoil) and switch compressors", true, "ETCO₂ under 10 mmHg during CPR suggests poor compressions. Improve depth, rate and recoil, swap the compressor every 2 minutes, and minimize pauses."],
      ["Ventilate faster, about 1 breath every 3 seconds, to raise the ETCO₂", false, "Overventilation raises chest pressure and reduces blood return. Without an advanced airway it's 30:2; with one, 1 breath every 6 seconds.", "Does breathing faster improve blood flow during CPR?", "Fast ventilation drops venous return and coronary perfusion."],
      ["Give epinephrine now: a low ETCO₂ means the vasopressor is due", false, "Drug timing follows the algorithm. A low ETCO₂ points to compression quality first.", "What does ETCO₂ mainly reflect during CPR?", "The real problem, weak compressions, isn't fixed."],
      ["A low reading this early in an arrest is expected: keep the same compressor and recheck in 10 minutes", false, "Under 10 mmHg suggests poor CPR now. Fix it and swap compressors every 2 minutes.", "Is a reading under 10 mmHg acceptable during CPR?", "Ten more minutes of poor compressions."]
    ]);
  }
  function epiShockable(p) {
    return Q(p, "Second shock delivered and CPR has resumed. IV access is in.", "Which medication now?", [
      ["Epinephrine 1 mg IV/IO, then every 3–5 minutes", true, "In shockable arrest, epinephrine is given after the second shock (once CPR resumes) and repeated every 3–5 minutes."],
      ["Amiodarone 300 mg IV/IO now; epinephrine after the third shock", false, "The order is reversed: epinephrine after the second shock, the antiarrhythmic after the third.", "Which comes first in the VF/pVT pathway: the vasopressor or the antiarrhythmic?", "The vasopressor is delayed by a full cycle."],
      ["Epinephrine 1 mg IV/IO, then every 1–2 minutes until ROSC", false, "Repeat epinephrine every 3–5 minutes, not every 1–2.", "How often is epinephrine repeated in arrest?", "Too much epinephrine: more myocardial oxygen demand and post-ROSC arrhythmias."],
      ["Vasopressin 40 units IV/IO in place of the first epinephrine", false, "Vasopressin was removed from the AHA arrest algorithm: it adds nothing over epinephrine.", "Is vasopressin still in the arrest algorithm?", "A drug with no added benefit replaces the one that's recommended."]
    ]);
  }
  function antiarrhythmic(p) {
    return Q(p, "Third shock delivered, CPR resumed. Still no ROSC.", "Which antiarrhythmic and dose?", [
      ["Amiodarone 300 mg IV/IO bolus (second dose 150 mg), or lidocaine 1–1.5 mg/kg", true, "For shock-refractory VF/pVT: amiodarone 300 mg, then 150 mg; or lidocaine 1–1.5 mg/kg, then 0.5–0.75 mg/kg. Keep looking for reversible causes."],
      ["Amiodarone 150 mg IV over 10 minutes", false, "150 mg over 10 minutes is the dose for VT with a pulse (or the second arrest dose).", "What's the first amiodarone dose in cardiac arrest?", "Too little, too slowly for a pulseless patient."],
      ["Amiodarone 300 mg IV/IO, and 300 mg again for the second dose", false, "The second amiodarone dose in arrest is 150 mg.", "What's the second amiodarone dose in arrest?", "Excess amiodarone: hypotension and bradycardia after ROSC."],
      ["Lidocaine 3 mg/kg IV/IO as a single bolus", false, "Lidocaine is 1–1.5 mg/kg first, then 0.5–0.75 mg/kg, up to 3 mg/kg in total.", "What's the first lidocaine dose?", "Lidocaine toxicity: seizures and myocardial depression."]
    ]);
  }
  function airway(p) {
    return Q(p, "CPR continues with bag-mask ventilation at 30:2. A paramedic is ready to place an advanced airway.", "How do you manage the airway and ventilation from here?", [
      ["Place the advanced airway with minimal interruption, confirm it with waveform capnography, then give 1 breath every 6 seconds with continuous compressions", true, "Advanced airway placement shouldn't interrupt compressions for long. Confirm with waveform capnography, then 10 breaths/min with continuous compressions."],
      ["Pause compressions so the tube goes in on the first try, then confirm by listening for breath sounds", false, "Keep pauses under 10 seconds, and confirm with waveform capnography, not just listening.", "How long can compressions pause, and what's the best confirmation?", ARREST_RESULT],
      ["Place the airway, confirm it with waveform capnography, then continue 30:2 cycles", false, "With an advanced airway, compressions are continuous and breaths are given every 6 seconds.", "Do you still need 30:2 pauses with an advanced airway?", "Unneeded pauses lower perfusion."],
      ["Place the airway, confirm it with waveform capnography, then ventilate 1 breath every 3 seconds", false, "One breath every 6 seconds (10/min) with an advanced airway. Every 3 seconds is overventilation.", "What's the ventilation rate with an advanced airway?", "Overventilation: less venous return and lower coronary perfusion."]
    ]);
  }
  function rosc(p) {
    return roscQ(p);
  }
  function roscQ(p) {
    var q = Q(p, "During compressions the ETCO₂ suddenly rises from 18 to 46 mmHg, and the monitor shows an organized rhythm.", "What does that suggest, and what do you do?", [
      ["Likely return of spontaneous circulation: check for a pulse at the rhythm check", true, "An abrupt, sustained rise in ETCO₂ (often to 40 mmHg or more) is a strong sign of ROSC. Check the pulse and blood pressure."],
      ["Likely ROSC: give the next epinephrine dose now to support the blood pressure", false, "An arrest dose of epinephrine into a beating heart can cause severe hypertension and arrhythmias.", "Is the 1 mg arrest dose right if the heart is beating again?", "A bolus of epinephrine into a beating heart: dangerous hypertension and tachycardia."],
      ["It's the effect of the last epinephrine dose: continue CPR and give the next dose on schedule", false, "Epinephrine can nudge ETCO₂, but an abrupt, sustained jump to 40+ mmHg means ROSC.", "How big a change does a drug usually cause, compared with this?", "ROSC goes unrecognized and an arrest dose is given to a beating heart."],
      ["The tube has slipped into the esophagus: pull it and re-intubate", false, "An esophageal tube gives an ETCO₂ near zero, not a sudden rise.", "What does ETCO₂ look like with an esophageal tube?", "A good airway is pulled from a patient who just got a pulse back."]
    ]);
    q.rosc = 1; return q;
  }

  // --- post-cardiac arrest care (Adult Post-Cardiac Arrest Care Algorithm)
  function postCare(stemi) {
    var P = function (rh, pulse, bp, cpr, good) { var p = P0(rh, pulse, bp, cpr, good); if (stemi) p.twelve = "antstemi"; return p; };
    return [
      Q(P("nsr", true, "84/50", false, true), "ROSC. Pulse 104, BP 84/50, SpO₂ 99% on 100% oxygen, advanced airway in place.", "What are your ventilation and oxygen targets?", [
        ["Titrate oxygen to SpO₂ 92–98%, ventilate about 10 breaths/min, and aim for a normal PaCO₂ (35–45 mmHg)", true, "After ROSC avoid both hypoxia and hyperoxia (SpO₂ 92–98%) and avoid hyperventilation: start at 10 breaths/min and titrate to a normal PaCO₂/ETCO₂."],
        ["Keep 100% oxygen and aim for an SpO₂ of 100%, ventilating about 10 breaths/min", false, "Hyperoxia can worsen brain injury after an arrest. Titrate down to 92–98%.", "Is an SpO₂ of 100% the goal after ROSC?", "Excess oxygen adds to the brain's reperfusion injury."],
        ["Titrate oxygen to SpO₂ 92–98% and ventilate 20 breaths/min to keep the ETCO₂ around 25–30 mmHg", false, "Hyperventilation lowers CO₂, which constricts brain vessels. Aim for a normal PaCO₂.", "What does a low CO₂ do to blood flow to the brain?", "Cerebral vasoconstriction and less brain blood flow."],
        ["Titrate to SpO₂ 88–92% and let the PaCO₂ rise to 50–60 mmHg", false, "That's too little oxygen and too much CO₂. Aim for SpO₂ 92–98% and a normal PaCO₂.", "What are the SpO₂ and PaCO₂ targets after ROSC?", "Hypoxia and acidosis."]
      ]),
      Q(P("nsr", true, "84/50", false, true), "BP is 84/50 (MAP about 61).", "How do you manage the blood pressure?", [
        ["Treat hypotension: IV/IO fluid bolus and a vasopressor infusion as needed, keeping SBP at least 90 and MAP at least 65", true, "Post-arrest targets: SBP ≥ 90 mmHg and MAP ≥ 65 mmHg. Use fluids and vasopressors (e.g. norepinephrine or epinephrine infusion) per protocol."],
        ["Give a fluid bolus and start a vasopressor only if the SBP falls below 70", false, "The targets are SBP ≥ 90 and MAP ≥ 65. Don't wait for it to get worse.", "What are the blood pressure targets after ROSC?", "The brain and heart stay underperfused."],
        ["Give epinephrine 1 mg IV push to bring the pressure up quickly", false, "The 1 mg arrest dose is for pulseless patients. A pulse is present: use an infusion and titrate.", "Is the arrest bolus dose right for a patient with a pulse?", "A sudden surge in pressure and heart rate; risk of re-arrest."],
        ["Aim for a MAP of 50–55 mmHg to rest the stunned heart", false, "Hypotension after ROSC is linked to worse outcomes. Aim for MAP ≥ 65.", "What's the minimum MAP after ROSC?", "The brain and heart stay underperfused."]
      ]),
      Q(P("nsr", true, "102/64", false, true), "Blood pressure is improving. Press 12-LEAD on the monitor and read the ECG.", "What's the next priority?",
        stemi ? [
          ["ST elevation in V1–V4: activate the cath lab for emergent coronary angiography", true, "Get a 12-lead as soon as possible after ROSC. STEMI → emergent angiography/PCI."],
          ["ST elevation right after shocks is usually from the shocks: repeat the 12-lead in 30 minutes", false, "ST elevation after ROSC should be treated as a STEMI.", "What should ST elevation after ROSC trigger?", "Delayed reperfusion for an occluded coronary artery."],
          ["ST elevation in V1–V4: transport to the closest emergency department and repeat the 12-lead there", false, "Go to a PCI-capable cardiac arrest center and activate the cath lab early.", "Where should a post-arrest STEMI go?", "Reperfusion is delayed by a transfer."],
          ["ST elevation in V1–V4: give nitroglycerin 0.4 mg SL and reassess before calling", false, "The patient is intubated and recently hypotensive, and nitroglycerin doesn't replace reperfusion.", "Can this patient take sublingual nitroglycerin, and does it fix an occluded artery?", "Hypotension and delayed cath lab activation."]
        ] : [
          ["No STEMI: look for and treat the cause (Hs and Ts), consult cardiology, and go to a cardiac-arrest-capable center", true, "Even without STEMI, find and treat the cause, and consider angiography for a suspected cardiac cause after expert consultation."],
          ["No STEMI rules out a cardiac cause: go to the closest hospital", false, "A normal 12-lead doesn't rule out a cardiac cause. Angiography may still be needed.", "Does a 12-lead without ST elevation rule out a coronary cause?", "A treatable cause is missed."],
          ["No STEMI: give a fibrinolytic in the field for a presumed pulmonary embolism", false, "Nothing here points to PE, and a fibrinolytic carries a serious bleeding risk.", "What evidence do you have for a PE?", "Bleeding with no clear benefit."],
          ["No STEMI: stay on scene and repeat the 12-lead every few minutes until it changes", false, "Serial 12-leads are fine, but don't delay transport.", "Should a repeat 12-lead delay transport?", "Definitive care is delayed."]
        ]),
      Q(P("nsr", true, "108/68", false, true), "The patient remains unresponsive and doesn't follow commands. Temperature 37.6 °C.", "What else do you start?", [
        ["Deliberate temperature control: maintain 32–37.5 °C and prevent fever, plus check glucose and get an EEG/neurology assessment in hospital", true, "Comatose patients after ROSC need deliberate temperature control (32–37.5 °C) with active fever prevention, and multimodal neuroprognostication later, not in the first hours."],
        ["Cool to 32–36 °C, but only if the first rhythm was VF", false, "Temperature control applies to every comatose survivor, whatever the first rhythm.", "Does temperature control depend on the arrest rhythm?", "A patient who'd benefit goes without it."],
        ["Start cooling now with 2 L of ice-cold saline in the field", false, "Rapid cold IV fluids before hospital aren't recommended: they don't help and can cause pulmonary edema and re-arrest.", "Is prehospital cold saline recommended?", "Pulmonary edema and a risk of re-arrest."],
        ["Let the temperature drift: a mild fever up to 38.5 °C is acceptable", false, "Fever worsens brain injury. Prevent temperatures over 37.5 °C.", "What's the upper temperature limit after ROSC?", "Fever worsens brain injury."]
      ])
    ];
  }

  /* ------------------------------------------------------------------ cases */
  var CASES = [
    { id: "vf1", cat: "vf", title: "Collapse at the gym", text: "A 52-year-old man collapses during a spin class. A bystander is doing CPR when you arrive.", steps: [].concat(
      recognizeArrest("He's unresponsive and gasping, with no pulse."),
      identifyShockable(P("vf", false, null, false), "Ventricular fibrillation"),
      shock(P("vf", false, null, false), 1), afterShock(P("vf", false, null, true)), cprQuality(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 2), epiShockable(P("vf", false, null, true)), airway(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 3), antiarrhythmic(P("vf", false, null, true)), rosc(P("nsr", false, null, true))) },
    { id: "pvt1", cat: "vf", title: "Wide and fast, no pulse", text: "A 67-year-old with heart failure is found unresponsive in a chair.", steps: [].concat(
      recognizeArrest("No breathing, no pulse."), identifyShockable(P("pvt", false, null, false), "Pulseless ventricular tachycardia"),
      shock(P("pvt", false, null, false), 1), afterShock(P("pvt", false, null, true)),
      shock(P("vf", false, null, false), 2), epiShockable(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 3), antiarrhythmic(P("vf", false, null, true)), rosc(P("nsr", false, null, true))) },
    { id: "asy1", cat: "pea", title: "Flat line at home", text: "An 81-year-old found unresponsive in bed by family; last seen 30 minutes ago.", steps: [
      recognizeArrest("No pulse, not breathing."),
      Q(P("asys", false, null, false), "Pads on. The monitor shows a flat line.", "What do you do?", [
        ["Confirm it's asystole (check leads, gain and a second lead), resume CPR and don't shock", true, "Asystole is non-shockable. Confirm it isn't fine VF or a disconnected lead, then continue high-quality CPR."],
        ["Fine VF can look flat: shock once at 200 J to be safe, then resume CPR", false, "Confirm the rhythm in a second lead and with more gain. Don't shock a flat line.", "How do you tell fine VF from asystole without shocking?", "Compressions are interrupted for a shock that can't help."],
        ["Asystole: start transcutaneous pacing at 70 ppm with maximum output", false, "Pacing isn't recommended for asystolic arrest.", "Does pacing help in asystole?", "No capture; time lost."],
        ["Asystole: CPR plus atropine 1 mg every 3–5 minutes, up to 3 mg", false, "Atropine was removed from the arrest algorithm.", "Is atropine an arrest drug?", "No benefit."]
      ]),
      Q(P("asys", false, null, true), "CPR in progress. IO access is in.", "Which medication, and when?", [
        ["Epinephrine 1 mg IV/IO as soon as possible, then every 3–5 minutes", true, "In non-shockable arrest, give epinephrine as early as possible."],
        ["Epinephrine 1 mg IV/IO after the second rhythm check, as in VF", false, "In asystole and PEA, epinephrine goes in as soon as possible. Waiting for the second check is the VF timing.", "When should epinephrine be given in asystole/PEA?", "A delayed vasopressor."],
        ["Vasopressin 40 units IV/IO once, then epinephrine", false, "Vasopressin was removed from the algorithm.", "Is vasopressin still in the arrest algorithm?", "A delayed vasopressor with no added benefit."],
        ["Epinephrine 1 mg IV/IO with sodium bicarbonate 1 mEq/kg every dose", false, "Bicarbonate isn't routine. It's for specific causes such as hyperkalemia or some overdoses.", "Is bicarbonate a routine arrest drug?", "Possible harm without a reason to give it."]
      ]),
      cprQuality(P("asys", false, null, true)),
      Q(P("asys", false, null, true), "Still asystole at the 2-minute rhythm check.", "What should you be thinking about during each cycle?", [
        ["The reversible causes (Hs and Ts): hypovolemia, hypoxia, acidosis, high/low potassium, hypothermia, tension pneumothorax, tamponade, toxins, thrombosis", true, "Search for and treat the Hs and Ts in every non-shockable arrest."],
        ["The Hs only: the Ts (tension pneumothorax, tamponade, toxins, thrombosis) are for trauma patients", false, "The Ts apply to every arrest: toxins and thrombosis (MI, PE) are common medical causes.", "Are toxins and thrombosis trauma problems?", "A reversible cause is missed."],
        ["Whether to switch to the shockable pathway and start amiodarone", false, "Switch only if a rhythm check shows VF/pVT.", "Is the rhythm shockable?", "No benefit."],
        ["Hypoglycemia and hyperthermia: check a glucose and start cooling", false, "Hypoglycemia is worth checking, but hypothermia, not hyperthermia, is on the list. Work through all the Hs and Ts.", "What's the full list of reversible causes?", "Most of the reversible causes go unchecked."]
      ]),
      Q(P("asys", false, null, true), "After 25 minutes of high-quality ALS with an advanced airway, ETCO₂ stays at 7 mmHg and the rhythm is still asystole.", "What does this suggest?", [
        ["A very low chance of ROSC: one of several factors in deciding, with medical direction and your protocol, whether to stop", true, "ETCO₂ below 10 mmHg after 20 minutes of ALS with an advanced airway is associated with very low survival, but it should never be the only factor in stopping."],
        ["ETCO₂ under 10 after 20 minutes decides it: stop now", false, "ETCO₂ is one factor, not the only one.", "Should one number decide termination?", "A decision made on incomplete information."],
        ["The tube must be misplaced: pull it and re-intubate", false, "If you doubt placement, recheck it. A confirmed tube with a low reading after 20 minutes reflects very low blood flow.", "The tube was confirmed with waveform capnography. What does a persistently low reading mean?", "A good airway is pulled and compressions pause."],
        ["Keep going at least another 30 minutes, whatever the ETCO₂", false, "There's no fixed duration. Decide with medical direction using all the factors.", "Who decides when to stop, and on what?", "Prolonged efforts with no realistic benefit."]
      ])
    ] },
    { id: "pea1", cat: "pea", title: "Organized, but no pulse", text: "A 58-year-old dialysis patient who missed two sessions collapses in the waiting room.", steps: [
      recognizeArrest("Unresponsive with agonal breathing. You can't feel a pulse."),
      Q(P("pea", false, null, false), "Pads on, rhythm check. The monitor shows an organized rhythm at about 64, but there's no pulse.", "What is this, and what do you do?", [
        ["Pulseless electrical activity: resume CPR, no shock, and give epinephrine 1 mg as soon as possible", true, "Organized electrical activity without a pulse is PEA: non-shockable. CPR, early epinephrine, and find the cause."],
        ["Sinus rhythm with a pulse too weak to feel: get a blood pressure and start fluids", false, "No palpable pulse with an organized rhythm is PEA: start CPR.", "What does the pulse check tell you?", ARREST_RESULT],
        ["Pulseless electrical activity: resume CPR and start transcutaneous pacing", false, "Pacing isn't used in PEA.", "Does pacing help in PEA?", "Time lost; no benefit."],
        ["Pulseless electrical activity: resume CPR and give epinephrine after the second rhythm check", false, "In PEA, epinephrine goes in as soon as possible.", "When does epinephrine go in for PEA?", "A delayed vasopressor."]
      ]),
      Q(P("pea", false, null, true), "His last labs showed potassium 6.9 and earlier ECGs had peaked T waves.", "Which reversible cause is most likely, and how do you treat it?", [
        ["Hyperkalemia: calcium chloride 1 g IV (or calcium gluconate) and sodium bicarbonate, per protocol", true, "Suspected hyperkalemia in arrest: give IV calcium to stabilize the heart, and consider sodium bicarbonate. Continue CPR and epinephrine."],
        ["Hyperkalemia: sodium bicarbonate alone (calcium is only for low calcium)", false, "Calcium is the first drug: it stabilizes the heart muscle against high potassium.", "What stabilizes the myocardium in hyperkalemia?", "The heart stays unprotected from the potassium."],
        ["Hyperkalemia: insulin and glucose IV, then reassess in 15 minutes", false, "Insulin shifts potassium too slowly for an arrest. Calcium works immediately.", "What works fastest in a hyperkalemic arrest?", "Too slow to help the arrest."],
        ["Hypovolemia from missed dialysis: 2 L of normal saline", false, "Missed dialysis causes fluid overload and high potassium, not hypovolemia.", "Does missed dialysis make a patient dry or overloaded?", "Fluid overload, and the potassium goes untreated."]
      ]),
      rosc(P("nsr", false, null, true))
    ] },
    { id: "brady1", cat: "brady", title: "Slow and confused", text: "A 74-year-old with dizziness and confusion. Pale and diaphoretic.", steps: [
      Q(P("chb", true, "72/40", false), "Heart rate 36, BP 72/40, confused. The monitor shows this rhythm (press 12-LEAD to see it on a 12-lead).", "What is it, is it stable, and what's first?", [
        ["Unstable third-degree (complete) AV block: transcutaneous pacing now", true, "Complete heart block with hypotension and confusion is unstable. " + NO_ATRO],
        ["Unstable third-degree AV block: atropine 1 mg IV, repeated every 3–5 minutes up to 3 mg", false, NO_ATRO, "Where is the block, and can atropine get impulses through it?", "No change in rate while the pressure keeps falling."],
        ["Unstable sinus bradycardia: atropine 1 mg IV first, then pace if it fails", false, "Look again: the P waves march through without any fixed PR interval. That's complete heart block, and " + NO_ATRO.charAt(0).toLowerCase() + NO_ATRO.slice(1), "Is every P wave followed by a QRS?", "No change in rate while the pressure keeps falling."],
        ["Stable complete heart block: he's still talking, so monitor and transport", false, "Hypotension and altered mental status make this unstable.", "Which signs make a bradycardia unstable?", "Perfusion keeps falling; he becomes less responsive."]
      ]),
      Q(P("chb", true, "70/38", false), "You're setting up the pacer. He's awake and anxious.", "What do you do before you start pacing?", [
        ["Give analgesia/sedation as blood pressure allows, and explain what's happening", true, "Transcutaneous pacing is painful. Treat pain and anxiety when the blood pressure permits; don't delay pacing in an unstable patient."],
        ["Nothing: sedation and analgesia are contraindicated with a BP of 70/38", false, "A small, titrated dose of analgesia is usually tolerated. Don't withhold it completely.", "Is a small, titrated dose of analgesia possible here?", "A frightened patient in severe pain."],
        ["Give midazolam 5 mg IV and wait until he's fully sedated before turning the pacer on", false, "A large sedative dose can drop the pressure further, and waiting delays pacing in an unstable patient.", "What does a big benzodiazepine dose do to a BP of 70/38?", "Worse hypotension and a delay."],
        ["Turn the pacer on at a low current and see whether he tolerates it before giving anything", false, "Below the capture threshold the pacer does nothing but hurt. Treat pain and raise the current to capture.", "What happens to the heart rate below the capture threshold?", "Pain without capture, and the hypotension continues."]
      ]),
      D(P("chb", true, "70/38", false), "Pads are on. Start pacing.", "Pace at 60–80 ppm and increase the current until every spike captures (wide QRS after each spike).",
        { kind: "pace", rate: [60, 80] }, "Press PACER, set RATE to 60–80 with ▲▼, then raise CURRENT with ▲ until each pacer spike is followed by a wide QRS."),
      Q(P("chb", true, "104/62", false, true), "Every spike is followed by a wide QRS.", "How do you confirm mechanical capture?", [
        ["Feel for a femoral pulse that matches the pacing rate (and check the blood pressure)", true, "Confirm mechanical capture with a femoral pulse matching the paced rate; the muscle twitching from pacing makes carotid pulses unreliable."],
        ["Feel for a carotid pulse that matches the pacing rate", false, "Pacing makes the neck muscles twitch, which can feel like a pulse.", "Why might a carotid pulse mislead you here?", "You may mistake muscle jerking for a pulse."],
        ["A wide QRS after every spike on the monitor confirms it", false, "That's electrical capture. It doesn't prove the heart is pumping.", "Does a QRS on the monitor always mean a pulse?", "Missed loss of mechanical capture."],
        ["Chest-wall muscle twitching with each spike confirms it", false, "Twitching is skeletal muscle stimulation, not the heart.", "What does chest-wall twitching come from?", "Missed loss of mechanical capture."]
      ]),
      Q(P("chb", true, "104/62", false, true), "Capture confirmed. On the way, the pads start to lose contact and capture is intermittent.", "If pacing fails or isn't tolerated, what's the backup?", [
        ["A chronotropic infusion: epinephrine 2–10 mcg/min or dopamine 5–20 mcg/kg/min, and expert consultation for transvenous pacing", true, "When pacing fails or isn't tolerated, use an epinephrine or dopamine infusion, and get expert help for transvenous pacing."],
        ["Atropine 1 mg IV while you fix the pads", false, NO_ATRO, "Does atropine work in complete heart block?", "No change in rate."],
        ["Epinephrine 1 mg IV push", false, "The 1 mg push is the arrest dose. A bradycardia with a pulse gets an infusion of 2–10 mcg/min.", "What's the epinephrine dose for bradycardia with a pulse?", "Severe hypertension and tachyarrhythmias."],
        ["Dopamine 1–2 mcg/kg/min", false, "The bradycardia dose of dopamine is 5–20 mcg/kg/min.", "What's the dopamine dose for bradycardia?", "Too little to raise the rate."]
      ])
    ] },
    { id: "svt1", cat: "svt", title: "The racing heart", text: "A 31-year-old with sudden palpitations at work.", steps: [
      Q(P("svt", true, "118/76", false), "Heart rate 196, regular and narrow. BP 118/76, alert, mild chest tightness only when anxious.", "Stable or unstable, and what's first?", [
        ["Stable narrow, regular tachycardia: try a vagal maneuver (e.g. modified Valsalva) first", true, "Stable regular narrow-complex tachycardia: vagal maneuvers first, then adenosine if they fail."],
        ["Stable: adenosine 6 mg rapid IV push first, then a vagal maneuver if it fails", false, "Vagal maneuvers come first. They're quick, free and often work.", "What's the first step for stable SVT?", "An unpleasant drug given when a vagal maneuver might have worked."],
        ["Stable: diltiazem 0.25 mg/kg IV as the first-line drug", false, "Vagal maneuvers and then adenosine come first. Calcium channel blockers are for when adenosine fails.", "Where do calcium channel blockers come in the SVT pathway?", "Hypotension risk, skipping simpler steps."],
        ["Unstable because the rate is over 150: synchronized cardioversion", false, "A fast rate alone doesn't make it unstable. Look for hypotension, altered mental status, shock, ischemic chest pain or heart failure.", "Which signs would make this unstable?", "An unnecessary, painful procedure."]
      ]),
      Q(P("svt", true, "116/74", false), "The Valsalva maneuver doesn't work. IV in the antecubital.", "Next?", [
        ["Adenosine 6 mg rapid IV push followed immediately by a 20 mL saline flush; 12 mg if needed", true, "Adenosine 6 mg rapid push with a flush, then 12 mg if the first dose doesn't work. Record a strip during the push."],
        ["Adenosine 6 mg slowly over 1–2 minutes", false, "Adenosine has a half-life of seconds: it must be pushed fast with a flush.", "How fast must adenosine be given?", "It's metabolized before reaching the heart; no effect."],
        ["Adenosine 12 mg rapid push first, then 18 mg if needed", false, "Start at 6 mg; the second dose is 12 mg.", "What's the first adenosine dose?", "A larger dose than needed: a longer pause and more side effects."],
        ["Adenosine 6 mg rapid push, repeated at 6 mg twice more if needed", false, "The second dose is 12 mg, not another 6 mg.", "What's the second adenosine dose?", "A repeat dose too small to work."]
      ]),
      Q(P("svt", true, "78/44", false), "Adenosine 6 mg and then 12 mg: brief slowing, then back to 196. Now she's pale and confused, BP 78/44.", "What now?", [
        ["She's now unstable: synchronized cardioversion, with sedation if time allows", true, "Tachycardia with hypotension and altered mental status is unstable: synchronized cardioversion. Sedate if it won't delay treatment."],
        ["Diltiazem 0.25 mg/kg IV to slow the rate", false, "Calcium channel blockers lower the blood pressure further, and she's now unstable.", "What does diltiazem do to a pressure of 78/44?", "Worse hypotension."],
        ["Synchronized cardioversion, but only once a sedation drip is running", false, "Sedate if it won't delay treatment. She's unstable now.", "Can this wait for a drip?", "A delay while she deteriorates."],
        ["Unsynchronized defibrillation at 200 J because she's unstable", false, "There's a pulse and an organized rhythm: synchronize.", "Why synchronize?", "The shock lands on the T wave: VF."]
      ]),
      D(P("svt", true, "78/44", false), "Sedation given. Pads on.", "Synchronized cardioversion for a narrow, regular tachycardia: SYNC on, start at 50–100 J.",
        { kind: "sync", lo: 50, hi: 100 }, "Press SYNC (markers appear on each QRS), set 50–100 J with ENERGY SELECT ▼, press CHARGE, then hold SHOCK: it fires on the next QRS."),
      Q(P("nsr", true, "112/70", false, true), "Converted to sinus rhythm at 92, BP 112/70.", "What next?", [
        ["Get a 12-lead ECG, keep monitoring and consult for expert follow-up", true, "After conversion, record a 12-lead (look for pre-excitation), monitor for recurrence, and arrange follow-up."],
        ["Release her on scene: she converted and her vital signs are normal", false, "Recurrence is common and the cause needs evaluation.", "Could this happen again?", "A missed diagnosis such as WPW."],
        ["Start amiodarone 150 mg over 10 minutes to prevent a recurrence", false, "Antiarrhythmic prophylaxis isn't routine after SVT converts. Consult first.", "Is a routine antiarrhythmic needed after SVT converts?", "Hypotension and bradycardia with no clear need."],
        ["Remove the pads and keep the 4-lead monitor on", false, "Leave the pads on after a cardioversion in case it recurs or she deteriorates.", "What if it recurs on the way?", "A delayed response if it recurs."]
      ])
    ] },
    { id: "vt1", cat: "vt", title: "Wide complex with a pulse", text: "A 63-year-old with chest pain and palpitations.", steps: [
      Q(P("vt", true, "76/40", false), "Wide, regular tachycardia at 168. BP 76/40, diaphoretic with chest pain.", "Stable or unstable, and what's the treatment?", [
        ["Unstable VT with a pulse: synchronized cardioversion, sedating if time allows", true, "Monomorphic VT with a pulse plus hypotension and chest pain is unstable: synchronized cardioversion, starting around 100 J."],
        ["Stable VT: amiodarone 150 mg over 10 minutes", false, "Hypotension, chest pain and diaphoresis make this unstable.", "Which signs make a tachycardia unstable?", "Ten minutes of infusion while perfusion falls."],
        ["Unstable VT: unsynchronized defibrillation at 200 J", false, "There's a pulse: synchronize so the shock avoids the T wave. Unsynchronized is for pulseless or polymorphic VT.", "Does this patient have a pulse?", "The shock lands on the T wave: VF."],
        ["Unstable: adenosine 6 mg first to tell SVT with aberrancy from VT", false, "Adenosine is considered only for stable, regular, monomorphic wide-complex tachycardia.", "Is this patient stable enough for a diagnostic trial?", "A delay while he's unstable."]
      ]),
      D(P("vt", true, "76/40", false), "Sedation given. Pads on.", "Synchronized cardioversion for monomorphic VT with a pulse: SYNC on, about 100 J (escalate if needed).",
        { kind: "sync", lo: 100, hi: 200 }, "Press SYNC, set about 100 J with ENERGY SELECT, CHARGE, then SHOCK: it fires on the next QRS."),
      Q(P("nsr", true, "104/66", false, true), "Converted to sinus rhythm, BP 104/66.", "What now?", [
        ["Amiodarone 150 mg IV over 10 minutes to help prevent recurrence, a 12-lead ECG and expert consultation", true, "After conversion consider an antiarrhythmic infusion (amiodarone 150 mg over 10 minutes), get a 12-lead and consult."],
        ["Amiodarone 300 mg IV push to prevent recurrence", false, "300 mg push is the arrest dose.", "Is the patient pulseless?", "Hypotension and bradycardia."],
        ["Lidocaine 1–1.5 mg/kg and amiodarone 150 mg together", false, "Use one antiarrhythmic. Combining them adds risk without proven benefit.", "How many antiarrhythmics at once?", "Hypotension, bradycardia and toxicity."],
        ["No antiarrhythmic: VT that converts with a shock won't come back", false, "VT often recurs, and the cause (often ischemia) needs workup.", "Could the VT come back?", "Recurrent VT."]
      ])
    ] },
    { id: "af1", cat: "af", title: "Irregular and hypotensive", text: "A 76-year-old with shortness of breath and chest pressure.", steps: [
      Q(P("af", true, "80/48", false), "Irregularly irregular narrow tachycardia at about 158, no P waves. BP 80/48, short of breath.", "What is it, and what's the treatment?", [
        ["Atrial fibrillation with rapid ventricular response, unstable: synchronized cardioversion (sedate if time allows)", true, "Unstable AF: synchronized cardioversion. Narrow irregular rhythms start at 120–200 J biphasic per device and protocol."],
        ["Unstable atrial fibrillation: diltiazem 0.25 mg/kg IV to control the rate first", false, "Rate control is for stable patients; diltiazem lowers the BP further.", "Is she stable?", "Worse hypotension."],
        ["Unstable atrial fibrillation: synchronized cardioversion at 50 J", false, "50–100 J is the starting energy for regular narrow rhythms like SVT and flutter. AF starts at 120–200 J biphasic.", "What's the starting energy for AF?", "Too little energy: no conversion, and another shock is needed."],
        ["Unstable atrial fibrillation: unsynchronized shock, because SYNC can't track an irregular rhythm", false, "SYNC times the shock to each QRS, regular or not. With a pulse, always synchronize.", "Does SYNC need a regular rhythm?", "The shock lands on the T wave: VF."]
      ]),
      D(P("af", true, "80/48", false), "Sedation given. Pads on.", "Synchronized cardioversion for atrial fibrillation: SYNC on, 120–200 J biphasic (per your device and protocol).",
        { kind: "sync", lo: 120, hi: 200 }, "Press SYNC, set 120–200 J with ENERGY SELECT, CHARGE, then SHOCK."),
      Q(P("nsr", true, "110/70", false, true), "Converted to sinus rhythm, BP 110/70.", "What should be addressed afterwards?", [
        ["Stroke risk and anticoagulation, plus a 12-lead and the underlying cause", true, "After cardioversion of AF, address stroke risk/anticoagulation and look for the cause."],
        ["Nothing more: converting AF removes the stroke risk", false, "Stroke risk continues for weeks after cardioversion.", "What's the risk after converting AF?", "Missed stroke prevention."],
        ["An IV beta blocker now to keep her in sinus rhythm", false, "Her pressure was 80 systolic minutes ago. Consult before any rate or rhythm drug; anticoagulation is the key issue.", "What was her blood pressure a few minutes ago?", "Hypotension, and stroke risk still isn't addressed."],
        ["Repeat the synchronized shock to make sure it holds", false, "She has converted: no further shocks.", "Is there anything to shock?", "An unnecessary shock."]
      ])
    ] },
    { id: "post1", cat: "post", title: "After the pulse comes back", text: "ROSC after 14 minutes of VF arrest. Now what?", steps: postCare(true) },

    /* megacodes: pre-arrest → arrest → post-arrest, at least three rhythms */
    { id: "mega1", cat: "mega", title: "Chest pain to VF", text: "A 59-year-old with crushing chest pain. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("vt", true, "78/44", false), "Wide regular tachycardia at 168, BP 78/44, diaphoretic.", "Stable or unstable, and what do you do?", [
        ["Unstable VT with a pulse: synchronized cardioversion (sedate if time allows)", true, "Unstable monomorphic VT with a pulse: synchronized cardioversion, starting around 100 J."],
        ["Stable VT: amiodarone 150 mg over 10 minutes and a 12-lead", false, "He's hypotensive and diaphoretic: unstable.", "Which signs make this unstable?", "Ten minutes of falling perfusion."],
        ["Unstable VT: unsynchronized shock at 200 J", false, "There's a pulse: synchronize.", "Is there a pulse?", "The shock lands on the T wave: VF."],
        ["Procainamide 20–50 mg/min until the QRS widens by 50%", false, "Procainamide is for stable wide-complex tachycardia, and it can drop the pressure.", "Is this patient stable?", "A slow infusion while he's unstable."]
      ]),
      D(P("vt", true, "78/44", false), "Pads on, sedation given.", "Synchronized cardioversion: SYNC on, about 100 J.", { kind: "sync", lo: 100, hi: 200, noConvert: true },
        "Press SYNC, set about 100 J, CHARGE, then SHOCK."),
      identifyShockable(P("vf", false, null, false), "Ventricular fibrillation", "He became pulseless right after the cardioversion and CPR was started."),
      shock(P("vf", false, null, false), 1), afterShock(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 2), epiShockable(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 3), antiarrhythmic(P("vf", false, null, true)), rosc(P("nsr", false, null, true)),
      postCare(true)) },
    { id: "mega2", cat: "mega", title: "Slow, then pulseless", text: "A 70-year-old with dizziness and a slow pulse. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("chb", true, "70/40", false), "Heart rate 34, BP 70/40, confused. The monitor shows this rhythm.", "What is it, and what's the first treatment?", [
        ["Unstable third-degree AV block: transcutaneous pacing now, with analgesia as the pressure allows", true, "Unstable complete heart block: pace. " + NO_ATRO],
        ["Unstable third-degree AV block: atropine 1 mg IV and prepare to pace", false, NO_ATRO, "Can atropine get impulses through a third-degree block?", "No change in rate while the pressure keeps falling."],
        ["Unstable third-degree AV block: dopamine 1–2 mcg/kg/min while the pads go on", false, "If an infusion is used, dopamine for bradycardia is 5–20 mcg/kg/min, and pacing comes first here.", "What's the bradycardia dose of dopamine?", "Too little to raise the rate."],
        ["Unstable second-degree AV block type I (Wenckebach): observe, it's usually transient", false, "The PR isn't lengthening before a drop: the P waves have no relationship to the QRS. That's complete heart block, and he's unstable.", "Is the PR interval changing, or are P waves and QRS complexes independent?", "Deterioration."]
      ]),
      D(P("chb", true, "70/40", false), "Pads on. Analgesia given.", "Pace at 60–80 ppm and raise the current to capture.", { kind: "pace", rate: [60, 80] },
        "Press PACER, set RATE 60–80, raise CURRENT until each spike is followed by a wide QRS."),
      Q(P("pea", false, null, false), "While pacing, he becomes unresponsive. The pacer is off for the check: an organized rhythm at 64, but no femoral pulse.", "What now?", [
        ["PEA: start CPR, epinephrine 1 mg as soon as possible, and look for the cause", true, "Organized rhythm without a pulse is PEA: CPR, early epinephrine, Hs and Ts. Pacing isn't used in PEA."],
        ["Loss of capture: turn the pacer back on, raise the current and recheck the pulse", false, "There's no pulse: this is cardiac arrest. Start CPR.", "Is there a pulse?", ARREST_RESULT],
        ["PEA: start CPR and keep pacing to support the rate", false, "Pacing isn't used in PEA.", "Does pacing help in PEA?", "Time and attention lost; no benefit."],
        ["PEA: start CPR and give epinephrine after the second rhythm check", false, "In PEA, give epinephrine as soon as possible.", "When does epinephrine go in for PEA?", "A delayed vasopressor."]
      ]),
      Q(P("pea", false, null, true), "His wife says he takes potassium supplements and missed dialysis this week.", "Most likely reversible cause and treatment?", [
        ["Hyperkalemia: calcium chloride 1 g IV and sodium bicarbonate, continue CPR and epinephrine", true, "Treat suspected hyperkalemia with calcium (and bicarbonate) during the arrest."],
        ["Hyperkalemia: insulin 10 units IV with D50, continue CPR", false, "Insulin shifts potassium too slowly for an arrest. Calcium works immediately.", "What works fastest in a hyperkalemic arrest?", "Too slow to help the arrest."],
        ["Hyperkalemia: give calcium once there's ROSC", false, "Give calcium during the arrest. It's part of getting ROSC.", "When should calcium go in?", "ROSC is less likely."],
        ["Hypovolemia from missed dialysis: 2 L of normal saline", false, "Missed dialysis causes fluid overload and high potassium, not hypovolemia.", "Does missed dialysis make a patient dry or overloaded?", "Fluid overload, and the potassium goes untreated."]
      ]),
      rosc(P("nsr", false, null, true)), postCare(false)) },
    { id: "mega3", cat: "mega", title: "Racing heart to flat line", text: "A 68-year-old with palpitations and shortness of breath. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("af", true, "82/50", false), "Irregular narrow tachycardia at 160, no P waves, BP 82/50.", "What do you do?", [
        ["Unstable atrial fibrillation: synchronized cardioversion (sedate if time allows)", true, "Unstable AF with RVR: synchronized cardioversion at 120–200 J biphasic per device and protocol."],
        ["Unstable atrial fibrillation: diltiazem 0.25 mg/kg IV for rate control", false, "Hypotension makes rate control risky; she's unstable.", "Is she stable?", "Worse hypotension."],
        ["Unstable atrial fibrillation: synchronized cardioversion at 50 J", false, "50–100 J is for SVT and flutter. AF starts at 120–200 J biphasic.", "What's the starting energy for AF?", "Too little energy: no conversion."],
        ["Unstable atrial fibrillation: amiodarone 150 mg over 10 minutes to convert it", false, "She's unstable: convert electrically now.", "Is she stable enough for a drug that takes 10 minutes?", "Ten minutes of falling perfusion."]
      ]),
      D(P("af", true, "82/50", false), "Sedation given.", "Synchronized cardioversion: SYNC on, 120–200 J.", { kind: "sync", lo: 120, hi: 200, noConvert: true }, "Press SYNC, set 120–200 J, CHARGE, then SHOCK."),
      identifyShockable(P("vf", false, null, false), "Ventricular fibrillation", "She arrested a minute later and CPR was started."),
      shock(P("vf", false, null, false), 1), afterShock(P("vf", false, null, true)),
      Q(P("asys", false, null, false), "At the next rhythm check the monitor shows a flat line.", "What now?", [
        ["Confirm asystole in a second lead, continue CPR, epinephrine 1 mg as soon as possible, no shock", true, "The rhythm is now non-shockable: switch to the asystole/PEA pathway."],
        ["Fine VF is likely after a shock: shock again at 200 J", false, "Confirm in a second lead and with more gain. Don't shock a flat line.", "How do you rule out fine VF without shocking?", "No effect; CPR interrupted."],
        ["Asystole: transcutaneous pacing at 70 ppm with maximum output", false, "Pacing doesn't help asystolic arrest.", "Does pacing work in asystole?", "No capture."],
        ["Stay on the VF pathway: amiodarone 300 mg at this cycle", false, "Antiarrhythmics are for shockable rhythms.", "Is this rhythm shockable now?", "No effect."]
      ]),
      airway(P("asys", false, null, true)), rosc(P("nsr", false, null, true)), postCare(false)) }
  ];
  var CATS = [["vf", "VF / pulseless VT", "Shockable cardiac arrest"], ["pea", "Asystole / PEA", "Non-shockable cardiac arrest"], ["brady", "Bradycardia", "Symptomatic bradycardia with a pulse"],
    ["svt", "SVT", "Narrow, regular tachycardia"], ["vt", "VT with a pulse", "Wide-complex tachycardia"], ["af", "Atrial fibrillation", "Irregular tachycardia"],
    ["post", "Post-arrest care", "After ROSC"], ["mega", "Megacode", "Pre-arrest → arrest → post-arrest, three or more rhythms"]];

  /* ------------------------------------------------------------------ levels: how much prompting */
  var LEVELS = [
    ["beg", "Beginner", "Coaching on every step. Device steps show how to do them, and a choice that isn't the best gets “Do you really want to do that?” with a hint."],
    ["int", "Intermediate", "“Are you sure?” on a choice that isn't the best, with no hint. Device coaching only after a mistake."],
    ["pro", "“I Got This”", "No prompts and no coaching. Every choice plays out on the patient, and it's all reviewed in the feedback at the end."]
  ];
  var LKEY = "cardiac-lab-codelvl", LVL = null;
  try { LVL = localStorage.getItem(LKEY); } catch (e) {}
  if (!LEVELS.some(function (l) { return l[0] === LVL; })) LVL = null;
  function lvlName(k) { var l = LEVELS.filter(function (x) { return x[0] === k; })[0]; return l ? l[1] : ""; }
  function setLvl(k) { LVL = k; try { localStorage.setItem(LKEY, k); } catch (e) {} }

  /* ------------------------------------------------------------------ action bar: CPR, airway, access, drugs
     Each press is judged against the patient right now (the current step's state) and what has happened so far.
     Beginner: a poorly timed action asks "Do you really want to do that?" with a hint. Intermediate: "Are you sure?".
     "I Got This": it's done, it plays out, and it's reviewed at the end. */
  var ACTS = [
    ["cpr", "Start CPR", "cpr"], ["tube", "Intubate", "air"], ["iv", "IV / IO access", "air"],
    ["epi", "Epi 1 mg IV/IO", "drug"], ["amio300", "Amiodarone 300 mg IVP", "drug"], ["amio150", "Amiodarone 150 mg IVP", "drug"],
    ["lido", "Lidocaine 1.5 mg/kg IVP", "drug"], ["epidrip", "Epi drip 2–10 mcg/min", "drip"], ["dopa", "Dopamine drip 5–20 mcg/kg/min", "drip"]
  ];
  var ACT_NAME = { cpr: "CPR", tube: "Intubation", iv: "IV/IO access", epi: "Epinephrine 1 mg IV/IO", amio300: "Amiodarone 300 mg IV push", amio150: "Amiodarone 150 mg IV",
    lido: "Lidocaine 1.5 mg/kg IV push", epidrip: "Epinephrine infusion 2–10 mcg/min", dopa: "Dopamine infusion 5–20 mcg/kg/min" };
  function actsHTML() {
    return '<div class="cl-acts" id="clActs"><div class="cl-actmsg" id="clActMsg" aria-live="polite"></div><div class="cl-actrow">' +
      ACTS.map(function (a) { return '<button type="button" class="cl-act ' + a[2] + '" data-act="' + a[0] + '">' + H(a[1]) + '</button>'; }).join("") + '</div></div>';
  }
  function sysBP(p) { var m = /^(\d+)/.exec(p.bp || ""); return m ? +m[1] : null; }
  function stepText(i) { var s = cur.c.steps[i]; return (s.say || "") + " " + (s.q || "") + " " + (s.task || ""); }
  function scriptSays(re) { for (var i = 0; i <= cur.i; i++) if (re.test(stepText(i))) return true; return false; }
  function hasAccess() { return cur.hx.iv || scriptSays(/\b(IV|IO)\b[^.]*\b(in|placed|access)\b/); }
  function hasTube() { return cur.hx.tube || scriptSays(/advanced airway in place|airway in place/i); }
  function shockableNow(p) { var r = p.rhythm.r; return !p.pulse && (r === "vf" || r === "vt"); }
  function since(k) { var a = cur.hx[k]; return a.length ? cur.i - a[a.length - 1] : 99; }
  function slowRhythm(p) { var r = p.rhythm.r; return r === "chb" || r === "b21" || (r === "sinus" && (p.rhythm.rate || 80) < 60); }

  // [ok, why (feedback), prompt (beginner hint), what happens (if done anyway)]
  function judge(k) {
    var s = cur.c.steps[cur.i], p = s.p, st = dev.state(), arrest = !p.pulse, sbp = sysBP(p);
    switch (k) {
      case "cpr":
        if (st.cpr) return arrest && !s.rosc ? [true, "Compressions paused. Keep pauses under 10 seconds: rhythm check, pulse check or shock, then straight back on the chest."] : [true, "CPR stopped."];
        if (!arrest) return [false, "There's a pulse. Compressions are for a patient without one.", "Does this patient have a pulse?", "Compressions on a beating heart: rib injuries and a falling blood pressure."];
        return [true, "Compressions started: 100–120/min, at least 2 in (5 cm), full recoil, minimal pauses."];
      case "tube":
        if (hasTube()) return [false, "The patient already has an advanced airway.", "Is there already a tube in?", "A second attempt interrupts care for no benefit."];
        if (arrest) return [true, "Advanced airway placed with minimal interruption to compressions. Confirm it with waveform capnography, then 1 breath every 6 seconds with continuous compressions."];
        if (p.good) return [true, "Airway secured for an unresponsive patient after ROSC. Confirm with waveform capnography and ventilate about 10/min."];
        return [false, "This patient is awake with a pulse and protecting their airway. Intubation isn't indicated now.", "Is this patient unresponsive, or protecting their own airway?", "An awake patient fights the tube; the procedure delays the treatment they actually need."];
      case "iv":
        if (hasAccess()) return [false, "IV/IO access is already in place.", "Is access already in?", "A second line delays the next step."];
        return [true, arrest ? "Vascular access (IV or IO) placed without stopping compressions." : "IV access established."];
      case "epi":
        if (!hasAccess()) return [false, "There's no IV/IO access yet.", "How will the drug get in?", "Nothing is given: there's no line."];
        if (!arrest) return [false, "Epinephrine 1 mg IV push is the cardiac arrest dose. This patient has a pulse.", "Is the patient pulseless?", "A bolus of epinephrine into a beating heart: severe hypertension, tachycardia and ventricular ectopy."];
        if (s.rosc) return [false, "An abrupt rise in ETCO₂ to over 40 mmHg suggests ROSC. Check for a pulse before more epinephrine.", "What does a sudden ETCO₂ jump usually mean?", "Epinephrine given into a returning circulation: hypertension and arrhythmias."];
        if (shockableNow(p) && cur.hx.shocks < 2) return [false, "In VF/pulseless VT, epinephrine is given after the second shock.", "How many shocks have been delivered so far?", "The drug goes in before the shocks that matter most."];
        if (since("epi") < 2) return [false, "Epinephrine is repeated every 3–5 minutes (about every other 2-minute cycle).", "When was the last dose?", "Doses stacked too close together: more myocardial oxygen demand, no added benefit."];
        return [true, shockableNow(p) ? "Epinephrine 1 mg after the second shock, then every 3–5 minutes." : "Epinephrine 1 mg as soon as possible in a non-shockable arrest, then every 3–5 minutes."];
      case "amio300":
        if (!hasAccess()) return [false, "There's no IV/IO access yet.", "How will the drug get in?", "Nothing is given: there's no line."];
        if (!arrest) return [false, "300 mg IV push is the cardiac arrest dose. With a pulse, amiodarone is 150 mg over 10 minutes.", "Is the patient pulseless?", "Hypotension and bradycardia from a large, rapid dose."];
        if (!shockableNow(p)) return [false, "Antiarrhythmics are for shockable rhythms (VF/pulseless VT), not asystole or PEA.", "Is this rhythm shockable?", "No benefit in a non-shockable arrest."];
        if (cur.hx.amio300.length) return [false, "The first dose has been given. The second amiodarone dose is 150 mg.", "What's the second dose?", "Excess amiodarone: hypotension and bradycardia after ROSC."];
        if (cur.hx.lido.length) return [false, "Lidocaine has already been given. Use one antiarrhythmic.", "Which antiarrhythmic is on board?", "Two antiarrhythmics together add toxicity without proven benefit."];
        if (cur.hx.shocks < 3) return [false, "Amiodarone is for shock-refractory VF/pVT: after the third shock.", "How many shocks have been delivered?", "An antiarrhythmic ahead of the shocks and the vasopressor."];
        return [true, "Amiodarone 300 mg IV/IO push for shock-refractory VF/pVT."];
      case "amio150":
        if (!hasAccess()) return [false, "There's no IV/IO access yet.", "How will the drug get in?", "Nothing is given: there's no line."];
        if (arrest) {
          if (!shockableNow(p)) return [false, "Antiarrhythmics are for shockable rhythms.", "Is this rhythm shockable?", "No benefit in a non-shockable arrest."];
          if (!cur.hx.amio300.length) return [false, "The first amiodarone dose in cardiac arrest is 300 mg. 150 mg is the second dose.", "What's the first dose in arrest?", "Too little drug for shock-refractory VF."];
          if (cur.hx.amio150.length) return [false, "Both amiodarone doses have been given.", "How much amiodarone is already in?", "Excess amiodarone: hypotension and bradycardia."];
          if (since("amio300") < 2) return [false, "Give the second dose after another shock and CPR cycle, not right after the first.", "When was the 300 mg given?", "Doses too close together."];
          return [true, "Amiodarone 150 mg IV/IO: the second dose for shock-refractory VF/pVT."];
        }
        if (p.rhythm.r === "vt" || (p.good && scriptSays(/wide, regular tachycardia|Wide regular tachycardia/i))) {
          if (p.rhythm.r === "vt" && sbp != null && sbp < 90) return [false, "This VT is unstable. Synchronized cardioversion comes first; a 10-minute infusion is too slow.", "Is this patient stable?", "Ten minutes of falling perfusion."];
          return [true, "Amiodarone 150 mg for VT with a pulse, given over 10 minutes (not as a rapid push)."];
        }
        return [false, "Amiodarone 150 mg is for VT with a pulse (over 10 minutes) or the second arrest dose. It isn't indicated for this rhythm.", "What rhythm is this?", "Hypotension and bradycardia without an indication."];
      case "lido":
        if (!hasAccess()) return [false, "There's no IV/IO access yet.", "How will the drug get in?", "Nothing is given: there's no line."];
        if (!arrest) return [false, "Lidocaine here is for shock-refractory VF/pulseless VT.", "Is the patient pulseless?", "CNS toxicity and myocardial depression without an indication."];
        if (!shockableNow(p)) return [false, "Antiarrhythmics are for shockable rhythms.", "Is this rhythm shockable?", "No benefit in a non-shockable arrest."];
        if (cur.hx.amio300.length || cur.hx.amio150.length) return [false, "Amiodarone has already been given. Use one antiarrhythmic.", "Which antiarrhythmic is on board?", "Two antiarrhythmics together add toxicity without proven benefit."];
        if (cur.hx.lido.length) return [false, "Repeat lidocaine is 0.5–0.75 mg/kg, not another 1.5 mg/kg.", "What's the repeat lidocaine dose?", "Lidocaine toxicity: seizures and myocardial depression."];
        if (cur.hx.shocks < 3) return [false, "Lidocaine is for shock-refractory VF/pVT: after the third shock.", "How many shocks have been delivered?", "An antiarrhythmic ahead of the shocks and the vasopressor."];
        return [true, "Lidocaine 1–1.5 mg/kg IV/IO push for shock-refractory VF/pVT (an alternative to amiodarone)."];
      case "epidrip": case "dopa":
        var nm = k === "dopa" ? "dopamine" : "epinephrine";
        if (cur.hx.epidrip.length || cur.hx.dopa.length) return [false, "A vasopressor/chronotropic infusion is already running. Titrate it rather than adding another.", "Is an infusion already running?", "Two infusions without a reason: tachyarrhythmias."];
        if (!hasAccess()) return [false, "There's no IV/IO access yet.", "How will the drug get in?", "Nothing is given: there's no line."];
        if (arrest) return [false, "There's no pulse. In cardiac arrest, epinephrine is given as 1 mg IV/IO push every 3–5 minutes, not as an infusion.", "Does this patient have a pulse?", "An infusion does nothing for a heart that isn't beating; CPR and the push dose are what count."];
        if (slowRhythm(p) && sbp != null && sbp < 90) return [true, "An " + nm + " infusion is an option for unstable bradycardia, alongside or instead of transcutaneous pacing. Get expert help for transvenous pacing."];
        if (p.good && sbp != null && sbp < 90) return [true, "Post-arrest hypotension: a vasopressor infusion to keep SBP at least 90 and MAP at least 65 (fluids too). Norepinephrine or epinephrine are common choices."];
        if (p.rhythm.r === "svt" || p.rhythm.r === "af" || p.rhythm.r === "flutter" || p.rhythm.r === "vt") return [false, "This patient is tachycardic. A chronotropic infusion makes the rate faster.", "Is the heart rate too slow or too fast?", "Faster rate, more ischemia, lower pressure."];
        return [false, "The blood pressure is adequate. An infusion isn't indicated right now.", "What's the blood pressure?", "Hypertension and tachyarrhythmias."];
    }
    return [true, ""];
  }
  function doAct(k, verdict) {
    var s = cur.c.steps[cur.i];
    if (k === "cpr") { var on = !dev.state().cpr; dev.cpr(on); }
    else if (k === "tube") cur.hx.tube = true;
    else if (k === "iv") cur.hx.iv = true;
    else if (cur.hx[k]) cur.hx[k].push(cur.i);
    var label = k === "cpr" ? (dev.state().cpr ? "Started CPR" : "Stopped CPR") : ACT_NAME[k];
    cur.log.push({ i: cur.i, t: label, ok: verdict[0], why: verdict[1] });
    if (!verdict[0]) { (cur.errs[cur.i] = cur.errs[cur.i] || []).push(label + ": " + verdict[1]); cur.bad[cur.i] = 1; }
    actMsg(verdict[0] ? (cur.lvl === "pro" ? "✓ " + label + "." : "✓ " + label + ". " + verdict[1]) : (cur.lvl === "pro" ? "What happens: " + verdict[3] : "✗ " + label + ". " + verdict[1]), verdict[0] ? "ok" : (cur.lvl === "pro" ? "play" : "bad"));
    updActs();
    if (s.t === "d" && s.goal.kind === "pace") checkPace();
  }
  function act(k) {
    if (!cur || !dev) return;
    var v = judge(k);
    if (k === "iv" && !v[0] || k === "tube" && hasTube()) { actMsg(v[1], "info"); return; }
    if (v[0] || cur.lvl === "pro") { doAct(k, v); return; }
    var beg = cur.lvl === "beg", name = k === "cpr" ? "Start CPR" : ACT_NAME[k];
    var box = root.querySelector("#clActMsg");
    box.className = "cl-actmsg ask";
    box.innerHTML = '<b>' + (beg ? 'Do you really want to do that?' : 'Are you sure?') + '</b> <span>' + H(name) + (beg ? ': ' + H(v[2]) : '') + '</span>' +
      ' <button type="button" class="btn btn-ghost" id="clActNo">' + (beg ? 'Rethink' : 'Cancel') + '</button><button type="button" class="btn btn-ghost" id="clActYes">Yes, do it</button>';
    box.querySelector("#clActNo").onclick = function () { actMsg("", ""); };
    box.querySelector("#clActYes").onclick = function () { doAct(k, v); };
  }
  function actMsg(t, cls) { var m = root.querySelector("#clActMsg"); if (!m) return; m.className = "cl-actmsg" + (cls ? " " + cls : ""); m.textContent = t; }
  function updActs() {
    var bar = root.querySelector("#clActs"); if (!bar || !dev) return;
    var st = dev.state(), c = bar.querySelector('[data-act="cpr"]');
    c.textContent = st.cpr ? "Stop CPR" : "Start CPR"; c.classList.toggle("on", !!st.cpr);
    bar.querySelector('[data-act="iv"]').classList.toggle("done", !!hasAccess());
    bar.querySelector('[data-act="tube"]').classList.toggle("done", !!hasTube());
    ["epidrip", "dopa"].forEach(function (k) { bar.querySelector('[data-act="' + k + '"]').classList.toggle("on", cur.hx[k].length > 0); });
  }
  function bindActs() {
    root.querySelectorAll(".cl-act").forEach(function (b) { b.onclick = function () { act(b.getAttribute("data-act")); }; });
  }

  // a shock during a question step: judged against the patient right now
  function shockOnQuestion(type, d) {
    var s = cur.c.steps[cur.i], p = s.p, r = p.rhythm.r, sbp = sysBP(p), v;
    if (type === "nosync") { v = [false, "SYNC is on, so the device won't fire on VF/pulseless VT: there's no QRS to sync to.", "", "The device waits and no shock is delivered."]; }
    else if (shockableNow(p)) v = d.sync ? [false, "VF/pulseless VT needs an unsynchronized shock.", "", "No conversion."] : (d.J < 120 ? [false, d.J + " J is below the adult defibrillation dose.", "", "Still VF."] : [true, "Defibrillation for a shockable rhythm."]);
    else if (!p.pulse) v = [false, (r === "asystole" ? "Asystole" : "PEA") + " isn't shockable. CPR and epinephrine.", "", "Compressions are interrupted for a shock that can't help."];
    else if ((r === "vt" || r === "svt" || r === "af" || r === "flutter") && sbp != null && sbp < 90) v = d.sync ? [true, "Synchronized cardioversion for an unstable tachycardia with a pulse."] : [false, "With a pulse, the shock must be synchronized.", "", "The shock lands on the T wave: VF."];
    else v = [false, "This patient has a pulse and doesn't need a shock" + (r === "chb" || r === "b21" || r === "sinus" ? "." : " now: they're stable."), "", "The shock lands on a perfusing rhythm and can cause VF."];
    if (v[0] && !d.sync) cur.hx.shocks++;
    var label = type === "nosync" ? "Pressed SHOCK with SYNC on" : (d.sync ? "Synchronized shock at " + d.J + " J" : "Unsynchronized shock at " + d.J + " J");
    cur.log.push({ i: cur.i, t: label, ok: v[0], why: v[1] });
    if (!v[0]) { (cur.errs[cur.i] = cur.errs[cur.i] || []).push(label + ": " + v[1]); cur.bad[cur.i] = 1; }
    actMsg(v[0] ? "✓ " + label + "." + (cur.lvl === "pro" ? "" : " " + v[1]) : (cur.lvl === "pro" ? "What happens: " + v[3] : "✗ " + label + ". " + v[1]), v[0] ? "ok" : (cur.lvl === "pro" ? "play" : "bad"));
    if (type !== "nosync") setTimeout(function () { if (cur && cur.c.steps[cur.i] === s && dev) { dev.patient(s.p); dev.reset(); updActs(); } }, 3500);
  }

  /* ------------------------------------------------------------------ screens */
  function listHTML() {
    var done = CASES.filter(function (c) { var r = HOST.load(c.id); return r && r.ok; }).length;
    return '<div class="qhead"><div><div class="eyebrow">Monitor · defibrillator · decisions</div><h2>Code lab</h2></div><div class="qstats"><span>Passed <b class="num">' + done + '</b> of ' + CASES.length + '</span></div></div>' +
      '<section class="cl-lvl" aria-labelledby="clLvlH"><h3 id="clLvlH">1. Choose your level</h3><div class="cl-lvl-opts" role="radiogroup" aria-labelledby="clLvlH">' +
      LEVELS.map(function (l) { return '<button type="button" class="cl-lvl-o' + (LVL === l[0] ? ' on' : '') + '" role="radio" aria-checked="' + (LVL === l[0]) + '" data-lvl="' + l[0] + '"><b>' + H(l[1]) + '</b><span>' + H(l[2]) + '</span></button>'; }).join("") +
      '</div><p class="cl-lvl-note" id="clLvlNote"' + (LVL ? ' hidden' : '') + '>Pick a level to unlock the cases.</p></section>' +
      '<p class="sv-lede"><b>2. Pick a case.</b> Run a code on the live monitor. Practice one algorithm, or run a <b>Megacode</b> from pre-arrest through the arrest to post-arrest care.</p>' +
      CATS.map(function (c) {
        var list = CASES.filter(function (x) { return x.cat === c[0]; });
        return '<section class="cl-cat' + (c[0] === "mega" ? ' mega' : '') + '"><div class="cl-cat-h"><h3>' + H(c[1]) + '</h3><span>' + H(c[2]) + '</span></div><div class="cases">' + list.map(function (x) {
          var r = HOST.load(x.id), badge = r ? '<span class="pill ' + (r.ok ? 'done' : 'part') + '">' + (r.ok ? 'Passed' : 'Review') + ' · ' + r.pct + '%' + (r.lvl ? ' · ' + H(lvlName(r.lvl)) : '') + '</span>' : '<span class="pill">Not started</span>';
          return '<button class="case cl-case" data-case="' + x.id + '"' + (LVL ? '' : ' aria-disabled="true"') + '><span class="no">' + H(c[1]) + '</span><h3>' + H(x.title) + '</h3><span class="focus">' + H(x.text) + '</span><span class="st"><span>' + x.steps.length + ' steps</span>' + badge + '</span></button>';
        }).join("") + '</div></section>';
      }).join("");
  }
  function list() {
    stopDevice(); root.innerHTML = listHTML();
    root.querySelectorAll(".cl-lvl-o").forEach(function (b) { b.onclick = function () {
      setLvl(b.getAttribute("data-lvl"));
      root.querySelectorAll(".cl-lvl-o").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
      root.querySelector("#clLvlNote").hidden = true;
      root.querySelectorAll(".cl-case").forEach(function (x) { x.removeAttribute("aria-disabled"); });
    }; });
    root.querySelectorAll(".cl-case").forEach(function (b) { b.onclick = function () {
      if (!LVL) { var n = root.querySelector("#clLvlNote"); n.hidden = false; n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); root.querySelector(".cl-lvl").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      start(b.getAttribute("data-case")); window.scrollTo(0, 0);
    }; });
  }
  function stopDevice() { clearInterval(timer); if (dev) { dev.stop(); dev = null; } unfull(); }
  // A running case fills the screen; the Exit button (or the browser's own Esc) brings the page back.
  function full() {
    document.body.classList.add("cl-full");
    var d = document.documentElement;
    try { if (d.requestFullscreen && !document.fullscreenElement) d.requestFullscreen().catch(function () {}); } catch (e) {}
  }
  function unfull() {
    document.body.classList.remove("cl-full");
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) {}
  }
  function exitCase() {
    var mid = cur && cur.marks.some(function (m) { return m != null; });
    if (mid && !window.confirm("Exit this case? Your progress on it won't be saved.")) return;
    list(); window.scrollTo(0, 0);
  }
  function refit() { var b = root && root.querySelector("#clActs"); if (dev && dev.fit) dev.fit(b && window.innerWidth > 1000 ? b.getBoundingClientRect().height + 10 : 0); }
  var rsT; window.addEventListener("resize", function () { clearTimeout(rsT); rsT = setTimeout(refit, 150); });
  document.addEventListener("fullscreenchange", function () { setTimeout(refit, 120); });

  function start(id) {
    var c = CASES.filter(function (x) { return x.id === id; })[0];
    cur = { c: c, i: 0, marks: [], tries: 0, struck: {}, phase: "ask", lvl: LVL || "beg", picks: {}, errs: {}, bad: {}, log: [],
      hx: { iv: false, tube: false, shocks: 0, epi: [], amio300: [], amio150: [], lido: [], epidrip: [], dopa: [] } };
    root.innerHTML = '<div class="cl-run full"><div class="runner-head"><div><div class="eyebrow">' + H(CATS.filter(function (k) { return k[0] === c.cat; })[0][1]) + ' · Code lab · ' + H(lvlName(cur.lvl)) + '</div><h2>' + H(c.title) + '</h2></div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="steps" id="clSteps"></div><button class="btn cl-exit" id="clBack" type="button" aria-label="Exit this case and return to all cases">✕ Exit case</button></div></div>' +
      '<div class="cl-grid"><div id="clDev"></div><div class="cl-side" id="clSide"><div class="card scenario cl-story"><p>' + H(c.text) + '</p></div><div id="clStep"></div></div></div>' + actsHTML() + '</div>';
    root.querySelector("#clBack").onclick = exitCase; full(); bindActs();
    var p0 = c.steps[0].p;
    dev = window.DefibLab.embed(root.querySelector("#clDev"), { rhythm: p0.rhythm, pulse: p0.pulse, bp: p0.bp }, { esc: HOST.esc, onDevice: onDevice });
    step(); refit(); setTimeout(refit, 300);
  }
  function dots() {
    root.querySelector("#clSteps").innerHTML = cur.c.steps.map(function (s, i) {
      var m = cur.marks[i], cls = m == null ? (i === cur.i ? "cur" : "") : (cur.lvl === "pro" ? "x" : (m === 1 ? "r" : (m === 0.5 ? "h" : "w")));
      return '<i class="' + cls + '"></i>'; }).join("");
  }
  function shuffled(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), t = a[j]; a[j] = a[k]; a[k] = t; } return a; }
  function step() {
    clearInterval(timer);
    var s = cur.c.steps[cur.i]; cur.tries = 0; cur.struck = {}; cur.phase = "ask"; cur.order = s.t === "q" ? shuffled(s.opts.length) : null;
    dev.patient(s.p); dev.reset(); dev.lock(false); actMsg("", ""); updActs();
    if (s.t === "d") dev.config({ minJ: s.goal.kind === "sync" && !s.goal.noConvert ? s.goal.lo : 99999, shocksNeeded: 999 });
    else { var sb = sysBP(s.p), cj = { svt: 50, flutter: 50, vt: 100, af: 120 }[s.p.rhythm.r]; dev.config({ minJ: s.p.pulse && cj && sb != null && sb < 90 ? cj : 99999, shocksNeeded: 999 }); }
    dots(); render();
    var side = root.querySelector("#clSide"); if (side) side.scrollTop = 0;
    if (s.t === "d" && s.goal.kind === "pace") timer = setInterval(checkPace, 400);
  }
  function render(extra) {
    var s = cur.c.steps[cur.i], box = root.querySelector("#clStep"), h = '<div class="card cl-q">' + (s.say ? '<p class="cl-say">' + H(s.say) + '</p>' : '');
    if (s.t === "q") {
      var letters = "ABCD", pick = cur.pick;
      h += '<h3>' + H(s.q) + '</h3><div class="opt-list" id="clOpts">' + cur.order.map(function (i, pos) {
        var o = s.opts[i], dis = cur.phase !== "ask" || cur.struck[i], cls;
        if (cur.phase === "done") cls = cur.lvl === "pro" ? (i === pick ? "is-picked" : "is-dim") : (o[1] ? "is-right" : (i === pick ? "is-wrong" : "is-dim"));
        else cls = cur.struck[i] ? "is-struck" : "";
        return '<button class="opt ' + cls + '" data-i="' + i + '"' + (dis ? ' disabled' : '') + '><span class="k">' + letters[pos] + '</span><span>' + H(o[0]) + '</span></button>'; }).join("") + '</div>';
    } else {
      h += '<h3>' + H(cur.lvl === "pro" ? ({ shock: "Defibrillate.", sync: "Perform synchronized cardioversion.", pace: "Start transcutaneous pacing." })[s.goal.kind] : s.task) + '</h3>';
      if (cur.lvl === "beg" && cur.phase === "ask") h += '<p class="cl-how"><b>How:</b> ' + H(s.how) + '</p>';
      else h += '<p class="cl-dev-hint">Use the device' + (window.innerWidth > 1000 ? ' on the left' : ' above') + '.</p>';
      if (s.goal.kind === "pace" && cur.lvl !== "pro") h += '<ul class="cl-check" id="clPace"></ul>';
      if (cur.phase === "ask") {
        if (cur.lvl === "pro") h += '<button class="btn btn-ghost" id="clSkip">I can\'t get it: move on</button>';
        else if (cur.tries >= (cur.lvl === "beg" ? 1 : 2)) h += '<button class="btn btn-ghost" id="clHow">Show me how</button>';
      }
    }
    h += (extra || "") + '</div>';
    box.innerHTML = h;
    var o = box.querySelector("#clOpts"); if (o) o.onclick = function (e) { var b = e.target.closest(".opt"); if (b && !b.disabled) choose(+b.getAttribute("data-i")); };
    var hw = box.querySelector("#clHow"); if (hw) hw.onclick = function () { cur.phase = "done"; mark(0); render(feedback(false, "Here's how: " + s.how, "No points for this step.")); };
    var sk = box.querySelector("#clSkip"); if (sk) sk.onclick = function () { cur.phase = "done"; mark(0); (cur.errs[cur.i] = cur.errs[cur.i] || []).push("Moved on without finishing the device step."); render(played("You moved on. The team takes over the device.")); };
    bindNext();
    if (s.t === "d" && s.goal.kind === "pace") checkPace();
  }
  function nextBtn() { var last = cur.i === cur.c.steps.length - 1; return '<div class="qnav"><span></span><button class="btn btn-primary" id="clNext">' + (last ? 'Finish case →' : 'Next →') + '</button></div>'; }
  function feedback(ok, why, sub) {
    return '<div class="fb ' + (ok ? 'ok' : 'no') + '"><div class="verdict">' + (ok ? 'Correct' : 'Not the best choice') + '</div><p>' + H(why) + '</p>' + (sub ? '<p class="fb-note">' + H(sub) + '</p>' : '') + '</div>' + nextBtn();
  }
  // "I Got This": no verdict, just what happens to the patient
  function played(text) { return '<div class="cl-play"><b>What happens:</b> ' + H(text) + '</div>' + nextBtn(); }
  function bindNext() { var n = root.querySelector("#clNext"); if (n) { n.onclick = function () { if (cur.i < cur.c.steps.length - 1) { cur.i++; step(); } else finish(); }; n.scrollIntoView({ block: "nearest" }); } }
  function mark(v) { if (cur.marks[cur.i] == null) cur.marks[cur.i] = v; dots(); }

  // a decision. Beginner: "Do you really want to do that?" + a hint. Intermediate: "Are you sure?" only. I Got This: it plays out.
  function choose(i) {
    var s = cur.c.steps[cur.i], o = s.opts[i]; cur.pick = i;
    (cur.picks[cur.i] = cur.picks[cur.i] || []).push(i);
    if (cur.lvl === "pro") {
      cur.phase = "done"; mark(o[1] ? 1 : 0);
      render(o[1] ? played("The team carries out your decision, and the case moves on.") : played(o[4])); return;
    }
    if (o[1]) { cur.phase = "done"; mark(cur.tries ? 0.5 : 1); render(feedback(true, o[2], cur.tries ? "Half credit: right after rethinking." : "")); return; }
    cur.phase = "confirm";
    var beg = cur.lvl === "beg";
    render('<div class="cl-confirm" role="alertdialog" aria-labelledby="clCq"><b id="clCq">' + (beg ? 'Do you really want to do that?' : 'Are you sure?') + '</b>' + (beg ? '<p>' + H(o[3]) + '</p>' : '') +
      '<div class="cl-confirm-a"><button class="btn btn-primary" id="clRethink">' + (beg ? 'Rethink' : 'Change my answer') + '</button><button class="btn btn-ghost" id="clGo">Yes, do it</button></div></div>');
    root.querySelector("#clRethink").onclick = function () { cur.tries++; cur.struck[i] = 1; cur.phase = "ask"; render(); var f = root.querySelector("#clOpts .opt:not([disabled])"); if (f) f.focus(); };
    root.querySelector("#clGo").onclick = function () {
      cur.phase = "done"; mark(0);
      var right = s.opts.filter(function (x) { return x[1]; })[0];
      render('<div class="cl-result"><b>What happens:</b> ' + H(o[4]) + '</div>' + feedback(false, o[2] + " The best choice: " + right[0] + ". " + right[2]));
    };
  }

  // device tasks
  function onDevice(type, d) {
    if (!cur || !dev) return;
    var s = cur.c.steps[cur.i];
    if (s.t !== "d" || cur.phase !== "ask") { if (type === "shock" || (type === "nosync" && !s.p.pulse)) shockOnQuestion(type, d); return; }
    var g = s.goal;
    if (type === "nosync" && g.kind === "shock") return coach("SYNC is on, so the device is waiting for a QRS that VF will never give it. Turn SYNC off for VF and pulseless VT, then shock.", false, "The device is in SYNC mode and won't fire: there's no QRS to sync to. No shock is delivered.", "Left SYNC on for a pulseless rhythm, so the shock didn't fire.");
    if (type !== "shock") return;
    if (g.kind === "shock") {
      if (d.sync) return coach("That was a synchronized shock. VF and pulseless VT need an unsynchronized shock.", false, "A synchronized shock on VF. The rhythm doesn't change.", "Used a synchronized shock on a pulseless rhythm.");
      if (d.J < g.minJ) return coach(d.J + " J is below the adult defibrillation dose. Use 120–200 J biphasic (your device's recommended dose, or the maximum if unknown). Charge again.", false, "Shock delivered at " + d.J + " J. Still VF.", "Shocked at " + d.J + " J, below the adult defibrillation dose (120–200 J biphasic).");
      cur.hx.shocks++;
      return success("Shock delivered at " + d.J + " J. Now resume compressions immediately.");
    }
    if (g.kind === "sync") {
      if (!d.sync && d.before.perfusing) {
        dev.message("UNSYNCHRONIZED SHOCK: VF", "warn");
        return coach("Do you really want to do that? An unsynchronized shock on a rhythm with a pulse can land on the T wave and cause VF, which is what just happened. For practice, the patient is rewound: press SYNC first.", true,
          "The unsynchronized shock lands on the T wave and the patient goes into VF. The scene is rewound to just before the shock.", "Gave an unsynchronized shock to a patient with a pulse, causing VF.");
      }
      if (d.J < g.lo) return coach(d.J + " J is below the recommended starting energy here (" + g.lo + "–" + g.hi + " J). Charge again at the right energy.", false, "Synchronized shock at " + d.J + " J. No conversion.", "Cardioverted at " + d.J + " J, below the starting energy (" + g.lo + "–" + g.hi + " J).");
      if (d.J > g.hi) (cur.errs[cur.i] = cur.errs[cur.i] || []).push("Started at " + d.J + " J; the recommended starting energy is " + g.lo + "–" + g.hi + " J.");
      return success("Synchronized cardioversion at " + d.J + " J." + (d.J > g.hi ? " It worked, but start at " + g.lo + "–" + g.hi + " J next time and escalate only if needed." : ""), d.J > g.hi);
    }
  }
  function checkPace() {
    var s = cur.c.steps[cur.i]; if (!s || s.t !== "d" || s.goal.kind !== "pace" || cur.phase !== "ask") return;
    var st = dev.state(), p = st.pacer, r = s.goal.rate, okRate = p.on && p.rate >= r[0] && p.rate <= r[1];
    var ul = root.querySelector("#clPace");
    if (ul) ul.innerHTML = [[p.on, "Pacer on"], [okRate, "Rate " + r[0] + "–" + r[1] + " ppm (now " + p.rate + ")"], [st.captured, "Capture: a wide QRS after every spike" + (p.on ? " (" + p.mA + " mA)" : "")]]
      .map(function (x) { return '<li class="' + (x[0] ? 'ok' : '') + '">' + (x[0] ? '✓ ' : '○ ') + H(x[1]) + '</li>'; }).join("");
    if (p.on && st.captured) {
      if (okRate) { clearInterval(timer); success("Capture at " + p.mA + " mA, rate " + p.rate + " ppm. Set the current a little above the threshold and confirm a femoral pulse."); }
      else if (cur.lvl === "pro" && !cur.rateNoted) { cur.rateNoted = 1; (cur.errs[cur.i] = cur.errs[cur.i] || []).push("Paced at " + p.rate + " ppm; the adult target is " + r[0] + "–" + r[1] + " ppm."); cur.tries++; }
    }
  }
  // a device mistake: coached (Beginner/Intermediate) or simply played out and logged for the review (I Got This)
  function coach(text, rewind, play, log) {
    cur.tries++;
    var s = cur.c.steps[cur.i];
    if (log) (cur.errs[cur.i] = cur.errs[cur.i] || []).push(log);
    if (rewind) setTimeout(function () { if (cur && cur.c.steps[cur.i] === s) { dev.patient(s.p); dev.reset(); } }, 2500);
    if (cur.lvl === "pro") { render('<div class="cl-play"><b>What happens:</b> ' + H(play || text) + '</div>'); return; }
    render('<div class="cl-confirm"><b>Not quite yet</b><p>' + H(text) + '</p></div>');
  }
  function success(text, half) {
    cur.phase = "done"; mark(cur.tries || half ? 0.5 : 1);
    if (cur.lvl === "pro") { render(played(text.replace(/ Now resume.*$/, "").replace(/ It worked, but.*$/, "").replace(/ Set the current.*$/, ""))); return; }
    render(feedback(true, text, cur.tries ? "Half credit: it took " + (cur.tries + 1) + " tries." : ""));
  }

  function finish() {
    stopDevice();
    Object.keys(cur.bad).forEach(function (i) { if (cur.marks[i] != null && cur.marks[i] > 0.5) cur.marks[i] = 0.5; });
    var c = cur.c, pts = cur.marks.reduce(function (a, b) { return a + (b || 0); }, 0), max = c.steps.length, pc = Math.round(100 * pts / max), ok = pc >= 80;
    HOST.save(c.id, { ok: ok, pct: pc, p2: Math.round(pts * 2), m2: max * 2, at: Date.now(), lvl: cur.lvl });
    var rows = c.steps.map(function (s, i) {
      var m = cur.marks[i], cls = m === 1 ? 'ok' : (m === 0.5 ? 'half' : 'bad'), body;
      if (s.t === "q") {
        var right = s.opts.filter(function (o) { return o[1]; })[0], picks = cur.picks[i] || [], first = s.opts[picks[0]], last = s.opts[picks[picks.length - 1]];
        body = '<b>' + H(s.q) + '</b>';
        if (first && !first[1]) {
          body += '<p class="cl-yours">You chose: ' + H(first[0]) + '</p><p class="cl-why">' + H(first[2]) + '</p>';
          if (last && last !== first) body += '<p class="cl-yours">' + (last[1] ? 'Then changed to the best answer.' : 'Then chose: ' + H(last[0])) + '</p>';
        }
        body += '<p class="cl-best"><span>Best:</span> ' + H(right[0]) + '</p>' + (m === 1 ? '' : '<p class="cl-why">' + H(right[2]) + '</p>');
      } else {
        body = '<b>Device: ' + H(s.task) + '</b>' + (cur.errs[i] || []).map(function (e) { return '<p class="cl-yours">' + H(e) + '</p>'; }).join("") +
          (m === 1 ? '<p class="cl-best">Done on the first try.</p>' : '<p class="cl-best"><span>How:</span> ' + H(s.how) + '</p>');
      }
      return '<li class="' + cls + '"><span class="cl-m">' + (m === 1 ? '✓' : (m === 0.5 ? '½' : '✗')) + '</span><div>' + body + '</div></li>'; }).join("");
    var how = cur.lvl === "pro" ? "Full credit for a right decision or a device step done right the first time; no credit for a wrong decision." : "Full credit for a right first choice, half credit after rethinking or a second try.";
    root.innerHTML = '<div class="card cl-sum ' + (ok ? 'pass' : 'fail') + '"><div class="verdict">' + (ok ? 'Case passed' : 'Case needs review') + ' · ' + H(lvlName(cur.lvl)) + '</div><h2>' + H(c.title) + ' · ' + pc + '%</h2>' +
      '<p>' + (Math.round(pts * 10) / 10) + ' of ' + max + ' points. ' + how + '</p><ol class="cl-list">' + rows + '</ol>' + (cur.log.length ? '<h3 class="cl-acth">Your actions</h3><ul class="cl-actlog">' + cur.log.map(function (a) { return '<li class="' + (a.ok ? 'ok' : 'bad') + '"><b>' + (a.ok ? '✓' : '✗') + '</b> <span>Step ' + (a.i + 1) + ': ' + H(a.t) + (a.ok ? '' : '. ' + H(a.why)) + '</span></li>'; }).join('') + '</ul><p class="fb-note">A step where an action was poorly timed earns at most half credit.</p>' : '') +
      '<div class="qnav" style="justify-content:flex-start"><button class="btn btn-primary" id="clAgain">Run it again</button><button class="btn btn-ghost" id="clAll">All cases</button></div>' +
      '<p class="empty">Based on the current AHA adult advanced life support algorithms. Always follow your local protocols and medical direction.</p></div>';
    root.querySelector("#clAgain").onclick = function () { start(c.id); };
    root.querySelector("#clAll").onclick = list;
    window.scrollTo(0, 0);
  }

  window.CodeLab = {
    cases: CASES, cats: CATS, levels: LEVELS,
    render: function (container, host) { HOST = host; root = container; list(); },
    stop: stopDevice
  };
})();
