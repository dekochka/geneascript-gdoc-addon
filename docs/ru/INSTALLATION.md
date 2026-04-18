---
layout: default
lang: ru
locale_section: true
title: Установка — Дополнение «Транскрибатор метрических книг»
permalink: /ru/INSTALLATION.html
---
# ⚙️ Установка — Дополнение «Транскрибатор метрических книг»

Дополнение работает в Google Docs™ и использует **Google™ AI (Gemini™)**. Ключ API можно ввести при первом **Transcribe Image** или вручную в свойствах скрипта.

## 🗺️ Варианты

| Путь | Для кого |
|------|----------|
| **Вариант 0** | **Рекомендуется.** [Google Workspace Marketplace](https://workspace.google.com/marketplace/) — одна установка. |
| **Вариант 1** | Отдельный проект Apps Script; тестовое развёртывание **Editor add-on**. |
| **Вариант 2** | Скрипт, привязанный к **одному** документу (**Extensions → Apps Script**). |
| **Вариант 3** | **clasp** или копирование из репозитория; далее вариант 1 или 2. |

## ✅ Требования

- Учётная запись Google.
- Google Doc для работы.
- Ключ **Google AI (Gemini)** — [Google AI Studio™](https://aistudio.google.com/api-keys) или [Google Cloud™ Console](https://console.cloud.google.com/) (включите Generative Language API). Можно отложить: дополнение подскажет при первой расшифровке.

## 🏪 Вариант 0: Marketplace

1. Найдите **GeneaScript Transcriber** в [Marketplace](https://workspace.google.com/marketplace/).
2. **Install** и выдайте разрешения.
3. В любом Doc: **Extensions** → **GeneaScript** или значок дополнения.
4. Первый **Transcribe Image** — диалог ключа и модели (по умолчанию Gemini Flash Latest; в диалоге также **Interface language**). Стоимость: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Далее — [USER_GUIDE.html](USER_GUIDE.html).

## 1️⃣ Вариант 1: тестовое развёртывание

Нужен тип **Editor add-on** и **тестовый документ**.

1. Откройте проект на [script.google.com](https://script.google.com).
2. Сверьте `appsscript.json` с репозиторием (`addon/appsscript.json`).
3. **Deploy** → **Test deployments** → **Editor add-on** → добавьте тестовый Doc → **Execute**.
4. Авторизуйте дополнение в документе.
5. Ключ: диалог **Transcribe Image** / **Setup AI** или свойство `GEMINI_API_KEY` (общее для всех пользователей проекта — осторожно).

## 2️⃣ Вариант 2: привязка к документу

1. **Extensions** → **Apps Script** в нужном Doc.
2. Замените код файлами из `addon/` (все `.gs`, `appsscript.json`).
3. Сохраните, выполните **onOpen**, перезагрузите документ.
4. Ключ — как в варианте 1.

## 3️⃣ Вариант 3: из репозитория (clasp)

1. Клонируйте репозиторий.
2. Включите [Apps Script API](https://script.google.com/home/usersettings).
3. `npm i -g @google/clasp` → `clasp login` → `clasp create --type docs --rootDir addon` или привязка к существующему → `clasp push`.
4. Ключ и модель через UI или **Setup AI**.

## 🔑 Ключ и модель

- Хранятся в **User Properties** (приватно на пользователя).
- **Setup AI** — смена ключа, модели, строгости (`0..2`), макс. длины вывода (`1..65536`), режима рассуждения.
- Цены: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

## 🎛️ Google Picker API (для издателей)

Для продакшена импорта из Drive нужны свойства `GOOGLE_PICKER_API_KEY` и `GOOGLE_PICKER_APP_ID`. Подробные шаги — в [английской версии](https://geneascript.com/en/INSTALLATION.html) раздел *Setting up Google Picker API* или `docs/en/INSTALLATION.md`. Конечные пользователи Marketplace это **не** настраивают.

## 🔧 Устранение неполадок

| Проблема | Действие |
|----------|----------|
| Меню не появляется | Перезагрузите документ; для теста — **Execute** в Test deployments. |
| Нет ключа API | Запустите **Transcribe Image** или **Setup AI**. |
| Ошибка валидации в Setup | Проверьте диапазоны строгости и max tokens. |
| 429 | Лимит бесплатного уровня; смените модель или тариф. |
| Picker не настроен | Для издателя — настройте ключи; иначе резервный ввод ссылок (если есть в вашей сборке). |

Использование: [USER_GUIDE.html](USER_GUIDE.html).
