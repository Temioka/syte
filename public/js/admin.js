// Проверка авторизации и прав администратора
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        navigateWithTransition('/');
        return false;
    }
    return true;
}

// Глобальные переменные
let allUsers = [];
let currentFilter = 'all';
let currentUser = null;
let editingUserId = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('👤 Admin panel загружен');
    
    if (!checkAuth()) return;

    loadUserProfile();
    loadUsers();
    initializeEventHandlers();
});

// Загрузка профиля текущего пользователя
async function loadUserProfile() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = data.user.username;
            }
            
            // Проверяем права администратора
            if (!data.user.is_admin) {
                showToast('У вас нет прав доступа к этой странице', 'error');
                setTimeout(() => navigateWithTransition('/dashboard.html'), 2000);
            }
        } else {
            localStorage.removeItem('token');
            navigateWithTransition('/');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Ошибка загрузки профиля', 'error');
    }
}

// Загрузка списка пользователей
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки пользователей');
        }

        const result = await response.json();
        allUsers = result.data || result.users || [];
        
        updateFilterCounts();
        renderUsers();

    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showToast('Не удалось загрузить список пользователей', 'error');
    }
}

// Обновление счетчиков фильтров
function updateFilterCounts() {
    const adminCount = allUsers.filter(u => u.is_admin).length;
    const userCount = allUsers.filter(u => !u.is_admin).length;
    const activeCount = allUsers.filter(u => u.is_active).length;
    const inactiveCount = allUsers.filter(u => !u.is_active).length;

    const countElements = {
        'allCount': allUsers.length,
        'adminCount': adminCount,
        'userCount': userCount,
        'activeCount': activeCount,
        'inactiveCount': inactiveCount
    };

    for (const [id, count] of Object.entries(countElements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = count;
    }
}

// Рендеринг таблицы пользователей
function renderUsers() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    let filteredUsers = allUsers.filter(user => {
        // Фильтрация по поиску
        const matchesSearch = 
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.full_name && user.full_name.toLowerCase().includes(searchTerm));

        if (!matchesSearch) return false;

        // Фильтрация по типу
        switch (currentFilter) {
            case 'admin':
                return user.is_admin;
            case 'user':
                return !user.is_admin;
            case 'active':
                return user.is_active;
            case 'inactive':
                return !user.is_active;
            default:
                return true;
        }
    });

    const tbody = document.getElementById('usersTableBody');
    const noResults = document.getElementById('noResults');

    if (!tbody || !noResults) return;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    
    // ✅ ИСПРАВЛЕНО: Используем безопасный рендеринг без onclick в HTML
    tbody.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    
    filteredUsers.forEach((user, index) => {
        const row = document.createElement('tr');
        row.dataset.userId = user.id;
        row.classList.add('row-fade-in');
        row.style.animationDelay = `${index * 0.03}s`;
        
        // Создаём HTML структуру строки
        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${escapeHtml(getInitials(user.full_name || user.username))}</div>
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(user.full_name || user.username)}</div>
                        <div class="user-username">@${escapeHtml(user.username)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <div class="role-badge ${user.is_admin ? 'admin' : ''}">
                    ${user.is_admin ? `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Администратор
                    ` : `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Пользователь
                    `}
                </div>
            </td>
            <td>
                <div class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    <span class="status-dot"></span>
                    ${user.is_active ? 'Активен' : 'Неактивен'}
                </div>
            </td>
            <td>${formatDateTime(user.last_login)}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>
                <div class="action-buttons" data-user-id="${user.id}">
                    <button class="action-btn btn-edit" title="Редактировать" data-action="edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    ${user.id !== currentUser?.id ? `
                        <button class="action-btn delete btn-delete" title="Удалить" data-action="delete" data-username="${escapeHtml(user.username)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        // ✅ ИСПРАВЛЕНО: Добавляем обработчики через addEventListener (безопаснее)
        const actionButtons = row.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.addEventListener('click', handleUserAction);
        }
        
        fragment.appendChild(row);
    });
    
    tbody.appendChild(fragment);
}

// ✅ НОВАЯ ФУНКЦИЯ: Обработчик действий с пользователями
function handleUserAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const userId = button.closest('.action-buttons').dataset.userId;
    
    if (action === 'edit') {
        editUser(userId);
    } else if (action === 'delete') {
        const username = button.dataset.username;
        confirmDeleteUser(userId, username);
    }
}

// Инициализация обработчиков событий
function initializeEventHandlers() {
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            renderUsers();
        }, 300));
    }

    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderUsers();
        });
    });

    // Кнопка добавления пользователя
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', openAddUserModal);
    }

    // Модальные окна
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveUserBtn = document.getElementById('saveUserBtn');
    
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeUserModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUserModal);
    if (saveUserBtn) saveUserBtn.addEventListener('click', saveUser);

    // Удаление
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteUser);

    // Показ/скрытие пароля
    const togglePassword = document.querySelector('.toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', togglePasswordVisibility);
    }

    // Закрытие модалок по клику вне
    const userModal = document.getElementById('userModal');
    const deleteModal = document.getElementById('deleteModal');
    
    if (userModal) {
        userModal.addEventListener('click', (e) => {
            if (e.target.id === 'userModal') closeUserModal();
        });
    }
    
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') closeDeleteModal();
        });
    }
}

