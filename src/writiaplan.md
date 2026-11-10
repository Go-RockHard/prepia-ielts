now just like speakia powered with adaptive scaffolded realtime coaching sessions/archtecture, i want writia platform for ielts writing test preparation. give me the archtecture plan using gemini realtime api and related business logic, of course the platform modules architecutre
Writia — AI-Powered IELTS Writing Preparation Platform
PRODUCT VISION · SYSTEM ARCHITECTURE · AI COACHING · LEARNING ENGINE

I would build Writia as the writing counterpart to Speakia, but I wouldn't simply replicate Speakia's architecture and replace voice with text.

There is an important pedagogical difference:

Speakia: Learners develop speaking proficiency through real-time conversation, spoken interaction, feedback and repeated oral practice.

Writia: Learners develop writing proficiency through guided composition, adaptive scaffolding, critical feedback, revision and progressively independent writing.

The shared philosophy should be:

AI doesn't just evaluate the learner's performance. It actively helps the learner improve that performance.

This means Writia should not become another essay checker that produces a Band 6.5 estimate and highlights grammatical mistakes. It should be an interactive writing coach that teaches candidates how to think, organise, develop and express ideas in an IELTS-appropriate way.

WRITIA
Your Personal IELTS Writing Coach
Solvy - AI 기반 서·논술형 자동 채점 플랫폼

Proposed positioning: Adaptive AI writing coaching, guided practice and intelligent assessment.

1. The core product philosophy
I recommend building Writia around five interconnected learning principles.

Adaptive scaffolding: The AI adjusts the amount of help according to the candidate's demonstrated ability.

Process-oriented writing: Teach planning, drafting, reviewing and rewriting rather than just generating finished essays.

Criterion-based assessment: Align feedback with IELTS Writing's four assessment criteria.

Iterative improvement: Every submission should create an opportunity to improve the actual writing.

Gradual release of responsibility: Move candidates from heavily guided writing to independent, timed examination performance.

The most important architectural decision is to make the AI coach aware of the candidate's writing history, recurring weaknesses, proficiency level, task type and learning progress.

2. Writia's platform architecture
I recommend six major product layers, supported by a shared adaptive intelligence engine.

WRITIA
IELTS Writing Learning Ecosystem

01

Writing Studio

Task 1 & Task 2

02

AI Writing Coach

Adaptive live coaching

03

Writing Drills

Focused skill development

04

Guided Practice

Scaffolded composition

05

Assessment

IELTS-aligned evaluation

06

Learning Resources

Lessons, vocabulary, frameworks

Adaptive Writing Intelligence Engine

Learner profile · Skill diagnosis · Scaffolding · Task selection · Progress tracking · Preparation planning

AI & Application Infrastructure

Gemini Live API · Gemini reasoning models · Firebase · Writing analytics · Curriculum database

The six modules should not be isolated destinations. They should feed one another through a shared learner profile and writing-performance database.

3. Detailed module architecture
Module 1 — Writing Studio
Core workspace
Notalx - Dashboard AI SAAS Writing - Detail Document Page by Vektora UIUX for Vektora on Dribbble

This is the candidate's primary writing environment.

It should support both IELTS Academic and General Training.

A. IELTS Writing Task 1

Academic: charts, graphs, tables, maps and process diagrams.

General Training: formal, semi-formal and informal letters.

Data interpretation and trend identification.

Overview and key-feature selection.

Comparison and reporting language.

B. IELTS Writing Task 2

Opinion / agree-disagree essays.

Discussion essays.

Advantages and disadvantages.

Problem and solution essays.

Two-part questions.

Positive and negative development essays.

Writing editor features

Feature

Purpose

Live word count

Task-specific word tracking

Writing timer

Exam simulation

Paragraph navigation

Essay structure

Autosave

Preserve drafts

Version history

Compare revisions

Inline annotations

Identify language issues

AI assistance

Contextual guidance

Highlighting

Grammar, vocabulary, coherence

One particularly important feature: Draft → Review → Revise.

Every candidate should be able to preserve multiple versions of the same essay and see how their writing evolves.

Module 2 — AI Writing Coach
Flagship differentiator
This is where Gemini Live API becomes especially interesting.

HyperWrite | AI Writing Assistant

