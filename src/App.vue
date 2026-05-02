<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import postsData from './data/posts'

const posts = postsData
  .slice()
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

const rotations = posts.map(() => Math.random() * 3 - 1.5)
const placeholderSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3C/svg%3E"

const bookRef = ref(null)
const bookContainerRef = ref(null)
const lightboxOpen = ref(false)
const lightboxSrc = ref('')
const lightboxCaption = ref('')
const loadingHidden = ref(false)
const loadingRemoved = ref(false)
const aboutModalOpen = ref(false)
const aboutModalVisible = ref(false)
const backToTopVisible = ref(false)
const musicPlaying = ref(false)
const immersiveActive = ref(false)

const audioRef = ref(null)
const fireworksContainerRef = ref(null)
const easterEggMessageRef = ref(null)

let pageFlip = null
let bubbleInterval = null
let easterEggPlaying = false
let backToTopScrollHandler = null
let firstMusicScrollHandler = null
let keydownHandler = null
let fullscreenChangeHandler = null
let windowResizeHandler = null

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

function closeLightbox() {
  lightboxOpen.value = false
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

function openLightbox(src, caption) {
  lightboxSrc.value = toPublicPath(src)
  lightboxCaption.value = caption || ''
  lightboxOpen.value = true
  ensureMusicPlaying()
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

function updatePageFlipSize() {
  if (!pageFlip || !bookContainerRef.value) return

  const rect = bookContainerRef.value.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const s = pageFlip.getSettings()

  if (immersiveActive.value) {
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    s.width = width
    s.height = height
    s.minWidth = width
    s.maxWidth = width
    s.minHeight = height
    s.maxHeight = height
  } else {
    s.width = 400
    s.height = 600
    s.minWidth = 300
    s.maxWidth = 1000
    s.minHeight = 400
    s.maxHeight = 1200
  }

  pageFlip.update()
}

async function enterImmersive() {
  immersiveActive.value = true
  document.documentElement.classList.add('overflow-hidden')

  const el = bookContainerRef.value
  if (el && document.fullscreenEnabled && !document.fullscreenElement) {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' })
    } catch (_) {}
  }

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
    updatePageFlipSize()
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
    updatePageFlipSize()
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
      maxWidth: 1000,
      minHeight: 400,
      maxHeight: 1200,
      maxShadowOpacity: 0.5,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: true,
      drawShadow: true,
    })

    pageFlip.loadFromHTML(bookEl.querySelectorAll('.page'))

    for (let i = 0; i < Math.min(posts.length, 3); i += 1) {
      const pageEl = bookEl.querySelector(`[data-page-index="${i}"]`)
      if (pageEl) loadImagesOnPage(pageEl)
    }

    pageFlip.on('flip', (e) => {
      const rightPageNum = e.data
      const preloadBuffer = 3
      const leftPageNum = rightPageNum - 1

      if (leftPageNum >= 1) {
        const leftPageEl = bookEl.querySelector(`[data-page-index="${leftPageNum - 1}"]`)
        if (leftPageEl) loadImagesOnPage(leftPageEl)
      }
      if (rightPageNum <= posts.length) {
        const rightPageEl = bookEl.querySelector(`[data-page-index="${rightPageNum - 1}"]`)
        if (rightPageEl) loadImagesOnPage(rightPageEl)
      }

      for (let i = 1; i <= preloadBuffer; i += 1) {
        const pageToPreload = rightPageNum + i
        if (pageToPreload <= posts.length) {
          const preloadPageEl = bookEl.querySelector(`[data-page-index="${pageToPreload - 1}"]`)
          if (preloadPageEl) {
            setTimeout(() => {
              loadImagesOnPage(preloadPageEl)
            }, 50 * i)
          }
        }
      }

      if (rightPageNum === pageFlip.getPageCount() - 1) {
        setTimeout(triggerEasterEgg, 500)
      }
    })

    updatePageFlipSize()
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

  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler)
    window.removeEventListener('orientationchange', windowResizeHandler)
  }
  windowResizeHandler = null
}

