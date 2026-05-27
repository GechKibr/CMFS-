import apiService from './api';

const TTL = 10000; // 10s cache

const state = {
  assigned: { ts: 0, data: null, promise: null },
  cc: { ts: 0, data: null, promise: null },
};

export async function getAssignedComplaints({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.assigned.data && now - state.assigned.ts < TTL) {
    return state.assigned.data;
  }

  if (state.assigned.promise) return state.assigned.promise;

  state.assigned.promise = (async () => {
    try {
      const res = await apiService.getAssignedComplaints();
      const data = Array.isArray(res) ? res : res.results || [];
      state.assigned.data = data;
      state.assigned.ts = Date.now();
      return data;
    } finally {
      state.assigned.promise = null;
    }
  })();

  return state.assigned.promise;
}

export async function getCCComplaints({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.cc.data && now - state.cc.ts < TTL) {
    return state.cc.data;
  }

  if (state.cc.promise) return state.cc.promise;

  state.cc.promise = (async () => {
    try {
      const res = await apiService.getCCComplaints();
      const data = Array.isArray(res) ? res : res.results || [];
      state.cc.data = data;
      state.cc.ts = Date.now();
      return data;
    } finally {
      state.cc.promise = null;
    }
  })();

  return state.cc.promise;
}

export function invalidateAssigned() {
  state.assigned.ts = 0;
}

export function invalidateCC() {
  state.cc.ts = 0;
}
