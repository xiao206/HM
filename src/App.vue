<script setup>
import mediumZoom from 'medium-zoom'
import 'medium-zoom/dist/style.css'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import postsData from './data/posts'

const posts = postsData
  .slice()
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

const rotations = posts.map(() => Math.random() * 3 - 1.5)
const placeholderSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3C/svg%3E"

const bookRef = ref(null)
const bookContainerRef = ref(null)
const footerRef = ref(null)
const loadingHidden = ref(false)
const loadingRemoved = ref(false)
const aboutModalOpen = ref(false)
const aboutModalVisible = ref(false)
const backToTopVisible = ref(false)
const musicPlaying = ref(false)
const immersiveActive = ref(false)
const fabBottom = ref(24)

const audioRef = ref(null)
const fireworksContainerRef = ref(null)
const easterEggMessageRef = ref(null)
const lyricLine = ref('')
const nextLyricLine = ref('')
const lyricReady = ref(false)

let pageFlip = null
let bubbleInterval = null
let easterEggPlaying = false
let backToTopScrollHandler = null
let firstMusicScrollHandler = null
let keydownHandler = null
let fullscreenChangeHandler = null
let fabPositionHandler = null
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
let zoom = null
let zoomCaptionEl = null
let zoomCloseEl = null
let zoomCaptionPositionHandler = null
let preloadChain = Promise.resolve()
let preloadTimers = []
let lrcLines = []
let lyricRaf = null
let lyricTimeUpdateHandler = null
let lyricSeekedHandler = null
let lyricPlayHandler = null

function toPublicPath(p) {
  if (!p) return ''
  return p.startsWith('/') ? p : `/${p}`
}

function throttle(func, limit) {
  let lastFunc
  let lastRan
  return function () {
    const context = this
    const args = arguments
    if (!lastRan) {
      func.apply(context, args)
      lastRan = Date.now()
    } else {
      clearTimeout(lastFunc)
      lastFunc = setTimeout(
        function () {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args)
            lastRan = Date.now()
          }
        },
        limit - (Date.now() - lastRan),
      )
    }
  }
}

function runWhenIdle(fn, timeout) {
  const ric = window.requestIdleCallback
  if (typeof ric === 'function') return ric(fn, { timeout })
  const handle = window.setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), Math.min(timeout, 200))
  return handle
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

