// Утилита для управления пользователями и изоляции данных

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

// Генерация UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Получить или создать ID текущего пользователя
export function getCurrentUserId(): string {
  try {
    let userId = localStorage.getItem('current_user_id');
    
    if (!userId) {
      // Создаем нового пользователя
      userId = generateUUID();
      localStorage.setItem('current_user_id', userId);
      
      // Сохраняем информацию о пользователе
      const user: User = {
        id: userId,
        name: `Пользователь ${new Date().toLocaleDateString()}`,
        createdAt: Date.now()
      };
      saveUser(user);
    }
    
    return userId;
  } catch (e) {
    console.error("Failed to get user ID", e);
    // Fallback: используем временный ID из sessionStorage
    let tempId = sessionStorage.getItem('temp_user_id');
    if (!tempId) {
      tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('temp_user_id', tempId);
    }
    return tempId;
  }
}

// Получить информацию о пользователе
export function getCurrentUser(): User | null {
  try {
    const userId = getCurrentUserId();
    const userJson = localStorage.getItem(`user_${userId}`);
    
    if (userJson) {
      return JSON.parse(userJson);
    }
    
    // Создаем пользователя, если его нет
    const user: User = {
      id: userId,
      name: `Пользователь ${new Date().toLocaleDateString()}`,
      createdAt: Date.now()
    };
    saveUser(user);
    return user;
  } catch (e) {
    console.error("Failed to get user", e);
    return null;
  }
}

// Сохранить информацию о пользователе
export function saveUser(user: User): void {
  try {
    localStorage.setItem(`user_${user.id}`, JSON.stringify(user));
    
    // Сохраняем список всех пользователей
    const users = getAllUsers();
    if (!users.find(u => u.id === user.id)) {
      users.push(user);
      localStorage.setItem('all_users', JSON.stringify(users));
    }
  } catch (e) {
    console.error("Failed to save user", e);
  }
}

// Обновить имя пользователя
export function updateUserName(userId: string, name: string): void {
  try {
    const user = getUserById(userId);
    if (user) {
      user.name = name;
      saveUser(user);
      
      // Обновляем в списке всех пользователей
      const users = getAllUsers();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
        users[index].name = name;
        localStorage.setItem('all_users', JSON.stringify(users));
      }
    }
  } catch (e) {
    console.error("Failed to update user name", e);
  }
}

// Получить пользователя по ID
export function getUserById(userId: string): User | null {
  try {
    const userJson = localStorage.getItem(`user_${userId}`);
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    console.error("Failed to get user by ID", e);
    return null;
  }
}

// Получить список всех пользователей
export function getAllUsers(): User[] {
  try {
    const usersJson = localStorage.getItem('all_users');
    return usersJson ? JSON.parse(usersJson) : [];
  } catch (e) {
    console.error("Failed to get all users", e);
    return [];
  }
}

// Переключиться на другого пользователя
export function switchUser(userId: string): void {
  try {
    localStorage.setItem('current_user_id', userId);
    // Перезагружаем страницу, чтобы применить изменения
    window.location.reload();
  } catch (e) {
    console.error("Failed to switch user", e);
  }
}

// Создать нового пользователя
export function createNewUser(name?: string): User {
  const userId = generateUUID();
  const user: User = {
    id: userId,
    name: name || `Пользователь ${new Date().toLocaleDateString()}`,
    createdAt: Date.now()
  };
  saveUser(user);
  return user;
}

// Получить ключ для localStorage с префиксом пользователя
export function getUserKey(key: string): string {
  const userId = getCurrentUserId();
  return `user_${userId}_${key}`;
}

// Обертка для localStorage с автоматическим префиксом пользователя
export const userStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(getUserKey(key));
    } catch (e) {
      console.error("Failed to get item from user storage", e);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(getUserKey(key), value);
    } catch (e) {
      console.error("Failed to set item in user storage", e);
    }
  },
  
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(getUserKey(key));
    } catch (e) {
      console.error("Failed to remove item from user storage", e);
    }
  },
  
  clear: (): void => {
    try {
      const userId = getCurrentUserId();
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`user_${userId}_`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("Failed to clear user storage", e);
    }
  }
};

// Проверить, прошел ли пользователь онбординг
export function hasCompletedOnboarding(): boolean {
  try {
    const completed = userStorage.getItem('onboarding_completed');
    return completed === 'true';
  } catch (e) {
    return false;
  }
}

// Отметить онбординг как пройденный
export function markOnboardingComplete(): void {
  try {
    userStorage.setItem('onboarding_completed', 'true');
  } catch (e) {
    console.error("Failed to mark onboarding complete", e);
  }
}

// Сбросить онбординг (для повторного запуска)
export function resetOnboarding(): void {
  try {
    userStorage.removeItem('onboarding_completed');
  } catch (e) {
    console.error("Failed to reset onboarding", e);
  }
}

