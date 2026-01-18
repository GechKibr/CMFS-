// const AUTH_API_URL = 'https://verbose-fiesta-r4p5rqw5jgw6fgx4-8000.app.github.dev/api/accounts';
const AUTH_API_URL = "http://localhost:8000/api/accounts";

class AuthService {
  async login(email, password) {
    try {
      const response = await fetch(`${AUTH_API_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.non_field_errors?.[0] || data.detail || 'Login failed');
      }
      
      if (data.access) {
        localStorage.setItem('token', data.access);
        localStorage.setItem('refresh', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      }
      
      throw new Error('No token received');
    } catch (error) {
      throw error;
    }
  }

  async register(userData) {
    try {
      const response = await fetch(`${AUTH_API_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = Object.values(data).flat().join(', ') || 'Registration failed';
        throw new Error(errorMsg);
      }

      if (data.access) {
        localStorage.setItem('token', data.access);
        localStorage.setItem('refresh', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  getUserRole() {
    const user = this.getCurrentUser();
    return user?.role || null;
  }

  getRoleBasedRoute() {
    const role = this.getUserRole();
    switch (role) {
      case 'admin':
        return '/admin';
      case 'officer':
        return '/officer';
      case 'user':
      default:
        return '/user';
    }
  }
}

export default new AuthService();
