const AUTH_API_URL = 'https://8000-cs-292964466724-default.cs-europe-west1-xedi.cloudshell.dev/api/accounts';

class AuthService {
  async login(email, password) {
    try {
      console.log('Attempting login with:', { email, password });
      
      const response = await fetch(`${AUTH_API_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: email, password }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        // Handle specific error messages from backend
        if (data.non_field_errors) {
          throw new Error(data.non_field_errors[0]);
        }
        if (data.identifier) {
          throw new Error(data.identifier[0]);
        }
        if (data.password) {
          throw new Error(data.password[0]);
        }
        throw new Error(data.message || data.error || 'Login failed');
      }
      
      if (data.access || data.token) {
        const token = data.access || data.token;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(data.user || data));
        return data;
      }
      
      throw new Error('No token received');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('token');
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
    if (!user) return null;
    
    // Map backend roles to frontend roles
    switch (user.role) {
      case 'admin':
        return 'admin';
      case 'officer':
        return 'officer';
      case 'user':
      default:
        return 'user';
    }
  }
}

export default new AuthService();
