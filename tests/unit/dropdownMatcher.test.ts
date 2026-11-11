import { describe, it, expect, beforeEach } from 'vitest';
import { findBestOption, setSelectValue } from '../../src/engine/dropdownMatcher';

describe('Dropdown Matcher Engine', () => {
  let selectEl: HTMLSelectElement;

  beforeEach(() => {
    selectEl = document.createElement('select');
  });

  it('matches exact English option values', () => {
    selectEl.innerHTML = `
      <option value="">Select</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
    `;
    const match = findBestOption(selectEl, 'Male');
    expect(match).toBe('Male');
  });

  it('matches bilingual Bengali options to English profile data', () => {
    selectEl.innerHTML = `
      <option value="">নির্বাচন করুন</option>
      <option value="1">পুরুষ</option>
      <option value="2">মহিলা</option>
    `;
    const match = findBestOption(selectEl, 'Male');
    expect(match).toBe('1');
  });

  it('matches Bangladesh education boards bilingually', () => {
    selectEl.innerHTML = `
      <option value="">Select Board</option>
      <option value="Dhaka">Dhaka</option>
      <option value="Rajshahi">Rajshahi</option>
      <option value="BTEB">Technical / BTEB</option>
    `;
    const match = findBestOption(selectEl, 'Dhaka');
    expect(match).toBe('Dhaka');
  });

  it('matches religion values with case and whitespace insensitivity', () => {
    selectEl.innerHTML = `
      <option value="">--Select Religion--</option>
      <option value="ISLAM">  Islam  </option>
      <option value="HINDUISM">Hinduism</option>
    `;
    const match = findBestOption(selectEl, 'Islam');
    expect(match).toBe('ISLAM');
  });

  it('sets value and fires native change event', () => {
    selectEl.innerHTML = `
      <option value="">Select</option>
      <option value="Science">Science</option>
      <option value="Commerce">Commerce</option>
    `;
    let eventFired = false;
    selectEl.addEventListener('change', () => {
      eventFired = true;
    });

    const success = setSelectValue(selectEl, 'Science');
    expect(success).toBe(true);
    expect(selectEl.value).toBe('Science');
    expect(eventFired).toBe(true);
  });
});
