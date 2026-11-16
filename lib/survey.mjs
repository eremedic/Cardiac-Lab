// End-of-course survey. This file is the single source of truth:
//   - the API serves it to the page at GET /api/survey
//   - the API validates every submitted answer against it
//   - the instructor scoreboard summarizes results from it
// To change a question, edit it here. Keep each `id` stable once students have
// answered, or earlier answers to that question stop being counted.
//
// Question types
//   choice      pick one of `options`
//   multi       pick up to `maxPicks` of `options`
//   likert      1–5 agreement (Strongly disagree … Strongly agree)
//   confidence  1–5 confidence, asked twice: "Before this course" and "Now"
//   stars       1–5 overall rating
//   nps         0–10 likelihood to recommend
//   text        free text (up to `max` characters)

export const SURVEY_VERSION = 1;

export const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
export const CONFIDENCE = ['Not at all confident', 'Slightly confident', 'Somewhat confident', 'Confident', 'Very confident'];

export const SURVEY = [
  {
    title: 'About you',
    intro: 'Optional. Helps your instructor see how the course works for different learners.',
    questions: [
      { id: 'role', type: 'choice', required: false, text: 'Which best describes you?',
        options: ['Paramedic student', 'Practicing paramedic', 'AEMT or EMT', 'Nurse', 'Other'] },
      { id: 'experience', type: 'choice', required: false, text: 'Years of EMS or clinical experience',
        options: ['Less than 1 year', '1–3 years', '4–10 years', 'More than 10 years'] },
    ],
  },
  {
    title: 'The course',
    intro: 'How much do you agree with each statement?',
    questions: [
      { id: 'objectives_clear', type: 'likert', required: true, text: 'The course goals were clear.' },
      { id: 'strips_improved', type: 'likert', required: true, text: 'The ECG strip practice improved my rhythm interpretation.' },
      { id: 'feedback_helpful', type: 'likert', required: true, text: 'The feedback on wrong answers helped me understand my mistakes.' },
      { id: 'megacode_realistic', type: 'likert', required: true, text: 'The megacode cases felt like real cardiac arrest calls.' },
      { id: 'rationales_helpful', type: 'likert', required: true, text: 'The explanations in the megacode cases improved my ACLS decision-making.' },
      { id: 'difficulty_right', type: 'likert', required: true, text: 'The difficulty was right for my level.' },
      { id: 'easy_to_use', type: 'likert', required: true, text: 'The site was easy to use on my device.' },
    ],
  },
  {
    title: 'Your confidence',
    intro: 'Rate your confidence before you started this course, and now.',
    questions: [
      { id: 'conf_blocks', type: 'confidence', required: true, text: 'Identifying AV heart blocks' },
      { id: 'conf_atrial', type: 'confidence', required: true, text: 'Identifying atrial and junctional rhythms' },
      { id: 'conf_paced', type: 'confidence', required: true, text: 'Recognizing paced rhythms and pacemaker malfunction' },
      { id: 'conf_arrest', type: 'confidence', required: true, text: 'Recognizing arrest rhythms (VF, VT, PEA, asystole)' },
      { id: 'conf_megacode', type: 'confidence', required: true, text: 'Leading a cardiac arrest resuscitation' },
    ],
  },
  {
    title: 'Overall',
    questions: [
      { id: 'overall', type: 'stars', required: true, text: 'Overall, how would you rate this course?' },
      { id: 'recommend', type: 'nps', required: true, text: 'How likely are you to recommend this course to a classmate or colleague?' },
      { id: 'most_valuable', type: 'choice', required: true, text: 'Which part was most valuable to you?',
        options: ['ECG strip practice', 'Explanations when I got a strip wrong', 'Megacode cases', 'Seeing my results by rhythm family'] },
    ],
  },
  {
    title: 'Value and pricing',
    intro: 'This course is free for you. These questions help us understand what a course like this is worth.',
    questions: [
      { id: 'would_buy', type: 'choice', required: true, text: 'If this course were offered as a paid subscription, how likely would you be to buy it?',
        options: ['Definitely would buy', 'Probably would buy', 'Not sure', 'Probably would not buy', 'Definitely would not buy'] },
      { id: 'max_monthly', type: 'choice', required: true, text: 'What is the most you would pay per month for access to a course like this?',
        options: ['$0 (I would only use it if it were free)', '$1–$4', '$5–$9', '$10–$14', '$15–$19', '$20–$29', '$30 or more'] },
      { id: 'too_expensive', type: 'choice', required: true, text: 'At what monthly price would it be too expensive for you to consider?',
        options: ['$5', '$10', '$15', '$20', '$30', '$40', '$50 or more'] },
      { id: 'billing', type: 'choice', required: true, text: 'Which way of paying would you prefer?',
        options: ['Monthly subscription', 'Yearly subscription at a discount', 'One-time purchase with lifetime access', 'Pay per course or module', 'My school or employer should pay'] },
      { id: 'payer', type: 'choice', required: true, text: 'Who would most likely pay for it?',
        options: ['I would pay myself', 'My school or program', 'My employer or EMS agency', 'Not sure'] },
      { id: 'worth_paying', type: 'multi', maxPicks: 3, required: false, text: 'What would make it most worth paying for? Choose up to 3.',
        options: ['More ECG strips, including 12-lead', 'Pediatric (PALS) content', 'CE credits or a certificate of completion', 'National Registry exam-prep mode', 'Mobile app with offline access', 'Video explanations', 'Instructor tools for managing classes'] },
      { id: 'pricing_comments', type: 'text', required: false, max: 600, text: 'Anything else about price or value?' },
    ],
  },
  {
    title: 'Your comments',
    intro: 'Optional, but your instructor reads every one.',
    questions: [
      { id: 'helpful', type: 'text', required: false, max: 1000, text: 'What helped you most?' },
      { id: 'improve', type: 'text', required: false, max: 1000, text: 'What should we improve or add?' },
      { id: 'other', type: 'text', required: false, max: 1000, text: 'Anything else you would like your instructor to know?' },
    ],
  },
];

