/**
 * Обеспечивает плавный переход на другую страницу.
 * @param {string} url - URL для перехода.
 */
function navigateWithTransition(url) {
    // Добавляем класс для анимации "ухода" страницы
    document.body.classList.add('page-exit');

    // Ждем завершения анимации (400ms, см. CSS) и затем переходим
    setTimeout(() => {
        window.location.href = url;
    }, 400);
}

document.addEventListener('DOMContentLoaded', () => {
    // Добавляем класс для анимации "появления" страницы
    document.body.classList.add('page-enter');

    // Перехватываем клики по всем ссылкам, которые должны иметь плавный переход
    document.addEventListener('click', (event) => {
        // Ищем ближайшего родителя-ссылку с атрибутом data-transition
        const link = event.target.closest('a[data-transition]');

        if (link) {
            event.preventDefault(); // Отменяем стандартное поведение ссылки
            const destination = link.href;

            // Проверяем, есть ли у ссылки data-атрибут для модуля
            if (link.dataset.moduleIndex) {
                const modules = [
                    { name: 'Судебная работа', table: 'sudeb_vzisk', url: '/judicial.html' },
                    { name: 'Досудебная работа', table: 'dos_rabota', url: '/prejudicial.html' },
                    { name: 'База зайцев', table: 'base_zayci', url: '/base-zayci.html' }
                ];
                const moduleIndex = parseInt(link.dataset.moduleIndex, 10);
                const module = modules[moduleIndex];

                if (module) {
                    console.log(`📂 Открытие модуля: ${module.name}`);
                    console.log(`📊 Таблица: ${module.table}`);
                    // Сохраняем информацию о модуле в sessionStorage
                    sessionStorage.setItem('currentModule', JSON.stringify(module));
                }
            }

            navigateWithTransition(destination);
        }
    });

    // Небольшая задержка перед тем, как разрешить убирать анимацию "ухода",
    // чтобы избежать мерцания при быстрой перезагрузке страницы.
    setTimeout(() => {
        document.body.classList.remove('page-exit');
    }, 500);
});