# 20 ACLS megacode cases. Each option: (text, correct?, rationale shown after answering).
Y, N = True, False

ROSC_CARE = ("Titrate O₂ to SpO₂ 92–98%, keep SBP ≥ 90 / MAP ≥ 65, ventilate ~10/min to ETCO₂ 35–45, get a 12-lead", Y,
             "These are the core post-ROSC targets: avoid hypoxia and hyperoxia, avoid hypotension, keep CO₂ normal and look for a coronary cause.")
HYPERVENT = ("Hyperventilate at 30 breaths/min to protect the brain", N,
             "Hyperventilation lowers CO₂, which constricts cerebral vessels and raises intrathoracic pressure. Aim for about 10 breaths/min.")
EXTRA_EPI = ("Give another epinephrine 1 mg IV push", N,
             "Arrest-dose epinephrine is for a patient without a pulse. After ROSC, hypotension is treated with fluids and a titrated vasopressor infusion.")

def shock_first(extra=""):
    return [
        ("Deliver an unsynchronized shock (biphasic 120–200 J or device default), then resume CPR immediately" + extra, Y,
         "VF and pulseless VT are shockable. Early defibrillation is the single most important intervention, and CPR restarts right after the shock without a pulse check."),
        ("Give epinephrine 1 mg first, then shock", N,
         "In a shockable rhythm the shock comes first. Epinephrine is given after initial defibrillation attempts have failed."),
        ("Synchronized cardioversion at 100 J", N,
         "There are no organized QRS complexes to synchronize to, so the device may never fire. Pulseless VF/VT gets an unsynchronized shock."),
        ("Stop CPR for a 10-second pulse check, then decide", N,
         "The monitor already shows a shockable rhythm in a pulseless patient. Extra pauses lower survival, so shock now."),
    ]

