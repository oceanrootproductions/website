import React, { Suspense } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import fallbackUrl from '../assets/hero-fallback.svg'
import { isWebGLAvailable } from '../utils/webgl'

const ThreeHero = React.lazy(() => import('../three/ThreeHero'))

export default function ThreeHeroLazy() {
  const mobile = typeof window !== 'undefined' ? useIsMobile() : false
  const webgl = typeof window !== 'undefined' ? isWebGLAvailable() : false

  if (!webgl) {
    return (
      <div className="ocean-gradient flex items-center justify-center" style={{ height: mobile ? '65vh' : '80vh' }}>
        <img src={fallbackUrl} alt="Ocean Root Reef" className="w-full max-w-3xl opacity-90" />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="ocean-gradient skeleton" style={{ height: mobile ? '65vh' : '80vh' }} />
      }
    >
      <ThreeHero />
    </Suspense>
  )
}
