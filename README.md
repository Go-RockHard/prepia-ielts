# Prepia IELTS

Prepia IELTS is a four-skill learning workspace for IELTS Speaking, Writing, Reading, and Listening. Speakia and Writia provide productive-skill practice; Readia and Listenia add original receptive-skill exercises with exam simulation, live AI-guided learning, answer review, and saved progress. AI feedback is for practice and is not an official IELTS score.

## Core features

- **Speaking practice:** a unified Guided Practice library with all four IELTS criteria built into every mode, criterion-focused coaching, live answer templates, guided drills, and AI-to-AI demonstrations.
- **Reading and Listening practice:** Readia and Listenia provide starter sets, timed practice, guided sessions, local attempt history, and a learner-specific Content Studio. The Studio includes Academic and General Training topic presets, focused question-type practice, and generated 40-question Reading and Listening mock formats. Learners can choose Gemini text, review, and listening TTS models. Generated drafts receive deterministic schema/evidence checks and an independent Gemini review; malformed or invalid JSON is retried and repaired before a failed job is recorded. Drafts remain unpublished until a learner reviews and approves them. Listening packages use Gemini-generated audio stored as blobs in IndexedDB; starter recordings may use browser speech synthesis. Materials and interface design are original Prepia practice content, not copied official IELTS test material or an official IELTS score.
- **Local receptive-skill library:** Readia passages, Listenia scripts and generated recordings, topic exposure, published packages, active practice state, generation history, and attempts are stored in browser IndexedDB. Topic-repeat checks apply across both Reading and Listening for the learner in this browser; abandoned topic reservations expire after 12 hours. Skill progress compares recent mark-weighted accuracy with earlier attempts and labels it as practice evidence, not an IELTS band. Topic history does not synchronize across devices. No Firestore backend is used for these features.
- **Answer Builder:** work from the live Topic Bank, explore model answers and answer structures, listen to AI-to-AI demonstrations, practise live with a candidate-to-AI examiner, and review formative answer-building mastery by question.
- **Vocabulary learning:** Vocabulary Bank, Vocabulary Builder sentence starters and word upgrades, topic prompts, spaced-repetition flashcards, and automatic capture of useful vocabulary from simulation and template sessions.
- **Personalized support:** Speakia Coach keeps locally stored conversation sessions and tool-action history, using relevant past chats for continuity; Writia, assignments, podcasts, and media assessment.
- **Practice history:** transcripts, recordings, and feedback saved in the browser.

## Run locally

Requirements: Node.js and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. Add the configured AI service key in **Settings** to use AI features. AI requests are sent directly from the browser using the learner-provided key. Browser-only keys and local data are not suitable for production or sensitive data.

## Useful commands

```bash
npm run build
npm run lint
npm run preview
```

## Firebase Hosting

The Firebase Hosting configuration serves the production build from `dist` and rewrites app routes for client-side navigation.

```bash
npx firebase-tools login
npx firebase-tools use speakia-coach
npm run build
npx firebase-tools deploy --only hosting
```

See [PRODUCT_VISION.md](./PRODUCT_VISION.md) for Speakia’s learning philosophy, product principles, and how its modules work together.
