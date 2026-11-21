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

  // --- cardiac arrest pieces (Adult Cardiac Arrest Algorithm)
  function recognizeArrest(say) {
    return Q(P("nsr", false, null, false), say, "What do you do first?", [
      ["Start high-quality CPR, give oxygen and attach the monitor/defibrillator pads", true, "Unresponsive, not breathing normally and no pulse within 10 seconds: start CPR right away and get the pads on. Every algorithm begins here."],
      ["Get IV access and give epinephrine 1 mg before starting compressions", false, "Drugs never come before compressions and a rhythm check.", "Is anything more important than compressions and finding a shockable rhythm?", ARREST_RESULT],
      ["Check a blood glucose and a full set of vitals", false, "With no pulse there's nothing to measure: start CPR.", "This patient has no pulse. What keeps blood moving right now?", ARREST_RESULT],
      ["Intubate before doing anything else", false, "An advanced airway can wait; bag-mask ventilation with 30:2 compressions is fine early on.", "Would you delay compressions for an airway?", ARREST_RESULT]
    ]);
  }
  function identifyShockable(p, rhythmName) {
    return Q(p, "Pads are on. Compressions pause for a rhythm check (under 10 seconds).", "What is the rhythm, and what's next?", [
      [rhythmName + ": shockable, defibrillate now", true, rhythmName + " is shockable: deliver an unsynchronized shock as soon as possible, then resume CPR immediately."],
      ["Asystole: continue CPR and give epinephrine", false, "Look again: there's chaotic (or fast, wide) electrical activity, not a flat line.", "Is this really a flat line? Look at the baseline.", "You treat it as non-shockable and the shockable window is lost for another 2 minutes."],
      ["A tachycardia with a pulse: synchronized cardioversion", false, "There's no pulse, so this is an arrest rhythm. SYNC won't fire on VF and delays the shock.", "Did this patient have a pulse?", "The device waits for a QRS that never comes, and no shock is delivered."],
      ["Keep doing CPR; shock only after 2 more minutes", false, "Shockable rhythms are shocked as soon as they're identified.", "How quickly should a shockable rhythm be defibrillated?", "Two more minutes of VF with no shock: the chance of conversion falls with every minute."]
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
      ["Check the pulse and rhythm to see if the shock worked", false, "The rhythm and pulse are checked at the end of the 2-minute CPR cycle.", "Do you want to pause compressions right now?", ARREST_RESULT],
      ["Charge and shock again straight away (stacked shocks)", false, "Stacked shocks aren't recommended: one shock, then 2 minutes of CPR.", "How many shocks before the next 2 minutes of CPR?", "Another shock without CPR in between: no perfusion and no benefit."],
      ["Give amiodarone 300 mg before anything else", false, "Antiarrhythmics come after the third shock, and never at the expense of compressions.", "What comes first after any shock?", ARREST_RESULT]
    ]);
  }
  function cprQuality(p) {
    return Q(p, "CPR is underway and an IV is being placed. ETCO₂ reads 9 mmHg.", "What does that ETCO₂ tell you, and what do you change?", [
      ["Compressions are probably inadequate: push harder and faster (100–120/min, at least 2 in/5 cm, full recoil) and switch compressors", true, "ETCO₂ under 10 mmHg during CPR suggests poor compressions. Improve depth, rate and recoil, swap the compressor every 2 minutes, and minimize pauses."],
      ["It means the patient can't be saved: stop the resuscitation", false, "A low ETCO₂ early on is a CPR-quality warning, not a reason to stop.", "Early in a code, what's the most likely cause of a low ETCO₂?", "Stopping this early ignores a fixable problem: CPR quality."],
      ["Ventilate faster, about 30 breaths a minute, to raise the reading", false, "Overventilation raises chest pressure and reduces blood return. Without an advanced airway it's 30:2; with one, 1 breath every 6 seconds.", "Does breathing faster improve blood flow during CPR?", "Fast ventilation drops venous return and coronary perfusion."],
      ["Nothing: ETCO₂ isn't useful during CPR", false, "Capnography is one of the best real-time measures of CPR quality and ROSC.", "What does waveform capnography tell you during CPR?", "You miss a chance to fix poor compressions."]
    ]);
  }
  function epiShockable(p) {
    return Q(p, "Second shock delivered and CPR has resumed. IV access is in.", "Which medication now?", [
      ["Epinephrine 1 mg IV/IO, then every 3–5 minutes", true, "In shockable arrest, epinephrine is given after the second shock (once CPR resumes) and repeated every 3–5 minutes."],
      ["Amiodarone 300 mg IV/IO first, epinephrine later", false, "Amiodarone (or lidocaine) comes after the third shock; the vasopressor comes first.", "Which comes first in the VF/pVT pathway: the vasopressor or the antiarrhythmic?", "The vasopressor is delayed by a full cycle."],
      ["Atropine 1 mg IV", false, "Atropine has no role in cardiac arrest.", "Is atropine part of the cardiac arrest algorithm?", "No effect on VF; time and drug wasted."],
      ["Adenosine 6 mg rapid IV push", false, "Adenosine is for stable, regular narrow-complex tachycardia with a pulse.", "Does adenosine treat a pulseless rhythm?", "No effect; the patient remains in arrest."]
    ]);
  }
  function antiarrhythmic(p) {
    return Q(p, "Third shock delivered, CPR resumed. Still no ROSC.", "Which antiarrhythmic and dose?", [
      ["Amiodarone 300 mg IV/IO bolus (second dose 150 mg), or lidocaine 1–1.5 mg/kg", true, "For shock-refractory VF/pVT: amiodarone 300 mg, then 150 mg; or lidocaine 1–1.5 mg/kg, then 0.5–0.75 mg/kg. Keep looking for reversible causes."],
      ["Amiodarone 150 mg over 10 minutes", false, "150 mg over 10 minutes is the stable VT dose (or the second arrest dose).", "What's the first amiodarone dose in cardiac arrest?", "Too little, too slowly for a pulseless patient."],
      ["Magnesium sulfate 2 g", false, "Magnesium is for torsades de pointes (polymorphic VT with a long QT), not routine VF.", "Is this torsades?", "No benefit for this rhythm."],
      ["Procainamide 20–50 mg/min", false, "Procainamide is for stable wide-complex tachycardia, not cardiac arrest.", "Which antiarrhythmics are used in cardiac arrest?", "Too slow to load and not an arrest drug."]
    ]);
  }
  function airway(p) {
    return Q(p, "CPR continues with bag-mask ventilation at 30:2. A paramedic is ready to place an advanced airway.", "How do you manage the airway and ventilation from here?", [
      ["Place the advanced airway with minimal interruption, confirm it with waveform capnography, then give 1 breath every 6 seconds with continuous compressions", true, "Advanced airway placement shouldn't interrupt compressions for long. Confirm with waveform capnography, then 10 breaths/min with continuous compressions."],
      ["Stop compressions for as long as it takes to intubate", false, "Keep pauses under 10 seconds; intubation shouldn't stop CPR.", "How long can compressions pause?", ARREST_RESULT],
      ["After intubation, keep pausing compressions to give 2 breaths every 30", false, "With an advanced airway, compressions are continuous and breaths are given every 6 seconds.", "Do you still need 30:2 pauses with an advanced airway?", "Unneeded pauses lower perfusion."],
      ["Confirm placement by listening only", false, "Waveform capnography is recommended to confirm and monitor tube placement.", "What's the most reliable confirmation of tube placement?", "A missed esophageal intubation is possible."]
    ]);
  }
  function rosc(p) {
    return Q(p, "During compressions the ETCO₂ suddenly rises from 18 to 46 mmHg, and the monitor shows an organized rhythm.", "What does that suggest, and what do you do?", [
      ["Likely return of spontaneous circulation: check for a pulse at the rhythm check", true, "An abrupt, sustained rise in ETCO₂ (often to 40 mmHg or more) is a strong sign of ROSC. Check the pulse and blood pressure."],
      ["Give the next dose of epinephrine on schedule", false, "Epinephrine given right after ROSC can cause severe hypertension and arrhythmias.", "What does a sudden jump in ETCO₂ usually mean?", "A bolus of epinephrine into a beating heart: dangerous hypertension and tachycardia."],
      ["Shock again", false, "This is an organized rhythm, possibly with a pulse: shocking it could cause VF.", "Is this rhythm shockable?", "The shock lands on a perfusing rhythm and can trigger VF."],
      ["Ignore it: ETCO₂ isn't reliable", false, "ETCO₂ is a key sign of ROSC.", "What does a sudden ETCO₂ rise mean?", "ROSC goes unrecognized and CPR continues unnecessarily."]
    ]);
  }
  // --- post-cardiac arrest care (Adult Post-Cardiac Arrest Care Algorithm)
  function postCare(stemi) {
    var P = function (rh, pulse, bp, cpr, good) { var p = P0(rh, pulse, bp, cpr, good); if (stemi) p.twelve = "antstemi"; return p; };
    return [
      Q(P("nsr", true, "84/50", false, true), "ROSC. Pulse 104, BP 84/50, SpO₂ 99% on 100% oxygen, advanced airway in place.", "What are your ventilation and oxygen targets?", [
        ["Titrate oxygen to SpO₂ 92–98%, ventilate about 10 breaths/min, and aim for a normal PaCO₂ (35–45 mmHg)", true, "After ROSC avoid both hypoxia and hyperoxia (SpO₂ 92–98%) and avoid hyperventilation: start at 10 breaths/min and titrate to a normal PaCO₂/ETCO₂."],
        ["Keep 100% oxygen and hyperventilate to blow off CO₂", false, "Hyperoxia and hyperventilation can both worsen brain injury.", "Is more oxygen and faster ventilation always better after ROSC?", "Low CO₂ constricts cerebral vessels and reduces brain blood flow."],
        ["Remove the airway now that there's a pulse", false, "The patient is unresponsive and needs a secured airway.", "Can an unresponsive patient protect their airway?", "Risk of aspiration and hypoxia."],
        ["Ventilate as slowly as possible to let CO₂ rise", false, "Hypoventilation and high CO₂ are also harmful. Aim for normal.", "What's the PaCO₂ target?", "Rising CO₂ worsens acidosis."]
      ]),
      Q(P("nsr", true, "84/50", false, true), "BP is 84/50 (MAP about 61).", "How do you manage the blood pressure?", [
        ["Treat hypotension: IV/IO fluid bolus and a vasopressor infusion as needed, keeping SBP at least 90 and MAP at least 65", true, "Post-arrest targets: SBP ≥ 90 mmHg and MAP ≥ 65 mmHg. Use fluids and vasopressors (e.g. norepinephrine or epinephrine infusion) per protocol."],
        ["Accept it: a low pressure protects the heart after an arrest", false, "Hypotension after ROSC is linked to worse outcomes.", "What's the minimum blood pressure target after ROSC?", "The brain and heart stay underperfused."],
        ["Give epinephrine 1 mg IV push", false, "The 1 mg arrest dose is for pulseless patients. A pulse is present: use an infusion and titrate.", "Is the arrest bolus dose right for a patient with a pulse?", "A sudden surge in pressure and heart rate; risk of re-arrest."],
        ["Give nitroglycerin for possible ischemia", false, "Nitroglycerin would drop an already low pressure.", "What does nitroglycerin do to blood pressure?", "Further hypotension."]
      ]),
      Q(P("nsr", true, "102/64", false, true), stemi ? "Blood pressure is improving. Press 12-LEAD on the monitor and read the ECG: it shows ST elevation in V1–V4." : "Blood pressure is improving. Press 12-LEAD on the monitor: the 12-lead shows no ST elevation.", "What's the next priority?",
        stemi ? [
          ["Activate the cath lab: ST elevation after ROSC needs emergent coronary angiography", true, "Get a 12-lead ECG as soon as possible after ROSC. STEMI → emergent angiography/PCI."],
          ["Repeat the 12-lead tomorrow; it's probably post-arrest changes", false, "STEMI after ROSC should be treated as STEMI.", "What should ST elevation after ROSC trigger?", "Delayed reperfusion for an occluded coronary artery."],
          ["Give a fibrinolytic in the field without consultation", false, "Reperfusion choices follow your STEMI system; the cath lab is usually preferred.", "What's the preferred reperfusion after ROSC with STEMI?", "Bleeding risk with no consultation."],
          ["No change: the ECG doesn't matter after ROSC", false, "A 12-lead is a key early step after ROSC.", "Why get a 12-lead after ROSC?", "A treatable cause is missed."]
        ] : [
          ["Look for and treat the cause (Hs and Ts), consult cardiology, and transport to a cardiac-arrest-capable center", true, "Even without STEMI, find and treat the cause, and consider angiography for suspected cardiac cause per expert consultation."],
          ["Nothing more is needed", false, "The cause of the arrest still has to be found.", "Has the cause of the arrest been addressed?", "The underlying cause can trigger another arrest."],
          ["Start a heparin and nitroglycerin drip without consultation", false, "Treatment depends on the cause; consult first.", "What's known about the cause so far?", "Unguided treatment can cause harm."],
          ["Extubate in the field", false, "The patient is still unresponsive.", "Is the patient awake?", "Airway compromise."]
        ]),
      Q(P("nsr", true, "108/68", false, true), "The patient remains unresponsive and doesn't follow commands. Temperature 37.6 °C.", "What else do you start?", [
        ["Deliberate temperature control: maintain 32–37.5 °C and prevent fever, plus check glucose and get an EEG/neurology assessment in hospital", true, "Comatose patients after ROSC need deliberate temperature control (32–37.5 °C) with active fever prevention, and multimodal neuroprognostication later, not in the first hours."],
        ["Warm the patient to 39 °C to speed up recovery", false, "Fever worsens brain injury after cardiac arrest.", "Is fever helpful or harmful after an arrest?", "Higher temperatures increase brain injury."],
        ["Decide in the first hour whether the outlook is hopeless", false, "Neuroprognostication is delayed (typically at least 72 hours after normothermia) and uses several tests.", "When can a reliable neurological prognosis be made?", "A premature, unreliable decision."],
        ["Nothing: temperature doesn't matter", false, "Temperature control is a core part of post-arrest care.", "What temperature management is recommended for comatose survivors?", "Fever goes untreated."]
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
        ["Defibrillate at 200 J", false, "Asystole isn't shockable; shocks don't help and interrupt CPR.", "Is a flat line a shockable rhythm?", "No effect; compressions are interrupted for nothing."],
        ["Start transcutaneous pacing", false, "Pacing isn't recommended for asystolic arrest.", "Does pacing help in asystole?", "No capture; time lost."],
        ["Give atropine 1 mg", false, "Atropine was removed from the arrest algorithm.", "Is atropine an arrest drug?", "No benefit."]
      ]),
      Q(P("asys", false, null, true), "CPR in progress. IO access is in.", "Which medication, and when?", [
        ["Epinephrine 1 mg IV/IO as soon as possible, then every 3–5 minutes", true, "In non-shockable arrest, give epinephrine as early as possible."],
        ["Amiodarone 300 mg", false, "Antiarrhythmics are for shockable rhythms.", "Is this rhythm shockable?", "No benefit in asystole."],
        ["Wait until after 3 cycles of CPR, then epinephrine", false, "Early epinephrine improves outcomes in non-shockable arrest.", "When should epinephrine be given in asystole/PEA?", "A delayed vasopressor."],
        ["Sodium bicarbonate for everyone", false, "Bicarbonate isn't routine; it's for specific causes such as hyperkalemia or some overdoses.", "Is bicarbonate a routine arrest drug?", "Possible harm without a reason to give it."]
      ]),
      cprQuality(P("asys", false, null, true)),
      Q(P("asys", false, null, true), "Still asystole at the 2-minute rhythm check.", "What should you be thinking about during each cycle?", [
        ["The reversible causes (Hs and Ts): hypovolemia, hypoxia, acidosis, high/low potassium, hypothermia, tension pneumothorax, tamponade, toxins, thrombosis", true, "Search for and treat the Hs and Ts in every non-shockable arrest."],
        ["Only the time since collapse", false, "Time matters, but finding a reversible cause matters more.", "What can actually be fixed?", "A reversible cause is missed."],
        ["Whether to start pacing", false, "Pacing doesn't help asystolic arrest.", "Is pacing part of the asystole pathway?", "No benefit."],
        ["Giving a shock every 2 minutes in case it's fine VF", false, "Shock only if the rhythm check shows VF/pVT.", "When do you shock?", "Unneeded pauses and shocks."]
      ]),
      Q(P("asys", false, null, true), "After 25 minutes of high-quality ALS with an advanced airway, ETCO₂ stays at 7 mmHg and the rhythm is still asystole.", "What does this suggest?", [
        ["A very low chance of ROSC: one of several factors in deciding, with medical direction and your protocol, whether to stop", true, "ETCO₂ below 10 mmHg after 20 minutes of ALS with an advanced airway is associated with very low survival, but it should never be the only factor in stopping."],
        ["Stop immediately: ETCO₂ alone decides", false, "ETCO₂ is one factor, not the only one.", "Should one number decide termination?", "A decision made on incomplete information."],
        ["Shock to see if it helps", false, "Asystole isn't shockable.", "Is this shockable?", "No benefit."],
        ["Give a double dose of epinephrine", false, "Higher-dose epinephrine isn't recommended.", "Is high-dose epinephrine recommended?", "No benefit; possible harm."]
      ])
    ] },
    { id: "pea1", cat: "pea", title: "Organized, but no pulse", text: "A 58-year-old dialysis patient who missed two sessions collapses in the waiting room.", steps: [
      recognizeArrest("Unresponsive with agonal breathing. You can't feel a pulse."),
      Q(P("pea", false, null, false), "Pads on, rhythm check. The monitor shows an organized rhythm at about 64, but there's no pulse.", "What is this, and what do you do?", [
        ["Pulseless electrical activity: resume CPR, no shock, and give epinephrine 1 mg as soon as possible", true, "Organized electrical activity without a pulse is PEA: non-shockable. CPR, early epinephrine, and find the cause."],
        ["Normal sinus rhythm: the patient is fine", false, "No pulse means no perfusion, whatever the monitor shows.", "What does the pulse check tell you?", ARREST_RESULT],
        ["Synchronized cardioversion", false, "Cardioversion is for tachycardia with a pulse.", "Is there a pulse?", "No effect; delays CPR."],
        ["Atropine 1 mg for a slow rhythm", false, "Atropine isn't used in PEA.", "Is atropine part of the arrest algorithm?", "No benefit."]
      ]),
      Q(P("pea", false, null, true), "His last labs showed potassium 6.9 and earlier ECGs had peaked T waves.", "Which reversible cause is most likely, and how do you treat it?", [
        ["Hyperkalemia: calcium chloride 1 g IV (or calcium gluconate) and sodium bicarbonate, per protocol", true, "Suspected hyperkalemia in arrest: give IV calcium to stabilize the heart, and consider sodium bicarbonate. Continue CPR and epinephrine."],
        ["Hypoglycemia: give D50 only", false, "Check glucose, but the story points to potassium.", "What did his labs show?", "The likely cause goes untreated."],
        ["Tension pneumothorax: needle decompression", false, "Nothing suggests a pneumothorax.", "Is there trauma or asymmetric chest rise?", "An unnecessary procedure."],
        ["Give amiodarone", false, "Antiarrhythmics don't treat hyperkalemia.", "What treats high potassium?", "No effect on the cause."]
      ]),
      rosc(P("nsr", false, null, true))
    ] },
    { id: "brady1", cat: "brady", title: "Slow and confused", text: "A 74-year-old with dizziness and confusion. Pale and diaphoretic.", steps: [
      Q(P("chb", true, "72/40", false), "Heart rate 36, BP 72/40, confused. The monitor shows this rhythm.", "Is this stable, and what do you give first?", [
        ["Unstable symptomatic bradycardia (hypotension and altered mental status): atropine 1 mg IV, repeat every 3–5 minutes up to 3 mg", true, "Bradycardia with hypotension, altered mental status, shock, ischemic chest pain or acute heart failure is unstable. Atropine 1 mg first, repeat every 3–5 minutes (max 3 mg)."],
        ["Stable: observe and transport without treatment", false, "Hypotension and confusion make this unstable.", "What signs make a bradycardia unstable?", "Perfusion keeps falling; the patient becomes less responsive."],
        ["Adenosine 6 mg rapid push", false, "Adenosine slows the heart further.", "What does adenosine do to the heart rate?", "A pause and further hypotension."],
        ["Amiodarone 150 mg", false, "Amiodarone is for tachycardias.", "Is amiodarone a rate-raising drug?", "Further slowing."]
      ]),
      Q(P("chb", true, "70/38", false), "Atropine 1 mg, then a second dose: no change. The rhythm is complete heart block with a wide escape.", "What's next?", [
        ["Transcutaneous pacing (or a dopamine 5–20 mcg/kg/min or epinephrine 2–10 mcg/min infusion)", true, "If atropine fails, use transcutaneous pacing and/or a chronotropic infusion, and get expert help for transvenous pacing."],
        ["Keep giving atropine every minute until it works", false, "The maximum total is 3 mg, and atropine often fails in high-grade block with a wide QRS.", "What's the maximum atropine dose, and does it work in this block?", "Anticholinergic toxicity with no rate change."],
        ["Synchronized cardioversion", false, "Cardioversion is for tachycardias.", "Is this fast or slow?", "No effect."],
        ["Wait for the hospital", false, "This patient is unstable now.", "Can this wait?", "Hypotension worsens."]
      ]),
      Q(P("chb", true, "70/38", false), "You're setting up the pacer. The patient is awake and anxious.", "What do you do before you start pacing?", [
        ["Give analgesia/sedation as blood pressure allows, and explain what's happening", true, "Transcutaneous pacing is painful. Treat pain and anxiety when the blood pressure permits; don't delay pacing in an unstable patient."],
        ["Nothing: pacing doesn't hurt", false, "Transcutaneous pacing is painful.", "How does pacing feel?", "A frightened patient in severe pain."],
        ["Delay pacing until a sedation drip is running", false, "Don't delay pacing in an unstable patient.", "Can this wait for a drip?", "Prolonged hypotension."],
        ["Give a large sedative dose regardless of blood pressure", false, "Sedatives can drop the blood pressure further.", "What's the blood pressure?", "Worse hypotension."]
      ]),
      D(P("chb", true, "70/38", false), "Pads are on. Start pacing.", "Pace at 60–80 ppm and increase the current until every spike captures (wide QRS after each spike).",
        { kind: "pace", rate: [60, 80] }, "Press PACER, set RATE to 60–80 with ▲▼, then raise CURRENT with ▲ until each pacer spike is followed by a wide QRS."),
      Q(P("chb", true, "104/62", false, true), "Every spike is followed by a wide QRS.", "How do you confirm mechanical capture?", [
        ["Feel for a femoral pulse that matches the pacing rate (and check the blood pressure)", true, "Confirm mechanical capture with a femoral pulse matching the paced rate; the muscle twitching from pacing makes carotid pulses unreliable."],
        ["Check the carotid pulse", false, "Pacing makes the neck muscles twitch, which can feel like a pulse.", "Why might a carotid pulse mislead you here?", "You may mistake muscle jerking for a pulse."],
        ["Electrical capture on the monitor is enough", false, "Electrical capture doesn't guarantee the heart is pumping.", "Does a QRS on the monitor always mean a pulse?", "Missed loss of mechanical capture."],
        ["Lower the current to the minimum so it's comfortable", false, "Set the current slightly above the capture threshold, not below it.", "What happens below the threshold?", "Capture is lost."]
      ])
    ] },
    { id: "svt1", cat: "svt", title: "The racing heart", text: "A 31-year-old with sudden palpitations at work.", steps: [
      Q(P("svt", true, "118/76", false), "Heart rate 196, regular and narrow. BP 118/76, alert, mild chest tightness only when anxious.", "Stable or unstable, and what's first?", [
        ["Stable narrow, regular tachycardia: try a vagal maneuver (e.g. modified Valsalva) first", true, "Stable regular narrow-complex tachycardia: vagal maneuvers first, then adenosine if they fail."],
        ["Unstable: synchronized cardioversion now", false, "Normal blood pressure and alert: stable.", "Which signs would make this unstable?", "An unnecessary, painful procedure."],
        ["Amiodarone 300 mg IV push", false, "300 mg is the arrest dose.", "What's the 300 mg amiodarone dose for?", "Wrong dose for a stable patient."],
        ["Defibrillate (unsynchronized)", false, "Unsynchronized shocks on a perfusing rhythm can cause VF.", "What does an unsynchronized shock risk here?", "The shock lands on the T wave: VF."]
      ]),
      Q(P("svt", true, "116/74", false), "The Valsalva maneuver doesn't work. IV in the antecubital.", "Next?", [
        ["Adenosine 6 mg rapid IV push followed immediately by a 20 mL saline flush; 12 mg if needed", true, "Adenosine 6 mg rapid push with a flush, then 12 mg if the first dose doesn't work. Record a strip during the push."],
        ["Adenosine 6 mg slowly over 2 minutes", false, "Adenosine has a half-life of seconds: it must be pushed fast with a flush.", "How fast must adenosine be given?", "It's metabolized before reaching the heart; no effect."],
        ["Synchronized cardioversion", false, "The patient is still stable.", "Is the patient unstable yet?", "An unnecessary procedure."],
        ["Atropine 1 mg", false, "Atropine speeds the heart up.", "What does atropine do?", "A faster tachycardia."]
      ]),
      Q(P("svt", true, "78/44", false), "Adenosine 6 mg and then 12 mg: brief slowing, then back to 196. Now she's pale and confused, BP 78/44.", "What now?", [
        ["She's now unstable: synchronized cardioversion, with sedation if time allows", true, "Tachycardia with hypotension and altered mental status is unstable: synchronized cardioversion. Sedate if it won't delay treatment."],
        ["A third dose of adenosine 18 mg", false, "Two doses failed and she's now unstable.", "What changed in her condition?", "Delay while she deteriorates."],
        ["Diltiazem IV", false, "Calcium channel blockers lower the blood pressure further.", "What does diltiazem do to a pressure of 78/44?", "Worse hypotension."],
        ["Defibrillate (unsynchronized)", false, "There's a pulse and an organized rhythm: synchronize.", "Why synchronize?", "The shock lands on the T wave: VF."]
      ]),
      D(P("svt", true, "78/44", false), "Sedation given. Pads on.", "Synchronized cardioversion for a narrow, regular tachycardia: SYNC on, start at 50–100 J.",
        { kind: "sync", lo: 50, hi: 100 }, "Press SYNC (markers appear on each QRS), set 50–100 J with ENERGY SELECT ▼, press CHARGE, then hold SHOCK: it fires on the next QRS."),
      Q(P("nsr", true, "112/70", false, true), "Converted to sinus rhythm at 92, BP 112/70.", "What next?", [
        ["Get a 12-lead ECG, keep monitoring and consult for expert follow-up", true, "After conversion, record a 12-lead (look for pre-excitation), monitor for recurrence, and arrange follow-up."],
        ["Discharge without follow-up", false, "Recurrence is common and the cause needs evaluation.", "Could this happen again?", "A missed diagnosis such as WPW."],
        ["Give amiodarone 300 mg to prevent recurrence", false, "That's the arrest dose.", "Is a 300 mg push appropriate here?", "Hypotension and bradycardia."],
        ["Keep the pads off from now on", false, "Keep monitoring with pads available.", "Could she deteriorate again?", "A delayed response if it recurs."]
      ])
    ] },
    { id: "vt1", cat: "vt", title: "Wide complex with a pulse", text: "A 63-year-old with chest pain and palpitations.", steps: [
      Q(P("vt", true, "76/40", false), "Wide, regular tachycardia at 168. BP 76/40, diaphoretic with chest pain.", "Stable or unstable, and what's the treatment?", [
        ["Unstable VT with a pulse: synchronized cardioversion, sedating if time allows", true, "Monomorphic VT with a pulse plus hypotension and chest pain is unstable: synchronized cardioversion, starting around 100 J."],
        ["Stable: amiodarone 150 mg over 10 minutes", false, "Hypotension, chest pain and diaphoresis make this unstable.", "Which signs make a tachycardia unstable?", "Ten minutes of infusion while perfusion falls."],
        ["Unsynchronized defibrillation at 200 J", false, "There's a pulse: synchronize so the shock avoids the T wave. Unsynchronized is for pulseless or polymorphic VT.", "Does this patient have a pulse?", "The shock lands on the T wave: VF."],
        ["Adenosine 6 mg", false, "Adenosine may be considered only for stable, regular, monomorphic wide-complex tachycardia.", "Is this patient stable?", "Delay while unstable."]
      ]),
      D(P("vt", true, "76/40", false), "Sedation given. Pads on.", "Synchronized cardioversion for monomorphic VT with a pulse: SYNC on, about 100 J (escalate if needed).",
        { kind: "sync", lo: 100, hi: 200 }, "Press SYNC, set about 100 J with ENERGY SELECT, CHARGE, then SHOCK: it fires on the next QRS."),
      Q(P("nsr", true, "104/66", false, true), "Converted to sinus rhythm, BP 104/66.", "What now?", [
        ["Amiodarone 150 mg IV over 10 minutes to help prevent recurrence, a 12-lead ECG and expert consultation", true, "After conversion consider an antiarrhythmic infusion (amiodarone 150 mg over 10 minutes), get a 12-lead and consult."],
        ["Amiodarone 300 mg rapid IV push", false, "300 mg push is the arrest dose.", "Is the patient pulseless?", "Hypotension and bradycardia."],
        ["Nothing more", false, "VT can recur, and the cause (often ischemia) needs workup.", "Could the VT come back?", "Recurrent VT."],
        ["Adenosine 12 mg", false, "The rhythm has already converted.", "What would adenosine do now?", "A pause."]
      ])
    ] },
    { id: "af1", cat: "af", title: "Irregular and hypotensive", text: "A 76-year-old with shortness of breath and chest pressure.", steps: [
      Q(P("af", true, "80/48", false), "Irregularly irregular narrow tachycardia at about 158, no P waves. BP 80/48, short of breath.", "What is it, and what's the treatment?", [
        ["Atrial fibrillation with rapid ventricular response, unstable: synchronized cardioversion (sedate if time allows)", true, "Unstable AF: synchronized cardioversion. Narrow irregular rhythms start at 120–200 J biphasic per device and protocol."],
        ["Adenosine 6 mg", false, "Adenosine doesn't convert AF and is for regular rhythms.", "Is this regular?", "A brief pause; still AF."],
        ["Diltiazem IV for rate control", false, "Rate control is for stable patients; diltiazem lowers BP further.", "Is she stable?", "Worse hypotension."],
        ["Unsynchronized defibrillation", false, "There's a pulse: synchronize.", "Why synchronize?", "The shock lands on the T wave: VF."]
      ]),
      D(P("af", true, "80/48", false), "Sedation given. Pads on.", "Synchronized cardioversion for atrial fibrillation: SYNC on, 120–200 J biphasic (per your device and protocol).",
        { kind: "sync", lo: 120, hi: 200 }, "Press SYNC, set 120–200 J with ENERGY SELECT, CHARGE, then SHOCK."),
      Q(P("nsr", true, "110/70", false, true), "Converted to sinus rhythm, BP 110/70.", "What should be addressed afterwards?", [
        ["Stroke risk and anticoagulation, plus a 12-lead and the underlying cause", true, "After cardioversion of AF, address stroke risk/anticoagulation and look for the cause."],
        ["Nothing: she's in sinus now", false, "Stroke risk after cardioversion is real.", "What's the risk after converting AF?", "Missed stroke prevention."],
        ["Give adenosine to keep her in sinus", false, "Adenosine doesn't maintain sinus rhythm.", "What does adenosine do?", "A pause."],
        ["Repeat the shock to be sure", false, "She has converted: no further shocks.", "Is there anything to shock?", "An unnecessary shock."]
      ])
    ] },
    { id: "post1", cat: "post", title: "After the pulse comes back", text: "ROSC after 14 minutes of VF arrest. Now what?", steps: postCare(true) },

    /* megacodes: pre-arrest → arrest → post-arrest, at least three rhythms */
    { id: "mega1", cat: "mega", title: "Chest pain to VF", text: "A 59-year-old with crushing chest pain. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("vt", true, "78/44", false), "Wide regular tachycardia at 168, BP 78/44, diaphoretic.", "Stable or unstable, and what do you do?", [
        ["Unstable VT with a pulse: synchronized cardioversion (sedate if time allows)", true, "Unstable monomorphic VT with a pulse: synchronized cardioversion, starting around 100 J."],
        ["Amiodarone 150 mg over 10 minutes and wait", false, "He's hypotensive and diaphoretic: unstable.", "Which signs make this unstable?", "Ten minutes of falling perfusion."],
        ["Unsynchronized shock", false, "There's a pulse: synchronize.", "Is there a pulse?", "The shock lands on the T wave: VF."],
        ["Adenosine 12 mg", false, "Adenosine isn't for unstable wide-complex tachycardia.", "Is this stable?", "Delay."]
      ]),
      D(P("vt", true, "78/44", false), "Pads on, sedation given.", "Synchronized cardioversion: SYNC on, about 100 J.", { kind: "sync", lo: 100, hi: 200, noConvert: true },
        "Press SYNC, set about 100 J, CHARGE, then SHOCK."),
      identifyShockable(P("vf", false, null, false), "Ventricular fibrillation (he became pulseless right after)"),
      shock(P("vf", false, null, false), 1), afterShock(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 2), epiShockable(P("vf", false, null, true)),
      shock(P("vf", false, null, false), 3), antiarrhythmic(P("vf", false, null, true)), rosc(P("nsr", false, null, true)),
      postCare(true)) },
    { id: "mega2", cat: "mega", title: "Slow, then pulseless", text: "A 70-year-old with dizziness and a slow pulse. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("chb", true, "70/40", false), "Heart rate 34, BP 70/40, confused.", "First treatment?", [
        ["Atropine 1 mg IV (repeat every 3–5 minutes, max 3 mg); prepare to pace", true, "Unstable bradycardia: atropine first, and get pacing ready because high-grade block often doesn't respond."],
        ["Adenosine 6 mg", false, "Adenosine slows the heart.", "What does adenosine do to the rate?", "A pause."],
        ["Observe", false, "Hypotension and confusion: unstable.", "Is this stable?", "Deterioration."],
        ["Amiodarone 150 mg", false, "Amiodarone slows the rate.", "Is amiodarone for slow rhythms?", "Further slowing."]
      ]),
      D(P("chb", true, "70/40", false), "Atropine didn't work. Analgesia given.", "Pace at 60–80 ppm and raise the current to capture.", { kind: "pace", rate: [60, 80] },
        "Press PACER, set RATE 60–80, raise CURRENT until each spike is followed by a wide QRS."),
      Q(P("pea", false, null, false), "While pacing, he becomes unresponsive. The pacer is off for the check: an organized rhythm at 64, but no femoral pulse.", "What now?", [
        ["PEA: start CPR, epinephrine 1 mg as soon as possible, and look for the cause", true, "Organized rhythm without a pulse is PEA: CPR, early epinephrine, Hs and Ts. Pacing isn't used in PEA."],
        ["Increase the pacer current", false, "There's no pulse: this is cardiac arrest.", "Is there a pulse?", ARREST_RESULT],
        ["Synchronized cardioversion", false, "Not a tachycardia, and no pulse.", "What is this rhythm without a pulse?", "Delay."],
        ["Atropine 1 mg", false, "Atropine isn't part of the arrest algorithm.", "Is this an arrest?", "No benefit."]
      ]),
      Q(P("pea", false, null, true), "His wife says he takes potassium supplements and missed dialysis this week.", "Most likely reversible cause and treatment?", [
        ["Hyperkalemia: calcium chloride 1 g IV and sodium bicarbonate, continue CPR and epinephrine", true, "Treat suspected hyperkalemia with calcium (and bicarbonate) during the arrest."],
        ["Hypovolemia: 2 L fluid only", false, "The history points to potassium.", "What did his wife tell you?", "The cause goes untreated."],
        ["Tamponade: pericardiocentesis", false, "No signs of tamponade.", "Any trauma or distended neck veins?", "An unnecessary procedure."],
        ["Toxins: naloxone", false, "Nothing suggests opioids.", "Any opioid history?", "No effect."]
      ]),
      rosc(P("nsr", false, null, true)), postCare(false)) },
    { id: "mega3", cat: "mega", title: "Racing heart to flat line", text: "A 68-year-old with palpitations and shortness of breath. Pre-arrest, arrest, and post-arrest care.", steps: [].concat(
      Q(P("af", true, "82/50", false), "Irregular narrow tachycardia at 160, no P waves, BP 82/50.", "What do you do?", [
        ["Unstable atrial fibrillation: synchronized cardioversion (sedate if time allows)", true, "Unstable AF with RVR: synchronized cardioversion at 120–200 J biphasic per device and protocol."],
        ["Diltiazem IV", false, "Hypotension makes rate control risky; she's unstable.", "Is she stable?", "Worse hypotension."],
        ["Adenosine 6 mg", false, "Adenosine doesn't treat AF.", "Is the rhythm regular?", "No effect."],
        ["Unsynchronized shock", false, "Synchronize when there's a pulse.", "Why synchronize?", "VF."]
      ]),
      D(P("af", true, "82/50", false), "Sedation given.", "Synchronized cardioversion: SYNC on, 120–200 J.", { kind: "sync", lo: 120, hi: 200, noConvert: true }, "Press SYNC, set 120–200 J, CHARGE, then SHOCK."),
      identifyShockable(P("vf", false, null, false), "Ventricular fibrillation (she arrested a minute later)"),
      shock(P("vf", false, null, false), 1), afterShock(P("vf", false, null, true)),
      Q(P("asys", false, null, false), "At the next rhythm check the monitor shows a flat line.", "What now?", [
        ["Confirm asystole in a second lead, continue CPR, epinephrine 1 mg as soon as possible, no shock", true, "The rhythm is now non-shockable: switch to the asystole/PEA pathway."],
        ["Shock again at 200 J", false, "Asystole isn't shockable.", "Is a flat line shockable?", "No effect; CPR interrupted."],
        ["Start pacing", false, "Pacing doesn't help asystolic arrest.", "Does pacing work in asystole?", "No capture."],
        ["Give amiodarone 300 mg", false, "Antiarrhythmics are for shockable rhythms.", "Is this shockable?", "No effect."]
      ]),
      airway(P("asys", false, null, true)), rosc(P("nsr", false, null, true)), postCare(false)) }
  ];
  var CATS = [["vf", "VF / pulseless VT", "Shockable cardiac arrest"], ["pea", "Asystole / PEA", "Non-shockable cardiac arrest"], ["brady", "Bradycardia", "Symptomatic bradycardia with a pulse"],
    ["svt", "SVT", "Narrow, regular tachycardia"], ["vt", "VT with a pulse", "Wide-complex tachycardia"], ["af", "Atrial fibrillation", "Irregular tachycardia"],
    ["post", "Post-arrest care", "After ROSC"], ["mega", "Megacode", "Pre-arrest → arrest → post-arrest, three or more rhythms"]];

  /* ------------------------------------------------------------------ screens */
  function listHTML() {
    var done = CASES.filter(function (c) { var r = HOST.load(c.id); return r && r.ok; }).length;
    return '<div class="qhead"><div><div class="eyebrow">Monitor · defibrillator · decisions</div><h2>Code lab</h2></div><div class="qstats"><span>Passed <b class="num">' + done + '</b> of ' + CASES.length + '</span></div></div>' +
      '<p class="sv-lede">Run a code on the live monitor. Pick one algorithm to practice, or a <b>Megacode</b> that walks from pre-arrest through the arrest to post-arrest care. When a choice isn\'t the best one, you\'ll be asked whether you really want to do it, with a prompt to rethink.</p>' +
      CATS.map(function (c) {
        var list = CASES.filter(function (x) { return x.cat === c[0]; });
        return '<section class="cl-cat' + (c[0] === "mega" ? ' mega' : '') + '"><div class="cl-cat-h"><h3>' + H(c[1]) + '</h3><span>' + H(c[2]) + '</span></div><div class="cases">' + list.map(function (x) {
          var r = HOST.load(x.id), badge = r ? '<span class="pill ' + (r.ok ? 'done' : 'part') + '">' + (r.ok ? 'Passed' : 'Review') + ' · ' + r.pct + '%</span>' : '<span class="pill">Not started</span>';
          return '<button class="case cl-case" data-case="' + x.id + '"><span class="no">' + H(c[1]) + '</span><h3>' + H(x.title) + '</h3><span class="focus">' + H(x.text) + '</span><span class="st"><span>' + x.steps.length + ' steps</span>' + badge + '</span></button>';
        }).join("") + '</div></section>';
      }).join("");
  }
  function list() {
    stopDevice(); root.innerHTML = listHTML();
    root.querySelectorAll(".cl-case").forEach(function (b) { b.onclick = function () { start(b.getAttribute("data-case")); window.scrollTo(0, 0); }; });
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
    var mid = cur && cur.phase !== "done" && cur.marks.some(function (m) { return m != null; });
    if (mid && !window.confirm("Exit this case? Your progress on it won't be saved.")) return;
    list(); window.scrollTo(0, 0);
  }

  function start(id) {
    var c = CASES.filter(function (x) { return x.id === id; })[0];
    cur = { c: c, i: 0, marks: [], tries: 0, struck: {}, phase: "ask" };
    root.innerHTML = '<div class="cl-run full"><div class="runner-head"><div><div class="eyebrow">' + H(CATS.filter(function (k) { return k[0] === c.cat; })[0][1]) + ' · Code lab</div><h2>' + H(c.title) + '</h2></div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="steps" id="clSteps"></div><button class="btn cl-exit" id="clBack" type="button" aria-label="Exit this case and return to all cases">✕ Exit case</button></div></div>' +
      '<div class="cl-grid"><div id="clDev"></div><div class="cl-side"><div class="card scenario cl-story"><p>' + H(c.text) + '</p></div><div id="clStep"></div></div></div></div>';
    root.querySelector("#clBack").onclick = exitCase; full();
    var p0 = c.steps[0].p;
    dev = window.DefibLab.embed(root.querySelector("#clDev"), { rhythm: p0.rhythm, pulse: p0.pulse, bp: p0.bp }, { esc: HOST.esc, onDevice: onDevice });
    step();
  }
  function dots() {
    root.querySelector("#clSteps").innerHTML = cur.c.steps.map(function (s, i) {
      var m = cur.marks[i], cls = m == null ? (i === cur.i ? "cur" : "") : (m === 1 ? "r" : (m === 0.5 ? "h" : "w"));
      return '<i class="' + cls + '"></i>'; }).join("");
  }
  function step() {
    clearInterval(timer);
    var s = cur.c.steps[cur.i]; cur.tries = 0; cur.struck = {}; cur.phase = "ask";
    dev.patient(s.p); dev.reset();
    if (s.t === "d") { dev.config({ minJ: s.goal.kind === "sync" && !s.goal.noConvert ? s.goal.lo : 99999, shocksNeeded: 999 }); dev.lock(false); }
    else dev.lock(true, "Answer the question first");
    dots(); render();
    if (s.t === "d" && s.goal.kind === "pace") timer = setInterval(checkPace, 400);
  }
  function render(extra) {
    var s = cur.c.steps[cur.i], box = root.querySelector("#clStep"), h = '<div class="card cl-q">' + (s.say ? '<p class="cl-say">' + H(s.say) + '</p>' : '');
    if (s.t === "q") {
      var letters = "ABCD";
      h += '<h3>' + H(s.q) + '</h3><div class="opt-list" id="clOpts">' + s.opts.map(function (o, i) {
        var dis = cur.phase !== "ask" || cur.struck[i], cls = cur.phase === "done" ? (o[1] ? "is-right" : (i === cur.pick ? "is-wrong" : "is-dim")) : (cur.struck[i] ? "is-struck" : "");
        return '<button class="opt ' + cls + '" data-i="' + i + '"' + (dis ? ' disabled' : '') + '><span class="k">' + letters[i] + '</span><span>' + H(o[0]) + '</span></button>'; }).join("") + '</div>';
    } else {
      h += '<h3>' + H(s.task) + '</h3><p class="cl-dev-hint">Use the device on the left.</p>' + (s.goal.kind === "pace" ? '<ul class="cl-check" id="clPace"></ul>' : '');
      if (cur.phase === "ask" && cur.tries >= 1) h += '<button class="btn btn-ghost" id="clHow">Show me how</button>';
    }
    h += (extra || "") + '</div>';
    box.innerHTML = h;
    var o = box.querySelector("#clOpts"); if (o) o.onclick = function (e) { var b = e.target.closest(".opt"); if (b && !b.disabled) choose(+b.getAttribute("data-i")); };
    var hw = box.querySelector("#clHow"); if (hw) hw.onclick = function () { cur.phase = "done"; mark(0); render(feedback(false, "Here's how: " + s.how, "No points for this step.")); };
    bindNext();
    if (s.t === "d" && s.goal.kind === "pace") checkPace();
  }
  function feedback(ok, why, sub) {
    var last = cur.i === cur.c.steps.length - 1;
    return '<div class="fb ' + (ok ? 'ok' : 'no') + '"><div class="verdict">' + (ok ? 'Correct' : 'Not the best choice') + '</div><p>' + H(why) + '</p>' + (sub ? '<p class="fb-note">' + H(sub) + '</p>' : '') + '</div>' +
      '<div class="qnav"><span></span><button class="btn btn-primary" id="clNext">' + (last ? 'Finish case →' : 'Next →') + '</button></div>';
  }
  function bindNext() { var n = root.querySelector("#clNext"); if (n) n.onclick = function () { if (cur.i < cur.c.steps.length - 1) { cur.i++; step(); root.querySelector(".cl-side").scrollIntoView({ block: "nearest" }); } else finish(); }; }
  function mark(v) { if (cur.marks[cur.i] == null) cur.marks[cur.i] = v; dots(); }

  // a decision: right → done; wrong → "do you really want to do that?" with a prompt; rethink or go ahead
  function choose(i) {
    var s = cur.c.steps[cur.i], o = s.opts[i]; cur.pick = i;
    if (o[1]) { cur.phase = "done"; mark(cur.tries ? 0.5 : 1); render(feedback(true, o[2], cur.tries ? "Half credit: right after rethinking." : "")); return; }
    cur.phase = "confirm";
    render('<div class="cl-confirm" role="alertdialog" aria-labelledby="clCq"><b id="clCq">Do you really want to do that?</b><p>' + H(o[3]) + '</p>' +
      '<div class="cl-confirm-a"><button class="btn btn-primary" id="clRethink">Rethink</button><button class="btn btn-ghost" id="clGo">Yes, do it</button></div></div>');
    root.querySelector("#clRethink").onclick = function () { cur.tries++; cur.struck[i] = 1; cur.phase = "ask"; render(); var f = root.querySelector("#clOpts .opt:not([disabled])"); if (f) f.focus(); };
    root.querySelector("#clGo").onclick = function () {
      cur.phase = "done"; mark(0);
      var right = s.opts.filter(function (x) { return x[1]; })[0];
      render('<div class="cl-result"><b>What happens:</b> ' + H(o[4]) + '</div>' + feedback(false, o[2] + " The best choice: " + right[0] + ". " + right[2]));
    };
  }

  // device tasks
  function onDevice(type, d) {
    if (!cur || cur.phase !== "ask") return;
    var s = cur.c.steps[cur.i]; if (s.t !== "d") return;
    var g = s.goal;
    if (type === "nosync" && g.kind === "shock") return coach("SYNC is on, so the device is waiting for a QRS that VF will never give it. Turn SYNC off for VF and pulseless VT, then shock.");
    if (type !== "shock") return;
    if (g.kind === "shock") {
      if (d.sync) return coach("That was a synchronized shock. VF and pulseless VT need an unsynchronized shock.");
      if (d.J < g.minJ) return coach(d.J + " J is below the adult defibrillation dose. Use 120–200 J biphasic (your device's recommended dose, or the maximum if unknown). Charge again.");
      return success("Shock delivered at " + d.J + " J. Now resume compressions immediately.");
    }
    if (g.kind === "sync") {
      if (!d.sync && d.before.perfusing) {
        dev.message("UNSYNCHRONIZED SHOCK: VF", "warn");
        return coach("Do you really want to do that? An unsynchronized shock on a rhythm with a pulse can land on the T wave and cause VF, which is what just happened. For practice, the patient is rewound: press SYNC first.", true);
      }
      if (d.J < g.lo) return coach(d.J + " J is below the recommended starting energy here (" + g.lo + "–" + g.hi + " J). Charge again at the right energy.");
      return success("Synchronized cardioversion at " + d.J + " J." + (d.J > g.hi ? " It worked, but start at " + g.lo + "–" + g.hi + " J next time and escalate only if needed." : ""), d.J > g.hi);
    }
  }
  function checkPace() {
    var s = cur.c.steps[cur.i]; if (!s || s.t !== "d" || s.goal.kind !== "pace" || cur.phase !== "ask") return;
    var st = dev.state(), p = st.pacer, r = s.goal.rate, okRate = p.on && p.rate >= r[0] && p.rate <= r[1];
    var ul = root.querySelector("#clPace");
    if (ul) ul.innerHTML = [[p.on, "Pacer on"], [okRate, "Rate " + r[0] + "–" + r[1] + " ppm (now " + p.rate + ")"], [st.captured, "Capture: a wide QRS after every spike" + (p.on ? " (" + p.mA + " mA)" : "")]]
      .map(function (x) { return '<li class="' + (x[0] ? 'ok' : '') + '">' + (x[0] ? '✓ ' : '○ ') + H(x[1]) + '</li>'; }).join("");
    if (p.on && okRate && st.captured) { clearInterval(timer); success("Capture at " + p.mA + " mA, rate " + p.rate + " ppm. Set the current a little above the threshold and confirm a femoral pulse."); }
  }
  function coach(text, rewind) {
    cur.tries++;
    var s = cur.c.steps[cur.i];
    if (rewind) setTimeout(function () { if (cur && cur.c.steps[cur.i] === s) { dev.patient(s.p); dev.reset(); } }, 2500);
    render('<div class="cl-confirm"><b>Not quite yet</b><p>' + H(text) + '</p></div>');
  }
  function success(text, half) {
    cur.phase = "done"; mark(cur.tries || half ? 0.5 : 1); dev.lock(true, "Press Next to continue");
    render(feedback(true, text, cur.tries ? "Half credit: it took " + (cur.tries + 1) + " tries." : ""));
  }

  function finish() {
    stopDevice();
    var c = cur.c, pts = cur.marks.reduce(function (a, b) { return a + (b || 0); }, 0), max = c.steps.length, pc = Math.round(100 * pts / max), ok = pc >= 80;
    HOST.save(c.id, { ok: ok, pct: pc, p2: Math.round(pts * 2), m2: max * 2, at: Date.now() });
    var rows = c.steps.map(function (s, i) {
      var m = cur.marks[i], best = s.t === "q" ? s.opts.filter(function (o) { return o[1]; })[0][0] : s.task;
      return '<li class="' + (m === 1 ? 'ok' : (m === 0.5 ? 'half' : 'bad')) + '"><span class="cl-m">' + (m === 1 ? '✓' : (m === 0.5 ? '½' : '✗')) + '</span><div><b>' + H(s.t === "q" ? s.q : "Device: " + s.task) + '</b><p>' + H(best) + '</p></div></li>'; }).join("");
    root.innerHTML = '<div class="card cl-sum ' + (ok ? 'pass' : 'fail') + '"><div class="verdict">' + (ok ? 'Case passed' : 'Case needs review') + '</div><h2>' + H(c.title) + ' · ' + pc + '%</h2>' +
      '<p>' + (Math.round(pts * 10) / 10) + ' of ' + max + ' points. Full credit for a right first choice, half credit after rethinking or a second try.</p><ol class="cl-list">' + rows + '</ol>' +
      '<div class="qnav" style="justify-content:flex-start"><button class="btn btn-primary" id="clAgain">Run it again</button><button class="btn btn-ghost" id="clAll">All cases</button></div>' +
      '<p class="empty">Based on the current AHA adult advanced life support algorithms. Always follow your local protocols and medical direction.</p></div>';
    root.querySelector("#clAgain").onclick = function () { start(c.id); };
    root.querySelector("#clAll").onclick = list;
    window.scrollTo(0, 0);
  }

  window.CodeLab = {
    cases: CASES, cats: CATS,
    render: function (container, host) { HOST = host; root = container; list(); },
    stop: stopDevice
  };
})();
