// engine/utils.js
const EYE_INDICES = {
  left: [362, 385, 387, 263, 373, 380],
  right: [33, 160, 158, 133, 153, 144],
};

const HEAD_POSE_INDICES = {
  leftCheek: 234,
  rightCheek: 454,
  chin: 152,
};

function euclideanDistance(p1, p2) {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2),
  );
}

export function calculateEAR(landmarks, side) {
  const indices = EYE_INDICES[side];
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const verticalDist1 = euclideanDistance(p2, p6);
  const verticalDist2 = euclideanDistance(p3, p5);
  const horizontalDist = euclideanDistance(p1, p4);

  if (horizontalDist === 0) return 0;

  const ear = (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
  return ear;
}

export function calculateHeadTurnV2(landmarks) {
  const leftCheek = landmarks[HEAD_POSE_INDICES.leftCheek];
  const rightCheek = landmarks[HEAD_POSE_INDICES.rightCheek];
  const chin = landmarks[HEAD_POSE_INDICES.chin];

  const leftDepth = leftCheek.z - chin.z;
  const rightDepth = rightCheek.z - chin.z;

  const faceWidth = euclideanDistance(leftCheek, rightCheek);
  if (faceWidth < 0.1) return 0;

  const turnRatio = (rightDepth - leftDepth) / faceWidth;

  return turnRatio;
}
