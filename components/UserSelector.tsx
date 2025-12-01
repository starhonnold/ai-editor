import React, { useState, useEffect } from 'react';
import { User, getCurrentUser, getAllUsers, switchUser, createNewUser, updateUserName } from '../services/userService';
import { User as UserIcon, Plus, LogOut, Edit2, X, Check } from 'lucide-react';

interface UserSelectorProps {
  onUserChange?: (user: User) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({ onUserChange }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = () => {
    const user = getCurrentUser();
    const users = getAllUsers();
    setCurrentUser(user);
    setAllUsers(users);
    if (user && onUserChange) {
      onUserChange(user);
    }
  };

  const handleCreateUser = () => {
    if (newUserName.trim()) {
      const newUser = createNewUser(newUserName.trim());
      switchUser(newUser.id);
      setShowCreateForm(false);
      setNewUserName('');
      loadUserData();
    }
  };

  const handleSwitchUser = (userId: string) => {
    switchUser(userId);
    setShowSelector(false);
  };

  const handleEditName = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
  };

  const handleSaveEdit = (userId: string) => {
    if (editName.trim()) {
      updateUserName(userId, editName.trim());
      setEditingUserId(null);
      setEditName('');
      loadUserData();
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="relative">
      {/* Кнопка текущего пользователя */}
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-sm"
        title="Выбрать пользователя"
      >
        <UserIcon size={16} className="text-gray-500 dark:text-gray-400" />
        <span className="text-gray-700 dark:text-gray-300 font-medium max-w-[120px] truncate">
          {currentUser.name}
        </span>
      </button>

      {/* Выпадающее меню */}
      {showSelector && (
        <>
          {/* Overlay для закрытия */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSelector(false)}
          />
          
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Пользователи
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Каждый пользователь имеет изолированные документы
              </p>
            </div>

            {/* Список пользователей */}
            <div className="flex-1 overflow-y-auto p-2">
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  className={`p-3 rounded-lg mb-2 transition-colors ${
                    user.id === currentUser.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-zinc-700/50 hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {editingUserId === user.id ? (
                    // Редактирование имени
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(user.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1 text-sm px-2 py-1 rounded border dark:bg-zinc-800 dark:border-zinc-600"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(user.id)}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    // Отображение пользователя
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <UserIcon size={16} className="text-gray-400 shrink-0" />
                          <span
                            className={`text-sm font-medium truncate ${
                              user.id === currentUser.id
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {user.name}
                          </span>
                          {user.id === currentUser.id && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                              (Текущий)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Создан: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleSwitchUser(user.id)}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded"
                            title="Переключиться"
                          >
                            <LogOut size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditName(user)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded"
                          title="Изменить имя"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Форма создания нового пользователя */}
            {showCreateForm ? (
              <div className="p-3 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateUser();
                      if (e.key === 'Escape') {
                        setShowCreateForm(false);
                        setNewUserName('');
                      }
                    }}
                    placeholder="Имя нового пользователя"
                    className="flex-1 text-sm px-3 py-2 rounded border dark:bg-zinc-800 dark:border-zinc-600"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateUser}
                    className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    title="Создать"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewUserName('');
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded"
                    title="Отмена"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              // Кнопка создания
              <div className="p-3 border-t border-gray-200 dark:border-zinc-700">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                >
                  <Plus size={16} />
                  Создать нового пользователя
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default UserSelector;

