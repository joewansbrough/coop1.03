import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { desktopNotificationButtonClassName, ProfileDropdown } from '../components/Layout.tsx';

test('top-right notifications button is hidden until desktop viewports', () => {
  assert.match(desktopNotificationButtonClassName, /hidden/);
  assert.match(desktopNotificationButtonClassName, /lg:flex/);
});

test('profile dropdown exposes notifications hub on mobile', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ProfileDropdown
        isAdmin={false}
        user={{ email: 'member@example.com', name: 'Member User', picture: '' }}
        unreadCount={3}
        onOpenProfile={() => undefined}
        onOpenHelp={() => undefined}
        onNavigate={() => undefined}
        onLogout={() => undefined}
      />
    </MemoryRouter>,
  );

  assert.match(html, /Notifications Hub/);
  assert.match(html, /3 unread/);
  assert.match(html, /lg:hidden/);
});
