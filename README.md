<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Word Editor - Редактор документов с AI ассистентом

Интеллектуальный редактор документов с поддержкой AI (Gemini API) для создания, редактирования и форматирования текста.

View your app in AI Studio: https://ai.studio/apps/drive/1ywxalHtIZHayN0Mb5dUwgfTuRqZE2H4c

## Возможности

- ✨ Богатый текстовый редактор с форматированием
- 🤖 AI ассистент на базе Gemini API
- 📄 Поддержка импорта/экспорта (HTML, DOCX, PDF)
- 🌓 Темная и светлая темы
- 💾 Автосохранение в LocalStorage
- 📊 Генерация диаграмм и таблиц
- 👥 Изоляция данных по пользователям - каждый пользователь имеет свои документы и настройки

## Локальная разработка

**Требования:** Node.js 18+ и npm

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Создайте файл `.env.local` и добавьте ваш Gemini API ключ:
   ```bash
   cp .env.example .env.local
   # Отредактируйте .env.local и добавьте ваш GEMINI_API_KEY
   ```
   Получить ключ можно на: https://aistudio.google.com/app/apikey

3. Запустите приложение:
   ```bash
   npm run dev
   ```

4. Откройте браузер по адресу: http://localhost:3000

## Деплой на Netlify

Приложение настроено для деплоя на Netlify как Single Page Application (SPA).

### Вариант 1: Через Netlify UI (Рекомендуется)

1. **Подготовьте репозиторий**
   - Загрузите код в GitHub/GitLab/Bitbucket
   - Убедитесь, что файл `netlify.toml` присутствует в корне проекта

2. **Создайте сайт на Netlify**
   - Зайдите на https://app.netlify.com/
   - Нажмите "Add new site" → "Import an existing project"
   - Выберите ваш репозиторий

3. **Настройте переменные окружения**
   - В настройках сайта перейдите в "Site settings" → "Environment variables"
   - Добавьте переменную `GEMINI_API_KEY` с вашим API ключом
   - Получить ключ можно на: https://aistudio.google.com/app/apikey

4. **Настройки сборки**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - (Эти настройки уже указаны в `netlify.toml`, но можно проверить)

5. **Деплой**
   - Нажмите "Deploy site"
   - Netlify автоматически соберет и задеплоит приложение

### Вариант 2: Через Netlify CLI

1. Установите Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Войдите в Netlify:
   ```bash
   netlify login
   ```

3. Инициализируйте проект:
   ```bash
   netlify init
   ```
   - Выберите "Create & configure a new site"
   - Следуйте инструкциям

4. Установите переменные окружения:
   ```bash
   netlify env:set GEMINI_API_KEY your_api_key_here
   ```

5. Задеплойте:
   ```bash
   netlify deploy --prod
   ```

### Важные замечания

- ⚠️ **Безопасность**: Никогда не коммитьте `.env.local` или `.env` с реальными ключами в репозиторий
- 🔑 **API ключи**: Используйте переменные окружения в Netlify для хранения API ключей
- 🔄 **SPA роутинг**: Все маршруты автоматически перенаправляются на `index.html` благодаря настройкам в `netlify.toml`

## Структура проекта

```
word/
├── components/          # React компоненты
│   ├── Assistant.tsx   # AI ассистент панель
│   ├── RichTextEditor.tsx  # Текстовый редактор
│   └── Sidebar.tsx     # Боковая панель
├── services/           # Сервисы
│   └── aiService.ts    # Интеграция с Gemini API
├── App.tsx            # Главный компонент
├── index.tsx          # Точка входа
├── index.html         # HTML шаблон
├── vite.config.ts     # Конфигурация Vite
├── netlify.toml       # Конфигурация Netlify
└── package.json       # Зависимости
```

## Технологии

- **React 19** - UI библиотека
- **TypeScript** - Типизация
- **Vite** - Сборщик и dev-сервер
- **Tailwind CSS** - Стилизация (через CDN)
- **Gemini API** - AI функционал
- **Lucide React** - Иконки

## Лицензия

MIT
