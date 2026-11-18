Prepia IELTS: Readia + Listenia — full development blueprint
The strongest direction is to build Readia and Listenia as two intelligent receptive-skills systems within one shared Prepia IELTS platform, not as conventional question banks with AI added on top.

They should share a common assessment engine, content intelligence layer, learner profile, analytics infrastructure, and agent orchestration framework. Each module then has its own specialist AI architecture:
- Readia: an AI-powered reading assessment and coaching environment that understands texts, question logic, reading strategies, evidence, and a learner’s comprehension process.
- Listenia: an AI-powered listening assessment and coaching environment that understands spoken content, speaker intent, accents, discourse, audio evidence, and a learner’s listening process.
The key product distinction should be this:

Prepia does not merely give learners tests. It understands what they are practising, why they are struggling, what they should practise next, and how to construct the next learning experience.

That is the architectural opportunity created by combining your existing realtime coaching philosophy with Gemini's reasoning, agent tools, structured generation, and TTS capabilities.
1. The product architecture
PREPIA IELTS
INTEGRATED IELTS PREPARATION PLATFORM

One learner profile · One intelligence layer · Four skill systems

Prepia Intelligence & Orchestration Layer
Assessment Agent
Test logic and scoring

Learning Agent
Diagnosis and adaptation

Content Agent
Content generation and QA

Profile Agent
Learner memory and progress



Readia
Reading
Text intelligence

Reading simulations

Guided reading coach

Evidence-based analysis

Reading skill analytics


Listenia
Listening
Audio intelligence

Listening simulations

Guided listening coach

Transcript and audio evidence

Listening skill analytics



Speakia
Speaking system

Writia
Writing system


Shared learner and platform infrastructure

Learner profile · Learning history · Skill graph · Test scheduling · Analytics · Content registry · IndexedDB · Firebase services


The two modules should feel distinct in their learning experiences but behave consistently inside Prepia. A learner should not feel they are using two disconnected products.
2. First, preserve authentic IELTS test structures
The product needs two clearly separated modes of operation:
1. Exam simulation: authentic test structure, controlled timing, fixed question sets, no coaching interruptions, and assessment after submission.
2. Guided practice: an AI coach that can pause, explain, scaffold, ask diagnostic questions, replay selected audio, reveal evidence, and adapt the next exercise.
These modes can use the same underlying content and assessment objects, but they must not use the same interaction rules.

For the standard IELTS formats, Listening has four parts and 40 questions, with the recording played once in the test. Reading has 40 questions in 60 minutes; Academic Reading uses three long texts, while General Training Reading uses three sections with a different text composition. 
IELTS Academic: Listening test format+3


This gives us the assessment constraints around which the AI system should be built.
3. Gemini-powered orchestration architecture
This is where I would make Prepia substantially more sophisticated than a typical IELTS platform.

I recommend a supervisor-led, multi-agent architecture with deterministic workflow control.

The agents should not simply be independent chatbots. They should be specialised components operating under a central orchestration system, with access to defined tools, structured data, learner history, content registries, and assessment policies.
3.1 Recommended AI technology stack
Live coaching
Core experience

Gemini 3.8 Live
Low-latency, bidirectional conversational coaching. Use it for live learner interaction, spoken explanations, diagnostic dialogue, and adaptive coaching.

Deep reasoning and complex orchestration
High reasoning

Gemini 3.8 Live Extended Thinking / suitable Gemini reasoning models
Use higher-reasoning models for complex learner diagnosis, difficult content analysis, generation review, and multi-step decisions. Keep ordinary UI interactions on faster models.

Listening audio generation
Gemini 3.8 Flash TTS
Studio-quality listening recordings, controlled voice characteristics, dialogue, accents, pacing, pauses, and performance.

High-volume audio production
Gemini 3.8 Flash-Lite TTS
More economical bulk generation and routine single-speaker recordings.

Agent orchestration
Google Agent Development Kit (ADK)
Workflow agents, specialist agents, tools, routing, orchestration, and execution evaluation.

These are model families and capabilities documented by Google as of November 2026. The distinction between Live interaction and dedicated TTS is particularly important: dedicated TTS is designed for controlled recitation, whereas Live is intended for dynamic interaction. 
Google AI+2


For your existing React and Firebase development environment, I would use the TypeScript ADK implementation for the orchestration layer, subject to a small technical proof of concept. ADK supports TypeScript and both predictable workflow orchestration and agent-directed routing. 
Google Cloud Documentation+1

3.2 The central Prepia orchestrator
This is the most important component.

Create one central service:

PrepiaOrchestrator

Its responsibility is to understand an incoming request, retrieve the appropriate learner and content context, select the workflow, coordinate specialist agents, validate the result, and persist the outcome.

For example:

A learner opens Readia and selects:

Academic Reading → Guided Practice → Matching Headings → Intermediate difficulty.

The orchestrator should:
1. Retrieve the learner's reading profile and previous attempts.
2. Determine the current skill priority.
3. Retrieve available topics and exclude previously consumed or similar topics.
4. Create a practice blueprint.
5. Allocate an appropriate passage and question set.
6. Verify question and answer validity.
7. Deliver the content to the learner's browser.
8. Start the appropriate guided coaching session.
9. Collect learner responses and interaction events.
10. Update skill estimates and learning analytics.
11. Recommend the next learning activity.
The learner should experience one seamless process. The orchestration layer manages the complexity behind the scenes.
3.3 Specialist agents
I recommend the following agent ecosystem.
Agent	Main responsibility
Learner Intelligence Agent	Understands the learner's current abilities, weaknesses, goals and history
Assessment Planning Agent	Produces assessment blueprints and selects test configurations
Topic Intelligence Agent	Finds suitable topics and prevents repetition
Reading Content Agent	Creates and develops reading passages
Listening Script Agent	Creates realistic listening scenarios and dialogue
Question Architecture Agent	Creates questions, distractors, answer keys and evidence mappings
Content Validation Agent	Independently audits content and questions
Difficulty Calibration Agent	Checks difficulty, linguistic complexity and suitability
Audio Production Agent	Directs TTS generation and manages recordings
Audio Quality Agent	Checks transcript fidelity, speech quality and audio timing
Assessment Agent	Scores objective responses and calculates assessment results
Reading Coach Agent	Coaches comprehension, evidence identification and reading strategies
Listening Coach Agent	Coaches listening comprehension, speaker tracking and auditory strategies
Learning Analytics Agent	Identifies progress, persistent weaknesses and improvement patterns
Study Planner Agent	Plans future practice based on goals and available preparation time

You should not give all these agents unrestricted authority. Each should have a limited set of tools and permissions.

For instance, the Reading Content Agent can propose a passage, but it cannot publish it. The Question Architecture Agent can propose an answer key, but the Validation Agent must independently verify it. The Assessment Agent can read the final answer key but cannot rewrite it.

This separation is essential to quality.
3.4 The orchestration workflow
#chatgpt-mermaid-_r_ss_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_ss_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_ss_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_ss_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_ss_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_ss_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_ss_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_ss_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_ss_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_ss_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ss_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ss_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_ss_ p{margin:0;}#chatgpt-mermaid-_r_ss_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_ss_ .label text,#chatgpt-mermaid-_r_ss_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .node rect,#chatgpt-mermaid-_r_ss_ .node circle,#chatgpt-mermaid-_r_ss_ .node ellipse,#chatgpt-mermaid-_r_ss_ .node polygon,#chatgpt-mermaid-_r_ss_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .rough-node .label text,#chatgpt-mermaid-_r_ss_ .node .label text,#chatgpt-mermaid-_r_ss_ .image-shape .label,#chatgpt-mermaid-_r_ss_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_ss_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .rough-node .label,#chatgpt-mermaid-_r_ss_ .node .label,#chatgpt-mermaid-_r_ss_ .image-shape .label,#chatgpt-mermaid-_r_ss_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_ss_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_ss_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ss_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ss_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_ss_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_ss_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ss_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ss_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_ss_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_ss_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ss_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_ss_ .icon-shape,#chatgpt-mermaid-_r_ss_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_ss_ .icon-shape p,#chatgpt-mermaid-_r_ss_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_ss_ .icon-shape .label rect,#chatgpt-mermaid-_r_ss_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ss_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_ss_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_ss_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_ss_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_ss_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_ss_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ss_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_ss_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_ss_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ss_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_ss_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_ss_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ss_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_ss_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ss_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_ss_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_ss_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_ss_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_ss_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .node rect,#chatgpt-mermaid-_r_ss_ .node circle,#chatgpt-mermaid-_r_ss_ .node ellipse,#chatgpt-mermaid-_r_ss_ .node polygon,#chatgpt-mermaid-_r_ss_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_ss_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_ss_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_ss_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_ss_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ss_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Learner Request or ScheduledActivityPrepia OrchestratorRetrieve Learner ProfileRetrieve Content and TopicRegistryAssessment Planning AgentTopic Intelligence AgentReserve Unique TopicContent Generation AgentQuestion Architecture AgentIndependent Validation AgentQuality Gate Passed?Revision and RevalidationPublish Content PackageIndexedDB DeliveryLearner Practice or Mock TestAssessment and EvidenceAnalysisLearning Analytics AgentUpdate Learner ProfileNext Best Learning ActivityNoYes





The system should use structured outputs for machine-readable blueprints and content objects, and function calling for actual operations such as topic reservation, content retrieval, validation, publication, and profile updates. Gemini supports both patterns, but structured JSON alone does not guarantee semantic correctness; application-level validation remains necessary. 
Google AI+1


4. The most important shared subsystem: Topic Intelligence
I would build this early because it affects both modules, especially Readia.

