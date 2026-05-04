import { ref } from 'vue'

export function useLyrics({ audioRef, url = '/yesterday.lrc' } = {}) {
  const lyricLine = ref('')
  const nextLyricLine = ref('')
  const lyricReady = ref(false)

  let lrcLines = []
  let lyricRaf = null
  let lyricTimeUpdateHandler = null
  let lyricSeekedHandler = null
  let lyricPlayHandler = null

  function parseLrc(text) {
    const lines = []
    const rows = String(text || '').split(/\r?\n/)
    for (const row of rows) {
      const matches = [...row.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      if (!matches.length) continue
      const content = row.replace(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim()
      if (!content) continue
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
      const audio = audioRef?.value
      if (!audio) return
      updateLyricLines(audio.currentTime || 0)
    })
  }

  async function initLyrics() {
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const text = await res.text()
      lrcLines = parseLrc(text)
      lyricReady.value = lrcLines.length > 0
      scheduleLyricUpdate()
    } catch (_) {}
  }

  function bindAudio() {
    const audio = audioRef?.value
    if (!audio) return
    lyricTimeUpdateHandler = () => scheduleLyricUpdate()
    lyricSeekedHandler = () => scheduleLyricUpdate()
    lyricPlayHandler = () => scheduleLyricUpdate()
    audio.addEventListener('timeupdate', lyricTimeUpdateHandler)
    audio.addEventListener('seeked', lyricSeekedHandler)
    audio.addEventListener('play', lyricPlayHandler)
  }

  function cleanupLyrics() {
    const audio = audioRef?.value
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

  return {
    lyricLine,
    nextLyricLine,
    lyricReady,
    initLyrics,
    bindAudio,
    cleanupLyrics,
  }
}