I would make this Writia's signature experience, equivalent to Speakia's live coaching sessions.

The coach should be capable of interacting with the candidate while they are writing, not simply after they submit an essay.

The coaching interaction

Imagine a candidate receives this Task 2 question:

Some people believe that technology has made people less socially active. To what extent do you agree or disagree?

The candidate starts writing an introduction.

Instead of immediately generating a polished introduction, the AI coach asks:

What is your actual position on this statement?

Can you identify the central argument?

What two reasons support your position?

How could you express your position more precisely?

If the candidate struggles, the coach progressively introduces assistance.

Adaptive scaffolding levels

Level

Coaching behaviour

0 — Independent

Candidate writes without assistance

1 — Prompting

AI asks guiding questions

2 — Hints

AI provides contextual clues

3 — Framework

AI provides a paragraph structure

4 — Guided construction

AI helps construct sentences

5 — Modelling

AI demonstrates a possible answer

The system should dynamically move between these levels.

For example, if the candidate consistently produces strong topic sentences, the AI should stop providing topic-sentence templates. It should instead focus on weaker skills such as idea development or grammatical accuracy.

Different coaching modes

I would offer the following configurations within AI Writing Coach:

Live Coaching: Interactive, conversational guidance while composing.

Guided Writing: Step-by-step essay construction with adaptive scaffolding.

Live Feedback: Contextual feedback as the candidate writes.

Review & Improve: Analyse an existing draft and guide revisions.

Independent Writing: No hints until the candidate finishes.

These are coaching modes, not separate modules.

Module 3 — Writing Drills
Focused skill development
2 Danish Apps: Dansk Mester +PD3 Prep (3-month pass) | Danish Mastery

This should be the equivalent of Speakia's Speaking Drills.

The objective is to isolate individual writing skills and develop them through targeted repetition.

I would organise drills into these categories:

Drill category

Example activities

Grammar Drills

Sentence correction, tense accuracy, articles

Sentence Construction

Simple to complex sentences, clause combinations

Paraphrasing Drills

Rewrite statements without changing meaning

Vocabulary Drills

Collocations, precision, contextual vocabulary

Coherence Drills

Linking ideas, logical sequencing

Paragraph Development

Topic sentences, explanation, examples

Argumentation Drills

Supporting claims, counterarguments

Task Achievement Drills

Identify key features, develop relevant ideas

Error Correction

Detect and fix recurring errors

Timed Writing Drills

Complete a paragraph under time constraints

Some particularly valuable drill experiences:

Rewrite this sentence in three different ways.

Improve the precision of this vocabulary.

Identify the grammatical error.

Expand this basic sentence using subordinate clauses.

Develop this topic sentence into a complete body paragraph.

Identify the missing logical connection.

Paraphrase the question without changing its meaning.

Write an overview for a given chart.

Compare two data points using appropriate language.

The AI should remember individual errors and generate new exercises targeting those weaknesses.

For instance, if a candidate repeatedly misuses articles, the system should generate targeted article exercises using contexts from IELTS writing rather than random grammar sentences.

Module 4 — Guided Practice
Learning through composition
This module should be more comprehensive than Writing Drills.

Drills isolate skills. Guided Practice integrates those skills into meaningful writing tasks.

Prepare for IELTS Academic with Free Mock Tests and Resources from LUME

I recommend five guided practice experiences:

1. Guided Essay Writing

The AI walks the candidate through the entire writing process:

Understand the question.

Identify the question type.

Brainstorm ideas.

Select and evaluate arguments.

Create an outline.

Construct the introduction.

Develop body paragraphs.

Write the conclusion.

Review and revise.

2. Paragraph Writing Studio

Candidates practise individual components:

Introductions

Topic sentences

Supporting explanations

Examples

Comparisons

Conclusions

Task 1 overviews

3. Interactive Templates

Rather than simply providing memorised templates, offer reusable structures with interactive completion.

For example:

Position statement.

Main argument.

Explanation.

Supporting example.

Implication.

The candidate learns the function of each component and how to construct it independently.

4. Task 1 Visual Interpretation

For Academic Writing Task 1, candidates practise reading charts, selecting significant data, identifying trends and constructing an overview.

For General Training, candidates practise identifying the purpose, audience, tone and required information in letters.

5. Question Analysis Studio