Your topic library should become an intelligent topic registry rather than a list of titles.
4.1 Topic Library structure
Every topic should have:
Field	Example
Topic ID	TOP-000124
Domain	Environment
Main topic	Urban biodiversity
Subtopic	Wildlife corridors in cities
Topic angle	Ecological benefits of urban planning
Complexity	Intermediate
Vocabulary range	B1–C1
Discourse style	Explanatory / argumentative
Related topics	Urban green spaces, habitat restoration
Semantic fingerprint	Embedding and topic metadata
Usage status	Available / reserved / used
Content references	Passage and test IDs

Domains should cover areas such as science, education, environment, technology, culture, history, economics, health, society, architecture, psychology, agriculture, business, and transport.

The important part is that the topic system must understand semantic similarity.

For example, these should not automatically be considered completely different topics:
- Urban green spaces
- The importance of city parks
- Improving biodiversity in metropolitan areas
- Green infrastructure and urban wildlife
They may represent substantially overlapping reading content.
4.2 The no-repetition mechanism
Build a dedicated service:

TopicIntelligenceService

Its job is to enforce content uniqueness.

The selection pipeline should work as follows:
1. Retrieve all previously consumed topics for the learner.
2. Retrieve all topics used in the relevant test history.
3. Exclude exact topic IDs.
4. Compare topic embeddings and semantic descriptions against previous topics.
5. Exclude highly similar topics or previously used topic angles.
6. Select an available topic.
7. Reserve it transactionally.
8. Generate the content.
9. Commit the reservation when the content is published or its test is actually delivered, according to the usage policy.
I recommend maintaining two separate records:

Global content exposure: which topics have been used across the platform's published content.

Individual learner exposure: which topics a particular learner has actually encountered.

This distinction matters. It permits you to build a large content library without showing the same topic repeatedly to the same learner.

Also add an exclusion policy for concurrent generation. Otherwise, two agents could select and generate content from the same supposedly unused topic simultaneously.
#chatgpt-mermaid-_r_t7_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_t7_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_t7_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_t7_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_t7_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_t7_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_t7_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_t7_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_t7_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_t7_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_t7_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_t7_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_t7_ p{margin:0;}#chatgpt-mermaid-_r_t7_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_t7_ .label text,#chatgpt-mermaid-_r_t7_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .node rect,#chatgpt-mermaid-_r_t7_ .node circle,#chatgpt-mermaid-_r_t7_ .node ellipse,#chatgpt-mermaid-_r_t7_ .node polygon,#chatgpt-mermaid-_r_t7_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .rough-node .label text,#chatgpt-mermaid-_r_t7_ .node .label text,#chatgpt-mermaid-_r_t7_ .image-shape .label,#chatgpt-mermaid-_r_t7_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_t7_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .rough-node .label,#chatgpt-mermaid-_r_t7_ .node .label,#chatgpt-mermaid-_r_t7_ .image-shape .label,#chatgpt-mermaid-_r_t7_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_t7_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_t7_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_t7_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_t7_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_t7_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_t7_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_t7_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_t7_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_t7_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_t7_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_t7_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_t7_ .icon-shape,#chatgpt-mermaid-_r_t7_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_t7_ .icon-shape p,#chatgpt-mermaid-_r_t7_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_t7_ .icon-shape .label rect,#chatgpt-mermaid-_r_t7_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_t7_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_t7_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_t7_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_t7_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_t7_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_t7_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_t7_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_t7_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_t7_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_t7_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_t7_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_t7_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_t7_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_t7_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_t7_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_t7_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_t7_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_t7_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_t7_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .node rect,#chatgpt-mermaid-_r_t7_ .node circle,#chatgpt-mermaid-_r_t7_ .node ellipse,#chatgpt-mermaid-_r_t7_ .node polygon,#chatgpt-mermaid-_r_t7_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_t7_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_t7_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_t7_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_t7_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_t7_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}New Test RequestGet Candidate TopicsRead Learner Exposure LedgerRead Global Content RegistrySemantic Similarity CheckPreviously Used or Too Similar?Exclude CandidateReserve TopicGenerate and Validate ContentApproved?Release ReservationCommit Exposure RecordYesNoNoYes





Use a configurable similarity threshold and retain a human-review override for borderline cases. Do not rely exclusively on an LLM instruction saying not to repeat topics; enforce uniqueness through database queries and transaction rules.
4.3 Topic intelligence should also support variety
Uniqueness is only one objective. The system should also diversify:
- Topics and subtopics.
- Text structures.
- Argumentative versus explanatory passages.
- Vocabulary domains.
- Question-type distributions.
- Speaker situations.
- Accents and conversation patterns.
- Reading and listening difficulty.
This gives every learner a progressively varied experience.
5. Readia — reading system architecture
Readia should be developed around three major capabilities:
1. Reading assessment.
2. AI-guided reading practice.
3. Reading intelligence and progress analysis.
It needs to go beyond presenting a text followed by 13 questions. The AI should understand the text, its logical structure, the evidence behind each answer, and the cognitive skill required to solve the question.
5.1 Readia module structure
I recommend this product architecture:
READIA
AI-powered Reading Assessment & Learning System
Test Studio
Full mock tests and sectional simulations

Reading Coach
Live AI-guided comprehension

Reading Practice
Skill-based exercises and drills

Reading Insights
Performance and learning analytics

Reading Library
Topics, passages and content packages

Learning Path
Personalised practice progression



5.2 Reading content generation engine
This is one of Readia's foundational development components.

Build a ReadingContentEngine.

It should generate content according to a controlled blueprint, not ask a generic LLM to write a passage and invent questions afterwards.

Each reading content package should contain:

A. Passage metadata
- Reading module: Academic or General Training.
- Section number.
- Topic and subtopic.
- Difficulty.
- Intended vocabulary level.
- Word count.
- Text type.
- Discourse structure.
- Paragraph structure.
- Intended reading skills.
B. Reading passage

The actual original passage, divided into identifiable paragraphs and sentences.

Give every passage a stable ID and every paragraph a stable paragraph ID. These identifiers will become essential for evidence tracking, highlighting, and analytics.

C. Passage intelligence map

This is particularly important.

The generation agent should produce a machine-readable understanding of the passage:
interface PassageIntelligence {
  passageId: string;
  mainIdea: string;

  paragraphs: {
    paragraphId: string;
    mainFunction: string;
    keyIdeas: string[];
    supportingEvidence: string[];
    vocabularyTargets: string[];
    relationships: string[];
  }[];

  argumentStructure: {
    claim: string;
    supportingArguments: string[];
    counterArguments: string[];
    conclusion: string;
  };

  semanticMap: {
    concept: string;
    paragraphIds: string[];
    relatedConcepts: string[];
  }[];
}


This allows the Reading Coach to understand the passage rather than simply retrieve its text.

D. Question package

Each question should have:
- Question ID.
- Question type.
- Question text.
- Options, where applicable.
- Correct answer.
- Alternative acceptable answers.
- Answer explanation.
- Supporting paragraph.
- Exact evidence span.
- Paraphrase relationship.
- Skill being assessed.
- Difficulty level.
- Distractor explanation.
The evidence relationship should be mandatory.

For example, for a True / False / Not Given question, the system should know precisely why the passage supports, contradicts, or does not establish the statement.
5.3 Reading question architecture
Implement a dedicated question engine supporting the main IELTS task families.
Question family	Supported exercises
Multiple choice	Single and multiple answers
True / False / Not Given	Factual claims
Yes / No / Not Given	Writer's views and claims
Matching headings	Paragraph and section headings
Matching information	Identifying paragraph information
Matching features	People, theories, dates, ideas
Matching sentence endings	Sentence completion through options
Sentence completion	Exact information from the text
Summary completion	Words, phrases and options
Note completion	Structured information
Table completion	Data and factual relationships
Flow-chart completion	Processes and sequences
Diagram labelling	Text-related visual information
Short-answer questions	Concise factual responses

Build each task type as a separate component with its own validation and scoring logic.

Do not use one generic question component for every task type. The interaction, instructions, answer structure, and answer validation differ.
5.4 Reading Coach: the main differentiator
This is where I would reuse the learning philosophy established in Speakia: learner chooses, AI adapts.

A learner should be able to select the kind of assistance they want, while the coach dynamically adjusts its scaffolding based on the learner's responses.

I recommend the following coaching modes.
1. Guided Reading
Core mode

The coach guides the learner through a passage and progressively develops comprehension.

Typical interaction:
- Read a paragraph.
- Identify its main idea.
- Answer an interpretive question.
- Explain the reasoning.
- Receive targeted feedback.
- Move to the next paragraph.
  
  2. Evidence Hunter
The learner identifies the exact passage evidence supporting an answer. The coach probes their reasoning instead of immediately revealing the answer.

3. Question Solver

The learner works through one selected IELTS question type. The coach helps them understand the question, identify clues, locate evidence and eliminate distractors.

4. Strategy Coach

Practice specific reading strategies:
- Skimming.
- Scanning.
- Identifying main ideas.
- Recognising paraphrasing.
- Understanding inference.
- Following argument structure.
- Identifying writer opinions.

5. Vocabulary in Context

Learners explore difficult vocabulary, contextual meanings, synonyms, collocations and paraphrased expressions using the passage itself.

6. Timed Reading

A controlled practice environment where the learner works against a time target and receives analysis afterwards.

7. Review and Reflection

The learner revisits incorrect answers, explains their reasoning and attempts a new, similar question.

5.5 Realtime AI interaction for Readia
I would not limit the Reading Coach to a text chatbot.

