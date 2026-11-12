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

After changing environment variables, redeploy (**Deploys → Trigger deploy**) so the function picks them up.

## Using it with a class

**Students**
1. Open the site link you send them.
2. On the **Overview** page, under **Your results**, enter their name, cohort (optional) and the class code (if you set one).
3. Work through **Strips** and **Megacode**. The top bar shows **Shared with instructor** when scores are reaching you. The **Results** tab shows their own score at any time.

Progress is kept in the student's browser. Using a different device or browser starts a new record, which appears as a separate row under the same name.

**Instructors**
- Click **Instructor sign-in** at the bottom of any page (or go to `/#scoreboard`) and enter the instructor password. The **Scoreboard** tab then appears in the top bar.
- The scoreboard refreshes every 30 seconds. Filter by cohort, sort by recent activity, score, name or progress, and click a student to see their score in each rhythm family, missed strips and case scores.
- **Download CSV** exports the current view.
- To change the password, update `INSTRUCTOR_PASSWORD` in Netlify and redeploy.

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

After editing, rebuild the data file and commit it:

```bash
pip install numpy matplotlib pillow
```

```bash
python3 tools/generator/build_data.py
```

The page design and app logic are in `public/index.html`. If you change `lib/schema.mjs`, run `npm run db:schema` to update `supabase/schema.sql`.

## Security notes

- The browser never talks to Supabase directly and no Supabase keys are used. The API connects with `DATABASE_URL` on the server.
- Row-level security is on for `ecglab.scores` with no policies, so Supabase's public API keys can't read or change scores.
- The instructor password is checked on the server, and wrong guesses are slowed down. The API only accepts a fixed data shape, caps sizes and strips control characters from names.
