# План повышения покрытия тестами до 95%

Текущее состояние: **~85.5%** statements/lines (v8). Цель: **95%** по строкам/выражениям для **runtime-кода**, без бесполезных тестов.

## Принципы

- **Тестировать поведение и контракты**, а не реализацию: сценарии «при таких входах — такой выход или такая ошибка».
- **Предпочитать публичный API**: если ветку можно покрыть через `request()` / `endpoint()` / `bind()` или через композицию с withRetry/withTimeout — делать именно так; к чистым утилитам с нетривиальными ветками добавлять unit-тесты только при необходимости.
- **Не гнаться за 100%**: явные no-op ветки (например `if (!x) return;` с очевидным контрактом) можно не покрывать, если это потребует искусственных тестов.
- **Type-only файлы не считаем в покрытии**: `src/types.ts` и `**/types.ts` содержат только типы (нет runtime). Их исключаем из coverage, чтобы 95% относились к реальному коду.

---

## 1. Исключить type-only файлы из coverage

В `vitest.config.ts` в `coverage.exclude` добавить:

- `**/types.ts` (в т.ч. `src/types.ts`)
- при необходимости — переэкспорты только типов, если они дают 0% и не несут логики

После исключения текущее покрытие **уже учтённого** кода станет выше (знаменатель уменьшится). Оценка: без types уже около **90%+** по оставшемуся коду; дальше точечно добивать непокрытые ветки.

---

## 2. Что покрывать (по модулям)

### 2.1 `src/utils.ts` (87.5% → 95%+)

- **mergeHeaders(base, next)**  
  - Сейчас не покрыто: ранний возврат при `!next` (строка 123) и ветка «одиночное значение» в `merged[key] = value` (132).  
  - **Как:** в `utils.spec.ts` добавить: вызов `mergeRequestOptions(base, {})` или тест только `mergeHeaders` (если экспортировать для теста не хочется — покрыть через `mergeRequestOptions`: merge с пустым `next` и проверка, что заголовки из base на месте).  
  - Полезность: проверяем контракт «merge с пустым next не теряет base».

- **mergeConfig** (170–173, 185)  
  - Используется в `http.ts` при `bind(ctx, mergeConfig(baseConfig, config))`.  
  - **Как:** интеграционный тест: `http({...}).bind(ctx, config)` с разными `config` (headers/timeout) и проверка, что опции в запросе слились (например через mock fetch и проверку заголовков/таймаута). Либо unit в utils.spec: импорт `mergeConfig` и тесты `mergeConfig(undefined, undefined) === undefined`, `mergeConfig({timeout: 1}, {timeout: 2})` и т.д.  
  - Полезность: контракт слияния конфигов при bind.

- **applyConfigToOptions**  
  - Уже вызывается через bind; при добавлении тестов mergeConfig / bind можно проверить и «config применяется к options» в том же сценарии.

### 2.2 `src/client/bind.ts` (95.65% → 100% по строкам)

- **Строки 73–74:** `if (input.ctx === undefined) throw new Error(...)`.  
  - **Как:** в тестах клиента (или в integration) вызвать `client.bind(undefined as any)` или `bind({ctx: undefined}, ...)` и ожидать throw с сообщением про `ctx`.  
  - Полезность: явный контракт «bind без ctx — ошибка».

### 2.3 `src/client/endpoint.ts` (92.45% → 95%+)

- **Невалидный HTTP method** (36–38): `METHOD_PATTERN.test` не прошёл.  
  - **Как:** в endpoint.spec вызвать `endpoint('INVALID /path', {baseUrl: 'https://api.test'})` и ожидать throw `Invalid HTTP method`.  
  - Полезность: валидация метода.

- **Missing param** (57–58): в URL остались `{placeholder}` после подстановки.  
  - Уже есть «throws on missing params» для пустого `params: {}`; при необходимости добавить кейс «есть params, но не хватает одного» (например путь `/{a}/{b}`, params только `{a: 1}`) и ожидать throw.  
  - Полезность: полный контракт подстановки params.

- **appendQuery: пустой queryString** (86–87): после добавления query строка пустая, возвращаем `path` без `?`.  
  - **Как:** например `endpoint('GET /path', {baseUrl: 'https://api.test', query: {empty: ''}})` или query с ключами, дающими пустой URLSearchParams — проверить, что URL без лишнего `?`.  
  - Полезность: граничный случай URL.

### 2.4 `src/client/request.ts` (87% → 95%+)

- **buildRequestInit:** ветка с массивом заголовков (127–129).  
  - **Как:** вызвать `request(..., {headers: {'x-custom': ['a', 'b']}}, {fetch: mock})` и в mock проверить, что в `RequestInit` заголовок передан как несколько значений (или как массив в зависимости от реализации).  
  - Полезность: multi-value headers в реальном запросе.

- **Отсутствие fetch** (168–170): `input?.fetch` и `globalThis.fetch` оба отсутствуют.  
  - **Как:** вызвать `request('GET /u', {}, {})` в среде без `globalThis.fetch` (или с временно удалённым fetch) и ожидать throw «Fetch implementation is required». Либо передать `input: { fetch: undefined }` и заменить globalThis.fetch на undefined в тесте.  
  - Полезность: явный контракт при отсутствии fetch.

### 2.5 `src/with-retry/utils.ts` (67.78% → 90%+)

