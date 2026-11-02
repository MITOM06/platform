# Diagrams

Interactive, code-linked diagrams of PON. Each folder holds one self-contained
`index.html` (open it in any browser, no server needed) and a `preview.png`
used by the root README. GitHub Pages serves this folder from `main`, so a
diagram at `docs/diagrams/<name>/index.html` is reachable at
`https://mitom06.github.io/platform/diagrams/<name>/`.

| Folder | What it shows | Type |
|---|---|---|
| `pon-runtime/` | Whole platform at runtime on the Mac Mini: Cloudflare → Caddy → services, data stores, external APIs, trust boundary | archify `architecture` |
| `module-a-ai-request/` | One `@AI` request end to end: chat-service → RabbitMQ → ai-service pipeline, agentic loop, tools → Redis → STOMP → client, plus error branches | archify `workflow` |
| `module-a/` (Mermaid) | Earlier static Mermaid sources/SVGs for Module A, kept for reference | Mermaid |

## How they are made

The diagrams are produced with the [archify](https://github.com/tt-a1i/archify)
skill (`npx skills add tt-a1i/archify -g`). The author keeps the `candidate.json`
input locally under `.archify/` (git-ignored); the rendered HTML is copied here.

```sh
# from the repo root, with the candidate JSON for the diagram
node ~/.agents/skills/archify/bin/archify.mjs finalize workflow \
  .archify/<run>/candidate.json .archify/<run>/out.html \
  --repo-root . --quality showcase --json
cp .archify/<run>/out.html docs/diagrams/<name>/index.html

# preview image (dark theme) for the README
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --hide-scrollbars --window-size=1600,2000 --virtual-time-budget=6000 \
  --screenshot=/tmp/shot.png "file://$PWD/docs/diagrams/<name>/index.html"
sips -c 1600 1600 --cropOffset 0 0 /tmp/shot.png --out docs/diagrams/<name>/preview.png
```

## Keeping them honest

Every node links to a file and line range at the commit the diagram was drawn
from (`meta.repository.revision`, shown in the diagram footer). The links never
break, but the diagram silently drifts from the code as the flow changes.
Regenerate a diagram when you change the flow it describes, not on every
commit: each HTML is ~870 KB and lands in git history.
