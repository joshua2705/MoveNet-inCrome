export default class DeviationCalculator {
  
 // Keypoint indices (matching Python constants)
  static NOSE = 0;
  static LEFT_EYE = 1;
  static RIGHT_EYE = 2;
  static LEFT_EAR = 3;
  static RIGHT_EAR = 4;
  static LEFT_SHOULDER = 5;
  static RIGHT_SHOULDER = 6;
  static LEFT_ELBOW = 7;
  static RIGHT_ELBOW = 8;
  static LEFT_WRIST = 9;
  static RIGHT_WRIST = 10;
  static LEFT_HIP = 11;
  static RIGHT_HIP = 12;
  static LEFT_KNEE = 13;
  static RIGHT_KNEE = 14;
  static LEFT_ANKLE = 15;
  static RIGHT_ANKLE = 16;

  // Minimum confidence threshold for valid keypoint
  static MIN_CONFIDENCE = 0.3;

  // Feature names (for reference)
  static FEATURE_NAMES = [
    'shoulder_width',
    'head_forward_ratio',
    'neck_angle',
    'shoulder_symmetry',
    'shoulder_ear_distance',
    'eye_alignment',
    'shoulder_angle'
  ];
  // Features used by the neural network (6 features - shoulder_angle dropped due to correlation)
  static MODEL_FEATURE_NAMES = [
    'dev_shoulder_width',
    'dev_head_forward_ratio',
    'dev_neck_angle',
    'dev_shoulder_symmetry',
    'dev_shoulder_ear_distance',
    'dev_eye_alignment'
  ];


  constructor(width, height) {
    this.referenceKeypoints = null;
    this.liveKeypoints = null;
    this.width = width;
    this.height = height;
  }

  /**
     * Normalize keypoints from pixel coordinates to 0-1 range.
   * Converts from {x, y, score} objects to [y, x, confidence] arrays
   * to match Python's MoveNet output format.
   * 
   * @param {Array} keypoints - Array of {x, y, score, name} objects
   * @returns {Array} Array of [y, x, confidence] arrays (normalized)
   */
  normalizeKeypoints(keypoints) {
    return keypoints.map(kp => [
      kp.y / this.height,  // y normalized (index 0)
      kp.x / this.width,   // x normalized (index 1)
      kp.score             // confidence (index 2)
    ]);
  }
  isKeypointValid(keypoint, minConfidence = DeviationCalculator.MIN_CONFIDENCE) {
    return keypoint[2] >= minConfidence;
  }

  // helper functions 
  euclideanDistance(point1, point2) {
    const y1 = point1[0], x1 = point1[1];
    const y2 = point2[0], x2 = point2[1];
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

 
  midpoint(point1, point2) {
    const midY = (point1[0] + point2[0]) / 2;
    const midX = (point1[1] + point2[1]) / 2;
    const avgConfidence = (point1[2] + point2[2]) / 2;
    return [midY, midX, avgConfidence];
  }
  calculateAngle(point1, point2, point3) {
    const y1 = point1[0], x1 = point1[1];
    const y2 = point2[0], x2 = point2[1];
    const y3 = point3[0], x3 = point3[1];

    // Vectors from point2 to point1 and point2 to point3
    const vector1 = [x1 - x2, y1 - y2];
    const vector2 = [x3 - x2, y3 - y2];

    // Dot product
    const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];

    // Magnitudes
    const magnitude1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
    const magnitude2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);

    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0.0;
    }

    // Cosine of angle
    let cosAngle = dotProduct / (magnitude1 * magnitude2);

    // Clamp to [-1, 1] to avoid Math.acos domain errors
    cosAngle = Math.max(-1.0, Math.min(1.0, cosAngle));

    // Convert to degrees
    const angleRadians = Math.acos(cosAngle);
    const angleDegrees = angleRadians * (180 / Math.PI);

    return angleDegrees;
  }

