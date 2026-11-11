// JobFill BD - Comprehensive Label Resolver Engine
// Accurately extracts associated label text using 6-tier evidence hierarchy.

export class LabelResolver {
  /**
   * Resolves the human-readable label for a given form element.
   * Priority:
   * 1. Explicit <label for="id">
   * 2. Wrapping <label> ancestor
   * 3. aria-label or aria-labelledby
   * 4. Preceding table cell in same row (common in Teletalk / BOGMC forms)
   * 5. Adjacent preceding sibling or text node
   * 6. Title attribute or placeholder fallback (never placeholder alone)
   */
  public static resolveLabel(element: HTMLElement): string {
    const doc = element.ownerDocument || document;
    const id = element.getAttribute('id');

    // Tier 1: Explicit <label for="id">
    if (id) {
      const explicitLabel = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (explicitLabel && explicitLabel.textContent?.trim()) {
        return this.cleanLabel(explicitLabel.textContent);
      }
    }

    // Tier 2: Wrapping <label>
    const wrappingLabel = element.closest('label');
    if (wrappingLabel && wrappingLabel.textContent?.trim()) {
      return this.cleanLabel(wrappingLabel.textContent);
    }

    // Tier 3: ARIA label attributes
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return this.cleanLabel(ariaLabel);
    }
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelledByElem = doc.getElementById(ariaLabelledBy);
      if (labelledByElem && labelledByElem.textContent?.trim()) {
        return this.cleanLabel(labelledByElem.textContent);
      }
    }

    // Tier 4: Table-based form layouts (Teletalk / BOGMC / BPSC standard)
    // <tr><td class="label">Applicant Name</td><td>:</td><td><input name="name"/></td></tr>
    const tdParent = element.closest('td');
    if (tdParent) {
      let prevTd = tdParent.previousElementSibling;
      while (prevTd && !/[a-zA-Z0-9\u0980-\u09FF]/.test(prevTd.textContent || '')) {
        prevTd = prevTd.previousElementSibling;
      }
      if (prevTd && prevTd.textContent?.trim()) {
        return this.cleanLabel(prevTd.textContent);
      }
      // Or <th> header in the same row
      const trParent = tdParent.closest('tr');
      if (trParent) {
        const th = trParent.querySelector('th');
        if (th && th.textContent?.trim()) {
          return this.cleanLabel(th.textContent);
        }
      }
    }

    // Tier 5: Preceding sibling element or label
    let prev = element.previousElementSibling;
    while (prev) {
      if (
        prev.tagName.toLowerCase() === 'label' ||
        prev.classList.contains('label') ||
        prev.classList.contains('form-label')
      ) {
        if (prev.textContent?.trim()) {
          return this.cleanLabel(prev.textContent);
        }
      }
      prev = prev.previousElementSibling;
    }

    // Tier 6: Placeholder / Title fallback (accompanied by name fallback)
    const title = element.getAttribute('title');
    if (title && title.trim()) {
      return this.cleanLabel(title);
    }

    const placeholder = element.getAttribute('placeholder');
    if (placeholder && placeholder.trim() && !placeholder.toLowerCase().includes('max')) {
      return this.cleanLabel(placeholder);
    }

    // Fallback to name or id formatted as words
    const name = element.getAttribute('name') || id || '';
    return name.replace(/[_-]+/g, ' ').trim();
  }

  private static cleanLabel(text: string): string {
    return text
      .replace(/[*:\n\r\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