export const QUESTIONS = SURVEY.flatMap((s) => s.questions);

// Returns { answers } with only known, well-formed answers, or { error } naming the first problem.
export function validateSurvey(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'bad_survey' };
  const clean = (v, max) => String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
  const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const answers = {};
  for (const q of QUESTIONS) {
    const v = input[q.id];
    const missing = v === undefined || v === null || v === '';
    if (missing) {
      if (q.required) return { error: 'missing', question: q.id };
      continue;
    }
    if (q.type === 'choice') {
      if (typeof v !== 'string' || !q.options.includes(v)) return { error: 'invalid', question: q.id };
      answers[q.id] = v;
    } else if (q.type === 'multi') {
      if (!Array.isArray(v)) return { error: 'invalid', question: q.id };
      const picks = [...new Set(v)];
      if (picks.length > (q.maxPicks || q.options.length) || picks.some((x) => typeof x !== 'string' || !q.options.includes(x))) return { error: 'invalid', question: q.id };
      if (!picks.length) { if (q.required) return { error: 'missing', question: q.id }; continue; }
      answers[q.id] = picks;
    } else if (q.type === 'likert' || q.type === 'stars') {
      if (!inRange(v, 1, 5)) return { error: 'invalid', question: q.id };
      answers[q.id] = v;
    } else if (q.type === 'nps') {
      if (!inRange(v, 0, 10)) return { error: 'invalid', question: q.id };
      answers[q.id] = v;
    } else if (q.type === 'confidence') {
      if (!v || typeof v !== 'object' || !inRange(v.before, 1, 5) || !inRange(v.now, 1, 5)) return { error: 'invalid', question: q.id };
      answers[q.id] = { before: v.before, now: v.now };
    } else if (q.type === 'text') {
      if (typeof v !== 'string') return { error: 'invalid', question: q.id };
      const t = clean(v, q.max || 1000);
      if (t) answers[q.id] = t;
      else if (q.required) return { error: 'missing', question: q.id };
    }
  }
  return { answers };
}
