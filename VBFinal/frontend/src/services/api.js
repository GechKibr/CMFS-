// const API_BASE_URL = 'https://verbose-fiesta-r4p5rqw5jgw6fgx4-8000.app.github.dev/api';
const API_BASE_URL = "http://localhost:8000/api";

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    // Remove auth requirement for development
    // if (this.token) {
    //   headers.Authorization = `Bearer ${this.token}`;
    // }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    console.log(`Making API request to: ${url}`);
    console.log('Request config:', config);

    try {
      const response = await fetch(url, config);
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Complaints
  async getComplaints() {
    return this.request('/complaints/');
  }

  async createComplaint(data) {
    return this.request('/complaints/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getComplaint(id) {
    return this.request(`/complaints/${id}/`);
  }

  async updateComplaint(id, data) {
    return this.request(`/complaints/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Institutions
  async getInstitutions() {
    return this.request('/institutions/');
  }

  async createInstitution(data) {
    return this.request('/institutions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInstitution(id, data) {
    return this.request(`/institutions/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteInstitution(id) {
    return this.request(`/institutions/${id}/`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories() {
    return this.request('/categories/');
  }

  async createCategory(data) {
    return this.request('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id, data) {
    return this.request(`/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id) {
    return this.request(`/categories/${id}/`, {
      method: 'DELETE',
    });
  }

  // Resolver Levels
  async getResolverLevels() {
    return this.request('/resolver-levels/');
  }

  async createResolverLevel(data) {
    return this.request('/resolver-levels/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateResolverLevel(id, data) {
    return this.request(`/resolver-levels/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteResolverLevel(id) {
    return this.request(`/resolver-levels/${id}/`, {
      method: 'DELETE',
    });
  }

  // Category Resolvers
  async getCategoryResolvers() {
    return this.request('/resolver-assignments/');
  }

  async createCategoryResolver(data) {
    return this.request('/resolver-assignments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategoryResolver(id, data) {
    return this.request(`/resolver-assignments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategoryResolver(id) {
    return this.request(`/resolver-assignments/${id}/`, {
      method: 'DELETE',
    });
  }

  // Users (assuming there's a users endpoint)
  async getUsers() {
    return this.request('/accounts/users/');
  }

  // Dashboard stats
  async getDashboardStats() {
    const complaints = await this.getComplaints();
    const stats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      urgent: complaints.filter(c => c.priority === 'urgent').length,
    };
    return stats;
  }
}

export default new ApiService();
