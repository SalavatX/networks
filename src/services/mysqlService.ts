// Сервис для работы с MySQL через REST API
const API_URL = 'https://networks-ez91.onrender.com/api';

// Типы данных
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  author: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  likes: string[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  sender: User;
  receiver: User;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  createdAt: string;
  isRead: boolean;
  sender: User;
  referenceId: string;
}

// Класс для работы с REST API
export class MysqlService {
  private token: string | null = null;
  
  constructor() {
    // Получаем токен из localStorage при инициализации
    this.token = localStorage.getItem('authToken');
  }
  
  // Установка токена авторизации
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }
  
  // Очистка токена при выходе
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }
  
  // Метод для выполнения запросов к API
  private async request<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', 
    data?: any
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`,
      };
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    // Проверка статуса ответа
    if (response.status === 401) {
      // Неавторизован - очищаем токен
      this.token = null;
      localStorage.removeItem('token');
      throw new Error('Необходима авторизация');
    } else if (response.status === 404) {
      throw new Error('Пользователь не найден');
    } else if (!response.ok) {
      throw new Error('Ошибка сервера');
    }

    // Пустой ответ (например, для DELETE запросов)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Метод для выполнения запросов с FormData (загрузка файлов)
  private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const options: RequestInit = {
      method: 'POST',
      headers: {},
      body: formData,
    };

    if (this.token) {
      options.headers = {
        'Authorization': `Bearer ${this.token}`,
      };
    }

    const response = await fetch(url, options);
    
    // Проверка статуса ответа
    if (response.status === 401) {
      this.token = null;
      localStorage.removeItem('token');
      throw new Error('Необходима авторизация');
    } else if (!response.ok) {
      throw new Error('Ошибка при загрузке файла');
    }

    return response.json();
  }
  
  // Методы для работы с пользователями
  async registerUser(email: string, password: string, displayName: string) {
    const response = await this.request<{ user: User, token: string }>(
      '/auth/register', 
      'POST', 
      { email, password, displayName }
    );
    
    this.setToken(response.token);
    return response.user;
  }
  
  async loginUser(email: string, password: string) {
    const response = await this.request<{ user: User, token: string }>(
      '/auth/login', 
      'POST', 
      { email, password }
    );
    
    this.setToken(response.token);
    return response.user;
  }
  
  async getCurrentUser() {
    return this.request<User>('/users/me');
  }
  
  async getUserProfile(userId: string) {
    return this.request<User>(`/users/${userId}`);
  }
  
  async updateProfile(data: { displayName?: string, bio?: string, photoURL?: string }) {
    return this.request<User>('/users/me', 'PATCH', data);
  }
  
  async followUser(userId: string) {
    return this.request<{ success: boolean }>(`/users/${userId}/follow`, 'POST');
  }
  
  async unfollowUser(userId: string) {
    return this.request<{ success: boolean }>(`/users/${userId}/unfollow`, 'POST');
  }
  
  async getUserFollowers(userId: string) {
    return this.request<User[]>(`/users/${userId}/followers`);
  }
  
  async getUserFollowing(userId: string) {
    return this.request<User[]>(`/users/${userId}/following`);
  }
  
  // Метод для поиска пользователей
  async searchUsers(query: string) {
    return this.request<User[]>(`/users/search?query=${encodeURIComponent(query)}`);
  }
  
  // Методы для работы с публикациями
  async getPosts() {
    return this.request<Post[]>('/posts');
  }
  
  async getUserPosts(userId: string) {
    return this.request<Post[]>(`/users/${userId}/posts`);
  }
  
  async createPost(data: { content: string, imageUrl?: string }) {
    return this.request<Post>('/posts', 'POST', data);
  }
  
  async deletePost(postId: string) {
    return this.request<{ success: boolean }>(`/posts/${postId}`, 'DELETE');
  }
  
  async likePost(postId: string) {
    return this.request<{ liked: boolean }>(`/posts/${postId}/like`, 'POST');
  }
  
  async addComment(postId: string, text: string) {
    return this.request<Comment>(`/posts/${postId}/comments`, 'POST', { text });
  }
  
  // Методы для работы с сообщениями
  async getConversations() {
    return this.request<User[]>('/messages/conversations');
  }
  
  async getMessages(userId: string) {
    return this.request<Message[]>(`/messages/${userId}`);
  }
  
  async sendMessage(userId: string, content: string) {
    return this.request<Message>(`/messages/${userId}`, 'POST', { content });
  }
  
  async deleteMessage(messageId: string) {
    return this.request<{ success: boolean }>(`/messages/${messageId}`, 'DELETE');
  }
  
  // Методы для работы с уведомлениями
  async getNotifications() {
    return this.request<Notification[]>('/notifications');
  }
  
  async markNotificationAsRead(notificationId: string) {
    return this.request<{ success: boolean }>(
      `/notifications/${notificationId}/read`, 
      'POST'
    );
  }
  
  // Методы для работы с файлами
  async uploadFile(file: File, folder: string = 'uploads'): Promise<{ fileUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    return this.requestWithFormData<{ fileUrl: string }>('/upload', formData);
  }
}

export const mysqlService = new MysqlService();
export default mysqlService; 
