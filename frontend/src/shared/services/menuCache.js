let cache = {
  menu: null,
  categories: null,
  timestamp: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache lifetime

export const getCachedMenu = () => {
  const now = Date.now();
  if (cache.menu && (now - cache.timestamp < CACHE_DURATION)) {
    return cache.menu;
  }
  return null;
};

export const setCachedMenu = (menuData) => {
  cache.menu = menuData;
  cache.timestamp = Date.now();
};

export const getCachedCategories = () => {
  const now = Date.now();
  if (cache.categories && (now - cache.timestamp < CACHE_DURATION)) {
    return cache.categories;
  }
  return null;
};

export const setCachedCategories = (categoriesData) => {
  cache.categories = categoriesData;
  cache.timestamp = Date.now();
};

export const invalidateMenuCache = () => {
  cache.menu = null;
  cache.categories = null;
  cache.timestamp = 0;
};
