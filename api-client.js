/**
 * Diwan Al-Maarifa API Client
 * Handles all communication with the backend API
 */

const API_BASE_URL = 'https://diwan-maarifa-backend.onrender.com/api';

class DiwanAPIClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = localStorage.getItem('diwan_auth_token');
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('diwan_auth_token', token);
        } else {
            localStorage.removeItem('diwan_auth_token');
        }
    }

    /**
     * Get authentication token
     */
    getToken() {
        return this.token || localStorage.getItem('diwan_auth_token');
    }

    /**
     * Get current user from token
     */
    getCurrentUser() {
        const token = this.getToken();
        if (!token) return null;

        try {
            // Decode JWT token (simple base64 decode of payload)
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded;
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const user = this.getCurrentUser();
            // Check if token is expired
            if (user && user.exp) {
                return Date.now() < user.exp * 1000;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Logout user
     */
    logout() {
        this.setToken(null);
        localStorage.removeItem('diwan_user');
        window.location.href = '/index.html';
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth token if available
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // ==================== Authentication ====================

    /**
     * Register new user
     */
    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (response.token) {
            this.setToken(response.token);
            localStorage.setItem('diwan_user', JSON.stringify(response.user));
        }

        return response;
    }

    /**
     * Login user
     */
    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response.token) {
            this.setToken(response.token);
            localStorage.setItem('diwan_user', JSON.stringify(response.user));
        }

        return response;
    }

    /**
     * Refresh auth token
     */
    async refreshToken() {
        const response = await this.request('/auth/refresh', {
            method: 'POST'
        });

        if (response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    /**
     * Request password reset
     */
    async forgotPassword(email) {
        return await this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    /**
     * Reset password with token
     */
    async resetPassword(token, newPassword) {
        return await this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword })
        });
    }

    // ==================== Categories ====================

    /**
     * Get all categories
     */
    async getCategories() {
        return await this.request('/categories');
    }

    /**
     * Get category by slug
     */
    async getCategoryBySlug(slug) {
        return await this.request(`/categories/${slug}`);
    }

    // ==================== Content Submissions ====================

    /**
     * Submit new content
     */
    async submitContent(contentData) {
        return await this.request('/content', {
            method: 'POST',
            body: JSON.stringify(contentData)
        });
    }

    /**
     * Get all content submissions (with filters)
     */
    async getContent(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const endpoint = queryParams ? `/content?${queryParams}` : '/content';
        return await this.request(endpoint);
    }

    /**
     * Get content by ID
     */
    async getContentById(id) {
        return await this.request(`/content/${id}`);
    }

    /**
     * Update content submission
     */
    async updateContent(id, contentData) {
        return await this.request(`/content/${id}`, {
            method: 'PUT',
            body: JSON.stringify(contentData)
        });
    }

    /**
     * Delete content submission
     */
    async deleteContent(id) {
        return await this.request(`/content/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get user's content submissions
     */
    async getMyContent() {
        return await this.request('/content/my-submissions');
    }

    // ==================== Reviews ====================

    /**
     * Submit content review
     */
    async submitReview(submissionId, reviewData) {
        return await this.request(`/reviews/${submissionId}`, {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    /**
     * Get content reviews
     */
    async getReviews(submissionId) {
        return await this.request(`/reviews/${submissionId}`);
    }

    // ==================== User Profile ====================

    /**
     * Get user profile
     */
    async getProfile() {
        return await this.request('/users/profile');
    }

    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        return await this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // ==================== Bookmarks ====================

    /**
     * Add bookmark
     */
    async addBookmark(contentId) {
        return await this.request('/bookmarks', {
            method: 'POST',
            body: JSON.stringify({ content_id: contentId })
        });
    }

    /**
     * Remove bookmark
     */
    async removeBookmark(bookmarkId) {
        return await this.request(`/bookmarks/${bookmarkId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get user's bookmarks
     */
    async getBookmarks() {
        return await this.request('/bookmarks');
    }

    // ==================== Comments ====================

    /**
     * Add comment
     */
    async addComment(contentId, commentText, parentId = null) {
        return await this.request('/comments', {
            method: 'POST',
            body: JSON.stringify({
                content_id: contentId,
                comment_text: commentText,
                parent_comment_id: parentId
            })
        });
    }

    /**
     * Get comments for content
     */
    async getComments(contentId) {
        return await this.request(`/comments/${contentId}`);
    }

    /**
     * Delete comment
     */
    async deleteComment(commentId) {
        return await this.request(`/comments/${commentId}`, {
            method: 'DELETE'
        });
    }

    // ==================== Notifications ====================

    /**
     * Get user notifications
     */
    async getNotifications() {
        return await this.request('/notifications');
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId) {
        return await this.request(`/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
    }

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead() {
        return await this.request('/notifications/read-all', {
            method: 'PUT'
        });
    }
}

// Create global API client instance
const apiClient = new DiwanAPIClient();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DiwanAPIClient, apiClient };
}

// Expose to global window object for browser use
if (typeof window !== 'undefined') {
    window.DiowanAPI = apiClient;
    window.DiwanAPIClient = DiwanAPIClient;
}
