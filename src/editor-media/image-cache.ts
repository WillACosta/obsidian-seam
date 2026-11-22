export type CachedImage = { data: ArrayBuffer; type: string }
export type ImageCacheStorage = {
  read(key: string): Promise<CachedImage | null>
  write(key: string, image: CachedImage): Promise<void>
}

/** Disk-backed thumbnails, shared across picker openings; failed requests can be retried. */
export class ImageCache {
  private pending = new Map<string, Promise<string>>()
  private urls = new Set<string>()
  private disposed = false
  constructor(
    private storage: ImageCacheStorage,
    private download: (url: string) => Promise<CachedImage>,
  ) {}
  get(url: string): Promise<string> {
    const existing = this.pending.get(url)
    if (existing) return existing
    const result = this.load(url).catch((error: unknown) => {
      this.pending.delete(url)
      throw error
    })
    this.pending.set(url, result)
    return result
  }
  private async load(url: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
    const key = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    let image = await this.storage.read(key).catch(() => null)
    if (!image) {
      image = await this.download(url)
      if (!image.type.startsWith('image/') || image.data.byteLength > 20 * 1024 * 1024)
        throw new Error('Image unavailable or larger than 20 MB.')
      // A read-only cache must not prevent a successful preview.
      await this.storage.write(key, image).catch(() => {})
    }
    if (this.disposed) throw new Error('Image cache closed.')
    const src = URL.createObjectURL(new Blob([image.data], { type: image.type }))
    this.urls.add(src)
    return src
  }
  dispose() {
    this.disposed = true
    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls.clear()
    this.pending.clear()
  }
}

export function imageName(path: string): string {
  let name = path
  try {
    name = new URL(path).pathname
  } catch {
    /* Vault path. */
  }
  name = name.split('/').pop() || 'Image'
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}
