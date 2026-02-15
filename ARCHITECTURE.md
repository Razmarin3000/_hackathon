# ПОЛЗУНКИ: структура кода

## Текущее состояние

- Фронтенд: модульная структура в `src/game/*`, точка входа `script.js`.
- Матч-сервер: `match-server/src/raceRoom.js` + `match-server/src/nakamaClient.js`.
- Runtime Nakama: `backend/nakama/modules/main.lua`.

## Базовые правила модульности

1. `src/game/config.js`
- Константы и параметры геймплея.

2. `src/game/catalog.js`
- Каталоги сущностей: `SNAKES`, `TRACK_DEFS`, профили ботов, типы пикапов.

3. `src/game/state.js`
- Общие ссылки на DOM и глобальное состояние UI/экрана.

4. `src/game/simulation.js`
- Публичный фасад симуляции гонки (re-export модулей движения/взаимодействий/тела).

5. `src/game/ai.js`
- Публичный фасад ИИ (композиция steering + venom).

6. `src/game/render.js`
- Публичный фасад рендера гонки/экрана ожидания.

7. `src/game/trackMath.js`
- Геометрия трассы: projection/sample/interpolation.

8. `src/game/utils.js`
- Общие утилиты (`clamp`, `lerp`, `wrapAngle` и т.д.).

## Правила для следующих рефакторов

- Сначала переносить чистые функции без побочных эффектов.
- После каждого шага делать `node --check` и ручной дымовой прогон.
- Не смешивать в одном коммите изменение поведения и структурный перенос.
- Для новых механик сначала добавлять код в профильный модуль, затем обновлять `README.md`.

## Текущая модульная схема (2026-02)

Точка входа:
- `script.js` -> вызывает `bootstrapApp()` из `src/game/app.js`.

Корневой компоновщик:
- `src/game/app.js` связывает API всех модулей и запускает приложение.

Базовые модули:
- `src/game/config.js`: константы и конфигурация.
- `src/game/catalog.js`: змеи, трассы, пикапы, профили ботов.
- `src/game/utils.js`: общие математические и служебные функции.
- `src/game/trackMath.js`: проекция/сэмплирование трассы и runtime-данные.
- `src/game/state.js`: общие DOM-хендлы и изменяемое состояние приложения.

Игровые модули:
- `src/game/simulation.js`: тонкий фасад API симуляции.
- `src/game/simMotion.js`: движение змей и coasting после финиша.
- `src/game/simInteractions.js`: фасад взаимодействий во время гонки.
- `src/game/simBodyCrossing.js`: правила пересечения с телами других змей.
- `src/game/simAntiStall.js`: anti-stall логика и мягкий вывод из клина.
- `src/game/simCollisions.js`: коллизии змей и штрафы столкновений.
- `src/game/simBodySystem.js`: фасад механик тела/эффектов.
- `src/game/simBodyCore.js`: сегменты тела, выравнивание heading, speed-floor, модификаторы.
- `src/game/simItemEffects.js`: голод, яблоки/кактусы/пикапы, наложение эффектов.
- `src/game/simProgress.js`: прогресс по чекпоинтам и сортировка standings.
- `src/game/ai.js`: фасад ИИ.
- `src/game/aiTargeting.js`: притяжение к яблокам и выбор целевой траектории.
- `src/game/aiAvoidance.js`: избегание опасностей и края трассы.
- `src/game/aiSteering.js`: сборка финального `throttle/brake/turn`.
- `src/game/venomSystem.js`: яд, снаряды и попадания.
- `src/game/raceFlow.js`: основной оркестратор цикла гонки.
- `src/game/raceSetup.js`: создание состояния гонки и спавн объектов.

UI/сцена:
- `src/game/hud.js`: текст HUD, порядок, подписи эффектов.
- `src/game/coreUi.js`: overlay/countdown, toast, форматирование времени, render-обертки.
- `src/game/renderWorld.js`: фон, трасса, чекпоинты, пикапы/объекты.
- `src/game/renderRacers.js`: тела змей, спрайты, подписи.
- `src/game/render.js`: оркестрация рендера гонки и idle.
- `src/game/uiFlow.js`: экраны, карточки, хоткеи, запуск/рестарт/next-track.
- `src/game/onlineRoomClient.js`: подключение к Colyseus-комнате, отправка `ready/input/ping`, прием `snapshot`.
- `src/game/scene.js`: bootstrap Phaser-сцены, keep-alive в фоне, музыка трассы.

Поддержка:
- `src/game/titleWave.js`: анимация заголовка.
- `src/game/raceDurationStats.js`: статистика длительности заездов для скорости заголовка.

## История рефакторинга (2026-02)

- Шаг 13: выделены механики тела/голода/эффектов в `src/game/simBodySystem.js`.
- Шаг 14: выделены прогресс и standings в `src/game/simProgress.js`.
- Шаг 15: ИИ разделен на `src/game/aiSteering.js` и `src/game/venomSystem.js`, `src/game/ai.js` стал фасадом.
- Шаг 16: рендер разделен на `src/game/renderWorld.js` и `src/game/renderRacers.js`, `src/game/render.js` стал оркестратором.
- Шаг 17: симуляция разделена на `src/game/simMotion.js` и `src/game/simInteractions.js`, `src/game/simulation.js` стал фасадом.
- Шаг 18: механики тела/эффектов разделены на `src/game/simBodyCore.js` и `src/game/simItemEffects.js`, `src/game/simBodySystem.js` стал фасадом.
- Шаг 19: steering-часть ИИ разделена на `src/game/aiTargeting.js` и `src/game/aiAvoidance.js`, `src/game/aiSteering.js` теперь отвечает за финальный control output.
- Шаг 20: запущен online MVP-flow подключения к комнате через `src/game/onlineRoomClient.js` и отображение authoritative `snapshot` в race-экране.