onMounted(async () => {
  initLoadingOverlay()
  await nextTick()
  initPageFlip()
  initKeyboardNavigation()
  initMusicAutoPlayOnScroll()
  initBackToTop()

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

  windowResizeHandler = throttle(() => {
    updatePageFlipSize()
  }, 200)
  window.addEventListener('resize', windowResizeHandler)
  window.addEventListener('orientationchange', windowResizeHandler)

  watch(immersiveActive, async () => {
    await nextTick()
    setTimeout(() => {
      updatePageFlipSize()
    }, 100)
  })
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
          ? 'fixed inset-0 flex justify-center items-center w-full max-w-none h-[100svh] z-0 bg-gray-100'
          : 'relative mx-auto my-auto flex justify-center items-center w-full max-w-5xl h-[60vh] sm:h-[650px] z-0 flex-grow'
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
                          :src="placeholderSrc"
                          :alt="post.title"
                          loading="lazy"
                          class="w-full h-full object-contain bg-gray-50 hover:scale-105 transition-transform duration-500 cursor-pointer"
                          width="400"
                          height="400"
                          @mousedown.stop
                          @mouseup.stop
                          @touchstart.stop
                          @touchend.stop
                          @click.stop="openLightbox(img, post.title)"
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
                <p class="text-gray-700 text-base sm:text-lg leading-relaxed text-justify indent-8 font-serif">
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

      <button
        id="prev-btn"
        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0 sm:-translate-x-12 z-20 text-gray-500 hover:text-gray-900 transition-all duration-300 p-3 bg-white/80 rounded-full shadow-md hover:shadow-lg sm:bg-white/40 sm:hover:bg-white/90 backdrop-blur-sm"
        @click="pageFlip && pageFlip.flipPrev()"
      >
        <i class="fas fa-chevron-left text-2xl sm:text-4xl"></i>
      </button>
      <button
        id="next-btn"
        class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-0 sm:translate-x-12 z-20 text-gray-500 hover:text-gray-900 transition-all duration-300 p-3 bg-white/80 rounded-full shadow-md hover:shadow-lg sm:bg-white/40 sm:hover:bg-white/90 backdrop-blur-sm"
        @click="pageFlip && pageFlip.flipNext()"
      >
        <i class="fas fa-chevron-right text-2xl sm:text-4xl"></i>
      </button>
    </div>

    <footer v-if="!immersiveActive" class="text-center mt-auto py-8 border-t border-gray-200 pb-20 sm:pb-8 relative z-10 w-full">
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
    class="fixed bottom-6 left-6 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition sm:hidden z-[80]"
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
    v-show="lightboxOpen"
    id="lightbox"
    class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4 transition-opacity duration-300"
    @click.self="closeLightbox"
  >
    <img
      id="lightbox-img"
      :src="lightboxSrc"
      alt="Enlarged image"
      class="max-w-full max-h-[90vh] rounded-lg shadow-2xl transition-transform duration-300 relative z-[61]"
    />
    <button
      id="lightbox-close"
      class="absolute top-4 right-6 text-white text-4xl font-bold hover:text-gray-300 transition-colors z-[62] cursor-pointer"
      aria-label="Close Lightbox"
      @click.stop="closeLightbox"
    >
      &times;
    </button>
    <div
      id="lightbox-caption"
      class="absolute bottom-6 left-0 right-0 text-center text-white text-lg font-medium bg-black bg-opacity-50 py-2 z-[61]"
    >
      {{ lightboxCaption }}
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

  <audio id="bg-music" ref="audioRef" loop>
    <source src="/yesterday.mp3" type="audio/mpeg" />
  </audio>
  <button
    id="music-toggle"
    class="fixed bottom-6 right-6 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-40"
    @click="toggleMusic"
  >
    <i :class="musicPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
  </button>

  <button
    id="back-to-top"
    class="fixed bottom-6 right-20 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-40"
    :class="backToTopVisible ? 'is-visible' : 'opacity-0 invisible'"
    @click="backToTop"
  >
    <i class="fas fa-arrow-up"></i>
  </button>
</template>
