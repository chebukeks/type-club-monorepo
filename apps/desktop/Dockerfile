# Мультистейдж-сборка Type Club Desktop (Linux + Windows).
# Использует образ electron-builder с Wine для кроссплатформенной сборки.
FROM electronuserland/builder:wine

WORKDIR /app

# Копируем всю монорепу (нужно для npm workspaces)
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages/editor/ packages/editor/
COPY apps/desktop/ apps/desktop/

# Устанавливаем зависимости
RUN npm install --ignore-scripts

# Собираем релиз
WORKDIR /app/apps/desktop
CMD ["npx", "electron-builder", "--linux", "--win"]
