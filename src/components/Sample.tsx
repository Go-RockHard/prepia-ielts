import { useCallback, useEffect, useRef, useState } from "react";
import {
  Radio,
  Play,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Flame,
  Activity,
  Send,
  RotateCcw,
  Headphones,
  Footprints,
  Timer,
  HeartPulse,
  Award,
} from "lucide-react";

/* =========================================================================
   TYPES & HOST PERSONAS
   ========================================================================= */

type SpeakerId = "leo" | "maya";

interface PodcastMessage {
  id: string;
  speaker: SpeakerId | "audience";
  text: string;
  timestamp: string;
  finished: boolean;
}

type LiveMessage = {
  setupComplete?: Record<string, never>;
  serverContent?: {
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  error?: { message?: string };
};

type ConnectionStatus = "idle" | "connecting" | "live" | "paused" | "error";

const LEO_PROMPT = `You are 'Coach Leo', co-host of the live podcast "The Long Run Lab".
- Profile: Veteran marathoner, ultra-endurance athlete, and data-driven exercise physiologist.
- Style: You focus on Zone 2 aerobic base, lactate threshold, carb oxidation, and long-term volume.
- Co-Host Dynamic: You are bantering and co-hosting with Coach Maya (a track & biomechanics expert).
- Instructions:
  1. Keep each spoken turn punchy and conversational (2 to 4 sentences maximum).
  2. Speak directly to Maya by name, counter or build upon her ideas, and toss the mic back to her with a quick thought or question.
  3. Speak in a confident, engaging podcast broadcaster tone. No bullet points or markdown formatting.`;

const MAYA_PROMPT = `You are 'Coach Maya', co-host of the live podcast "The Long Run Lab".
- Profile: Olympic trials middle-distance runner and biomechanics / strength specialist.
- Style: You focus on running economy, cadence, carbon-plated shoes, stride symmetry, nervous system fatigue, and track speedwork.
- Co-Host Dynamic: You are bantering with Coach Leo (an ultra and aerobic base physiology purist).
- Instructions:
  1. Keep each spoken turn punchy and conversational (2 to 4 sentences maximum).
  2. React directly to what Leo just argued. Offer biomechanical nuance, athlete stories, or playful pushback, and address Leo by name.
  3. Speak like an energetic, analytical podcast host. No bullet points or markdown formatting.`;

const PODCAST_TOPICS = [
  {
    title: "Super Shoes & Plate Stiffness",
    prompt: "Let's dive into carbon-plated super shoes. Are everyday runners risking Achilles tendon injuries and losing intrinsic foot strength?",
    icon: Flame,
  },
  {
    title: "Zone 2 vs Lactate Threshold",
    prompt: "Debate time: Is 80/20 polarized Zone 2 running overrated compared to high-volume Norwegian lactate threshold intervals for amateurs?",
    icon: HeartPulse,
  },
  {
    title: "Cadence Myths: The 180 SPM Rule",
    prompt: "Let's talk running cadence. Jack Daniels popularized 180 steps per minute—is this an outdated law or the gold standard?",
    icon: Timer,
  },
  {
    title: "Marathon Carb Loading & Gut Training",
    prompt: "Nutrition debate: 60 grams of carbs per hour vs pushing 90-120g/hr with hydrogels on race day. What are the real trade-offs?",
    icon: Award,
  },
];

/* =========================================================================
   AUDIO & TOKEN HELPERS
   ========================================================================= */

async function getLiveSessionConfig(): Promise<{ token?: string; apiKey?: string; model: string; endpoint: string }> {
  if (import.meta.env.DEV && import.meta.env.VITE_GEMINI_API_KEY) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const model = import.meta.env.VITE_GEMINI_LIVE_MODEL || "gemini-2.5-flash";
    return {
      apiKey,
      model: model.startsWith("models/") ? model : `models/${model}`,
      endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`,
    };
  }

  const response = await fetch("/api/gemini-live-token", { method: "POST" });
  if (!response.ok) throw new Error(`Token endpoint failed with status ${response.status}`);
  const data = await response.json();
  return {
    token: data.token,
    model: data.model.startsWith("models/") ? data.model : `models/${data.model}`,
    endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(data.token)}`,
  };
}

/* =========================================================================
   MAIN PODCAST APP COMPONENT
   ========================================================================= */

export default function PodcastStudioApp() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);
  const [activeTopic, setActiveTopic] = useState(PODCAST_TOPICS[0].title);
  const [messages, setMessages] = useState<PodcastMessage[]>([]);
  const [audienceInput, setAudienceInput] = useState("");
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // WebSockets & Audio Management
  const wsLeoRef = useRef<WebSocket | null>(null);
  const wsMayaRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlaybackTimeRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Cross-talk Coordination Refs
  const isTurnPlayingRef = useRef<boolean>(false);
  const activeTurnBufferRef = useRef<{ speaker: SpeakerId; text: string }>({ speaker: "leo", text: "" });
  const isLiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    isMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeSpeaker]);

  // Audio Playback Engine
  const playPcmChunk = (base64Audio: string, mimeType?: string, speaker?: SpeakerId) => {
    if (isMutedRef.current) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const view = new DataView(bytes.buffer);
      const sampleCount = Math.floor(bytes.length / 2);
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = view.getInt16(i * 2, true) / 32768;
      }

      const sampleRate = Number(mimeType?.match(/rate=(\d+)/)?.[1]) || 24_000;
      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextPlaybackTimeRef.current < now) nextPlaybackTimeRef.current = now + 0.04;
      source.start(nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current += audioBuffer.duration;

      scheduledSourcesRef.current.push(source);
      if (speaker) setActiveSpeaker(speaker);

      source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
        if (scheduledSourcesRef.current.length === 0 && !isTurnPlayingRef.current) {
          handleAudioFinished();
        }
      };
    } catch (err) {
      console.error("PCM Chunk play error:", err);
    }
  };

  const stopAllAudio = () => {
    scheduledSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    scheduledSourcesRef.current = [];
    nextPlaybackTimeRef.current = 0;
    setActiveSpeaker(null);
  };

  /* =========================================================================
     AI-TO-AI CONVERSATION RELAY
     ========================================================================= */

  const handleAudioFinished = () => {
    if (!isLiveRef.current) return;
    setActiveSpeaker(null);

    const { speaker, text } = activeTurnBufferRef.current;
    if (!text.trim()) return;

    // Hand off from Speaker A to Speaker B after a natural 700ms studio pause
    const nextSpeaker: SpeakerId = speaker === "leo" ? "maya" : "leo";
    const targetWs = nextSpeaker === "leo" ? wsLeoRef.current : wsMayaRef.current;

    setTimeout(() => {
      if (!isLiveRef.current || targetWs?.readyState !== WebSocket.OPEN) return;
      activeTurnBufferRef.current = { speaker: nextSpeaker, text: "" };

      targetWs.send(
        JSON.stringify({
          realtimeInput: {
            text: `[${speaker === "leo" ? "Coach Leo" : "Coach Maya"} says]: "${text}"`,
          },
        })
      );
    }, 700);
  };

  const teardown = useCallback(() => {
    isLiveRef.current = false;
    stopAllAudio();

    if (wsLeoRef.current) {
      wsLeoRef.current.onmessage = null;
      wsLeoRef.current.close();
      wsLeoRef.current = null;
    }
    if (wsMayaRef.current) {
      wsMayaRef.current.onmessage = null;
      wsMayaRef.current.close();
      wsMayaRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setActiveSpeaker(null);
    setStatus("idle");
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  /* =========================================================================
     START LIVE PODCAST SESSION
     ========================================================================= */

  const startPodcast = async (selectedTopicPrompt?: string) => {
    teardown();
    setStatus("connecting");
    setStatusMessage("Establishing dual Speakia AI Live studio feeds...");

    try {
      const audioCtx = new AudioContext({ sampleRate: 24_000 });
      await audioCtx.resume();
      audioContextRef.current = audioCtx;

      const { endpoint, model } = await getLiveSessionConfig();

      // Host 1: Coach Leo (Puck Voice)
      const wsLeo = new WebSocket(endpoint);
      // Host 2: Coach Maya (Aoede Voice)
      const wsMaya = new WebSocket(endpoint);

      wsLeoRef.current = wsLeo;
      wsMayaRef.current = wsMaya;

      let leoReady = false;
      let mayaReady = false;

      const checkBothReadyAndKickoff = () => {
        if (leoReady && mayaReady) {
          isLiveRef.current = true;
          setStatus("live");
          setStatusMessage("");

          // Kickoff the broadcast: Coach Leo opens the floor
          const kickPrompt =
            selectedTopicPrompt ||
            `We are live on air for "The Long Run Lab" podcast. Introduce today's debate on "${activeTopic}". Give your bold opening statement and throw the mic over to Maya!`;

          activeTurnBufferRef.current = { speaker: "leo", text: "" };
          wsLeo.send(JSON.stringify({ realtimeInput: { text: kickPrompt } }));
        }
      };

      // Leo Setup
      wsLeo.onopen = () => {
        wsLeo.send(
          JSON.stringify({
            setup: {
              model,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                },
              },
              outputAudioTranscription: {},
              systemInstruction: { parts: [{ text: LEO_PROMPT }] },
            },
          })
        );
      };

      // Maya Setup
      wsMaya.onopen = () => {
        wsMaya.send(
          JSON.stringify({
            setup: {
              model,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
                },
              },
              outputAudioTranscription: {},
              systemInstruction: { parts: [{ text: MAYA_PROMPT }] },
            },
          })
        );
      };

      // Leo Message Handler
      wsLeo.onmessage = async (event) => {
        const payload = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
        const data = JSON.parse(payload) as LiveMessage;

        if (data.setupComplete) {
          leoReady = true;
          checkBothReadyAndKickoff();
          return;
        }

        const content = data.serverContent;
        if (content?.outputTranscription?.text) {
          const chunk = content.outputTranscription.text;
          activeTurnBufferRef.current.text += chunk;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === "leo" && !last.finished) {
              return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
            }
            return [
              ...prev,
              {
                id: `leo-${Date.now()}`,
                speaker: "leo",
                text: chunk,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                finished: false,
              },
            ];
          });
        }

        for (const part of content?.modelTurn?.parts || []) {
          if (part.inlineData?.data) {
            isTurnPlayingRef.current = true;
            playPcmChunk(part.inlineData.data, part.inlineData.mimeType, "leo");
          }
        }

        if (content?.turnComplete) {
          isTurnPlayingRef.current = false;
          setMessages((prev) =>
            prev.map((msg) => (msg.speaker === "leo" ? { ...msg, finished: true } : msg))
          );
          if (scheduledSourcesRef.current.length === 0) {
            handleAudioFinished();
          }
        }
      };

      // Maya Message Handler
      wsMaya.onmessage = async (event) => {
        const payload = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
        const data = JSON.parse(payload) as LiveMessage;

        if (data.setupComplete) {
          mayaReady = true;
          checkBothReadyAndKickoff();
          return;
        }

        const content = data.serverContent;
        if (content?.outputTranscription?.text) {
          const chunk = content.outputTranscription.text;
          activeTurnBufferRef.current.text += chunk;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === "maya" && !last.finished) {
              return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
            }
            return [
              ...prev,
              {
                id: `maya-${Date.now()}`,
                speaker: "maya",
                text: chunk,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                finished: false,
              },
            ];
          });
        }

        for (const part of content?.modelTurn?.parts || []) {
          if (part.inlineData?.data) {
            isTurnPlayingRef.current = true;
            playPcmChunk(part.inlineData.data, part.inlineData.mimeType, "maya");
          }
        }

        if (content?.turnComplete) {
          isTurnPlayingRef.current = false;
          setMessages((prev) =>
            prev.map((msg) => (msg.speaker === "maya" ? { ...msg, finished: true } : msg))
          );
          if (scheduledSourcesRef.current.length === 0) {
            handleAudioFinished();
          }
        }
      };

      const handleFail = (errStr: string) => {
        setStatus("error");
        setStatusMessage(errStr);
        teardown();
      };

      wsLeo.onerror = () => handleFail("Connection to Coach Leo failed.");
      wsMaya.onerror = () => handleFail("Connection to Coach Maya failed.");
    } catch (err) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "Studio connection failed.");
      teardown();
    }
  };

  // Audience Question or Interjection
  const injectAudienceQuestion = () => {
    if (!audienceInput.trim() || status !== "live") return;
    const question = audienceInput.trim();
    setAudienceInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: `aud-${Date.now()}`,
        speaker: "audience",
        text: question,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        finished: true,
      },
    ]);

    // Send question to whoever is up next
    const targetWs = activeSpeaker === "leo" ? wsMayaRef.current : wsLeoRef.current;
    const targetName = activeSpeaker === "leo" ? "Maya" : "Leo";

    if (targetWs?.readyState === WebSocket.OPEN) {
      targetWs.send(
        JSON.stringify({
          realtimeInput: {
            text: `[Producer/Audience Question for ${targetName}]: "${question}". Address this audience question in your next comment!`,
          },
        })
      );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-zinc-100 font-sans select-none overflow-hidden">
      {/* Studio Header */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#0b0e17]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            {status === "live" && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider uppercase text-white">The Long Run Lab</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold tracking-wide">
                AI CO-HOST PODCAST
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span>Coach Leo (Physiology)</span>
              <span className="text-zinc-600">•</span>
              <span>Coach Maya (Biomechanics)</span>
            </p>
          </div>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 border border-white/5 transition"
            title={isAudioMuted ? "Unmute Studio Audio" : "Mute Studio Audio"}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 border border-white/5 transition"
              title="Clear Transcript"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {status === "live" || status === "connecting" ? (
            <button
              onClick={teardown}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition shadow-lg shadow-red-500/10"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> End Episode
            </button>
          ) : (
            <button
              onClick={() => startPodcast()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-zinc-950 transition shadow-lg shadow-orange-500/20 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Go Live On Air
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center: Interactive Studio View */}
        <div className="flex-1 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/5 bg-[#090b12] p-4 sm:p-6 overflow-hidden">
          {/* Active Error / Info Banner */}
          {statusMessage && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center justify-between">
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Dual Co-Host Studio Visualizer */}
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full my-auto py-4">
            {/* Coach Leo Card */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden ${
                activeSpeaker === "leo"
                  ? "bg-gradient-to-b from-orange-500/10 to-transparent border-orange-500 shadow-xl shadow-orange-500/10"
                  : "bg-white/[0.02] border-white/5"
              }`}
            >
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-3 transition-transform ${
                  activeSpeaker === "leo"
                    ? "border-orange-500 scale-105 bg-orange-500/20"
                    : "border-zinc-700 bg-zinc-900"
                }`}
              >
                <Activity
                  className={`w-9 h-9 ${activeSpeaker === "leo" ? "text-orange-400 animate-pulse" : "text-zinc-500"}`}
                />
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-bold text-sm text-white">Coach Leo</span>
                <span className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded font-mono">
                  PUCK
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Marathon & Exercise Physiology</p>

              {activeSpeaker === "leo" ? (
                <div className="mt-3 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-[10px] text-orange-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                  Speaking Now
                </div>
              ) : (
                <div className="mt-3 text-[10px] text-zinc-600 font-medium">Listening to Maya</div>
              )}
            </div>

            {/* Coach Maya Card */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden ${
                activeSpeaker === "maya"
                  ? "bg-gradient-to-b from-cyan-500/10 to-transparent border-cyan-400 shadow-xl shadow-cyan-500/10"
                  : "bg-white/[0.02] border-white/5"
              }`}
            >
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-3 transition-transform ${
                  activeSpeaker === "maya"
                    ? "border-cyan-400 scale-105 bg-cyan-500/20"
                    : "border-zinc-700 bg-zinc-900"
                }`}
              >
                <Footprints
                  className={`w-9 h-9 ${activeSpeaker === "maya" ? "text-cyan-400 animate-pulse" : "text-zinc-500"}`}
                />
              </div>

              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-bold text-sm text-white">Coach Maya</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded font-mono">
                  AOEDE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Track & Biomechanics Specialist</p>

              {activeSpeaker === "maya" ? (
                <div className="mt-3 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Speaking Now
                </div>
              ) : (
                <div className="mt-3 text-[10px] text-zinc-600 font-medium">Listening to Leo</div>
              )}
            </div>
          </div>

          {/* Quick Debate Switcher (Episode Topics) */}
          <div className="max-w-2xl mx-auto w-full mt-auto pt-4">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Podcast Discussion Topics
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PODCAST_TOPICS.map((topic, i) => {
                const Icon = topic.icon;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveTopic(topic.title);
                      if (status === "live") {
                        startPodcast(
                          `Let's pivot the show right now to: "${topic.title}". ${topic.prompt} Leo, kick off this new topic!`
                        );
                      }
                    }}
                    className={`p-2.5 rounded-xl text-left border text-xs flex items-center gap-2.5 transition ${
                      activeTopic === topic.title
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-zinc-300"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate font-medium">{topic.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Live Studio Transcript & Audience Q&A */}
        <div className="w-full lg:w-[440px] flex flex-col bg-[#0b0d14] h-full overflow-hidden">
          <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Headphones className="w-4 h-4 text-orange-400" />
              <span>Live Dialogue Stream</span>
            </div>
            <span className="text-[10px] text-zinc-500">{messages.length} exchanges</span>
          </div>

          {/* Transcript Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2 py-12">
                <Radio className="w-8 h-8 stroke-1 text-zinc-600" />
                <p className="text-xs">No live audio yet.</p>
                <p className="text-[11px] text-zinc-600 max-w-xs">
                  Press &ldquo;Go Live On Air&rdquo; to start the unscripted running debate between Coach Leo and Coach Maya.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.speaker === "audience"
                      ? "items-end"
                      : m.speaker === "leo"
                      ? "items-start"
                      : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        m.speaker === "leo"
                          ? "text-orange-400"
                          : m.speaker === "maya"
                          ? "text-cyan-400"
                          : "text-amber-400"
                      }`}
                    >
                      {m.speaker === "leo"
                        ? "Coach Leo"
                        : m.speaker === "maya"
                        ? "Coach Maya"
                        : "Audience Interjection"}
                    </span>
                    <span className="text-[9px] text-zinc-600">{m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed border ${
                      m.speaker === "audience"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-200 rounded-tr-sm"
                        : m.speaker === "leo"
                        ? "bg-[#141722] border-white/5 text-zinc-200 rounded-tl-sm"
                        : "bg-[#101924] border-cyan-500/20 text-zinc-200 rounded-tl-sm"
                    }`}
                  >
                    {m.text || <span className="animate-pulse">Speaking on air...</span>}
                  </div>
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>

          {/* Producer / Audience Question Ingestion */}
          <footer className="p-3 border-t border-white/5 bg-[#08090f]">
            <div className="flex items-center gap-2 bg-[#12141f] border border-white/10 rounded-xl p-1.5 focus-within:border-orange-500/50">
              <input
                type="text"
                value={audienceInput}
                onChange={(e) => setAudienceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && injectAudienceQuestion()}
                disabled={status !== "live"}
                placeholder={
                  status === "live"
                    ? "Toss a question into the podcast..."
                    : "Go live to inject listener questions..."
                }
                className="flex-1 bg-transparent px-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none disabled:opacity-40"
              />
              <button
                onClick={injectAudienceQuestion}
                disabled={!audienceInput.trim() || status !== "live"}
                className="w-7 h-7 rounded-lg bg-orange-500 disabled:opacity-20 text-zinc-950 flex items-center justify-center transition active:scale-95"
                title="Send to Host"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}