import cv2
import torch
import os
from torchvision.transforms import ToTensor, Compose, Normalize
from .model_emotion_classifier import EmotionClassifier

class EmotionEngine:
    def __init__(self, weights_path='backend/weights/resnet_best.pth'):
        self.class_to_emotion = {
            0: 'angry', 1: 'disgust', 2: 'fear', 3: 'happy', 
            4: 'neutral', 5: 'sad', 6: 'surprise'
        }
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = EmotionClassifier()
        
        # Load weights if they exist
        if os.path.exists(weights_path):
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        else:
            # Try absolute path from the current file's directory as fallback
            abs_weights_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'weights', 'resnet_best.pth')
            if os.path.exists(abs_weights_path):
                self.model.load_state_dict(torch.load(abs_weights_path, map_location=self.device))
            else:
                print(f"Warning: Emotion weights not found at {weights_path} or {abs_weights_path}")
        
        self.model.to(self.device)
        self.model.eval()
        
        # Transformation pipeline
        self.transform = Compose([
            ToTensor(),
            Normalize((0.5,), (0.5,))
        ])
        
        # Load Haar Cascade for face detection
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def process_frame(self, frame):
        """
        Processes a single BGR frame and returns prediction results.
        Returns: (frame, detected_emotions_list)
        """
        if frame is None:
            return None, []

        # Resize to a standard resolution for consistent detection
        h, w = frame.shape[:2]
        if w > 640:
            scale = 640 / w
            frame = cv2.resize(frame, (640, int(h * scale)))

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Equalize histogram to improve detection in variable lighting
        gray = cv2.equalizeHist(gray)
        
        # More permissive detection parameters
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(20, 20),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        results = []

        for (x, y, w, h) in faces:
            # Extract face from image & convert to tensor
            face_roi = gray[y:y+h, x:x+w]
            face_roi = cv2.resize(face_roi, (48, 48))
            image = self.transform(face_roi).unsqueeze(0).to(self.device)

            # Make a prediction
            with torch.no_grad():
                output = self.model(image)
                predicted_class = torch.argmax(output, dim=1).item()
                emotion = self.class_to_emotion[predicted_class]

            results.append({
                'emotion': emotion,
                'box': [int(x), int(y), int(w), int(h)]
            })

        return frame, results
