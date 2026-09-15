type VitalState = {
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number;
  inp_ms: number | null;
  inp_method: 'session-candidate';
};

export type ApiPerformanceMetric = {
  endpoint: string;
  method: string;
  duration_ms: number;
  status: number;
  response_bytes: number;
  server_timing: string | null;
  recorded_at: string;
};

export type ViewPerformanceMetric = {
  view: string;
  duration_ms: number;
  source: 'navigation' | 'initial-load';
  recorded_at: string;
};

type PerformanceSnapshot = {
  captured_at: string;
  vitals: VitalState;
  navigation: {
    ttfb_ms: number | null;
    dom_content_loaded_ms: number | null;
    load_event_ms: number | null;
  };
  resources: {
    count: number;
    transfer_bytes: number;
    encoded_body_bytes: number;
    decoded_body_bytes: number;
    largest: Array<{name:string;initiator_type:string;transfer_bytes:number;duration_ms:number}>;
  };
  views: ViewPerformanceMetric[];
  api: ApiPerformanceMetric[];
};

declare global {
  interface Window {
    __IA_PERF__?: {
      snapshot: () => PerformanceSnapshot;
      clear: () => void;
    };
  }
}

const vitals: VitalState = {
  fcp_ms: null,
  lcp_ms: null,
  cls: 0,
  inp_ms: null,
  inp_method: 'session-candidate',
};

const apiMetrics: ApiPerformanceMetric[] = [];
const viewMetrics: ViewPerformanceMetric[] = [];
const viewStarts = new Map<string, number>();
let installed = false;

const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

function boundedPush<T>(target:T[], value:T, max=200) {
  target.push(value);
  if (target.length > max) target.splice(0, target.length - max);
}

function safeObserver(type:string, callback:(entries:PerformanceEntry[])=>void) {
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true } as PerformanceObserverInit);
    return observer;
  } catch {
    return null;
  }
}

function getResourceSnapshot() {
  if (typeof performance === 'undefined') {
    return { count:0, transfer_bytes:0, encoded_body_bytes:0, decoded_body_bytes:0, largest:[] };
  }
  const rows = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const mapped = rows.map((entry) => ({
    name: entry.name,
    initiator_type: entry.initiatorType,
    transfer_bytes: Number(entry.transferSize || 0),
    encoded_body_bytes: Number(entry.encodedBodySize || 0),
    decoded_body_bytes: Number(entry.decodedBodySize || 0),
    duration_ms: Number(entry.duration || 0),
  }));
  return {
    count: mapped.length,
    transfer_bytes: mapped.reduce((sum, row) => sum + row.transfer_bytes, 0),
    encoded_body_bytes: mapped.reduce((sum, row) => sum + row.encoded_body_bytes, 0),
    decoded_body_bytes: mapped.reduce((sum, row) => sum + row.decoded_body_bytes, 0),
    largest: [...mapped]
      .sort((a,b) => b.transfer_bytes - a.transfer_bytes)
      .slice(0, 10)
      .map(({name,initiator_type,transfer_bytes,duration_ms}) => ({name,initiator_type,transfer_bytes,duration_ms})),
  };
}

export function performanceSnapshot(): PerformanceSnapshot {
  const navigation = typeof performance !== 'undefined'
    ? performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    : undefined;

  return {
    captured_at: new Date().toISOString(),
    vitals: { ...vitals },
    navigation: {
      ttfb_ms: navigation ? Math.max(0, navigation.responseStart - navigation.requestStart) : null,
      dom_content_loaded_ms: navigation ? Math.max(0, navigation.domContentLoadedEventEnd - navigation.startTime) : null,
      load_event_ms: navigation?.loadEventEnd ? Math.max(0, navigation.loadEventEnd - navigation.startTime) : null,
    },
    resources: getResourceSnapshot(),
    views: [...viewMetrics],
    api: [...apiMetrics],
  };
}

export function installPerformanceObservers() {
  if (installed || typeof window === 'undefined' || typeof performance === 'undefined') return;
  installed = true;

  safeObserver('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') vitals.fcp_ms = entry.startTime;
    }
  });

  safeObserver('largest-contentful-paint', (entries) => {
    const last = entries.at(-1);
    if (last) vitals.lcp_ms = last.startTime;
  });

  let sessionValue = 0;
  let sessionStart = 0;
  let lastShift = 0;
  safeObserver('layout-shift', (entries) => {
    for (const raw of entries) {
      const entry = raw as PerformanceEntry & { value?:number; hadRecentInput?:boolean };
      if (entry.hadRecentInput || !Number.isFinite(entry.value)) continue;
      const value = Number(entry.value || 0);
      if (
        sessionStart === 0 ||
        entry.startTime - lastShift > 1000 ||
        entry.startTime - sessionStart > 5000
      ) {
        sessionStart = entry.startTime;
        sessionValue = value;
      } else {
        sessionValue += value;
      }
      lastShift = entry.startTime;
      vitals.cls = Math.max(vitals.cls, sessionValue);
    }
  });

  safeObserver('event', (entries) => {
    for (const raw of entries) {
      const entry = raw as PerformanceEntry & { duration?:number; interactionId?:number };
      if (!entry.interactionId || !Number.isFinite(entry.duration)) continue;
      const duration = Number(entry.duration || 0);
      vitals.inp_ms = Math.max(vitals.inp_ms || 0, duration);
    }
  });

  window.__IA_PERF__ = {
    snapshot: performanceSnapshot,
    clear: () => {
      apiMetrics.splice(0);
      viewMetrics.splice(0);
      viewStarts.clear();
    },
  };
}

export function markViewNavigationStart(view:string) {
  if (typeof performance === 'undefined') return;
  viewStarts.set(view, clock());
  try {
    const mark = `ia:view:${view}:start`;
    performance.clearMarks(mark);
    performance.mark(mark);
  } catch {
    // Performance marks are best-effort diagnostics only.
  }
}

export function markViewRendered(view:string) {
  if (typeof window === 'undefined') return;
  const render = () => {
    const started = viewStarts.get(view);
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const fallbackStart = navigation?.startTime ?? 0;
    const start = started ?? fallbackStart;
    const duration = Math.max(0, clock() - start);
    boundedPush(viewMetrics, {
      view,
      duration_ms: duration,
      source: started == null ? 'initial-load' : 'navigation',
      recorded_at: new Date().toISOString(),
    });
    viewStarts.delete(view);
    try {
      const endMark = `ia:view:${view}:rendered`;
      performance.mark(endMark);
      if (started != null) performance.measure(`ia:view:${view}`, `ia:view:${view}:start`, endMark);
    } catch {
      // Measurement support varies slightly across browsers.
    }
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(render));
}

export function recordApiTiming(metric:Omit<ApiPerformanceMetric,'recorded_at'>) {
  boundedPush(apiMetrics, { ...metric, recorded_at: new Date().toISOString() });
}
