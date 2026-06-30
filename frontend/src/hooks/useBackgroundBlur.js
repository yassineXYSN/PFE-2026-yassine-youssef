import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook to apply background blur using MediaPipe Selfie Segmentation.
 * @param {HTMLVideoElement} videoElement - The source video element.
 * @param {HTMLCanvasElement} canvasElement - The target canvas to draw the blurred output.
 * @param {boolean} isEnabled - Whether the blur effect is active.
 */
export const useBackgroundBlur = (videoElement, canvasElement, isEnabled) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const selfieSegmentationRef = useRef(null);

  useEffect(() => {
    // Check if SelfieSegmentation is available (loaded via CDN)
    const SelfieSegmentation = window.SelfieSegmentation;
    if (!SelfieSegmentation) {
      console.warn("[MediaPipe] SelfieSegmentation not loaded yet from CDN");
      return;
    }

    if (selfieSegmentationRef.current) return;

    const selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      },
    });

    selfieSegmentation.setOptions({
      modelSelection: 1, // 0 for general, 1 for landscape (better for backgrounds)
    });

    selfieSegmentation.onResults((results) => {
      if (!canvasElement || !videoElement || !results.image) return;
      if (videoElement.readyState < 2 || videoElement.videoWidth === 0) return;

      const canvasCtx = canvasElement.getContext('2d');
      const { width, height } = canvasElement;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, width, height);
      
      // Draw the segmentation mask
      canvasCtx.drawImage(results.segmentationMask, 0, 0, width, height);

      // Only apply blur if enabled
      if (isEnabled) {
        // Use the mask to draw only the person
        canvasCtx.globalCompositeOperation = 'source-in';
        canvasCtx.drawImage(results.image, 0, 0, width, height);

        // Draw the background (blurred)
        canvasCtx.globalCompositeOperation = 'destination-over';
        canvasCtx.filter = 'blur(15px)';
        canvasCtx.drawImage(results.image, 0, 0, width, height);
      } else {
        // Draw the full image normally
        canvasCtx.globalCompositeOperation = 'source-over';
        canvasCtx.drawImage(results.image, 0, 0, width, height);
      }

      canvasCtx.restore();
    });

    selfieSegmentationRef.current = selfieSegmentation;
    setIsLoaded(true);

    return () => {
      if (selfieSegmentationRef.current) {
        selfieSegmentationRef.current.close();
        selfieSegmentationRef.current = null;
      }
      setIsLoaded(false);
    };
  }, [canvasElement, videoElement, isEnabled]);

  const processFrame = useCallback(async () => {
    if (selfieSegmentationRef.current && 
        videoElement && 
        videoElement.readyState >= 2 && 
        videoElement.videoWidth > 0) {
      try {
        await selfieSegmentationRef.current.send({ image: videoElement });
      } catch (err) {
        console.error("[MediaPipe] Error processing frame:", err);
      }
    }
  }, [videoElement]);

  return { isLoaded, processFrame };
};
