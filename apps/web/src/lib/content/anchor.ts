/** Decode a URL fragment without rejecting authored IDs containing a literal percent sign. */
export const decodeAnchor = (hash: string): string => {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Resolve HTML ID targets and legacy named anchors without treating IDs as CSS selectors. */
export const findAnchor = (id: string, root: ParentNode = document): HTMLElement | null => {
  if (!id)
    return null;
  for (const element of root.querySelectorAll<HTMLElement>("[id], a[name]")) {
    if (element.id === id || (element.tagName === "A" && element.getAttribute("name") === id))
      return element;
  }
  return null;
};

/** Scroll the actual target's scrollable ancestors and optionally add its fragment to browser history. */
export const scrollToAnchor = (id: string, updateHistory = true, root: ParentNode = document): boolean => {
  const element = findAnchor(id, root);
  if (!element)
    return false;

  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
  if (updateHistory && decodeAnchor(window.location.hash) !== id) {
    const url = new URL(window.location.href);
    url.hash = encodeURIComponent(id);
    window.history.pushState(window.history.state, "", url);
  }
  return true;
};
