FROM node:18-alpine

WORKDIR /app

COPY pnpm-lock.yaml package.json ./
RUN npm install -g pnpm@9.15.9 && pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "--filter", "@workspace/scripts", "run", "hello"]