Make it a multimodal coaching experience where:
- The reading passage remains visible.
- Questions remain accessible in a separate panel.
- The learner can select text or paragraphs.
- The learner can explain their reasoning through voice.
- The AI coach can respond through voice and text.
- The coach can highlight relevant evidence in the passage.
- The coach can adapt its next question based on the learner's response.
For example:

AI Coach: What do you think the writer is trying to establish in paragraph three?

Learner: I think the writer is explaining that cities are becoming more crowded.

AI Coach: That's part of the context. Look at the final two sentences again. Is the writer simply describing population growth, or explaining a consequence of it?

Learner: Perhaps the consequence is the loss of green spaces.

AI Coach: Exactly. Now locate the phrase that supports your interpretation.

The coach should use a graduated scaffolding policy:
1. Wait for the learner's independent attempt.
2. Offer a conceptual hint.
3. Direct attention to a paragraph.
4. Show a relevant sentence or clue.
5. Reveal the explanation only when necessary.
This preserves meaningful learning rather than turning the coach into an answer-revealing machine.
5.6 Reading skill intelligence
Readia should maintain a multidimensional reading skill profile.
Skill dimension	What the system measures
Main idea recognition	Understanding the central message
Specific information	Locating factual details
Inference	Understanding implied information
Paraphrase recognition	Connecting equivalent expressions
Vocabulary in context	Understanding contextual meaning
Writer's views	Recognising opinions and attitudes
Argument analysis	Following claims and supporting reasoning
Reference and cohesion	Understanding relationships between ideas
Question interpretation	Understanding what the task actually asks
Evidence selection	Identifying relevant textual evidence
Time management	Completing questions efficiently
Distractor recognition	Avoiding misleading alternatives

A learner should not simply receive the message that they scored 26/40.

Readia should explain that, for example, the learner is relatively good at locating factual details but struggles with paraphrase recognition and identifying implied meanings.

That is much more actionable.

6. Listenia — listening system architecture
Listenia should be built around a different kind of intelligence.

Reading is primarily a text-comprehension problem. Listening is a real-time auditory comprehension problem.

Listenia therefore requires an audio production pipeline, audio asset management, speaker and discourse intelligence, and a coaching environment that understands how spoken information unfolds.
6.1 Listenia module structure
LISTENIA
AI-powered Listening Assessment & Learning System
Listening Studio
Full and sectional tests

Listening Coach
Realtime guided coaching

Audio Library
Generated recordings and transcripts

Listening Intelligence
Auditory skill analysis

Listening Drills
Targeted listening exercises

Listening Insights
Performance and progress



6.2 The Listening Content Engine
Create:

ListeningContentEngine

It should generate complete listening content packages with five connected components.

A. Listening scenario

Examples:
- Hotel or accommodation enquiry.
- Travel arrangements.
- Workplace discussion.
- Community information announcement.
- University assignment discussion.
- Academic lecture.
- Research presentation.
Each scenario should have a context, communicative purpose, speaker configuration and listening skill objectives.

B. Canonical listening script

The exact approved dialogue or monologue from which the recording is generated.

The script should include:
- Speaker identities.
- Individual speaking turns.
- Natural speech characteristics.
- Information sequence.
- Paraphrasing.
- Distractors.
- Self-corrections.
- Clarifications.
- Relevant discourse markers.
- Answer-bearing statements.
C. Audio intelligence map

This is the equivalent of the Reading Passage Intelligence Map.

It should identify:
- Speaker IDs.
- Speaker characteristics.
- Turn sequence.
- Important information.
- Key answer-bearing statements.
- Paraphrased expressions.
- Distractor events.
- Corrections and changed information.
- Transitions.
- Important timestamps.
D. Questions and answer key

Questions should be linked to exact spoken information.

E. Audio asset

The recording, its transcript, duration, technical metadata and version information.
6.3 The dedicated Gemini TTS production pipeline
You already have a conversational TTS capability. I would turn it into a complete audio production studio, not simply an audio playback generator.
#chatgpt-mermaid-_r_uf_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_uf_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_uf_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_uf_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_uf_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_uf_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_uf_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_uf_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_uf_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_uf_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_uf_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_uf_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_uf_ p{margin:0;}#chatgpt-mermaid-_r_uf_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_uf_ .label text,#chatgpt-mermaid-_r_uf_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .node rect,#chatgpt-mermaid-_r_uf_ .node circle,#chatgpt-mermaid-_r_uf_ .node ellipse,#chatgpt-mermaid-_r_uf_ .node polygon,#chatgpt-mermaid-_r_uf_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .rough-node .label text,#chatgpt-mermaid-_r_uf_ .node .label text,#chatgpt-mermaid-_r_uf_ .image-shape .label,#chatgpt-mermaid-_r_uf_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_uf_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .rough-node .label,#chatgpt-mermaid-_r_uf_ .node .label,#chatgpt-mermaid-_r_uf_ .image-shape .label,#chatgpt-mermaid-_r_uf_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_uf_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_uf_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_uf_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_uf_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_uf_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_uf_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_uf_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_uf_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_uf_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_uf_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_uf_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_uf_ .icon-shape,#chatgpt-mermaid-_r_uf_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_uf_ .icon-shape p,#chatgpt-mermaid-_r_uf_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_uf_ .icon-shape .label rect,#chatgpt-mermaid-_r_uf_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_uf_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_uf_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_uf_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_uf_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_uf_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_uf_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_uf_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_uf_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_uf_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_uf_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_uf_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_uf_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_uf_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_uf_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_uf_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_uf_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_uf_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_uf_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_uf_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .node rect,#chatgpt-mermaid-_r_uf_ .node circle,#chatgpt-mermaid-_r_uf_ .node ellipse,#chatgpt-mermaid-_r_uf_ .node polygon,#chatgpt-mermaid-_r_uf_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_uf_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_uf_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_uf_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_uf_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_uf_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Listening BlueprintDialogue and Script AgentSpeaker and Accent DesignerQuestion and EvidenceMappingGemini TTS Production AgentAudio RenderingAudio Processing andNormalisationSpeech Transcription andAlignmentAudio Quality AgentAudio and Script Match?Re-render or ReviseFinal Audio PackagingPublish Listening PackageNoYes





My preferred model allocation would be:
Production job	Model
Complex multi-speaker recordings	Gemini 3.8 Flash TTS
Long-form lectures and monologues	Gemini 3.8 Flash TTS
Standard bulk recordings	Gemini 3.8 Flash-Lite TTS
Audio transcript verification	Suitable Gemini transcription model
Natural spoken coaching	Gemini 3.8 Live

Google's current TTS implementation supports controlled speech styles, accents, pace, tone and multi-speaker dialogue. One technical constraint matters: a single multi-speaker TTS request supports up to two speakers using prebuilt voices. More complex multi-character recordings require individually synthesising speaker turns and carefully assembling them. 
AI Studio+2

6.4 Build a reusable audio production engine
Do not generate the same audio repeatedly every time someone takes a test.

Create a reusable asset registry.

Every recording should be stored with:
interface ListeningAudioAsset {
  audioId: string;
  scriptId: string;
  version: number;

  audioFormat: "wav" | "mp3" | "ogg";
  durationMs: number;
  sampleRate: number;

  modelId: string;
  voiceConfiguration: {
    voiceId: string;
    accent: string;
    speakingStyle: string;
    pace: string;
  };

  scriptHash: string;
  audioChecksum: string;

  transcriptId: string;
  qualityStatus: "pending" | "approved" | "rejected";
}


Use the audio ID and content hash to prevent unnecessary regeneration.

The production pipeline should also support:
- Generating speaker voices.
- Creating natural conversational exchanges.
- Configuring accents.
- Controlling speech speed.
- Introducing natural pauses.
- Creating lecture-style recordings.
- Producing audio variants when legitimately required.
- Normalising volume.
- Checking silence and clipping.
- Validating audio duration.
- Verifying that the generated speech follows the canonical script.
A crucial point: the TTS recording must be checked against the approved script, not the other way around. If the generated audio omits, changes or mispronounces an answer-bearing detail, it must not be published without correction.

I would generate shorter logical audio segments where appropriate, maintain exact transcript-to-segment relationships, and assemble the final section as a seamless recording.
6.5 Listenia question architecture
Implement the major IELTS Listening question types as independent task components.
Question type	Required interaction
Multiple choice	Select one or multiple options
Matching	Match statements to options
Form completion	Enter factual information
Note completion	Complete structured notes
Table completion	Fill information into tables
Flow-chart completion	Complete a process
Summary completion	Supply missing information
Sentence completion	Enter words or numbers
Short-answer questions	Provide concise responses
Map labelling	Label locations
Plan labelling	Identify positions and directions
Diagram labelling	Identify visual components

Each question must have answer validation, word-limit validation where relevant, spelling rules, answer equivalence rules, and a link to the relevant audio evidence.
6.6 Listenia's Guided Listening Coach
This should be one of the most exciting parts of Prepia.

The coaching experience should focus on understanding spoken language, rather than only replaying recordings and showing correct answers.

I recommend these modes:
1. Guided Listening

The learner listens to a recording or segment and receives progressive coaching to identify the main idea, important details and speaker intentions.

2. Active Listening

Focus on understanding important information without reading the transcript first.

3. Detail Detection

Identify names, dates, numbers, addresses, factual details, corrections and specific information.

4. Speaker Intelligence

Understand who is speaking, what each person believes, how opinions differ, and how the conversation develops.

5. Paraphrase Recognition

Identify when the speaker expresses the same meaning using different words from those in the question.

6. Distractor Awareness

Understand misleading information, changed arrangements, corrections, contradictions and alternative options.

7. Accent and Speech Comprehension

Practise comprehension across different English accents, speech rates and natural connected speech.

