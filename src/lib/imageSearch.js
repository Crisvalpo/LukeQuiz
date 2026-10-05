/**
 * Motor de Búsqueda de Imágenes para LukeQuiz
 * Servicio resiliente de imágenes reales sin dependencia de Edge Functions.
 */
export async function searchImages(query, count = 6) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { results: [] };
  }

  const cleanQuery = query.trim();

  try {
    // 1. Wikimedia Commons API
    const wikiUrl = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(cleanQuery) + '&gsrlimit=' + (count * 2) + '&prop=imageinfo&iiprop=url|size&iiurlwidth=800&format=json&origin=*';
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const results = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const info = p?.imageinfo?.[0];
        if (info && (info.thumburl || info.url)) {
          const mainUrl = info.thumburl || info.url;
          if (mainUrl && !mainUrl.toLowerCase().endsWith('.svg') && !mainUrl.toLowerCase().endsWith('.tiff')) {
            results.push({
              id: p.pageid || ('wm-' + i),
              url: mainUrl,
              thumb: mainUrl,
              alt: p.title ? p.title.replace(/^File:/i, '') : cleanQuery
            });
          }
        }
        if (results.length >= count) break;
      }
      if (results.length > 0) {
        return { results };
      }
    }
  } catch (e) {
    console.warn('Wikimedia Commons search fallback:', e);
  }

  try {
    // 2. Wikipedia PageImages API (Español)
    const wpUrl = 'https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrlimit=' + count + '&prop=pageimages&pithumbsize=800&format=json&origin=*';
    const res = await fetch(wpUrl);
    if (res.ok) {
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const results = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (p?.thumbnail?.source) {
          results.push({
            id: p.pageid || ('wp-' + i),
            url: p.thumbnail.source,
            thumb: p.thumbnail.source,
            alt: p.title || cleanQuery
          });
        }
      }
      if (results.length > 0) {
        return { results };
      }
    }
  } catch (e) {
    console.warn('Wikipedia search fallback:', e);
  }

  // 3. Fallback Picsum curado por semilla
  const seed = Math.abs(query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  const fallbackResults = Array.from({ length: Math.min(count, 4) }, (_, i) => {
    const imgUrl = 'https://picsum.photos/seed/' + (seed + i * 17) + '/800/600';
    return {
      id: 'fallback-' + i,
      url: imgUrl,
      thumb: imgUrl,
      alt: cleanQuery
    };
  });

  return { results: fallbackResults };
}
