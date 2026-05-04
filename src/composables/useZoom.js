import mediumZoom from 'medium-zoom'

export function useZoom({ selector, throttle, ensureMusicPlaying } = {}) {
  let zoom = null
  let zoomCaptionEl = null
  let zoomCloseEl = null
  let zoomCaptionPositionHandler = null

  function ensureZoomUi() {
    if (!zoomCaptionEl) {
      zoomCaptionEl = document.createElement('div')
      zoomCaptionEl.className =
        'fixed px-4 py-2 text-center text-white text-base sm:text-lg font-medium bg-black/60 rounded-full z-[9999] pointer-events-none'
      zoomCaptionEl.style.display = 'none'
      document.body.appendChild(zoomCaptionEl)
    }
    if (!zoomCloseEl) {
      zoomCloseEl = document.createElement('button')
      zoomCloseEl.type = 'button'
      zoomCloseEl.setAttribute('aria-label', 'Close')
      zoomCloseEl.className =
        'fixed top-4 right-4 w-10 h-10 flex items-center justify-center bg-black/60 text-white text-3xl font-bold rounded-full hover:bg-black/80 transition-colors z-[10000]'
      zoomCloseEl.style.display = 'none'
      zoomCloseEl.innerHTML = '&times;'
      zoomCloseEl.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (zoom) zoom.close()
      })
      document.body.appendChild(zoomCloseEl)
    }
  }

  function positionZoomCaption() {
    if (!zoomCaptionEl || zoomCaptionEl.style.display === 'none') return
    const zoomedImg =
      document.querySelector('.medium-zoom-image--opened') || document.querySelector('.medium-zoom-image--open')
    if (!zoomedImg) return

    const rect = zoomedImg.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2

    zoomCaptionEl.style.left = `${centerX}px`
    zoomCaptionEl.style.transform = 'translateX(-50%)'
    zoomCaptionEl.style.maxWidth = `${Math.max(0, rect.width - 16)}px`
    zoomCaptionEl.style.whiteSpace = 'nowrap'
    zoomCaptionEl.style.overflow = 'hidden'
    zoomCaptionEl.style.textOverflow = 'ellipsis'

    requestAnimationFrame(() => {
      const captionRect = zoomCaptionEl.getBoundingClientRect()
      const top = Math.max(8 + (window.visualViewport?.offsetTop || 0), rect.top - captionRect.height - 12)
      zoomCaptionEl.style.top = `${top}px`
    })
  }

  function onZoomClick(e) {
    if (!zoom) return
    const target = e?.currentTarget
    if (!target) return
    zoom.attach(target)
    zoom.open({ target })
  }

  function initZoom() {
    if (!selector) return
    zoom = mediumZoom(selector, { background: 'rgba(0, 0, 0, 0.9)' })
    zoom.on('open', (e) => {
      ensureZoomUi()
      const target = e?.target
      const caption = target?.dataset?.zoomCaption || target?.alt || ''
      if (zoomCaptionEl) {
        zoomCaptionEl.textContent = caption
        zoomCaptionEl.style.display = caption ? '' : 'none'
      }
      if (zoomCloseEl) zoomCloseEl.style.display = ''
      if (ensureMusicPlaying) ensureMusicPlaying()
    })
    zoom.on('opened', () => {
      positionZoomCaption()
      if (!zoomCaptionPositionHandler && throttle) {
        zoomCaptionPositionHandler = throttle(positionZoomCaption, 50)
        window.addEventListener('resize', zoomCaptionPositionHandler)
      }
    })
    zoom.on('close', () => {
      if (zoomCaptionEl) zoomCaptionEl.style.display = 'none'
      if (zoomCloseEl) zoomCloseEl.style.display = 'none'
      if (zoomCaptionPositionHandler) window.removeEventListener('resize', zoomCaptionPositionHandler)
      zoomCaptionPositionHandler = null
    })
  }

  function cleanupZoom() {
    if (zoom) zoom.detach()
    zoom = null
    if (zoomCaptionEl) zoomCaptionEl.remove()
    zoomCaptionEl = null
    if (zoomCloseEl) zoomCloseEl.remove()
    zoomCloseEl = null
    if (zoomCaptionPositionHandler) window.removeEventListener('resize', zoomCaptionPositionHandler)
    zoomCaptionPositionHandler = null
  }

  return { initZoom, onZoomClick, cleanupZoom }
}
