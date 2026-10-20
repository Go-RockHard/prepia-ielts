# Speakia

Speakia IELTS is a React + TypeScript prototype for Gemini-powered IELTS speaking practice. It includes a Gemini Live examiner, Gemini audio-based rubric evaluation, visual feedback, and locally saved test history with transcript review and audio playback.

## Getting started

```bash
npm install
npm run dev
```

## Available scripts

```bash
npm run build
npm run lint
npm run preview
```

## UI stack

- React 19, TypeScript, and Vite
- Tailwind CSS 4 through the Vite plugin
- shadcn/ui-compatible component setup in `components.json` and `src/components/ui`
- Lucide React icons, Framer Motion transitions, and Recharts visualizations

## App areas

- **Dashboard:** progress overview, recent practice, weekly activity, and learning prompts
- **Practice:** Gemini Live voice examiner for full IELTS Speaking or an individual part
- **Lexis & Topics:** pin important vocabulary and speaking prompts, filter pinned or unpinned cards, and listen to Topic Bank model answers with Gemini TTS; generated answer audio is cached locally for replay
- **Speakia Coach speaking drills:** launch inline, short Gemini Live exercises for fluency, pronunciation, vocabulary, grammar, and IELTS Speaking Parts 1–3, with extended thinking and targeted spoken feedback
- **Speakia Flashcards:** IELTS vocabulary cards synced from Lexis & Topics, with FSRS-based adaptive reviews, daily new-card limits, topic/category filters, pronunciation, and optional Gemini-generated speaking examples; review progress is stored per local profile in this browser
- **Speakia Podcasts:** personalized two-host episodes that can start immediately as an unscripted conversation between two Gemini Live voices, or be generated as a script and recorded for replay with Gemini TTS; transcripts and live captures are archived in this browser
- **Assignments and notifications:** personalized practice tasks, multimodal Gemini submissions for speaking recordings, handwritten scans, or text, selectable Gemini evaluation models, saved performance reports with strengths, weaknesses, task-specific metrics, and an improvement plan; completion reminders, API setup alerts, and weekly practice prompts
- **Evaluations:** browse every saved Gemini audio evaluation, select a test, and review its four IELTS criteria on a 0–9 scale
- **Media assessments:** assess an uploaded audio recording or YouTube speaking video with Gemini 3.8 Flash or Gemini 3.1 Pro Preview; four-criteria results and transcripts are archived in browser storage, and source media can be shared with Speakia Coach for a summary-first discussion
- **Test history:** completed practice results and transcripts saved in browser local storage, filterable by Part 1, Part 2, Part 3, or full test; recordings are stored in IndexedDB for playback and download
- **Lexical Vault:** searchable, topic- and test-part-filtered IELTS vocabulary with sample speaking questions; pin important cards, filter by pinned status, add entries and edit terms, multiple definitions, examples, and prompts, all persisted in browser local storage
- **Speakia Coach:** floating text and live-voice coach for IELTS speaking preparation and Speakia how-to questions; share audio files, assessment recordings, podcasts, AI-to-AI simulation captures, or YouTube media for summary-first discussion without treating recorded speech as learner chat, alongside inline lessons, quizzes, translation practice, shadowing, and speaking drills
- **Appearance:** persistent light and dark themes, with system preference used on first visit

## Practice assessment notes

Scores are AI-generated practice estimates, not official IELTS results or a
substitute for a certified examiner.
## Local prototype accounts

Speakia IELTS supports prototype-only local accounts. Account data and profiles
are stored in this browser's IndexedDB; the session is stored in `sessionStorage`.
New accounts use the shared prototype password `letsspeakia`. This is not secure
authentication: the password is part of the frontend app, and browser-local
storage is not a substitute for server-side identity or access control. Do not
use real or sensitive personal information. Clearing browser storage removes
the local account and profile.

The profile includes optional IELTS test date and preparation details. The
dashboard uses the test date to show a countdown.

## Gemini prototype setup

1. Create a Gemini API key in Google AI Studio and restrict it to the APIs and origins you need.
2. Run `npm run dev`, open **Settings**, and save the key in the Gemini API connection section. It is retained in this browser's IndexedDB between visits and can be removed from Settings.
3. Select Full test or one IELTS speaking part, allow microphone access, talk with the live examiner, then choose **End test & evaluate**.

The prototype uses Gemini Live for bidirectional voice practice and Gemini models for structured evaluation of the recorded audio and live transcript. Speaking Drills launch inline in Speakia Coach and use Gemini Live extended thinking. The API key is stored in this browser's IndexedDB and sent directly from the browser to Google; browser storage is not encrypted application-secret storage, so this is explicitly **not safe for production**. Do not use a production, shared, or billing-sensitive key. Move API calls behind a server or use short-lived Gemini ephemeral tokens before deployment.

Assignment submissions are sent directly to the selected Gemini model for feedback. Speaking assignments accept audio or text; pronunciation and delivery feedback is only provided for audio submissions. Handwritten tasks accept an image or PDF and are reviewed only for legible written content. Reports are stored with assignments in this browser's local storage; uploaded files are deleted from Gemini file storage after evaluation when the API permits deletion. Submission files are not retained locally by the assignment feature.

The Speakia assistant reuses the same browser-persisted API key as Practice and Media assessments. Text requests include recent saved test/evaluation summaries, answer excerpts, media assessment summaries, profile study preferences, and Lexical Vault entries. Speakia Flashcards sends the selected vocabulary term, meaning, category, and topic to Gemini only when a learner requests an AI speaking example. These details and chat messages are sent directly to Google for model responses. Live voice streams microphone audio to Gemini; shared recordings are treated as media context, with their transcription omitted from Coach chat. YouTube media shared from Media assessments is sent to Gemini for a summary before the live Coach discussion. Chat messages are kept in component memory for the current app session and are not archived as test results. This frontend prototype is not production-safe; do not use a production, shared, or billing-sensitive API key or real sensitive personal information.

Microphone audio is streamed to Gemini Live during practice and submitted to Gemini for evaluation. After evaluation, the recording is saved locally in browser IndexedDB so it can be played from Test history; transcripts and results are saved in local storage. Clearing browser site data removes this local history and audio. Audio is sent to Google for model processing. Scores are AI-generated practice estimates, not official IELTS results or a substitute for a certified examiner.
Media assessments also send the selected audio or YouTube URL directly to Google Gemini. Uploaded audio files are deleted from Gemini file storage after the assessment request completes when the API permits deletion. Media itself is not stored in the local assessment archive; the assessment, transcript, and feedback are stored in this browser.