8. Transcript Analysis

Unlock the transcript after an initial listening attempt and compare what the learner heard with what was actually said.

9. Listening Reflection

The coach identifies why the learner missed information and helps them develop a strategy for the next attempt.

6.7 The realtime coaching experience
Listenia should offer a voice-first coach, but the coach must not interfere with the actual listening exercise.

I recommend a three-stage learning interaction:

Stage 1 — Listen

The learner listens to the recording and attempts the questions without being interrupted by the AI.

Stage 2 — Diagnose

The coach analyses the learner's answers, response patterns and audio evidence.

Stage 3 — Coach

The learner enters a realtime voice conversation with the AI coach.

Example:

AI Coach: You selected option B. What did you hear that made you choose it?

Learner: The speaker initially said the meeting would be on Thursday.

AI Coach: That's correct, but did the speaker maintain that arrangement?

Learner: No, I think the speaker changed it.

AI Coach: Exactly. This is an example of a distractor created through self-correction. Let's examine how the final arrangement was communicated.

The coach should also be able to direct the learner to the relevant audio segment, replay it in learning mode, and then unlock the corresponding transcript.

Importantly, full IELTS-style mock exams should retain one-play audio conditions. Replay and transcript access belong to guided practice and post-test review, not strict exam simulation. 
IELTS Academic: Listening test format+1

6.8 Listening skill intelligence
Listenia needs an independent learner skill graph.
Skill dimension	What it measures
Main idea recognition	Understanding overall meaning
Specific detail recognition	Extracting precise information
Speaker identification	Tracking individual speakers
Speaker attitude	Understanding feelings and opinions
Purpose recognition	Understanding why something is said
Paraphrase recognition	Mapping spoken and written expressions
Discourse tracking	Following how ideas develop
Distractor detection	Recognising misleading information
Connected speech	Understanding natural speech patterns
Number and spelling accuracy	Capturing precise factual details
Accent comprehension	Understanding different English accents
Sustained attention	Maintaining listening comprehension
Information retention	Remembering relevant spoken details

For both modules, skill estimates should be based on observed responses, question difficulty, repeated attempts, and interaction evidence rather than simply assigning proficiency levels based on one test.

7. Full mock test and assessment engine
This should be a shared Prepia infrastructure component, not two separately programmed test systems.

Create:

UnifiedAssessmentEngine

It should manage:
- Test blueprints.
- Test generation.
- Test assembly.
- Test validation.
- Timers.
- Navigation.
- Question state.
- Response capture.
- Autosaving.
- Submission.
- Objective scoring.
- Result generation.
- Review.
- Test history.
7.1 Assessment configurations
The system should support the following configurations.
Assessment	Readia	Listenia
Full Academic mock	3 passages, 40 questions	4 parts, 40 questions
Full General Training mock	3 sections, 40 questions	4 parts, 40 questions
Sectional simulation	Individual reading sections	Individual listening parts
Question-type assessment	Selected question family	Selected question family
Skill diagnostic	Skill-focused reading test	Skill-focused listening test
Adaptive assessment	Personalised assessment	Personalised assessment
Guided assessment	Coach-supported test	Coach-supported test
Familiarisation test	Interface and format experience	Interface and audio experience

7.2 Test generation should be blueprint-driven
Create an AssessmentBlueprint before generating the actual test.

For example:
interface AssessmentBlueprint {
  assessmentId: string;

  module: "reading" | "listening";
  format: "academic" | "general";
  type: "full_mock" | "sectional" | "diagnostic" | "practice";

  difficultyProfile: {
    targetLevel: number;
    distribution: number[];
  };

  sectionPlan: {
    sectionNumber: number;
    topicId: string;
    contentType: string;
    questionCount: number;
    questionTypes: string[];
    targetDurationSeconds: number;
  }[];

  topicExclusionRequired: boolean;

  qualityPolicyVersion: string;
  scoringPolicyVersion: string;
}


The blueprint is the contract that every subsequent generation agent must follow.

The system must verify that all requirements have been fulfilled before assembling the test.
7.3 Examination conditions
The exam simulation must have deterministic behaviour.

Readia:
- Fixed 60-minute timer.
- All three sections accessible through a controlled interface.
- Question navigation.
- Flag for review.
- Answer autosave.
- No coaching interruptions.
- Final submission and review.
Listenia:
- Audio preloaded and verified before starting.
- Four-part structure.
- Audio played once in exam mode.
- Question preview time.
- Controlled audio progression.
- Answer autosave.
- Final submission.
- Review after completion.
For Listening, distinguish the practice platform's settings from the official test format. The General Training paper traditionally allows 10 minutes for transferring answers; computer-delivered formats and their on-screen answer procedures differ. Do not hard-code one transfer experience across every delivery format. 
IELTS+2

7.4 Objective scoring engine
Do not use Gemini to determine the correctness of objective test answers.

Build a deterministic scoring service.

For every question, compare the submitted response with approved answer rules.

For example:
interface AnswerValidationRule {
  questionId: string;

  acceptedAnswers: string[];
  caseSensitive: boolean;

  wordLimit?: number;
  numberOfRequiredAnswers: number;

  spellingPolicy: "strict" | "configured";
  punctuationPolicy: "configured";
}


The engine calculates:
- Correct answers.
- Incorrect answers.
- Unanswered questions.
- Raw score out of 40.
- Section-wise score.
- Question-type accuracy.
- Skill-level performance.
- Indicative band estimate.
Important scoring decision: Raw marks must remain authoritative. Band conversion must be stored in a versioned scoring configuration. IELTS states that the raw marks required for a particular Listening or Reading band can vary slightly between test versions, and General Training Reading has different conversion characteristics from Academic Reading. 
IELTS+1


Therefore, avoid advertising an automatically calculated practice band as an official or guaranteed equivalent. Label it an indicative practice estimate.

8. Content management system — the Prepia Content Studio
I would build a dedicated internal administration environment rather than manage all AI generation through scattered developer scripts.

Call it:

Prepia Content Studio

This should manage the entire content lifecycle for Readia and Listenia.
Prepia Content Studio
INTERNAL CONTENT AND ASSESSMENT WORKSPACE

Topic Library
Create, categorise, reserve and track topics.


Reading Content Studio
Generate and manage passages and question sets.


Listening Production Studio
Generate scripts, voices, recordings and transcripts.


Assessment Blueprint Studio
Construct full mocks and sectional tests.


AI Generation Console
Run, inspect and troubleshoot agent workflows.


Quality Assurance Centre
Review evidence, answers, difficulty and audio.


Publishing Manager
Version, approve, publish and archive content.


Analytics Console
Inspect content quality and usage.


8.1 Content lifecycle
Every piece of content should follow a controlled lifecycle:
#chatgpt-mermaid-_r_10f_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_10f_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_10f_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_10f_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_10f_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_10f_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_10f_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_10f_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_10f_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_10f_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_10f_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_10f_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_10f_ p{margin:0;}#chatgpt-mermaid-_r_10f_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_10f_ .label text,#chatgpt-mermaid-_r_10f_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .node rect,#chatgpt-mermaid-_r_10f_ .node circle,#chatgpt-mermaid-_r_10f_ .node ellipse,#chatgpt-mermaid-_r_10f_ .node polygon,#chatgpt-mermaid-_r_10f_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .rough-node .label text,#chatgpt-mermaid-_r_10f_ .node .label text,#chatgpt-mermaid-_r_10f_ .image-shape .label,#chatgpt-mermaid-_r_10f_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_10f_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .rough-node .label,#chatgpt-mermaid-_r_10f_ .node .label,#chatgpt-mermaid-_r_10f_ .image-shape .label,#chatgpt-mermaid-_r_10f_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_10f_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_10f_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_10f_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_10f_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_10f_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_10f_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_10f_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_10f_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_10f_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_10f_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_10f_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_10f_ .icon-shape,#chatgpt-mermaid-_r_10f_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_10f_ .icon-shape p,#chatgpt-mermaid-_r_10f_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_10f_ .icon-shape .label rect,#chatgpt-mermaid-_r_10f_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_10f_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_10f_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_10f_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_10f_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_10f_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_10f_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_10f_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_10f_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_10f_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_10f_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_10f_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_10f_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_10f_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_10f_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_10f_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_10f_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_10f_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_10f_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_10f_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .node rect,#chatgpt-mermaid-_r_10f_ .node circle,#chatgpt-mermaid-_r_10f_ .node ellipse,#chatgpt-mermaid-_r_10f_ .node polygon,#chatgpt-mermaid-_r_10f_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_10f_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_10f_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_10f_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_10f_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_10f_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}BlueprintAI GenerationAutomated ValidationIndependent AI ReviewPass?RevisionHuman QA / Approval PolicyApproved VersionPublished ContentLearner DeliveryUsage AnalyticsReview / Retire / UpdateNoYes





Content should never change silently after publication. Every published test must retain the exact passage, script, questions, answer key, audio, scoring policy and model-generation metadata associated with its version.
8.2 Different content creation workflows
Reading workflow

Topic → Passage blueprint → Passage generation → Passage intelligence → Questions → Evidence mapping → Question validation → Difficulty review → Publish

Listening workflow

Scenario → Dialogue blueprint → Script generation → Speaker configuration → Questions → Evidence mapping → TTS → Audio QA → Publish

Full mock workflow

Exam configuration → Topic allocation → Section generation → Content assembly → Exam structure validation → Final test QA → Publish

The mock test builder should only assemble approved content packages. It should not generate everything at the final moment when a learner presses Start Test.

This is how you keep latency low and test quality predictable.
9. Unified Learner Profile and Learning Intelligence
This is where Prepia's four-skill architecture should eventually become more powerful than four separate preparation applications.