// Открытие модального окна добавления пользователя
function openAddUserModal() {
    editingUserId = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const userForm = document.getElementById('userForm');
    const passwordGroup = document.getElementById('passwordGroup');
    const passwordInput = document.getElementById('password');
    const isActiveCheckbox = document.getElementById('isActive');
    
    if (modalTitle) modalTitle.textContent = 'Добавить пользователя';
    if (userForm) userForm.reset();
    if (passwordGroup) passwordGroup.style.display = 'block';
    if (passwordInput) passwordInput.required = true;
    if (isActiveCheckbox) isActiveCheckbox.checked = true;
    
    const userModal = document.getElementById('userModal');
    if (userModal) userModal.style.display = 'flex';
}

// Редактирование пользователя
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showToast('Пользователь не найден', 'error');
        return;
    }

    editingUserId = userId;
    
    const modalTitle = document.getElementById('modalTitle');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const fullNameInput = document.getElementById('fullName');
    const isAdminCheckbox = document.getElementById('isAdmin');
    const isActiveCheckbox = document.getElementById('isActive');
    const passwordGroup = document.getElementById('passwordGroup');
    const passwordInput = document.getElementById('password');
    const userModal = document.getElementById('userModal');
    
    if (modalTitle) modalTitle.textContent = 'Редактировать пользователя';
    if (usernameInput) usernameInput.value = user.username;
    if (emailInput) emailInput.value = user.email;
    if (fullNameInput) fullNameInput.value = user.full_name || '';
    if (isAdminCheckbox) isAdminCheckbox.checked = user.is_admin;
    if (isActiveCheckbox) isActiveCheckbox.checked = user.is_active;
    if (passwordGroup) passwordGroup.style.display = 'none';
    if (passwordInput) passwordInput.required = false;
    if (userModal) userModal.style.display = 'flex';
}

// Сохранение пользователя
async function saveUser() {
    const form = document.getElementById('userForm');
    if (!form || !form.checkValidity()) {
        if (form) form.reportValidity();
        return;
    }

    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const fullNameInput = document.getElementById('fullName');
    const passwordInput = document.getElementById('password');
    const isAdminCheckbox = document.getElementById('isAdmin');
    const isActiveCheckbox = document.getElementById('isActive');

    const userData = {
        username: usernameInput?.value.trim(),
        email: emailInput?.value.trim(),
        full_name: fullNameInput?.value.trim() || null,
        is_admin: isAdminCheckbox?.checked || false,
        is_active: isActiveCheckbox?.checked || false
    };

    if (!editingUserId && passwordInput) {
        userData.password = passwordInput.value;
    }

    // Валидация
    if (!userData.username || !userData.email) {
        showToast('Заполните все обязательные поля', 'warning');
        return;
    }

    if (!isValidEmail(userData.email)) {
        showToast('Введите корректный email адрес', 'warning');
        return;
    }

    const saveBtn = document.getElementById('saveUserBtn');
    const originalText = saveBtn?.innerHTML || 'Сохранить';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="btn-spinner"></span>Сохранение...';
    }

    try {
        const token = localStorage.getItem('token');
        const url = editingUserId 
            ? `${API_BASE_URL}/admin/users/${editingUserId}`
            : `${API_BASE_URL}/admin/users`;
        
        const method = editingUserId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка сохранения');
        }

        const message = editingUserId ? 'Пользователь обновлен' : 'Пользователь создан';
        showToast(message, 'success');
        closeUserModal();
        await loadUsers();

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showToast(error.message || 'Ошибка при сохранении пользователя', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}

// Подтверждение удаления
function confirmDeleteUser(userId, username) {
    editingUserId = userId;
    
    const confirmationText = document.querySelector('#deleteModal .confirmation-text');
    if (confirmationText) {
        confirmationText.textContent = 
            `Вы действительно хотите удалить пользователя "${username}"? Это действие нельзя отменить.`;
    }
    
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.style.display = 'flex';
    }
}

// Удаление пользователя
async function deleteUser() {
    if (!editingUserId) return;

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn?.innerHTML || 'Удалить';
    
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="btn-spinner"></span>Удаление...';
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/${editingUserId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка удаления');
        }

        showToast('Пользователь удален', 'success');
        closeDeleteModal();
        await loadUsers();

    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast(error.message || 'Ошибка при удалении пользователя', 'error');
    } finally {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalText;
        }
    }
}

// Закрытие модальных окон
function closeUserModal() {
    const userModal = document.getElementById('userModal');
    if (userModal) {
        userModal.style.display = 'none';
    }
    editingUserId = null;
}

function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.style.display = 'none';
    }
    editingUserId = null;
}

// Показ/скрытие пароля
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;
    
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    // Обновляем иконку если нужно
    const toggleBtn = document.querySelector('.toggle-password');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-label', 
            type === 'password' ? 'Показать пароль' : 'Скрыть пароль'
        );
    }
}

// Вспомогательные функции
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}