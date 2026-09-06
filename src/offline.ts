type OfflineOptions = {
  enabled: boolean;
  onReady: () => void;
  onError?: () => void;
};

export function registerOffline({ enabled, onReady, onError }: OfflineOptions) {
  if (!enabled || !("serviceWorker" in navigator)) return;

  const workers = navigator.serviceWorker;
  const workerUrl = new URL("./sw.js", window.location.href);
  let registration: ServiceWorkerRegistration | undefined;
  let observedWorker: ServiceWorker | null = null;
  let finished = false;

  function cleanup() {
    workers.removeEventListener("controllerchange", checkReady);
    observedWorker?.removeEventListener("statechange", checkInstallation);
  }

  function fail() {
    if (finished) return;
    finished = true;
    cleanup();
    onError?.();
  }

  function checkReady() {
    const controller = workers.controller;
    if (
      !finished &&
      controller &&
      controller === registration?.active &&
      controller.scriptURL === workerUrl.href &&
      controller.state === "activated"
    ) {
      finished = true;
      cleanup();
      onReady();
    }
  }

  function checkInstallation() {
    if (observedWorker?.state === "redundant") fail();
    else checkReady();
  }

  workers.addEventListener("controllerchange", checkReady);
  workers.register(workerUrl.href).then((result) => {
    registration = result;
    observedWorker = result.installing ?? result.waiting ?? result.active;
    observedWorker?.addEventListener("statechange", checkInstallation);
    checkInstallation();
  }, fail);
}
