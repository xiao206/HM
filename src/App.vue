<script setup>
import 'medium-zoom/dist/style.css'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import postsData from './data/posts'
import { useLyrics } from './composables/useLyrics'
import { usePageFlip } from './composables/usePageFlip'
import { useZoom } from './composables/useZoom'

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
const endReelVisible = ref(false)
const endReelShowEnd = ref(false)
const endReelFading = ref(false)
let easterEggPlaying = false
let backToTopScrollHandler = null
let firstMusicScrollHandler = null
let fullscreenChangeHandler = null
let fabPositionHandler = null

let endReelTimers = []

const { lyricLine, nextLyricLine, lyricReady, initLyrics, bindAudio: bindLyricsAudio, cleanupLyrics } = useLyrics({
  audioRef,
})

const { initPageFlip, initTapToFlip, initKeyboardNavigation, cleanupPageFlip } = usePageFlip({
  bookRef,
  bookContainerRef,
  posts,
  triggerEasterEgg,
})

const { initZoom, onZoomClick, cleanupZoom } = useZoom({
  selector: 'img[data-zoomable="true"]',
  throttle,
  ensureMusicPlaying,
})

const reelImages = posts
  .map((p) => p?.images?.[0])
  .filter(Boolean)
  .map(toPublicPath)

function buildReelRow(offset, count = 10) {
  if (!reelImages.length) return []
  const row = []
  for (let i = 0; i < count; i += 1) {
    row.push(reelImages[(offset + i) % reelImages.length])
  }
  return row.concat(row)
}

const reelRow1 = buildReelRow(0)
const reelRow2 = buildReelRow(3)
const reelRow3 = buildReelRow(6)

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

function triggerEasterEgg() {
  if (easterEggPlaying) return
  easterEggPlaying = true

  endReelVisible.value = true
  endReelShowEnd.value = false
  endReelFading.value = false

  if (endReelTimers.length) endReelTimers.forEach((t) => window.clearTimeout(t))
  endReelTimers = []

  endReelTimers.push(
    window.setTimeout(() => {
      endReelShowEnd.value = true
    }, 8000),
  )
  endReelTimers.push(
    window.setTimeout(() => {
      endReelFading.value = true
    }, 14000),
  )
  endReelTimers.push(
    window.setTimeout(() => {
      endReelVisible.value = false
      endReelShowEnd.value = false
      endReelFading.value = false
      easterEggPlaying = false
    }, 18000),
  )
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

function cleanup() {
  if (endReelTimers.length) endReelTimers.forEach((t) => window.clearTimeout(t))
  endReelTimers = []

  if (backToTopScrollHandler) window.removeEventListener('scroll', backToTopScrollHandler)
  backToTopScrollHandler = null

  if (firstMusicScrollHandler) window.removeEventListener('scroll', firstMusicScrollHandler)
  firstMusicScrollHandler = null

  if (fullscreenChangeHandler) document.removeEventListener('fullscreenchange', fullscreenChangeHandler)
  fullscreenChangeHandler = null

  if (fabPositionHandler) {
    window.removeEventListener('scroll', fabPositionHandler)
    window.removeEventListener('resize', fabPositionHandler)
  }
  fabPositionHandler = null

  cleanupPageFlip()
  cleanupZoom()
  cleanupLyrics()
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
  bindLyricsAudio()
  initZoom()

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

  <div v-if="endReelVisible" class="hm-end-reel" :class="endReelFading ? 'is-fading' : ''">
    <div class="hm-noise"></div>
    <h1 class="hm-title">MEMORY ARCHIVE</h1>
    <p class="hm-subtitle">Nothing lasts. But this did.</p>

    <div class="hm-film-container">
      <div class="hm-film-track hm-row1">
        <div v-for="(src, i) in reelRow1" :key="`r1-${i}-${src}`" class="hm-img-box">
          <img :src="src" alt="" />
        </div>
      </div>
    </div>

    <div class="hm-film-container">
      <div class="hm-film-track hm-row2">
        <div v-for="(src, i) in reelRow2" :key="`r2-${i}-${src}`" class="hm-img-box">
          <img :src="src" alt="" />
        </div>
      </div>
    </div>

    <div class="hm-film-container">
      <div class="hm-film-track hm-row3">
        <div v-for="(src, i) in reelRow3" :key="`r3-${i}-${src}`" class="hm-img-box">
          <img :src="src" alt="" />
        </div>
      </div>
    </div>

    <div class="hm-end-screen" :class="endReelShowEnd ? 'is-visible' : ''">
      <h2>THE END</h2>
    </div>
  </div>

  <div
    v-if="immersiveActive && lyricReady"
    class="fixed left-0 right-0 z-[85] pointer-events-none px-4"
    :style="{ bottom: `calc(${fabBottom}px + 4.5rem + env(safe-area-inset-bottom))` }"
  >
    <div class="mx-auto max-w-[92vw] text-center">
      <div class="text-white text-lg sm:text-xl font-semibold drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] truncate">
        {{ lyricLine }}
      </div>
      <div class="text-white/60 text-sm sm:text-base mt-2 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] truncate">
        {{ nextLyricLine }}
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

<style>
.hm-end-reel {
  position: fixed;
  inset: 0;
  background: #0b0b0b;
  color: #f5f1e6;
  overflow: hidden;
  z-index: 120;
  pointer-events: none;
  opacity: 1;
}

.hm-end-reel.is-fading {
  opacity: 0;
  transition: opacity 4s ease;
}

.hm-noise {
  position: fixed;
  inset: 0;
  opacity: 0.1;
  pointer-events: none;
  z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
}

.hm-title {
  position: relative;
  z-index: 2;
  margin: 28px 0 8px;
  text-align: center;
  letter-spacing: 0.28em;
  font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 20px;
}

.hm-subtitle {
  position: relative;
  z-index: 2;
  text-align: center;
  color: #c2b8a3;
  font-style: italic;
  margin-bottom: 18px;
  font-size: 14px;
}

.hm-film-container {
  position: relative;
  z-index: 2;
  overflow: hidden;
  width: 100%;
  padding: 12px 0;
}

.hm-film-track {
  display: flex;
  gap: 18px;
  width: max-content;
  animation: hmScroll 80s linear infinite;
  filter: sepia(0.65) contrast(1.1) brightness(0.85);
}

.hm-row2 {
  animation-direction: reverse;
  animation-duration: 100s;
}

.hm-row3 {
  animation-duration: 120s;
}

@keyframes hmScroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

.hm-img-box img {
  width: clamp(140px, 22vw, 220px);
  height: clamp(96px, 15vw, 150px);
  object-fit: cover;
  border: 6px solid #000;
}

.hm-end-screen {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 3;
  opacity: 0;
  transition: opacity 1400ms ease;
}

.hm-end-screen.is-visible {
  opacity: 1;
}

.hm-end-screen h2 {
  font-size: clamp(34px, 6vw, 44px);
  letter-spacing: 0.28em;
  font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
