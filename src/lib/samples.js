// One sample per language so the preview exercises token rules that TypeScript
// alone never reaches — JSON keys, CSS selectors and units, Markdown headings.
export const SAMPLES = {
  'palette.ts': {
    active: 13,
    lines: [
      '<span class="c">// token colours resolve against the active scope</span>', '',
      '<span class="k">import</span> <span class="x">{</span> <span class="f">defineTheme</span> <span class="x">}</span> <span class="k">from</span> <span class="s">"./palette"</span><span class="x">;</span>', '',
      '<span class="k">const</span> <span class="n">CONTRAST_MIN</span> <span class="o">=</span> <span class="n">4.5</span><span class="x">;</span>', '',
      '<span class="k">export</span> <span class="k">interface</span> <span class="t">Swatch</span> <span class="x">{</span>',
      '  <span class="p">scope</span><span class="x">:</span> <span class="t">string</span><span class="x">;</span>',
      '  <span class="p">hex</span><span class="x">:</span> <span class="t">string</span><span class="x">;</span>',
      '<span class="x">}</span>', '',
      '<span class="k">export</span> <span class="k">function</span> <span class="f">resolve</span><span class="x">(</span><span class="p">list</span><span class="x">:</span> <span class="t">Swatch</span><span class="x">[],</span> <span class="p">scope</span><span class="x">:</span> <span class="t">string</span><span class="x">)</span> <span class="x">{</span>',
      '  <span class="k">const</span> <span class="p">hit</span> <span class="o">=</span> <span class="p">list</span><span class="x">.</span><span class="f">find</span><span class="x">((</span><span class="p">s</span><span class="x">)</span> <span class="o">=&gt;</span> <span class="p">s</span><span class="x">.</span><span class="p">scope</span> <span class="o">===</span> <span class="sel">scope</span><span class="cur"></span><span class="x">);</span>',
      '  <span class="k">if</span> <span class="x">(</span><span class="o">!</span><span class="p">hit</span><span class="x">)</span> <span class="k">throw</span> <span class="k">new</span> <span class="t">Error</span><span class="x">(</span><span class="s">`no swatch for ${scope}`</span><span class="x">);</span>',
      '  <span class="k">return</span> <span class="x">{</span> <span class="p">hex</span><span class="x">:</span> <span class="p">hit</span><span class="x">.</span><span class="p">hex</span><span class="x">,</span> <span class="p">ratio</span><span class="x">:</span> <span class="n">CONTRAST_MIN</span> <span class="x">};</span>',
      '<span class="x">}</span>'
    ]
  },
  'theme.json': {
    active: 6,
    lines: [
      '<span class="x">{</span>',
      '  <span class="p">"name"</span><span class="x">:</span> <span class="s">"Daylight Bone"</span><span class="x">,</span>',
      '  <span class="p">"type"</span><span class="x">:</span> <span class="s">"light"</span><span class="x">,</span>',
      '  <span class="p">"semanticHighlighting"</span><span class="x">:</span> <span class="n">true</span><span class="x">,</span>',
      '  <span class="p">"colors"</span><span class="x">:</span> <span class="x">{</span>',
      '    <span class="p">"editor.background"</span><span class="x">:</span> <span class="s">"#FCFCFC"</span><span class="x">,</span>',
      '    <span class="p">"editorCursor.foreground"</span><span class="x">:</span> <span class="s">"#FF9940"</span><span class="x">,</span>',
      '    <span class="p">"sideBar.background"</span><span class="x">:</span> <span class="s">"#F3F4F5"</span>',
      '  <span class="x">},</span>',
      '  <span class="p">"tokenColors"</span><span class="x">:</span> <span class="x">[</span>',
      '    <span class="x">{</span>',
      '      <span class="p">"scope"</span><span class="x">:</span> <span class="x">[</span><span class="s">"comment"</span><span class="x">],</span>',
      '      <span class="p">"settings"</span><span class="x">:</span> <span class="x">{</span> <span class="p">"fontStyle"</span><span class="x">:</span> <span class="s">"italic"</span> <span class="x">}</span>',
      '    <span class="x">}</span>',
      '  <span class="x">]</span>',
      '<span class="x">}</span>'
    ]
  },
  'tokens.css': {
    active: 9,
    lines: [
      '<span class="c">/* surfaces derive from two neutrals */</span>',
      '<span class="t">:root</span> <span class="x">{</span>',
      '  <span class="p">--ground</span><span class="x">:</span> <span class="n">#fcfcfc</span><span class="x">;</span>',
      '  <span class="p">--ink</span><span class="x">:</span> <span class="n">#5c6166</span><span class="x">;</span>',
      '  <span class="p">--accent</span><span class="x">:</span> <span class="n">#ff9940</span><span class="x">;</span>',
      '<span class="x">}</span>', '',
      '<span class="t">.editor__gutter</span> <span class="x">{</span>',
      '  <span class="p">color</span><span class="x">:</span> <span class="f">var</span><span class="x">(</span><span class="p">--ink</span><span class="x">);</span>',
      '  <span class="p">font-variant-numeric</span><span class="x">:</span> <span class="s">tabular-nums</span><span class="x">;</span>',
      '  <span class="p">padding</span><span class="x">:</span> <span class="n">0</span> <span class="n">12px</span> <span class="n">0</span> <span class="n">14px</span><span class="x">;</span>',
      '<span class="x">}</span>', '',
      '<span class="k">@media</span> <span class="x">(</span><span class="p">prefers-color-scheme</span><span class="x">:</span> <span class="s">dark</span><span class="x">)</span> <span class="x">{</span>',
      '  <span class="t">:root</span> <span class="x">{</span> <span class="p">--ground</span><span class="x">:</span> <span class="n">#16181a</span><span class="x">;</span> <span class="x">}</span>',
      '<span class="x">}</span>'
    ]
  },
  'README.md': {
    active: 1,
    lines: [
      '<span class="t"><b># Daylight Bone</b></span>', '',
      'Warm near-white, foreground held short of black.',
      'Chrome barely separates from the page.', '',
      '<span class="t"><b>## Roles</b></span>', '',
      '<span class="x">-</span> <span class="s">`editor.background`</span> is the page itself',
      '<span class="x">-</span> <span class="k"><b>**accent**</b></span> carries cursor and keyword',
      '<span class="x">-</span> <span class="c"><i>*comments*</i></span> recede almost to the paper', '',
      '<span class="x">[</span><span class="a">contrast notes</span><span class="x">](</span><span class="s">./README.md#contrast</span><span class="x">)</span>', '',
      '<span class="c">&gt; A red squiggle that reads as ink is one you miss.</span>'
    ]
  }
}

export const FILES = Object.keys(SAMPLES)
