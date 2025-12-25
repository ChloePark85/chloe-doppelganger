/**
 * Korean Lip Sync - Maps Korean text to visemes (mouth shapes)
 *
 * Viseme mapping based on common mouth shapes:
 * - AA: Open mouth (ㅏ, ㅑ, ㅐ, ㅒ)
 * - E: Slightly open (ㅓ, ㅕ, ㅔ, ㅖ)
 * - O: Rounded (ㅗ, ㅛ)
 * - U: Very rounded/pursed (ㅜ, ㅠ)
 * - EE: Wide/smile (ㅣ)
 * - EU: Neutral/narrow (ㅡ)
 * - PP: Closed lips (ㅁ, ㅂ, ㅍ)
 * - SS: Narrow slit (ㅅ, ㅆ, ㅈ, ㅊ)
 * - NEUTRAL: Rest position
 */

export type Viseme = 'AA' | 'E' | 'O' | 'U' | 'EE' | 'EU' | 'PP' | 'SS' | 'NEUTRAL';

interface VisemeFrame {
  viseme: Viseme;
  duration: number; // in milliseconds
}

// Korean Unicode ranges
const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;

// Initial consonants (초성) - 19 jamo
const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// Vowels (중성) - 21 jamo
const VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];

// Final consonants (종성) - 28 jamo (including none)
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// Consonant to viseme mapping
const CONSONANT_VISEME: Record<string, Viseme> = {
  'ㅁ': 'PP', 'ㅂ': 'PP', 'ㅃ': 'PP', 'ㅍ': 'PP',  // Bilabial
  'ㅅ': 'SS', 'ㅆ': 'SS', 'ㅈ': 'SS', 'ㅉ': 'SS', 'ㅊ': 'SS',  // Sibilant
  'ㄴ': 'NEUTRAL', 'ㄷ': 'NEUTRAL', 'ㄸ': 'NEUTRAL', 'ㅌ': 'NEUTRAL',  // Alveolar
  'ㄱ': 'NEUTRAL', 'ㄲ': 'NEUTRAL', 'ㅋ': 'NEUTRAL',  // Velar
  'ㄹ': 'NEUTRAL',  // Liquid
  'ㅎ': 'NEUTRAL',  // Glottal
  'ㅇ': 'NEUTRAL',  // Silent initial
};

// Vowel to viseme mapping
const VOWEL_VISEME: Record<string, Viseme> = {
  'ㅏ': 'AA', 'ㅑ': 'AA', 'ㅐ': 'AA', 'ㅒ': 'AA',  // Open
  'ㅓ': 'E', 'ㅕ': 'E', 'ㅔ': 'E', 'ㅖ': 'E',  // Mid-open
  'ㅗ': 'O', 'ㅛ': 'O', 'ㅘ': 'O', 'ㅙ': 'O', 'ㅚ': 'O',  // Rounded
  'ㅜ': 'U', 'ㅠ': 'U', 'ㅝ': 'U', 'ㅞ': 'U', 'ㅟ': 'U',  // Very rounded
  'ㅡ': 'EU', 'ㅢ': 'EU',  // Unrounded close
  'ㅣ': 'EE',  // Front close
};

// Decompose a Korean syllable into jamo
function decomposeSyllable(char: string): { initial: string; vowel: string; final: string } | null {
  const code = char.charCodeAt(0);

  if (code < HANGUL_BASE || code > HANGUL_END) {
    return null;
  }

  const syllableIndex = code - HANGUL_BASE;
  const initialIndex = Math.floor(syllableIndex / (21 * 28));
  const vowelIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
  const finalIndex = syllableIndex % 28;

  return {
    initial: INITIALS[initialIndex],
    vowel: VOWELS[vowelIndex],
    final: FINALS[finalIndex],
  };
}

// Convert text to viseme sequence
export function textToVisemes(text: string): VisemeFrame[] {
  const frames: VisemeFrame[] = [];
  const avgSyllableDuration = 150; // ms per syllable (adjustable)

  for (const char of text) {
    const jamo = decomposeSyllable(char);

    if (jamo) {
      // Initial consonant (short)
      if (jamo.initial !== 'ㅇ') {
        const consonantViseme = CONSONANT_VISEME[jamo.initial] || 'NEUTRAL';
        frames.push({ viseme: consonantViseme, duration: avgSyllableDuration * 0.2 });
      }

      // Vowel (main duration)
      const vowelViseme = VOWEL_VISEME[jamo.vowel] || 'AA';
      frames.push({ viseme: vowelViseme, duration: avgSyllableDuration * 0.6 });

      // Final consonant (short)
      if (jamo.final) {
        const finalViseme = CONSONANT_VISEME[jamo.final] || 'NEUTRAL';
        frames.push({ viseme: finalViseme, duration: avgSyllableDuration * 0.2 });
      }
    } else if (char === ' ' || char === '.' || char === ',' || char === '?' || char === '!') {
      // Pause for punctuation/space
      frames.push({ viseme: 'NEUTRAL', duration: char === ' ' ? 50 : 200 });
    }
  }

  // Add final neutral
  frames.push({ viseme: 'NEUTRAL', duration: 100 });

  return frames;
}