Самый большой провал по покрытию. Покрывать по приоритету:

- **parseRetriesShorthand:** возврат `undefined` при не 3 частях, при неверном strategy, при нечисловых/отрицательных значениях.  
  - **Как:** unit-тесты в with-retry/utils.spec (или в with-retry.spec через вызовы withRetry с такими строками): невалидные строки → без ретраев или ошибка; валидная `exp,1,3` уже частично покрыта.  
  - Полезность: не падать на плохом вводе, контракт формата.

- **parseBudget:** preset (conservative/balanced/aggressive), shorthand `budget,N,M,K`, невалидный shorthand (throw TypeError), неизвестный preset (throw), объект.  
  - **Как:** unit-тесты: вызовы parseBudget с разными строками и объектами; с withRetry — с `budget: 'conservative'` и т.д.  
  - Полезность: бюджет — часть публичного API, ошибки парсинга должны быть предсказуемы.

- **firstHeaderValue / parseRetryAfterSeconds:** Retry-After в секундах и в Date.  
  - **Как:** тесты withRetry с mock response с заголовком Retry-After (число и дата) и проверка задержки (fake timers).  
  - Полезность: поведение при 429/503.

- **sleepMs:** signal aborted до таймера, отмена по signal.  
  - **Как:** unit или через withRetry: передать AbortSignal, отменить до истечения delay — promise reject с AbortError.  
  - Полезность: отмена ожидания при отмене запроса.

### 2.6 `src/with-retry/with-retry.ts` (89.5% → 95%+)

- Строки 158–159, 175–176: ветки в цикле retry (последняя попытка, consumeBudgetForRetry).  
  - **Как:** сценарии: «все попытки исчерпаны — throw last error»; «budget кончился — не делаем следующую попытку». Уже частично есть; добавить явные тесты на «retries exhausted» и «budget exhausted».  
  - Полезность: граничные случаи ретраев.

### 2.7 `src/with-timeout/utils.ts` (89% → 95%+)

- Ветки getDeadline, clampMin, withDeadlineHeader (номера строк в отчёте: 46, 54–55, 89–90).  
  - **Как:** в with-timeout.spec добавить: ctx с кастомным getDeadline; timeout меньше minTimeout (clamp); конфиг deadlineHeader и проверка заголовка в запросе.  
  - Полезность: контракт deadline и заголовка.

### 2.8 `src/with-logger` (utils 84%, with-logger 82%)

- **utils:** setByPath / applyRedaction с путями и Object.hasOwn; edge cases redaction.  
  - **Как:** в with-logger/utils.spec добавить кейсы: вложенные объекты, пути с отсутствующими ключами, circular — без падения и с ожидаемым результатом.  
  - Полезность: стабильность редактирования логов.

- **with-logger.ts:** ветки по include (requestStart, responseSuccess, responseError, headers, body), mapLevel, emitSafe при ошибке логгера.  
  - **Как:** тесты с разными `include` и проверка структуры события; тест с логгером, который бросает в .info — запрос всё равно должен завершиться.  
  - Полезность: опции логирования и «логирование не ломает запрос».

### 2.9 `src/with-tracing/utils.ts` (80%)

- Ветки getHeaderName, safeGetId (null/undefined/пустая строка).  
  - **Как:** тесты withTracing с opts без headerName / с кастомным; getId возвращает null или '' — заголовок не должен появиться.  
  - Полезность: контракт опций трассировки.

---

## 3. Порядок внедрения

1. **Vitest:** исключить `**/types.ts` и `src/types.ts` из coverage, перезапустить coverage и зафиксировать новый базовый %.
2. **Client:** bind(ctx undefined), endpoint(invalid method, missing params, appendQuery empty), request(no fetch, multi-value headers).
3. **utils:** mergeHeaders через mergeRequestOptions / mergeConfig; при необходимости — прямой unit mergeConfig/applyConfigToOptions.
4. **with-retry:** utils (parseRetriesShorthand, parseBudget, parseRetryAfterSeconds, firstHeaderValue, sleepMs); with-retry (exhausted retries, budget exhausted).
5. **with-timeout:** utils и with-timeout (getDeadline, clamp, deadline header).
6. **with-logger:** utils (redaction edge cases), with-logger (include, mapLevel, logger throws).
7. **with-tracing:** utils (header name, getId null/empty).

После каждого шага — `npm run test:coverage` и проверка, что общий % по строкам ≥ 95% и тесты остаются осмысленными (не только ради числа).

---

## 4. Чего избегать

- Не писать тесты «ради зелёной строчки»: если ветка — это тривиальная проверка или защита «на будущее» без текущего контракта, можно оставить непокрытой или покрыть одним общим сценарием.
- Не дублировать интеграционные сценарии десятками мелких unit-тестов внутренних функций, если то же поведение уже проверяется через публичный API.
- Не тестировать экспорт ради экспорта: если функция используется только внутри модуля и покрывается через публичный API, отдельный unit не обязателен, если не упрощает отладку.

---

## 5. Критерий достижения цели

- Coverage (v8) по **строкам** для включённых в отчёт файлов ≥ **95%**.
- Type-only файлы исключены из отчёта.
- Все новые тесты либо проверяют документированное/очевидное поведение (контракт, ошибки, граничные случаи), либо критичные ветки (парсинг, отмена, merge), без искусственных «проходов по коду».
