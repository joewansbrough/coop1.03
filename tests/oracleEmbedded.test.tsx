import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OracleAssistant, { floatingOraclePanelClassName, getOracleVoiceControlLabel } from '../components/OracleAssistant.tsx';
import { FloatingOracleAssistant } from '../components/Layout.tsx';
import PolicyAssistant from '../pages/PolicyAssistant.tsx';
import { readFileSync } from 'node:fs';

test('embedded OracleAssistant renders the chat surface, not a placeholder', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <OracleAssistant embedded />
    </MemoryRouter>,
  );

  assert.doesNotMatch(html, /Embedded Oracle Assistant/);
  assert.match(html, /Ask me about co-op policies/);
  assert.match(html, /policy-assistant-qa/);
  assert.match(html, /Start Voice/);
  assert.doesNotMatch(html, /Ask about policies, meetings, or maintenance/);
});

test('documents variant keeps the Oracle chat shell with document-focused copy', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <OracleAssistant embedded variant="documents" />
    </MemoryRouter>,
  );

  assert.match(html, /Co-op Oracle/);
  assert.match(html, /Document assistant/);
  assert.match(html, /Ask about indexed documents/);
  assert.doesNotMatch(html, /Ask coopHUB Docs/);
});

test('Oracle voice control has an explicit stop listening label', () => {
  assert.equal(getOracleVoiceControlLabel(false), 'Start Voice');
  assert.equal(getOracleVoiceControlLabel(true), 'Stop Listening');
});

test('floating OracleAssistant is hidden on the Policy Assistant route', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/policy-assistant']}>
      <FloatingOracleAssistant isAutoDemoOpen={false} />
    </MemoryRouter>,
  );

  assert.equal(html, '');
});

test('floating OracleAssistant remains available away from the Policy Assistant route', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/maintenance']}>
      <FloatingOracleAssistant isAutoDemoOpen={false} />
    </MemoryRouter>,
  );

  assert.match(html, /Open Co-op Oracle/);
  assert.match(floatingOraclePanelClassName, /h-\[min\(720px,calc\(100dvh-7rem\)\)\]/);
  assert.match(floatingOraclePanelClassName, /w-\[min\(44rem,calc\(100vw-2rem\)\)\]/);
  assert.doesNotMatch(floatingOraclePanelClassName, /h-80/);
});

test('Policy Assistant page uses a responsive embedded chat height', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PolicyAssistant documents={[]} announcements={[]} />
    </MemoryRouter>,
  );

  assert.match(html, /h-\[calc\(100dvh-12rem\)\]/);
  assert.match(html, /min-h-\[420px\]/);
  assert.doesNotMatch(html, /h-\[720px\]/);
});

test('Policy Assistant page aligns with the standard page width', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PolicyAssistant documents={[]} announcements={[]} />
    </MemoryRouter>,
  );

  assert.match(html, /max-w-7xl/);
  assert.doesNotMatch(html, /max-w-5xl/);
});

test('OracleAssistant scrolls to the newest message after chat changes', () => {
  const source = readFileSync(new URL('../components/OracleAssistant.tsx', import.meta.url), 'utf8');

  assert.match(source, /messagesEndRef/);
  assert.match(source, /scrollIntoView\(\{ block: 'end'/);
});

test('Resource Library uses the shared document Oracle instead of the old docs ask panel', () => {
  const source = readFileSync(new URL('../pages/ResourceLibrary.tsx', import.meta.url), 'utf8');

  assert.match(source, /<OracleAssistant embedded variant="documents"/);
  assert.doesNotMatch(source, /Ask coopHUB Docs/);
  assert.doesNotMatch(source, /handleAskRag/);
});
