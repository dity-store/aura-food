
// Simple session-level cache to persist data across component unmounts (tab switches)
// This does NOT persist across page reloads (by design, to fetch fresh data on app restart)

interface SessionCache {
  dashboard: {
    lastParams: string;
    data: any;
  };
  reports: {
    lastParams: string;
    data: any;
  };
  history: {
    lastParams: string;
  };
  filters: {
    reports: any;
    dashboard: any;
  }
}

const cache: SessionCache = {
  dashboard: {
    lastParams: '',
    data: null,
  },
  reports: {
    lastParams: '',
    data: null,
  },
  history: {
    lastParams: '',
  },
  filters: {
    reports: null,
    dashboard: null
  }
};

export const getSessionCache = () => cache;

export const setSessionDashboard = (params: string, data: any) => {
  cache.dashboard.lastParams = params;
  cache.dashboard.data = data;
};

export const setSessionReports = (params: string, data: any) => {
  cache.reports.lastParams = params;
  cache.reports.data = data;
};

export const setSessionHistoryParams = (params: string) => {
  cache.history.lastParams = params;
};

export const setSessionFilters = (type: 'reports' | 'dashboard', filters: any) => {
  cache.filters[type] = filters;
};
