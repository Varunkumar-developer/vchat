const STORAGE_KEY = "vchat-notifications-enabled";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  return navigator.serviceWorker
    .register("/sw.js")
    .catch(() => null);
}

export function getPermissionState() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (getPermissionState() === "unsupported") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;

  const result = await Notification.requestPermission();
  await registerServiceWorker();
  return result;
}

export function isNotificationEnabled() {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(STORAGE_KEY) === "true" &&
    getPermissionState() === "granted"
  );
}

export function setNotificationEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export async function showNotification(title, options = {}) {
  if (getPermissionState() !== "granted" || !isNotificationEnabled()) return;

  const payload = {
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "vchat-message",
    renotify: true,
    ...options,
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.ready.catch(() => null));
      if (reg) {
        await reg.showNotification(title, payload);
        return;
      }
    }
  } catch {
    // fall through to constructor
  }

  new Notification(title, payload);
}
