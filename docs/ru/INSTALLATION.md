---
layout: default
lang: ru
locale_section: true
title: Установка — GeneaScript Transcriber
permalink: /ru/INSTALLATION.html
---
# ⚙️ Установка — GeneaScript Transcriber

Дополнение работает в Google Docs™ и использует **Google™ AI (Gemini™)** для транскрипции изображений метрических книг.

## ✅ Требования

- Учётная запись Google.
- Google Doc для работы.
- Ключ **Google AI (Gemini)** — [Google AI Studio™](https://aistudio.google.com/api-keys). Можно отложить: дополнение подскажет при первой расшифровке.

---

## 🏪 Установка из Google Workspace™ Marketplace

1. Откройте [страницу GeneaScript Transcriber в Google Workspace™ Marketplace](https://workspace.google.com/marketplace/app/geneascript_metric_book_transcriber/440886676248).
2. **Install** и выдайте разрешения.
3. В любом Doc: **Extensions** → **GeneaScript** или значок дополнения в правой панели.
4. Первый **Transcribe Image** — диалог ключа и модели (по умолчанию Gemini Flash Latest; в диалоге также **Interface language**). Стоимость: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Далее — [USER_GUIDE.html](USER_GUIDE.html).

---

## 🔑 Ключ и модель

- Хранятся в **User Properties** (приватно на пользователя).
- **Setup AI** (**Extensions** → **GeneaScript** → **Setup AI**) — смена ключа, модели, строгости (`0..2`), макс. длины вывода (`1..65536`), режима рассуждения.
- Цены: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

---

## 🔧 Устранение неполадок

| Проблема | Действие |
|----------|----------|
| Меню не появляется | Перезагрузите документ. Попробуйте удалить и установить дополнение заново. |
| Нет ключа API | Запустите **Transcribe Image** или **Setup AI**. |
| Ошибка валидации в Setup | Проверьте диапазоны строгости и max tokens. |
| 429 | Лимит бесплатного уровня; смените модель или тариф. |
| Файлы недоступны (Import from Drive) | Убедитесь, что файлы доступны вашей учётной записи. |

Использование: [USER_GUIDE.html](USER_GUIDE.html).
