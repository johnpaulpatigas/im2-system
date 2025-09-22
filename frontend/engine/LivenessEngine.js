// frontend/engine/LivenessEngine.js
import { calculateEAR, calculateHeadTurnV2 } from "./utils";

const DEFAULT_CONFIG = {
  blinkEARThreshold: 0.2,
  headTurnThreshold: 0.4,
  challengeTimeout: 10000,
};

export class LivenessEngine {
  #faceMesh;
  #recognitionModel;
  #callbacks;
  #config;
  #videoElement;
  #canvasCtx;
  #isReady = false;
  #detectionLoopId = null;
  #isStopped = true;
  #challenges = ["BLINK", "TURN_LEFT", "TURN_RIGHT"];
  #currentChallengeIndex = 0;
  #lastChallengeTime = 0;
  #isChallengeProcessing = false;
  #tf;
  #FaceMeshClass;
  #FACEMESH_TESSELATION_CONST;

  constructor(callbacks, tfModule, mediapipeModule, config = {}) {
    if (
      !callbacks ||
      typeof callbacks.onReady !== "function" ||
      typeof callbacks.onSuccess !== "function" ||
      typeof callbacks.onFailure !== "function" ||
      typeof callbacks.onChallengeChanged !== "function"
    ) {
      throw new Error(
        "LivenessEngine requires a valid callbacks object with onReady, onSuccess, onFailure, and onChallengeChanged.",
      );
    }
    this.#callbacks = callbacks;
    this.#config = { ...DEFAULT_CONFIG, ...config };
    this.#tf = tfModule;
    this.#FaceMeshClass = mediapipeModule.FaceMesh;
    this.#FACEMESH_TESSELATION_CONST = mediapipeModule.FACEMESH_TESSELATION;
  }

  async load() {
    try {
      this.#faceMesh = new this.#FaceMeshClass({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      this.#faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.#faceMesh.onResults(this.#onFaceMeshResults.bind(this));

      // const modelUrl =
      //   "https://www.kaggle.com/models/google/mobilenet-v2/TfJs/140-224-feature-vector/3";

      const modelUrl = "/mobilenet-v2-tfjs-140-224-feature-vector-v3";

      this.#recognitionModel = await this.#tf.loadGraphModel(modelUrl, {
        fromTFHub: true,
      });