// STARTING WITH FEATURE CALCULATIONS

  getShoulderWidth(keypoints) {
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    if (!this.isKeypointValid(leftShoulder) || !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    return this.euclideanDistance(leftShoulder, rightShoulder);
  }

  calculateHeadForwardRatio(keypoints) {
    const nose = keypoints[DeviationCalculator.NOSE];
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    if (!this.isKeypointValid(nose) || 
        !this.isKeypointValid(leftShoulder) || 
        !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    const shoulderWidth = this.getShoulderWidth(keypoints);
    if (shoulderWidth === null || shoulderWidth === 0) {
      return null;
    }

    const midShoulder = this.midpoint(leftShoulder, rightShoulder);

    // Horizontal distance (x-axis) from nose to mid-shoulder
    const horizontalDistance = nose[1] - midShoulder[1];

    return horizontalDistance / shoulderWidth;
  }

  calculateNeckAngle(keypoints) {
    const nose = keypoints[DeviationCalculator.NOSE];
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    if (!this.isKeypointValid(nose) || 
        !this.isKeypointValid(leftShoulder) || 
        !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    const midShoulder = this.midpoint(leftShoulder, rightShoulder);

    // Create reference point directly below mid-shoulder (vertical reference)
    const referencePoint = [midShoulder[0] + 0.3, midShoulder[1], midShoulder[2]];

    // Calculate angle: nose -> mid_shoulder -> reference_point
    const angle = this.calculateAngle(nose, midShoulder, referencePoint);

    return angle;
  }

  /**
   * Calculate shoulder symmetry (levelness).
   * Measures height difference between shoulders.
   * 
   * Formula: |left_shoulder_y - right_shoulder_y| / shoulder_width
   * 
   * Interpretation:
   *   - Near 0: Shoulders level (good)
   *   - >0.1: Noticeable tilt
   * 
   * @param {Array} keypoints - Normalized keypoints array
   * @returns {number|null} Shoulder symmetry ratio or null
   */

  calculateShoulderSymmetry(keypoints) {
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    if (!this.isKeypointValid(leftShoulder) || !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    const shoulderWidth = this.getShoulderWidth(keypoints);
    if (shoulderWidth === null || shoulderWidth === 0) {
      return null;
    }

    // Absolute difference in y-coordinates (vertical position)
    const heightDifference = Math.abs(leftShoulder[0] - rightShoulder[0]);

    return heightDifference / shoulderWidth;
  }

  calculateShoulderEarDistance(keypoints) {
    const leftEar = keypoints[DeviationCalculator.LEFT_EAR];
    const rightEar = keypoints[DeviationCalculator.RIGHT_EAR];
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    const leftEarValid = this.isKeypointValid(leftEar);
    const rightEarValid = this.isKeypointValid(rightEar);

    // Need at least one ear
    if (!leftEarValid && !rightEarValid) {
      return null;
    }

    if (!this.isKeypointValid(leftShoulder) || !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    const shoulderWidth = this.getShoulderWidth(keypoints);
    if (shoulderWidth === null || shoulderWidth === 0) {
      return null;
    }

    // Calculate average ear position (use available ears)
    let avgEarY;
    if (leftEarValid && rightEarValid) {
      avgEarY = (leftEar[0] + rightEar[0]) / 2;
    } else if (leftEarValid) {
      avgEarY = leftEar[0];
    } else {
      avgEarY = rightEar[0];
    }

    // Calculate average shoulder position
    const avgShoulderY = (leftShoulder[0] + rightShoulder[0]) / 2;

    // Vertical distance (y increases downward in images)
    const distance = Math.abs(avgEarY - avgShoulderY);

    return distance / shoulderWidth;
  }

  /**
   * Calculate eye alignment (head tilt based on eyes).
   * 
   * Formula: |left_eye_y - right_eye_y| / shoulder_width
   * Interpretation:
   *   - Near 0: Head level (good)
   *   - >0.05: Head tilted to one side
   * @param {Array} keypoints - Normalized keypoints array @returns {number|null} Eye alignment ratio or null
   */
  calculateEyeAlignment(keypoints) {
    const leftEye = keypoints[DeviationCalculator.LEFT_EYE];
    const rightEye = keypoints[DeviationCalculator.RIGHT_EYE];

    if (!this.isKeypointValid(leftEye) || !this.isKeypointValid(rightEye)) {
      return null;
    }

    const shoulderWidth = this.getShoulderWidth(keypoints);
    if (shoulderWidth === null || shoulderWidth === 0) {
      return null;
    }

    // Height difference between eyes
    const eyeHeightDiff = Math.abs(leftEye[0] - rightEye[0]);

    return eyeHeightDiff / shoulderWidth;
  }

  /**
   * Calculate shoulder angle relative to horizontal.
   * Measures if person is leaning to one side.
   */
  calculateShoulderAngle(keypoints) {
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    if (!this.isKeypointValid(leftShoulder) || !this.isKeypointValid(rightShoulder)) {
      return null;
    }

    const leftY = leftShoulder[0], leftX = leftShoulder[1];
    const rightY = rightShoulder[0], rightX = rightShoulder[1];

    // Calculate angle using arctangent
    const angleRadians = Math.atan2(rightY - leftY, rightX - leftX);
    const angleDegrees = Math.abs(angleRadians * (180 / Math.PI));

    return angleDegrees;
  }

  // MAIN FEATURE EXTRACTION - Clculating all 7 features from keypoints

  /**
   * Calculate all 7 posture features from keypoints.
   * 
   * @param {Array} keypoints - Raw keypoints from TF.js ({x, y, score} objects)
   * @returns {Array} Feature vector [7 values], NaN for missing features
   */
  calculateFeatures(keypoints) {
    // Normalize keypoints to [y, x, confidence] format
    const normalizedKp = this.normalizeKeypoints(keypoints);

    // Initialize with NaN for missing features
    const features = new Array(7).fill(NaN);

    // Feature 0: Shoulder width
    const shoulderWidth = this.getShoulderWidth(normalizedKp);
    if (shoulderWidth !== null) {
      features[0] = shoulderWidth;
    }

    // Feature 1: Head forward ratio
    const headForward = this.calculateHeadForwardRatio(normalizedKp);
    if (headForward !== null) {
      features[1] = headForward;
    }

    // Feature 2: Neck angle
    const neckAngle = this.calculateNeckAngle(normalizedKp);
    if (neckAngle !== null) {
      features[2] = neckAngle;
    }

    // Feature 3: Shoulder symmetry
    const shoulderSym = this.calculateShoulderSymmetry(normalizedKp);
    if (shoulderSym !== null) {
      features[3] = shoulderSym;
    }

    // Feature 4: Shoulder-ear distance
    const earDist = this.calculateShoulderEarDistance(normalizedKp);
    if (earDist !== null) {
      features[4] = earDist;
    }

    // Feature 5: Eye alignment
    const eyeAlign = this.calculateEyeAlignment(normalizedKp);
    if (eyeAlign !== null) {
      features[5] = eyeAlign;
    }

    // Feature 6: Shoulder angle
    const shoulderAng = this.calculateShoulderAngle(normalizedKp);
    if (shoulderAng !== null) {
      features[6] = shoulderAng;
    }

    return features;
  }

  // DEVIATION CALCULATION -  Store reference features from calibration pose.
   
  setReferenceKeypoints(referenceKeypoints) {
    this.referenceFeatures = this.calculateFeatures(referenceKeypoints);
    console.log('Reference features calculated:', this.referenceFeatures);
  }

  /**
   * Validate that required keypoints are detected.
   * 
   * @param {Array} keypoints - Raw keypoints from TF.js
   * @returns {boolean} True if valid
   */
  validateKeypoints(keypoints) {
    if (!keypoints || keypoints.length < 17) {
      return false;
    }

    // Required: nose, ears (at least one), shoulders
    const nose = keypoints[DeviationCalculator.NOSE];
    const leftEar = keypoints[DeviationCalculator.LEFT_EAR];
    const rightEar = keypoints[DeviationCalculator.RIGHT_EAR];
    const leftShoulder = keypoints[DeviationCalculator.LEFT_SHOULDER];
    const rightShoulder = keypoints[DeviationCalculator.RIGHT_SHOULDER];

    const noseValid = nose && nose.score > DeviationCalculator.MIN_CONFIDENCE;
    const earValid = (leftEar && leftEar.score > DeviationCalculator.MIN_CONFIDENCE) ||
                     (rightEar && rightEar.score > DeviationCalculator.MIN_CONFIDENCE);
    const shouldersValid = leftShoulder && leftShoulder.score > DeviationCalculator.MIN_CONFIDENCE &&
                           rightShoulder && rightShoulder.score > DeviationCalculator.MIN_CONFIDENCE;

    return noseValid && earValid && shouldersValid;
  }

  /**
   * Calculating deviations bw ref and live poses - Returns 6 dev features used by the neural network. 
   * @param {Array} referenceKeypoints - Reference pose keypoints
   * @param {Array} liveKeypoints - Current pose keypoints
   * @returns {Object|null} Deviation object with 6 features, or null if invalid
   */
  calculateDeviations(referenceKeypoints, liveKeypoints) {
    // Validate inputs
    if (!this.validateKeypoints(referenceKeypoints) || 
        !this.validateKeypoints(liveKeypoints)) {
      return null;
    }

    // Calculate features for both poses
    const refFeatures = this.calculateFeatures(referenceKeypoints);
    const liveFeatures = this.calculateFeatures(liveKeypoints);

    // Check for too many missing features
    const refMissing = refFeatures.filter(f => isNaN(f)).length;
    const liveMissing = liveFeatures.filter(f => isNaN(f)).length;

    if (refMissing > 2 || liveMissing > 2) {
      console.warn('Too many missing features:', { refMissing, liveMissing });
      return null;
    }

    // Calculate signed deviations (live - reference)
    // Note: We exclude shoulder_angle (index 6) as it was dropped during training
    const deviations = {
      dev_shoulder_width: liveFeatures[0] - refFeatures[0],
      dev_head_forward_ratio: liveFeatures[1] - refFeatures[1],
      dev_neck_angle: liveFeatures[2] - refFeatures[2],
      dev_shoulder_symmetry: liveFeatures[3] - refFeatures[3],
      dev_shoulder_ear_distance: liveFeatures[4] - refFeatures[4],
      dev_eye_alignment: liveFeatures[5] - refFeatures[5]
    };

    // Handle NaN values - replace with 0 (median imputation like in training)
    for (const key in deviations) {
      if (isNaN(deviations[key])) {
        deviations[key] = 0;
      }
    }

    console.log('Calculated deviations:', deviations);

    return deviations;
  }

  /**
   * Get deviation values as an array in the order expected by the neural network.
   * 
   * @param {Object} deviations - Deviation object from calculateDeviations()
   * @returns {Array} Array of 6 deviation values
   */
  getDeviationArray(deviations) {
    if (!deviations) return null;

    return [
      deviations.dev_shoulder_width,
      deviations.dev_head_forward_ratio,
      deviations.dev_neck_angle,
      deviations.dev_shoulder_symmetry,
      deviations.dev_shoulder_ear_distance,
      deviations.dev_eye_alignment
    ];
  }
}

