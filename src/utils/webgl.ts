export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      (canvas as any).getContext('webgl2')
    return !!gl
  } catch (e) {
    return false
  }
}

