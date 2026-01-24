export default class PostureClassifier {
  constructor() {
    this.model = null;
  }

  async loadModel() {
    // Load Neural Network from a Pickle File
    this.model = "Yolo"
    console.log('MoveNet model loaded');
  }

  classify(deviation) {
    // Classify the deviation
    if(deviation === null) {return 'Unknown';}
    
    console.log('PostureClassifier model loaded');
    return 'Good';
  }
}
