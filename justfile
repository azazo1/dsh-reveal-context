# 列出可用的 recipe.
[private]
default:
    @just --list

# 安装项目依赖.
install:
    pnpm install

# 执行 TypeScript 类型检查, 不生成文件.
typecheck:
    pnpm exec tsc --noEmit

# 构建 Host ESM 产物.
build-host:
    pnpm exec tsdown --config tsdown.config.ts

# 构建 Web Client IIFE 产物.
build-client:
    pnpm exec tsdown --config tsdown.client.config.ts

# 构建全部 Host 与 Client 产物.
build: build-host build-client

# 运行单元测试.
test:
    pnpm exec vitest run

# 检查浏览器产物的 loader 注册与模块表请求.
check-client-entry:
    node scripts/check-client-entry.mjs

# 检查插件命名声明.
check-naming:
    node ~/.dsh/skills/dsh-plugin-upgrade-skill/skills/plugin-write/scripts/validate-names.mjs --manifest ./dsh-plugin.naming.json

# 检查类型, 构建, 测试与浏览器入口.
verify:
    just typecheck
    just build
    just test
    just check-client-entry

# 清除中间产物.
clean:
    rm -rf lib/
    rm -rf node_modules/
    rm -rf .tmp/
