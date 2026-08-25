"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface AudioRecorderProps {
  attemptId: string;
  questionId: string;
  onAudioRecorded?: (
    audioUrl: string,
    transcript: string,
    duration: number,
    audioStoragePath?: string,
  ) => void;
  autoStart?: boolean;
  maxDurationSeconds?: number;
}

type SttSource = "deepgram" | null;

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  attemptId,
  questionId,
  onAudioRecorded,
  autoStart = false,
  maxDurationSeconds = 120,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const recordingTimeRef = useRef(0);

  // Transcript
  const transcriptRef = useRef("");
  const finalTranscriptRef = useRef("");

  // Recording state
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const recordingSessionRef = useRef(0);

  // Which STT is active
  const activeSttSourceRef = useRef<SttSource>(null);

  // Deepgram
  const sttSocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopStreamingSTT = () => {
    // console.log("[STT] Stopping Deepgram streaming");

    if (sttSocketRef.current) {
      try {
        sttSocketRef.current.close();
      } catch {
        // Ignore
      }

      sttSocketRef.current = null;
    }

    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current.onaudioprocess = null;
      audioProcessorRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (activeSttSourceRef.current === "deepgram") {
      activeSttSourceRef.current = null;
    }
  };

  /**
   * Deepgram Streaming STT
   */
  const connectStreamingSTT = async (stream: MediaStream) => {
    // console.log("[Deepgram STT] Starting");

    const response = await fetch("/api/ielts/deepgram-token", {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    // console.log("[Deepgram STT] Token response:", {
    //   ok: response.ok,
    //   status: response.status,
    //   success: data.success,
    //   hasToken: Boolean(data.token),
    //   error: data.error,
    // });

    if (!response.ok || !data.success || !data.token) {
      throw new Error(data.error || "Could not start Deepgram transcription.");
    }

    const audioContext = new AudioContext({
      sampleRate: 16000,
    });

    audioContextRef.current = audioContext;

    await audioContext.resume();

    // console.log(
    //   "[Deepgram STT] AudioContext:",
    //   audioContext.state,
    //   audioContext.sampleRate,
    // );

    const params = new URLSearchParams({
      model: "nova-3",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      interim_results: "true",
      punctuate: "true",
      language: "en-US",
    });

    const socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ["bearer", data.token],
    );

    sttSocketRef.current = socket;

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const connectionTimeout = window.setTimeout(() => {
        if (settled) return;

        settled = true;

        reject(new Error("Streaming STT connection timed out."));
      }, 10000);

      socket.onopen = () => {
        // console.log("[Deepgram STT] WebSocket OPEN");

        if (settled) {
          return;
        }

        settled = true;

        window.clearTimeout(connectionTimeout);

        resolve();
      };

      socket.onerror = (event) => {
        console.error("[Deepgram STT] WebSocket ERROR:", event);

        setPermissionError("Deepgram WebSocket connection failed.");

        if (settled) {
          return;
        }

        settled = true;

        window.clearTimeout(connectionTimeout);

        reject(new Error("Streaming STT connection failed."));
      };

      socket.onclose = (event) => {
        console.warn("[Deepgram STT] WebSocket CLOSED:", {
          code: event.code,
          reason: event.reason || "No reason provided",
          wasClean: event.wasClean,
        });

        if (!settled) {
          settled = true;
          window.clearTimeout(connectionTimeout);
          reject(
            new Error(
              `Deepgram WebSocket closed before start (${event.code}).`,
            ),
          );
        }

        if (isRecordingRef.current && sttSocketRef.current === socket) {
          setPermissionError(
            `Live transcription connection was interrupted (${event.code}).`,
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // console.log("[Deepgram STT] Message:", message.type);
          const transcript =
            typeof message.channel?.alternatives?.[0]?.transcript === "string"
              ? message.channel.alternatives[0].transcript.trim()
              : "";

          if (!transcript) {
            return;
          }

          if (activeSttSourceRef.current !== "deepgram") {
            return;
          }

          // console.log(
          //   "[Deepgram STT] Transcript:",
          //   transcript,
          //   "final:",
          //   message.is_final,
          // );

          if (message.is_final) {
            finalTranscriptRef.current =
              `${finalTranscriptRef.current} ${transcript}`
                .replace(/\s+/g, " ")
                .trim();
          }

          const displayTranscript = `${finalTranscriptRef.current} ${
            message.is_final ? "" : transcript
          }`
            .replace(/\s+/g, " ")
            .trim();

          setLiveTranscript(displayTranscript);

          transcriptRef.current = displayTranscript;
        } catch (error) {
          console.warn("[Deepgram STT] Message parse error:", error);
        }
      };
    });

    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    const silentGain = audioContext.createGain();

    silentGain.gain.value = 0;

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    audioProcessorRef.current = processor;

    let audioPacketCount = 0;

    processor.onaudioprocess = (audioEvent) => {
      if (socket.readyState !== WebSocket.OPEN || !isRecordingRef.current) {
        return;
      }

      const input = audioEvent.inputBuffer.getChannelData(0);

      const sourceRate = audioContext.sampleRate;

      const targetRate = 16000;

      const step = sourceRate / targetRate;

      const outputLength = Math.floor(input.length / step);

      const pcm = new Int16Array(outputLength);

      for (let index = 0; index < outputLength; index++) {
        const sourceIndex = Math.min(
          Math.floor(index * step),
          input.length - 1,
        );

        const sample = Math.max(-1, Math.min(1, input[sourceIndex]));

        pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      try {
        socket.send(pcm.buffer);

        audioPacketCount++;

        if (audioPacketCount % 20 === 0) {
          // console.log("[Deepgram STT] Audio packets:", audioPacketCount);
        }
      } catch (error) {
        console.warn("[Deepgram STT] Failed to send audio:", error);
      }
    };

    // console.log("[Deepgram STT] Audio streaming started");
  };

  const stopRecording = () => {
    stopTimer();

    isFinalizingRef.current = true;
    setIsFinalizing(true);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  const startRecording = async () => {
    if (
      isRecordingRef.current ||
      isStartingRef.current ||
      isFinalizingRef.current
    ) {
      return;
    }

    isStartingRef.current = true;

    try {
      setPermissionError(null);

      setAudioUrl(null);
      setLiveTranscript("");

      transcriptRef.current = "";
      finalTranscriptRef.current = "";

      activeSttSourceRef.current = null;

      isRecordingRef.current = true;

      stopTimer();
      stopStreamingSTT();

      if (isPlaying && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // console.log("[Recorder] Microphone permission granted");

      const mediaRecorder = new MediaRecorder(stream);
      const recordingSession = ++recordingSessionRef.current;

      mediaRecorderRef.current = mediaRecorder;

      audioChunksRef.current = [];

      activeSttSourceRef.current = "deepgram";

      try {
        await connectStreamingSTT(stream);
      } catch (error) {
        console.warn(
          "[Recorder] Live Deepgram transcription unavailable; continuing with recording:",
          error,
        );
        activeSttSourceRef.current = null;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // console.log("[Recorder] MediaRecorder stopped");

        isRecordingRef.current = false;

        stopTimer();
        const audioType = mediaRecorder.mimeType || "audio/webm";

        const audioBlob = new Blob(audioChunksRef.current, {
          type: audioType,
        });

        const objectUrl = URL.createObjectURL(audioBlob);

        setAudioUrl(objectUrl);

        const transcript = transcriptRef.current.trim();

        if (recordingSession !== recordingSessionRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        transcriptRef.current = transcript;

        setLiveTranscript(transcript);

        stopStreamingSTT();

        stream.getTracks().forEach((track) => track.stop());

        if (onAudioRecorded) {
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, "recording.webm");
            formData.append("attemptId", attemptId);
            formData.append("questionId", questionId);

            const uploadResponse = await fetch("/api/ielts/upload-audio", {
              method: "POST",
              body: formData,
            });
            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok || !uploadData.success) {
              throw new Error(uploadData.error || "Audio upload failed.");
            }

            URL.revokeObjectURL(objectUrl);
            setAudioUrl(uploadData.audioUrl);
            onAudioRecorded(
              uploadData.audioUrl,
              transcript,
              recordingTimeRef.current,
              uploadData.path,
            );
          } catch (error) {
            console.error("[Recorder] Audio upload failed:", error);
            setPermissionError(
              "Recording finished, but saving the audio failed. Please try again.",
            );
            onAudioRecorded(objectUrl, transcript, recordingTimeRef.current);
          }
        }

        isFinalizingRef.current = false;
        setIsFinalizing(false);
      };

      mediaRecorder.start(100);

      setIsRecording(true);

      setRecordingTime(0);

      recordingTimeRef.current = 0;

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const nextTime = prev + 1;

          recordingTimeRef.current = nextTime;

          if (nextTime >= maxDurationSeconds) {
            stopRecording();

            return maxDurationSeconds;
          }

          return nextTime;
        });
      }, 1000);

      isStartingRef.current = false;
    } catch (error) {
      console.error("[Recorder] Error:", error);

      isRecordingRef.current = false;

      stopTimer();
      stopStreamingSTT();

      setIsRecording(false);

      isStartingRef.current = false;
      isFinalizingRef.current = false;
      setIsFinalizing(false);

      setPermissionError(
        error instanceof Error
          ? error.message
          : "Microphone permission denied. Please allow microphone access in your browser.",
      );
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) {
      return;
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);

    const secs = seconds % 60;

    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /**
   * Cleanup when question changes / component unmounts.
   */
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;

      stopTimer();
      stopStreamingSTT();

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    setIsRecording(false);
    setRecordingTime(0);
    setAudioUrl(null);
    setIsPlaying(false);
    setIsFinalizing(false);
    setPermissionError(null);
    setLiveTranscript("");

    recordingTimeRef.current = 0;

    transcriptRef.current = "";
    finalTranscriptRef.current = "";

    audioChunksRef.current = [];

    stopTimer();
    stopStreamingSTT();

    isRecordingRef.current = false;
    isStartingRef.current = false;
    isFinalizingRef.current = false;
    activeSttSourceRef.current = null;

    if (autoStart) {
      const timer = window.setTimeout(() => {
        void startRecording();
      }, 100);

      return () => window.clearTimeout(timer);
    }
  }, [questionId]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isRecording
                ? "bg-rose-100 text-rose-600 border border-rose-200 animate-pulse"
                : audioUrl
                  ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                  : "bg-purple-100 text-purple-600 border border-purple-200"
            }`}
          >
            {isRecording ? (
              <Mic className="w-6 h-6 animate-bounce" />
            ) : audioUrl ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-500">
              {isRecording
                ? "Recording Speech..."
                : audioUrl
                  ? "Audio Saved"
                  : "Live Microphone"}
            </div>

            <div className="text-2xl font-mono font-bold text-slate-900 tracking-tight">
              {formatTime(recordingTime)}

              <span className="text-xs font-sans text-slate-400 font-normal ml-2">
                / {formatTime(maxDurationSeconds)}
              </span>
            </div>
          </div>
        </div>

        {isRecording && (
          <div className="flex items-center gap-1 h-8 px-4 py-1 bg-slate-50 rounded-xl border border-rose-200">
            {[40, 70, 20, 90, 50, 80, 30, 100, 60, 40, 80, 50].map(
              (height, index) => (
                <div
                  key={index}
                  className="w-1.5 bg-rose-500 rounded-full animate-pulse"
                  style={{
                    height: `${height}%`,
                    animationDuration: `${0.4 + (index % 4) * 0.2}s`,
                  }}
                />
              ),
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isRecording && !audioUrl && (
            <button
              onClick={() => void startRecording()}
              className="flex items-center gap-2.5 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-200 hover:scale-[1.02]"
            >
              <Mic className="w-5 h-5" />
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2.5 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md shadow-rose-200 animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>Stop & Save</span>
            </button>
          )}

          {audioUrl && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}

                <span>{isPlaying ? "Pause" : "Play Response"}</span>
              </button>

              <button
                onClick={() => void startRecording()}
                disabled={isFinalizing}
                title="Re-record response"
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all border border-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />

                <span>Re-record</span>
              </button>

              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>

      {(isRecording || liveTranscript) && (
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />

            <span>Live Speech-to-Text Transcript</span>
          </div>

          <p className="text-sm text-slate-800 font-medium leading-relaxed italic">
            {liveTranscript ||
              "Listening... Start speaking into your microphone."}
          </p>
        </div>
      )}

      {permissionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl font-medium">
          {permissionError}
        </div>
      )}
    </div>
  );
};
