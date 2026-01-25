export default class DeviationCalculator {

    constructor(width, height) {
      this.referenceKeypoints = null;
      this.liveKeypoints = null;
      this.width = width;
      this.height = height;
    }
  
    getNormalizedKeypoints(keypoints) {
    return keypoints.map(kp => {
        return {
            ...kp,
            x: (kp.x / this.width),
            y: (kp.y / this.height)
        };
    });
}
  // Calculate all deviation metrics between reference and live poses
  calculateDeviations(referenceKeypoints, liveKeypoints) {
    const deviations = {};

    // Only calculate if both poses have valid upper body keypoints
    if (!this.validateKeypoints(referenceKeypoints) || 
        !this.validateKeypoints(liveKeypoints)) {
      return null;
    }


    referenceKeypoints = this.getNormalizedKeypoints(referenceKeypoints);
    liveKeypoints = this.getNormalizedKeypoints(liveKeypoints);

    console.log("referenceKeypoints: ", referenceKeypoints);
    console.log("liveKeypoints: ", liveKeypoints);    

    // Feature 1: Head Forward Deviation
    deviations.headForward = this.calcHeadForwardDeviation(
      referenceKeypoints, liveKeypoints
    );

    // Feature 2: Neck-Shoulder Angle Deviation
    deviations.neckAngle = this.calcNeckAngleDeviation(
      referenceKeypoints, liveKeypoints
    );

    // Feature 3: Shoulder Slouch Deviation
    deviations.shoulderSlouch = this.calcShoulderSlouchDeviation(
      referenceKeypoints, liveKeypoints
    );

    // Feature 4: Head Tilt Deviation
    deviations.headTilt = this.calcHeadTiltDeviation(
      referenceKeypoints, liveKeypoints
    );

    // Feature 5: Shoulder Symmetry Deviation
    deviations.shoulderSymmetry = this.calcShoulderSymmetryDeviation(
      referenceKeypoints, liveKeypoints
    );

    return deviations;
  }

  // FEATURE 1: Head Forward Deviation
  calcHeadForwardDeviation(refKp, liveKp) {
    const refRatio = this.getHeadForwardRatio(refKp);
    const liveRatio = this.getHeadForwardRatio(liveKp);
    return Math.abs(liveRatio - refRatio);
  }

  getHeadForwardRatio(keypoints) {
    const nose = keypoints[0];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    
    if (!nose || !leftShoulder || !rightShoulder) return 0;

    // Calculate neck position (midpoint between shoulders)
    const neckX = (leftShoulder.x + rightShoulder.x) / 2;
    
    // Calculate shoulder width for normalization
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    
    // Head forward ratio: how far nose is ahead of neck, normalized
    return (nose.x - neckX) / shoulderWidth;
  }

  // FEATURE 2: Neck-Shoulder Angle Deviation (Craniovertebral Angle)
  calcNeckAngleDeviation(refKp, liveKp) {
    const refAngle = this.getCraniovertebralAngle(refKp);
    const liveAngle = this.getCraniovertebralAngle(liveKp);
    return Math.abs(liveAngle - refAngle);
  }

  getCraniovertebralAngle(keypoints) {
    const leftEar = keypoints[3];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    
    if (!leftEar || !leftShoulder || !rightShoulder) return 0;

    // Neck point (midpoint between shoulders)
    const neckX = (leftShoulder.x + rightShoulder.x) / 2;
    const neckY = (leftShoulder.y + rightShoulder.y) / 2;

    // Calculate angle between ear-neck line and vertical
    const angle = this.calculateAngle(
      leftEar.x, leftEar.y,
      neckX, neckY,
      neckX, 0 // Vertical reference point
    );

    return angle;
  }

  // FEATURE 3: Shoulder Slouch Deviation
  calcShoulderSlouchDeviation(refKp, liveKp) {
    const refRatio = this.getShoulderToNoseRatio(refKp);
    const liveRatio = this.getShoulderToNoseRatio(liveKp);
    return Math.abs(liveRatio - refRatio);
  }

  getShoulderToNoseRatio(keypoints) {
    const nose = keypoints[0];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    
    if (!nose || !leftShoulder || !rightShoulder) return 0;

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    
    // Vertical distance from nose to shoulders, normalized
    return Math.abs(nose.y - shoulderY) / shoulderWidth;
  }

  // FEATURE 4: Head Tilt Deviation
  calcHeadTiltDeviation(refKp, liveKp) {
    const refTilt = this.getHeadTiltAngle(refKp);
    const liveTilt = this.getHeadTiltAngle(liveKp);
    return Math.abs(liveTilt - refTilt);
  }

  getHeadTiltAngle(keypoints) {
    const leftEye = keypoints[1];
    const rightEye = keypoints[2];
    
    if (!leftEye || !rightEye) return 0;

    // Angle of line between eyes relative to horizontal
    const deltaY = rightEye.y - leftEye.y;
    const deltaX = rightEye.x - leftEye.x;
    
    return Math.abs(Math.atan2(deltaY, deltaX) * (180 / Math.PI));
  }

  // FEATURE 5: Shoulder Symmetry Deviation
  calcShoulderSymmetryDeviation(refKp, liveKp) {
    const refSlope = this.getShoulderSlope(refKp);
    const liveSlope = this.getShoulderSlope(liveKp);
    return Math.abs(liveSlope - refSlope);
  }

  getShoulderSlope(keypoints) {
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    
    if (!leftShoulder || !rightShoulder) return 0;

    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    
    // Normalized slope (height difference / width)
    return (rightShoulder.y - leftShoulder.y) / shoulderWidth;
  }

  // UTILITY: Calculate angle between three points (A, B, C) where B is vertex
  calculateAngle(ax, ay, bx, by, cx, cy) {
    // Vectors BA and BC
    const ba_x = ax - bx;
    const ba_y = ay - by;
    const bc_x = cx - bx;
    const bc_y = cy - by;

    // Dot product and magnitudes
    const dotProduct = ba_x * bc_x + ba_y * bc_y;
    const magnitudeBA = Math.sqrt(ba_x * ba_x + ba_y * ba_y);
    const magnitudeBC = Math.sqrt(bc_x * bc_x + bc_y * bc_y);

    // Angle in degrees
    const cosineAngle = dotProduct / (magnitudeBA * magnitudeBC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosineAngle)));
    
    return angle * (180 / Math.PI);
  }

  // Validate required keypoints exist
  validateKeypoints(keypoints) {
    const requiredKeypoints = [0, 3, 4, 5, 6]; // nose, ears, shoulders
    return requiredKeypoints.every(idx => keypoints[idx].score > 0.3);
  }
}
