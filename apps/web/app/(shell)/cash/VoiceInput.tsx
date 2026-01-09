"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type VoiceInputProps = {
  onTranscription: (text: string) => void;
  disabled?: boolean;
};

export default function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for microphone permission on mount
  useEffect(() => {
    async function checkPermission() {
      try {
        const result = await navigator.permissions.query({
          name: "microphone" as PermissionName
        });
        setHasPermission(result.state === "granted");

        result.addEventListener("change", () => {
          setHasPermission(result.state === "granted");
        });
      } catch {
        // permissions API not supported, will check on first use
        setHasPermission(null);
      }
    }

    if (typeof navigator !== "undefined" && navigator.permissions) {
      checkPermission();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Determine best supported format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        // Only transcribe if we have actual audio data
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }

        setRecordingDuration(0);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Start duration timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied. Please allow microphone access.");
          setHasPermission(false);
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else {
          setError("Could not start recording. Please try again.");
        }
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const result = await response.json();

      if (result.text) {
        onTranscription(result.text);
      } else {
        setError("No speech detected. Please try again.");
      }
    } catch {
      setError("Transcription failed. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClick = () => {
    if (disabled || isTranscribing) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-input">
      <style jsx>{`
        .voice-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .voice-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 2px solid var(--border);
          background: rgba(26, 33, 46, 0.8);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          position: relative;
          overflow: hidden;
        }

        .voice-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-btn:not(:disabled):hover {
          border-color: rgba(242, 164, 59, 0.6);
          color: var(--accent);
          background: rgba(242, 164, 59, 0.1);
        }

        .voice-btn.recording {
          border-color: rgba(226, 106, 90, 0.8);
          background: rgba(226, 106, 90, 0.2);
          color: #f28b7d;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .voice-btn.transcribing {
          border-color: rgba(242, 164, 59, 0.6);
          background: rgba(242, 164, 59, 0.15);
          color: var(--accent);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(226, 106, 90, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 12px rgba(226, 106, 90, 0);
          }
        }

        .voice-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .voice-label {
          font-size: 12px;
          color: var(--text-secondary);
          text-align: center;
        }

        .voice-label.recording {
          color: #f28b7d;
        }

        .voice-label.transcribing {
          color: var(--accent);
        }

        .voice-error {
          font-size: 12px;
          color: #f28b7d;
          text-align: center;
          max-width: 200px;
        }

        .duration {
          font-family: monospace;
          font-size: 14px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid transparent;
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <button
        type="button"
        className={`voice-btn ${isRecording ? "recording" : ""} ${isTranscribing ? "transcribing" : ""}`}
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-label={isRecording ? "Stop recording" : "Start voice input"}
      >
        <span className="voice-icon">
          {isTranscribing ? (
            <span className="spinner" />
          ) : isRecording ? (
            "■"
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </span>
      </button>

      <span
        className={`voice-label ${isRecording ? "recording" : ""} ${isTranscribing ? "transcribing" : ""}`}
      >
        {isTranscribing ? (
          "Transcribing..."
        ) : isRecording ? (
          <span className="duration">{formatDuration(recordingDuration)}</span>
        ) : hasPermission === false ? (
          "Mic access needed"
        ) : (
          "Tap to speak"
        )}
      </span>

      {error && <span className="voice-error">{error}</span>}
    </div>
  );
}