An interactive experience for understanding IELTS questions before writing.

The candidate learns to identify:

Instruction words.

Topic boundaries.

Main requirements.

Multiple parts of a question.

Expected response structure.

This is important because many writing problems originate from misunderstanding the question rather than poor grammar.

Module 5 — Assessment & Performance History
Performance intelligence
IELTS Preparation, Powered by AI

This module should combine assessment records, detailed feedback and longitudinal performance tracking.

A. IELTS Writing Assessment

Every submitted response should be evaluated using the four official IELTS Writing criteria:

Criterion

What it evaluates

Task Achievement / Task Response

Fulfilment of task requirements

Coherence and Cohesion

Organisation and logical progression

Lexical Resource

Vocabulary range and accuracy

Grammatical Range and Accuracy

Sentence variety and grammatical control

Task 1 uses Task Achievement; Task 2 uses Task Response.

Each assessment should provide:

Estimated criterion-level bands.

Overall estimated task band.

Strengths.

Weaknesses.

Specific examples from the candidate's essay.

Grammar and vocabulary corrections.

Coherence and organisation analysis.

Recommended improvement priorities.

A personalised improvement exercise.

Crucially, distinguish an AI-generated estimated band from an official IELTS score. Never market the AI score as an officially certified result.

B. Assessment Archive

Maintain a searchable archive of:

Completed essays.

Task type.

Date and duration.

Word count.

Assessment results.

Previous revisions.

Feedback history.

C. Performance Analytics

Track:

Overall estimated writing band trajectory.

Task 1 versus Task 2 performance.

Individual criterion performance.

Grammar error frequency.

Vocabulary development.

Paragraph organisation.

Recurring weaknesses.

Improvement after guided interventions.

The system should be able to answer a valuable question:

Has the candidate actually improved, or have they simply received more feedback?

That distinction matters.

Module 6 — Learning Resources
Supporting learning layer
This is where you integrate instructional resources without creating unnecessary standalone features.

I recommend:

Section

Contents

Writing Foundations

Grammar, sentence construction, punctuation

Vocabulary Studio

Topic vocabulary, collocations, lexical precision

Essay Structures

Task 1 and Task 2 organisational frameworks

Model Answers

Annotated responses at different proficiency levels

Question Bank

Categorised IELTS writing prompts

Writing Strategies

Planning, time management, task analysis

Mini Lessons

Short explanations linked to identified weaknesses

An important rule: resources should connect directly to practice.

For example, if a candidate repeatedly struggles with complex sentences, Writia should recommend the relevant lesson and immediately offer a related drill.

Do not turn the resource library into a passive content warehouse.

4. The Gemini-powered coaching architecture
This is the technical heart of Writia.

One clarification: Gemini Live API is not itself the complete writing assessment engine. Its low-latency, bidirectional interaction capabilities make it useful for interactive coaching, but you should pair it with conventional Gemini model calls for deeper analysis and structured assessment.

Google documents text, audio and video interaction over stateful WebSocket sessions, as well as tool calling. 

Google AI for Developers
+1

A. Recommended AI architecture
Candidate Writing Interface

Rich-text editor · Live draft · Selection · Cursor · Revision events

Writia Coaching Orchestrator

Maintains task context, learner state, mode, current writing stage and coaching decisions

Gemini Live API

Real-time interactive text coaching, conversational guidance and optional voice interaction

Gemini Reasoning

Essay evaluation, diagnostic analysis, detailed feedback and structured results

Writing Intelligence

Grammar, discourse, lexical and paragraph analysis

Adaptive Engine

Skill diagnosis, scaffold selection and personalised next actions

Learning & Performance Database

Firebase · Firestore · Writing versions · Skill profiles · Assessments · Learning history

I would separate the AI responsibilities into four services.

1. Realtime Coaching Service

Use Gemini Live API for:

Interactive writing conversations.

Asking questions while the candidate writes.

Providing immediate hints.

Explaining language problems.

Guiding brainstorming and planning.

Maintaining conversational context.

Optional spoken explanations.

You can implement text-first interaction, so candidates don't need to speak to their writing coach. Voice can be an optional accessibility and learning feature.

2. Writing Analysis Service

Use a standard Gemini model for deeper, non-realtime analysis.

Its responsibilities:

