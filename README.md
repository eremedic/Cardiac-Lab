# CSHealthED Cardiac Lab

ECG rhythm interpretation and ACLS megacode training for paramedic students, with a live instructor scoreboard.

- **102 ECG strips**: 17 unique strips each of sinus, atrial, junctional, ventricular, AV block and paced rhythms. Students pick the rhythm and get the full interpretation (rate, rhythm, P waves, PR, QRS, field action). A wrong answer shows, side by side, how the chosen rhythm differs from the right one.
- **20 ACLS megacode cases** (66 decisions) on a live monitor, with a rationale for every option.
- **Scores at the end** for each student, plus an **instructor scoreboard**: class averages, every student's progress, weakest rhythm family, most-missed strips, per-case scores and a CSV download.

Built on the 2025 AHA ACLS algorithms. Strips are synthetic teaching tracings. Always follow local protocols and medical direction.

## How it works

| Part | What it is |
|---|---|
| `public/` | The site: `index.html` (the app), `trainer-data.js` (strips and cases), `img/` (logo) |
| `netlify/functions/api.mjs` | The score API at `/api/*`, run as a Netlify Function |
| `lib/` | API logic, database connection and table definitions |
| Supabase | Stores scores in a table `ecglab.scores`, in its own `ecglab` schema |

Students' progress is always saved in their own browser. When score sharing is set up, each answer is also sent to the API and saved in Supabase. Only someone with the instructor password can read the scores.

## Deploy to Netlify (with Supabase)

### 1. Get your Supabase connection string
1. In Supabase, open your project and click **Connect** at the top.
2. Choose **Transaction pooler** and copy the connection string. It looks like
   `postgresql://postgres.abcd1234:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
3. Replace `[YOUR-PASSWORD]` with your database password. If the password has symbols, URL-encode them (`@` → `%40`, `#` → `%23`).

Use the **shared** pooler string (host ending in `pooler.supabase.com`, user `postgres.<project-ref>`). Addresses on `db.<project-ref>.supabase.co` (the Direct connection, and the dedicated pooler some plans show) only accept IPv6 unless your project has Supabase's IPv4 add-on, and Netlify connects over IPv4.

You can use an existing Supabase project. Cardiac Lab only creates its own `ecglab` schema and never touches other tables.

**Optional:** to create the table yourself instead of letting the app do it on first use, paste [`supabase/schema.sql`](supabase/schema.sql) into Supabase → **SQL Editor** and run it.

### 2. Create the Netlify site
1. Netlify → **Add new site** → **Import an existing project** → GitHub → choose **Cardiac-Lab**.
2. Leave the build settings as they are; `netlify.toml` already has them (publish directory `public`, functions in `netlify/functions`).
3. Before deploying, add these environment variables (**Site configuration → Environment variables**):

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | The Transaction pooler connection string from step 1 | **Yes** (mark as secret) |
| `INSTRUCTOR_PASSWORD` | A password you choose for the scoreboard | **Yes** (mark as secret) |
| `CLASS_CODE` | A code students must enter to share scores, e.g. `Cardio2026`. Not case-sensitive. Leave unset to accept any student | No, but recommended |
| `DATABASE_CA_CERT` | Supabase's SSL certificate (Project Settings → Database → SSL), pasted in full | No. Connections are always encrypted; with this, the server's identity is also verified |

4. Click **Deploy**.

### 3. Check it
- Open `https://<your-site>.netlify.app/api/health`. It should say `"ok": true`. If not, the message explains what to fix (most often the `DATABASE_URL` password or pooler string).
- Open the site, enter a test name on the **Overview** page, answer a strip, then click **Instructor sign-in** at the bottom of the page and enter your `INSTRUCTOR_PASSWORD`. Your test student should appear. You can remove it from the student's detail panel.

After changing environment variables, redeploy (**Deploys → Trigger deploy → Deploy site**) so the function picks them up. When you add or edit a variable, make sure its **Scopes** include **Functions** and its value applies to the **Production** deploy context (or "Same value for all deploy contexts").

