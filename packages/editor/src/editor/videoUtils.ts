/**
 * videoUtils.ts — Парсеры ссылок и генераторы embed URL для видео-платформ
 *
 * Поддерживаемые платформы:
 * - YouTube (видео, shorts, live, таймкоды)
 * - VK Video & VK Clips (vk.com, vkvideo.ru)
 * - Rutube (видео, shorts, таймкоды)
 * - Twitch (клипы, VOD/видео)
 * - Vimeo (видео, каналы, группы)
 * - Dzen / Дзен (видео)
 */

export interface VideoEmbedInfo {
  type: 'youtube' | 'vk' | 'rutube' | 'twitch' | 'vimeo' | 'dzen'
  videoId: string
  embedUrl: string
}

/** Получить hostname для параметра parent (нужно для Twitch) */
function getHostname(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname
  }
  return 'localhost'
}

/** Парсер YouTube */
export function parseYouTubeUrl(url: string): { videoId: string; start?: string } | null {
  if (!url) return null
  const regExp =
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  const match = url.match(regExp)
  if (!match) return null

  const videoId = match[1]
  let start = ''
  const tMatch = url.match(/[?&](?:t|start)=([0-9hms]+)/i)
  if (tMatch) {
    start = tMatch[1]
    if (start.includes('h') || start.includes('m') || start.includes('s')) {
      let seconds = 0
      const h = start.match(/(\d+)h/i)
      const m = start.match(/(\d+)m/i)
      const s = start.match(/(\d+)s/i)
      if (h) seconds += parseInt(h[1], 10) * 3600
      if (m) seconds += parseInt(m[1], 10) * 60
      if (s) seconds += parseInt(s[1], 10)
      start = seconds.toString()
    }
  }

  return { videoId, start }
}

/** Парсер VK Video и VK Клипов */
export function parseVkVideoUrl(url: string): { oid: string; id: string; hash?: string } | null {
  if (!url) return null

  // Прямой embed URL: vk.com/video_ext.php?oid=...&id=...
  if (url.includes('video_ext.php')) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
      const oid = parsed.searchParams.get('oid')
      const id = parsed.searchParams.get('id')
      const hash = parsed.searchParams.get('hash') || undefined
      if (oid && id) return { oid, id, hash }
    } catch {
      // ignore
    }
  }

  // Ссылки вида: vk.com/video-12345_67890, vkvideo.ru/video-12345_67890, vk.com/clip-12345_67890
  const match = url.match(/(?:vk(?:video)?\.(?:com|ru))\/(?:video|clip)(-?\d+)_(\d+)/i)
  if (!match) {
    // Проверяем параметр z: vk.com/video?z=video-12345_67890
    const zMatch = url.match(/[?&]z=video(-?\d+)_(\d+)/i)
    if (zMatch) {
      const oid = zMatch[1]
      const id = zMatch[2]
      let hash: string | undefined
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
        hash = parsed.searchParams.get('hash') || parsed.searchParams.get('access_key') || undefined
      } catch {
        // ignore
      }
      return { oid, id, hash }
    }
    return null
  }

  const oid = match[1]
  const id = match[2]
  let hash: string | undefined

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    hash = parsed.searchParams.get('hash') || parsed.searchParams.get('access_key') || undefined
  } catch {
    // ignore
  }

  return { oid, id, hash }
}

/** Парсер Rutube */
export function parseRutubeUrl(url: string): { videoId: string; time?: string } | null {
  if (!url) return null
  const match = url.match(/rutube\.ru\/(?:video|play\/embed|shorts)\/([a-zA-Z0-9]{32})/i)
  if (!match) return null

  const videoId = match[1]
  let time: string | undefined

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const tParam = parsed.searchParams.get('t') || parsed.searchParams.get('start')
    if (tParam) time = tParam
  } catch {
    // ignore
  }

  return { videoId, time }
}

/** Парсер Twitch (Клипы и VOD) */
export function parseTwitchUrl(url: string): { kind: 'clip' | 'video'; id: string } | null {
  if (!url) return null

  // Twitch Clips: clips.twitch.tv/ClipId или twitch.tv/.../clip/ClipId
  const clipMatch =
    url.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/i) ||
    url.match(/twitch\.tv\/[^\/]+\/clip\/([a-zA-Z0-9_-]+)/i)
  if (clipMatch) {
    return { kind: 'clip', id: clipMatch[1] }
  }

  // Twitch VODs / Videos: twitch.tv/videos/123456789
  const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/i)
  if (videoMatch) {
    return { kind: 'video', id: videoMatch[1] }
  }

  return null
}

/** Парсер Vimeo */
export function parseVimeoUrl(url: string): { videoId: string } | null {
  if (!url) return null
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+))/i)
  if (!match) return null
  return { videoId: match[1] }
}

/** Парсер Dzen (Дзен) */
export function parseDzenUrl(url: string): { videoId: string } | null {
  if (!url) return null
  const match = url.match(/dzen\.ru\/(?:video\/watch|embed)\/([a-zA-Z0-9_-]+)/i)
  if (!match) return null
  return { videoId: match[1] }
}

/**
 * Главная функция: определяет, является ли URL видео-ссылкой одной из платформ,
 * и формирует готовый iframe embed URL.
 */
export function parseVideoEmbed(url: string): VideoEmbedInfo | null {
  if (!url) return null

  // 1. YouTube
  const yt = parseYouTubeUrl(url)
  if (yt) {
    let embedUrl = `https://www.youtube.com/embed/${yt.videoId}`
    if (yt.start) embedUrl += `?start=${yt.start}`
    return {
      type: 'youtube',
      videoId: yt.videoId,
      embedUrl,
    }
  }

  // 2. VK Video & VK Clips
  const vk = parseVkVideoUrl(url)
  if (vk) {
    let embedUrl = `https://vk.com/video_ext.php?oid=${vk.oid}&id=${vk.id}&hd=2`
    if (vk.hash) embedUrl += `&hash=${vk.hash}`
    return {
      type: 'vk',
      videoId: `${vk.oid}_${vk.id}`,
      embedUrl,
    }
  }

  // 3. Rutube
  const rutube = parseRutubeUrl(url)
  if (rutube) {
    let embedUrl = `https://rutube.ru/play/embed/${rutube.videoId}/`
    if (rutube.time) embedUrl += `?t=${rutube.time}`
    return {
      type: 'rutube',
      videoId: rutube.videoId,
      embedUrl,
    }
  }

  // 4. Twitch
  const twitch = parseTwitchUrl(url)
  if (twitch) {
    const parent = getHostname()
    const embedUrl =
      twitch.kind === 'clip'
        ? `https://clips.twitch.tv/embed?clip=${twitch.id}&parent=${parent}&autoplay=false`
        : `https://player.twitch.tv/?video=${twitch.id}&parent=${parent}&autoplay=false`
    return {
      type: 'twitch',
      videoId: twitch.id,
      embedUrl,
    }
  }

  // 5. Vimeo
  const vimeo = parseVimeoUrl(url)
  if (vimeo) {
    return {
      type: 'vimeo',
      videoId: vimeo.videoId,
      embedUrl: `https://player.vimeo.com/video/${vimeo.videoId}`,
    }
  }

  // 6. Dzen
  const dzen = parseDzenUrl(url)
  if (dzen) {
    return {
      type: 'dzen',
      videoId: dzen.videoId,
      embedUrl: `https://dzen.ru/embed/${dzen.videoId}`,
    }
  }

  return null
}

/** Проверка: является ли URL поддерживаемым видео */
export function isVideoUrl(url: string): boolean {
  return parseVideoEmbed(url) !== null
}
