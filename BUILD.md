# Команды для создания продакшн релиза

## Сборка портала для адреса (как в CI)

```bash
npm ci
node scripts/check-docs.mjs
# площадка для проверки (GitHub Pages)
node scripts/build-site.mjs --site-url https://paynet-business.github.io/paynet-docs/ --out dist
# основной сайт docs.paynet.md/api/ (строгая проверка: нет ссылок на GitHub Pages)
node scripts/build-site.mjs --site-url https://docs.paynet.md/api/ --out dist-it --strict
# архив для ИТ + README-IT.txt
node scripts/build-release.mjs --dir dist-it --out release
```

При каждом пуше в `main` GitHub Actions делает обе сборки из одного коммита; архив для ИТ кладётся в ветку `ci/release`.

## Основные команды

### 1. Стандартная сборка
```bash
npm run build
```

### 2. Продакшн сборка с проверками
```bash
npm run build:prod
```
Эта команда выполняет:
- Проверку линтера (ESLint)
- Сборку для продакшн

### 3. Предварительный просмотр продакшн сборки
```bash
npm run preview:prod
```
Собирает проект и запускает локальный сервер для просмотра продакшн версии

### 4. Только предварительный просмотр (если уже собрано)
```bash
npm run preview
```

## Дополнительные команды

### Проверка типов TypeScript
```bash
npm run type-check
```

### Исправление ошибок линтера
```bash
npm run lint:fix
```

### Очистка папки сборки
```bash
npm run clean
```

## Полный процесс релиза

1. **Проверка и исправление кода:**
   ```bash
   npm run lint:fix
   npm run type-check
   ```

2. **Сборка для продакшн:**
   ```bash
   npm run build:prod
   ```

3. **Тестирование продакшн сборки:**
   ```bash
   npm run preview
   ```

4. **Деплой файлов из папки `dist/`**

## Структура продакшн сборки

После выполнения `npm run build` в папке `dist/` будут созданы:
- `index.html` - главная страница
- `assets/` - оптимизированные CSS, JS и другие ресурсы
- Все статические файлы

## Деплой на различные платформы

### Netlify
```bash
# Сборка
npm run build:prod

# Деплой (если настроен Netlify CLI)
netlify deploy --prod --dir=dist
```

### Vercel
```bash
# Сборка
npm run build:prod

# Деплой (если настроен Vercel CLI)
vercel --prod
```

### GitHub Pages
```bash
# Сборка
npm run build:prod

# Копирование файлов в gh-pages ветку или настройка GitHub Actions
```

### Обычный веб-сервер
```bash
# Сборка
npm run build:prod

# Копирование содержимого папки dist/ на сервер
scp -r dist/* user@server:/path/to/web/root/
```

## Переменные окружения для продакшн

Создайте файл `.env.production` для продакшн переменных:
```env
VITE_API_BASE_URL=https://ecom-api-test.paynet.md
VITE_APP_TITLE=TPS API Documentation
```

## Оптимизация сборки

Vite автоматически выполняет:
- Минификацию JavaScript и CSS
- Tree-shaking (удаление неиспользуемого кода)
- Оптимизацию изображений
- Разделение кода (code splitting)
- Кэширование ресурсов

## Проверка размера сборки

После сборки Vite покажет размеры файлов:
```
dist/index.html                   0.45 kB
dist/assets/index-abc123.css      8.23 kB │ gzip: 2.34 kB
dist/assets/index-def456.js     142.67 kB │ gzip: 45.12 kB
```