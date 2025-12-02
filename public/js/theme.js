const ThemeManager = {
    // Константы для удобства
    THEME_KEY: 'theme',
    DARK_THEME: 'dark',
    LIGHT_THEME: 'light',

    // Инициализация менеджера тем
    init() {
        this.html = document.documentElement;
        this.themeToggle = document.getElementById('themeToggle');
        this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Определяем начальную тему
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        const initialTheme = savedTheme || (this.systemThemeQuery.matches ? this.DARK_THEME : this.LIGHT_THEME);
        this.applyTheme(initialTheme);

        // Добавляем обработчики событий
        this.addEventListeners();
    },

    // Добавление обработчиков событий
    addEventListeners() {
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', (e) => this.toggleTheme(e));
        }
        // Слушаем изменения системной темы
        this.systemThemeQuery.addEventListener('change', (e) => this.handleSystemThemeChange(e));
    },

    // Применение темы к документу
    applyTheme(theme) {
        this.html.setAttribute('data-theme', theme);
        if (this.themeToggle) {
            this.themeToggle.setAttribute('data-theme', theme);
        }

        // Обновляем мета-тег для цвета адресной строки в мобильных браузерах
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === this.DARK_THEME ? '#09090b' : '#f8fafc');
        }
    },

    // Переключение темы по клику
    toggleTheme(event) {
        const currentTheme = this.html.getAttribute('data-theme');
        const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;

        this.setThemeWithTransition(newTheme, event);
        localStorage.setItem(this.THEME_KEY, newTheme); // Сохраняем выбор пользователя
    },

    // Обработка смены системной темы
    handleSystemThemeChange(e) {
        // Если пользователь не делал явного выбора, следуем за системой
        if (!localStorage.getItem(this.THEME_KEY)) {
            const newTheme = e.matches ? this.DARK_THEME : this.LIGHT_THEME;
            this.setThemeWithTransition(newTheme, null);
        }
    },

    // Установка темы с плавной анимацией
    setThemeWithTransition(newTheme, event) {
        const DURATION = 800; // мс

        if (event) {
            this.html.style.setProperty('--x', event.clientX + 'px');
            this.html.style.setProperty('--y', event.clientY + 'px');
        } else {
            this.html.style.setProperty('--x', '50vw');
            this.html.style.setProperty('--y', '50vh');
        }

        // 1. Добавляем класс для анимации "закрытия" (круг сужается)
        this.html.classList.add('theme-transition-out');

        // 2. В середине анимации меняем тему и запускаем анимацию "открытия"
        setTimeout(() => {
            this.applyTheme(newTheme);
            this.html.classList.remove('theme-transition-out');
            this.html.classList.add('theme-transition-in');
        }, DURATION / 2);

        // 3. Убираем класс после завершения второй анимации
        this.html.addEventListener('animationend', () => {
            this.html.classList.remove('theme-transition-in');
        }, { once: true });
    },
};

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());