Essay evaluation.

Grammar diagnosis.

Vocabulary analysis.

Argument quality.

Paragraph-level coherence.

Task achievement and response analysis.

Revision comparison.

3. Adaptive Pedagogy Service

This is your intelligence layer.

It determines:

What the candidate should learn.

Which weakness deserves attention first.

Whether to explain, demonstrate or ask a question.

How much assistance to provide.

Whether the candidate is ready for independent practice.

What exercise should follow.

4. Assessment & Validation Service

This service should ensure consistency and structured output.

Use schema-constrained model responses where supported, then validate them in your backend before displaying results. Gemini provides structured outputs and function calling for different purposes: structured outputs format final results, while function calling lets models request application actions. 

Google AI for Developers
+1

Do not rely on the Live session alone to produce authoritative assessment records.

B. How adaptive coaching actually works
Let's consider a real example.

A candidate writes:

Nowadays, technology make people less social because they spend more time on mobile phones.

Writia detects a grammatical issue and a relatively basic sentence structure.

Rather than simply correcting the sentence, the coach starts an instructional interaction.

Live Writing Coach

Illustrative session
CANDIDATE'S DRAFT

Nowadays, technology make people less social because they spend more time on mobile phones.

I can see your main argument. Let's improve the sentence. First, what should happen to the verb when the subject is "technology"?
AI Coach · Prompting level

It should be makes.
Candidate

Exactly. Now let's develop the sentence. Can you explain why excessive mobile phone use reduces face-to-face interaction?
AI Coach · Idea development

Because people prefer chatting online instead of meeting friends.
Candidate

Good. Now combine these ideas into a more developed sentence using a subordinate clause. Try it yourself.
AI Coach · Sentence construction

The coach has not written the answer for the candidate. It has helped them discover and construct a better answer.

This is the instructional difference between an essay correction tool and an adaptive writing tutor.

C. The adaptive learning loop
I would establish one consistent learning cycle across Writia.

Write → Diagnose → Understand → Practise → Revise → Transfer
Write

Candidate attempts a sentence, paragraph or complete essay.

Diagnose

AI identifies errors, weaknesses and skill gaps.

Understand

Candidate learns why something is incorrect or ineffective.

Practise

AI generates targeted drills and scaffolded exercises.

Revise

Candidate improves their original writing.

Transfer

Candidate demonstrates the same skill in a new writing task without assistance.

The final step is particularly important. Correcting one essay doesn't prove that a candidate has learned the skill.

The adaptive engine should verify whether improvement transfers to another context.

D. Learner intelligence profile
Every candidate should have a continuously updated writing profile.

For example:

Skill

Illustrative level

Grammar accuracy

5.5

Sentence construction

5.5

Lexical resource

6.0

Coherence

6.0

Argument development

5.0

Task response

6.0

These are internal diagnostic indicators, not official IELTS criterion scores.

The system should maintain:

Current proficiency estimate.

Skill mastery.

Recurring errors.

Previously completed interventions.

Scaffolding dependency.

Independent writing performance.

Learning velocity.

Test date and preparation time remaining.

This is where I would reuse Speakia's Goal- and Time-Aware Adaptive Tutoring philosophy.

Writia should have an Adaptive Prep Plan that changes according to the candidate's target band, test date, performance and remaining preparation time.

For example, a candidate with 30 days remaining who struggles with Task Response should receive a different learning sequence from someone with 90 days remaining who primarily struggles with grammar.

5. Important business logic and intelligence rules
This is the part that will distinguish a serious learning platform from an ordinary LLM wrapper.

Business rule

Expected behaviour

Weakness prioritisation

Address high-impact, recurring weaknesses first

Scaffold fading

Reduce help as mastery improves

Error memory

Remember recurring mistakes

Contextual exercises

Generate exercises from actual learner errors

Task rotation

Avoid over-practising one question type

Skill transfer

Verify learning on new prompts

Timed readiness

Gradually introduce exam conditions

Assessment separation

Do not confuse coaching feedback with formal assessment

Revision integrity

Preserve original and revised versions

Goal awareness

Adjust learning according to target band and deadline

A critical design principle: Do not let the AI independently decide everything.

The backend should own the deterministic business rules, skill records, progress calculations, task selection constraints and assessment history. Gemini should provide intelligent interpretation, coaching and recommendations.

