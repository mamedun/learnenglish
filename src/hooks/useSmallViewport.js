import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

function matchesSmallViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(QUERY).matches
  );
}

export default function useSmallViewport() {
  const [isSmallViewport, setIsSmallViewport] = useState(matchesSmallViewport);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(QUERY);
    const update = () => setIsSmallViewport(media.matches);
    update();
    if (media.addEventListener) media.addEventListener("change", update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener)
        media.removeEventListener("change", update);
      else media.removeListener(update);
    };
  }, []);

  return isSmallViewport;
}