The learner profile should be shared by Readia, Listenia, Speakia and Writia.

However, each skill module must maintain its own detailed performance and learning state.
9.1 Learner Profile architecture
Create a unified service:

LearnerIntelligenceService

The profile should have six dimensions.
Profile dimension	Information stored
Learner identity	Name, account, IELTS module and preferences
Preparation goals	Target band, test date and available study time
Baseline assessment	Initial estimated proficiency by skill
Skill intelligence	Strengths, weaknesses and developing competencies
Learning history	Practice sessions, mock tests, drills and coaching
Learning preferences	Preferred coaching approach, scaffolding and practice modes

9.2 Independent receptive skill profiles
For Readia:
interface ReadingLearnerProfile {
  estimatedBand: number;
  rawScoreHistory: number[];

  skills: {
    mainIdea: number;
    specificInformation: number;
    inference: number;
    paraphraseRecognition: number;
    vocabularyInContext: number;
    writerOpinion: number;
    evidenceIdentification: number;
    argumentAnalysis: number;
  };

  questionTypePerformance: Record<string, number>;

  readingSpeed: number;
  timeManagement: number;

  persistentWeaknesses: string[];
  recommendedSkills: string[];
}


For Listenia:
interface ListeningLearnerProfile {
  estimatedBand: number;
  rawScoreHistory: number[];

  skills: {
    mainIdea: number;
    detailRecognition: number;
    speakerAttitude: number;
    speakerIdentification: number;
    paraphraseRecognition: number;
    distractorDetection: number;
    connectedSpeech: number;
    accentComprehension: number;
  };

  questionTypePerformance: Record<string, number>;

  attentionStability: number;
  informationRetention: number;

  persistentWeaknesses: string[];
  recommendedSkills: string[];
}


These are starting schemas, not final proficiency models. Add evidence counts, confidence, observation dates and model versions to every estimate.
9.3 Learner memory and context
A learner's history should not be supplied to Gemini as an enormous conversation transcript every time.

Instead, construct a compact learner context.

For example:
interface LearnerLearningContext {
  learnerId: string;

  targetBand: number;
  examDate?: string;

  currentStrengths: string[];
  currentWeaknesses: string[];

  recentAttempts: string[];
  completedSkills: string[];

  preferredCoachingMode: string;

  nextPriority: string;
  recommendedDifficulty: number;

  topicExclusions: string[];
  lastUpdatedAt: number;
}


The orchestrator retrieves this context when it starts a new activity.

The live coaching agent receives only the relevant subset for the current learning session.

This is more efficient, more consistent and easier to manage.
9.4 Adaptive learning pathway
Do not let the system decide that a learner needs another random mock test simply because they completed the previous one.

Develop a NextBestActivityEngine.

It should evaluate:
- Recent test performance.
- Question-type weaknesses.
- Skill-level gaps.
- Repeated errors.
- Practice frequency.
- Confidence in the estimated skill level.
- Time remaining until the IELTS examination.
- Previous coaching outcomes.
Example:
Illustrative learner development pathway
Reading
Development priority

Factual information

Strong



Paraphrase recognition

Developing



Inference

Needs practice





Recommended next activity

Paraphrase Recognition — Guided Practice

Reason: Recent attempts show difficulty identifying equivalent meaning when the wording changes between the passage and the question.

The recommendation must also be able to explain why an activity was chosen.
9.5 Unified IELTS preparation dashboard
The Prepia dashboard should gradually evolve into an integrated four-skill learning intelligence system.

Recommended overview:
- Target IELTS band and examination date.
- Current indicative overall band estimate.
- Reading progress.
- Listening progress.
- Speaking progress.
- Writing progress.
- Recent assessments.
- Skill development trends.
- Persistent weaknesses.
- Recommended learning activities.
- Study consistency.
- Progress towards the target band.
The module dashboards should go deeper.

Readia Dashboard: reading score trends, question-type performance, passage comprehension, time management, evidence skills and upcoming activities.

Listenia Dashboard: listening score trends, section performance, audio comprehension, distractor mistakes, speaker understanding, accent performance and recommended listening drills.

Do not make every dashboard metric an AI-generated judgement. Distinguish actual measurable data, model-inferred insights, and indicative proficiency estimates.

10. IndexedDB and local-first content architecture
I agree with your choice to build around IndexedDB.

However, I would implement a local-first content delivery architecture with cloud-managed publishing and synchronization, rather than use the browser database as the only copy of every piece of content.

This is an important architectural distinction.

IndexedDB can store significant amounts of structured information, including files and audio blobs, and supports indexed retrieval. However, synchronization is something the application must implement, and browser storage can be cleared or evicted. 
MDN+1

10.1 Recommended storage design
Firebase / Cloud Backend
Authentication · Content Registry · Learner Records · Agent Workflows
Content download / result synchronisation
Prepia Local Data Layer
IndexedDB
Reading packages


Audio assets


Tests and questions


Answer states


Learner history


Sync queue





React Application
Offline delivery · Testing · Coaching interface · Analytics

10.2 Recommended IndexedDB implementation
Use Dexie.js as the IndexedDB wrapper.

It will make database operations, transactions, indexes, version migrations and queries easier to manage.

Suggested stores:
Store	Purpose
contentManifests	Published package versions
topics	Downloaded topic metadata
readingPassages	Reading content
listeningScripts	Canonical transcripts
listeningAudio	Audio Blob assets
questionSets	Question packages
assessmentPackages	Complete mock and sectional tests
attempts	Learner attempts
answerEvents	Individual answer activity
coachSessions	Coaching interaction summaries
learnerProfiles	Local learner snapshot
skillStates	Local skill estimates
recommendations	Pending next activities
syncOutbox	Unsynchronised data
databaseMetadata	Schema and sync versions

10.3 Local-first workflow
When the learner opens a test:
1. Check whether the content package is in IndexedDB.
2. Check its version and integrity.
3. Verify that any required audio assets are available.
4. Download missing content when online.
5. Start the test from the locally stored package.
6. Save every answer and interaction locally.
7. Submit the completed attempt.
8. Add the resulting event to the sync queue.
9. Synchronise with Firebase.
10. Update the cloud learner record and analytics.
This gives you a much more resilient testing experience.
10.4 Offline test support
The architecture should support:
- Offline reading tests.
- Offline listening tests after audio has been downloaded.
- Local answer saving.
- Local timing.
- Session recovery after refresh.
- Offline result calculation.
- Later result synchronisation.
For exam simulation, the app should verify connectivity and content readiness before starting whenever the particular test requires online services. Once a test begins, it should not depend on live Gemini calls to continue.
10.5 Critical local database rules
Implement these from the beginning:

Database migrations: every schema change must have an explicit versioned migration.

Content versioning: published packages must remain immutable for existing test attempts.

Audio management: implement download, Blob storage, asset integrity verification and cache eviction policies.

Persistent storage: request browser storage persistence where available and monitor available quota.

Recovery: store the last known test state frequently enough to recover an interrupted session.

Multi-device synchronisation: use immutable attempt events and idempotent sync operations to avoid duplicate attempts.

Privacy: provide a clear local-data deletion and logout policy, especially for shared devices.

One further recommendation: keep answer keys and privileged content-management records on the backend. Download only what the learner's authorised activity needs, and do not assume browser-stored content is secure against inspection.

11. Technical application architecture
I would organise Prepia as a modular React/TypeScript application with shared services and independent skill modules.
11.1 Recommended stack
Layer	Recommended technology
Frontend	React + TypeScript + Vite
UI	Tailwind CSS + Radix UI + Lucide
State management	Zustand
Server state	TanStack Query
Local database	IndexedDB + Dexie.js
Offline support	Service Worker + PWA
Authentication	Firebase Authentication
Cloud database	Cloud Firestore
Backend endpoints	Firebase Cloud Functions
AI orchestration	Google ADK
Agent runtime	Cloud Run
Background processing	Cloud Tasks / Pub/Sub
AI reasoning	Gemini models
Live coaching	Gemini Live API
Audio generation	Gemini TTS
Audio file storage	Firebase Storage / Google Cloud Storage
Analytics	Firestore event records + aggregation jobs

The browser should be responsible for interface rendering, local test execution and immediate response capture. Gemini should not be called directly from untrusted client code using a privileged API key. Route AI requests through authenticated backend services, with secrets protected server-side. Firebase documents this approach for Gemini integrations and callable functions. 
Firebase+2

11.2 Backend architecture
I recommend dividing the backend into these functional services:
Prepia Backend
│
├── Auth Service
├── Learner Service
├── Assessment Service
├── Content Registry Service
├── Topic Intelligence Service
├── Reading Content Service
├── Listening Content Service
├── Audio Production Service
├── AI Orchestration Service
├── Coaching Session Service
├── Scoring Service
├── Analytics Service
├── Recommendation Service
└── Synchronisation Service


These are logical service boundaries. You do not need to deploy 14 independent microservices. Start with a modular backend and split out the resource-intensive services when required.
11.3 Important architectural separation
I would maintain three separate runtime paths.
Path A — Real-time learner experience

React → Authenticated backend → Gemini Live → Coaching tools → Session state
For realtime conversation and personalised coaching.
Path B — Background content production

Admin → Generation request → Orchestrator → Specialist agents → TTS → QA → Content registry
For longer-running content generation and test preparation.
Path C — Assessment execution

IndexedDB → Local test engine → Answer capture → Deterministic scoring → Analytics synchronisation
For reliable test delivery without model-dependent scoring.
This separation will make the system easier to debug, maintain and scale.
12. Recommended codebase architecture
Because Prepia already has a React-based product and existing Speakia/Writia development, I would avoid building a completely separate application for Readia and Listenia.

