---
layout: default
lang: uk
locale_section: true
title: Встановлення — GeneaScript Transcriber
permalink: /uk/INSTALLATION.html
---
# ⚙️ Встановлення — GeneaScript Transcriber

Додаток працює в Google Docs™ і використовує **Google™ AI (Gemini™)** для транскрипції зображень метричних книг.

## ✅ Передумови

- Обліковий запис Google.
- Google Doc для роботи.
- Ключ **Google AI (Gemini)** — [Google AI Studio™](https://aistudio.google.com/api-keys). Можна пропустити: додаток підкаже при першому транскрибуванні.

---

## 🏪 Встановлення з Google Workspace™ Marketplace

1. Відкрийте [сторінку GeneaScript Transcriber у Google Workspace™ Marketplace](https://workspace.google.com/marketplace/app/geneascript_metric_book_transcriber/440886676248).
2. **Install** і надайте дозволи.
3. У будь-якому Doc: меню **Extensions** → **GeneaScript** або іконка доповнення у правій панелі.
4. Перший **Transcribe Image** — діалог ключа та моделі (за замовчуванням Gemini Flash Latest; у діалозі також **Interface language**). Деталі вартості: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

Далі — [USER_GUIDE.html](USER_GUIDE.html).

---

## 🔑 Ключ і модель

- Зберігаються в **User Properties** (приватно на користувача).
- **Setup AI** (**Extensions** → **GeneaScript** → **Setup AI**) — зміна ключа, моделі, суворості (`0..2`), максимальної довжини виводу (`1..65536`), режиму міркування.
- Ціни: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

---

## 🔧 Усунення несправностей

| Проблема | Дія |
|----------|-----|
| Меню не з'являється | Перезавантажте документ. Спробуйте видалити і встановити додаток заново. |
| Немає ключа API | Запустіть **Transcribe Image** або **Setup AI**. |
| Помилка валідації в Setup | Перевірте діапазони суворості та max tokens. |
| 429 | Обмеження безкоштовного рівня; змініть модель або тариф. |
| Файли недоступні (Import from Drive) | Переконайтеся, що файли доступні вашому обліковому запису. |

Кроки користування: [USER_GUIDE.html](USER_GUIDE.html).
