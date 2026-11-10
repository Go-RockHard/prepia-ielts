# Speakia IELTS

Speakia is an AI-powered IELTS Speaking practice workspace. It helps learners build fluency, develop useful vocabulary, practise realistic speaking tasks, and reflect on their progress. AI feedback is for practice and is not an official IELTS score.

## Core features

- **Speaking practice:** a unified Guided Practice library with all four IELTS criteria built into every mode, criterion-focused coaching, live answer templates, guided drills, and AI-to-AI demonstrations.
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

Open the local URL printed by the development server. Add the configured AI service key in **Settings** to use AI features. The app stores the key in browser IndexedDB and sends requests directly from the browser; this prototype is not suitable for production or sensitive data.

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
