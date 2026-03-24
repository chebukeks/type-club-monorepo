# Твоё Меню — Development Guide

> **Назначение документа:** прикреплять к контексту AI-ассистента (или держать открытым) при работе над проектом,
> чтобы обеспечить стабильный и консистентный подход к разработке.

---

## 1. Обзор проекта

**Твоё Меню** — Telegram-бот для планирования питания.

| Компонент | Описание |
|-----------|----------|
| **Bot** (aiogram 3) | Long-polling, FSM, inline-кнопки, Web App launcher |
| **API** (FastAPI) | REST-бэкенд для Web App, двойная auth (Telegram initData + JWT cookie) |
| **Web App** (HTML/CSS/JS) | SPA с hash-навигацией, Telegram theme variables |
| **DB** (PostgreSQL + SQLAlchemy 2.0 async) | 4 модели: User, Product, Recipe, MealPlan |
| **Cache/FSM** (Redis) | FSM storage + будущий кэш |
| **AI** (DeepSeek) | Генерация рационов по КБЖУ |
| **Scheduler** (APScheduler) | Напоминания о приёмах пищи |
| **Infra** (Docker Compose + Nginx) | Оркестрация, SSL, reverse proxy |

**Домен:** `your-menu.ru` (SSL через Let's Encrypt / certbot)

---

## 2. Структура директорий

```
eatsmart_bot/
├── app/                          # Python-пакет приложения
│   ├── config.py                 # Pydantic Settings (.env)
│   ├── main.py                   # Единая точка входа (bot + api)
│   ├── bot/                      # Telegram-бот
│   │   ├── loader.py             # Bot, Dispatcher, роутеры
│   │   ├── handlers/             # Обработчики команд
│   │   ├── middlewares/auth.py   # Авто-регистрация юзера в БД
│   │   ├── keyboards/inline.py  # Inline-клавиатуры
│   │   ├── states/profile.py    # FSM-состояния
│   │   └── utils/webapp.py      # Валидация initData
│   ├── api/                      # FastAPI
│   │   ├── app.py                # Фабрика приложения
│   │   ├── deps.py               # get_db, get_current_user
│   │   └── routes/               # Эндпоинты
│   ├── db/                       # Слой данных
│   │   ├── database.py           # AsyncSession factory
│   │   ├── models/               # ORM-модели
│   │   └── repositories/         # CRUD-обёртки
│   └── services/                 # Бизнес-логика
│       ├── auth_service.py          # bcrypt, JWT токены
│       ├── nutrition.py             # Расчёт КБЖУ
│       ├── deepseek.py              # Интеграция с DeepSeek
│       ├── meal_planner.py          # Оркестрация рекомендаций
│       └── reminder.py              # APScheduler
├── webapp/                       # Telegram Web App (статика)
├── data/                         # Стартовые данные (CSV, JSON)
├── alembic/                      # Миграции
├── nginx/nginx.conf              # Reverse proxy (HTTPS)
├── nginx/nginx.init.conf         # Временный HTTP-only (для certbot)
├── scripts/get-certificate.sh    # Получение SSL-сертификата
├── docker-compose.yml            # Оркестрация
├── Dockerfile                    # Образ бота
└── requirements.txt              # Зависимости
```

---

## 3. Архитектурные слои

### 3.1 Поток данных

```
Telegram User
    │
    ├── [Chat] → aiogram handlers → repositories → DB
    │
    └── [Web App] → JS fetch → FastAPI routes → repositories → DB
                                     │
                                     └── services (nutrition, deepseek)
```

### 3.2 Правила слоёв

| Слой | Может импортировать | НЕ может импортировать |
|------|--------------------|-----------------------|
| `handlers` / `routes` | `services`, `repositories`, `models` | Друг друга |
| `services` | `repositories`, `models`, внешние API | `handlers`, `routes` |
| `repositories` | `models`, `database` | `services`, `handlers` |
| `models` | Только `base` | Всё остальное |

---

## 4. Модели БД

### User
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | Integer (PK) | Внутренний ID |
| `telegram_id` | BigInteger (nullable) | Telegram ID (может быть null для email-пользователей) |
| `email` | String(255) (nullable, unique) | Email для самостоятельной авторизации |
| `password_hash` | String(255) (nullable) | bcrypt-хеш пароля |
| `gender` | String(10) | `male` / `female` |
| `age`, `height_cm`, `weight_kg` | Int / Float | Физиологические данные |
| `activity_level` | String(20) | `sedentary`..`very_active` |
| `goal` | String(20) | `maintain` / `lose_weight` / `gain_muscle` |
| `target_calories/protein/fat/carbs` | Float | Рассчитанные дневные нормы |
| `reminder_times` | JSONB | `{"breakfast": "08:00", ...}` |

### Product
Калории и БЖУ **на 100 г**.

### Recipe
- `ingredients` → `RecipeIngredient[]` (name, amount_grams, unit, product_id)
- `meal_type` ARRAY: `["завтрак", "обед", "ужин", "перекус"]`
- `diet_tags` ARRAY: `["vegan", "halal", "kosher", ...]`
- `allergens` ARRAY: `["глютен", "лактоза", "орехи", ...]`
- `total_*` — суммарные КБЖУ на порцию

### MealPlan + MealPlanItem
План на конкретную дату → список `(recipe_id, meal_type, servings)`.

---

## 5. API-контракты

Запросы аутентифицируются одним из двух способов:
- Заголовок `X-Telegram-Init-Data` (из Telegram Web App)
- Cookie `access_token` (JWT, httpOnly)

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/health` | Healthcheck |
| POST | `/api/auth/register` | Регистрация (email + password) → JWT cookie |
| POST | `/api/auth/login` | Вход (email + password) → JWT cookie |
| POST | `/api/auth/logout` | Очистка cookie |
| GET | `/api/auth/me` | Текущий юзер (двойная auth) |
| GET | `/api/profile` | Получить профиль |
| PUT | `/api/profile` | Обновить профиль → пересчёт КБЖУ |
| GET | `/api/products?q=` | Поиск продуктов |
| GET | `/api/products/{id}` | Продукт по ID |
| GET | `/api/recipes?q=&meal_type=&max_calories=` | Поиск рецептов |
| GET | `/api/recipes/{id}` | Рецепт с ингредиентами |
| POST | `/api/recipes` | Создать рецепт |
| DELETE | `/api/recipes/{id}` | Удалить (только автор) |
| GET | `/api/meal-plan/today` | План на сегодня |
| POST | `/api/meal-plan/generate` | Сгенерировать через DeepSeek |
| POST | `/api/meal-plan/{id}/pin` | Закрепить план |
| GET | `/api/meal-plan/{id}/shopping-list` | Список покупок |

---

## 6. Формулы КБЖУ

**BMR (Mifflin-St Jeor):**
```
Мужчины: 10 × вес(кг) + 6.25 × рост(см) − 5 × возраст + 5
Женщины: 10 × вес(кг) + 6.25 × рост(см) − 5 × возраст − 161
```

**TDEE:** `BMR × activity_multiplier`

| Активность | Коэфф. |
|-----------|--------|
| sedentary | 1.2 |
| light | 1.375 |
| moderate | 1.55 |
| active | 1.725 |
| very_active | 1.9 |

**Цель:** maintain ×1.0 · lose_weight ×0.85 · gain_muscle ×1.15

**Макросплит (доля от калорий):**

| Цель | Белки | Жиры | Углеводы |
|------|-------|------|----------|
| maintain | 25% | 30% | 45% |
| lose_weight | 35% | 25% | 40% |
| gain_muscle | 30% | 25% | 45% |

Граммы: `protein = cal × доля / 4`, `fat = cal × доля / 9`, `carbs = cal × доля / 4`

---

## 7. DeepSeek промпт

Системный промпт ожидает от модели **JSON-ответ** с полями:
```json
{
  "meals": [{"meal_type": "breakfast", "recipe_id": 1, "servings": 1.0}, ...],
  "total_calories": 2100,
  "total_protein": 130,
  "total_fat": 70,
  "total_carbs": 250,
  "reasoning": "..."
}
```
Модель получает: целевые КБЖУ + JSON с доступными рецептами (id, title, КБЖУ, теги).

---

## 8. Аутентификация

Поддерживается **двойная авторизация** (приоритет сверху вниз):

1. **Telegram initData** — заголовок `X-Telegram-Init-Data`, HMAC-SHA256 валидация с BOT_TOKEN
2. **JWT cookie** — cookie `access_token`, httpOnly, срок жизни 7 дней, подпись через `jwt_secret_key`
3. Если нет ни того, ни другого → **401**

- **Bot → DB**: через `AuthMiddleware` — на каждый update создаёт/находит юзера по `telegram_id`
- **Web App (из Telegram)**: заголовок `X-Telegram-Init-Data` → проверяется HMAC-SHA256
- **Прямой заход (браузер)**: email + пароль → JWT в httpOnly cookie
- **Пароли**: bcrypt хеширование (`app/services/auth_service.py`)
- **Admin-эндпоинты** (редакторы продуктов/рецептов): отдельный пароль `admin_password` в заголовке `X-Admin-Password`

---

## 9. Деплой

### Первый запуск
```bash
# 1. Склонировать репо
git clone <repo> && cd eatsmart_bot

# 2. Создать .env из шаблона
cp .env.example .env
# Заполнить BOT_TOKEN, DEEPSEEK_API_KEY, SECRET_KEY, пароли БД

# 3. Убедиться, что порты 80 и 443 открыты у провайдера

# 4. Запустить nginx (с HTTP-only конфигом для получения сертификата)
docker compose up -d nginx

# 5. Получить SSL-сертификат (автоматический скрипт)
./scripts/get-certificate.sh your@email.com
# Скрипт сам получит сертификат и переключит nginx на HTTPS

# 6. Запустить всё
docker compose up -d

# 7. Создать первую миграцию
docker compose exec bot alembic revision --autogenerate -m "initial"
docker compose exec bot alembic upgrade head

# 8. (Опционально) Загрузить продукты из CSV
docker compose exec bot python -c "
from app.db.database import async_session
import asyncio, csv
async def seed():
    # ... вставить продукты из data/products.csv
    pass
asyncio.run(seed())
"
```

### Обновление
```bash
git pull
docker compose build bot
docker compose up -d bot
docker compose exec bot alembic upgrade head
```

---

## 10. Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + кнопка Web App |
| `/profile` | Показать профиль |
| `/edit_profile` | Редактировать профиль (FSM) |
| `/recipes` | Меню рецептов |
| `/search_recipe <q>` | Поиск рецепта |
| `/plan` | Рацион на сегодня |
| `/generate_plan` | Сгенерировать рацион (AI) |
| `/pin_plan` | Закрепить план |
| `/shopping_list` | Список покупок |
| `/reminders` | Настройки напоминаний |
| `/toggle_reminders` | Вкл/выкл напоминания |

---

## 11. Конвенции кода

1. **Async everywhere** — все I/O через `async/await`
2. **Типизация** — `Mapped[]`, type hints, Pydantic models для API
3. **Разделение слоёв** — handlers/routes → services → repositories → models
4. **CRUD в репозиториях** — не в handlers, не в services
5. **Конфигурация через .env** — все секреты только в `.env`, никогда в коде
6. **Миграции через Alembic** — `alembic revision --autogenerate`, `alembic upgrade head`
7. **Логирование** — `logging.getLogger(__name__)`, не `print()`
8. **Комментарии** — docstrings на английском, пользовательские строки на русском

---

## 12. TODO (следующие шаги)

- [ ] Alembic-миграция для новых полей User (email, password_hash, telegram_id nullable)
- [ ] SMTP + верификация email (настроить Yandex 360 или аналог)
- [ ] Восстановление пароля (после SMTP)
- [ ] Привязка Telegram к существующему email-аккаунту
- [ ] Замена кнопки "Отправить в чат" → "Поделиться" (Web Share API)
- [ ] Реализовать ручное составление рациона с подсказками
- [ ] Комплексная обработка ошибок в API (422, rate limits)
- [ ] Unit-тесты (pytest + pytest-asyncio)
- [ ] CI/CD (GitHub Actions → SSH deploy)
- [ ] Логирование в файл / ELK / Grafana
