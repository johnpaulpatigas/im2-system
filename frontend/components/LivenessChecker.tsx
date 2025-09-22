// frontend/components/LivenessChecker.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import "./LivenessChecker.css";
import { ProgressBar } from "./ProgressBar";
import("@tensorflow/tfjs");
import("@mediapipe/face_mesh");
import("../engine/LivenessEngine");

interface LivenessEngineInstance {
  load(): Promise<void>;
  start(
    videoElement: HTMLVideoElement,
    canvasCtx: CanvasRenderingContext2D,
  ): void;
  stop(): void;
}

const UI_STATE = {
  IDLE: "IDLE",
  LOADING_MODELS: "LOADING_MODELS",
  READY_TO_START: "READY_TO_START",
  CAMERA_ERROR: "CAMERA_ERROR",
  CHECKING: "CHECKING",
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
};

const INSTRUCTION_MESSAGES = {
  LOADING_MODELS: "Loading models, please wait...",
  READY_TO_START: 'Click "Start Check" to begin.',
  CAMERA_ERROR: "Could not access camera. Please check permissions.",
  BLINK: "Please blink both eyes.",
  TURN_LEFT: "Slowly turn your head to your left.",
  TURN_RIGHT: "Slowly turn your head to your right.",
  PROCESSING: "Processing...",
  SUCCESS: "Liveness check successful!",
};

interface LivenessCheckerProps {
  onLivenessSuccess: (descriptor: number[]) => void;
  onLivenessFailure: (error: { code: string; message: string }) => void;
}

