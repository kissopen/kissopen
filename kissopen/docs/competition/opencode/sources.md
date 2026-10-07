# OpenCode Sources

Reviewed on 2026-03-21.

- repo: `https://github.com/sst/opencode`
- checkout: `../kissopen-adjacent/research/opencode`
- commit: `2e0d5d230893dbddcefb35a02f53ff2e7a58e5d0`

## Primary files inspected

- `../kissopen-adjacent/research/opencode/packages/opencode/src/session/message-v2.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/session/index.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/session/prompt.ts`
- `../kissopen-adjacent/research/opencode/packages/sdk/js/src/v2/gen/types.gen.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/tool/task.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/tool/todo.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/permission/index.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/permission/evaluate.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/server/server.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/server/routes/experimental.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/auth/index.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/control-plane/workspace-server/routes.ts`
- `../kissopen-adjacent/research/opencode/packages/opencode/src/control-plane/sse.ts`
- `../kissopen-adjacent/research/opencode/packages/app/src/context/global-sync.tsx`
- `../kissopen-adjacent/research/opencode/packages/app/src/context/global-sync/event-reducer.ts`
- `../kissopen-adjacent/research/opencode/packages/app/src/components/session-context-usage.tsx`
- `../kissopen-adjacent/research/opencode/packages/app/src/components/session/session-context-tab.tsx`

## Notes

- The context/debug surface is not a side detail; it is one of the strongest product ideas in the repo.
- The server split deserves deeper follow-up work after this first pass.