Introduce them as independently maintainable feature modules inside the existing Prepia architecture.

Suggested folder structure:
src/
│
├── app/
│   ├── App.tsx
│   ├── routes/
│   ├── providers/
│   └── navigation/
│
├── modules/
│   │
│   ├── readia/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── reading-studio/
│   │   ├── reading-coach/
│   │   ├── reading-practice/
│   │   ├── reading-assessment/
│   │   ├── reading-insights/
│   │   ├── reading-library/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── listenia/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── listening-studio/
│   │   ├── listening-coach/
│   │   ├── listening-practice/
│   │   ├── listening-assessment/
│   │   ├── audio-player/
│   │   ├── transcript-viewer/
│   │   ├── listening-insights/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── speakia/
│   └── writia/
│
├── shared/
│   │
│   ├── assessment-engine/
│   ├── learner-intelligence/
│   ├── learning-analytics/
│   ├── content-registry/
│   ├── topic-intelligence/
│   ├── coaching-engine/
│   ├── recommendations/
│   ├── notifications/
│   └── dashboard/
│
├── infrastructure/
│   ├── firebase/
│   ├── gemini/
│   ├── audio/
│   ├── indexeddb/
│   ├── sync/
│   ├── service-worker/
│   └── monitoring/
│
├── ui/
│   ├── components/
│   ├── layouts/
│   ├── icons/
│   └── theme/
│
└── types/
    ├── learner.ts
    ├── assessment.ts
    ├── content.ts
    └── analytics.ts


Suggested backend structure:
functions/
│
├── src/
│   ├── index.ts
│   │
│   ├── api/
│   │   ├── assessment.api.ts
│   │   ├── learner.api.ts
│   │   ├── content.api.ts
│   │   └── coaching.api.ts
│   │
│   ├── agents/
│   │   ├── supervisor/
│   │   ├── learner/
│   │   ├── assessment/
│   │   ├── topics/
│   │   ├── reading/
│   │   ├── listening/
│   │   ├── questions/
│   │   ├── validation/
│   │   ├── audio/
│   │   └── analytics/
│   │
│   ├── orchestration/
│   │   ├── workflows/
│   │   ├── routing/
│   │   ├── checkpoints/
│   │   └── execution-state/
│   │
│   ├── services/
│   │   ├── topic.service.ts
│   │   ├── content.service.ts
│   │   ├── assessment.service.ts
│   │   ├── audio.service.ts
│   │   ├── scoring.service.ts
│   │   └── learner.service.ts
│   │
│   ├── validators/
│   ├── prompts/
│   ├── schemas/
│   ├── repositories/
│   └── utils/


For larger background jobs, move the orchestration runtime and audio generation workers into a separate Cloud Run application. Keep Firebase Functions as the secure application entry points.

13. Database design and core data entities
Before building the UI, define the domain model properly.

I recommend these central entities:
Entity	Purpose
Learner	Platform learner identity
LearnerProfile	Personalised learning context
SkillProfile	Reading and listening proficiency
Topic	Topic library entry
TopicExposure	Tracks consumed topics
ContentPackage	Published reading or listening asset
ReadingPassage	Passage and intelligence map
ListeningScript	Canonical spoken content
AudioAsset	Generated recording and metadata
QuestionSet	Questions and answer specifications
AssessmentBlueprint	Instructions for test construction
Assessment	Complete test configuration
AssessmentVersion	Immutable published test version
Attempt	Individual learner test attempt
ResponseEvent	Individual answer and interaction
CoachingSession	Guided practice session
CoachingEvent	Learner and AI interaction events
SkillObservation	Evidence of learner ability
LearningRecommendation	Recommended next activity
GenerationJob	AI content production workflow
ValidationReport	QA results and validation evidence

13.1 Suggested Firestore structure
users/
  {userId}/
    profile/
      learnerProfile

    skillProfiles/
      reading
      listening
      speaking
      writing

    attempts/
      {attemptId}

    coachingSessions/
      {sessionId}

    recommendations/
      {recommendationId}

    topicExposure/
      {exposureId}

topics/
  {topicId}

contentPackages/
  {packageId}

assessments/
  {assessmentId}/
    versions/
      {versionId}

generationJobs/
  {jobId}

validationReports/
  {reportId}


The schema should be designed around access patterns, ownership, security rules, and query requirements. Avoid storing large transcripts and full audio blobs inside Firestore documents. Store audio in object storage and reference it from content metadata.
13.2 Event-based learner analytics
I strongly recommend using an event-oriented analytics model.

Every meaningful learning action should create an event.

For instance:
interface LearningEvent {
  eventId: string;
  learnerId: string;
  sessionId: string;

  module: "readia" | "listenia";
  eventType: string;

  contentId?: string;
  questionId?: string;
  skillId?: string;

  occurredAt: number;

  payload: Record<string, unknown>;
}


Example events:
assessment_started
section_opened
question_viewed
answer_selected
answer_changed
answer_submitted
question_flagged
audio_started
audio_completed
audio_replayed
transcript_opened
evidence_highlighted
coach_hint_requested
coach_explanation_viewed
practice_completed
assessment_submitted


For audio, also capture relevant playback progress and segment position in guided learning mode.

These events will allow you to develop richer analytics later without redesigning your data architecture.

14. Development and coding execution agenda
I would not attempt to build everything simultaneously. The project needs to be developed in dependency order.

Below is the implementation sequence I recommend.
Prepia receptive skills development roadmap
12 implementation phases · Shared infrastructure first · Two skill modules · Unified intelligence
1. Phase 1 — Architecture and foundation
   
   Establish module boundaries, TypeScript domain models, Firebase integration, permissions, configuration management, and application routing.
   Foundation
2. Phase 2 — Local database and content delivery
   
   Implement Dexie, IndexedDB schemas, migrations, content package management, audio caching, offline loading, and sync queue.
   Infrastructure
3. Phase 3 — Topic Intelligence Engine
   
   Build the topic library, taxonomy, similarity service, exposure ledger, exclusion rules, topic reservation and lifecycle management.
   Critical dependency
4. Phase 4 — AI orchestration infrastructure
   
   Implement Gemini model adapters, ADK supervisor, specialist agents, workflow checkpoints, structured schemas, tool permissions, monitoring and retries.
   AI foundation
5. Phase 5 — Unified content management
   
   Build Prepia Content Studio, generation jobs, passage and script management, question architecture, answer keys, validation and publishing.
   Content system
6. Phase 6 — Readia assessment system
   
   Develop reading content generation, IELTS question components, exam interface, timer, navigation, deterministic scoring and assessment history.
   Readia MVP
7. Phase 7 — Listenia audio production system
   
   Develop script generation, speaker design, TTS processing, audio QA, transcript alignment, audio library and playback engine.
   Listenia foundation
8. Phase 8 — Listenia assessment system
   
   Implement four-section audio tests, question components, single-play exam rules, audio preparation, answer capture, scoring and assessment history.
   Listenia MVP
9. Phase 9 — Realtime AI coaching
   
   Implement Readia and Listenia coaching sessions, personalised prompting, scaffolded guidance, evidence retrieval, audio segment retrieval and live voice interaction.
   Differentiating capability
10. Phase 10 — Learner intelligence and analytics
    
    Develop skill profiles, performance aggregation, diagnostic reports, error patterns, learning history and next-best-activity recommendations.
    Intelligence layer
11. Phase 11 — Unified Prepia dashboard and integration
    
    Integrate all four skill modules, learning goals, overall profile, preparation timeline and cross-module progress.
    Platform integration
12. Phase 12 — QA, optimisation and production release
    
    Perform assessment validation, accessibility checks, audio testing, database recovery, security audits, performance testing and production deployment.
    Release

Phase-by-phase coding details
Phase 1 — Foundation
First establish the shared architecture and domain contracts.

Development tasks:
- Define module routing for Readia and Listenia.
- Establish independent module layouts.
- Build shared component contracts.
- Configure Firebase services.
- Define TypeScript interfaces.
- Implement authentication and access policies.
- Create model configuration and environment management.
- Set up development and production environments.
Completion condition: Both modules can be opened inside Prepia with working navigation, authentication, shared layout and independent feature boundaries.
Phase 2 — Local database
Implement:
- Dexie database.
- IndexedDB schema.
- Migration manager.
- Content repositories.
- Audio Blob repository.
- Answer persistence.
- Offline session recovery.
- Sync queue.
- Data integrity checks.
- Local storage monitoring.
Completion condition: A learner can download a practice package, open it offline, complete it and retain the results locally.
Phase 3 — Topic Intelligence
Implement:
- Topic taxonomy.
- Topic metadata forms.
- Topic embeddings.
- Semantic similarity search.
- Learner exposure ledger.
- Global exposure ledger.
- Reservation transactions.
- Topic cooldown and exclusion policy.
- Topic allocation API.
Completion condition: Two consecutive test-generation workflows for the same learner cannot silently reuse a prohibited topic or sufficiently similar topic angle.
Phase 4 — AI orchestration
Build the shared agent execution framework.

Suggested implementation:
Orchestrator
  ├── Workflow Registry
  ├── Agent Registry
  ├── Tool Registry
  ├── Context Builder
  ├── Model Router
  ├── Execution Checkpoints
  ├── Retry Manager
  ├── Validation Gate
  └── Audit Logger


Every agent should have:
- A clearly defined purpose.
- Input schema.
- Output schema.
- Allowed tools.
- Model configuration.
- Token and execution limits.
- Error and retry policy.
- Traceable execution history.
Completion condition: A test blueprint can travel through multiple agents and return a valid structured result with complete execution logs.
Phase 5 — Content management
Build Prepia Content Studio and all content pipelines before attempting extensive content generation.

