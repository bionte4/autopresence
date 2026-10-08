FROM node:22-alpine

RUN apk add --no-cache openssl libc6-compat wget
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