function parseLrc(text) {
  const lines = []
  const rows = String(text || '').split(/\r?\n/)
  for (const row of rows) {
    const matches = [...row.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    if (!matches.length) continue
    const content = row.replace(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim()
    if (!content) continue
    if (
      content.includes('【本音乐作品已获得正版授权】') ||
      /^(曲|原唱|编曲|制作人|弦乐团|吉他|和声|混音\/母带|混音|母带|歌曲营销)\s*[:：]/.test(content)
    )
      continue
    for (const m of matches) {
      const min = Number(m[1] || 0)
      const sec = Number(m[2] || 0)
      const msRaw = (m[3] || '').padEnd(3, '0')
      const ms = Number(msRaw || 0)
      const t = min * 60 + sec + ms / 1000
      lines.push({ t, text: content })
    }
  }
  lines.sort((a, b) => a.t - b.t)
  const deduped = []
  for (const line of lines) {
    const prev = deduped[deduped.length - 1]
    if (prev && Math.abs(prev.t - line.t) < 0.001) continue
    deduped.push(line)
  }
  return deduped
}

function findLyricIndex(time) {
  if (!lrcLines.length) return -1
  let lo = 0
  let hi = lrcLines.length - 1
  if (time < lrcLines[0].t) return -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lrcLines[mid].t <= time) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(-1, lo - 1)
}

function updateLyricLines(time) {
  const idx = findLyricIndex(time)
  lyricLine.value = idx >= 0 ? lrcLines[idx]?.text || '' : ''
  nextLyricLine.value = idx >= 0 ? lrcLines[idx + 1]?.text || '' : lrcLines[0]?.text || ''
}

function scheduleLyricUpdate() {
  if (lyricRaf) return
  lyricRaf = window.requestAnimationFrame(() => {
    lyricRaf = null
    const audio = audioRef.value
    if (!audio) return
    updateLyricLines(audio.currentTime || 0)
  })
}

async function initLyrics() {
  try {
    const res = await fetch(`/yesterday.lrc?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const text = await res.text()
    lrcLines = parseLrc(text)
    lyricReady.value = lrcLines.length > 0
    scheduleLyricUpdate()
  } catch (_) {}
}

function getGridClass(count) {
  if (count === 1) return 'grid-cols-1'
  return 'grid-cols-2'
}

function getImageItemClass(count, index) {
  if (count === 3 && index === 2) return 'col-span-2 w-1/2 mx-auto aspect-square'
  if (count === 1) return 'w-full h-full flex items-center justify-center'
  return 'aspect-square'
}

function getContainerHeightClass(count) {
  if (count === 2) return 'h-48 sm:h-56'
  return 'h-64 sm:h-72'
}

function ensureMusicPlaying() {
  const audio = audioRef.value
  if (!audio || !audio.paused) return
  audio
    .play()
    .then(() => {
      musicPlaying.value = true
    })
    .catch(() => {})
}

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

function triggerEasterEgg() {
  if (easterEggPlaying) return
  easterEggPlaying = true

  const message = easterEggMessageRef.value
  const container = fireworksContainerRef.value
  if (!message || !container) return

  message.classList.remove('opacity-0')
  container.classList.remove('opacity-0')

  const colors = ['#f472b6', '#60a5fa', '#a78bfa', '#facc15', '#a3e635', '#fb7185']

  const createBubble = () => {
    const bubble = document.createElement('div')
    const size = Math.random() * 30 + 15
    bubble.classList.add('absolute', 'rounded-full', 'opacity-80', 'mix-blend-multiply')
    bubble.style.width = `${size}px`
    bubble.style.height = `${size}px`
    bubble.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    bubble.style.left = `${Math.random() * 100}vw`
    bubble.style.bottom = '-60px'
    container.appendChild(bubble)

    const duration = Math.random() * 3000 + 2000
    const sway = Math.random() * 80 - 40

    const animation = bubble.animate(
      [
        { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
        {
          transform: `translate(${sway * 0.2}px, -30vh) scale(1)`,
          opacity: 0.8,
          offset: 0.2,
        },
        { transform: `translate(${sway}px, -90vh) scale(1.2)`, opacity: 0 },
      ],
      { duration, easing: 'ease-out' },
    )

    animation.onfinish = () => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble)
    }
  }

  let count = 0
  bubbleInterval = setInterval(() => {
    createBubble()
    count += 1
    if (count > 30) {
      if (bubbleInterval) {
        clearInterval(bubbleInterval)
        bubbleInterval = null
      }
      setTimeout(() => {
        message.classList.add('opacity-0')
        container.classList.add('opacity-0')
        easterEggPlaying = false
      }, 3000)
    }
  }, 100)
}

function openAboutModal() {
  aboutModalOpen.value = true
  nextTick(() => {
    setTimeout(() => {
      aboutModalVisible.value = true
    }, 10)
  })
}

function closeAboutModal() {
  aboutModalVisible.value = false
  setTimeout(() => {
    aboutModalOpen.value = false
  }, 300)
}

function toggleMusic() {
  const audio = audioRef.value
  if (!audio) return
  if (audio.paused) {
    audio
      .play()
      .then(() => {
        musicPlaying.value = true
      })
      .catch(() => {})
  } else {
    audio.pause()
    musicPlaying.value = false
  }
}

function updateBackToTopVisibility() {
  backToTopVisible.value = window.scrollY > 400
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateFabBottom() {
  if (immersiveActive.value) {
    fabBottom.value = 24
    return
  }

  const footerEl = footerRef.value
  if (!footerEl) {
    fabBottom.value = 24
    return
  }

  const lineEl = footerEl.querySelector('p')
  if (!lineEl) {
    fabBottom.value = 24
    return
  }

  const rect = lineEl.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
    fabBottom.value = 24
    return
  }

  const centerY = (rect.top + rect.bottom) / 2
  const bottom = window.innerHeight - centerY - 24
  fabBottom.value = Math.max(24, Math.round(bottom))
}

async function enterImmersive() {
  immersiveActive.value = true
  document.documentElement.classList.add('overflow-hidden')

  const el = document.documentElement
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' })
    } catch (_) {}
  }

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 100)
}

async function exitImmersive() {
  immersiveActive.value = false
  document.documentElement.classList.remove('overflow-hidden')

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch (_) {}
  }

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 100)
}

function toggleImmersive() {
  if (immersiveActive.value) {
    exitImmersive()
  } else {
    enterImmersive()
  }
}

function initLoadingOverlay() {
  window.addEventListener('load', () => {
    loadingHidden.value = true
    setTimeout(() => {
      loadingRemoved.value = true
    }, 500)
  })

  setTimeout(() => {
    if (!loadingHidden.value) {
      loadingHidden.value = true
      setTimeout(() => {
        loadingRemoved.value = true
      }, 500)
    }
  }, 3000)
}

function initMusicAutoPlayOnScroll() {
  const audio = audioRef.value
  if (!audio) return
  let playedOnce = false
  firstMusicScrollHandler = throttle(() => {
    if (!playedOnce && audio.paused) {
      audio
        .play()
        .then(() => {
          musicPlaying.value = true
          playedOnce = true
          if (firstMusicScrollHandler) window.removeEventListener('scroll', firstMusicScrollHandler)
          firstMusicScrollHandler = null
        })
        .catch(() => {
          if (firstMusicScrollHandler) window.removeEventListener('scroll', firstMusicScrollHandler)
          firstMusicScrollHandler = null
        })
    }
  }, 1000)

  window.addEventListener('scroll', firstMusicScrollHandler)
}

function initBackToTop() {
  backToTopScrollHandler = throttle(updateBackToTopVisibility, 200)
  window.addEventListener('scroll', backToTopScrollHandler)
}

function initFabPosition() {
  fabPositionHandler = throttle(updateFabBottom, 100)
  window.addEventListener('scroll', fabPositionHandler)
  window.addEventListener('resize', fabPositionHandler)
  updateFabBottom()
}

function initTapToFlip() {
  const el = bookContainerRef.value
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
  const bookEl = bookRef.value
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

    for (let i = 0; i < Math.min(posts.length, 3); i += 1) {
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
      if (rightPageNum <= posts.length) {
        const rightPageEl = bookEl.querySelector(`[data-page-index="${rightPageNum - 1}"]`)
        if (rightPageEl) preloadTimers.push(window.setTimeout(() => loadImagesOnPage(rightPageEl), 180))
      }

      for (let i = 1; i <= preloadBuffer; i += 1) {
        const pageToPreload = rightPageNum + i
        if (pageToPreload <= posts.length) {
          const preloadPageEl = bookEl.querySelector(`[data-page-index="${pageToPreload - 1}"]`)
          if (preloadPageEl) {
            enqueuePreload(preloadPageEl)
          }
        }
      }

      if (rightPageNum === pageFlip.getPageCount() - 1) {
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

function cleanup() {
  if (bubbleInterval) clearInterval(bubbleInterval)
  bubbleInterval = null

  if (backToTopScrollHandler) window.removeEventListener('scroll', backToTopScrollHandler)
  backToTopScrollHandler = null

  if (firstMusicScrollHandler) window.removeEventListener('scroll', firstMusicScrollHandler)
  firstMusicScrollHandler = null

  if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
  keydownHandler = null

  if (fullscreenChangeHandler) document.removeEventListener('fullscreenchange', fullscreenChangeHandler)
  fullscreenChangeHandler = null

  if (fabPositionHandler) {
    window.removeEventListener('scroll', fabPositionHandler)
    window.removeEventListener('resize', fabPositionHandler)
  }
  fabPositionHandler = null

  const containerEl = bookContainerRef.value
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

  if (zoom) zoom.detach()
  zoom = null
  if (zoomCaptionEl) zoomCaptionEl.remove()
  zoomCaptionEl = null
  if (zoomCloseEl) zoomCloseEl.remove()
  zoomCloseEl = null
  if (zoomCaptionPositionHandler) window.removeEventListener('resize', zoomCaptionPositionHandler)
  zoomCaptionPositionHandler = null

  if (preloadTimers.length) preloadTimers.forEach((t) => window.clearTimeout(t))
  preloadTimers = []
  preloadChain = Promise.resolve()

  const audio = audioRef.value
  if (audio) {
    if (lyricTimeUpdateHandler) audio.removeEventListener('timeupdate', lyricTimeUpdateHandler)
    if (lyricSeekedHandler) audio.removeEventListener('seeked', lyricSeekedHandler)
    if (lyricPlayHandler) audio.removeEventListener('play', lyricPlayHandler)
  }
  lyricTimeUpdateHandler = null
  lyricSeekedHandler = null
  lyricPlayHandler = null
  if (lyricRaf) window.cancelAnimationFrame(lyricRaf)
  lyricRaf = null
}

onMounted(async () => {
  initLoadingOverlay()
  await nextTick()
  initPageFlip()
  initKeyboardNavigation()
  initMusicAutoPlayOnScroll()
  initBackToTop()
  initFabPosition()
  initTapToFlip()

  await initLyrics()
  const audio = audioRef.value
  if (audio) {
    lyricTimeUpdateHandler = () => scheduleLyricUpdate()
    lyricSeekedHandler = () => scheduleLyricUpdate()
    lyricPlayHandler = () => scheduleLyricUpdate()
    audio.addEventListener('timeupdate', lyricTimeUpdateHandler)
    audio.addEventListener('seeked', lyricSeekedHandler)
    audio.addEventListener('play', lyricPlayHandler)
  }

  zoom = mediumZoom('img[data-zoomable="true"]', { background: 'rgba(0, 0, 0, 0.9)' })
  zoom.on('open', (e) => {
    ensureZoomUi()
    const target = e?.target
    const caption = target?.dataset?.zoomCaption || target?.alt || ''
    if (zoomCaptionEl) {
      zoomCaptionEl.textContent = caption
      zoomCaptionEl.style.display = caption ? '' : 'none'
    }
    if (zoomCloseEl) zoomCloseEl.style.display = ''
    ensureMusicPlaying()
  })
  zoom.on('opened', () => {
    positionZoomCaption()
    if (!zoomCaptionPositionHandler) {
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

  fullscreenChangeHandler = () => {
    if (!document.fullscreenElement && immersiveActive.value) {
      immersiveActive.value = false
      document.documentElement.classList.remove('overflow-hidden')
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 100)
    }
  }
  document.addEventListener('fullscreenchange', fullscreenChangeHandler)
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<template>
  <div
    :class="
      immersiveActive
        ? 'w-full h-[100svh] flex flex-col'
        : 'container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-screen gap-12'
    "
  >
    <div
      id="book-container"
      ref="bookContainerRef"
      :class="
        immersiveActive
          ? 'fixed inset-0 flex justify-center items-center w-full max-w-none h-[100svh] z-[70] bg-gray-100'
          : 'relative mx-auto my-auto flex justify-center items-center w-full max-w-5xl h-[72vh] sm:h-[650px] z-0 flex-grow'
      "
    >
      <div id="book" ref="bookRef" class="shadow-2xl">
        <div class="page page-cover page-cover-top" data-density="hard">
          <div
            class="page-content flex flex-col items-center justify-center text-center bg-[#fdfaf6] h-full border-l-8 border-yellow-800 p-8 shadow-inner"
          >
            <div
              class="border-4 border-double border-yellow-800/30 p-8 rounded-lg w-full h-full flex flex-col items-center justify-center"
            >
              <h1
                class="text-5xl sm:text-6xl font-bold mb-6 text-yellow-900"
                style="font-family: 'Playfair Display', serif; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1)"
              >
                缺牙巴们的<br />那些事
              </h1>
              <p class="text-gray-600 mb-10 font-serif italic text-xl">我们的回忆录</p>
              <div
                class="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-8 border-white shadow-xl mb-10 transform hover:scale-105 transition duration-500"
              >
                <img :src="toPublicPath('images/25/03021.webp')" class="w-full h-full object-cover" />
              </div>
              <div class="mt-auto">
                <p class="text-lg text-gray-500 font-mono tracking-widest border-t border-b border-gray-300 py-2">
                  2024 - 2026
                </p>
              </div>
              <div class="absolute bottom-4 right-4 text-gray-400 animate-bounce flex items-center gap-1 opacity-70">
                <span class="text-xs">Flip</span>
                <i class="fas fa-hand-point-right"></i>
              </div>
            </div>
          </div>
        </div>

        <div v-for="(post, index) in posts" :key="`${post.date}-${index}`" class="page" :data-page-index="index">
          <div class="page-content bg-[#fdfaf6] flex flex-col h-full p-6 sm:p-8 relative overflow-hidden">
            <div
              class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-yellow-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"
            ></div>
            <div class="book-card flex-grow flex flex-col h-full border-2 border-dashed border-stone-300 rounded-xl p-5 sm:p-6 bg-white/50 relative">
              <div
                class="absolute -top-3 -left-3 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-800 font-bold font-serif shadow-sm border border-yellow-200 z-10"
              >
                {{ index + 1 }}
              </div>

              <h3
                class="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center tracking-wide"
                style="
                  font-family: 'Playfair Display', serif;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 0.5rem;
                "
              >
                {{ post.title }}
              </h3>

              <div class="flex justify-center w-full">
                <div v-if="post.images && post.images.length > 0" class="polaroid-gallery mb-6">
                  <div
                    class="polaroid-frame p-3 bg-white shadow-lg mx-auto w-full max-w-sm"
                    :class="getContainerHeightClass(Math.min(post.images.length, 4))"
                    :style="{ transform: `rotate(${rotations[index]}deg)` }"
                  >
                    <div
                      class="grid gap-2 w-full h-full content-center items-center justify-items-center"
                      :class="getGridClass(Math.min(post.images.length, 4))"
                    >
                      <div
                        v-for="(img, i) in post.images.slice(0, 4)"
                        :key="`${img}-${i}`"
                        class="overflow-hidden rounded shadow-sm relative group flex items-center justify-center bg-gray-50"
                        :class="getImageItemClass(Math.min(post.images.length, 4), i)"
                      >
                        <img
                          :data-src="toPublicPath(img)"
                          data-zoomable="true"
                          :data-zoom-src="toPublicPath(img)"
                          :data-zoom-caption="post.title"
                          :src="placeholderSrc"
                          :alt="post.title"
                          decoding="async"
                          loading="lazy"
                          class="w-full h-full object-contain bg-gray-50 hover:scale-105 transition-transform duration-500 cursor-pointer"
                          width="400"
                          height="400"
                          @mousedown.stop
                          @mouseup.stop
                          @touchstart.stop
                          @touchend.stop
                          @click.stop="onZoomClick"
                          @error="(e) => (e.target.src = placeholderSrc)"
                        />
                      </div>
                    </div>
                    <div class="polaroid-date font-handwriting text-gray-500 text-sm mt-2 text-center">
                      {{ post.date }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex-grow overflow-y-auto my-4 scrollbar-thin scrollbar-thumb-stone-300 pr-2">
                <p class="book-body text-gray-700 text-base sm:text-lg leading-relaxed text-justify font-serif">
                  {{ post.content }}
                </p>
              </div>

              <div class="mt-auto pt-4 border-t border-stone-200">
                <div class="flex justify-center flex-wrap gap-2 mb-2">
                  <span
                    v-for="tag in post.tags"
                    :key="`${index}-${tag}`"
                    class="text-xs font-medium bg-stone-200 text-stone-700 px-3 py-1 rounded-full border border-stone-300 shadow-sm"
                    >{{ tag }}</span
                  >
                </div>
                <div class="text-center text-xs text-gray-400 font-mono tracking-widest uppercase">Memory Fragment</div>
              </div>
            </div>
          </div>
        </div>

        <div class="page page-cover page-cover-bottom" data-density="hard">
          <div
            class="page-content flex flex-col items-center justify-center text-center bg-[#fdfaf6] h-full border-r-8 border-yellow-800 p-8 shadow-inner"
          >
            <div
              class="border-4 border-double border-yellow-800/30 p-8 rounded-lg w-full h-full flex flex-col items-center justify-center"
            >
              <h2 class="text-4xl font-bold mb-6 text-yellow-900" style="font-family: 'Playfair Display', serif">
                The End
              </h2>
              <p class="text-gray-500 mb-12 text-xl italic font-serif">To be continued...</p>
              <div class="w-24 h-1 bg-yellow-800/20 mb-12"></div>
              <div class="text-sm text-gray-400 font-mono">
                <p>&copy; 2024 缺牙巴们的那些事</p>
                <p class="mt-2 text-xs">Designed with ❤️</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <footer v-if="!immersiveActive" ref="footerRef" class="text-center mt-auto py-8 border-t border-gray-200 pb-20 sm:pb-8 relative z-10 w-full">
      <p class="text-gray-500 mb-2 text-xs sm:text-sm">&copy; 2024 缺牙巴们的那些事. All Rights Reserved.</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-2 mb-2">
        <p class="text-gray-500 text-xs sm:text-sm">
          <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-gray-900 transition">湘ICP备2025132035号-2</a>
        </p>
        <p class="text-gray-500 text-xs sm:text-sm">
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=43018102000677"
            rel="noreferrer"
            target="_blank"
            class="hover:text-gray-900 transition flex items-center gap-1"
          >
            <img :src="toPublicPath('images/备案图标.png')" alt="备案图标" class="w-4 h-4" />
            湘公网安备43018102000677号
          </a>
        </p>
      </div>
      <a href="#" id="about-us-link" class="text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition" @click.prevent="openAboutModal"
        >关于我们</a
      >
    </footer>
  </div>

  <button
    id="immersive-toggle"
    class="fixed left-6 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition sm:hidden z-[80]"
    :style="{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom))` }"
    :aria-label="immersiveActive ? '退出沉浸模式' : '沉浸模式'"
    @click="toggleImmersive"
  >
    <i :class="immersiveActive ? 'fas fa-compress' : 'fas fa-book-open'"></i>
  </button>

  <div
    v-show="aboutModalOpen"
    id="about-us-modal"
    class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
    :class="{ 'is-visible': aboutModalVisible }"
    @click.self="closeAboutModal"
  >
    <div
      class="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 sm:p-8 relative transform transition-all duration-300 ease-in-out scale-95 opacity-0 max-h-[90vh] overflow-y-auto"
    >
      <button
        id="about-us-close"
        class="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold p-2"
        @click="closeAboutModal"
      >
        &times;
      </button>
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-4" style="font-family: 'Playfair Display', serif">
        关于「缺牙齿的缺牙巴们」
      </h2>
      <div class="text-center mb-6">
        <img
          :src="toPublicPath('images/25/03021.webp')"
          alt="Group Photo"
          class="w-32 h-32 sm:w-48 sm:h-48 object-cover rounded-full mx-auto shadow-lg border-4 border-white"
        />
      </div>
      <p class="text-gray-700 leading-relaxed text-center text-sm sm:text-base">
        这里是记录我们这群“缺牙巴”们共同经历的数字角落。
        <br /><br />
        天下无有不散筵席，就合上一千年，少不得有个分开日子。
        <br /><br />
        愿世间有颗无忧树，愿你我永远是同路。
      </p>
    </div>
  </div>

  <div
    v-if="!loadingRemoved"
    id="loading-overlay"
    class="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center transition-opacity duration-500"
    :class="{ hidden: loadingHidden }"
  >
    <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-900 mb-4"></div>
    <p class="text-gray-600 font-medium animate-pulse">正在加载美好回忆...</p>
  </div>

  <div
    id="fireworks-container"
    ref="fireworksContainerRef"
    class="fixed inset-0 pointer-events-none z-40 overflow-hidden bg-gradient-to-t from-white/90 via-white/50 to-transparent opacity-0 transition-opacity duration-1000"
  ></div>
  <div
    id="easter-egg-message"
    ref="easterEggMessageRef"
    class="fixed bottom-32 sm:bottom-32 left-0 right-0 text-center text-3xl sm:text-5xl font-normal text-gray-800 opacity-0 transition-opacity duration-1000 z-50 pointer-events-none drop-shadow-lg px-4"
    style="
      font-family: 'Playfair Display', serif;
      letter-spacing: 0.1em;
      text-shadow: 0 4px 6px rgba(255, 255, 255, 0.8);
    "
  >
    To be continued...<br />
    <span class="text-lg sm:text-2xl mt-4 block font-sans text-gray-600 font-medium tracking-widest"
      >我们的故事，未完待续</span
    >
  </div>

  <div
    v-if="immersiveActive && lyricReady && musicPlaying"
    class="fixed left-0 right-0 z-[85] pointer-events-none px-4"
    :style="{ bottom: `calc(${fabBottom}px + 4.5rem + env(safe-area-inset-bottom))` }"
  >
    <div class="mx-auto max-w-[92vw] text-center">
      <div class="inline-block max-w-full bg-black/45 backdrop-blur-md rounded-2xl px-4 py-3">
        <div class="text-white text-lg sm:text-xl font-semibold drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] truncate">
          {{ lyricLine }}
        </div>
        <div class="text-white/70 text-sm sm:text-base mt-2 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] truncate">
          {{ nextLyricLine }}
        </div>
      </div>
    </div>
  </div>

  <audio id="bg-music" ref="audioRef" loop>
    <source src="/yesterday.mp3" type="audio/mpeg" />
  </audio>
  <button
    id="music-toggle"
    class="fixed right-6 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-40"
    :style="{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom))` }"
    @click="toggleMusic"
  >
    <i :class="musicPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
  </button>

  <button
    id="back-to-top"
    class="fixed right-20 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-40"
    :style="{ bottom: `calc(${fabBottom}px + env(safe-area-inset-bottom))` }"
    :class="backToTopVisible ? 'is-visible' : 'opacity-0 invisible'"
    @click="backToTop"
  >
    <i class="fas fa-arrow-up"></i>
  </button>
</template>
