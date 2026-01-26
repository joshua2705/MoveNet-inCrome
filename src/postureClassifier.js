import * as tfcore from '@tensorflow/tfjs-core';
import { loadGraphModel } from '@tensorflow/tfjs-converter';

export default class PostureClassifier {
  constructor() {
    this.model = null;
  }

  async loadModel() {
    const modelUrl = chrome.runtime.getURL('model/model.json');
    const model = await loadGraphModel(modelUrl);
    console.log("Model loaded!");
    this.model = model;
  }



  classify(deviation) {
    if (!deviation || !Array.isArray(deviation)) return 'Unknown';
    if (!this.model) return 'Unknown';

    // 1. Change these when model is changed
    const mins = [-0.12275609, -0.31493184, -47.666935, -0.06691397, -0.74889839, -0.013982756];
    const maxs = [0.30752733, 0.49658066, 1.57376, 0.66545904, 0.05898637, 0.18418466];

    // 2. Perform the MinMax Scaling: (x - min) / (max - min)
    const scaledDeviation = deviation.map((val, i) => {
      return (val - mins[i]) / (maxs[i] - mins[i]);
    });

    return tfcore.tidy(() => {
      const input = tfcore.tensor2d(scaledDeviation, [1, 6]);
      const prediction = this.model.predict(input);
      const score = prediction.dataSync()[0];
      console.log("Scaled Input:", scaledDeviation);
      console.log("Prediction Score:", score);
      return score > 0.5 ? 'Good' : 'Bad';
    });
  }
}
