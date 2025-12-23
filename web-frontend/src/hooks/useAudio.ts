import { useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { setBlendshapes, setIsPlaying } = useAppStore();

  const playAudioWithBlendshapes = useCallback(
    async (audioBase64: string, blendshapes: number[][]): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          // Stop any existing playback
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          setIsPlaying(true);

          // Decode base64 audio
          const binaryString = atob(audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Create audio blob and URL
          const blob = new Blob([bytes], { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(blob);

          // Create audio element
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          // Animation parameters
          const fps = 60;
          const frameDuration = 1000 / fps;
          let frameIndex = 0;
          let lastFrameTime = 0;

          // Animation loop
          const animate = (currentTime: number) => {
            if (!audio.paused && !audio.ended) {
              if (currentTime - lastFrameTime >= frameDuration) {
                if (frameIndex < blendshapes.length) {
                  setBlendshapes(blendshapes[frameIndex]);
                  frameIndex++;
                }
                lastFrameTime = currentTime;
              }
              animationFrameRef.current = requestAnimationFrame(animate);
            }
          };

          audio.onplay = () => {
            lastFrameTime = performance.now();
            animationFrameRef.current = requestAnimationFrame(animate);
          };

          audio.onended = () => {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            setBlendshapes(new Array(52).fill(0));
            setIsPlaying(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };

          audio.onerror = (e) => {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            setBlendshapes(new Array(52).fill(0));
            setIsPlaying(false);
            URL.revokeObjectURL(audioUrl);
            reject(new Error("Audio playback failed"));
          };

          // Start playback
          audio.play().catch(reject);
        } catch (error) {
          setIsPlaying(false);
          reject(error);
        }
      });
    },
    [setBlendshapes, setIsPlaying]
  );

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setBlendshapes(new Array(52).fill(0));
    setIsPlaying(false);
  }, [setBlendshapes, setIsPlaying]);

  return {
    playAudioWithBlendshapes,
    stopPlayback,
  };
}