// Convert viseme to ARKit blendshape values (52 blendshapes)
export function visemeToBlendshapes(viseme: Viseme): number[] {
  const blendshapes = new Array(52).fill(0);

  switch (viseme) {
    case 'AA': // Open mouth (ㅏ)
      blendshapes[17] = 0.4;  // jawOpen
      blendshapes[37] = 0.2;  // mouthLowerDownLeft
      blendshapes[38] = 0.2;  // mouthLowerDownRight
      break;

    case 'E': // Mid-open (ㅓ)
      blendshapes[17] = 0.25; // jawOpen
      blendshapes[19] = 0.15; // mouthFunnel
      break;

    case 'O': // Rounded (ㅗ)
      blendshapes[17] = 0.2;  // jawOpen
      blendshapes[19] = 0.3;  // mouthFunnel
      blendshapes[20] = 0.25; // mouthPucker
      break;

    case 'U': // Very rounded (ㅜ)
      blendshapes[17] = 0.1;  // jawOpen
      blendshapes[19] = 0.4;  // mouthFunnel
      blendshapes[20] = 0.4;  // mouthPucker
      break;

    case 'EE': // Wide/smile (ㅣ)
      blendshapes[17] = 0.1;  // jawOpen
      blendshapes[23] = 0.2;  // mouthSmileLeft
      blendshapes[24] = 0.2;  // mouthSmileRight
      blendshapes[29] = 0.15; // mouthStretchLeft
      blendshapes[30] = 0.15; // mouthStretchRight
      break;

    case 'EU': // Neutral/narrow (ㅡ)
      blendshapes[17] = 0.05; // jawOpen
      blendshapes[29] = 0.1;  // mouthStretchLeft
      blendshapes[30] = 0.1;  // mouthStretchRight
      break;

    case 'PP': // Closed lips (ㅁ, ㅂ)
      blendshapes[18] = 0.3;  // mouthClose
      blendshapes[35] = 0.2;  // mouthPressLeft
      blendshapes[36] = 0.2;  // mouthPressRight
      break;

    case 'SS': // Narrow slit (ㅅ, ㅈ)
      blendshapes[17] = 0.05; // jawOpen
      blendshapes[29] = 0.2;  // mouthStretchLeft
      blendshapes[30] = 0.2;  // mouthStretchRight
      break;

    case 'NEUTRAL':
    default:
      // All zeros - mouth closed naturally
      break;
  }

  return blendshapes;
}

// Interpolate between two blendshape arrays
export function interpolateBlendshapes(from: number[], to: number[], t: number): number[] {
  return from.map((val, i) => val + (to[i] - val) * t);
}

// LipSync controller class
export class KoreanLipSync {
  private frames: VisemeFrame[] = [];
  private currentFrameIndex = 0;
  private frameStartTime = 0;
  private isPlaying = false;
  private currentBlendshapes: number[] = new Array(52).fill(0);
  private targetBlendshapes: number[] = new Array(52).fill(0);

  start(text: string, audioDuration: number) {
    this.frames = textToVisemes(text);

    // Adjust timing to match audio duration
    const totalFrameDuration = this.frames.reduce((sum, f) => sum + f.duration, 0);
    const timeScale = audioDuration / totalFrameDuration;

    this.frames = this.frames.map(f => ({
      ...f,
      duration: f.duration * timeScale
    }));

    this.currentFrameIndex = 0;
    this.frameStartTime = performance.now();
    this.isPlaying = true;
    this.targetBlendshapes = visemeToBlendshapes(this.frames[0]?.viseme || 'NEUTRAL');

    console.log(`KoreanLipSync started: ${this.frames.length} frames, duration: ${audioDuration}ms`);
    console.log(`First 5 visemes:`, this.frames.slice(0, 5).map(f => f.viseme));
  }

  stop() {
    this.isPlaying = false;
    this.currentBlendshapes = new Array(52).fill(0);
    this.targetBlendshapes = new Array(52).fill(0);
  }

  update(): number[] {
    if (!this.isPlaying || this.frames.length === 0) {
      // Smoothly return to neutral
      this.currentBlendshapes = interpolateBlendshapes(
        this.currentBlendshapes,
        new Array(52).fill(0),
        0.1
      );
      return this.currentBlendshapes;
    }

    const now = performance.now();
    const elapsed = now - this.frameStartTime;
    const currentFrame = this.frames[this.currentFrameIndex];

    if (!currentFrame) {
      this.stop();
      return this.currentBlendshapes;
    }

    // Check if we need to advance to next frame
    if (elapsed >= currentFrame.duration) {
      this.currentFrameIndex++;
      this.frameStartTime = now;

      if (this.currentFrameIndex >= this.frames.length) {
        console.log("KoreanLipSync finished all frames");
        this.stop();
        return this.currentBlendshapes;
      }

      this.targetBlendshapes = visemeToBlendshapes(this.frames[this.currentFrameIndex].viseme);
    }

    // Smooth interpolation towards target
    this.currentBlendshapes = interpolateBlendshapes(
      this.currentBlendshapes,
      this.targetBlendshapes,
      0.3 // Smoothing factor
    );

    // Debug: log jawOpen value periodically
    if (this.currentFrameIndex % 10 === 0 && this.currentBlendshapes[17] > 0.05) {
      console.log(`LipSync frame ${this.currentFrameIndex}: jawOpen=${this.currentBlendshapes[17].toFixed(2)}`);
    }

    return this.currentBlendshapes;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