export function LivenessChecker({
  onLivenessSuccess,
  onLivenessFailure,
}: LivenessCheckerProps) {
  const [uiState, setUiState] = useState(UI_STATE.IDLE);
  const [instruction, setInstruction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentChallenge, setCurrentChallenge] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [debugValue, setDebugValue] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LivenessEngineInstance | null>(null);

  useEffect(() => {
    async function loadLivenessDependencies() {
      try {
        setUiState(UI_STATE.LOADING_MODELS);
        setInstruction(INSTRUCTION_MESSAGES.LOADING_MODELS);

        const [tfModule, mediapipeModule, LivenessEngineModule] =
          await Promise.all([
            import("@tensorflow/tfjs"),
            import("@mediapipe/face_mesh"),
            import("../engine/LivenessEngine"),
          ]);

        const tf = tfModule;
        const LivenessEngineClass = LivenessEngineModule.LivenessEngine;

        await tf.setBackend("webgl").catch((err: unknown) => {
          console.warn("Failed to set WebGL backend, trying WASM:", err);
          return tf.setBackend("wasm");
        });
        console.log("TensorFlow.js backend set.");

        const customConfig = {
          headTurnThreshold: 0.4,
          challengeTimeout: 10000,
        };

        const engine = new LivenessEngineClass(
          {
            onReady: () => {
              console.log("Engine ready");
              setUiState(UI_STATE.READY_TO_START);
              setInstruction(INSTRUCTION_MESSAGES.READY_TO_START);
            },
            onChallengeChanged: (challenge: string) => {
              console.log("Challenge changed:", challenge);
              setCurrentChallenge(challenge);
              setInstruction(
                INSTRUCTION_MESSAGES[
                  challenge as keyof typeof INSTRUCTION_MESSAGES
                ] || "",
              );
              setProgress(0);
              setDebugValue(null);
            },
            onSuccess: (descriptor: number[]) => {
              setUiState(UI_STATE.SUCCESS);
              setInstruction(INSTRUCTION_MESSAGES.SUCCESS);
              setCurrentChallenge(null);
              onLivenessSuccess(descriptor);
            },
            onFailure: (error: { code: string; message: string }) => {
              setUiState(UI_STATE.FAILURE);
              setErrorMessage(`Error: ${error.message} (Code: ${error.code})`);
              setCurrentChallenge(null);
              onLivenessFailure(error);
            },
            onProgress: (value: number, rawValue: number | undefined) => {
              setProgress(value);
              if (rawValue !== undefined) {
                setDebugValue(rawValue.toFixed(4));
              }
            },
          },
          tf,
          mediapipeModule,
          customConfig,
        );

        engine.load();
        engineRef.current = engine;
      } catch (err: unknown) {
        let errorMessage = `Initialization failed: `;
        if (err instanceof Error) errorMessage += err.message;
        else if (typeof err === "object" && err !== null && "message" in err)
          errorMessage += (err as { message: string }).message;
        else errorMessage += String(err);

        console.error("Error initializing LivenessEngine:", err);
        setUiState(UI_STATE.FAILURE);
        setErrorMessage(errorMessage);
        onLivenessFailure({
          code: "ENGINE_INIT_FAILED",
          message: errorMessage,
        });
      }
    }

    loadLivenessDependencies();

    return () => {
      const cleanupEngine = engineRef.current;
      const cleanupVideoElement = videoRef.current;

      cleanupEngine?.stop();
      if (cleanupVideoElement) {
        const stream = cleanupVideoElement.srcObject;
        if (stream) {
          if ("getTracks" in stream && typeof stream.getTracks === "function") {
            (stream as MediaStream)
              .getTracks()
              .forEach((track: MediaStreamTrack) => track.stop());
          }
        }
      }
      import("@tensorflow/tfjs").then((tf) => tf.disposeVariables());
    };
  }, [onLivenessSuccess, onLivenessFailure]);

  const handleStartClick = async () => {
    if (!videoRef.current || !canvasRef.current || !engineRef.current) return;
    setProgress(0);
    setCurrentChallenge(null);
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play();
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            setUiState(UI_STATE.CHECKING);
            const canvasCtx = canvasRef.current.getContext("2d");
            if (canvasCtx) {
              engineRef.current?.start(videoRef.current, canvasCtx);
            }
          }
        }
      };
    } catch (error: unknown) {
      let errorMessage = "Camera access error: ";
      if (error instanceof Error) errorMessage += error.message;
      else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      )
        errorMessage += (error as { message: string }).message;
      else errorMessage += String(error);

      console.error("Camera access error:", error);
      setUiState(UI_STATE.CAMERA_ERROR);
      setInstruction(INSTRUCTION_MESSAGES.CAMERA_ERROR);
      setErrorMessage(errorMessage);
      engineRef.current?.stop();
      onLivenessFailure({
        code: "CAMERA_ACCESS_DENIED",
        message: errorMessage,
      });
    }
  };

  return (
    <div className="liveness-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-feed"
        />
        <canvas ref={canvasRef} className="video-overlay" />
      </div>

      <div className="status-panel">
        <p className="instruction-text">{instruction}</p>

        {uiState === "CHECKING" && debugValue !== null && (
          <p className="debug-text">Debug Turn Ratio: {debugValue}</p>
        )}

        {(currentChallenge === "TURN_LEFT" ||
          currentChallenge === "TURN_RIGHT") && (
          <ProgressBar
            progress={progress}
            direction={currentChallenge === "TURN_LEFT" ? "left" : "right"}
          />
        )}

        {uiState === UI_STATE.READY_TO_START && (
          <button
            onClick={handleStartClick}
            className="liveness-button"
            disabled={uiState === UI_STATE.LOADING_MODELS}
          >
            Start Liveness Check
          </button>
        )}
        {uiState === UI_STATE.FAILURE && (
          <>
            <p className="error-text">{errorMessage}</p>
            <button
              onClick={handleStartClick}
              className="liveness-button retry-button"
            >
              Retry
            </button>
          </>
        )}
        {uiState === UI_STATE.SUCCESS && (
          <div className="success-panel">
            <p className="text-xl font-bold">✅ Liveness Check Successful!</p>
            <p className="descriptor-info">Face descriptor captured.</p>
          </div>
        )}
        {uiState === UI_STATE.CAMERA_ERROR && (
          <>
            <p className="error-text">{errorMessage}</p>
            <button
              onClick={handleStartClick}
              className="liveness-button retry-button"
            >
              Retry Camera
            </button>
          </>
        )}
      </div>
    </div>
  );
}