The AI proposes; the application validates and decides what gets saved.

6. Platform architecture: technical implementation
Given your existing React, Firebase and Gemini-oriented product development approach, I would keep Writia's infrastructure familiar and build its intelligence as independent services.

Recommended technology stack
Layer

Recommended technology

Frontend

React + Vite

UI

Tailwind CSS + Radix UI

Icons

Lucide

Rich-text editor

TipTap

Backend

Firebase Cloud Functions / Cloud Run

Database

Cloud Firestore

Authentication

Firebase Auth

File storage

Firebase Storage

Realtime coaching

Gemini Live API

Essay evaluation

Gemini reasoning model

Structured feedback

Gemini structured outputs + Zod

Analytics

Firestore + custom analytics

AI orchestration

Custom Writia Coaching Orchestrator

A practical distinction about Gemini Live API
For Writia, I would use a hybrid interaction architecture:

Text streaming: Send writing events, selected text, draft updates and candidate instructions to the coaching service.

Live conversational coaching: Maintain an interactive Gemini session for real-time guidance and optional voice explanations.

Deep analysis: Send complete essay snapshots to a separate Gemini reasoning workflow.

Structured results: Convert analysis into validated JSON objects for the user interface.

Do not send the entire essay to Gemini after every keystroke. That would be inefficient and unnecessarily expensive.

Instead, use debounced updates, paragraph-level changes, explicit review requests and meaningful writing milestones.

Also, persist the actual learner state in Firestore. Gemini's session memory is useful within a session, but it should not be your permanent student-profile database.

Google's Live API uses WebSocket sessions, supports text input and function calls, and has session-management considerations. For production, keep API credentials and privileged operations behind your backend. 

Google Cloud Documentation
+2

Suggested Firestore architecture

users/{userId}
  profile/
  learningGoals/
  adaptivePrepPlan/

writingProfiles/{userId}
  skillMastery/
  recurringErrors/
  learningPreferences/
  readiness/

writingTasks/{taskId}
  taskType
  questionType
  prompt
  visualData
  difficulty

writingSessions/{sessionId}
  userId
  taskId
  mode
  status
  startedAt
  completedAt

writingSessions/{sessionId}/draftVersions/{versionId}
  content
  wordCount
  timestamp
  revisionType

writingSessions/{sessionId}/coachingEvents/{eventId}
  eventType
  detectedSkill
  scaffoldLevel
  coachResponse
  learnerResponse

writingAssessments/{assessmentId}
  userId
  sessionId
  task1OrTask2
  criterionScores
  overallEstimate
  strengths
  weaknesses
  recommendations

writingDrills/{drillId}
  category
  targetSkill
  difficulty
  generatedContent

learningProgress/{userId}
  masteredSkills
  pendingSkills
  completedInterventions
  transferResults
I would also maintain a versioned assessment record, rather than overwriting previous assessments when the candidate revises an essay.

AI orchestration logic
The coaching orchestrator should receive a context object containing:

Candidate's current writing task.

Current draft and relevant paragraph.

Candidate's target band.

Current skill profile.

Previous errors.

Current coaching mode.

Current scaffold level.

Current stage of the writing process.

It then decides which coaching action to request.

For example:

IF candidate is brainstorming:
    Coach = idea generation

IF candidate is planning:
    Coach = essay structure

IF candidate is drafting:
    Coach = contextual writing guidance

IF candidate makes a recurring grammar error:
    Coach = targeted grammar intervention

IF candidate demonstrates mastery:
    Coach = reduce scaffolding

IF candidate completes essay:
    Coach = comprehensive assessment

IF candidate revises essay:
    Coach = revision analysis
These rules should be implemented as explicit application logic, with Gemini interpreting the content and generating the appropriate teaching response.

7. Adaptive Prep Plan
This deserves its own prominent dashboard section.

I would give Writia a preparation planner similar to Speakia's adaptive preparation philosophy.

EduMind AI - Personalized Learning Platform
The candidate specifies:

Target IELTS writing band.

Current estimated proficiency.

Academic or General Training.

IELTS examination date.

Daily preparation availability.

Writia then builds a dynamic learning sequence.

Example: 30-day preparation plan

Period