Prioritise the reading pipeline first, followed by the listening pipeline.

Completion condition: An authorised administrator can initiate generation, review its output, inspect validation evidence, revise the content, approve it and publish a versioned package.
Phase 6 — Readia assessment
Build:
1. Reading passage viewer.
2. Question rendering engine.
3. Answer state manager.
4. Question navigator.
5. Timer.
6. Test autosave.
7. Test submission.
8. Scoring engine.
9. Review interface.
10. Attempt history.
Start with Academic Reading, then add General Training using the same engine and different blueprint policies.

Completion condition: A learner can complete an entire 40-question, 60-minute Academic Reading simulation, submit it, receive a deterministically calculated result and inspect answer explanations.
Phase 7 — Listenia audio production
Build:
1. Listening script generator.
2. Speaker configuration.
3. TTS provider adapter.
4. Audio rendering queue.
5. Audio conversion and normalisation.
6. Transcript management.
7. Speech verification.
8. Audio QA.
9. Audio storage.
10. Asset publishing.
Completion condition: An administrator can generate a realistic recording from an approved listening script and publish an audio asset that passes transcript and playback validation.
Phase 8 — Listenia assessment
Develop the complete listening environment, with four parts, 40 questions, audio progression, question preview and exam-mode playback restrictions.

Start by supporting the primary task families, then complete the full interaction catalogue.

Completion condition: A learner can complete a full Listening simulation with correct audio behaviour, answer capture, scoring and post-test review.
Phase 9 — Realtime coaching
Build the common coaching infrastructure first:
- Session creation.
- Learner context retrieval.
- Gemini Live integration.
- Voice input/output.
- Tool calling.
- Session state.
- Coach response management.
- Coaching event history.
- Session summaries.
Then develop separate specialist coaches for Reading and Listening.

Readia Coach should have passage retrieval, paragraph retrieval, evidence retrieval and question analysis tools.

Listenia Coach should have audio segment retrieval, transcript retrieval, speaker analysis and answer evidence tools.

Completion condition: Both modules can conduct context-aware, voice-led coaching sessions and adapt guidance based on the learner's responses.
Phase 10 — Learner intelligence
Build the analytics pipeline, skill estimators, response analysis and personalised recommendations.

Completion condition: Completing an assessment or coaching session produces updated learner insights and a reasoned next activity recommendation.
Phase 11 — Unified integration
Connect the new receptive skills to the existing speaking and writing systems.

Completion condition: The learner has one Prepia account, one central profile and a coherent preparation journey covering all four IELTS skills.
Phase 12 — Release and quality
Perform:
- Functional testing.
- Assessment accuracy testing.
- AI hallucination and ambiguity testing.
- Cross-browser IndexedDB testing.
- Offline recovery testing.
- Audio integrity testing.
- Accessibility testing.
- Security and permission checks.
- Load testing.
- Cost and model latency measurement.
Do not publicly release an automatically generated test until it has passed your content quality policy.

15. Quality assurance and AI evaluation
This is one of the areas where I would invest heavily.

A generated test can look excellent while containing an ambiguous question, an incorrect answer key or an invalid distractor.

Your quality assurance system therefore needs more than one LLM review.
15.1 Reading validation rules
The Reading Content Validation Agent should verify:
- Passage completeness.
- Language appropriateness.
- Word count.
- IELTS format compliance.
- Topic originality.
- Question clarity.
- Correct answer uniqueness.
- Evidence accuracy.
- Paraphrase validity.
- Distractor plausibility.
- True / False / Not Given distinctions.
- Yes / No / Not Given distinctions.
- Word limit and answer format.
- Question-to-passage alignment.
15.2 Listening validation rules
The Listening Validation Agent should verify:
- Scenario plausibility.
- Script coherence.
- Speaker consistency.
- Appropriate section characteristics.
- Natural conversational language.
- Answer information is actually spoken.
- Information order matches the question sequence.
- Distractors are legitimate and unambiguous.
- Spelling and number answers are valid.
- Recording matches the approved script.
- Audio is complete and properly rendered.
- The answer-bearing speech is audible and distinguishable.
15.3 Independent review architecture
Use a generation agent and an independent reviewer. Ideally, they should have different instructions and review objectives, so the reviewer is not simply repeating the generator's assumptions.

Add a separate deterministic validation layer.
#chatgpt-mermaid-_r_13a_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_13a_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_13a_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_13a_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_13a_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_13a_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_13a_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_13a_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_13a_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_13a_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_13a_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_13a_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_13a_ p{margin:0;}#chatgpt-mermaid-_r_13a_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_13a_ .label text,#chatgpt-mermaid-_r_13a_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .node rect,#chatgpt-mermaid-_r_13a_ .node circle,#chatgpt-mermaid-_r_13a_ .node ellipse,#chatgpt-mermaid-_r_13a_ .node polygon,#chatgpt-mermaid-_r_13a_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .rough-node .label text,#chatgpt-mermaid-_r_13a_ .node .label text,#chatgpt-mermaid-_r_13a_ .image-shape .label,#chatgpt-mermaid-_r_13a_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_13a_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .rough-node .label,#chatgpt-mermaid-_r_13a_ .node .label,#chatgpt-mermaid-_r_13a_ .image-shape .label,#chatgpt-mermaid-_r_13a_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_13a_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_13a_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_13a_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_13a_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_13a_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_13a_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_13a_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_13a_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_13a_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_13a_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_13a_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_13a_ .icon-shape,#chatgpt-mermaid-_r_13a_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_13a_ .icon-shape p,#chatgpt-mermaid-_r_13a_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_13a_ .icon-shape .label rect,#chatgpt-mermaid-_r_13a_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_13a_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_13a_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_13a_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_13a_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_13a_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_13a_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_13a_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_13a_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_13a_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_13a_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_13a_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_13a_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_13a_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_13a_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_13a_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_13a_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_13a_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_13a_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_13a_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .node rect,#chatgpt-mermaid-_r_13a_ .node circle,#chatgpt-mermaid-_r_13a_ .node ellipse,#chatgpt-mermaid-_r_13a_ .node polygon,#chatgpt-mermaid-_r_13a_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_13a_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_13a_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_13a_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_13a_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_13a_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Content GeneratorStructured Output ValidatorAssessment Rules ValidatorIndependent AI ReviewerEvidence VerificationDifficulty and Language ReviewHuman QA PolicyAll Gates Passed?Revision WorkflowPublish Approved VersionNoYes





15.4 Establish an evaluation dataset
Build an internal collection of expert-reviewed examples covering:
- Good questions.
- Ambiguous questions.
- Invalid distractors.
- Incorrect answer keys.
- Unsupported answers.
- Repeated topics.
- Inappropriate difficulty.
- Unrealistic listening dialogues.
- TTS pronunciation problems.
Use this as a regression dataset whenever an agent, prompt, model or generation policy changes.

Over time, measure:
Metric	Purpose
Answer-key accuracy	Correctness of generated answers
Evidence alignment	Whether answers are supported
Question ambiguity	Whether multiple answers are defensible
Topic duplication	Whether content repeats
Difficulty consistency	Whether difficulty matches specification
Audio fidelity	Whether speech matches the canonical script
Content acceptance rate	How often content passes review
Regeneration rate	How frequently generation must be corrected
Coaching usefulness	Whether learner feedback supports improvement

Eventually, use real learner performance and expert review to calibrate generated question difficulty.

Do not assume that a Gemini agent declaring a question Band 7 difficulty actually makes it Band 7. Difficulty should be empirically evaluated.
16. AI model routing, context management and execution costs
One mistake I would avoid is sending every task to the most powerful Gemini model.

Prepia needs a model-routing strategy.

The system should select models based on the complexity, importance, latency and cost of each operation.
16.1 Model routing policy
Operation	Model strategy
Topic classification	Fast model
Topic similarity and categorisation	Embedding service + lightweight reasoning
Reading passage generation	Higher-quality reasoning model
Listening script generation	Higher-quality reasoning model
Question generation	Strong reasoning model
Independent question review	Independent strong reasoning call
Answer scoring	Deterministic application code
Content classification	Fast model
Audio generation	Gemini TTS
Large-scale routine audio rendering	Flash-Lite TTS
Realtime guided coaching	Gemini Live
Complex learner diagnosis	Higher-reasoning model
Routine learning recommendations	Lightweight model + rules
Analytics calculations	Deterministic application code

16.2 Model provider abstraction
Do not hard-code model IDs throughout the application.

Create a central model registry:
interface ModelConfiguration {
  provider: "google";
  modelId: string;

  operation:
    | "reasoning"
    | "generation"
    | "live_coaching"
    | "tts"
    | "transcription"
    | "embedding";

  temperature?: number;
  maxOutputTokens?: number;

  timeoutMs: number;
  retryPolicy: string;

  enabled: boolean;
}


This makes future model upgrades significantly easier.
16.3 Manage agent context properly
Each agent should receive a purpose-built context, not the complete Prepia database.

For example:
- Passage Writer receives the reading blueprint and topic information.
- Question Agent receives the passage and passage intelligence.
- Validation Agent receives the content, question set and validation policy.
- Reading Coach receives the learner profile, current passage and question state.
- Listening Coach receives the audio intelligence map, transcript where permitted, current learner response and relevant audio segment information.
In particular, the Listening Coach should not automatically reveal transcript content during an active listening attempt.

Use consistent system prompt prefixes, reusable context, and caching where appropriate. Gemini supports implicit context caching for supported newer models, which can reduce repeated-input costs in suitably structured workflows. 
Google AI+1

