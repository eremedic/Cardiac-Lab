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
- **Download CSV** exports the current view.
- To change the password, update `INSTRUCTOR_PASSWORD` in Netlify and redeploy.

**How scores are calculated**
- Every score is **correct ÷ answered**: strips, megacode, practice areas, 12-lead, the Results page and the scoreboard. Unanswered items don't lower a score. Progress (how much has been answered) is shown separately, including the rings on the home page.
- The scoreboard works this out from each student's saved counts, so older rows follow the same rule.

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
- A seventh practice area with 100 full 12-lead ECGs across 19 findings, shown as a standard printout (four columns of three leads plus a lead II rhythm strip): normal; inferior, anterior, lateral and anterolateral STEMI; posterior MI; ST elevation in aVR with diffuse ST depression; Wellens syndrome; de Winter T waves; RBBB; LBBB; WPW; LVH with strain; Brugada pattern; long QT; hyperkalemia; hypokalemia; pericarditis; benign early repolarization. Answer choices are drawn from look-alike findings.
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
