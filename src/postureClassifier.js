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
    if (!deviation) return 'Unknown';
    if (!this.model) return 'Unknown';

    deviation = [0.1619578 , 0.38257828, 0.9598749 , 0.15382814, 0.8445233 , 0.02556589]
    return tfcore.tidy(() => {
      const input = tfcore.tensor2d(deviation, [1, 6]);
      const prediction = this.model.predict(input);
      console.log("prediction: ", prediction);
      const score = prediction.dataSync()[0]; 
      return score > 0.5 ? 'Good' : 'Bad';
    });
  }
}
