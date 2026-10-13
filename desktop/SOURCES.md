# Sources and decision

- DSL compiler, MCP, block schema: this repository at base 828adaafccab179f6b53fdc700599e73296d119e.
- FastAPI workspace/process/window/installer shell adapted from lilyco-42/mirage-tank,
  source 59f4142602c5f188bcd8db0eeb5b2cc20c849d55 (MIT). Prior shared shell from
  Triforge has its original MIT notice in SHARED-SOURCE-LICENSE.
- shadcn components copied verbatim, URLs and hashes in ui/src/shadcn-sources.json;
  MIT notice in ui/src/components/ui/LICENSE.md. All UI customization in wrappers/tokens.
- Node SEA build follows pinned Node 22.18 docs:
  https://nodejs.org/download/release/v22.18.0/docs/api/single-executable-applications.html

Prior-art comparison: TyranoBuilder exports use its own engine/build pipeline
(https://tyranobuilder.com/tutorials/all-done-time-to-export), Ren'Py web rendering
has its own engine/runtime (https://www.renpy.org/doc/html/web.html).
Those are not substitutes for inspecting the actual LetsGal compiler. We adopt
the existing proven local app shell and original compiler; add a clearly labelled
story preview instead of falsely claiming official game export.

Community pointers (anecdotes, not market or revenue estimates):
https://github.com/renpy/renpy/issues/6291 (web media playback quirks)
https://github.com/fracturedring/renpy-mcp (browser authoring plus MCP precedent)

No official engine/template assets are redistributed. No new revenue is proven.

Windows SDK attribution: Microsoft.Web.WebView2 1.0.3856.49,
https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.3856.49 .
The official NuGet LICENSE.txt is preserved separately from pywebview's BSD notice.
packaging/webview2-sdk.json pins the official package, license, and all five bundled
SDK file hashes; Actions checks both installed dependencies and the frozen output.
Runtime deployment is separate: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution .

Original Lyco application icon: lilyco-42/lyco-ip guidance 82f35f190129498f73ef7199075c3a1723adfe2d, retained resources/icon-source.json, PNG and separate IP notice. Packaging helper: original shared MIT source lilyco-42/lilyco 0f98b81f101ee962db12f2d600f8a8bba13ecdff apps/desktop-common/desktop_icons.py. Conversion and complete PE/native icon checks execute only in Actions; no design baseline images are redistributed.
