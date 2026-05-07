import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'

const SignatureCanvas = forwardRef(function SignatureCanvas({ onSignatureChange }, ref) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
  }, [])

  function startDrawing(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')

    setIsDrawing(true)
    ctx.beginPath()
    
    if (e.type === 'touchstart') {
      const touch = e.touches[0]
      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
    } else {
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    }
  }

  function draw(e) {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')

    if (e.type === 'touchmove') {
      e.preventDefault()
      const touch = e.touches[0]
      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top)
    } else {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    }
    
    ctx.stroke()
    setHasSignature(true)
    
    if (onSignatureChange) {
      onSignatureChange(true)
    }
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    
    if (onSignatureChange) {
      onSignatureChange(false)
    }
  }

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getSignatureData: () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      return canvas.toDataURL('image/png')
    },
    hasSignature: () => hasSignature,
    clear: clear
  }), [hasSignature])

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="signature-canvas w-full h-48 bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
      >
        🔄 Effacer
      </button>
    </div>
  )
})

export default SignatureCanvas