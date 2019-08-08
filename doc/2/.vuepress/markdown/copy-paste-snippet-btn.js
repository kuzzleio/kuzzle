module.exports = md => {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (...args) => {
    const [tokens, idx] = args;
    const rawCode = fence(...args);
    return rawCode
      .replace(
        '<!--beforebegin-->',
        '<!--beforebegin--><div class="code-block">'
      )
      .replace('<!--afterend-->', '</div><!--afterend-->')
      .replace('<!--afterbegin-->', `${renderButton(idx)}<!--afterbegin-->`);
  };
};

function renderButton(index) {
  return `
    <div class="codehilite" id="__code_${index}">
      <button
        class="md-clipboard"
        title="Copy to clipboard"
        data-clipboard-target="#__code_${index} pre code"
      />
      <span class="md-clipboard__message">Copied to clipboard!</span>
    </div>`;
}