      this.#isReady = true;
      this.#callbacks.onReady();
    } catch (error) {
      console.error("Fatal error during model loading:", error);
      this.#callbacks.onFailure({
        code: "MODEL_LOAD_FAILED",
        message: `Failed to load models. Check console for details. Error: ${error.message}`,
      });
    }
  }

  start(videoElement, canvasCtx) {
    if (!this.#isReady)
      throw new Error("Engine not loaded. Call load() first.");
    this.#videoElement = videoElement;
    this.#canvasCtx = canvasCtx;
    this.#isStopped = false;
    this.#isChallengeProcessing = false;
    this.#currentChallengeIndex = 0;
    this.#lastChallengeTime = Date.now();
    this.#callbacks.onChallengeChanged(
      this.#challenges[this.#currentChallengeIndex],
    );
    if (this.#detectionLoopId) cancelAnimationFrame(this.#detectionLoopId);
    this.#detectionLoop();
  }

  stop() {
    this.#isStopped = true;
    if (this.#detectionLoopId) {
      cancelAnimationFrame(this.#detectionLoopId);
      this.#detectionLoopId = null;
    }
    if (this.#canvasCtx)
      this.#canvasCtx.clearRect(
        0,
        0,
        this.#canvasCtx.canvas.width,
        this.#canvasCtx.canvas.height,
      );
  }

  #detectionLoop = async () => {
    if (
      this.#isStopped ||
      !this.#videoElement ||
      this.#videoElement.readyState < 2
    ) {
      if (!this.#isStopped)
        this.#detectionLoopId = requestAnimationFrame(this.#detectionLoop);
      return;
    }
    await this.#faceMesh.send({ image: this.#videoElement });
    this.#detectionLoopId = requestAnimationFrame(this.#detectionLoop);
  };

  #onFaceMeshResults = (results) => {
    if (this.#isStopped) return;
    this.#drawDebugOverlay(results.multiFaceLandmarks);
    const faces = results.multiFaceLandmarks;
    if (!faces || faces.length === 0) {
      if (
        Date.now() - this.#lastChallengeTime >
        this.#config.challengeTimeout
      ) {
        this.#failChallenge({
          code: "FACE_NOT_FOUND",
          message: "Could not detect a face.",
        });
      }
      return;
    }
    const landmarks = faces[0];
    this.#processChallenge(landmarks);
  };

  #processChallenge(landmarks) {
    if (this.#isChallengeProcessing) return;

    const currentChallenge = this.#challenges[this.#currentChallengeIndex];
    let challengePassed = false;
    let progress = 0;
    let rawValue;

    switch (currentChallenge) {
      case "BLINK": {
        const leftEAR = calculateEAR(landmarks, "left");
        const rightEAR = calculateEAR(landmarks, "right");
        rawValue = Math.min(leftEAR, rightEAR);
        if (rawValue < this.#config.blinkEARThreshold) {
          challengePassed = true;
        }
        break;
      }
      case "TURN_LEFT": {
        const turnRatio = calculateHeadTurnV2(landmarks);
        rawValue = turnRatio;
        if (turnRatio > this.#config.headTurnThreshold) {
          challengePassed = true;
          progress = 1;
        } else {
          progress = Math.max(0, turnRatio / this.#config.headTurnThreshold);
        }
        break;
      }
      case "TURN_RIGHT": {
        const turnRatio = calculateHeadTurnV2(landmarks);
        rawValue = turnRatio;
        if (turnRatio < -this.#config.headTurnThreshold) {
          challengePassed = true;
          progress = 1;
        } else {
          progress = Math.max(0, turnRatio / -this.#config.headTurnThreshold);
        }
        break;
      }
    }

    const clampedProgress = Math.max(0, Math.min(progress, 1));
    this.#callbacks.onProgress?.(clampedProgress, rawValue);

    if (challengePassed) {
      this.#isChallengeProcessing = true;
      setTimeout(() => this.#moveToNextChallenge(), 300);
    } else if (
      Date.now() - this.#lastChallengeTime >
      this.#config.challengeTimeout
    ) {
      this.#failChallenge({
        code: "CHALLENGE_TIMEOUT",
        message: `Challenge timed out: ${currentChallenge}`,
      });
    }
  }

  #failChallenge(error) {
    this.stop();
    this.#callbacks.onFailure(error);
  }

  #moveToNextChallenge() {
    this.#currentChallengeIndex++;
    if (this.#currentChallengeIndex >= this.#challenges.length) {
      this.#completeLiveness();
    } else {
      this.#lastChallengeTime = Date.now();
      this.#callbacks.onChallengeChanged(
        this.#challenges[this.#currentChallengeIndex],
      );
      this.#isChallengeProcessing = false;
    }
  }

  async #completeLiveness() {
    this.stop();
    this.#callbacks.onChallengeChanged("PROCESSING");
    try {
      const inputSize = this.#recognitionModel.inputs[0].shape.slice(1, 3);
      const faceTensor = this.#getFaceTensor(inputSize);
      const predictionTensor = this.#recognitionModel.predict(faceTensor);
      const normalizedTensor = this.#tf.tidy(() => {
        const norm = predictionTensor.norm();
        if (norm.dataSync()[0] > 1e-6) {
          return predictionTensor.div(norm);
        }
        return predictionTensor;
      });
      const descriptorArray = await normalizedTensor.data();
      this.#tf.dispose([faceTensor, predictionTensor, normalizedTensor]);
      this.#callbacks.onSuccess(Array.from(descriptorArray));
    } catch (error) {
      console.error("Face recognition failed:", error);
      this.#failChallenge({
        code: "RECOGNITION_FAILED",
        message: error.message,
      });
    }
  }

  #getFaceTensor(inputSize) {
    return this.#tf.tidy(() => {
      const tensor = this.#tf.browser.fromPixels(this.#videoElement);
      const [height, width] = inputSize;
      const resized = this.#tf.image.resizeBilinear(tensor, [height, width]);
      const normalized = resized
        .toFloat()
        .div(this.#tf.scalar(127.5))
        .sub(this.#tf.scalar(1.0));
      return normalized.expandDims(0);
    });
  }

  #drawDebugOverlay(landmarksArray) {
    if (!this.#canvasCtx || !landmarksArray || landmarksArray.length === 0)
      return;
    const canvas = this.#canvasCtx.canvas;
    this.#canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const landmarks = landmarksArray[0];
    for (const [start, end] of this.#FACEMESH_TESSELATION_CONST) {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      this.#canvasCtx.beginPath();

      const startX = startPoint.x * canvas.width;
      const startY = startPoint.y * canvas.height;
      const endX = endPoint.x * canvas.width;
      const endY = endPoint.y * canvas.height;

      this.#canvasCtx.moveTo(startX, startY);
      this.#canvasCtx.lineTo(endX, endY);
      this.#canvasCtx.strokeStyle = "rgba(0, 255, 0, 0.3)";
      this.#canvasCtx.lineWidth = 1;
      this.#canvasCtx.stroke();
    }

    this.#canvasCtx.restore();
  }
}
