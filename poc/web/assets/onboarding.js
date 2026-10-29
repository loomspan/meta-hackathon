// Copy buttons: Clipboard API with a selectable-text fallback. No dependencies.
document.querySelectorAll('[data-copy-target]').forEach((button) => {
  button.addEventListener('click', async () => {
    const block = document.getElementById(button.getAttribute('data-copy-target'));
    if (!block) return;
    const text = block.textContent;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(block);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const original = button.textContent;
    button.textContent = copied ? 'Copied' : 'Selected — copy manually';
    setTimeout(() => { button.textContent = original; }, 2000);
  });
});
