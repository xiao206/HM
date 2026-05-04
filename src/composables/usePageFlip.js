export function usePageFlip({ bookRef, bookContainerRef, posts, triggerEasterEgg } = {}) {
  let pageFlip = null
  let keydownHandler = null

  let tapToFlipDownHandler = null
  let tapToFlipMoveHandler = null
  let tapToFlipUpHandler = null
  let tapToFlipCancelHandler = null
  let tapToFlipTouchStartHandler = null
  let tapToFlipTouchMoveHandler = null
  let tapToFlipTouchEndHandler = null
  let tapToFlipTouchCancelHandler = null
  let tapToFlipStart = null
  let tapToFlipInput = null

  let preloadChain = Promise.resolve()
  let preloadTimers = []

  function runWhenIdle(fn, timeout) {
    const ric = window.requestIdleCallback
    if (typeof ric === 'function') return ric(fn, { timeout })
    const handle = window.setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), Math.min(timeout, 200))
    return handle
  }

  function loadImagesOnPage(pageElement) {
    if (!pageElement || pageElement.dataset.imagesLoaded === 'true') return
    const images = pageElement.querySelectorAll('img[data-src]')
    images.forEach((img) => {
      if (img.dataset.src) {
        const imgObj = new Image()
        imgObj.onload = () => {
          img.src = img.dataset.src
          img.style.opacity = '0'
          img.style.transition = 'opacity 0.3s ease-in-out'
          setTimeout(() => {
            img.style.opacity = '1'
          }, 10)
        }
        imgObj.src = img.dataset.src
      }
    })
    pageElement.dataset.imagesLoaded = 'true'
  }

  function enqueuePreload(pageEl) {
    if (!pageEl) return
    preloadChain = preloadChain.then(
      () =>
        new Promise((resolve) => {
          runWhenIdle(() => {
            loadImagesOnPage(pageEl)
            resolve()
          }, 1500)
        }),
    )
  }

  function initTapToFlip() {
    const el = bookContainerRef?.value
    if (!el) return
    const isTouchDevice = () => (navigator && navigator.maxTouchPoints > 0) || 'ontouchstart' in window

    tapToFlipDownHandler = (e) => {
      if (!isTouchDevice()) return
      if (e.pointerType === 'mouse') return
      if (e.button != null && e.button !== 0) return

      tapToFlipInput = 'pointer'
      tapToFlipStart = {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
        target: e.target,
        pointerId: e.pointerId,
        moved: false,
      }
    }

    tapToFlipMoveHandler = (e) => {
      const start = tapToFlipStart
      if (!start) return
      if (start.pointerId != null && e.pointerId != null && start.pointerId !== e.pointerId) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy > 144) start.moved = true
    }

    tapToFlipUpHandler = (e) => {
      const start = tapToFlipStart
      tapToFlipStart = null
      if (!start) return
      if (!pageFlip) return

      if (!isTouchDevice()) return
      if (e.pointerType === 'mouse') return
      if (Date.now() - start.t > 600) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy > 144) return
      if (start.moved) return

      const target = start.target
      if (
        target &&
        target.closest &&
        target.closest('a,button,input,textarea,select,label,img,video,#lightbox,#about-us-modal,.polaroid-frame')
      )
        return

      e.preventDefault()
      e.stopImmediatePropagation()

      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      if (x > rect.width / 2) pageFlip.flipNext()
      else pageFlip.flipPrev()
    }

    tapToFlipCancelHandler = () => {
      tapToFlipStart = null
      tapToFlipInput = null
    }

    tapToFlipTouchStartHandler = (e) => {
      if (!isTouchDevice()) return
      if (tapToFlipInput === 'pointer') return
      if (!e.changedTouches || e.changedTouches.length !== 1) return
      const t = e.changedTouches[0]
      tapToFlipInput = 'touch'
      tapToFlipStart = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        target: e.target,
        moved: false,
      }
    }

    tapToFlipTouchMoveHandler = (e) => {
      const start = tapToFlipStart
      if (!start) return
      if (tapToFlipInput !== 'touch') return
      if (!e.changedTouches || e.changedTouches.length !== 1) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (dx * dx + dy * dy > 144) start.moved = true
    }

    tapToFlipTouchEndHandler = (e) => {
      const start = tapToFlipStart
      tapToFlipStart = null
      tapToFlipInput = null
      if (!start) return
      if (!pageFlip) return
      if (!isTouchDevice()) return
      if (!e.changedTouches || e.changedTouches.length !== 1) return
      if (Date.now() - start.t > 600) return
      if (start.moved) return

      const target = start.target
      if (
        target &&
        target.closest &&
        target.closest('a,button,input,textarea,select,label,img,video,#lightbox,#about-us-modal,.polaroid-frame')
      )
        return

      e.preventDefault()
      e.stopImmediatePropagation()

      const t = e.changedTouches[0]
      const rect = el.getBoundingClientRect()
      const x = t.clientX - rect.left
      if (x > rect.width / 2) pageFlip.flipNext()
      else pageFlip.flipPrev()
    }

    tapToFlipTouchCancelHandler = () => {
      tapToFlipStart = null
      tapToFlipInput = null
    }

    el.addEventListener('pointerdown', tapToFlipDownHandler, { capture: true, passive: true })
    el.addEventListener('pointermove', tapToFlipMoveHandler, { capture: true, passive: true })
    el.addEventListener('pointerup', tapToFlipUpHandler, { capture: true, passive: false })
    el.addEventListener('pointercancel', tapToFlipCancelHandler, { capture: true, passive: true })

    el.addEventListener('touchstart', tapToFlipTouchStartHandler, { capture: true, passive: true })
    el.addEventListener('touchmove', tapToFlipTouchMoveHandler, { capture: true, passive: true })
    el.addEventListener('touchend', tapToFlipTouchEndHandler, { capture: true, passive: false })
    el.addEventListener('touchcancel', tapToFlipTouchCancelHandler, { capture: true, passive: true })
  }

  function initPageFlip() {
    const bookEl = bookRef?.value
    if (!bookEl) return
    const St = window.St
    if (!St || !St.PageFlip) return

    setTimeout(() => {
      pageFlip = new St.PageFlip(bookEl, {
        width: 400,
        height: 600,
        size: 'stretch',
        minWidth: 300,
        maxWidth: 900,
        minHeight: 400,
        maxHeight: 1100,
        maxShadowOpacity: 0.25,
        showCover: true,
        mobileScrollSupport: false,
        usePortrait: true,
        drawShadow: false,
      })

      pageFlip.loadFromHTML(bookEl.querySelectorAll('.page'))

      const count = Array.isArray(posts) ? posts.length : 0
      for (let i = 0; i < Math.min(count, 3); i += 1) {
        const pageEl = bookEl.querySelector(`[data-page-index="${i}"]`)
        if (pageEl) loadImagesOnPage(pageEl)
      }

      pageFlip.on('flip', (e) => {
        const rightPageNum = e.data
        const preloadBuffer = 2
        const leftPageNum = rightPageNum - 1

        if (leftPageNum >= 1) {
          const leftPageEl = bookEl.querySelector(`[data-page-index="${leftPageNum - 1}"]`)
          if (leftPageEl) preloadTimers.push(window.setTimeout(() => loadImagesOnPage(leftPageEl), 180))
        }
        if (rightPageNum <= count) {
          const rightPageEl = bookEl.querySelector(`[data-page-index="${rightPageNum - 1}"]`)
          if (rightPageEl) preloadTimers.push(window.setTimeout(() => loadImagesOnPage(rightPageEl), 180))
        }

        for (let i = 1; i <= preloadBuffer; i += 1) {
          const pageToPreload = rightPageNum + i
          if (pageToPreload <= count) {
            const preloadPageEl = bookEl.querySelector(`[data-page-index="${pageToPreload - 1}"]`)
            if (preloadPageEl) {
              enqueuePreload(preloadPageEl)
            }
          }
        }

        if (typeof triggerEasterEgg === 'function' && rightPageNum === pageFlip.getPageCount() - 1) {
          setTimeout(triggerEasterEgg, 500)
        }
      })
    }, 100)
  }

  function initKeyboardNavigation() {
    keydownHandler = (e) => {
      if (!pageFlip) return
      if (e.key === 'ArrowRight') pageFlip.flipNext()
      if (e.key === 'ArrowLeft') pageFlip.flipPrev()
    }
    document.addEventListener('keydown', keydownHandler)
  }

  function cleanupPageFlip() {
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
    keydownHandler = null

    const containerEl = bookContainerRef?.value
    if (containerEl) {
      if (tapToFlipDownHandler) containerEl.removeEventListener('pointerdown', tapToFlipDownHandler)
      if (tapToFlipMoveHandler) containerEl.removeEventListener('pointermove', tapToFlipMoveHandler)
      if (tapToFlipUpHandler) containerEl.removeEventListener('pointerup', tapToFlipUpHandler)
      if (tapToFlipCancelHandler) containerEl.removeEventListener('pointercancel', tapToFlipCancelHandler)
      if (tapToFlipTouchStartHandler) containerEl.removeEventListener('touchstart', tapToFlipTouchStartHandler)
      if (tapToFlipTouchMoveHandler) containerEl.removeEventListener('touchmove', tapToFlipTouchMoveHandler)
      if (tapToFlipTouchEndHandler) containerEl.removeEventListener('touchend', tapToFlipTouchEndHandler)
      if (tapToFlipTouchCancelHandler) containerEl.removeEventListener('touchcancel', tapToFlipTouchCancelHandler)
    }
    tapToFlipDownHandler = null
    tapToFlipMoveHandler = null
    tapToFlipUpHandler = null
    tapToFlipCancelHandler = null
    tapToFlipTouchStartHandler = null
    tapToFlipTouchMoveHandler = null
    tapToFlipTouchEndHandler = null
    tapToFlipTouchCancelHandler = null
    tapToFlipStart = null
    tapToFlipInput = null

    if (preloadTimers.length) preloadTimers.forEach((t) => window.clearTimeout(t))
    preloadTimers = []
    preloadChain = Promise.resolve()
    pageFlip = null
  }

  return {
    initPageFlip,
    initTapToFlip,
    initKeyboardNavigation,
    cleanupPageFlip,
  }
}
