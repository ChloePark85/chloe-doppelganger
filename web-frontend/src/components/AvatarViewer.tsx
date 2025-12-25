"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "@/lib/store";

interface AvatarModelProps {
  url: string;
}

function AvatarModel({ url }: AvatarModelProps) {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Group>(null);
  const { blendshapes, isPlaying } = useAppStore();
  const [skinnedMeshes, setSkinnedMeshes] = useState<THREE.SkinnedMesh[]>([]);

  // Find all skinned meshes with morph targets
  useEffect(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        child.morphTargetInfluences &&
        child.morphTargetDictionary
      ) {
        meshes.push(child);
        // Log available morph targets for debugging
        console.log("Morph targets found:", Object.keys(child.morphTargetDictionary));
      }
    });
    setSkinnedMeshes(meshes);
    console.log(`Found ${meshes.length} skinned meshes with morph targets`);
  }, [scene]);

  // Apply blendshapes
  useFrame((state, delta) => {
    // Debug: log when blendshapes change
    const jawValue = blendshapes[17];
    if (jawValue > 0.1) {
      console.log("AvatarViewer receiving jawOpen:", jawValue.toFixed(2), "meshes:", skinnedMeshes.length);
    }

    skinnedMeshes.forEach((mesh) => {
      if (!mesh.morphTargetInfluences || !mesh.morphTargetDictionary) return;

      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;

      // Map ARKit blendshapes to mesh morph targets
      Object.entries(dict).forEach(([name, index]) => {
        // Try to find matching ARKit blendshape
        const arkitIndex = getARKitIndex(name);
        if (arkitIndex !== -1 && arkitIndex < blendshapes.length) {
          const targetValue = blendshapes[arkitIndex];
          // Smooth interpolation
          influences[index] = THREE.MathUtils.lerp(
            influences[index],
            targetValue,
            delta * 10
          );
        } else {
          // Fallback: apply jaw open value to any mouth/jaw related morph targets
          const lowerName = name.toLowerCase();
          if (lowerName.includes("jaw") || lowerName.includes("mouth") ||
              lowerName.includes("open") || lowerName.includes("viseme")) {
            const jawValue = blendshapes[17]; // Use jawOpen value
            influences[index] = THREE.MathUtils.lerp(
              influences[index],
              jawValue,
              delta * 10
            );
          }
        }
      });
    });

    // Idle animation (subtle breathing/movement)
    if (meshRef.current && !isPlaying) {
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.y = Math.sin(time * 0.5) * 0.02;
      meshRef.current.position.y = Math.sin(time * 0.8) * 0.005;
    }
  });

  return (
    <group ref={meshRef} position={[0, -0.3, 0]} scale={4}>
      <primitive object={scene} />
    </group>
  );
}

// Map common blendshape naming conventions to ARKit indices
function getARKitIndex(name: string): number {
  const normalizedName = name.toLowerCase().replace(/[_\s-]/g, "");

  const mappings: Record<string, number> = {
    // ARKit standard names
    eyeblinkleft: 0,
    eyelookdownleft: 1,
    eyelookinleft: 2,
    eyelookoutleft: 3,
    eyelookupleft: 4,
    eyesquintleft: 5,
    eyewideleft: 6,
    eyeblinkright: 7,
    eyelookdownright: 8,
    eyelookinright: 9,
    eyelookoutright: 10,
    eyelookupright: 11,
    eyesquintright: 12,
    eyewideright: 13,
    jawforward: 14,
    jawleft: 15,
    jawright: 16,
    jawopen: 17,
    mouthclose: 18,
    mouthfunnel: 19,
    mouthpucker: 20,
    mouthleft: 21,
    mouthright: 22,
    mouthsmileleft: 23,
    mouthsmileright: 24,
    mouthfrownleft: 25,
    mouthfrownright: 26,
    mouthdimpleleft: 27,
    mouthdimpleright: 28,
    mouthstretchleft: 29,
    mouthstretchright: 30,
    mouthrolllower: 31,
    mouthrollupper: 32,
    mouthshruglower: 33,
    mouthshrugupper: 34,
    mouthpressleft: 35,
    mouthpressright: 36,
    mouthlowerdownleft: 37,
    mouthlowerdownright: 38,
    mouthupperupleft: 39,
    mouthupperupright: 40,
    browdownleft: 41,
    browdownright: 42,
    browinnerup: 43,
    browouterupleft: 44,
    browouterupright: 45,
    cheekpuff: 46,
    cheeksquintleft: 47,
    cheeksquintright: 48,
    nosesneerleft: 49,
    nosesneerright: 50,
    tongueout: 51,
    // Alternative naming conventions (Oculus/Meta visemes, Ready Player Me, etc.)
    visemeaa: 17, // maps to jawOpen
    visemeo: 17,
    visemeou: 17,
    visemeee: 19, // maps to mouthFunnel
    visemeih: 19,
    visemech: 19,
    visemedd: 18, // maps to mouthClose
    visemeff: 20, // maps to mouthPucker
    visemekk: 18,
    visemenn: 18,
    visemepp: 18,
    visemess: 19,
    visemeth: 19,
    visemesil: 18,
    mouthopen: 17,
    openjaw: 17,
    openmouth: 17,
    aa: 17,
    oh: 17,
  };

  return mappings[normalizedName] ?? -1;
}

function LoadingIndicator() {
  return null; // 로딩 중에는 아무것도 표시 안함
}

function Scene() {
  const { avatarUrl } = useAppStore();

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <spotLight
        position={[0, 5, 0]}
        angle={0.3}
        penumbra={1}
        intensity={0.5}
        castShadow
      />

      <Suspense fallback={<LoadingIndicator />}>
        {avatarUrl && <AvatarModel url={avatarUrl} />}
      </Suspense>

      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.4}
        scale={5}
        blur={2.5}
      />
      <Environment preset="studio" />

      <OrbitControls
        enablePan={false}
        minDistance={1}
        maxDistance={5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function AvatarViewer() {
  const { setAvatarUrl } = useAppStore();

  // Handle avatar file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".glb") || file.name.endsWith(".gltf"))) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="w-full h-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Scene />
      </Canvas>

      {/* Drop zone hint */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500">
        GLB/GLTF 파일을 드래그하여 아바타 로드
      </div>
    </div>
  );
}