16.4 Asynchronous generation and job management
Content generation must be handled as a job-based process.

For example:
interface GenerationJob {
  jobId: string;

  jobType:
    | "reading_package"
    | "listening_package"
    | "full_mock"
    | "audio_production";

  status:
    | "queued"
    | "running"
    | "validating"
    | "completed"
    | "failed";

  currentStep: string;
  completedSteps: string[];

  createdAt: number;
  updatedAt: number;

  retryCount: number;
  error?: string;
}


This lets administrators inspect generation progress, retry failed steps and recover jobs without regenerating everything.

An audio generation failure, for example, should not require regenerating the entire listening script and question set.

17. The agent tool ecosystem
For agentic capabilities to be genuinely useful, each agent needs permission-controlled application tools.

Here are the first tools I would develop.
Topic tools
searchAvailableTopics()
getTopicDetails()
checkTopicSimilarity()
getLearnerTopicHistory()
reserveTopic()
commitTopicExposure()
releaseTopicReservation()


Reading tools
generateReadingBlueprint()
generateReadingPassage()
analysePassage()
generateReadingQuestions()
retrievePassageEvidence()
validateReadingQuestion()
publishReadingPackage()


Listening tools
generateListeningScenario()
generateListeningScript()
analyseSpeakerTurns()
generateListeningQuestions()
generateAudio()
verifyAudioTranscript()
getAudioSegment()
publishListeningPackage()


Learner tools
getLearnerProfile()
getSkillHistory()
getWeaknessPatterns()
getRecentAttempts()
updateSkillObservations()
createLearningRecommendation()
generateStudyPlan()


Assessment tools
createAssessmentBlueprint()
assembleAssessment()
validateAssessment()
startAttempt()
saveResponse()
submitAttempt()
calculateRawScore()
generateAssessmentReport()


Coaching tools
getCurrentActivity()
getCurrentQuestion()
getRelevantEvidence()
getCoachContext()
giveScaffoldedHint()
recordCoachingEvent()
summariseCoachingSession()


A critical design rule: agents propose decisions and request tools; the application services enforce permissions, validation and state transitions. Agents must never get unrestricted database-write access.

18. API design
I would standardise the main backend interfaces so Readia, Listenia, the admin console and future modules use the same service contracts.
Endpoint	Function
POST /api/ai/orchestrate	Initiate an orchestrated workflow
POST /api/content/generate	Create a content generation job
GET /api/content/jobs/:id	Retrieve job status
POST /api/topics/reserve	Reserve a topic
POST /api/assessments/blueprint	Create assessment blueprint
POST /api/assessments/assemble	Assemble approved content
GET /api/assessments/:id	Retrieve assessment metadata
POST /api/attempts/start	Start an attempt
POST /api/attempts/sync	Synchronise responses
POST /api/attempts/submit	Submit and calculate results
GET /api/learners/:id/profile	Retrieve learner intelligence
GET /api/learners/:id/analytics	Retrieve aggregated insights
POST /api/coaching/sessions	Start guided coaching
POST /api/coaching/tools	Execute authorised coaching tools
GET /api/recommendations/next	Get the next recommended activity

Use authenticated Firebase callable functions where suitable, and authenticated HTTP endpoints for longer-running jobs or streaming workflows.

For Live coaching, use a secure backend-mediated session setup and the supported authentication/session mechanism for the selected Live model. Never put long-lived privileged credentials in frontend code.

19. A modern learner experience — not a conventional question-bank interface
This point is important for product design.

I would avoid organising Prepia around pages containing hundreds of fixed questions, random tests and static scorecards.

Instead, organise the experience around learning objectives and activities.
Readia home
Readia
Reading intelligence and practice

Current estimate6.0
Indicative band

Skill development64%
Illustrative index


Recommended activity
Paraphrase Recognition

Guided reading · Intermediate

Develop the ability to identify equivalent meanings between questions and passages.

Guided Practice
AI-supported learning

Mock Tests
Exam simulation

Skill Drills
Focused practice

My Insights
Learning progress



Listenia home
Listenia
Listening intelligence and practice

Current estimate5.5
Indicative band

Skill development58%
Illustrative index


Recommended activity
Distractor Awareness

Guided listening · Intermediate

Practise identifying changed information, corrections and misleading alternatives in spoken conversations.

Guided Listening
Live AI coach

Mock Tests
Exam simulations

Listening Drills
Audio skill development

My Insights
Learning progress



These are illustrative product layouts and metrics, not actual learner data.

The main learner experience should offer three clear pathways:

Assess: take a diagnostic or full test and understand your current performance.

Practise: work on selected reading or listening skills with adaptive coaching.

Improve: receive a personalised learning pathway and review progress.

I would keep the familiarisation experience separate from the full mock-test environment, so a new learner can understand the platform before entering an exam simulation.

20. Final development priorities
There are several capabilities I would treat as non-negotiable architectural decisions.
Priority	Capability	Reason
Critical	Topic Intelligence	Prevents repetition and provides content diversity
Critical	Assessment Blueprint Engine	Guarantees coherent and valid assessment assembly
Critical	Deterministic scoring	Protects assessment accuracy
Critical	Content QA pipeline	Prevents invalid AI-generated materials
Critical	IndexedDB and synchronisation	Enables reliable local delivery
Critical	Versioned content packages	Preserves historical test integrity
High	Specialist AI agents	Enables intelligent content and learning workflows
High	Realtime coaching	Differentiates the product
High	Listening TTS production	Creates a reusable audio library
High	Learner intelligence	Powers personalised recommendations
High	Learning analytics	Measures progress beyond raw marks
Later	Advanced adaptive assessments	Enables progressively personalised difficulty
Later	Empirical item calibration	Improves assessment quality as response data grows

21. Important architectural decisions I would lock before coding
There are eight decisions that will save considerable redevelopment later.

1. Do not build two disconnected products.

Readia and Listenia need separate interfaces and specialist agents, but share the assessment engine, content registry, orchestration infrastructure, learner profile and analytics.

2. Do not confuse AI generation with assessment validity.

Gemini generates content and supports reasoning. Application code validates formats, answer keys, word limits, timing and scoring. Independent reviewers verify semantic correctness.

3. Do not make the learner wait for a full test to be generated.

Generate and QA assessment packages beforehand, publish immutable versions and deliver them from IndexedDB. Generate personalised practice activities on demand when appropriate.

4. Do not let topic exclusion depend on prompts.

The Topic Intelligence Service must enforce it using persistent records, semantic similarity and transactional reservations.

5. Separate exam mode from coaching mode.

In exam mode, the system observes and records. In guided practice mode, it intervenes, explains and adapts. Mixing the two will weaken the authenticity of your simulations.

6. Separate TTS from Live coaching.

TTS creates the controlled listening recordings. Gemini Live provides the conversational coaching experience. They are two different components with different responsibilities.

7. Make learner intelligence cumulative.

A learner's progress should build across activities, attempts, sessions and modules. Do not reset the understanding of the learner every time a new test begins.

8. Make AI workflows recoverable.

Every generation and coaching workflow should have identifiable states, checkpoints, traceable agent actions, retries and error handling. Live sessions should also handle connection interruptions and supported session resumption rather than assuming a permanent connection. 
Google AI+1


22. What I would actually start coding first
I would resist the temptation to start by designing the Readia homepage or the Listenia audio player.

Start with the shared infrastructure that will make these products intelligent.

Here is the exact sequence I would use for the initial development cycle:
First implementation milestone
The initial engineering deliverables
Implementation checklist

0/8 complete



[ ] 1. Establish shared TypeScript domain schemas
Learner, topic, content package, question, assessment, attempt and analytics types.

[ ] 2. Build IndexedDB and Dexie infrastructure
Database stores, migrations, repositories, content cache and local persistence.

[ ] 3. Build Topic Intelligence Service
Topic taxonomy, semantic similarity, exposure ledger, exclusions and reservation.

[ ] 4. Build Gemini model adapter
Model registry, structured output validation, function calling and secure backend access.

[ ] 5. Build Prepia Orchestrator
Workflow registry, agent routing, checkpoints, tool permissions and job execution.

[ ] 6. Build Content Studio foundations
Generation job management, content registry, QA reports and publishing lifecycle.

[ ] 7. Complete the first Readia content pipeline
One original reading passage, its intelligence map, a validated question set and publication.

[ ] 8. Complete the first Listenia content pipeline
One listening script, question set, TTS recording, transcript verification and publication.


Once these foundations work, build the actual learner experiences around them.
My final architectural recommendation
I would position the entire system as:
PREPIA IELTS
AI-POWERED FOUR-SKILL LEARNING ECOSYSTEM


Readia
Reading intelligence

Listenia
Listening intelligence

Speakia
Speaking intelligence

Writia
Writing intelligence



Shared Prepia Intelligence
Agent orchestration

Learner intelligence

Content intelligence

Assessment intelligence

Realtime coaching

Adaptive learning



Unified Learner Intelligence Profile
One learner · Four skills · Continuous learning evidence · Personalised preparation pathway

The strategic shift I want you to make is this:

Do not develop Readia as a reading test generator and Listenia as an audio test generator. Develop them as two intelligent learning systems that happen to deliver IELTS Reading and Listening assessments.

The question bank becomes a versioned content library. The test bank becomes a blueprint-driven assessment engine. The scorecard becomes an evidence-based learner intelligence report. And the AI coach becomes the interface between assessment, understanding and improvement.

That is the architecture I would build for Prepia IELTS. It preserves the realtime coaching philosophy already established in Speakia, extends it into the receptive skills, and creates a shared technical foundation for the complete four-skill platform.