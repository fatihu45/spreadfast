import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { metadataForPath, SOCIAL_IMAGE } from './metadata';

function setMeta(attribute, name, content) {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metadataForPath(pathname);
    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('name', 'robots', meta.robots);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
    setMeta('property', 'og:image', SOCIAL_IMAGE);
    setMeta('name', 'twitter:image', SOCIAL_IMAGE);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (meta.canonical) {
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = meta.canonical;
      setMeta('property', 'og:url', meta.canonical);
    } else {
      canonical?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [pathname]);
  return null;
}