Learning priority

Days 1–5

Diagnostic assessment and grammar foundations

Days 6–10

Sentence construction and paraphrasing

Days 11–15

Paragraph development and coherence

Days 16–20

Task 1 and Task 2 composition

Days 21–25

Timed writing and targeted improvement

Days 26–30

Full mock tests and final revision

This is illustrative, not a fixed curriculum. The actual schedule should change when performance data indicates that a skill needs more or less attention.

8. The relationship between the modules
This is how I would make the whole ecosystem work together.

Writia's learning ecosystem
Diagnostic Writing Assessment

Establish baseline proficiency and identify weaknesses

Adaptive Prep Plan

Select priorities, learning sequence and difficulty

Writing Drills

Isolated skill development

Guided Practice

Applied skill development

AI Writing Coach

Adaptive instruction and personalised intervention throughout learning

Writing Studio

Independent writing and timed examination simulation

Assessment & Performance History

Measure improvement and update learner intelligence

Continuous adaptive learning loop

The AI Writing Coach is not just another module in this architecture. It is the instructional intelligence that can operate across the other modules.

9. Development roadmap
I wouldn't attempt to build every feature simultaneously. I would develop Writia in four phases.

Phase 1
Core writing platform

Writing Studio (Task 1 and Task 2).

Question Bank.

Essay submission and storage.

IELTS-aligned assessment.

Detailed feedback.

Assessment Archive.

Phase 2
Adaptive AI coaching

Gemini-powered Writing Coach.

Realtime text interaction.

Guided Writing.

Adaptive scaffolding.

Draft revisions.

Learner intelligence profile.

Phase 3
Skill development ecosystem

Writing Drills.

Paragraph Writing Studio.

Vocabulary Studio.

Interactive Templates.

Question Analysis Studio.

Contextual learning resources.

Phase 4
Advanced adaptive preparation

Adaptive Prep Plan.

Timed full mock examinations.

Skill transfer verification.

Longitudinal performance analytics.

Advanced personalised revision.

Optional voice-enabled coaching.

10. My most important product recommendations
There are several decisions I would make before starting implementation.

1. Make Writing Studio the centre of the product.

Everything should eventually lead to writing, improving or evaluating an actual piece of writing. Avoid building a platform that is mostly lessons and AI-generated content.

2. Make AI Writing Coach the flagship feature.

This is Writia's equivalent of Speakia's conversational coaching experience. It should be adaptive, context-aware and capable of teaching rather than merely correcting.

3. Prioritise Grammar & Sentence Construction initially.

I would make this the first major instructional competency, followed by paragraph development, coherence and argumentation.

4. Keep coaching and assessment separate.

The coach teaches. The assessment engine evaluates. They share learner intelligence, but should have different responsibilities and evaluation workflows.

5. Build one shared intelligence engine.

Do not create separate learner profiles for Writing Drills, Guided Practice, Writing Coach and Assessment. All modules should contribute to and consume the same skill profile.

6. Avoid answer-generation dependency.

Writia must teach candidates to produce their own writing. Model answers should be instructional references, not substitutes for the candidate's effort.

11. Writia and Speakia: shared product philosophy
Speakia
IELTS Speaking

Speak → Diagnose → Understand → Practise → Re-speak → Transfer

Conversational, voice-first coaching

Writia
IELTS Writing

Write → Diagnose → Understand → Practise → Revise → Transfer

Composition-first, adaptive coaching

Shared foundation

Goal-driven adaptive pedagogy.

Time-aware preparation.

Learner-specific intelligence.

Scaffolded instruction.

Progressive independence.

Performance-based adaptation.

Continuous learning analytics.

My broader vision would be to establish these as two complementary IELTS preparation products, with a shared educational philosophy and potentially reusable AI infrastructure.

Speakia teaches candidates to communicate confidently. Writia teaches candidates to express ideas effectively in writing.

Both should move beyond test preparation as a collection of exercises and become intelligent, personalised learning systems.

One final branding thought: I would keep the name Writia as the standalone product brand, with the positioning Your Personal IELTS Writing Coach.

Recommended next deliverable: A screen-by-screen Writia product specification, including dashboard navigation, module interfaces, user journeys, coaching modes, Firestore schemas and Gemini prompts.



Develop Writia product specification