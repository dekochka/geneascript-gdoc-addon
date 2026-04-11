---
layout: default
lang: uk
locale_section: true
title: Встановлення — Додаток «Транскриптор метричних книг»
permalink: /uk/INSTALLATION.html
---
# ⚙️ Встановлення — Додаток «Транскриптор метричних книг»

Додаток працює в Google Docs™ і використовує **Google™ AI (Gemini™)**. Ключ API можна ввести під час першого **Transcribe Image** або вручну в властивостях скрипта.

## 🗺️ Варіанти

| Шлях | Для кого |
|------|----------|
| **Варіант 0** | **Рекомендовано.** [Google Workspace Marketplace](https://workspace.google.com/marketplace/) — один клік. |
| **Варіант 1** | Окремий проєкт Apps Script; тестове розгортання **Editor add-on**. |
| **Варіант 2** | Скрипт, прив’язаний до **одного** документа (**Extensions → Apps Script**). |
| **Варіант 3** | **clasp** або копіювання з репозиторію; далі як варіант 1 або 2. |

## ✅ Передумови

- Обліковий запис Google.
- Google Doc для роботи.
- Ключ **Google AI (Gemini)** — [Google AI Studio™](https://aistudio.google.com/api-keys) або [Google Cloud™ Console](https://console.cloud.google.com/) (увімкніть Generative Language API). Можна пропустити: додаток підкаже при першому транскрибуванні.

## 🏪 Варіант 0: Marketplace

1. Знайдіть **Metric Book Transcriber** у [Marketplace](https://workspace.google.com/marketplace/).
2. **Install** і надайте дозволи.
3. У будь-якому Doc: меню **Extensions** → **Metric Book Transcriber** або іконка доповнення.
4. Перший **Transcribe Image** — діалог ключа та моделі (за замовчуванням Gemini Flash Latest; у діалозі також **Interface language**). Деталі вартості: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Далі — [USER_GUIDE.html](USER_GUIDE.html).

## 1️⃣ Варіант 1: тестове розгортання (окремий проєкт)

Потрібен тип **Editor add-on** і **тестовий документ**.

1. Відкрийте проєкт на [script.google.com](https://script.google.com).
2. Переконайтеся, що `appsscript.json` відповідає репозиторію (`addon/appsscript.json`).
3. **Deploy** → **Test deployments** → **Editor add-on** → додайте тестовий Doc → **Execute**.
4. У документі авторизуйте доповнення.
5. Ключ: через діалог **Transcribe Image** / **Setup AI** або властивість `GEMINI_API_KEY` (спільна для всіх користувачів проєкту — обережно).

## 2️⃣ Варіант 2: прив’язка до документа

1. **Extensions** → **Apps Script** у потрібному Doc.
2. Замініть код файлами з `addon/` (усі потрібні `.gs`, `appsscript.json`).
3. Збережіть, виконайте **onOpen**, перезавантажте документ.
4. Ключ — як у варіанті 1.

## 3️⃣ Варіант 3: з репозиторію (clasp)

1. Клонуйте репозиторій.
2. Увімкніть [Apps Script API](https://script.google.com/home/usersettings).
3. `npm i -g @google/clasp` → `clasp login` → `clasp create --type docs --rootDir addon` або прив’язка до існуючого → `clasp push`.
4. Ключ і модель — через UI або **Setup AI**.

## 🔑 Ключ і модель

- Зберігаються в **User Properties** (приватно на користувача).
- **Setup AI** — зміна ключа, моделі, суворості (`0..2`), максимальної довжини виводу (`1..65536`), режиму міркування.
- Ціни: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

## 🎛️ Google Picker API (для видавців)

Для продакшену імпорту з Drive потрібні властивості скрипта `GOOGLE_PICKER_API_KEY` та `GOOGLE_PICKER_APP_ID` (номер проєкту GCP). Кроки — у [англійській версії](https://geneascript.com/en/INSTALLATION.html) розділ *Setting up Google Picker API* або у репозиторії `docs/en/INSTALLATION.md`. Кінцеві користувачі Marketplace це **не** налаштовують.

## 🔧 Усунення несправностей

| Проблема | Дія |
|----------|-----|
| Меню не з’являється | Перезавантажте документ; для тесту — **Execute** у Test deployments. |
| Немає ключа API | Запустіть **Transcribe Image** або **Setup AI**. |
| Помилка валідації в Setup | Перевірте діапазони суворості та max tokens. |
| 429 | Обмеження безкоштовного рівня; змініть модель або тариф. |
| Picker не налаштований | Для видавця — налаштуйте ключі Picker; інакше використовуйте резервний ввід посилань (якщо доступний у вашій збірці). |

Кроки користування: [USER_GUIDE.html](USER_GUIDE.html).
