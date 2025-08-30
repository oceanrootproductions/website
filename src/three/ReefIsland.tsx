import { useMemo } from 'react'
import * as THREE from 'three'
import { Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

type Props = {
  color?: string
  rootColor?: string
  wireframe?: boolean
  autoRotate?: boolean
}

export default function ReefIsland({ color = '#2b6c8f', rootColor = '#8bd3e6', wireframe = false, autoRotate = true }: Props) {
  const group = useMemo(() => new THREE.Group(), [])

  useFrame((_, delta) => {
    if (autoRotate) {
      group.rotation.y += delta * 0.2
    }
  })

  const roots = useMemo(() => makeRoots(), [])

  return (
    <group ref={(g) => g && g.add(group)}>
      <Float rotationIntensity={0.2} floatIntensity={0.3} speed={1}>
        <mesh position={[0, 0, 0]}>
          {/* Torus that forms an "O" shaped reef */}
          <torusGeometry args={[1.25, 0.45, 14, 28]} />
          <meshStandardMaterial color={color} flatShading wireframe={wireframe} />
        </mesh>

        {/* A few low-poly rock bits */}
        {[-0.7, 0.3, 1.0].map((x, i) => (
          <mesh key={i} position={[x, -0.3 + i * 0.05, (i - 1) * 0.2]} rotation={[0.2 * i, 0.3 * i, 0.1 * i]}>
            <dodecahedronGeometry args={[0.18 + i * 0.06, 0]} />
            <meshStandardMaterial color={color} flatShading wireframe={wireframe} />
          </mesh>
        ))}

        {/* Stylized roots dropping from the ring */}
        {roots.map((curve, i) => (
          <mesh key={i}>
            <tubeGeometry args={[curve, 12, 0.03 + (i % 3) * 0.01, 6, false]} />
            <meshStandardMaterial color={rootColor} flatShading wireframe={wireframe} />
          </mesh>
        ))}
      </Float>
    </group>
  )
}

function makeRoots() {
  const list: THREE.Curve<THREE.Vector3>[] = []
  const ringR = 1.25
  const spread = 0.8
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.3 + (Math.random() - 0.5) * 0.2
    const x = Math.cos(a) * ringR
    const z = Math.sin(a) * ringR
    const start = new THREE.Vector3(x, -0.2, z)
    const ctrl = new THREE.Vector3(x * 0.7, -1.0 - Math.random() * 0.4, z * 0.7 + (Math.random() - 0.5) * spread)
    const end = new THREE.Vector3(x * 0.4, -1.6 - Math.random() * 0.5, z * 0.4)
    list.push(new THREE.QuadraticBezierCurve3(start, ctrl, end))
  }
  return list
}