CASES = [
 {"title": "Collapse at the gym", "focus": "VF/pVT algorithm",
  "scenario": "A 54-year-old man collapses on a treadmill. Bystanders started CPR; your crew arrives 4 minutes later and places pads.",
  "stages": [
   {"strip": "vf", "vitals": "Pulse: none · Breathing: none", "prompt": "First rhythm analysis. What do you do?", "options": shock_first()},
   {"strip": "vf", "vitals": "Pulse: none · IV access obtained · 2 min after shock 1", "prompt": "Rhythm check after 2 minutes of CPR. What now?", "options": [
     ("Shock, resume CPR, give epinephrine 1 mg IV", Y, "After the second shock, give epinephrine 1 mg every 3–5 minutes while CPR continues."),
     ("Give amiodarone 300 mg, then shock", N, "The antiarrhythmic comes after the third shock in the usual sequence, and no drug should delay a shock."),
     ("Atropine 1 mg IV", N, "Atropine has no role in cardiac arrest. It was removed from the arrest algorithm."),
     ("Pause compressions to intubate", N, "An advanced airway is placed without stopping compressions. BVM is adequate while you defibrillate.")]},
   {"strip": "vf", "vitals": "Pulse: none · Epinephrine given 2 min ago", "prompt": "Still VF at the next rhythm check. What now?", "options": [
     ("Shock, resume CPR, give amiodarone 300 mg IV/IO", Y, "This is shock-refractory VF. Amiodarone 300 mg (or lidocaine 1–1.5 mg/kg) follows the third shock."),
     ("Magnesium sulfate 2 g", N, "Magnesium is for torsades de pointes, not routine VF."),
     ("Lidocaine 3 mg/kg bolus", N, "That is the maximum total dose, not a bolus. The first lidocaine dose is 1–1.5 mg/kg."),
     ("Stop resuscitation: VF after three shocks is futile", N, "Refractory VF can still be converted. Keep following the algorithm and reassess.")]},
   {"strip": "nsr", "vitals": "Pulse: present · BP 84/50 · SpO₂ 100% on 15 L · ETCO₂ jumped to 42", "prompt": "Organized rhythm with a pulse. What is your priority?", "options": [
     ROSC_CARE, HYPERVENT, ("Give a 150 mg amiodarone bolus now", N, "A repeat bolus isn't indicated once ROSC is achieved. Consider a maintenance infusion per protocol."), EXTRA_EPI]},
  ]},
 {"title": "Found down at home", "focus": "Asystole, fine VF, termination",
  "scenario": "A 78-year-old woman is found unresponsive by her son, last seen well 30 minutes ago. No bystander CPR.",
  "stages": [
   {"strip": "asystole", "vitals": "Pulse: none · Breathing: none", "prompt": "The monitor shows this. What do you do?", "options": [
     ("Confirm in a second lead and check leads and gain, continue CPR, give epinephrine 1 mg ASAP", Y, "Asystole is not shockable. Confirm it isn't fine VF or a disconnected lead, and give epinephrine as early as possible in nonshockable rhythms."),
     ("Defibrillate at maximum energy", N, "Shocking asystole doesn't help and costs compression time."),
     ("Start transcutaneous pacing", N, "Pacing is not recommended in asystolic cardiac arrest."),
     ("Atropine 1 mg every 3–5 minutes", N, "Atropine is no longer part of the cardiac arrest algorithm.")]},
   {"strip": "asystole", "vitals": "Pulse: none · 4 min into resuscitation", "prompt": "Still asystole. Which actions are correct?", "options": [
     ("Continue CPR, epinephrine every 3–5 min, place an advanced airway with waveform capnography, review the H's and T's", Y, "Good CPR, epinephrine, airway and capnography, plus an active search for reversible causes."),
     ("Routine sodium bicarbonate 1 mEq/kg", N, "Bicarbonate is not routine. Reserve it for hyperkalemia or tricyclic overdose."),
     ("Amiodarone 300 mg", N, "Antiarrhythmics are for shockable rhythms."),
     ("Hold CPR for 30 seconds to watch the rhythm", N, "Rhythm checks should take under 10 seconds.")]},
   {"strip": "vf_fine", "vitals": "Pulse: none · Rhythm check at 8 min", "prompt": "The rhythm now looks like this. What do you do?", "options": [
     ("Shock: this is fine VF, which is shockable", Y, "Low-amplitude chaotic waves are fine VF, not asystole. Defibrillate and resume CPR."),
     ("Treat as asystole and don't shock", N, "Asystole is nearly flat. This strip has chaotic electrical activity."),
     ("It's an organized rhythm, so check a pulse", N, "There are no organized complexes here."),
     ("Begin transcutaneous pacing", N, "Pacing has no role in VF.")]},
   {"strip": "asystole", "vitals": "30 min of ALS · 3 shocks given earlier · ETCO₂ 7 mmHg · no ROSC", "prompt": "What is the most appropriate next step?", "options": [
     ("Contact medical direction to consider termination, weighing all factors", Y, "Prolonged arrest with no ROSC and persistently low ETCO₂ suggests futility. Decide with medical direction and your TOR rule."),
     ("Stop immediately because ETCO₂ is below 10", N, "ETCO₂ should never be used alone to stop resuscitation."),
     ("Give high-dose epinephrine 5 mg", N, "High-dose epinephrine doesn't improve outcomes."),
     ("Begin transcutaneous pacing", N, "Pacing is not recommended for asystolic arrest.")]},
  ]},
 {"title": "Hard to bag", "focus": "PEA and tension pneumothorax",
  "scenario": "A 66-year-old with severe COPD was intubated by your crew 5 minutes ago. Bagging became very difficult, then the patient lost the pulse. Waveform capnography still shows a trace.",
  "stages": [
   {"strip": "pea_fast", "vitals": "Pulse: none · ETCO₂ 12", "prompt": "Narrow organized rhythm, no pulse. What do you do?", "options": [
     ("Start CPR; this is PEA, so give epinephrine 1 mg ASAP", Y, "An organized rhythm without a pulse is PEA. Start CPR and give epinephrine early, then find the cause."),
     ("Synchronized cardioversion: it's sinus tachycardia", N, "Never cardiovert a pulseless patient, and sinus tachycardia is never cardioverted."),
     ("Defibrillate: it's a narrow-complex tachycardia", N, "PEA is not shockable."),
     ("Adenosine 6 mg rapid push", N, "Adenosine is for stable regular narrow tachycardia with a pulse.")]},
   {"strip": "pea_fast", "vitals": "Absent breath sounds right · trachea shifted left · high bag resistance", "prompt": "What is the most likely cause and fix?", "options": [
     ("Tension pneumothorax: needle (or finger) decompression of the right chest", Y, "High airway pressure, unilateral absent sounds and PEA in a ventilated COPD patient point to tension pneumothorax. Decompress now."),
     ("Increase the bagging rate to 30/min", N, "More breaths worsen air trapping and tension."),
     ("Calcium chloride 1 g", N, "There is nothing here to suggest hyperkalemia."),
     ("Pull the tube and reintubate", N, "Capnography shows the tube is in the trachea. Fix the chest.")]},
   {"strip": "stach", "vitals": "Pulse: present · BP 92/60 · SpO₂ 91%", "prompt": "After decompression a pulse returns. Next?", "options": [
     ("Post-ROSC care: gentle ventilation, watch for re-tension, transport", Y, "Ventilate slowly to avoid air trapping, reassess for reaccumulation and support perfusion."),
     ("Continue compressions for the full 2 minutes", N, "With a palpable pulse and BP, stop compressions."),
     EXTRA_EPI, HYPERVENT]},
  ]},
 {"title": "The slow heart", "focus": "Complete heart block and pacing",
  "scenario": "An 82-year-old man is dizzy, pale and confused. BP 72/40.",
  "stages": [
   {"strip": "chb", "vitals": "HR 34 · BP 72/40 · confused", "prompt": "What is the best immediate treatment?", "options": [
     ("Pads on and transcutaneous pacing now; atropine may be tried but must not delay pacing", Y, "Unstable complete block with a wide escape is unlikely to respond to atropine. Pace now."),
     ("Amiodarone 150 mg", N, "Antiarrhythmics can suppress the ventricular escape and cause asystole."),
     ("Adenosine 6 mg", N, "Adenosine slows AV conduction, which is the opposite of what's needed."),
     ("Observe: his rate is adequate", N, "He is hypotensive and confused, so this bradycardia is unstable.")]},
   {"strip": "tcp_no", "vitals": "Pacing 70/min at 50 mA · BP 70/40", "prompt": "What does the monitor show, and what's next?", "options": [
     ("No capture yet: increase the mA until every spike is followed by a wide QRS", Y, "The pacing artifacts aren't followed by QRS complexes. Raise the output to the capture threshold."),
     ("Capture achieved: continue", N, "There is no wide QRS and T after each spike."),
     ("Switch to defibrillation", N, "The patient has a pulse and no shockable rhythm."),
     ("Lower the rate to 40/min", N, "The rate isn't the problem; output is.")]},
   {"strip": "tcp_cap", "vitals": "Pacing 80/min at 85 mA", "prompt": "Every spike is now followed by a wide QRS. What next?", "options": [
     ("Confirm mechanical capture with a femoral pulse and BP", Y, "Electrical capture doesn't guarantee perfusion. A femoral pulse at the paced rate confirms mechanical capture."),
     ("Confirm with a carotid pulse", N, "Pacing makes the neck muscles twitch, which can mimic a carotid pulse."),
     ("Stop pacing: capture proves he's fixed", N, "He depends on the pacer; stopping returns him to complete block."),
     ("Give atropine now", N, "Not needed once effective pacing is established.")]},
   {"strip": "tcp_cap", "vitals": "Femoral pulse 80 · BP 104/62 · grimacing", "prompt": "Patient is perfusing but in pain. What now?", "options": [
     ("Analgesia or sedation per protocol, and transport to a center that can place a transvenous pacer", Y, "TCP is painful. Treat it, then arrange definitive pacing."),
     ("Turn the mA below threshold to stop the pain", N, "Losing capture returns him to unstable bradycardia."),
     ("Adenosine 6 mg", N, "Adenosine has no role here."),
     ("Remove pads for comfort", N, "The pads are delivering therapy.")]},
  ]},
 {"title": "Palpitations and chest pain", "focus": "Unstable VT to pulseless VT",
  "scenario": "A 61-year-old with prior MI has sudden palpitations and chest pain. Diaphoretic.",
  "stages": [
   {"strip": "vt", "vitals": "Pulse present · BP 70/40 · chest pain", "prompt": "Wide regular tachycardia with a pulse and signs of shock. Treatment?", "options": [
     ("Synchronized cardioversion at 100 J (sedate if time allows)", Y, "Unstable monomorphic VT with a pulse gets synchronized cardioversion."),
     ("Unsynchronized defibrillation 200 J", N, "With a pulse and a regular monomorphic rhythm, synchronize so the shock doesn't land on the T wave."),
     ("Adenosine 6 mg", N, "This patient is unstable, and electricity comes first."),
     ("Diltiazem 20 mg", N, "Calcium channel blockers can cause collapse in VT.")]},
   {"strip": "vt", "vitals": "Pulse: none · unresponsive", "prompt": "Before the shock, he becomes pulseless. Now?", "options": [
     ("Defibrillate (unsynchronized) and start CPR", Y, "Pulseless VT is treated like VF: an unsynchronized shock, then CPR."),
     ("Keep the sync mode on and shock at 100 J", N, "Sync can delay or prevent the shock. Turn sync off for pulseless VT."),
     ("Amiodarone first, then shock", N, "Never delay defibrillation for drugs."),
     ("30-second pulse check", N, "Too long. Start compressions and shock.")]},
   {"strip": "nsr", "vitals": "Pulse present · BP 98/60 · after 1 shock", "prompt": "Pulse returns. What now?", "options": [
     ("Post-ROSC care, 12-lead ECG, consider an antiarrhythmic infusion per protocol, transport to a PCI center", Y, "Stabilize, look for ischemia, and prevent recurrence."),
     ("Resume CPR for 2 minutes", N, "A pulse is present."),
     ("Lidocaine 3 mg/kg bolus", N, "That is the maximum total dose, not a bolus."), EXTRA_EPI]},
  ]},
 {"title": "Methadone and a long QT", "focus": "Torsades de pointes",
  "scenario": "A 45-year-old on high-dose methadone collapses in the clinic waiting room.",
  "stages": [
   {"strip": "torsades", "vitals": "Pulse: none", "prompt": "What do you do?", "options": [
     ("Defibrillate (unsynchronized), resume CPR", Y, "Pulseless polymorphic VT is shockable with an unsynchronized shock."),
     ("Synchronized cardioversion", N, "Polymorphic complexes can't be reliably synchronized."),
     ("Magnesium only, no shock", N, "Magnesium is added to defibrillation, not given instead of it."),
     ("Treat as asystole", N, "This is a shockable rhythm.")]},
   {"strip": "torsades", "vitals": "Pulse: none · after 1 shock", "prompt": "Recurs at the next check. Add which drug?", "options": [
     ("Magnesium sulfate 1–2 g IV/IO, with shocks and epinephrine per the algorithm", Y, "Magnesium is the specific therapy for torsades."),
     ("Amiodarone 300 mg as the specific therapy", N, "Amiodarone prolongs the QT. Magnesium is preferred for torsades."),
     ("Calcium chloride 1 g", N, "Not indicated unless there is hyperkalemia or a CCB overdose."),
     ("Procainamide", N, "Procainamide prolongs the QT and can worsen torsades.")]},
   {"strip": "nsr", "vitals": "Pulse present · BP 104/68", "prompt": "ROSC. What's important now?", "options": [
     ("Post-ROSC care, keep pads on, avoid QT-prolonging drugs, consider K⁺/Mg²⁺ problems", Y, "Recurrence is common. Remove the trigger and correct electrolytes."),
     ("Give ondansetron for nausea", N, "Ondansetron prolongs the QT."), HYPERVENT, EXTRA_EPI]},
  ]},
 {"title": "Pinpoint pupils", "focus": "Opioid-associated emergency",
  "scenario": "A 22-year-old is found unresponsive in a washroom. Pinpoint pupils, needle nearby.",
  "stages": [
   {"strip": "brady", "vitals": "Pulse present · RR 4 · SpO₂ 78%", "prompt": "What is the priority?", "options": [
     ("Ventilate with BVM and give naloxone", Y, "Respiratory arrest with a pulse: support breathing and reverse the opioid. The bradycardia is from hypoxia."),
     ("Start chest compressions", N, "She has a pulse."),
     ("Atropine for the bradycardia", N, "Hypoxic bradycardia responds to oxygenation and ventilation."),
     ("Transcutaneous pacing", N, "Fix the hypoxia first.")]},
   {"strip": "idio", "vitals": "Pulse: none", "prompt": "Before naloxone takes effect, she loses her pulse. Now?", "options": [
     ("CPR with ventilation and epinephrine ASAP; naloxone is reasonable but must not delay CPR", Y, "In opioid-associated arrest, standard ACLS comes first."),
     ("Give more naloxone and wait", N, "Naloxone alone won't restart a pulseless heart."),
     ("Defibrillate", N, "This is PEA, which is not shockable."),
     ("Pace", N, "Pacing is not indicated in PEA.")]},
   {"strip": "stach", "vitals": "Pulse present · BP 110/70 · RR 6", "prompt": "Pulse back, breathing slowly. Next?", "options": [
     ("Continue ventilatory support, titrate O₂, monitor for re-sedation, transport", Y, "Naloxone can wear off before the opioid does, so watch closely."),
     ("Stop ventilating because ROSC is achieved", N, "An RR of 6 is inadequate."),
     ("Flumazenil", N, "Flumazenil isn't indicated and can cause seizures."), HYPERVENT]},
  ]},
 {"title": "Missed dialysis", "focus": "Hyperkalemia",
  "scenario": "A 58-year-old dialysis patient has missed three sessions and is weak.",
  "stages": [
   {"strip": "idio", "vitals": "HR 34 · BP 80/50 · wide QRS", "prompt": "Wide, slow rhythm in a dialysis patient. Best first drug?", "options": [
     ("Calcium chloride 1 g IV, pads on, pace if needed", Y, "Calcium stabilizes the myocardium in hyperkalemia within minutes."),
     ("Amiodarone 150 mg", N, "This could suppress the escape rhythm."),
     ("Fluid bolus 2 L", N, "A dialysis patient can't clear that volume, and it doesn't treat K⁺."),
     ("Adenosine", N, "Not indicated.")]},
   {"strip": "agonal", "vitals": "Pulse: none", "prompt": "She arrests. What's the treatment?", "options": [
     ("CPR, epinephrine, and calcium chloride 1 g with sodium bicarbonate for suspected hyperkalemia", Y, "This is the targeted treatment for the likely cause."),
     ("Defibrillate", N, "This is PEA, which is not shockable."),
     ("Lidocaine 1.5 mg/kg", N, "Lidocaine is for shockable rhythms only."),
     ("CPR only, no drugs", N, "Epinephrine and calcium are indicated.")]},
   {"strip": "vf", "vitals": "Pulse: none · rhythm check", "prompt": "The rhythm changes. What now?", "options": shock_first()},
   {"strip": "nsr", "vitals": "Pulse present · BP 96/60", "prompt": "ROSC. Disposition?", "options": [
     ("Post-ROSC care and transport to a facility capable of emergent dialysis", Y, "Definitive K⁺ removal is needed."),
     EXTRA_EPI, HYPERVENT, ("Give potassium chloride", N, "This would worsen hyperkalemia.")]},
  ]},
 {"title": "The rhythm that won't break", "focus": "Refractory VF",
  "scenario": "A 50-year-old in VF has had 4 shocks, epinephrine ×2 and amiodarone 300 mg.",
  "stages": [
   {"strip": "vf", "vitals": "Pulse: none · 5th rhythm check", "prompt": "VF persists. Best next steps?", "options": [
     ("Check pads, consider a vector change (anterior–posterior) or DSED per protocol, and give amiodarone 150 mg", Y, "These are the options for refractory VF."),
     ("Stop: VF is refractory", N, "Refractory VF still converts with persistence."),
     ("Synchronized cardioversion", N, "Sync doesn't work on VF."),
     ("A second amiodarone 300 mg", N, "The second dose is 150 mg.")]},
   {"strip": "vf", "vitals": "ETCO₂ 8 · same compressor for 6 min", "prompt": "What does the ETCO₂ suggest?", "options": [
     ("CPR quality is poor: swap compressors every 2 min and push harder and faster", Y, "An ETCO₂ below 10 means poor compressions."),
     ("The tube is misplaced: extubate", N, "There is still a waveform. Fix compressions first."),
     ("ROSC", N, "ROSC would cause a sudden rise in ETCO₂."),
     ("Give bicarbonate", N, "Not indicated.")]},
   {"strip": "nsr", "vitals": "Pulse present · 12-lead: anterior STEMI", "prompt": "ROSC with STEMI. Destination?", "options": [
     ("PCI-capable center with a pre-alert", Y, "Coronary occlusion is the likely cause and needs emergent reperfusion."),
     ("The nearest hospital, regardless of capability", N, "Bypass to PCI where your system allows."),
     ("Nitroglycerin 0.4 mg SL", N, "He is post-arrest and his BP is unknown or soft."), HYPERVENT]},
  ]},
 {"title": "34 weeks pregnant", "focus": "Arrest in pregnancy",
  "scenario": "A 31-year-old at 34 weeks gestation collapses at home.",
  "stages": [
   {"strip": "vf", "vitals": "Pulse: none", "prompt": "VF on the monitor. What do you do?", "options": [
     ("Shock: defibrillation is the same as in a non-pregnant adult", Y, "Defibrillation is safe for the fetus and uses standard energy."),
     ("Don't shock because of the fetus", N, "Maternal survival is the priority, and shocks are safe."),
     ("Use half the usual energy", N, "Use standard energy."),
     ("Remove the fetal monitor first", N, "Don't delay the shock.")]},
   {"strip": "vf", "vitals": "CPR in progress", "prompt": "What positioning helps CPR?", "options": [
     ("Manual left uterine displacement during compressions", Y, "This relieves aortocaval compression while keeping the patient flat for effective compressions."),
     ("Tilt her 30° on a wedge", N, "Tilting reduces compression quality. Manual displacement is preferred."),
     ("Trendelenburg", N, "It doesn't help and worsens ventilation."),
     ("No change is needed", N, "Aortocaval compression reduces venous return.")]},
   {"strip": "asystole", "vitals": "No ROSC at ~4 min", "prompt": "Next priority?", "options": [
     ("Continue high-quality CPR, alert obstetrics for resuscitative delivery, rapid transport per protocol", Y, "Delivery within about 5 minutes can improve maternal and fetal outcomes."),
     ("Stop: asystole in pregnancy is fatal", N, "Continue and transport."),
     ("Pace", N, "Not recommended in asystole."),
     ("Atropine", N, "No role in arrest.")]},
  ]},
 {"title": "The failing pacemaker", "focus": "Pacemaker malfunction",
  "scenario": "A 79-year-old with a pacemaker for complete heart block is presyncopal.",
  "stages": [
   {"strip": "ftc", "vitals": "HR 30 · BP 78/40", "prompt": "Interpret and treat.", "options": [
     ("Failure to capture: pads on and transcutaneous pacing", Y, "Spikes without a QRS mean the device isn't capturing. Support with TCP."),
     ("Normal pacing: observe", N, "Several spikes have no QRS after them."),
     ("Amiodarone", N, "Not indicated and could worsen the bradycardia."),
     ("Adenosine", N, "Not indicated.")]},
   {"strip": "ftc_asys", "vitals": "Pulse: none", "prompt": "He becomes unresponsive. What is this?", "options": [
     ("Arrest (spikes without capture): start CPR and give epinephrine; pads ≥ 8 cm from the device", Y, "Spikes without a QRS produce no cardiac output. Treat as asystole."),
     ("The heart is beating because spikes are present: check BP", N, "Spikes are only pacemaker output, not cardiac activity."),
     ("Defibrillate", N, "This is not a shockable rhythm."),
     ("TCP as the primary arrest therapy", N, "Not recommended for asystolic arrest.")]},
   {"strip": "vf", "vitals": "Pulse: none · rhythm check", "prompt": "The rhythm changes. Action?", "options": shock_first(", with pads at least 8 cm from the device")},
   {"strip": "vpaced", "vitals": "Pulse present · BP 100/60", "prompt": "Paced rhythm with a pulse. Next?", "options": [
     ("Post-ROSC care; device interrogation at hospital", Y, "The device needs checking after malfunction and a shock."),
     EXTRA_EPI, ("Treat the wide QRS as VT", N, "These are paced beats, not VT."), HYPERVENT]},
  ]},
 {"title": "Read it in the pause", "focus": "CPR artifact and shock sequence",
  "scenario": "Your partner is doing compressions on a 63-year-old. The monitor trace looks fast and regular.",
  "stages": [
   {"strip": "cpr", "vitals": "Compressions ongoing", "prompt": "Your partner says: 'Looks like VT.' Response?", "options": [
     ("That's CPR artifact: analyze at the 2-minute check with a pause under 10 s", Y, "Compressions create a regular artifact at the compression rate."),
     ("Shock now", N, "You can't confirm a shockable rhythm during compressions."),
     ("Stop CPR for 30 seconds to analyze", N, "Keep pauses under 10 seconds."),
     ("Amiodarone", N, "No rhythm has been confirmed.")]},
   {"strip": "vf", "vitals": "Pulse: none · rhythm check", "prompt": "At the pause, you see this.", "options": shock_first()},
   {"strip": "vf", "vitals": "Immediately after the shock", "prompt": "Right after the shock the trace still looks chaotic. What now?", "options": [
     ("Resume CPR immediately for 2 min; don't check the rhythm right after the shock", Y, "The heart is often stunned right after a shock. Compressions restore perfusion."),
     ("Shock again immediately (stacked shocks)", N, "Use single shocks with CPR in between."),
     ("Pulse check for 10 s", N, "This delays compressions."),
     ("Analyze for 30 s", N, "This is too long a pause.")]},
  ]},
 {"title": "Anterior STEMI and a dropped beat", "focus": "Mobitz II to VF",
  "scenario": "A 70-year-old with an anterior STEMI is hypotensive.",
  "stages": [
   {"strip": "mobitz2", "vitals": "HR 46 · BP 82/50", "prompt": "Interpret and treat.", "options": [
     ("Mobitz II: pads on and start TCP; atropine is unlikely to help", Y, "This is an infranodal block with a risk of sudden complete block. Pace."),
     ("Nitroglycerin", N, "Contraindicated with hypotension."),
     ("Wenckebach: observe", N, "The PR is constant before the dropped beat, so this is Mobitz II."),
     ("Amiodarone", N, "Not indicated.")]},
   {"strip": "vf", "vitals": "Pulse: none", "prompt": "He arrests.", "options": shock_first()},
   {"strip": "nsr", "vitals": "Pulse present · BP 90/56", "prompt": "ROSC. Destination?", "options": [
     ("PCI center with a STEMI pre-alert; post-ROSC care", Y, "He needs emergent reperfusion."),
     HYPERVENT, EXTRA_EPI, ("The closest non-PCI hospital", N, "Bypass to PCI per system design.")]},
  ]},
 {"title": "Inferior MI and grouped beats", "focus": "Wenckebach and atropine",
  "scenario": "A 64-year-old with an inferior STEMI is lightheaded.",
  "stages": [
   {"strip": "wenck", "vitals": "HR 48 · BP 86/58", "prompt": "Interpret and treat.", "options": [
     ("Wenckebach: atropine 1 mg IV (repeat q3–5 min, max 3 mg), pads on", Y, "A symptomatic nodal block usually responds to atropine."),
     ("Nitroglycerin SL", N, "He is hypotensive, with possible RV involvement."),
     ("Adenosine", N, "This would worsen the block."),
     ("Synchronized cardioversion", N, "Not a tachyarrhythmia.")]},
   {"strip": "avb1", "vitals": "HR 72 · BP 112/70 after atropine", "prompt": "Improved. Next?", "options": [
     ("Monitor, STEMI pre-alert, transport to PCI", Y, "Treat the underlying MI."),
     ("Repeat atropine to 3 mg anyway", N, "He has already responded."),
     ("Amiodarone", N, "Not indicated."),
     ("Stop monitoring", N, "He may progress to higher-grade block.")]},
   {"strip": "chb_n", "vitals": "HR 44 · BP 100/64 · alert", "prompt": "En route the rhythm changes.", "options": [
     ("Complete heart block with junctional escape: pads on, atropine may be tried, pace if unstable", Y, "Narrow escape complete block in an inferior MI often responds to atropine."),
     ("Defibrillate", N, "He has a pulse and a non-shockable rhythm."),
     ("Adenosine", N, "Not indicated."),
     ("Lidocaine", N, "Could suppress the escape rhythm.")]},
  ]},
 {"title": "After the clot buster", "focus": "AIVR and reperfusion",
  "scenario": "A rural STEMI patient received fibrinolytics 30 minutes ago and is being transferred.",
  "stages": [
   {"strip": "aivr", "vitals": "HR 66 · BP 110/70 · alert", "prompt": "Wide rhythm at 66. Action?", "options": [
     ("Monitor: this is AIVR, a reperfusion rhythm; no antiarrhythmics", Y, "AIVR is usually benign and transient after reperfusion."),
     ("Lidocaine bolus to suppress it", N, "Suppressing it can leave no rhythm at all."),
     ("Synchronized cardioversion", N, "He is stable and the rate is not fast."),
     ("Defibrillate", N, "He has a pulse.")]},
   {"strip": "vt_vf", "vitals": "Suddenly unresponsive", "prompt": "The rhythm changes during the strip.", "options": shock_first()},
   {"strip": "nsr", "vitals": "Pulse present · BP 102/64", "prompt": "ROSC. Next?", "options": [ROSC_CARE, HYPERVENT, EXTRA_EPI,
     ("Give a second dose of fibrinolytic", N, "Not indicated. Continue to the PCI center.")]},
  ]},
 {"title": "After ROSC", "focus": "Post-cardiac arrest care",
  "scenario": "A 57-year-old regains a pulse after 2 shocks for VF.",
  "stages": [
   {"strip": "vf", "vitals": "Pulse: none", "prompt": "Initial rhythm.", "options": shock_first()},
   {"strip": "stach", "vitals": "SpO₂ 100% on 15 L · BP 76/40 · ETCO₂ 28", "prompt": "Pulse present. Your first adjustments?", "options": [
     ("Titrate O₂ to SpO₂ 92–98%, fluid bolus and vasopressor infusion to SBP ≥ 90 / MAP ≥ 65", Y, "Avoid hyperoxia and treat hypotension."),
     ("Keep SpO₂ at 100%", N, "Hyperoxia may worsen brain injury."), EXTRA_EPI,
     ("Nitroglycerin", N, "She is hypotensive.")]},
   {"strip": "stach", "vitals": "ETCO₂ 28 · bagging at ~24/min", "prompt": "Why is the ETCO₂ low?", "options": [
     ("Over-ventilation: slow to ~10/min, target ETCO₂ 35–45", Y, "Hypocapnia reduces cerebral blood flow."),
     ("Tube misplaced", N, "A misplaced tube would show no waveform."),
     ("Re-arrest", N, "She still has a pulse."),
     ("Bag faster", N, "That lowers CO₂ further.")]},
   {"strip": "nsr", "vitals": "GCS 6 · glucose 3.0 mmol/L (54 mg/dL)", "prompt": "Other priorities?", "options": [
     ("Treat hypoglycemia, prevent fever, transport to a cardiac arrest center", Y, "These are part of the post-ROSC bundle."),
     ("Ignore the glucose", N, "Hypoglycemia worsens brain injury."),
     ("Active warming to 38 °C", N, "Prevent fever; don't induce hyperthermia."), HYPERVENT]},
  ]},
 {"title": "Day five after hip surgery", "focus": "PEA and pulmonary embolism",
  "scenario": "A 72-year-old, 5 days after hip replacement, collapses while walking to the bathroom.",
  "stages": [
   {"strip": "pea_fast", "vitals": "Pulse: none", "prompt": "Organized rhythm, no pulse.", "options": [
     ("CPR and epinephrine ASAP: this is PEA", Y, "Start the PEA algorithm."),
     ("Defibrillate", N, "Not shockable."),
     ("Adenosine", N, "Not for pulseless rhythms."),
     ("Synchronized cardioversion", N, "Never in a pulseless patient.")]},
   {"strip": "pea_fast", "vitals": "Recent surgery · immobile · sudden collapse", "prompt": "Likely cause and response?", "options": [
     ("Pulmonary embolism: high-quality CPR, early pre-alert; fibrinolysis per protocol/hospital", Y, "PE is a classic cause of post-operative PEA."),
     ("Tension pneumothorax: bilateral needle decompression", N, "There are no supporting signs."),
     ("Hypothermia", N, "Nothing suggests it."),
     ("Hyperkalemia: calcium", N, "Nothing suggests it.")]},
   {"strip": "asystole", "vitals": "No ROSC · 15 min", "prompt": "Now asystole.", "options": [
     ("Continue CPR, epinephrine q3–5 min, transport or consult per protocol", Y, "Continue the algorithm."),
     ("Pace", N, "Not recommended."),
     ("Atropine", N, "No role."),
     ("Shock", N, "Not shockable.")]},
  ]},
 {"title": "No response after 20 minutes", "focus": "Agonal rhythm and termination",
  "scenario": "An unwitnessed arrest in an 88-year-old. No bystander CPR, about 25 minutes of ALS.",
  "stages": [
   {"strip": "agonal", "vitals": "Pulse: none", "prompt": "Interpret.", "options": [
     ("Agonal rhythm: treat as PEA (CPR, epinephrine)", Y, "Organized complexes without a pulse are PEA."),
     ("It's a rhythm, so the patient is perfusing", N, "There is no pulse."),
     ("Shock", N, "Not shockable."),
     ("Pace", N, "Not indicated in arrest.")]},
   {"strip": "asystole", "vitals": "No shocks given · no ROSC · ETCO₂ 8", "prompt": "Next step?", "options": [
     ("Apply your TOR rule and contact medical direction about termination", Y, "Unwitnessed by EMS, no shock and no ROSC meets common TOR criteria."),
     ("Stop solely because ETCO₂ is low", N, "Use the full criteria."),
     ("Pace", N, "Not recommended."),
     ("High-dose epinephrine", N, "No benefit.")]},
   {"strip": "asystole", "vitals": "Termination approved", "prompt": "What follows?", "options": [
     ("Note the time, support the family, follow the coroner/ME protocol for tubes and lines", Y, "This is part of good end-of-resuscitation care."),
     ("Leave immediately", N, "The family needs support."),
     ("Remove all equipment before notifying the coroner", N, "Follow your protocol, which may require leaving devices in place."),
     ("Continue CPR to the hospital anyway", N, "Termination was approved.")]},
  ]},
 {"title": "Empty pill bottles", "focus": "Tricyclic overdose",
  "scenario": "A 35-year-old took an unknown amount of amitriptyline. Drowsy, then a wide-complex tachycardia.",
  "stages": [
   {"strip": "vt_fast", "vitals": "Pulse present · BP 80/50 · drowsy", "prompt": "Treatment?", "options": [
     ("Sodium bicarbonate 1–2 mEq/kg IV and synchronized cardioversion for instability", Y, "Bicarbonate treats TCA sodium-channel toxicity, and an unstable wide tachycardia needs electricity."),
     ("Amiodarone", N, "Can worsen TCA toxicity."),
     ("Adenosine", N, "Ineffective, and she is unstable."),
     ("Procainamide", N, "Contraindicated in TCA toxicity.")]},
   {"strip": "vf", "vitals": "Pulse: none", "prompt": "She arrests.", "options": shock_first(", continue sodium bicarbonate")},
   {"strip": "stach", "vitals": "Pulse present · BP 96/58", "prompt": "ROSC. Next?", "options": [ROSC_CARE, HYPERVENT, EXTRA_EPI,
     ("Flumazenil", N, "Contraindicated with TCA ingestion.")]},
  ]},
 {"title": "Pulled from the pool", "focus": "Hypoxic arrest",
  "scenario": "A 16-year-old is pulled from a pool after an estimated 4 minutes underwater.",
  "stages": [
   {"strip": "idio", "vitals": "Pulse: none · apneic", "prompt": "Priority?", "options": [
     ("CPR with early effective ventilation and oxygenation, epinephrine ASAP (PEA)", Y, "In drowning, hypoxia is the cause, so ventilation is critical."),
     ("Compressions only, no breaths", N, "Hypoxic arrest needs ventilation."),
     ("Shock", N, "Not shockable."),
     ("Heimlich maneuver to drain water", N, "Delays CPR and doesn't help.")]},
   {"strip": "brady", "vitals": "Pulse present · HR 44 · SpO₂ 80%", "prompt": "Pulse returns but he is slow and hypoxic.", "options": [
     ("Continue ventilation and oxygenation; this bradycardia is likely hypoxic", Y, "Oxygenation fixes hypoxic bradycardia."),
     ("Atropine first", N, "Treat the hypoxia first."),
     ("Pace immediately", N, "Ventilate first."),
     ("Stop ventilating", N, "He is still hypoxic.")]},
   {"strip": "nsr", "vitals": "SpO₂ 95% · BP 104/66", "prompt": "Next?", "options": [ROSC_CARE, HYPERVENT, EXTRA_EPI,
     ("Discharge at the scene if he wakes up", N, "Drowning patients can deteriorate later and need hospital evaluation.")]},
  ]},
]
assert len(CASES) == 20