`/api/health` shows `connectingTo` (or `connectedTo`): the host, port and user the function is actually using. If it still shows an old address after you changed `DATABASE_URL`, the change hasn't been deployed yet or isn't available to Functions.

## Using it with a class

**Students**
1. Open the site link you send them.
2. On the **Overview** page, under **Your results**, enter their name, cohort (optional) and the class code (if you set one).
3. Work through **Strips** and **Megacode**. The top bar shows **Shared with instructor** when scores are reaching you. The **Results** tab shows their own score at any time.

Progress is kept in the student's browser. Using a different device or browser starts a new record, which appears as a separate row under the same name.

**Instructors**
- Click **Instructor sign-in** at the bottom of any page (or go to `/#scoreboard`) and enter the instructor password. The **Scoreboard** tab then appears in the top bar.
- The scoreboard refreshes every 30 seconds. Filter by cohort, sort by recent activity, score, name or progress, and click a student to see their score in each rhythm family, missed strips and case scores.
- Every module is tracked. Under the main score cards, a second row shows class results for the **practice areas**, the **12-lead ECGs**, the **Defib lab** and the **course survey**. The student table has **Practice areas** and **Defib lab** columns, and each module has its own panel lower down.
- **Class setup (owner only):** set, change or remove the **class code** students enter (it overrides CLASS_CODE in Netlify; capitals don't matter), and keep a list of **cohorts**. Saved cohorts appear in every cohort dropdown (filter, print, instructor editor) even before anyone joins, and as suggestions when students type their cohort, so names match. A cohort added while editing an instructor is saved to the list too.
- **Instructors (owner only):** the owner (INSTRUCTOR_PASSWORD) can add instructors in the **Instructors** card: a name, the cohorts they may see, and what they can do (open or close the 12-lead area, field strips or Defib lab; print reports; download CSV; see survey results; remove students). Saving shows a generated password once (copy it and hand it over); **New password** replaces it and **Remove** deletes the account. Instructors sign in on the same page with their password and see only their cohorts' students, only the switches and tools they were given; everything else is hidden, and the server enforces the same limits. Switches an instructor opens or closes apply only to their cohorts (students get them by the cohort they enter on the Overview page; the owner's switches apply to everyone else). Cohort names match regardless of capitals or extra spaces.
- **Choose who to view:** a search bar plus a **Students** dropdown with **Select all**, **Clear** and a tick box per student; the students you pick show as chips you can remove.
- **Selection details:** the scoreboard starts with no students selected. Tick students in the list (search by name or cohort, narrow it with the Cohort filter), or press **Select all** to pick everyone in the list; **Clear** empties it. The stats, charts, table and CSV cover only the selected students, and your browser remembers the selection.
- **Strengths and weak areas:** bar charts for the selected students: strips by rhythm family and practice areas (with the strongest and the one that needs work tagged), the most-missed rhythm types, the hardest megacode cases and the Defib lab scenarios with the lowest pass rate. Hover or tab to a bar for the counts behind it.
- **Print reports:** print one student, the selected students, or a whole cohort. Each student gets their own page (scores, charts, missed strips, megacode cases, Defib lab); for a group or cohort you can add a class summary page with the charts and a table of everyone. Use the print dialog's Save as PDF to keep a copy.
- **Sort the student table** by clicking any column heading (Student, Strips, Megacode, Overall, Weakest family, Survey, Practice areas, Defib lab, Last active); click again to reverse. Students with no data in that column go last. Choosing from the Sort menu goes back to that order.
- **Download CSV** exports the selected students.
- **Print one student from the table:** every row has a **Print** button (it prints that student's scores report without opening the row); the expanded row also has **Print report** and **Print survey answers**.
- **Course survey report:** a separate printable report. In **Print reports** choose **Course survey report**, then one student, the selected students, a cohort or everyone. A group report has the response count, overall rating, Net Promoter Score, confidence gain, willingness to pay, every statement and answer breakdown, all comments and a list of who responded. One student's report lists their answers. Anonymous answers are never printed under a name: they appear only in group reports, as "Anonymous". The on-screen **Course survey** panel also has a **Print survey report** button for the selected students, and its CSV now follows the selection.
- To change the password, update `INSTRUCTOR_PASSWORD` in Netlify and redeploy.

**How scores are calculated**
- Every score is **correct ÷ answered**: strips, megacode, practice areas, 12-lead, the Results page and the scoreboard. Unanswered items don't lower a score. Progress (how much has been answered) is shown separately, including the rings on the home page.
- The scoreboard works this out from each student's saved counts, so older rows follow the same rule.

**Ectopic beats are named with the underlying rhythm**
- Answer choices for premature and escape beats always include the rhythm underneath: "Sinus rhythm with PACs", "Sinus rhythm with PJCs", "Sinus rhythm with a junctional escape beat", "Sinus rhythm with unifocal / multifocal PVCs", "Sinus rhythm with ventricular bigeminy / trigeminy", "Sinus rhythm with a PVC couplet" and "Sinus rhythm with a run of VT (non-sustained VT)". Every one of these strips has a sinus rhythm at 60–100 underneath.
- Answers students saved under the old names are carried over automatically, and the scoreboard reads them the same way.

**Wrong answers are marked up on the strip**
- When a student picks the wrong rhythm (or the cardiologist reveals it), the strip itself is labeled to show what makes the correct rhythm what it is: each P wave (red when it isn't conducted), PR intervals, R–R intervals in seconds across the top, wide QRS complexes (PVC or paced), pacer spikes with ✓ capture / ✗ no capture, and a short note for rhythms without discrete beats (atrial fibrillation, flutter, VF, asystole, complete heart block, junctional). The feedback says exactly what was labeled.
- On the field strips it also marks the extra findings: R-on-T PVCs (red), delta waves and ST depression (blue).
- **12-lead ECGs** are marked lead by lead, color-coded by what each mark shows: red ST elevation (and its shape: concave, coved, J-notch), blue ST depression (reciprocal, diffuse or upsloping), orange Q waves, purple T-wave changes (peaked, inverted, biphasic), teal QRS and conduction changes (rSR′, broad QS, notched R, delta wave, voltage), green PR segment shifts and amber QT and U waves. Each lead gets a label with the size in mm, e.g. "ST ↑ 2.7 mm" or "reciprocal ST ↓ 1.2 mm".
- Every marked ECG or strip gets a color key underneath ("Why it's Inferior STEMI: …") and a plain-language summary in the feedback, e.g. "ST ↑ in II, III, aVF · Q wave in III · reciprocal ST ↓ in I, aVL."
- This works in the Strips module, every practice area, the field strips and the 12-leads. The beat timings and lead-by-lead findings come from the generators (measured on the noise-free waveform) and are saved with each strip.

**One color per kind of finding**
- The same colors are used on rhythm strips, 12-leads and every color key: red ST elevation (and R-on-T), blue ST depression, orange Q waves, purple T-wave changes, teal QRS width and bundle branch patterns (including wide beats), magenta delta waves, brown voltage and tall R waves, green P waves and PR, amber QT and U waves, navy R–R intervals, indigo pacer spikes, and gray for what's missing (a P that isn't conducted, a spike that doesn't capture).

**Culprit vessel (12-lead STEMIs)**
- After answering a STEMI or STEMI-equivalent 12-lead (inferior, anterior, lateral, anterolateral, posterior, Wellens, de Winter, aVR pattern), students get a follow-up: which coronary artery is most likely involved (RCA, mid/distal LAD, proximal LAD, circumflex, or left main / multivessel), with an explanation. The vessel score shows in the 12-lead header, the scoreboard charts and student detail, and printed reports; it doesn't change the 12-lead score.
- A note above every 12-lead tells students they can click it to open the zoomable viewer.

**Calipers**
- Every ECG has a **Calipers** button: the Strips module, every practice area, the 12-lead printouts and the megacode monitor. The Defib lab monitor doesn't have them. They look like a real steel divider: two tapered legs on a hinge with an adjustment knob, held in a band that opens above the ECG so the tracing stays clear, with the needle points at the top edge and a faint guide line from each point down through the tracing, with a readout of the interval in seconds, small boxes and the matching rate per minute. **March** repeats the interval across the strip (useful for P–P and R–R regularity and hidden P waves).
- Drag a needle point to open or close the calipers, or drag the hinge to move them. With a keyboard: Tab to a leg or the hinge, then arrow keys move one small box (0.04 s); Shift + arrow moves 0.01 s, Page Up/Down moves one large box, Home/End jumps to either end, and Escape closes the calipers. The legs are labeled sliders that announce their position and the interval to screen readers.
- The calipers stay open and in place as you move from strip to strip, and the browser remembers the setting.

**Practice areas**
- Six extra practice areas, each with 50 strips: **Sinus**, **Atrial**, **Junctional**, **Ventricular**, **AV blocks** and **Paced**. Students open them from the tiles on the Overview page or the **Practice** tab.
- Every strip is generated separately (its own rate, intervals, wave shapes, noise and baseline), so no strip repeats, here or in the main 102-strip set.
- Each strip is checked against the rules of the rhythm it shows (rate range, regularity, PR interval and P–QRS relationship, QRS width, and the defining pattern, such as the lengthening PR before a dropped beat in Wenckebach). Strips that fail are discarded and regenerated.
- Progress in each area is shared with the scoreboard: a **Practice areas** panel shows class accuracy and how many students started and finished each area, and each student's detail shows their results per area. The scores CSV includes them. Practice areas don't count toward the overall score or the survey unlock.

**12-lead ECG practice area (opened by the instructor)**
- A seventh practice area with 150 full 12-lead ECGs across 19 findings (the last 50 look like real patients recorded on scene: beat-to-beat variation, breathing-related amplitude change, lead-to-lead baseline wander, road vibration and slow drift on every lead, and often limb- or chest-lead tremor or 60-cycle interference (never anything shaped like a beat; each lists its artifact); findings are still measured on the clean tracing), shown as a standard printout (four columns of three leads plus a lead II rhythm strip): normal; inferior, anterior, lateral and anterolateral STEMI; posterior MI; ST elevation in aVR with diffuse ST depression; Wellens syndrome; de Winter T waves; RBBB; LBBB; WPW; LVH with strain; Brugada pattern; long QT; hyperkalemia; hypokalemia; pericarditis; benign early repolarization. Answer choices are drawn from look-alike findings.
- **Expand and zoom** works on rhythm strips too (Strips module, every practice area and field strip, and the megacode monitor): click the strip to open the same full-screen viewer, with any teaching marks.
- On STEMI 12-leads, once the interpretation is answered the vessel follow-up takes the place of the answer choices (the interpretation shrinks to one line) and the feedback moves below it.
- **Expand and zoom:** click a 12-lead (or **Expand and zoom** under it) to open it full screen. Zoom with − / +, the mouse wheel, a pinch or a double-click (up to 14×), drag to move around, **Fit** to reset; keyboard: + / −, arrow keys, 0 to fit, Esc to close. Teaching marks come along.
- **Call the cardiologist** (all seven practice areas): the button sits above the strip. Each call reveals one more hint (where to look, then that strip's own measurements, then the tell) in a floating panel that can be minimized. The 4th call reveals the answer and full explanation and counts that strip as wrong. Answering after one to three hints is graded normally. Hints never name the answer (the build checks this).
- Every ECG is measured after it's generated (ST level 60 ms after the J point in each lead, PR segment, T-wave height, QRS width and shape) and checked against the criteria for its finding, for example ≥ 1 mm elevation in 2 contiguous leads (≥ 2 mm in V2–V3) with reciprocal depression for STEMI.
- **It starts closed.** On the scoreboard, the **12-lead ECG practice area** card shows whether it's open and has **Open to students** / **Close to students** and **Preview**. The setting is saved in Supabase (`ecglab.settings`). While it's closed, students don't see the tile and the server won't send the ECGs to anyone but the instructor.

**Defib lab: monitor, defibrillator and pacer (turned on by the instructor)**
- A working monitor/defibrillator/pacer trainer (CSHealthED-branded, with the layout and workflow of a modern manual defibrillator): a live sweeping screen with ECG, SpO₂ pleth and capnography; HR, SpO₂, NIBP and EtCO₂; and the keys **Energy select ▲▼ (1)**, **Charge (2)**, **Shock (3)**, **Sync**, **Analyze**, **Pacer** with **Rate ▲▼**, **Current ▲▼** and **Pause**, **Lead** and **NIBP**. The patient panel has **Check pulse**, **Start/Stop CPR**, **Sedation / analgesia** and **Epinephrine 1 mg**, plus a time-stamped event log.
- When a setting changes, a gray box pops up in the middle of the screen just below the ECG, the way a real monitor shows it: ENERGY SELECT with the joules, CHARGING (counting up) and CHARGED, SYNC ON/OFF, PACER ON/OFF, PACER RATE in ppm, PACER OUTPUT in mA, and ENERGY DELIVERED. It clears after 3 seconds.
- The device behaves like the real thing. Charging takes about 3 seconds. Changing the energy removes the charge, and an unused charge is dropped after 60 seconds. With **Sync** on, the shock fires on the next QRS, and in VF it never fires. An unsynchronized shock on a rhythm with a pulse can cause VF. Pacing is demand mode and captures only once the current reaches that patient's threshold, which is randomized for each run.
- 20 scenarios in five groups: shockable rhythms (VF, pulseless VT, torsades, fine VF, refractory VF, pediatric VF at 2 J/kg, VF with the monitor left in SYNC, unstable torsades with a pulse); unstable tachycardias for synchronized cardioversion (VT, SVT, atrial fibrillation, flutter); stable tachycardias that need drugs, not a shock (VT and SVT); bradycardias (sinus bradycardia that responds to atropine, a transplanted heart where atropine fails, complete heart block, 2:1 block); and non-shockable arrests (asystole, PEA).
- Medications and actions: epinephrine, amiodarone, adenosine, atropine, magnesium, calcium, vagal maneuver, 12-lead ECG, sedation, pulse check and CPR. Drugs act on the rhythm where they should (adenosine converts the stable SVT after a brief pause, atropine speeds up the sinus bradycardia, amiodarone converts the stable VT) and do nothing where they shouldn't.
- **Sound:** the monitor beeps with every QRS (the pitch drops as SpO₂ drops), whines while charging, sounds a ready tone while charged, and alarms on VF, VT, asystole and heart-rate limits. The **SOUND** key on the device turns it on and off, and the choice is remembered.
- **Done: get feedback** grades the run step by step: modality, sync, energy, clearing the patient, sedation, drugs and their order, pacing rate, capture and pulse check, CPR and epinephrine. Critical steps decide pass or fail.
- **It starts off.** The scoreboard has a **Defib lab** card with **Open to students** / **Close to students** and **Preview**, just like the 12-lead card. The scoreboard's **Defib lab** panel shows the pass rate for each scenario, each student's detail lists their scenarios, and the scores CSV includes scenarios passed and attempted plus a column per scenario.

**Field strips: the back of the ambulance (opened by the instructor)**
- An 8th practice area with 100 randomized strips, 16–17 from each rhythm family (43 rhythm types), that look like they came off a monitor in a moving rig on a real patient. Light artifact: breathing baseline wander and slow drift, road vibration, and on some strips shivering (muscle tremor) or 60-cycle interference. There are no bumps, electrode pops or movement swings: anything shaped like a beat could be mistaken for a PVC, PAC or PJC.
- The beats look like a real patient's, not a template: every P, QRS and T varies a little from beat to beat, and each strip has its own P shape (peaked, flat, notched, biphasic), T shape (inverted, flattened, peaked, biphasic, ST depression), and sometimes U waves, J-point notching, an rSR′ notch or low/high voltage. Some sinus strips show a delta wave with a short PR (pre-excitation), and some PVC strips have R-on-T PVCs. These are listed on an **Also noted** line in the interpretation. The artifact is kept light.
- Every strip is rule-checked on the clean tracing before the artifact is added, so the rhythm is always readable. Flat-line and fine-VF strips only get light wander and vibration.
- The interpretation for each strip includes an **Artifact** line naming what's on it, and the cardiologist's first hint reminds students to find a steady stretch of baseline first.
- **It starts closed.** Open it from the **Field strips** card on the scoreboard (with **Preview**). Until then students don't see the tile and the server won't send the strips to anyone but the instructor. Results show in the scoreboard's practice-areas panel and CSV like the other areas.
- Rebuild with `python3 tools/generator/build_field.py` (writes `lib/field-data.mjs`).

**Course survey**
- The survey unlocks once a student has answered 10% of the strips and megacode decisions (17 of 168), on the Overview, Results and **Survey** tab. Students can update their answers later. The server checks the saved results before accepting it. The threshold is `SURVEY_UNLOCK_PCT` in `lib/api.mjs` (and the matching line in `public/index.html`).
- Students can choose **Hide my name next to my answers**: the scoreboard then shows that they completed the survey, but lists their answers and comments as "Anonymous".
- The scoreboard's **Course survey** panel shows the response count, overall rating, Net Promoter Score, confidence before and after, agreement with each statement, answer breakdowns and every comment. **Download survey CSV** exports the responses (anonymous ones without names).
- The questions are in [`lib/survey.mjs`](lib/survey.mjs). Edit them there; keep each question's `id` the same once students have answered.

**Good to know:** scoring happens in the student's browser, so treat these scores as practice tracking, not a proctored exam. The class code keeps strangers from adding rows, and names are whatever students type.

## Run it locally

Requires Node.js 20+.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:8888. Without `DATABASE_URL`, scores go to a temporary in-memory database, and the instructor password is `instructor`. To use your Supabase database locally:

```bash
DATABASE_URL="postgresql://…" INSTRUCTOR_PASSWORD="…" npm run dev
```

## Tests

```bash
npm test
```

The tests run the API against an in-memory Postgres (PGlite): saving and updating scores, instructor authentication, class codes, input validation and removing a student.

## Changing the content

Strips and cases are generated by the Python scripts in `tools/generator/`:

- `practice_set.py`: the 102 strips, their interpretations and feedback text
- `megacode_cases.py`: the 20 cases, options and rationales
- `ecg2.py`: the waveform engine

- `areas.py`: the six practice areas (rhythm builders and the rule checks)
- `twelve.py`: the 12-lead ECGs (lead model, findings and the criteria checks); `build_twelve.py` writes `lib/twelve-data.mjs`

After editing, rebuild the data files and commit them:

```bash
pip install numpy matplotlib pillow
```

```bash
python3 tools/generator/build_data.py
```

```bash
python3 tools/generator/build_areas.py
```

```bash
python3 tools/generator/build_twelve.py
```

The page design and app logic are in `public/index.html`. If you change `lib/schema.mjs`, run `npm run db:schema` to update `supabase/schema.sql`.

## Security notes

- The browser never talks to Supabase directly and no Supabase keys are used. The API connects with `DATABASE_URL` on the server.
- Row-level security is on for `ecglab.scores` with no policies, so Supabase's public API keys can't read or change scores.
- The instructor password is checked on the server, and wrong guesses are slowed down. The API only accepts a fixed data shape, caps sizes and strips control characters from names.
