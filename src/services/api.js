const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('sr_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    // Re-throw with status or friendly message
    throw err;
  }
}

export const api = {
  // Health
  checkHealth: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      return await res.json();
    } catch {
      return null;
    }
  },

  // Auth Endpoints
  auth: {
    register: (name, email, password) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    google: (profile) =>
      request('/auth/google', {
        method: 'POST',
        body: JSON.stringify(profile),
      }),

    getMe: () => request('/auth/me'),
  },

  // Projects Endpoints
  projects: {
    getAll: () => request('/projects'),

    getById: (id) => request(`/projects/${id}`),

    create: (title, content) =>
      request('/projects', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      }),

    update: (id, updates) =>
      request(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id) =>
      request(`/projects/${id}`, {
        method: 'DELETE',
      }),

    syncLocal: (localProjects) =>
      request('/projects/sync-local', {
        method: 'POST',
        body: JSON.stringify({ localProjects }),
      }),
  },

  // AI Assistant Endpoints
  ai: {
    chat: (messages, currentCode, userInstruction, options = {}) =>
      request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages, currentCode, userInstruction }),
        ...options,
      }),

    polish: (snippet, instruction, currentCode, options = {}) =>
      request('/ai/polish', {
        method: 'POST',
        body: JSON.stringify({ snippet, instruction, currentCode }),
        ...options,
      }),

    parseResume: (resumeText, currentCode, options = {}) =>
      request('/ai/parse-resume', {
        method: 'POST',
        body: JSON.stringify({ resumeText, currentCode }),
        ...options,
      }),
  },

  // Admin Endpoints
  admin: {
    getStats: () => request('/admin/stats'),
    getUsers: () => request('/admin/users'),
    getProjects: () => request('/admin/projects'),
    getProjectById: (id) => request(`/admin/projects/${id}`),
    updateUserRole: (id, role) =>
      request(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    deleteUser: (id) =>
      request(`/admin/users/${id}`, {
        method: 'DELETE',
      }),
    deleteProject: (id) =>
      request(`/admin/projects/${id}`, {
        method: 'DELETE',
      }),
    updateProject: (id, updates) =>
      request(`/admin/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
  },
};
