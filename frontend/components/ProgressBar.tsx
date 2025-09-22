// frontend/components/ProgressBar.tsx
"use client";
import React from "react";
import "./ProgressBar.css";

interface ArrowProps {
  direction: "left" | "right";
}

const Arrow: React.FC<ArrowProps> = ({ direction }) => (
  <div className={`arrow arrow-${direction}`}>
    &nbsp;{direction === "left" ? "❮" : "❯"}&nbsp;
  </div>
);

interface ProgressBarProps {
  progress: number;
  direction: "left" | "right";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  direction,
}) => {
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <div className="progress-container">
      <Arrow direction={direction} />
      <div className="progress-bar-background">
        <div
          className="progress-bar-filler"
          style={{ width: `${clampedProgress * 100}%` }}
        />
      </div>
      <Arrow direction={direction === "left" ? "right" : "left"} />
    </div>
  );
};
