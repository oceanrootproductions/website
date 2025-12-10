import { useMemo, useEffect } from "react";
import { Float, useFBX } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import headsetUrl from "../assets/models/Generic VR.fbx";

type Props = {
  autoRotate?: boolean;
  wireframe?: boolean;
};

export default function VRHeadset({
  autoRotate = true,
  wireframe = false,
}: Props) {
  const group = useMemo(() => new THREE.Group(), []);
  const fbx = useFBX(headsetUrl);

  useEffect(() => {
    fbx.scale.setScalar(0.008);
    fbx.rotation.y = Math.PI;
    fbx.position.set(0, 1.5, 0);
    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((mat) => {
          if (!("color" in mat)) return;
          const m = mat as THREE.MeshStandardMaterial;
          if (wireframe && "wireframe" in m) {
            m.wireframe = true;
          } else {
            m.metalness = 0.15;
            m.roughness = 0.35;
            m.wireframe = false;
          }
        });
      }
    });
  }, [fbx, wireframe]);

  useFrame((_, delta) => {
    if (autoRotate) group.rotation.y += delta * 0.2;
  });

  return (
    <group ref={(g) => g && g.add(group)}>
      <Float rotationIntensity={0.2} floatIntensity={0.3} speed={1}>
        <primitive object={fbx} />
      </Float>
    </group>
  );
}
