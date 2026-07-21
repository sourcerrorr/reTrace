import { useEffect, useRef, useState } from "react";

/* ─── hand camera ─────────────────────────────────────────────────────────── */
/**
 * Webcam preview for hand tracking. Camera only — no landmark detection here.
 *
 * The preview is mirrored like a selfie camera (scaleX(-1)), which is what
 * the session screen's placeholder already fakes. When MediaPipe lands, its
 * source gets the raw <video> element through `onVideoReady` and must mirror
 * X when mapping landmarks to screen px, so fingertip and preview agree
 * (see src/app/input.ts).
 *
 * The stream is stopped on unmount and on a request that resolves after
 * unmount, so the camera light never stays on behind the user's back.
 */

// Matches the palette in App.tsx; copied rather than imported to keep this
// component droppable into any screen without pulling App along.
const C = {
  ink: "#1A1A1A",
  border: "#E4DFD3",
  sage300: "#A8C4A0",
  text: "rgba(255,255,255,0.85)",
  textDim: "rgba(255,255,255,0.55)",
} as const;

type CameraStatus = "requesting" | "active" | "error";

function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera access was declined. Allow the camera in your browser's site settings, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera seems to be in use by another app. Close it and try again.";
    default:
      return "The camera couldn't start.";
  }
}

export function HandCamera({
  onVideoReady,
  mirrored = true,
}: {
  /** Fired once the stream is playing — hand tracking will read frames from this element. */
  onVideoReady?: (video: HTMLVideoElement) => void;
  /** Selfie-style mirroring. Leave on unless you have a rear-facing setup. */
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("requesting");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Kept in a ref so a parent passing an inline callback doesn't restart the
  // camera on every render (the effect must not depend on the callback).
  const onVideoReadyRef = useRef(onVideoReady);
  onVideoReadyRef.current = onVideoReady;

  useEffect(() => {
    let cancelled = false;
    setStatus("requesting");
    setErrorMessage("");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMessage("This browser can't access the camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus("active");
        onVideoReadyRef.current?.(video);
      } catch (err) {
        // play() aborts when the element is torn down mid-start; that's not an error.
        if (cancelled || (err instanceof DOMException && err.name === "AbortError" && streamRef.current)) return;
        setStatus("error");
        setErrorMessage(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [attempt]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 180,
        background: C.ink,
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : "none",
          opacity: status === "active" ? 1 : 0,
          transition: "opacity 220ms ease-out",
        }}
      />

      {status !== "active" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          {status === "requesting" ? (
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 16,
                color: C.textDim,
                margin: 0,
              }}
            >
              Starting camera…
            </p>
          ) : (
            <>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: C.text,
                  margin: 0,
                  maxWidth: 360,
                }}
              >
                {errorMessage}
              </p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                style={{
                  height: 48,
                  padding: "0 24px",
                  background: "transparent",
                  border: `1px solid ${C.sage300}`,
                  borderRadius: 12,
                  color: C.sage300,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
