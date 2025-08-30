import { useMemo } from 'react'
import { Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Props = {
  autoRotate?: boolean
  wireframe?: boolean
}

export default function VRHeadset({ autoRotate = true, wireframe = false }: Props) {
  const group = useMemo(() => new THREE.Group(), [])

  useFrame((_, delta) => {
    if (autoRotate) group.rotation.y += delta * 0.2
  })

  return (
    <group ref={(g) => g && g.add(group)}>
      <Float rotationIntensity={0.2} floatIntensity={0.3} speed={1}>
        {/* Main visor body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.1, 0.9, 0.8]} />
          <meshStandardMaterial color="#2b6c8f" roughness={0.9} metalness={0.2} flatShading wireframe={wireframe} />
        </mesh>

        {/* Front glass panel */}
        <mesh position={[0, 0.02, 0.42]}>
          <boxGeometry args={[1.8, 0.6, 0.06]} />
          <meshStandardMaterial color="#7bbbe0" emissive="#103047" emissiveIntensity={0.2} roughness={0.2} metalness={0.6} transparent opacity={0.5} wireframe={wireframe} />
        </mesh>

        {/* Side attachments */}
        {[-1.15, 1.15].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.6, 8]} />
            <meshStandardMaterial color="#0B3B5A" roughness={0.8} flatShading wireframe={wireframe} />
          </mesh>
        ))}

        {/* Head strap (partial torus) */}
        <mesh position={[0, 0.1, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.08, 10, 48, Math.PI * 1.6]} />
          <meshStandardMaterial color="#0B3B5A" roughness={0.9} flatShading wireframe={wireframe} />
        </mesh>

        {/* Bottom padding */}
        <mesh position={[0, -0.52, 0.05]}>
          <boxGeometry args={[1.6, 0.15, 0.5]} />
          <meshStandardMaterial color="#EAF7FB" roughness={1} flatShading wireframe={wireframe} />
        </mesh>
      </Float>
    </group>
  )
}

