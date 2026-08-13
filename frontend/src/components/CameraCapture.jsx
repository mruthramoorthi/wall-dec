import { useEffect, useRef, useState } from 'react';

// Opens the device camera and lets the user capture a still frame as a Blob.
// `autoStart` mounts the stream immediately (Billing screen, to avoid capture
// delay); Stock Inward passes autoStart={false} and starts it on demand.
export default function CameraCapture({ autoStart = false, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
      setError(null);
    } catch (e) {
      setError('Could not access camera: ' + e.message);
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setActive(false);
  };

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => onCapture(blob), 'image/jpeg', 0.9);
  };

  return (
    <div className="camera-capture">
      {error && <div className="field-error">{error}</div>}
      {!active && <button type="button" onClick={start}>Open camera</button>}
      {active && (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
          <div>
            <button type="button" onClick={capture}>Capture photo</button>
            <button type="button" onClick={stop}>Close camera</button>
          </div>
        </>
      )}
    </div>
  );
}
