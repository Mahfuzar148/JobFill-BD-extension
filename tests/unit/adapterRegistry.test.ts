import { describe, it, expect } from 'vitest';
import { resolveSiteAdapter } from '../../src/adapters/adapter-registry';
import { PetroBanglaAdapter } from '../../src/adapters/petrobangla-adapter';
import { TeletalkAdapter } from '../../src/adapters/teletalk-adapter';
import { BPSCAdapter } from '../../src/adapters/bpsc-adapter';
import { GenericAdapter } from '../../src/adapters/generic-adapter';

describe('Universal Site Adapter Registry', () => {
  it('correctly resolves PetroBanglaAdapter for PetroBangla / BOGMC URLs', () => {
    const doc = document.implementation.createHTMLDocument();
    const adapter = resolveSiteAdapter('http://bogmc.teletalk.com.bd/apply.php', doc);
    expect(adapter.id).toBe(PetroBanglaAdapter.id);
  });

  it('correctly resolves TeletalkAdapter for standard Teletalk recruitment URLs', () => {
    const doc = document.implementation.createHTMLDocument();
    const adapter = resolveSiteAdapter('https://alljobs.teletalk.com.bd/circular', doc);
    expect(adapter.id).toBe(TeletalkAdapter.id);
  });

  it('correctly resolves BPSCAdapter for BPSC / BCS URLs', () => {
    const doc = document.implementation.createHTMLDocument();
    const adapter = resolveSiteAdapter('http://bpsc.teletalk.com.bd/form1.php', doc);
    expect(adapter.id).toBe(BPSCAdapter.id);
  });

  it('resolves GenericAdapter fallback for unknown or generic portals', () => {
    const doc = document.implementation.createHTMLDocument();
    const adapter = resolveSiteAdapter('https://recruitment.customs.gov.bd/job/12', doc);
    expect(adapter.id).toBe(GenericAdapter.id);
  });

  it('pre-processes forms by opening collapsed accordions and revealing inputs', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="section1" class="collapse">
        <input type="text" name="applicant_name" />
      </div>
    `;
    document.body.appendChild(container);

    GenericAdapter.preProcessForm?.(document);
    const section = document.getElementById('section1');
    expect(section?.classList.contains('show')).toBe(true);

    container.remove();
  });
});
