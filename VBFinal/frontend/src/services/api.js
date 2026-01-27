// const API_BASE_URL = 'https://verbose-fiesta-r4p5rqw5jgw6fgx4-8000.app.github.dev/api';
const API_BASE_URL = "http://localhost:8000/api";
import systemLogger from './systemLogger.js';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setToken(data.access);
    return data.access;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(options.isFormData),
      ...options,
    };

    const method = options.method || 'GET';
    systemLogger.info(`API ${method} request to ${endpoint}`, 'API');

    try {
      let response = await fetch(url, config);
      
      // If token expired, try to refresh and retry
      if (response.status === 401 && this.token) {
        try {
          await this.refreshToken();
          config.headers = this.getHeaders(options.isFormData);
          response = await fetch(url, config);
          systemLogger.info('Token refreshed successfully', 'AUTH');
        } catch (refreshError) {
          systemLogger.error('Token refresh failed', 'AUTH');
          window.location.href = '/login';
          throw refreshError;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        systemLogger.error(`API ${method} ${endpoint} failed: ${response.status} ${response.statusText}`, 'API');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      systemLogger.success(`API ${method} ${endpoint} completed successfully`, 'API');
      
      // Handle empty responses (like DELETE requests)
      const contentType = response.headers.get('content-type');
      if (response.status === 204 || !contentType?.includes('application/json')) {
        return {}; // Return empty object for successful requests with no content
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      systemLogger.error(`API request failed: ${error.message}`, 'API');
      throw error;
    }
  }

  // JWT Session Management
  async getJwtConfig() {
    return this.request('/system/jwt-session/');
  }

  async updateJwtTimeout(timeoutMinutes) {
    return this.request('/system/jwt-session/', {
      method: 'POST',
      body: JSON.stringify({ timeout_minutes: timeoutMinutes }),
    });
  }

  async checkTokenExpiry() {
    return this.request('/accounts/token/check-expiry/', {
      method: 'POST',
    });
  }
  async getComplaints() {
    return this.request('/complaints/');
  }

  async createComplaint(data) {
    const isFormData = data instanceof FormData;
    return this.request('/complaints/', {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      isFormData: isFormData,
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

  async deleteComplaint(id) {
    return this.request(`/complaints/${id}/`, {
      method: 'DELETE',
    });
  }

  async patchComplaint(id, data) {
    return this.request(`/complaints/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async assignComplaint(id, data) {
    return this.request(`/complaints/${id}/assign/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Comments and Responses
  async addComplaintComment(complaintId, comment) {
    return this.request(`/complaints/${complaintId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ message: comment }),
    });
  }

  async getComplaintComments(complaintId) {
    return this.request(`/complaints/${complaintId}/comments/`);
  }

  // Responses
  async addComplaintResponse(complaintId, responseData) {
    return this.request('/responses/', {
      method: 'POST',
      body: JSON.stringify({
        complaint: complaintId,
        ...responseData
      }),
    });
  }

  async escalateComplaint(complaintId) {
    return this.request(`/complaints/${complaintId}/escalate/`, {
      method: 'POST',
    });
  }

  async createResponse(data) {
    return this.request('/responses/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getComplaintResponses(complaintId) {
    return this.request(`/complaints/${complaintId}/responses/`);
  }

  async getComplaintComments(complaintId) {
    return this.request(`/complaints/${complaintId}/comments/`);
  }

  async updateResponse(responseId, data) {
    return this.request(`/responses/${responseId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteResponse(responseId) {
    return this.request(`/responses/${responseId}/`, {
      method: 'DELETE',
    });
  }

  async updateComment(commentId, data) {
    return this.request(`/comments/${commentId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createComment(data) {
    return this.request('/comments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}/`, {
      method: 'DELETE',
    });
  }

  // Ratings
  async addComplaintRating(complaintId, rating, feedback) {
    return this.request('/comments/', {
      method: 'POST',
      body: JSON.stringify({ 
        complaint: complaintId,
        comment_type: 'rating',
        message: feedback || 'No feedback provided',
        rating: rating
      }),
    });
  }

  async getUsers(page = null, pageSize = null) {
    let url = '/accounts/';
    const params = new URLSearchParams();
    
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.request(url);
  }

  async getAllUsers() {
    // Fetch all users by getting first page and then all subsequent pages
    let allUsers = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.getUsers(page, 50); // Use larger page size
      const users = response.results || response;
      
      if (Array.isArray(users)) {
        allUsers = allUsers.concat(users);
      } else {
        // If response is not paginated, return as is
        return response;
      }
      
      // Check if there are more pages
      hasMore = response.next !== null;
      page++;
    }
    
    return { results: allUsers, count: allUsers.length };
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
  async getCategories(page = null) {
    const url = page ? `/categories/?page=${page}` : '/categories/';
    return this.request(url);
  }

  async getCategoriesByLanguage(language = 'en') {
    return this.request(`/categories/by-language/?lang=${language}`);
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
  async getCategoryResolvers(page = null, pageSize = null) {
    let url = '/resolver-assignments/';
    const params = new URLSearchParams();
    
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.request(url);
  }

  async getAllCategoryResolvers() {
    let allResolvers = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.getCategoryResolvers(page, 50);
      const resolvers = response.results || response;
      
      if (Array.isArray(resolvers)) {
        allResolvers = allResolvers.concat(resolvers);
      } else {
        return response;
      }
      
      hasMore = response.next !== null;
      page++;
    }
    
    return { results: allResolvers, count: allResolvers.length };
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

  // Users

  async createUser(data) {
    return this.request('/accounts/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id, data) {
    return this.request(`/accounts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/accounts/${id}/`, {
      method: 'DELETE',
    });
  }

  // Dashboard stats
  async getDashboardStats() {
    const complaintsData = await this.getComplaints();
    const complaints = complaintsData.results || complaintsData;
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
