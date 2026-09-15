import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('GitHub Pages SPA Redirect Infrastructure', () => {
  it('verifies 404.html exists in public directory and contains correct redirection logic', () => {
    const filePath = path.resolve(__dirname, '../../public/404.html');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('var pathSegmentsToKeep = 1');
    expect(content).toContain('l.pathname.split(\'/\').slice(0, 1 + pathSegmentsToKeep).join(\'/\') + \'/?/\'');
    expect(content).toContain('replace(/&/g, \'~and~\')');
  });

  it('verifies index.html contains the companion URL restoration script', () => {
    const filePath = path.resolve(__dirname, '../../index.html');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain("l.search[1] === '/'");
    expect(content).toContain('window.history.replaceState');
    expect(content).toContain("replace(/~and~/g, '&')");
  });

  it('correctly simulates the URL conversion from 404 to index.html and back', () => {
    // 1. Given incoming URL on refresh:
    const mockLocation = {
      protocol: 'https:',
      hostname: 'ahmadmusadev.github.io',
      port: '',
      pathname: '/HTML-to-React/admissions',
      search: '?tab=classes',
      hash: '#section'
    };

    // 2. 404.html logic:
    const pathSegmentsToKeep = 1;
    const basePart = mockLocation.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/');
    const routePart = mockLocation.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~');
    const queryPart = mockLocation.search ? '&' + mockLocation.search.slice(1).replace(/&/g, '~and~') : '';
    const redirectedUrl = mockLocation.protocol + '//' + mockLocation.hostname + basePart + '/?/' + routePart + queryPart + mockLocation.hash;

    expect(redirectedUrl).toBe('https://ahmadmusadev.github.io/HTML-to-React/?/admissions&tab=classes#section');

    // 3. index.html restoration logic:
    const searchPart = '?/admissions&tab=classes';
    expect(searchPart[1]).toBe('/');

    const decoded = searchPart.slice(1).split('&').map(s => s.replace(/~and~/g, '&')).join('?');
    const pathnameAtRoot = '/HTML-to-React/';
    const finalRestoredUrl = pathnameAtRoot.slice(0, -1) + decoded + mockLocation.hash;

    expect(finalRestoredUrl).toBe('/HTML-to-React/admissions?tab=classes#section');
  });
});
